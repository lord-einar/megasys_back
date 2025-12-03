const { sequelize } = require('../src/shared/utils/database');
const { Personal, Rol } = require('../src/models');

(async () => {
  try {
    // Buscar por nombre Nahuel
    const personas = await Personal.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { nombre: { [sequelize.Sequelize.Op.iLike]: '%nahuel%' } },
          { apellido: { [sequelize.Sequelize.Op.iLike]: '%ramirez%' } }
        ]
      },
      include: [{
        model: Rol,
        as: 'rol',
        attributes: ['id', 'nombre', 'descripcion']
      }]
    });

    if (personas.length > 0) {
      console.log(`✅ Encontrado(s) ${personas.length} usuario(s):\n`);
      personas.forEach(p => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Nombre completo:', p.nombre, p.apellido);
        console.log('Email:', p.email);
        console.log('Rol ID:', p.rol_id);
        console.log('Rol asignado:', p.rol ? p.rol.nombre : '⚠️  SIN ROL ASIGNADO');
        console.log('Privilegio App:', p.privilegio_app);
        console.log('Activo:', p.activo);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      });
    } else {
      console.log('❌ No se encontró ningún usuario con nombre Nahuel o apellido Ramirez');

      // Buscar todos para ver qué hay
      console.log('\n📋 Mostrando primeros 5 usuarios de la base de datos:');
      const todos = await Personal.findAll({
        limit: 5,
        include: [{
          model: Rol,
          as: 'rol',
          attributes: ['nombre']
        }]
      });

      todos.forEach(p => {
        console.log(`- ${p.nombre} ${p.apellido} (Rol: ${p.rol ? p.rol.nombre : 'Sin rol'})`);
      });
    }

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
