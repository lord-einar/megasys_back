const cron = require('node-cron');
const { Op } = require('sequelize');
const { Visita, Sede, Personal } = require('../../../models');
const visitaEmailService = require('../services/emailService');
const logger = require('../../../shared/utils/logger');

class VisitasScheduler {
    constructor() {
        this.task = null;
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
                    // Obtener emails del personal de la sede
                    const personalSede = await Personal.findAll({
                        where: { sede_id: visita.sede_id, activo: true },
                        attributes: ['email']
                    });

                    const emails = personalSede.map(p => p.email).filter(e => e);

                    if (emails.length > 0) {
                        await visitaEmailService.enviarRecordatorio(visita, emails);

                        // Actualizar estado
                        await visita.update({ estado: 'recordatorio_enviado' });
                        logger.info(`✅ Recordatorio enviado para visita ${visita.id}`);
                    } else {
                        logger.warn(`⚠️ No hay personal con email en la sede ${visita.sedePrincipal.nombre} para la visita ${visita.id}`);
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

module.exports = new VisitasScheduler();
