import { ConfidentialClientApplication } from '@azure/msal-node';
import axios from 'axios';
import { Op } from 'sequelize';
import { msalConfig } from '../../auth/config/msalConfig.js';
import Personal from '../../../models/Personal.js';
import Sede from '../../../models/Sede.js';
import Rol from '../../../models/Rol.js';
import Empresa from '../../../models/Empresa.js';
import logger from '../../../shared/utils/logger.js';

class EntraSyncService {
    constructor() {
        this.cca = new ConfidentialClientApplication(msalConfig);
    }

    async getAccessToken() {
        try {
            const tokenRequest = {
                scopes: ['https://graph.microsoft.com/.default'],
            };
            const response = await this.cca.acquireTokenByClientCredential(tokenRequest);

            if (!response || !response.accessToken) {
                throw new Error('No se pudo obtener el token de acceso de Microsoft Graph');
            }
            return response.accessToken;
        } catch (error) {
            logger.error('Error obteniendo token de Entra ID:', error);
            throw error;
        }
    }

    async syncGerentes() {
        logger.info('🔄 Iniciando sincronización de Gerentes desde Entra ID...');
        const stats = {
            processed: 0,
            created: 0,
            updated: 0,
            errors: 0,
            groupsFound: 0
        };

        try {
            const accessToken = await this.getAccessToken();
            const headers = { Authorization: `Bearer ${accessToken}` };

            // 1. Obtener Roles Locales para mapeo
            const allRoles = await Rol.findAll();

            // Rol Default: "Gerentes"
            let gerenteRol = allRoles.find(r => r.nombre === 'Gerentes' || r.nombre === 'Gerente');

            if (!gerenteRol) {
                logger.warn('⚠️ No se encontró el rol "Gerentes". Buscando "Administrador" como fallback.');
                gerenteRol = allRoles.find(r => r.nombre === 'Administrador');
            }

            if (!gerenteRol) {
                throw new Error('No se pudo determinar un rol por defecto (Gerentes/Administrador) para asignar.');
            }

            // 2. Buscar grupos que coincidan con el patrón "Megacore_*_Gerentes"
            // Nota: Graph no soporta wildcards intermedios fácilmente en filter, así que traemos los que empiezan con Megacore_
            // y filtramos en código.
            const groupsUrl = "https://graph.microsoft.com/v1.0/groups?$filter=startswith(displayName,'Megacore_')&$select=id,displayName,description";
            const groupsResponse = await axios.get(groupsUrl, { headers });
            const allGroups = groupsResponse.data.value;

            // Filtrar solo los que terminan en _Gerentes
            const targetGroups = allGroups.filter(g => g.displayName.endsWith('_Gerentes'));
            stats.groupsFound = targetGroups.length;

            logger.info(`🔎 Se encontraron ${targetGroups.length} grupos de Gerentes para procesar.`);

            const processedEmails = new Set(); // Para trackear activos y dar de baja a los ausentes

            // 3. Procesar grupos y recolectar membresías
            // Usamos un Map para agrupar usuarios y detectar conflictos de sede
            const userMap = new Map(); // email -> { azureData: Member, sedes: Set<SedeID> }

            for (const group of targetGroups) {
                try {
                    // Extraer nombre de la Sede
                    const parts = group.displayName.split('_');
                    if (parts.length < 3) continue;

                    const sedeNameRaw = parts.slice(1, -1).join(' ');

                    // Mapeo manual de excepciones
                    const SEDE_MAPPING_EXCEPTIONS = {
                        'CID': 'Fiter Cid Campeador',
                        'Fiter Mansilla': 'Fiter Barrio Norte',
                        'Fiter_Mansilla': 'Fiter Barrio Norte',
                        'Mansilla': 'Fiter Barrio Norte',
                        'Arcos': 'Distrito Arcos',
                        'BarrioJardin': 'Cordoba Barrio Jardín',
                        'Fiter Adrogue': 'Fiter Adrogué',
                        'Imprenta': 'La Imprenta',
                        'Madero': 'Puerto Madero',
                        'Martinez': 'Martínez I',
                        'Martinez 2': 'Martínez II',
                        'Martinez_2': 'Martínez II',
                        'Nunez': 'Núñez',
                        'Racing': 'Racing Club',
                        'AllBoys': 'Floresta',
                        'Center2': 'Fiter Center',
                        'Fiter Caballito2': 'Fiter Caballito 2',
                        'Fiter PuntaCarretas': 'Fiter Punta Carretas'
                    };

                    let targetSedeName = SEDE_MAPPING_EXCEPTIONS[sedeNameRaw] || SEDE_MAPPING_EXCEPTIONS[parts.slice(1, -1).join('_')] || sedeNameRaw;

                    // Buscar Sede Local
                    let sede = await Sede.findOne({
                        where: {
                            [Op.or]: [
                                { nombre_sede: { [Op.iLike]: targetSedeName } },
                                { nombre_sede: { [Op.iLike]: targetSedeName.replace(/([A-Z])/g, ' $1').trim() } }
                            ]
                        }
                    });

                    if (!sede) {
                        sede = await Sede.findOne({
                            where: { nombre_sede: { [Op.iLike]: targetSedeName.replace(/\s+/g, '') } }
                        });
                    }

                    if (!sede) {
                        logger.warn(`⚠️ No se encontró sede local para el grupo: ${group.displayName}`);
                    }

                    // Obtener miembros
                    const membersUrl = `https://graph.microsoft.com/v1.0/groups/${group.id}/members?$select=id,displayName,givenName,surname,mail,jobTitle,mobilePhone,accountEnabled`;
                    const membersResponse = await axios.get(membersUrl, { headers });
                    const members = membersResponse.data.value;

                    for (const member of members) {
                        if (!member.mail) continue;
                        const email = member.mail.toLowerCase();

                        if (!userMap.has(email)) {
                            userMap.set(email, {
                                azureData: member,
                                sedes: new Set()
                            });
                        }

                        // Agregamos la sede encontrada (o null si no se encontró, aunque idealmente tracked)
                        // Si el grupo no tiene sede mapeada, no agregamos "undefined"
                        if (sede) {
                            userMap.get(email).sedes.add(sede.id);
                        }
                    }

                } catch (groupError) {
                    logger.error(`Error procesando grupo ${group.displayName}:`, groupError);
                    stats.errors++;
                }
            } // Fin loop recolección

            // 4. Procesar usuarios únicos
            logger.info(`👥 Procesando ${userMap.size} usuarios únicos encontrados en Azure...`);

            for (const [email, data] of userMap) {
                try {
                    const { azureData, sedes } = data;
                    processedEmails.add(email);

                    // Si está deshabilitado en Azure
                    if (azureData.accountEnabled === false) {
                        logger.info(`🚫 Desactivando usuario deshabilitado en Azure: ${email}`);
                        await Personal.update({ activo: false }, { where: { email } });
                        stats.updated++;
                        continue;
                    }

                    stats.processed++;

                    // Determinar Sede Final
                    // Si tiene MÁS DE UNA sede distinta -> NULL (Regional/Admin)
                    // Si tiene CERO sedes -> NULL
                    // Si tiene UNA sede -> Esa Sede
                    let targetSedeId = null;
                    if (sedes.size === 1) {
                        targetSedeId = Array.from(sedes)[0];
                    } else if (sedes.size > 1) {
                        logger.info(`🌍 Usuario Multi-Sede detectado: ${email}. Asignando Sede NULL (Regional/Admin).`);
                    }

                    // Limpieza y Normalización
                    const cleanName = (str) => {
                        if (!str) return '';
                        return str.replace(/\ufffd/g, 'ñ')
                            .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '')
                            .trim();
                    };

                    const cleanPhone = (str) => {
                        if (!str) return null;
                        let phone = str.split('/')[0].trim();
                        phone = phone.replace(/[^0-9\+\-\(\)\s]/g, '');
                        if (/^[\+]?[0-9\s\-\(\)]+$/.test(phone)) return phone;
                        return null;
                    };

                    const nombreRaw = azureData.givenName || azureData.displayName.split(' ')[0];
                    const apellidoRaw = azureData.surname || (azureData.displayName.split(' ').length > 1 ? azureData.displayName.split(' ').slice(1).join(' ') : 'Sin Apellido');

                    // Resolver Rol
                    const jobTitle = azureData.jobTitle || '';
                    let targetRoleId = gerenteRol.id;

                    const titleNorm = jobTitle.toLowerCase().trim();
                    const matchedRole = allRoles.find(r => {
                        const rName = r.nombre.toLowerCase();
                        return titleNorm === rName ||
                            titleNorm.includes(rName) ||
                            (rName === 'coordinador de pileta' && titleNorm.includes('pileta')) ||
                            (rName === 'coordinador de servicio' && titleNorm.includes('servicio')) ||
                            (rName === 'coordinador de venta' && titleNorm.includes('venta')) ||
                            (rName === 'club manager' && titleNorm.includes('club manager')) ||
                            (rName === 'regional' && titleNorm.includes('regional'));
                    });

                    if (matchedRole) targetRoleId = matchedRole.id;

                    // Upsert DB
                    let personal = await Personal.findOne({ where: { email } });

                    // Protección de Roles
                    if (personal) {
                        const currentRole = allRoles.find(r => r.id === personal.rol_id);
                        if (currentRole && (currentRole.nombre === 'Sistemas' || currentRole.nombre === 'Infraestructura')) {
                            targetRoleId = personal.rol_id;
                        }
                    }

                    const personalData = {
                        nombre: cleanName(nombreRaw),
                        apellido: cleanName(apellidoRaw),
                        email: email,
                        telefono: cleanPhone(azureData.mobilePhone) || personal?.telefono,
                        rol_id: targetRoleId,
                        sede_id: targetSedeId, // Ahora es null si hay conflictos
                        activo: true,
                        fecha_ingreso: personal?.fecha_ingreso || new Date(),
                    };

                    if (!personalData.nombre) personalData.nombre = 'Usuario';
                    if (!personalData.apellido) personalData.apellido = 'EntraID';

                    if (personal) {
                        await personal.update(personalData);
                        stats.updated++;
                    } else {
                        const [newPersonal, created] = await Personal.findOrCreate({
                            where: { email },
                            defaults: personalData
                        });
                        if (created) {
                            stats.created++;
                            logger.info(`✨ Creado: ${newPersonal.email}`);
                        } else {
                            await newPersonal.update(personalData);
                            stats.updated++;
                        }
                    }

                } catch (userError) {
                    logger.error(`Error procesando usuario ${email}:`, userError);
                    stats.errors++;
                }
            } // Fin loop usuarios únicos

            // ==========================================
            // LÓGICA DE BAJAS (Usuarios removidos de grupos)
            // ==========================================
            if (processedEmails.size > 0) {
                // Buscamos usuarios activos que NO fueron procesados
                const usersToDeactivate = await Personal.findAll({
                    where: {
                        rol_id: gerenteRol.id,
                        activo: true,
                        email: { [Op.notIn]: Array.from(processedEmails) }
                    }
                });

                if (usersToDeactivate.length > 0) {
                    logger.info(`🗑️ Desactivando ${usersToDeactivate.length} usuarios que ya no están en grupos de Azure.`);
                    for (const user of usersToDeactivate) {
                        user.activo = false;
                        await user.save();
                        stats.updated++;
                        logger.info(`   -> Baja por ausencia en Azure: ${user.email}`);
                    }
                }
            }

            logger.info('✅ Sincronización finalizada.', stats);
            return { success: true, stats };

        } catch (error) {
            logger.error('❌ Error crítico en sincronización Entra ID:', error);
            return { success: false, error: error.message };
        }
    }
}

export default new EntraSyncService();
