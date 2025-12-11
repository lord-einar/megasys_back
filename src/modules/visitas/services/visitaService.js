const { Op } = require('sequelize');
const {
    Visita,
    VisitaRecurrencia,
    VisitaSolicitudPrevia,
    VisitaInforme,
    VisitaProblemaResuelto,
    VisitaChecklistItem,
    Sede,
    Personal,
    sequelize
} = require('../../../models');
const visitaEmailService = require('./emailService');
const logger = require('../../../shared/utils/logger');
const { v4: uuidv4 } = require('uuid');

class VisitaService {

    /**
     * Listar visitas con filtros y paginación
     */
    async listar(filtros = {}, paginacion = {}) {
        try {
            const {
                sede_id,
                tecnico_id,
                estado,
                tipo,
                fecha_desde,
                fecha_hasta,
                es_recurrente
            } = filtros;

            const { page = 1, limit = 20 } = paginacion;
            const offset = (page - 1) * limit;

            const where = {};
            if (sede_id) where.sede_id = sede_id;
            if (tecnico_id) where.tecnico_asignado_id = tecnico_id;
            if (estado) where.estado = estado;
            if (tipo) where.tipo = tipo;
            if (es_recurrente !== undefined) where.es_recurrente = es_recurrente === 'true';

            if (fecha_desde || fecha_hasta) {
                where.fecha = {};
                if (fecha_desde) where.fecha[Op.gte] = fecha_desde;
                if (fecha_hasta) where.fecha[Op.lte] = fecha_hasta;
            }

            const { count, rows } = await Visita.findAndCountAll({
                where,
                include: [
                    { model: Sede, as: 'sedePrincipal', attributes: ['id', 'nombre_sede'] },
                    { model: Personal, as: 'tecnicoAsignado', attributes: ['id', 'nombre', 'apellido', 'color'] }
                ],
                order: [['fecha', 'DESC']],
                limit,
                offset
            });

            return {
                visitas: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            };
        } catch (error) {
            logger.error('Error listando visitas:', error);
            throw error;
        }
    }

    /**
     * Obtener visita por ID con todos los detalles
     */
    async obtenerPorId(id) {
        try {
            const visita = await Visita.findByPk(id, {
                include: [
                    { model: Sede, as: 'sedePrincipal' },
                    { model: Personal, as: 'tecnicoAsignado' },
                    { model: Personal, as: 'creador', attributes: ['id', 'nombre', 'apellido'] },
                    { model: VisitaRecurrencia, as: 'recurrencia' },
                    { model: VisitaSolicitudPrevia, as: 'solicitudesPrevias' },
                    {
                        model: VisitaInforme,
                        as: 'informe',
                        include: [{ model: VisitaProblemaResuelto, as: 'problemasResueltos' }]
                    }
                ]
            });

            if (!visita) throw new Error('Visita no encontrada');
            return visita;
        } catch (error) {
            logger.error(`Error obteniendo visita ${id}:`, error);
            throw error;
        }
    }

    /**
     * Crear nueva visita (y recurrencia si aplica)
     */
    async crear(datos, usuarioId) {
        const t = await sequelize.transaction();
        try {
            const {
                sede_id,
                tecnico_asignado_id,
                fecha,
                tipo,
                motivo,
                casos_tickets,
                observaciones,
                es_recurrente,
                frecuencia // solo si es_recurrente
            } = datos;

            let recurrenciaId = null;

            // 1. Si es recurrente, crear configuración de recurrencia
            if (es_recurrente) {
                const recurrencia = await VisitaRecurrencia.create({
                    sede_id,
                    tecnico_asignado_id,
                    tipo,
                    motivo,
                    frecuencia: frecuencia || 'quincenal',
                    fecha_inicio: fecha,
                    creado_por_id: usuarioId,
                    observaciones
                }, { transaction: t });

                recurrenciaId = recurrencia.id;
            }

            // 2. Crear la visita inicial
            const visita = await Visita.create({
                sede_id,
                tecnico_asignado_id,
                fecha,
                tipo,
                motivo,
                casos_tickets,
                observaciones,
                es_recurrente: !!es_recurrente,
                recurrencia_id: recurrenciaId,
                creado_por_id: usuarioId
            }, { transaction: t });

            // 3. Si es recurrente, generar instancias futuras (3 meses)
            let instanciasCreadas = 0;
            if (es_recurrente) {
                instanciasCreadas = await this._generarInstanciasFuturas(recurrenciaId, fecha, 3, t);
            }

            await t.commit();

            return {
                visita,
                instanciasAdicionales: instanciasCreadas
            };
        } catch (error) {
            await t.rollback();
            logger.error('Error creando visita:', error);
            throw error;
        }
    }

    /**
     * Generar instancias futuras para una recurrencia
     * @param {string} recurrenciaId 
     * @param {string} fechaInicioStr 
     * @param {number} meses 
     * @param {object} transaction 
     */
    async _generarInstanciasFuturas(recurrenciaId, fechaInicioStr, meses, transaction) {
        const recurrencia = await VisitaRecurrencia.findByPk(recurrenciaId, { transaction });
        if (!recurrencia) return 0;

        const fechaInicio = new Date(fechaInicioStr);
        const fechaLimite = new Date(fechaInicio);
        fechaLimite.setMonth(fechaLimite.getMonth() + meses);

        const nuevasVisitas = [];
        let fechaActual = new Date(fechaInicio);

        // Avanzar a la siguiente instancia según frecuencia
        // Por ahora solo soportamos 'quincenal' (14 días para simplificar o 15?)
        // El usuario dijo "quincenal". Usaremos 14 días (2 semanas) para mantener el día de la semana.
        const diasSalto = recurrencia.frecuencia === 'quincenal' ? 14 : 7;

        fechaActual.setDate(fechaActual.getDate() + diasSalto);

        while (fechaActual <= fechaLimite) {
            nuevasVisitas.push({
                id: uuidv4(),
                sede_id: recurrencia.sede_id,
                tecnico_asignado_id: recurrencia.tecnico_asignado_id,
                fecha: fechaActual.toISOString().split('T')[0],
                tipo: recurrencia.tipo,
                motivo: recurrencia.motivo,
                es_recurrente: true,
                recurrencia_id: recurrencia.id,
                creado_por_id: recurrencia.creado_por_id,
                observaciones: recurrencia.observaciones,
                // Token se genera en hook beforeCreate, pero en bulkCreate hay que tener cuidado
                // Sequelize ejecuta hooks en bulkCreate si se configura individualHooks: true
            });

            fechaActual.setDate(fechaActual.getDate() + diasSalto);
        }

        if (nuevasVisitas.length > 0) {
            await Visita.bulkCreate(nuevasVisitas, {
                transaction,
                individualHooks: true // Para generar tokens únicos
            });
        }

        return nuevasVisitas.length;
    }

    /**
     * Actualizar visita
     * Si es recurrente, pregunta si actualizar solo esta o toda la serie (futura)
     */
    async actualizar(id, datos, usuarioId, actualizarSerie = false) {
        const t = await sequelize.transaction();
        try {
            const visita = await Visita.findByPk(id);
            if (!visita) throw new Error('Visita no encontrada');

            // Actualizar la visita actual
            await visita.update(datos, { transaction: t });

            // Si se pide actualizar serie y tiene recurrencia
            if (actualizarSerie && visita.recurrencia_id) {
                // Actualizar configuración base
                await VisitaRecurrencia.update(datos, {
                    where: { id: visita.recurrencia_id },
                    transaction: t
                });

                // Actualizar visitas futuras pendientes
                // IMPORTANTE: No propagar la fecha a las visitas futuras, ya que todas quedarían en el mismo día.
                // Solo propagar cambios de técnico, sede, motivo, etc.
                const { fecha, ...datosSerie } = datos;

                await Visita.update(datosSerie, {
                    where: {
                        recurrencia_id: visita.recurrencia_id,
                        fecha: { [Op.gt]: visita.fecha },
                        estado: 'programada'
                    },
                    transaction: t
                });
            }

            await t.commit();
            return visita;
        } catch (error) {
            await t.rollback();
            logger.error(`Error actualizando visita ${id}:`, error);
            throw error;
        }
    }

    /**
     * Marcar visita como realizada y guardar informe
     */
    async marcarRealizada(id, datosInforme, usuarioId) {
        const t = await sequelize.transaction();
        try {
            const visita = await Visita.findByPk(id, {
                include: [
                    { model: Sede, as: 'sedePrincipal' },
                    { model: Personal, as: 'tecnicoAsignado' },
                    { model: VisitaSolicitudPrevia, as: 'solicitudesPrevias' }
                ],
                transaction: t
            });

            if (!visita) throw new Error('Visita no encontrada');
            if (visita.estado === 'realizada') throw new Error('La visita ya fue realizada');

            console.log('🔍 DEBUG - Datos recibidos para informe:', {
                casos_resueltos: datosInforme.casos_resueltos,
                casos_resueltos_length: datosInforme.casos_resueltos?.length,
                problemas_resueltos_length: datosInforme.problemas_resueltos?.length
            });

            // 1. Crear informe
            const informe = await VisitaInforme.create({
                visita_id: id,
                tecnico_id: usuarioId,
                checklist_items: datosInforme.checklist_items,
                checklist_extra: datosInforme.checklist_extra,
                casos_resueltos: datosInforme.casos_resueltos,
                observaciones: datosInforme.observaciones
            }, { transaction: t });

            console.log('💾 DEBUG - Informe creado:', {
                id: informe.id,
                casos_resueltos: informe.casos_resueltos,
                casos_resueltos_length: informe.casos_resueltos?.length
            });

            // 2. Crear problemas resueltos
            if (datosInforme.problemas_resueltos && datosInforme.problemas_resueltos.length > 0) {
                const problemas = datosInforme.problemas_resueltos.map(p => ({
                    informe_id: informe.id,
                    ...p
                }));
                await VisitaProblemaResuelto.bulkCreate(problemas, { transaction: t });

                // Adjuntar para el email
                informe.setDataValue('problemasResueltos', datosInforme.problemas_resueltos);
            }

            // 3. Marcar solicitudes previas como resueltas
            if (datosInforme.solicitudes_resueltas && datosInforme.solicitudes_resueltas.length > 0) {
                await VisitaSolicitudPrevia.update(
                    { resuelta: true },
                    {
                        where: { id: { [Op.in]: datosInforme.solicitudes_resueltas } },
                        transaction: t
                    }
                );

                // Actualizar objeto en memoria para el email
                visita.solicitudesPrevias.forEach(s => {
                    if (datosInforme.solicitudes_resueltas.includes(s.id)) {
                        s.resuelta = true;
                    }
                });
            }

            // 4. Actualizar estado de visita
            await visita.update({ estado: 'realizada' }, { transaction: t });

            await t.commit();

            // Preparar objeto informe para el email con todos los datos
            const informeParaEmail = {
                checklist_items: informe.checklist_items,
                checklist_extra: informe.checklist_extra,
                casos_resueltos: informe.casos_resueltos,
                observaciones: informe.observaciones,
                comentarios_responsable_sede: informe.comentarios_responsable_sede,
                problemasResueltos: datosInforme.problemas_resueltos || []
            };

            // 5. Enviar email de minuta (fuera de transacción)
            // Obtener emails de personal de la sede
            const personalSede = await Personal.findAll({
                where: { sede_id: visita.sede_id, activo: true },
                attributes: ['email']
            });
            const emails = personalSede.map(p => p.email).filter(e => e);

            // No bloquear respuesta si falla el email
            visitaEmailService.enviarMinuta(visita, informeParaEmail, emails).catch(err =>
                logger.error('Error enviando minuta en background:', err)
            );

            return informe;
        } catch (error) {
            await t.rollback();
            logger.error(`Error marcando visita ${id} como realizada:`, error);
            throw error;
        }
    }

    /**
     * Obtener vista de calendario mensual
     */
    async obtenerCalendario(mes, anio, tecnicoId = null) {
        try {
            const fechaInicio = new Date(anio, mes - 1, 1);
            const fechaFin = new Date(anio, mes, 0);

            const where = {
                fecha: {
                    [Op.between]: [fechaInicio, fechaFin]
                },
                // Excluir visitas canceladas del calendario
                estado: {
                    [Op.ne]: 'cancelada'
                }
            };

            if (tecnicoId) where.tecnico_asignado_id = tecnicoId;

            const visitas = await Visita.findAll({
                where,
                include: [
                    { model: Sede, as: 'sedePrincipal', attributes: ['nombre_sede'] },
                    { model: Personal, as: 'tecnicoAsignado', attributes: ['nombre', 'apellido', 'id', 'color'] }
                ]
            });

            return visitas.map(v => ({
                id: v.id,
                title: `${v.sedePrincipal.nombre_sede} - ${v.tecnicoAsignado.nombre}`,
                start: v.fecha,
                end: v.fecha,
                allDay: true,
                backgroundColor: v.tecnicoAsignado?.color || '#3788d8',
                borderColor: v.tecnicoAsignado?.color || '#3788d8',
                extendedProps: {
                    tipo: v.tipo,
                    estado: v.estado,
                    tecnicoId: v.tecnicoAsignado.id,
                    sedeNombre: v.sedePrincipal.nombre_sede
                }
            }));
        } catch (error) {
            logger.error('Error obteniendo calendario:', error);
            throw error;
        }
    }

    /**
     * Agregar solicitud pre-visita (Público)
     */
    async agregarSolicitud(token, datos) {
        try {
            const visita = await Visita.findOne({ where: { token_solicitudes: token } });
            if (!visita) throw new Error('Token inválido o visita no encontrada');

            if (visita.estado === 'realizada' || visita.estado === 'cancelada') {
                throw new Error('La visita ya fue realizada o cancelada');
            }

            const solicitud = await VisitaSolicitudPrevia.create({
                visita_id: visita.id,
                solicitante_nombre: datos.nombre || datos.email.split('@')[0],
                solicitante_email: datos.email,
                descripcion: datos.descripcion
            });

            return solicitud;
        } catch (error) {
            logger.error('Error agregando solicitud:', error);
            throw error;
        }
    }

    /**
     * Cancelar visita
     */
    async cancelar(id, motivo, usuarioId) {
        const t = await sequelize.transaction();
        try {
            const visita = await Visita.findByPk(id, {
                include: [
                    { model: Sede, as: 'sedePrincipal' },
                    { model: Personal, as: 'tecnicoAsignado' }
                ]
            });

            if (!visita) throw new Error('Visita no encontrada');
            if (visita.estado === 'realizada') {
                throw new Error('No se puede cancelar una visita que ya fue realizada');
            }

            await visita.update({
                estado: 'cancelada',
                fecha_cancelacion: new Date(),
                motivo_cancelacion: motivo
            }, { transaction: t });

            await t.commit();

            // TODO: Enviar email de notificación de cancelación
            logger.info(`Visita ${id} cancelada por usuario ${usuarioId}`);

            return visita;
        } catch (error) {
            await t.rollback();
            logger.error('Error cancelando visita:', error);
            throw error;
        }
    }

    /**
     * Reprogramar visita
     */
    async reprogramar(id, nuevaFecha, usuarioId) {
        const t = await sequelize.transaction();
        try {
            const visita = await Visita.findByPk(id, {
                include: [
                    { model: Sede, as: 'sedePrincipal' },
                    { model: Personal, as: 'tecnicoAsignado' }
                ]
            });

            if (!visita) throw new Error('Visita no encontrada');
            if (visita.estado === 'realizada') {
                throw new Error('No se puede reprogramar una visita que ya fue realizada');
            }
            if (visita.estado === 'cancelada') {
                throw new Error('No se puede reprogramar una visita cancelada');
            }

            const fechaAnterior = visita.fecha;

            await visita.update({
                fecha: nuevaFecha,
                estado: 'programada' // Resetear estado si estaba en recordatorio_enviado
            }, { transaction: t });

            await t.commit();

            // TODO: Enviar email de notificación de reprogramación
            logger.info(`Visita ${id} reprogramada de ${fechaAnterior} a ${nuevaFecha} por usuario ${usuarioId}`);

            return visita;
        } catch (error) {
            await t.rollback();
            logger.error('Error reprogramando visita:', error);
            throw error;
        }
    }

    /**
    /**
     * Obtener estadísticas de visitas
     */
    async obtenerEstadisticas(fechaDesde, fechaHasta) {
        try {
            const where = {};

            if (fechaDesde || fechaHasta) {
                where.fecha = {};
                if (fechaDesde) where.fecha[Op.gte] = fechaDesde;
                if (fechaHasta) where.fecha[Op.lte] = fechaHasta;
            }

            // 1. Total y conteos básicos (Estado, Tipo)
            // Ejecutamos en paralelo para mayor velocidad
            const [
                total,
                porEstado,
                porTipo,
                porSede,
                problemasPorCategoria
            ] = await Promise.all([
                // Total
                Visita.count({ where }),

                // Por Estado
                Visita.findAll({
                    attributes: ['estado', [sequelize.fn('COUNT', sequelize.col('estado')), 'count']],
                    where,
                    group: ['estado'],
                    raw: true
                }),

                // Por Tipo
                Visita.findAll({
                    attributes: ['tipo', [sequelize.fn('COUNT', sequelize.col('tipo')), 'count']],
                    where,
                    group: ['tipo'],
                    raw: true
                }),

                // Por Sede
                Visita.findAll({
                    attributes: [
                        [sequelize.col('sedePrincipal.nombre_sede'), 'nombre_sede'],
                        [sequelize.fn('COUNT', sequelize.col('Visita.id')), 'count']
                    ],
                    include: [{
                        model: Sede,
                        as: 'sedePrincipal',
                        attributes: []
                    }],
                    where,
                    group: ['sedePrincipal.nombre_sede', 'sedePrincipal.id'], // Agrupamos también por ID por seguridad en algunos motores DB
                    raw: true
                }),

                // Problemas por Categoría
                // Esto requiere un join complejo: Visita -> VisitaInforme -> VisitaProblemaResuelto
                // Lo hacemos consultando VisitaProblemaResuelto e incluyendo los padres con el filtro de fecha
                VisitaProblemaResuelto.findAll({
                    attributes: ['categoria', [sequelize.fn('COUNT', sequelize.col('VisitaProblemaResuelto.id')), 'count']],
                    include: [{
                        model: VisitaInforme,
                        as: 'informe',
                        attributes: [],
                        required: true,
                        include: [{
                            model: Visita,
                            as: 'visita',
                            attributes: [],
                            where,
                            required: true
                        }]
                    }],
                    group: ['categoria'],
                    raw: true
                })
            ]);

            // Formatear resultados
            const stats = {
                total,
                por_estado: {},
                por_tipo: {},
                por_sede: {},
                problemas_por_categoria: {},
                visitas_realizadas: 0,
                visitas_canceladas: 0,
                visitas_pendientes: 0
            };

            // Mapear arrays a objetos
            porEstado.forEach(item => {
                stats.por_estado[item.estado] = parseInt(item.count);
                if (item.estado === 'realizada') stats.visitas_realizadas = parseInt(item.count);
                else if (item.estado === 'cancelada') stats.visitas_canceladas = parseInt(item.count);
                else if (['programada', 'recordatorio_enviado'].includes(item.estado)) {
                    stats.visitas_pendientes += parseInt(item.count);
                }
            });

            porTipo.forEach(item => {
                stats.por_tipo[item.tipo] = parseInt(item.count);
            });

            porSede.forEach(item => {
                const nombre = item.nombre_sede || 'Sin sede';
                stats.por_sede[nombre] = parseInt(item.count);
            });

            problemasPorCategoria.forEach(item => {
                stats.problemas_por_categoria[item.categoria] = parseInt(item.count);
            });

            return stats;
        } catch (error) {
            logger.error('Error obteniendo estadísticas:', error);
            throw error;
        }
    }
    /**
     * Eliminar visita
     * @param {string} id ID de la visita
     * @param {boolean} eliminarSerie Si es true y es recurrente, elimina futuras
     * @param {string} usuarioId ID del usuario que realiza la acción
     */
    async eliminar(id, eliminarSerie = false, usuarioId) {
        const t = await sequelize.transaction();
        try {
            const visita = await Visita.findByPk(id);
            if (!visita) throw new Error('Visita no encontrada');

            if (visita.estado === 'realizada') {
                throw new Error('No se puede eliminar una visita que ya fue realizada');
            }

            // Si se pide eliminar serie y tiene recurrencia
            if (eliminarSerie && visita.recurrencia_id) {
                // 1. Eliminar visitas futuras pendientes de la misma serie
                await Visita.destroy({
                    where: {
                        recurrencia_id: visita.recurrencia_id,
                        fecha: { [Op.gte]: visita.fecha }, // Incluye la actual y futuras
                        estado: 'programada'
                    },
                    transaction: t
                });

                // 2. Verificar si quedan visitas para esa recurrencia
                const restantes = await Visita.count({
                    where: { recurrencia_id: visita.recurrencia_id },
                    transaction: t
                });

                // Si no quedan visitas, se podría marcar la recurrencia como inactiva o eliminarla
                // Por ahora la dejamos, o podríamos agregar un campo 'activa' a VisitaRecurrencia
            } else {
                // Eliminar solo esta visita
                await visita.destroy({ transaction: t });
            }

            await t.commit();
            logger.info(`Visita ${id} eliminada por usuario ${usuarioId}. Serie: ${eliminarSerie}`);
            return { message: 'Visita eliminada correctamente' };
        } catch (error) {
            await t.rollback();
            logger.error(`Error eliminando visita ${id}:`, error);
            throw error;
        }
    }
    /**
     * Obtener información de visita por token de feedback
     * @param {string} token Token único para feedback
     */
    async obtenerPorTokenFeedback(token) {
        try {
            const visita = await Visita.findOne({
                where: { token_feedback: token },
                include: [
                    { model: Sede, as: 'sedePrincipal', attributes: ['id', 'nombre_sede'] },
                    { model: Personal, as: 'tecnicoAsignado', attributes: ['id', 'nombre', 'apellido', 'email'] },
                    {
                        model: VisitaInforme,
                        as: 'informe',
                        attributes: ['id', 'fecha_realizacion', 'comentarios_responsable_sede', 'comentarios_responsable_fecha', 'comentarios_responsable_nombre']
                    }
                ]
            });

            if (!visita) throw new Error('Token inválido o visita no encontrada');

            // Validar que la visita esté completada
            if (visita.estado !== 'realizada') {
                throw new Error('La visita aún no ha sido completada');
            }

            // Validar que el informe exista
            if (!visita.informe) {
                throw new Error('El informe de la visita no está disponible');
            }

            // Validar que no hayan pasado más de 2 días
            const fechaRealizacion = new Date(visita.informe.fecha_realizacion);
            const ahora = new Date();
            const diasTranscurridos = (ahora - fechaRealizacion) / (1000 * 60 * 60 * 24);

            if (diasTranscurridos > 2) {
                throw new Error('El plazo para agregar comentarios ha expirado (máximo 2 días)');
            }

            // Validar que no se hayan agregado comentarios previamente
            if (visita.informe.comentarios_responsable_sede) {
                throw new Error('Ya se agregaron comentarios para esta visita');
            }

            return visita;
        } catch (error) {
            logger.error('Error obteniendo visita por token feedback:', error);
            throw error;
        }
    }

    /**
     * Agregar comentarios del responsable de sede
     * @param {string} token Token único para feedback
     * @param {object} datos { comentarios, nombre }
     */
    async agregarComentariosResponsable(token, datos) {
        const t = await sequelize.transaction();
        try {
            // Validar token y obtener visita (incluye todas las validaciones)
            const visita = await this.obtenerPorTokenFeedback(token);

            // Actualizar informe con comentarios
            await VisitaInforme.update({
                comentarios_responsable_sede: datos.comentarios,
                comentarios_responsable_fecha: new Date(),
                comentarios_responsable_nombre: datos.nombre
            }, {
                where: { visita_id: visita.id },
                transaction: t
            });

            await t.commit();

            // Enviar notificaciones (fuera de transacción)
            // Email a infraestructura y técnico asignado
            const destinatarios = [
                process.env.EMAIL_INFRAESTRUCTURA || 'infraestructura@megatlon.com.ar'
            ];

            if (visita.tecnicoAsignado && visita.tecnicoAsignado.email) {
                destinatarios.push(visita.tecnicoAsignado.email);
            }

            // Enviar notificación
            visitaEmailService.enviarNotificacionComentarios(visita, datos, destinatarios).catch(err =>
                logger.error('Error enviando notificación de comentarios:', err)
            );

            logger.info(`Comentarios agregados para visita ${visita.id} por ${datos.nombre}`);
            return { message: 'Comentarios agregados exitosamente' };
        } catch (error) {
            await t.rollback();
            logger.error('Error agregando comentarios responsable:', error);
            throw error;
        }
    }

    /**
     * Enviar aviso manual de visita
     * @param {string} id ID de la visita
     * @param {string} usuarioId ID del usuario que solicita el envío
     */
    async enviarAviso(id, usuarioId) {
        try {
            const visita = await Visita.findByPk(id, {
                include: [
                    { model: Sede, as: 'sedePrincipal' },
                    { model: Personal, as: 'tecnicoAsignado' }
                ]
            });

            if (!visita) throw new Error('Visita no encontrada');

            // Obtener emails de personal de la sede
            const personalSede = await Personal.findAll({
                where: { sede_id: visita.sede_id, activo: true },
                attributes: ['email']
            });

            // Lista de destinatarios: Personal de la sede + Técnico asignado
            const emails = personalSede.map(p => p.email).filter(e => e);
            if (visita.tecnicoAsignado && visita.tecnicoAsignado.email) {
                emails.push(visita.tecnicoAsignado.email);
            }

            // Eliminar duplicados
            const uniqueEmails = [...new Set(emails)];

            if (uniqueEmails.length === 0) {
                throw new Error('No hay destinatarios con email válido para enviar el aviso');
            }

            await visitaEmailService.enviarAviso(visita, uniqueEmails);

            logger.info(`Aviso manual enviado para visita ${id} por usuario ${usuarioId}`);
            return { message: 'Aviso enviado correctamente', destinatarios: uniqueEmails.length };
        } catch (error) {
            logger.error(`Error enviando aviso manual para visita ${id}:`, error);
            throw error;
        }
    }
}

module.exports = new VisitaService();
