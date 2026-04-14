const path = require('path');
const dbPath = path.resolve(__dirname, '../Proyecto_Fundametos_Admin-main/db.js');
const db = require(dbPath);

const dotenvPath = path.resolve(__dirname, '../Proyecto_Fundametos_Admin-main/node_modules/dotenv');
require(dotenvPath).config({ path: path.resolve(__dirname, '../Proyecto_Fundametos_Admin-main/.env') });

async function runTest() {
  try {
    await db.probarConexion();
    const personal = await db.query('SELECT * FROM Personal');
    const usuarios = await db.query('SELECT * FROM Usuarios');
    console.log('--- PERSONAL ---');
    console.log(JSON.stringify(personal, null, 2));
    console.log('--- USUARIOS ---');
    console.log(JSON.stringify(usuarios, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
runTest();
