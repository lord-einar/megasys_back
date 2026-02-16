// src/modules/remitos/controllers/remitoController.js
import remitoService from '../services/remitoService.js';
import logger from '../../../shared/utils/logger.js';
import { success, error, paginated } from '../../../shared/utils/response.js';
import { sequelize, Personal, Rol, Remito, Inventario, TipoArticulo, RemitoDetalle } from '../../../models/index.js';
import { GUID_TO_GROUP_MAP } from '../../auth/config/roles.js';
import roleService from '../../auth/services/roleService.js';
import emailService from '../../../shared/services/emailService.js';

class RemitoController {
  /**
   * POST /remitos
   * Crear nuevo remito
   * Requiere: Rol "Sistemas" (con validación de permisos)
   */
  async crear(req, res) {
    try {
      const datosNueva = req.body;
      const usuarioEmail = req.user?.email || 'usuario-desconocido@sistema.com';
      const usuarioId = req.user?.id || null;

      logger.info('Iniciando creación de remito:', {
        usuario: usuarioEmail,
        usuarioId,
        articulos: datosNueva.articulos?.length || 0
      });

      const remito = await remitoService.crear(datosNueva, usuarioEmail, { usuarioId });

      return success(res, remito, `Remito ${remito.numero_remito} creado exitosamente`, 201);
    } catch (err) {
      // Extraer información de línea y función del stack trace
      const stackLines = err.stack?.split('\n') || [];
      const lineaInfo = stackLines[1]?.trim() || 'Desconocida';

      logger.error('Error creando remito:', {
        error: err.message,
        linea: lineaInfo,
        stack: err.stack,
        usuario: req.user?.email || 'desconocido',
        body: req.body
      });

      return error(res, err.message || 'Error al crear el remito', 400);
    }
  }

  /**
   * GET /remitos
   * Listar remitos con filtros y paginación
   */
  async listar(req, res) {
    try {
      const filters = {
        page: req.query.page || 1,
        limit: req.query.limit || 10,
        estado: req.query.estado || null,
        es_prestamo: req.query.es_prestamo || null,
        solicitante_id: req.query.solicitante_id || null,
        tecnico_id: req.query.tecnico_id || null,
        sede_origen_id: req.query.sede_origen_id || null,
        sede_destino_id: req.query.sede_destino_id || null
      };

      logger.info('Listando remitos:', { filters });

      const resultado = await remitoService.listar(filters);

      return paginated(res, resultado.rows, resultado.pagination, 'Remitos obtenidos correctamente');
    } catch (err) {
      logger.error('Error listando remitos:', err);
      return error(res, 'Error al obtener remitos', 500);
    }
  }

  /**
   * GET /remitos/:id
   * Obtener remito con detalles completos
   */
  async obtener(req, res) {
    try {
      const { id } = req.params;

      logger.info('Obteniendo remito:', { id });

      const remito = await remitoService.obtener(id);

      return success(res, remito, 'Remito obtenido correctamente');
    } catch (err) {
      logger.error('Error obteniendo remito:', err);

      if (err.message === 'El remito no existe') {
        return error(res, err.message, 404);
      }

      return error(res, 'Error al obtener remito', 500);
    }
  }

  /**
   * PATCH /remitos/:id/estado
   * Cambiar estado del remito
   * Solo Infraestructura puede realizar esta acción
   */
  async cambiarEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado } = req.body;
      // Personal y Rol ya importados al inicio del archivo

      if (!estado) {
        return error(res, 'El nuevo estado es requerido', 400);
      }

      // Resolver personal (busca por email o auto-provisiona desde Azure AD)
      const personal = await remitoService.resolverPersonal(req.user);

      if (!personal) {
        logger.warn('Personal no encontrado incluso después de auto-provisioning:', {
          email: req.user.email
        });
        return error(res, 'Usuario no registrado en el sistema. Por favor contacta a Infraestructura.', 404);
      }

      const usuarioId = personal.id;
      // Convertir GUIDs de Azure AD a nombres de grupos
      const azureGroupGuids = req.user.groups || [];
      const azureGroupNames = azureGroupGuids
        .filter(guid => GUID_TO_GROUP_MAP[guid])
        .map(guid => GUID_TO_GROUP_MAP[guid]);

      // Combinar roles de la base de datos Y grupos de Azure AD (convertidos a nombres)
      const userRoles = [
        ...(personal.rol ? [personal.rol.nombre] : []),
        ...azureGroupNames
      ];
      const privilegioApp = personal.privilegio_app || req.user.privilegioApp || null;

      logger.info('Cambiando estado de remito:', {
        remitoId: id,
        nuevoEstado: estado,
        usuarioId,
        email: req.user.email,
        rolesDB: personal.rol ? [personal.rol.nombre] : [],
        gruposAzureADGuids: azureGroupGuids,
        gruposAzureADNombres: azureGroupNames,
        rolesCombinados: userRoles,
        privilegioApp
      });

      const remito = await remitoService.cambiarEstado(id, estado, usuarioId, {
        userRoles,
        privilegioApp,
        usuarioEmail: req.user.email,
        userAgent: req.get('user-agent'),
        ipAddress: req.ip
      });

      return success(res, remito, `Estado del remito actualizado a "${estado}"`);
    } catch (err) {
      logger.error('Error cambiando estado de remito:', err);

      if (err.message === 'El remito no existe') {
        return error(res, err.message, 404);
      }

      return error(res, err.message || 'Error al cambiar estado', 400);
    }
  }

  /**
   * POST /remitos/:id/devolver
   * Generar remito de devolución automático
   * Cuando se devuelven artículos préstamo
   * Requiere: Grupo "Infraestructura" (Super_admin) O ser el técnico asignado al remito
   */
  async generarDevolucion(req, res) {
    try {
      const { id: remitoOriginalId } = req.params;
      const { detalleIds } = req.body;
      const usuarioEmail = req.user.email;

      if (!Array.isArray(detalleIds) || detalleIds.length === 0) {
        return error(res, 'Debes seleccionar al menos un artículo a devolver', 400);
      }

      // Verificar permisos: super_admin O técnico asignado
      const userRole = roleService.getUserRole(req.user.groups || []);
      const isSuperAdmin = userRole === 'super_admin';

      if (!isSuperAdmin) {
        // Si no es super_admin, verificar si es el técnico asignado
        // Remito y Personal ya importados al inicio del archivo
        const remitoOriginal = await Remito.findByPk(remitoOriginalId, {
          include: [{
            model: Personal,
            as: 'tecnicoAsignado',
            attributes: ['id', 'email']
          }]
        });

        if (!remitoOriginal) {
          return error(res, 'El remito original no existe', 404);
        }

        const esTecnicoAsignado = remitoOriginal.tecnicoAsignado &&
          remitoOriginal.tecnicoAsignado.email.toLowerCase() === usuarioEmail.toLowerCase();

        if (!esTecnicoAsignado) {
          logger.warn('Acceso denegado para generar devolución:', {
            usuarioEmail,
            userRole,
            tecnicoAsignado: remitoOriginal.tecnicoAsignado?.email
          });
          return error(res, 'No tienes permisos para devolver artículos de este remito. Solo el técnico asignado o usuarios del grupo Infraestructura pueden hacerlo.', 403);
        }
      }

      logger.info('Generando remito de devolución:', {
        remitoOriginalId,
        articulosADevolver: detalleIds.length,
        usuario: usuarioEmail,
        rol: userRole
      });

      const remitoDevolucion = await remitoService.generarRemitoDevolucion(
        remitoOriginalId,
        detalleIds,
        usuarioEmail
      );

      return success(res, remitoDevolucion, `Remito de devolución ${remitoDevolucion.numero_remito} creado exitosamente`, 201);
    } catch (err) {
      logger.error('Error generando remito de devolución:', err);

      if (err.message === 'El remito original no existe') {
        return error(res, err.message, 404);
      }

      return error(res, err.message || 'Error al generar remito de devolución', 400);
    }
  }

  /**
   * POST /remitos/:id/procesar-devolucion
   * Procesar devolución de préstamos con control granular por artículo
   * Body: { items: [{ detalle_id, accion: 'devolver'|'extender', nueva_fecha?: 'YYYY-MM-DD' }] }
   */
  async procesarDevolucion(req, res) {
    try {
      const { id: remitoId } = req.params;
      const { items } = req.body;
      const usuarioEmail = req.user.email;

      if (!Array.isArray(items) || items.length === 0) {
        return error(res, 'Debes especificar al menos un artículo para procesar', 400);
      }

      // Verificar permisos: super_admin O técnico asignado
      const userRole = roleService.getUserRole(req.user.groups || []);
      const isSuperAdmin = userRole === 'super_admin';

      if (!isSuperAdmin) {
        const remitoOriginal = await Remito.findByPk(remitoId, {
          include: [{
            model: Personal,
            as: 'tecnicoAsignado',
            attributes: ['id', 'email']
          }]
        });

        if (!remitoOriginal) {
          return error(res, 'El remito no existe', 404);
        }

        const esTecnicoAsignado = remitoOriginal.tecnicoAsignado &&
          remitoOriginal.tecnicoAsignado.email.toLowerCase() === usuarioEmail.toLowerCase();

        if (!esTecnicoAsignado) {
          return error(res, 'No tienes permisos para procesar devoluciones de este remito.', 403);
        }
      }

      logger.info('Procesando devolución de préstamos:', {
        remitoId,
        itemsCount: items.length,
        usuario: usuarioEmail,
        rol: userRole
      });

      const resultado = await remitoService.procesarDevolucion(
        remitoId,
        items,
        usuarioEmail,
        {
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }
      );

      return success(res, resultado, 'Devolución procesada exitosamente');
    } catch (err) {
      logger.error('Error procesando devolución:', err);

      if (err.message === 'El remito no existe') {
        return error(res, err.message, 404);
      }

      return error(res, err.message || 'Error al procesar devolución', 400);
    }
  }

  /**
   * GET /remitos/articulos-disponibles
   * Listar artículos disponibles para agregar a un remito
   * Filtra por tipo_articulo_id y sede_id con paginación
   */
  async obtenerArticulosDisponibles(req, res) {
    try {
      const { tipo_articulo_id, sede_id, page = 1, limit = 50 } = req.query;

      if (!sede_id) {
        return error(res, 'La sede es requerida', 400);
      }

      logger.info('Obteniendo artículos disponibles:', {
        tipoArticuloId: tipo_articulo_id,
        sedeId: sede_id,
        page,
        limit
      });

      // Inventario y TipoArticulo ya importados al inicio del archivo
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const whereClause = {
        sede_id,
        activo: true,
        estado: 'disponible' // Solo artículos disponibles (excluye en_uso, en_prestamo, etc.)
      };

      if (tipo_articulo_id) {
        whereClause.tipo_articulo_id = tipo_articulo_id;
      }

      const { count, rows } = await Inventario.findAndCountAll({
        where: whereClause,
        attributes: ['id', 'marca', 'modelo', 'numero_serie', 'service_tag', 'estado', 'tipo_articulo_id', 'sede_id'],
        include: [{
          model: TipoArticulo,
          as: 'tipoArticulo',
          attributes: ['id', 'nombre']
        }],
        limit: parseInt(limit),
        offset,
        order: [['created_at', 'DESC']],
        distinct: true,
        subQuery: false
      });

      return success(res, {
        rows,
        total: count,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit))
        }
      }, 'Artículos disponibles obtenidos correctamente');
    } catch (err) {
      logger.error('Error obteniendo artículos disponibles:', err);
      return error(res, 'Error al obtener artículos', 500);
    }
  }

  /**
   * PATCH /remitos/:id/detalles/:detalleId/fecha-devolucion
   * Actualizar fecha de devolución esperada para un artículo préstamo
   */
  async actualizarFechaDevolucion(req, res) {
    try {
      const { id: remitoId, detalleId } = req.params;
      const { fecha_devolucion_esperada } = req.body;

      if (!fecha_devolucion_esperada) {
        return error(res, 'La fecha de devolución esperada es requerida', 400);
      }

      // Validar que la fecha sea válida
      // Importante: No usar new Date() con formato YYYY-MM-DD porque se interpreta como UTC
      // En su lugar, parsear manualmente la fecha para evitar problemas de timezone
      let fechaParsed;
      if (typeof fecha_devolucion_esperada === 'string' && fecha_devolucion_esperada.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = fecha_devolucion_esperada.split('-');
        // Crear la fecha en zona horaria local, no UTC
        fechaParsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        fechaParsed = new Date(fecha_devolucion_esperada);
      }

      if (isNaN(fechaParsed.getTime())) {
        return error(res, 'La fecha de devolución proporcionada no es válida', 400);
      }

      logger.info('Actualizando fecha de devolución:', {
        remitoId,
        detalleId,
        fechaDevolucionOriginal: fecha_devolucion_esperada,
        fechaDevolucionParsed: fechaParsed.toISOString(),
        usuario: req.user?.email
      });

      // RemitoDetalle, Remito y emailService ya importados al inicio del archivo

      // Verificar que el detalle existe y pertenece al remito
      const detalle = await RemitoDetalle.findOne({
        where: { id: detalleId, remito_id: remitoId },
        include: ['inventarioDetalle']
      });

      if (!detalle) {
        return error(res, 'El detalle del remito no existe', 404);
      }

      // Verificar que es un préstamo
      if (!detalle.es_prestamo) {
        return error(res, 'Solo se puede actualizar la fecha en préstamos', 400);
      }

      // Obtener el remito completo con relaciones
      const remito = await Remito.findByPk(remitoId, {
        include: [
          { association: 'solicitante', attributes: ['id', 'nombre', 'apellido', 'email'] },
          { association: 'tecnicoAsignado', attributes: ['id', 'nombre', 'apellido'] },
          { association: 'sedeOrigen', attributes: ['id', 'nombre_sede'] },
          { association: 'sedeDestino', attributes: ['id', 'nombre_sede'] }
        ]
      });

      if (!remito) {
        return error(res, 'El remito no existe', 404);
      }

      // Debuggear: verificar que el solicitante se cargó correctamente
      logger.info('Remito cargado para actualizar fecha de devolución:', {
        remitoId,
        solicitanteId: remito.solicitante_id,
        solicitante: remito.solicitante,
        hasSolicitanteEmail: !!remito.solicitante?.email
      });

      // Actualizar la fecha
      await detalle.update({
        fecha_devolucion_esperada: fechaParsed
      });

      // Enviar email de notificación de extensión
      try {
        const inventario = detalle.inventarioDetalle;
        const nuevaFecha = new Date(fechaParsed);

        // Formato dd-mm-yyyy
        const day = String(nuevaFecha.getDate()).padStart(2, '0');
        const month = String(nuevaFecha.getMonth() + 1).padStart(2, '0');
        const year = nuevaFecha.getFullYear();
        const fechaFormato = `${day}-${month}-${year}`;

        const asunto = `Extensión de fecha de devolución - Remito ${remito.numero_remito}`;
        const descripcionArticulo = `${inventario?.tipoArticulo?.nombre || 'Artículo'} - ${inventario?.marca} ${inventario?.modelo}${inventario?.numero_serie ? ` (SN: ${inventario.numero_serie})` : ''}`;

        const contenidoEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #003366; color: white; padding: 20px; border-radius: 5px; }
    .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; margin-top: 20px; }
    .info-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; }
    strong { color: #003366; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Extensión de Fecha de Devolución</h2>
    </div>
    <div class="content">
      <p>Se ha extendido la fecha de devolución del artículo en préstamo:</p>

      <div class="info-box">
        <p><strong>Artículo:</strong> ${descripcionArticulo}</p>
        <p><strong>Remito:</strong> ${remito.numero_remito}</p>
        <p><strong>Nueva fecha de devolución:</strong> <strong style="color: #d9534f; font-size: 16px;">${fechaFormato}</strong></p>
      </div>

      <p><strong>Detalles del remito:</strong></p>
      <ul>
        <li>Solicitante: ${remito.solicitante?.nombre} ${remito.solicitante?.apellido}</li>
        <li>Técnico asignado: ${remito.tecnicoAsignado?.nombre} ${remito.tecnicoAsignado?.apellido}</li>
        <li>Sede origen: ${remito.sedeOrigen?.nombre_sede}</li>
        <li>Sede destino: ${remito.sedeDestino?.nombre_sede}</li>
      </ul>

      <p>Por favor, recuerda que el artículo debe ser devuelto en la fecha indicada.</p>
    </div>
    <div class="footer">
      <p>Este es un email automático del Sistema de Gestión Empresarial. No responder a este email.</p>
    </div>
  </div>
</body>
</html>
        `;

        // Enviar a infraestructura
        await emailService.enviarEmailHTML(
          'infraestructura@megatlon.com.ar',
          asunto,
          contenidoEmail
        );

        // Enviar al solicitante
        if (remito.solicitante?.email) {
          await emailService.enviarEmailHTML(
            remito.solicitante.email,
            asunto,
            contenidoEmail
          );
        }

        logger.info('Email de extensión de fecha enviado correctamente', {
          remitoId,
          detalleId,
          solicitanteEmail: remito.solicitante?.email,
          nuevaFecha: fechaFormato
        });
      } catch (emailErr) {
        logger.error('Error enviando email de extensión de fecha:', {
          error: emailErr.message,
          solicitante: remito.solicitante,
          remitoId,
          detalleId
        });
        // No fallar la operación si el email no se envía
      }

      // Obtener el remito actualizado con sus detalles
      const remitoActualizado = await Remito.findByPk(remitoId, {
        include: ['detalles']
      });

      return success(res, remitoActualizado, 'Fecha de devolución actualizada correctamente. Email de notificación enviado.');
    } catch (err) {
      logger.error('Error actualizando fecha de devolución:', err);

      if (err.message.includes('El detalle del remito no existe')) {
        return error(res, err.message, 404);
      }

      return error(res, 'Error al actualizar fecha de devolución', 500);
    }
  }

  /**
   * GET /remitos/prestamos/proximos-a-vencer
   * Obtener préstamos próximos a vencer
   */
  async obtenerPrestamosProximosAVencer(req, res) {
    try {
      const { dias = 7 } = req.query;

      logger.info('Obteniendo préstamos próximos a vencer:', { dias });

      const prestamos = await remitoService.obtenerPrestamosProximosAVencer(parseInt(dias));

      return success(res, prestamos, 'Préstamos próximos a vencer obtenidos correctamente');
    } catch (err) {
      logger.error('Error obteniendo préstamos próximos a vencer:', err);
      return error(res, 'Error al obtener préstamos próximos a vencer', 500);
    }
  }

  /**
   * GET /remitos/prestamos/vencidos
   * Obtener préstamos vencidos (pasada la fecha de devolución)
   */
  async obtenerPrestamosVencidos(req, res) {
    try {
      logger.info('Obteniendo préstamos vencidos');

      const prestamos = await remitoService.obtenerPrestamosVencidos();

      return success(res, prestamos, 'Préstamos vencidos obtenidos correctamente');
    } catch (err) {
      logger.error('Error obteniendo préstamos vencidos:', err);
      return error(res, 'Error al obtener préstamos vencidos', 500);
    }
  }

  /**
   * GET /remitos/prestamos/resumen
   * Obtener resumen de estado de préstamos
   */
  async obtenerResumenPrestamos(req, res) {
    try {
      logger.info('Obteniendo resumen de préstamos');

      const resumen = await remitoService.obtenerResumenPrestamos();

      return success(res, resumen, 'Resumen de préstamos obtenido correctamente');
    } catch (err) {
      logger.error('Error obteniendo resumen de préstamos:', err);
      return error(res, 'Error al obtener resumen de préstamos', 500);
    }
  }

  /**
   * POST /remitos/:id/confirmar-recepcion
   * Confirmar recepción del remito con token JWT
   * El usuario puede acceder sin autenticación usando un token válido
   */
  async confirmarRecepcion(req, res) {
    try {
      const { id } = req.params;
      const { token } = req.query;

      logger.info('Iniciando confirmación de recepción de remito:', {
        remitoId: id,
        tokenPresent: !!token
      });

      if (!token) {
        return error(res, 'Token de confirmación requerido', 400);
      }

      const resultado = await remitoService.confirmarRecepcion(id, token);

      return success(res, resultado, 'Recepción confirmada exitosamente');
    } catch (err) {
      logger.error('Error confirmando recepción de remito:', {
        error: err.message,
        remitoId: req.params.id
      });

      if (err.message.includes('Token') || err.message.includes('expirado') || err.message.includes('inválido')) {
        return error(res, err.message, 401);
      }

      if (err.message === 'El remito no existe') {
        return error(res, err.message, 404);
      }

      if (err.message.includes('ya fue confirmado')) {
        return error(res, err.message, 409);
      }

      return error(res, err.message || 'Error al confirmar recepción', 500);
    }
  }

  /**
   * POST /remitos/:id/reenviar-emails
   * Reenviar emails del remito (a infraestructura y solicitante)
   * Requiere autenticación
   */
  async reenviarEmails(req, res) {
    try {
      const { id } = req.params;
      const usuarioEmail = req.user?.email || 'usuario-desconocido@sistema.com';

      logger.info('Iniciando reenvío de emails de remito:', {
        remitoId: id,
        usuario: usuarioEmail
      });

      const resultado = await remitoService.reenviarEmails(id);

      logger.info('Reenvío de emails completado exitosamente:', {
        remitoId: id,
        usuario: usuarioEmail,
        resultado
      });

      return success(res, resultado, 'Emails reenviados exitosamente');
    } catch (err) {
      logger.error('Error reenviando emails del remito:', {
        error: err.message,
        remitoId: req.params.id,
        usuario: req.user?.email || 'desconocido'
      });

      if (err.message === 'El remito no existe') {
        return error(res, err.message, 404);
      }

      if (err.message.includes('Email')) {
        return error(res, err.message, 500);
      }

      return error(res, err.message || 'Error al reenviar emails', 500);
    }
  }

  /**
   * PATCH /remitos/:id/asignar-receptor
   * Asignar receptor alternativo para un remito en tránsito
   * Requiere: Rol "Infraestructura" o "Sistemas"
   */
  async asignarReceptor(req, res) {
    try {
      const { id } = req.params;
      const { receptor_nombre, receptor_email } = req.body;
      const usuarioEmail = req.user?.email || 'usuario-desconocido@sistema.com';

      if (!receptor_nombre || !receptor_email) {
        return error(res, 'El nombre y email del receptor son requeridos', 400);
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(receptor_email)) {
        return error(res, 'El email del receptor no es válido', 400);
      }

      logger.info('Asignando receptor a remito:', {
        remitoId: id,
        receptorNombre: receptor_nombre,
        receptorEmail: receptor_email,
        usuario: usuarioEmail
      });

      const resultado = await remitoService.asignarReceptor(id, receptor_nombre, receptor_email, usuarioEmail);

      return success(res, resultado, 'Receptor asignado exitosamente. Emails enviados.');
    } catch (err) {
      logger.error('Error asignando receptor:', err);

      if (err.message === 'El remito no existe') {
        return error(res, err.message, 404);
      }

      if (err.message.includes('estado')) {
        return error(res, err.message, 400);
      }

      return error(res, err.message || 'Error al asignar receptor', 500);
    }
  }

  /**
   * POST /remitos/detalles/:detalleId/enviar-aviso-devolucion
   * Enviar aviso de devolución próxima (para artículos que vencen en 1 día)
   */
  async enviarAvisoDevolucionProxima(req, res) {
    try {
      const { detalleId } = req.params;

      if (!detalleId) {
        return error(res, 'El ID del detalle es requerido', 400);
      }

      logger.info('Enviando aviso de devolución próxima:', {
        detalleId,
        usuario: req.user?.email
      });

      const resultado = await remitoService.enviarAvisoDevolucionProxima(detalleId);

      return success(res, resultado, 'Aviso de devolución enviado exitosamente');
    } catch (err) {
      logger.error('Error enviando aviso de devolución próxima:', err);

      if (err.message.includes('no encontrado')) {
        return error(res, 'El detalle del remito no existe', 404);
      }

      if (err.message.includes('no es un préstamo')) {
        return error(res, 'Este detalle no es un préstamo', 400);
      }

      if (err.message.includes('Email')) {
        return error(res, 'Error enviando email: ' + err.message, 500);
      }

      return error(res, err.message || 'Error al enviar aviso de devolución', 500);
    }
  }
}

export default new RemitoController();
