import cron from 'node-cron';
import { Op } from 'sequelize';
import { Visita, Sede, Personal, Rol } from '../../../models/index.js';
import visitaEmailService from '../services/emailService.js';
import logger from '../../../shared/utils/logger.js';

class VisitasScheduler {
    constructor() {
        this.task = null;
    }

    /**
     * Obtener destinatarios para notificaciones de visitas
     * Incluye: Personal de la sede + Gerentes + Infraestructura
     */
    async obtenerDestinatariosVisita(sedeId) {
        try {
            // 1. Personal activo de la sede
            const personalSede = await Personal.findAll({
                where: { sede_id: sedeId, activo: true },
                attributes: ['email']
            });

            // 2. Gerentes (todos los roles que contengan "Gerente" en el nombre)
            const gerentes = await Personal.findAll({
                where: { activo: true },
                attributes: ['email'],
                include: [{
                    model: Rol,
                    as: 'rol',
                    where: {
                        nombre: { [Op.iLike]: '%gerente%' },
                        activo: true
                    },
                    attributes: []
                }]
            });

            // 3. Infraestructura (email fijo + rol)
            const infraestructura = await Personal.findAll({
                where: { activo: true },
                attributes: ['email'],
                include: [{
                    model: Rol,
                    as: 'rol',
                    where: {
                        nombre: { [Op.iLike]: '%infraestructura%' },
                        activo: true
                    },
                    attributes: []
                }]
            });

            // Combinar todos los emails y eliminar duplicados
            const todosLosEmails = [
                ...personalSede.map(p => p.email),
                ...gerentes.map(p => p.email),
                ...infraestructura.map(p => p.email),
                process.env.EMAIL_INFRAESTRUCTURA || 'infraestructura@megatlon.com.ar'
            ];

            const emailsUnicos = [...new Set(todosLosEmails.filter(e => e))];

            logger.info(`📧 Destinatarios encontrados: ${emailsUnicos.length} (Personal: ${personalSede.length}, Gerentes: ${gerentes.length}, Infraestructura: ${infraestructura.length + 1})`);

            return emailsUnicos;
        } catch (error) {
            logger.error('Error obteniendo destinatarios de visita:', error);
            throw error;
        }
    }

    iniciar() {
        logger.info('⏰ Iniciando scheduler de visitas...');

        // Ejecutar todos los días a las 09:00 AM
        this.task = cron.schedule('0 9 * * *', async () => {
            logger.info('⏰ Ejecutando job de recordatorios de visitas...');
            await this.enviarRecordatorios();
        });

        logger.info('✅ Scheduler de visitas programado (09:00 AM diariamente)');
    }

    async enviarRecordatorios() {
        try {
            // Calcular fecha de mañana
            const manana = new Date();
            manana.setDate(manana.getDate() + 1);
            const fechaManana = manana.toISOString().split('T')[0];

            logger.info(`🔍 Buscando visitas programadas para mañana (${fechaManana})...`);

            const visitas = await Visita.findAll({
                where: {
                    fecha: fechaManana,
                    estado: 'programada'
                },
                include: [
                    { model: Sede, as: 'sedePrincipal' },
                    { model: Personal, as: 'tecnicoAsignado' }
                ]
            });

            logger.info(`📋 Encontradas ${visitas.length} visitas para recordar.`);

            for (const visita of visitas) {
                try {
                    // Obtener destinatarios: personal de sede + gerentes + infraestructura
                    const emails = await this.obtenerDestinatariosVisita(visita.sede_id);

                    if (emails.length > 0) {
                        await visitaEmailService.enviarRecordatorio(visita, emails);

                        // Actualizar estado
                        await visita.update({ estado: 'recordatorio_enviado' });
                        logger.info(`✅ Recordatorio enviado para visita ${visita.id} a ${emails.length} destinatarios`);
                    } else {
                        logger.warn(`⚠️ No hay destinatarios con email para la visita ${visita.id}`);
                    }
                } catch (error) {
                    logger.error(`❌ Error procesando recordatorio para visita ${visita.id}:`, error);
                }
            }
        } catch (error) {
            logger.error('❌ Error general en job de recordatorios:', error);
        }
    }
}

export default new VisitasScheduler();
