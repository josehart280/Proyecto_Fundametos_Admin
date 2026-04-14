const sql = require('mssql');
async function testDB() {
  const config = {
    server: 'tiusr8pl.cuc-carrera-ti.ac.cr',
    database: 'Admin_Proyectos',
    user: 'ProyectoAdmin',
    password: 'Proyectos0123',
    options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
  };
  try {
    const pool = await sql.connect(config);
    const saldos = await pool.request().query('SELECT * FROM Saldos_Vacacionales');
    console.table(saldos.recordset);
  } catch(e) { 
    console.error(e); 
  }
  process.exit();
}
testDB();
