/**
 * Conexion a Base de Datos MySQL
 * Usa mysql2 con soporte para async/await
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

let pool = null;

/**
 * Crea un pool de conexiones a la base de datos
 */
async function crearPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

  return pool;
}

/**
 * Prueba la conexion a la base de datos
 */
async function probarConexion() {
  try {
    const conexion = await crearPool();
    await conexion.execute('SELECT 1');
    console.log('✅ Conexion a MySQL exitosa');
    return true;
  } catch (error) {
    console.error('❌ Error de conexion a MySQL:', error.message);
    return false;
  }
}

/**
 * Ejecuta una consulta SELECT
 */
async function query(sql, params = []) {
  const conexion = await crearPool();
  const [filas] = await conexion.execute(sql, params);
  return filas;
}

/**
 * Ejecuta una consulta INSERT
 */
async function insertar(tabla, datos) {
  const conexion = await crearPool();
  const campos = Object.keys(datos);
  const valores = Object.values(datos);
  const placeholders = campos.map(() => '?').join(', ');

  const sql = `INSERT INTO ${tabla} (${campos.join(', ')}) VALUES (${placeholders})`;

  const [resultado] = await conexion.execute(sql, valores);
  return resultado.insertId;
}

/**
 * Ejecuta una consulta UPDATE
 */
async function actualizar(tabla, datos, where, paramsWhere = []) {
  const conexion = await crearPool();
  const campos = Object.keys(datos);
  const setClause = campos.map(campo => `${campo} = ?`).join(', ');
  const valores = [...Object.values(datos), ...paramsWhere];

  const sql = `UPDATE ${tabla} SET ${setClause} WHERE ${where}`;

  const [resultado] = await conexion.execute(sql, valores);
  return resultado.affectedRows;
}

/**
 * Ejecuta una consulta DELETE
 */
async function eliminar(tabla, where, params = []) {
  const conexion = await crearPool();
  const sql = `DELETE FROM ${tabla} WHERE ${where}`;

  const [resultado] = await conexion.execute(sql, params);
  return resultado.affectedRows;
}

/**
 * Cierra el pool de conexiones
 */
async function cerrarConexion() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('🔌 Conexiones a MySQL cerradas');
  }
}

module.exports = {
  crearPool,
  probarConexion,
  query,
  insertar,
  actualizar,
  eliminar,
  cerrarConexion
};