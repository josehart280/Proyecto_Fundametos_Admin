/**
 * Conexion a Base de Datos SQL Server
 * Usa mssql con soporte para async/await
 */

require('dotenv').config();
const sql = require('mssql');

let pool = null;

/**
 * Crea un pool de conexiones a la base de datos
 */
async function crearPool() {
  if (pool) return pool;

  const config = {
    server: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };

  pool = await sql.connect(config);
  return pool;
}

/**
 * Prueba la conexion a la base de datos
 */
async function probarConexion() {
  try {
    const pool = await crearPool();
    await pool.request().query('SELECT 1');
    console.log('✅ Conexion a SQL Server exitosa');
    return true;
  } catch (error) {
    console.error('❌ Error de conexion a SQL Server:', error.message);
    return false;
  }
}

/**
 * Ejecuta una consulta SELECT
 * @param {string} sqlQuery - Consulta SQL
 * @param {Array} params - Parametros opcionales
 * @returns {Promise<Array>} Resultados de la consulta
 */
async function query(sqlQuery, params = []) {
  const pool = await crearPool();
  const request = pool.request();

  if (params && !Array.isArray(params)) {
    for (const key in params) {
      request.input(key, params[key]);
    }
  } else if (params && params.length > 0) {
    params.forEach((param, index) => {
      request.input(`param${index}`, param);
    });
  }

  const result = await request.query(sqlQuery);
  return result.recordset;
}

/**
 * Ejecuta una consulta INSERT
 * @param {string} tabla - Nombre de la tabla
 * @param {Object} datos - Objeto con los datos a insertar
 * @returns {Promise<number>} ID del registro insertado
 */
async function insertar(tabla, datos) {
  const pool = await crearPool();
  const request = pool.request();

  const campos = Object.keys(datos);
  const valores = Object.values(datos);
  const setClause = campos.map((campo, i) => {
    request.input(`campo${i}`, valores[i]);
    return `${campo} = @campo${i}`;
  }).join(', ');

  const sqlQuery = `INSERT INTO ${tabla} SET ${setClause}; SELECT SCOPE_IDENTITY() as id;`;

  const result = await request.query(sqlQuery);
  return result.recordset[0].id;
}

/**
 * Ejecuta una consulta UPDATE
 * @param {string} tabla - Nombre de la tabla
 * @param {Object} datos - Objeto con los datos a actualizar
 * @param {string} where - Condicion WHERE
 * @param {Array} paramsWhere - Parametros de la condicion
 * @returns {Promise<number>} Numero de filas afectadas
 */
async function actualizar(tabla, datos, where, paramsWhere = []) {
  const pool = await crearPool();
  const request = pool.request();

  let paramIndex = 0;

  const campos = Object.keys(datos).map(campo => {
    request.input(`campo${paramIndex}`, datos[campo]);
    return `${campo} = @campo${paramIndex++}`;
  }).join(', ');

  if (paramsWhere && !Array.isArray(paramsWhere)) {
    for (const key in paramsWhere) {
      request.input(key, paramsWhere[key]);
    }
  } else if (paramsWhere && paramsWhere.length > 0) {
    const whereParams = paramsWhere.map(param => {
      request.input(`where${paramIndex}`, param);
      return `@where${paramIndex++}`;
    });
  }

  const sqlQuery = `UPDATE ${tabla} SET ${campos} WHERE ${where}`;

  const result = await request.query(sqlQuery);
  return result.rowsAffected[0];
}

/**
 * Ejecuta una consulta DELETE
 * @param {string} tabla - Nombre de la tabla
 * @param {string} where - Condicion WHERE
 * @param {Array} params - Parametros de la condicion
 * @returns {Promise<number>} Numero de filas eliminadas
 */
async function eliminar(tabla, where, params = []) {
  const pool = await crearPool();
  const request = pool.request();

  if (params && !Array.isArray(params)) {
    for (const key in params) {
      request.input(key, params[key]);
    }
  } else if (params && params.length > 0) {
    params.forEach((param, index) => {
      request.input(`param${index}`, param);
    });
  }

  const sqlQuery = `DELETE FROM ${tabla} WHERE ${where}`;

  const result = await request.query(sqlQuery);
  return result.rowsAffected[0];
}

/**
 * Cierra el pool de conexiones
 */
async function cerrarConexion() {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('🔌 Conexiones a SQL Server cerradas');
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