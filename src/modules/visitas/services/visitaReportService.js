const { Visita, VisitaInforme, VisitaProblemaResuelto, Sede, Personal, sequelize } = require('../../../models');
const { Op } = require('sequelize');
const logger = require('../../../shared/utils/logger');

class VisitaReportService {
    /**
     * Construir cláusula WHERE basada en filtros
     */
    _construirFiltros(filtros = {}) {
        const where = {};

        // IMPORTANTE: Siempre excluir visitas canceladas a menos que se soliciten explícitamente
        if (filtros.estado !== 'cancelada' && !filtros.incluir_canceladas) {
            where.estado = { [Op.ne]: 'cancelada' };
        }

        if (filtros.fecha_desde && filtros.fecha_hasta) {
            where.fecha = {
                [Op.between]: [filtros.fecha_desde, filtros.fecha_hasta]
            };
        } else if (filtros.fecha_desde) {
            where.fecha = { [Op.gte]: filtros.fecha_desde };
        } else if (filtros.fecha_hasta) {
            where.fecha = { [Op.lte]: filtros.fecha_hasta };
        }

        if (filtros.tecnico_ids && filtros.tecnico_ids.length > 0) {
            where.tecnico_asignado_id = { [Op.in]: filtros.tecnico_ids };
        }

        if (filtros.sede_ids && filtros.sede_ids.length > 0) {
            where.sede_id = { [Op.in]: filtros.sede_ids };
        }

        if (filtros.estado) {
            where.estado = filtros.estado;
        }

        if (filtros.tipo) {
            where.tipo = filtros.tipo;
        }

        return where;
    }

    /**
     * Obtener estadísticas generales
     */
    async obtenerEstadisticasGenerales(filtros = {}) {
        try {
            const where = this._construirFiltros(filtros);

            console.log('🔍 DEBUG - Filtros aplicados:', filtros);
            console.log('🔍 DEBUG - WHERE clause:', where);

            // Total de visitas
            const totalVisitas = await Visita.count({ where });
            console.log('🔍 DEBUG - Total visitas encontradas:', totalVisitas);

            // Visitas realizadas
            const visitasRealizadas = await Visita.count({
                where: { ...where, estado: 'realizada' }
            });

            // Total de problemas resueltos
            const problemasResueltos = await VisitaProblemaResuelto.count({
                include: [{
                    model: VisitaInforme,
                    as: 'informe',
                    required: true,
                    include: [{
                        model: Visita,
                        as: 'visita',
                        where,
                        required: true
                    }]
                }]
            });

            // Total de casos cerrados
            const casosResult = await sequelize.query(`
                SELECT COUNT(*) as total
                FROM visita_informes vi
                INNER JOIN visitas v ON vi.visita_id = v.id
                WHERE jsonb_array_length(vi.casos_resueltos) > 0
                ${filtros.fecha_desde ? `AND v.fecha >= :fecha_desde` : ''}
                ${filtros.fecha_hasta ? `AND v.fecha <= :fecha_hasta` : ''}
            `, {
                replacements: {
                    fecha_desde: filtros.fecha_desde,
                    fecha_hasta: filtros.fecha_hasta
                },
                type: sequelize.QueryTypes.SELECT
            });

            const totalCasos = casosResult[0]?.total || 0;

            // Promedio de problemas por visita
            const promedioProblemas = visitasRealizadas > 0
                ? (problemasResueltos / visitasRealizadas).toFixed(2)
                : 0;

            // Visitas con comentarios de sede
            const visitasConComentarios = await VisitaInforme.count({
                where: {
                    comentarios_responsable_sede: { [Op.ne]: null }
                },
                include: [{
                    model: Visita,
                    as: 'visita',
                    where,
                    required: true
                }]
            });

            return {
                totalVisitas,
                visitasRealizadas,
                problemasResueltos,
                totalCasos,
                promedioProblemas: parseFloat(promedioProblemas),
                visitasConComentarios,
                tasaComentarios: visitasRealizadas > 0
                    ? ((visitasConComentarios / visitasRealizadas) * 100).toFixed(1)
                    : 0
            };
        } catch (error) {
            logger.error('Error obteniendo estadísticas generales:', error);
            throw error;
        }
    }

    /**
     * Obtener distribución de visitas por sede
     */
    async obtenerDistribucionPorSede(filtros = {}) {
        try {
            const where = this._construirFiltros(filtros);

            const resultado = await Visita.findAll({
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('Visita.id')), 'count']
                ],
                where,
                include: [{
                    model: Sede,
                    as: 'sedePrincipal',
                    attributes: ['id', 'nombre_sede']
                }],
                group: ['sedePrincipal.id', 'sedePrincipal.nombre_sede'],
                order: [[sequelize.fn('COUNT', sequelize.col('Visita.id')), 'DESC']],
                raw: true
            });

            return resultado.map(r => ({
                name: r['sedePrincipal.nombre_sede'],
                value: parseInt(r.count),
                sede_id: r['sedePrincipal.id']
            }));
        } catch (error) {
            logger.error('Error obteniendo distribución por sede:', error);
            throw error;
        }
    }

    /**
     * Obtener distribución de visitas por técnico
     */
    async obtenerDistribucionPorTecnico(filtros = {}) {
        try {
            const where = this._construirFiltros(filtros);

            const resultado = await Visita.findAll({
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('Visita.id')), 'count']
                ],
                where,
                include: [{
                    model: Personal,
                    as: 'tecnicoAsignado',
                    attributes: ['id', 'nombre', 'apellido']
                }],
                group: ['tecnicoAsignado.id', 'tecnicoAsignado.nombre', 'tecnicoAsignado.apellido'],
                order: [[sequelize.fn('COUNT', sequelize.col('Visita.id')), 'DESC']],
                raw: true
            });

            return resultado.map(r => ({
                name: `${r['tecnicoAsignado.nombre']} ${r['tecnicoAsignado.apellido']}`,
                value: parseInt(r.count),
                tecnico_id: r['tecnicoAsignado.id']
            }));
        } catch (error) {
            logger.error('Error obteniendo distribución por técnico:', error);
            throw error;
        }
    }

    /**
     * Obtener distribución de problemas por categoría
     */
    async obtenerProblemasPorCategoria(filtros = {}) {
        try {
            const where = this._construirFiltros(filtros);

            const resultado = await VisitaProblemaResuelto.findAll({
                attributes: [
                    'categoria',
                    [sequelize.fn('COUNT', sequelize.col('VisitaProblemaResuelto.id')), 'count']
                ],
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
                order: [[sequelize.fn('COUNT', sequelize.col('VisitaProblemaResuelto.id')), 'DESC']],
                raw: true
            });

            const categoriaLabels = {
                'telefonia': 'Telefonía',
                'red': 'Red / Internet',
                'camaras_seguridad': 'Cámaras de Seguridad',
                'grabaciones': 'Grabaciones (NVR/DVR)',
                'otro': 'Otro'
            };

            return resultado.map(r => ({
                name: categoriaLabels[r.categoria] || r.categoria,
                value: parseInt(r.count),
                categoria: r.categoria
            }));
        } catch (error) {
            logger.error('Error obteniendo problemas por categoría:', error);
            throw error;
        }
    }

    /**
     * Obtener distribución de problemas causados por usuario
     */
    async obtenerProblemasUsuario(filtros = {}) {
        try {
            const where = this._construirFiltros(filtros);

            const resultado = await VisitaProblemaResuelto.findAll({
                attributes: [
                    'causado_por_usuario',
                    [sequelize.fn('COUNT', sequelize.col('VisitaProblemaResuelto.id')), 'count']
                ],
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
                group: ['causado_por_usuario'],
                raw: true
            });

            return resultado.map(r => ({
                name: r.causado_por_usuario ? 'Causado por Usuario' : 'Otros',
                value: parseInt(r.count),
                causado_por_usuario: r.causado_por_usuario
            }));
        } catch (error) {
            logger.error('Error obteniendo problemas de usuario:', error);
            throw error;
        }
    }

    /**
     * Obtener distribución por estado
     */
    async obtenerDistribucionEstados(filtros = {}) {
        try {
            const where = this._construirFiltros(filtros);

            const resultado = await Visita.findAll({
                attributes: [
                    'estado',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                where,
                group: ['estado'],
                order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
                raw: true
            });

            const estadoLabels = {
                'programada': 'Programada',
                'realizada': 'Realizada',
                'cancelada': 'Cancelada'
            };

            return resultado.map(r => ({
                name: estadoLabels[r.estado] || r.estado,
                value: parseInt(r.count),
                estado: r.estado
            }));
        } catch (error) {
            logger.error('Error obteniendo distribución de estados:', error);
            throw error;
        }
    }

    /**
     * Obtener distribución por tipo
     */
    async obtenerDistribucionTipos(filtros = {}) {
        try {
            const where = this._construirFiltros(filtros);

            const resultado = await Visita.findAll({
                attributes: [
                    'tipo',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                where,
                group: ['tipo'],
                order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
                raw: true
            });

            return resultado.map(r => ({
                name: r.tipo.charAt(0).toUpperCase() + r.tipo.slice(1),
                value: parseInt(r.count),
                tipo: r.tipo
            }));
        } catch (error) {
            logger.error('Error obteniendo distribución de tipos:', error);
            throw error;
        }
    }

    /**
     * Obtener lista detallada de casos cerrados
     */
    async obtenerListaCasosCerrados(filtros = {}) {
        try {
            const where = this._construirFiltros(filtros);

            const visitas = await Visita.findAll({
                where,
                include: [
                    {
                        model: VisitaInforme,
                        as: 'informe',
                        required: true,
                        where: sequelize.where(
                            sequelize.fn('jsonb_array_length', sequelize.col('informe.casos_resueltos')),
                            Op.gt,
                            0
                        )
                    },
                    {
                        model: Personal,
                        as: 'tecnicoAsignado',
                        attributes: ['id', 'nombre', 'apellido']
                    },
                    {
                        model: Sede,
                        as: 'sedePrincipal',
                        attributes: ['id', 'nombre_sede']
                    }
                ],
                order: [['fecha', 'DESC']]
            });

            // Aplanar los casos de cada visita
            const casos = [];
            visitas.forEach(visita => {
                const casosResueltos = visita.informe?.casos_resueltos || [];
                casosResueltos.forEach(caso => {
                    casos.push({
                        caso: caso,
                        fecha_visita: visita.fecha,
                        tecnico: visita.tecnicoAsignado ?
                            `${visita.tecnicoAsignado.nombre} ${visita.tecnicoAsignado.apellido}` :
                            'No asignado',
                        tecnico_id: visita.tecnicoAsignado?.id,
                        sede: visita.sedePrincipal?.nombre_sede || 'Sin sede',
                        sede_id: visita.sedePrincipal?.id,
                        visita_id: visita.id
                    });
                });
            });

            return casos;
        } catch (error) {
            logger.error('Error obteniendo lista de casos cerrados:', error);
            throw error;
        }
    }

    /**
     * Obtener lista de visitas con detalles
     */
    async obtenerListaVisitas(filtros = {}) {
        try {
            const where = this._construirFiltros(filtros);

            const visitas = await Visita.findAll({
                where,
                include: [
                    {
                        model: Sede,
                        as: 'sedePrincipal',
                        attributes: ['id', 'nombre_sede']
                    },
                    {
                        model: Personal,
                        as: 'tecnicoAsignado',
                        attributes: ['id', 'nombre', 'apellido']
                    },
                    {
                        model: VisitaInforme,
                        as: 'informe',
                        attributes: ['id', 'fecha_inicio', 'fecha_fin']
                    }
                ],
                order: [['fecha', 'DESC']]
            });

            return visitas.map(v => ({
                id: v.id,
                fecha: v.fecha,
                tipo: v.tipo,
                estado: v.estado,
                sede: v.sedePrincipal?.nombre_sede || 'Sin sede',
                sede_id: v.sedePrincipal?.id,
                tecnico: v.tecnicoAsignado
                    ? `${v.tecnicoAsignado.nombre} ${v.tecnicoAsignado.apellido}`
                    : 'No asignado',
                tecnico_id: v.tecnicoAsignado?.id,
                tiene_informe: !!v.informe,
                fecha_informe: v.informe?.fecha_inicio
            }));
        } catch (error) {
            logger.error('Error obteniendo lista de visitas:', error);
            throw error;
        }
    }

    /**
     * Obtener todas las estadísticas para el dashboard
     */
    async obtenerDashboard(filtros = {}) {
        try {
            const [
                estadisticasGenerales,
                distribucionSedes,
                distribucionTecnicos,
                problemasCategorias,
                problemasUsuario,
                distribucionEstados,
                distribucionTipos,
                listaCasos,
                listaVisitas
            ] = await Promise.all([
                this.obtenerEstadisticasGenerales(filtros),
                this.obtenerDistribucionPorSede(filtros),
                this.obtenerDistribucionPorTecnico(filtros),
                this.obtenerProblemasPorCategoria(filtros),
                this.obtenerProblemasUsuario(filtros),
                this.obtenerDistribucionEstados(filtros),
                this.obtenerDistribucionTipos(filtros),
                this.obtenerListaCasosCerrados(filtros),
                this.obtenerListaVisitas(filtros)
            ]);

            return {
                metricas: estadisticasGenerales,
                graficos: {
                    sedes: distribucionSedes,
                    tecnicos: distribucionTecnicos,
                    categorias: problemasCategorias,
                    problemasUsuario,
                    estados: distribucionEstados,
                    tipos: distribucionTipos
                },
                casos: listaCasos,
                visitas: listaVisitas
            };
        } catch (error) {
            logger.error('Error obteniendo dashboard completo:', error);
            throw error;
        }
    }
}

module.exports = new VisitaReportService();
