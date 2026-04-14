
const db = require('./db');

async function createView() {
  const sqlView = `
    IF OBJECT_ID('v_Usuarios_Perfiles', 'V') IS NOT NULL
        DROP VIEW v_Usuarios_Perfiles;
    GO
    CREATE VIEW v_Usuarios_Perfiles AS
    SELECT 
        u.id_Usuario,
        p.id_Personal,
        u.username,
        p.Nombre,
        p.Apellido,
        p.Correo,
        r.Nombre AS Rol,
        c.Nombre AS Carrera,
        n.Tipo_Nombramiento,
        n.Fraccion_Tiempo,
        n.Estado AS Estado_Nombramiento,
        u.Estado AS Estado_Usuario
    FROM Usuarios u
    INNER JOIN Personal p ON u.id_Personal = p.id_Personal
    INNER JOIN Nombramientos n ON p.id_Personal = n.id_Personal
    INNER JOIN Roles r ON n.id_Rol = r.id_Rol
    LEFT JOIN Carreras c ON n.id_Carrera = c.id_Carrera;
  `;

  try {
    console.log('--- Creando Vista v_Usuarios_Perfiles en la BD ---');
    
    // MSSQL node driver doesn't support GO, so we Split or just use CREATE OR ALTER if version allows
    // But since it's SQL Server, we can do it in separate calls or one block without GO if simple.
    // Let's use a simple approach: check if exists, then create.
    
    await db.query("IF OBJECT_ID('v_Usuarios_Perfiles', 'V') IS NOT NULL DROP VIEW v_Usuarios_Perfiles");
    
    await db.query(`
      CREATE VIEW v_Usuarios_Perfiles AS
      SELECT 
          u.id_Usuario,
          p.id_Personal,
          u.username,
          p.Nombre,
          p.Apellido,
          p.Correo,
          r.Nombre AS Rol,
          c.Nombre AS Carrera,
          n.Tipo_Nombramiento,
          n.Fraccion_Tiempo,
          n.Estado AS Estado_Nombramiento,
          u.Estado AS Estado_Usuario
      FROM Usuarios u
      INNER JOIN Personal p ON u.id_Personal = p.id_Personal
      INNER JOIN Nombramientos n ON p.id_Personal = n.id_Personal
      INNER JOIN Roles r ON n.id_Rol = r.id_Rol
      LEFT JOIN Carreras c ON n.id_Carrera = c.id_Carrera
    `);

    console.log('✅ Vista v_Usuarios_Perfiles creada exitosamente.');

    console.log('\n--- Probando la vista ---');
    const result = await db.query("SELECT TOP 5 * FROM v_Usuarios_Perfiles");
    console.table(result);

    await db.cerrarConexion();
  } catch (error) {
    console.error('❌ Error al crear la vista:', error.message);
    process.exit(1);
  }
}

createView();
