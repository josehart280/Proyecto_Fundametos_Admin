
const db = require('./db');

async function checkSchema() {
  try {
    console.log('--- TABLES ---');
    const tables = await db.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
    console.log(tables.map(t => t.TABLE_NAME).join(', '));

    console.log('\n--- FOREIGN KEYS ---');
    const fks = await db.query(`
      SELECT 
        fk.name AS FK_NAME,
        tp.name AS PARENT_TABLE,
        cp.name AS PARENT_COLUMN,
        tr.name AS REFERENCED_TABLE,
        cr.name AS REFERENCED_COLUMN
      FROM sys.foreign_keys AS fk
      INNER JOIN sys.foreign_key_columns AS fkc ON fk.object_id = fkc.constraint_object_id
      INNER JOIN sys.tables AS tp ON fkc.parent_object_id = tp.object_id
      INNER JOIN sys.columns AS cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
      INNER JOIN sys.tables AS tr ON fkc.referenced_object_id = tr.object_id
      INNER JOIN sys.columns AS cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
    `);
    
    fks.forEach(fk => {
      console.log(`${fk.PARENT_TABLE}.${fk.PARENT_COLUMN} -> ${fk.REFERENCED_TABLE}.${fk.REFERENCED_COLUMN} (${fk.FK_NAME})`);
    });

    console.log('\n--- COLUMNS IN ROLES ---');
    const rolesCols = await db.query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Roles'");
    rolesCols.forEach(c => console.log(`${c.COLUMN_NAME} (${c.DATA_TYPE})`));

    console.log('\n--- COLUMNS IN USUARIOS ---');
    const usuariosCols = await db.query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Usuarios'");
    usuariosCols.forEach(c => console.log(`${c.COLUMN_NAME} (${c.DATA_TYPE})`));

    await db.cerrarConexion();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSchema();
