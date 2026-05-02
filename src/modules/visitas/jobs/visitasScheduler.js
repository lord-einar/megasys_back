import cron from 'node-cron';
import { Op } from 'sequelize';
import { Visita, Sede, Personal, Rol } from '../../../models/index.js';
import visitaEmailService from '../services/emailService.js';
import logger from '../../../shared/utils/logger.js';

const TIMEZONE = process.env.VISITAS_SCHEDULER_TZ || 'America/Argentina/Buenos_Aires';

const getYmdInTimeZone = (date = new Date(), timeZone = TIMEZONE) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);

    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

const addDaysToYmd = (ymd, days) => {
    const [year, month, day] = ymd.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

class VisitasScheduler {
    constructor() {
        this.task = null;
    }

    /**
     * Obtener destinatarios para notificaciones de visitas
     * Incluye: Personal de la sede + Infraestructura (email fijo)
     * NOTA: El técnico asignado debe agregarse por separado en cada caso
     */
    async obtenerDestinatariosVisita(sedeId) {
        try {
            // 1. TODO el personal activo de la sede (incluye gerentes/coordinadores de esa sede)
            const personalSede = await Personal.findAll({
                where: { sede_id: sedeId, activo: true },
                attributes: ['email']
            });

            // 2. Email fijo de infraestructura (es un buzón que distribuye a todo el equipo)
            const emailInfraestructura = process.env.EMAIL_INFRAESTRUCTURA || 'infraestructura@megatlon.com.ar';

            // Combinar emails y eliminar duplicados
            const todosLosEmails = [
                ...personalSede.map(p => p.email),
                emailInfraestructura
            ];

            const emailsUnicos = [...new Set(todosLosEmails.filter(e => e))];

            logger.info(`📧 Destinatarios base: ${emailsUnicos.length} (Personal sede: ${personalSede.length}, Infraestructura: 1)`);

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
        }, { timezone: TIMEZONE });

        logger.info(`✅ Scheduler de visitas programado (09:00 AM diariamente, ${TIMEZONE})`);
    }

    async enviarRecordatorios() {
        try {
            const hoyLocal = getYmdInTimeZone();
            const fechaManana = addDaysToYmd(hoyLocal, 1);

            logger.info(`🔍 Buscando visitas programadas para mañana (${fechaManana})...`, {
                timezone: TIMEZONE,
                hoyLocal
            });

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
                    // Obtener destinatarios: personal de sede + infraestructura
                    const emails = await this.obtenerDestinatariosVisita(visita.sede_id);

                    // Agregar técnico asignado
                    if (visita.tecnicoAsignado && visita.tecnicoAsignado.email) {
                        emails.push(visita.tecnicoAsignado.email);
                    }

                    // Eliminar duplicados
                    const emailsUnicos = [...new Set(emails)];

                    if (emailsUnicos.length > 0) {
                        await visitaEmailService.enviarRecordatorio(visita, emailsUnicos);

                        // Actualizar estado
                        await visita.update({ estado: 'recordatorio_enviado' });
                        logger.info(`✅ Recordatorio enviado para visita ${visita.id} a ${emailsUnicos.length} destinatarios`);
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
