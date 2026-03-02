import { Visita, VisitaInforme, VisitaProblemaResuelto, CategoriaProblema, Sede, Personal, sequelize } from '../../../models/index.js';
import { Op } from 'sequelize';
import logger from '../../../shared/utils/logger.js';

class VisitaReportService {
    /**
     * Construir cláusula WHERE basada en filtros
     */
    _construirFiltros(filtros = {}) {
        const where = {};
        const hoy = new Date();
        hoy.setHours(23, 59, 59, 999); // Fin del día de hoy

        // Filtros de fecha
        if (filtros.fecha_desde && filtros.fecha_hasta) {
            where.fecha = {
                [Op.between]: [filtros.fecha_desde, filtros.fecha_hasta]
            };
        } else if (filtros.fecha_desde) {
            where.fecha = {
                [Op.gte]: filtros.fecha_desde,
                [Op.lte]: hoy // No incluir visitas futuras
            };
        } else if (filtros.fecha_hasta) {
            where.fecha = { [Op.lte]: filtros.fecha_hasta };
        } else {
            // Por defecto, excluir visitas programadas a futuro
            where.fecha = { [Op.lte]: hoy };
        }

        if (filtros.tecnico_ids && filtros.tecnico_ids.length > 0) {
            where.tecnico_asignado_id = { [Op.in]: filtros.tecnico_ids };
        }

        if (filtros.sede_ids && filtros.sede_ids.length > 0) {
            where.sede_id = { [Op.in]: filtros.sede_ids };
        }

        // Manejo de estado: si se especifica un estado, usarlo; sino excluir canceladas
        if (filtros.estado && filtros.estado.trim() !== '') {
            where.estado = filtros.estado;
        } else if (!filtros.incluir_canceladas) {
            // Por defecto, excluir visitas canceladas
            where.estado = { [Op.ne]: 'cancelada' };
        }

        if (filtros.tipo && filtros.tipo.trim() !== '') {
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

            // Include común para excluir sedes de prueba
            const includeSede = [{
                model: Sede,
                as: 'sedePrincipal',
                where: { es_prueba: false },
                attributes: [],
                required: true
            }];

            // Total de visitas (excluir sedes de prueba)
            const totalVisitas = await Visita.count({
                where,
                include: includeSede
            });

            // Visitas realizadas (excluir sedes de prueba)
            const visitasRealizadas = await Visita.count({
                where: { ...where, estado: 'realizada' },
                include: includeSede
            });

            // Total de problemas resueltos (excluir sedes de prueba)
            const problemasResueltos = await VisitaProblemaResuelto.count({
                include: [{
                    model: VisitaInforme,
                    as: 'informe',
                    required: true,
                    include: [{
                        model: Visita,
                        as: 'visita',
                        where,
                        required: true,
                        include: [{
                            model: Sede,
                            as: 'sedePrincipal',
                            where: { es_prueba: false },
                            attributes: [],
                            required: true
                        }]
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

            // Visitas con comentarios de sede (excluir sedes de prueba)
            const visitasConComentarios = await VisitaInforme.count({
                where: {
                    comentarios_responsable_sede: { [Op.ne]: null }
                },
                include: [{
                    model: Visita,
                    as: 'visita',
                    where,
                    required: true,
                    include: [{
                        model: Sede,
                        as: 'sedePrincipal',
                        where: { es_prueba: false },
                        attributes: [],
                        required: true
                    }]
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
     * Obtener distribución de visitas por sede (incluye sedes con 0 visitas)
     * Usa LEFT JOIN desde sedes para mostrar todas, aunque no tengan visitas.
     * Los filtros van en la cláusula ON del JOIN para que las sedes sin visitas
     * matching sigan apareciendo con count=0.
     */
    async obtenerDistribucionPorSede(filtros = {}) {
        try {
            const hoy = new Date();
            hoy.setHours(23, 59, 59, 999);

            const joinConditions = ['v.sede_id = s.id', 'v.fecha <= :hoy'];
            const replacements = { hoy };

            if (filtros.fecha_desde) {
                joinConditions.push('v.fecha >= :fecha_desde');
                replacements.fecha_desde = filtros.fecha_desde;
            }
            if (filtros.fecha_hasta) {
                joinConditions.push('v.fecha <= :fecha_hasta');
                replacements.fecha_hasta = filtros.fecha_hasta;
            }
            if (filtros.tecnico_ids) {
                joinConditions.push('v.tecnico_asignado_id::text = :tecnico_id');
                replacements.tecnico_id = Array.isArray(filtros.tecnico_ids)
                    ? filtros.tecnico_ids[0] : filtros.tecnico_ids;
            }
            if (filtros.tipo) {
                joinConditions.push('v.tipo = :tipo');
                replacements.tipo = filtros.tipo;
            }
            if (filtros.estado) {
                joinConditions.push('v.estado = :estado');
                replacements.estado = filtros.estado;
            } else {
                joinConditions.push("v.estado != 'cancelada'");
            }

            const whereConditions = ['s.es_prueba = false'];
            if (filtros.sede_ids) {
                whereConditions.push('s.id::text = :sede_id_filter');
                replacements.sede_id_filter = Array.isArray(filtros.sede_ids)
                    ? filtros.sede_ids[0] : filtros.sede_ids;
            }

            const sql = `
                SELECT
                    s.id   AS sede_id,
                    s.nombre_sede,
                    COUNT(v.id) AS count
                FROM sedes s
                LEFT JOIN visitas v ON (${joinConditions.join(' AND ')})
                WHERE ${whereConditions.join(' AND ')}
                GROUP BY s.id, s.nombre_sede
                ORDER BY COUNT(v.id) DESC, s.nombre_sede ASC
            `;

            const resultado = await sequelize.query(sql, {
                replacements,
                type: sequelize.QueryTypes.SELECT
            });

            return resultado.map(r => ({
                name: r.nombre_sede,
                value: parseInt(r.count),
                sede_id: r.sede_id
            }));
        } catch (error) {
            logger.error('Error obteniendo distribución por sede:', error);
            throw error;
        }
    }

    /**
     * Obtener distribución de visitas por técnico (excluir sedes de prueba)
     */
    async obtenerDistribucionPorTecnico(filtros = {}) {
        try {
            const where = this._construirFiltros(filtros);

            const resultado = await Visita.findAll({
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('Visita.id')), 'count']
                ],
                where,
                include: [
                    {
                        model: Personal,
                        as: 'tecnicoAsignado',
                        attributes: ['id', 'nombre', 'apellido']
                    },
                    {
                        model: Sede,
                        as: 'sedePrincipal',
                        attributes: [],
                        where: { es_prueba: false },
                        required: true
                    }
                ],
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
     * Obtener distribución de problemas por categoría (excluir sedes de prueba)
     */
    async obtenerProblemasPorCategoria(filtros = {}) {
        try {
            const where = this._construirFiltros(filtros);

            const resultado = await VisitaProblemaResuelto.findAll({
                attributes: [
                    'categoria_id',
                    [sequelize.fn('COUNT', sequelize.col('VisitaProblemaResuelto.id')), 'count']
                ],
                include: [
                    {
                        model: CategoriaProblema,
                        as: 'categoriaProblema',
                        attributes: ['id', 'nombre', 'codigo', 'color']
                    },
                    {
                        model: VisitaInforme,
                        as: 'informe',
                        attributes: [],
                        required: true,
                        include: [{
                            model: Visita,
                            as: 'visita',
                            attributes: [],
                            where,
                            required: true,
                            include: [{
                                model: Sede,
                                as: 'sedePrincipal',
                                attributes: [],
                                where: { es_prueba: false },
                                required: true
                            }]
                        }]
                    }
                ],
                group: ['categoria_id', 'categoriaProblema.id', 'categoriaProblema.nombre', 'categoriaProblema.codigo', 'categoriaProblema.color'],
                order: [[sequelize.fn('COUNT', sequelize.col('VisitaProblemaResuelto.id')), 'DESC']],
                raw: true
            });

            return resultado.map(r => ({
                name: r['categoriaProblema.nombre'] || 'Sin categoría',
                value: parseInt(r.count),
                categoria_id: r.categoria_id,
                codigo: r['categoriaProblema.codigo'],
                color: r['categoriaProblema.color']
            }));
        } catch (error) {
            logger.error('Error obteniendo problemas por categoría:', error);
            throw error;
        }
    }

    /**
     * Obtener distribución de problemas causados por usuario (excluir sedes de prueba)
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
                        required: true,
                        include: [{
                            model: Sede,
                            as: 'sedePrincipal',
                            attributes: [],
                            where: { es_prueba: false },
                            required: true
                        }]
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
     * Obtener distribución por estado (excluir sedes de prueba)
     */
    async obtenerDistribucionEstados(filtros = {}) {
        try {
            const where = this._construirFiltros(filtros);

            const resultado = await Visita.findAll({
                attributes: [
                    'estado',
                    [sequelize.fn('COUNT', sequelize.col('Visita.id')), 'count']
                ],
                where,
                include: [{
                    model: Sede,
                    as: 'sedePrincipal',
                    attributes: [],
                    where: { es_prueba: false },
                    required: true
                }],
                group: ['estado'],
                order: [[sequelize.fn('COUNT', sequelize.col('Visita.id')), 'DESC']],
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
     * Obtener distribución por tipo (excluir sedes de prueba)
     */
    async obtenerDistribucionTipos(filtros = {}) {
        try {
            const where = this._construirFiltros(filtros);

            const resultado = await Visita.findAll({
                attributes: [
                    'tipo',
                    [sequelize.fn('COUNT', sequelize.col('Visita.id')), 'count']
                ],
                where,
                include: [{
                    model: Sede,
                    as: 'sedePrincipal',
                    attributes: [],
                    where: { es_prueba: false },
                    required: true
                }],
                group: ['tipo'],
                order: [[sequelize.fn('COUNT', sequelize.col('Visita.id')), 'DESC']],
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
     * Obtener lista detallada de casos cerrados (excluir sedes de prueba)
     */
    async obtenerListaCasosCerrados(filtros = {}) {
        try {
            const where = this._construirFiltros(filtros);

            const limite = parseInt(filtros.limit) || 2000;
            const visitas = await Visita.findAll({
                where,
                limit: limite,
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
                        attributes: ['id', 'nombre_sede'],
                        where: { es_prueba: false },
                        required: true
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
     * Obtener lista de visitas con detalles (excluir sedes de prueba)
     */
    async obtenerListaVisitas(filtros = {}) {
        try {
            const where = this._construirFiltros(filtros);

            const limite = parseInt(filtros.limit) || 2000;
            const visitas = await Visita.findAll({
                where,
                limit: limite,
                include: [
                    {
                        model: Sede,
                        as: 'sedePrincipal',
                        attributes: ['id', 'nombre_sede'],
                        where: { es_prueba: false },
                        required: true
                    },
                    {
                        model: Personal,
                        as: 'tecnicoAsignado',
                        attributes: ['id', 'nombre', 'apellido']
                    },
                    {
                        model: VisitaInforme,
                        as: 'informe',
                        attributes: ['id', 'fecha_realizacion']
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
                fecha_informe: v.informe?.fecha_realizacion
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

            // Agregar casos cerrados por sede a partir de la lista ya filtrada
            const casosPorSedeMap = {};
            listaCasos.forEach(caso => {
                const nombre = caso.sede || 'Sin sede';
                casosPorSedeMap[nombre] = (casosPorSedeMap[nombre] || 0) + 1;
            });
            const casosPorSede = Object.entries(casosPorSedeMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

            return {
                metricas: estadisticasGenerales,
                graficos: {
                    sedes: distribucionSedes,
                    tecnicos: distribucionTecnicos,
                    categorias: problemasCategorias,
                    problemasUsuario,
                    estados: distribucionEstados,
                    tipos: distribucionTipos,
                    casosPorSede
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

export default new VisitaReportService();
