const { sequelize } = require('../src/shared/utils/database');
const { Personal, Rol } = require('../src/models');

(async () => {
  try {
    // El ID del usuario desde el token actual
    const userId = '9e89f97f-0c22-438f-8847-61b260aaa9a1';

    // Buscar el rol de Sistemas
    const rolSistemas = await Rol.findOne({
      where: { nombre: 'Sistemas' }
    });

    if (!rolSistemas) {
      console.error('❌ No se encontró el rol Sistemas');
      process.exit(1);
    }

    // Buscar si ya existe un usuario con este ID
    const existente = await Personal.findByPk(userId);

    if (existente) {
      console.log('✅ El usuario ya existe en la tabla personal:');
      console.log({
        id: existente.id,
        nombre: existente.nombre,
        apellido: existente.apellido,
        email: existente.email,
        rol: existente.rol_id,
        activo: existente.activo
      });
    } else {
      // Preguntar por email para buscar si existe con otro ID
      console.log('\n📋 Buscando usuarios existentes por email...\n');

      // Mostrar todos los usuarios para que elijas
      const todosUsuarios = await Personal.findAll({
        include: [{ model: Rol, as: 'rol', attributes: ['nombre'] }],
        limit: 10,
        order: [['created_at', 'DESC']]
      });

      console.log('Últimos usuarios creados:');
      todosUsuarios.forEach(u => {
        console.log(`- ${u.email} (${u.nombre} ${u.apellido}) - Rol: ${u.rol?.nombre || 'Sin rol'}`);
      });

      console.log('\n⚠️  Usuario con ID', userId, 'no existe en personal.');
      console.log('💡 Opción 1: Cerrar sesión y volver a iniciar para que el sistema lo cree automáticamente');
      console.log('💡 Opción 2: Insertar manualmente (necesitas proporcionar email, nombre, apellido)');
    }

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
