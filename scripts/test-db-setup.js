/**
 * Script de Setup y Verificación de BD para Testing
 * Verifica tablas, crea usuario de prueba si no existe, y valida datos
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sql = require('mssql');

const config = {
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

let passed = 0;
let failed = 0;
let warnings = 0;

function ok(id, msg) { passed++; console.log(`  ✅ ${id}: ${msg}`); }
function fail(id, msg) { failed++; console.log(`  ❌ ${id}: ${msg}`); }
function warn(id, msg) { warnings++; console.log(`  ⚠️  ${id}: ${msg}`); }

async function run() {
  let pool;
  try {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║  TEST SUITE: Setup y Verificación de Base de Datos ║');
    console.log('╚════════════════════════════════════════════════════╝\n');

    console.log(`  Conectando a: ${config.server} / ${config.database}\n`);
    pool = await sql.connect(config);

    // ─────────────────────────────────────────────────
    // FASE 1: Verificar conexión
    // ─────────────────────────────────────────────────
    console.log('── FASE 1: Conectividad ──');
    
    const testConn = await pool.request().query('SELECT 1 as ok');
    if (testConn.recordset[0].ok === 1) ok('CON-01', 'Conexión a BD exitosa');
    else fail('CON-01', 'Conexión fallida');

    // ─────────────────────────────────────────────────
    // FASE 2: Verificar tablas existentes
    // ─────────────────────────────────────────────────
    console.log('\n── FASE 2: Schema de tablas ──');

    const tablasRequeridas = [
      'Personal', 'Usuarios', 'Saldos_Vacacionales', 'Nombramientos',
      'Roles', 'Carreras', 'Solicitudes_Vacaciones', 'Feriados',
      'Movimientos_Saldo', 'Sesiones', 'Intentos_Acceso',
      'Recuperacion_Password', 'Intentos_Recuperacion'
    ];

    const tablasExistentes = await pool.request().query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'`
    );
    const nombresTablas = tablasExistentes.recordset.map(t => t.TABLE_NAME);

    for (const tabla of tablasRequeridas) {
      if (nombresTablas.includes(tabla)) {
        ok(`DB-${tabla}`, `Tabla ${tabla} existe`);
      } else {
        fail(`DB-${tabla}`, `Tabla ${tabla} NO existe`);
      }
    }

    // Listar tablas extra (informativas)
    const extras = nombresTablas.filter(t => !tablasRequeridas.includes(t));
    if (extras.length > 0) {
      console.log(`\n  ℹ️  Tablas adicionales en BD: ${extras.join(', ')}`);
    }

    // ─────────────────────────────────────────────────
    // FASE 3: Verificar columnas de autenticación en Usuarios
    // ─────────────────────────────────────────────────
    console.log('\n── FASE 3: Columnas de autenticación en Usuarios ──');

    const columnasAuth = ['Correo_Electronico', 'Fecha_Ultimo_Acceso', 'Intentos_Fallidos', 'Bloqueado', 'Fecha_Bloqueo'];
    const columnasExistentes = await pool.request().query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Usuarios'`
    );
    const nombresColumnas = columnasExistentes.recordset.map(c => c.COLUMN_NAME);

    for (const col of columnasAuth) {
      if (nombresColumnas.includes(col)) {
        ok(`DB-COL-${col}`, `Columna ${col} existe en Usuarios`);
      } else {
        warn(`DB-COL-${col}`, `Columna ${col} NO existe — ejecutar SCRIPT_SQL_AUTENTICACION.sql`);
      }
    }

    // ─────────────────────────────────────────────────
    // FASE 4: Verificar/Crear usuario de prueba
    // ─────────────────────────────────────────────────
    console.log('\n── FASE 4: Usuario de prueba ──');

    // 4.1 Verificar Personal id=1
    const personal = await pool.request().query(`SELECT * FROM Personal WHERE id_Personal = 1`);
    if (personal.recordset.length > 0) {
      const p = personal.recordset[0];
      ok('DB-20', `Personal id=1 existe: ${p.Nombre || 'N/A'} ${p.Apellido || 'N/A'}`);
    } else {
      warn('DB-20', 'Personal id=1 NO existe — creando registro de prueba...');
      try {
        await pool.request().query(
          `SET IDENTITY_INSERT Personal ON;
           INSERT INTO Personal (id_Personal, Nombre, Apellido, Correo) 
           VALUES (1, 'Usuario', 'Prueba', 'geral@cucr.ac.cr');
           SET IDENTITY_INSERT Personal OFF;`
        );
        ok('DB-20-FIX', 'Personal de prueba creado exitosamente');
      } catch (e) {
        // Intentar sin identity insert
        try {
          await pool.request().query(
            `INSERT INTO Personal (Nombre, Apellido, Correo) VALUES ('Usuario', 'Prueba', 'geral@cucr.ac.cr')`
          );
          ok('DB-20-FIX', 'Personal de prueba creado (sin identity insert)');
        } catch (e2) {
          fail('DB-20-FIX', `No se pudo crear Personal: ${e2.message}`);
        }
      }
    }

    // 4.2 Verificar usuario ProyectoAdmin
    const usuario = await pool.request().query(
      `SELECT * FROM Usuarios WHERE username = 'ProyectoAdmin'`
    );
    if (usuario.recordset.length > 0) {
      const u = usuario.recordset[0];
      ok('DB-21', `Usuario ProyectoAdmin existe (id=${u.id_Usuario}, Estado=${u.Estado})`);
      
      // Resetear estado para testing
      await pool.request().query(
        `UPDATE Usuarios SET Intentos_Fallidos = 0, Bloqueado = 0, Fecha_Bloqueo = NULL WHERE username = 'ProyectoAdmin'`
      );
      ok('DB-21-RESET', 'Intentos fallidos y bloqueo reseteados');
    } else {
      warn('DB-21', 'Usuario ProyectoAdmin NO existe — creando...');
      try {
        await pool.request().query(
          `INSERT INTO Usuarios (id_Personal, username, Password, Estado, Correo_Electronico, Intentos_Fallidos, Bloqueado)
           VALUES (1, 'ProyectoAdmin', 'Proyectos0123', 'Activo', 'geral@cucr.ac.cr', 0, 0)`
        );
        ok('DB-21-FIX', 'Usuario ProyectoAdmin creado exitosamente');
      } catch (e) {
        fail('DB-21-FIX', `No se pudo crear usuario: ${e.message}`);
      }
    }

    // 4.3 Verificar saldo vacacional
    const saldo = await pool.request().query(
      `SELECT * FROM Saldos_Vacacionales WHERE id_Personal = 1`
    );
    if (saldo.recordset.length > 0) {
      ok('DB-22', `Saldo vacacional: ${saldo.recordset[0].saldo_Disponible} días`);
    } else {
      warn('DB-22', 'Saldo vacacional NO existe — creando con 15 días...');
      try {
        await pool.request().query(
          `INSERT INTO Saldos_Vacacionales (id_Personal, saldo_Disponible) VALUES (1, 15)`
        );
        ok('DB-22-FIX', 'Saldo vacacional creado: 15 días');
      } catch (e) {
        fail('DB-22-FIX', `No se pudo crear saldo: ${e.message}`);
      }
    }

    // 4.4 Verificar feriados
    const feriados = await pool.request().query(`SELECT COUNT(*) as total FROM Feriados`);
    if (feriados.recordset[0].total > 0) {
      ok('DB-23', `Feriados cargados: ${feriados.recordset[0].total} registros`);
    } else {
      warn('DB-23', 'No hay feriados cargados');
    }

    // 4.5 Verificar nombramientos
    const nomb = await pool.request().query(
      `SELECT n.*, r.Nombre as Rol, c.Nombre as Carrera 
       FROM Nombramientos n 
       LEFT JOIN Roles r ON n.id_Rol = r.id_Rol 
       LEFT JOIN Carreras c ON n.id_Carrera = c.id_Carrera 
       WHERE n.id_Personal = 1`
    );
    if (nomb.recordset.length > 0) {
      ok('DB-24', `Nombramientos para id_Personal=1: ${nomb.recordset.length} registro(s)`);
      nomb.recordset.forEach(n => {
        console.log(`         → Rol: ${n.Rol || 'N/A'}, Carrera: ${n.Carrera || 'N/A'}, Tipo: ${n.Tipo_Nombramiento || 'N/A'}`);
      });
    } else {
      warn('DB-24', 'No hay nombramientos para id_Personal=1');
    }

    // ─────────────────────────────────────────────────
    // FASE 5: Limpiar datos de testing anteriores
    // ─────────────────────────────────────────────────
    console.log('\n── FASE 5: Limpieza de datos de testing ──');

    const userId = usuario.recordset.length > 0 ? usuario.recordset[0].id_Usuario : null;
    if (userId) {
      // Limpiar sesiones anteriores
      const sesLimpiadas = await pool.request().query(
        `DELETE FROM Sesiones WHERE id_Usuario = ${userId}`
      );
      console.log(`  🧹 Sesiones limpiadas: ${sesLimpiadas.rowsAffected[0]} registros`);

      // Limpiar intentos de acceso
      const intLimpiados = await pool.request().query(
        `DELETE FROM Intentos_Acceso WHERE id_Usuario = ${userId}`
      );
      console.log(`  🧹 Intentos de acceso limpiados: ${intLimpiados.rowsAffected[0]} registros`);

      // Limpiar tokens de recuperación
      const recLimpiados = await pool.request().query(
        `DELETE FROM Recuperacion_Password WHERE id_Usuario = ${userId}`
      );
      console.log(`  🧹 Tokens de recuperación limpiados: ${recLimpiados.rowsAffected[0]} registros`);

      // Limpiar intentos de recuperación
      const irLimpiados = await pool.request().query(
        `DELETE FROM Intentos_Recuperacion WHERE id_Usuario = ${userId}`
      );
      console.log(`  🧹 Intentos de recuperación limpiados: ${irLimpiados.rowsAffected[0]} registros`);
    }

    // ─────────────────────────────────────────────────
    // RESUMEN
    // ─────────────────────────────────────────────────
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log(`║  RESULTADOS: ${passed} passed | ${failed} failed | ${warnings} warnings`);
    console.log('╚════════════════════════════════════════════════════╝\n');

    if (failed > 0) {
      console.log('⛔ HAY FALLOS — corregir antes de ejecutar tests funcionales');
      process.exit(1);
    } else {
      console.log('✅ BD lista para testing funcional');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

run();
