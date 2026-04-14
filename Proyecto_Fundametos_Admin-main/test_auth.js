const path = require('path');
const dotenvPath = path.resolve(__dirname, '../Proyecto_Fundametos_Admin-main/node_modules/dotenv');
require(dotenvPath).config({ path: path.resolve(__dirname, '../Proyecto_Fundametos_Admin-main/.env') });

const db = require('../Proyecto_Fundametos_Admin-main/db.js');
const auth = require('../Proyecto_Fundametos_Admin-main/auth.js');

async function testAuth() {
  try {
    await db.probarConexion();
    console.log('Probando luis...');
    const result = await auth.validarCredenciales('luism', 'password123');
    console.log('Resultado luis:', result);
    
    console.log('Probando Dencel...');
    const result2 = await auth.validarCredenciales('Dencel', 'jasan');
    console.log('Resultado Dencel:', result2);
  } catch(e) {
    console.error('ERROR ATRAPADO:', e);
  }
  process.exit();
}
testAuth();
