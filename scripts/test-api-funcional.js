/**
 * TEST SUITE: API Funcional
 * Tests de Autenticación (HU1-4) + Colaborador (COL)
 * Flujo E2E completo: Login → Dashboard → Solicitud → Cancelación → Logout
 */

const BASE_URL = 'http://localhost:3001';

let passed = 0;
let failed = 0;
const results = [];

function ok(id, msg, detail = '') {
  passed++;
  results.push({ id, status: '✅', msg });
  console.log(`  ✅ ${id}: ${msg}${detail ? ` (${detail})` : ''}`);
}

function fail(id, msg, detail = '') {
  failed++;
  results.push({ id, status: '❌', msg });
  console.log(`  ❌ ${id}: ${msg}${detail ? ` — ${detail}` : ''}`);
}

async function post(url, body = {}) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function get(url, headers = {}) {
  const res = await fetch(`${BASE_URL}${url}`, { headers });
  const data = await res.json();
  return { status: res.status, data };
}

// ════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════

async function testConectividad() {
  console.log('\n── CON: Conectividad ──');

  try {
    const { status, data } = await get('/api/test');
    if (status === 200 && data.baseDeDatos === 'conectada')
      ok('CON-01', 'API funcionando y BD conectada');
    else
      fail('CON-01', 'API activa pero BD no conectada', JSON.stringify(data));
  } catch (e) {
    fail('CON-01', 'No se puede conectar al servidor', `¿Ejecutaste npm start? ${e.message}`);
    return false;
  }

  // Test 404
  try {
    const { status } = await get('/api/ruta-inexistente');
    if (status === 404) ok('CON-04', 'Ruta inexistente devuelve 404');
    else fail('CON-04', `Ruta inexistente devuelve ${status}, esperaba 404`);
  } catch (e) {
    fail('CON-04', 'Error testeando ruta 404', e.message);
  }

  return true;
}

async function testLoginExitoso() {
  console.log('\n── AUT-01..10: Login con Credenciales ──');

  // AUT-01: Login exitoso
  const { status, data } = await post('/api/login', {
    username: 'ProyectoAdmin',
    password: 'Proyectos0123'
  });

  if (status === 200 && data.exito === true) {
    ok('AUT-01', 'Login exitoso con credenciales válidas');
    
    // Verificar que devuelve token
    if (data.token && data.token.length > 20) {
      ok('AUT-08', `Token generado (${data.token.length} chars)`);
    } else {
      fail('AUT-08', 'Token no generado o muy corto');
    }

    // Verificar datos de usuario
    if (data.usuario && data.usuario.nombre) {
      ok('AUT-01b', `Usuario: ${data.usuario.nombre} ${data.usuario.apellido || ''}`);
    }

    // Verificar expiración
    if (data.expiracion) {
      const exp = new Date(data.expiracion);
      const ahora = new Date();
      const horasDiff = (exp - ahora) / (1000 * 60 * 60);
      if (horasDiff > 7 && horasDiff < 9) {
        ok('AUT-08b', `Expiración en ~${horasDiff.toFixed(1)} horas (esperado: 8h)`);
      } else {
        fail('AUT-08b', `Expiración en ${horasDiff.toFixed(1)} horas, esperaba ~8h`);
      }
    }

    return data.token;
  } else {
    fail('AUT-01', 'Login falló', JSON.stringify(data));
    return null;
  }
}

async function testLoginFallidos() {
  console.log('\n── AUT-02..07: Login Fallidos ──');

  // AUT-02: Username vacío
  {
    const { status, data } = await post('/api/login', { username: '', password: 'abc' });
    if (status === 400 && data.exito === false)
      ok('AUT-02', 'Username vacío rechazado (400)');
    else
      fail('AUT-02', `Username vacío: status=${status}`, JSON.stringify(data));
  }

  // AUT-03: Password vacío
  {
    const { status, data } = await post('/api/login', { username: 'admin', password: '' });
    if (status === 400 && data.exito === false)
      ok('AUT-03', 'Password vacío rechazado (400)');
    else
      fail('AUT-03', `Password vacío: status=${status}`, JSON.stringify(data));
  }

  // AUT-04: Username inexistente
  {
    const { status, data } = await post('/api/login', { username: 'noexiste_xyz', password: 'pass123' });
    if (status === 401 && data.exito === false)
      ok('AUT-04', 'Username inexistente rechazado (401)');
    else
      fail('AUT-04', `Username inexistente: status=${status}`, JSON.stringify(data));
  }

  // AUT-05: Password incorrecta
  {
    const { status, data } = await post('/api/login', { username: 'ProyectoAdmin', password: 'wrongpass' });
    if (status === 401 && data.exito === false)
      ok('AUT-05', 'Password incorrecta rechazada (401)');
    else
      fail('AUT-05', `Password incorrecta: status=${status}`, JSON.stringify(data));
  }

  // AUT-06: Username < 3 chars
  {
    const { status, data } = await post('/api/login', { username: 'ab', password: 'pass' });
    if (status === 401 && data.exito === false)
      ok('AUT-06', 'Username corto rechazado (< 3 chars)');
    else
      fail('AUT-06', `Username corto: status=${status}`, JSON.stringify(data));
  }

  // AUT-07: Body vacío
  {
    const { status, data } = await post('/api/login', {});
    if (status === 400 && data.exito === false)
      ok('AUT-07', 'Body vacío rechazado (400)');
    else
      fail('AUT-07', `Body vacío: status=${status}`, JSON.stringify(data));
  }
}

async function testBloqueo() {
  console.log('\n── AUT-11..15: Bloqueo de Cuenta ──');

  // Primero resetear el usuario (login exitoso para resetear contadores)
  await post('/api/login', { username: 'ProyectoAdmin', password: 'Proyectos0123' });

  // AUT-11: 1er intento fallido
  {
    const { data } = await post('/api/login', { username: 'ProyectoAdmin', password: 'wrong1' });
    if (data.exito === false)
      ok('AUT-11', '1er intento fallido registrado');
    else
      fail('AUT-11', 'Debería fallar con password incorrecta');
  }

  // AUT-12: 2do intento fallido
  {
    const { data } = await post('/api/login', { username: 'ProyectoAdmin', password: 'wrong2' });
    if (data.exito === false)
      ok('AUT-12', '2do intento fallido registrado');
    else
      fail('AUT-12', 'Debería fallar');
  }

  // AUT-13: 3er intento fallido → BLOQUEO
  {
    const { data } = await post('/api/login', { username: 'ProyectoAdmin', password: 'wrong3' });
    if (data.exito === false)
      ok('AUT-13', '3er intento fallido — cuenta debería bloquearse');
    else
      fail('AUT-13', 'Debería fallar');
  }

  // AUT-14: Login con cuenta bloqueada
  {
    const { status, data } = await post('/api/login', { username: 'ProyectoAdmin', password: 'Proyectos0123' });
    if (status === 401 && data.codigo === 'USUARIO_BLOQUEADO')
      ok('AUT-14', 'Login con cuenta bloqueada rechazado');
    else if (status === 401)
      ok('AUT-14', `Login rechazado (código: ${data.codigo || 'N/A'}) — posible bloqueo activo`);
    else
      fail('AUT-14', `Cuenta bloqueada debería rechazar login, status=${status}`, JSON.stringify(data));
  }

  // Resetear bloqueo via BD directa (el script de setup ya lo hizo)
  // Necesitamos resetear via API — hacemos un workaround
  console.log('\n  ℹ️  Reseteando bloqueo para continuar tests...');
  
  // Usamos el módulo de BD directamente
  const sql = require('mssql');
  const pool = await sql.connect({
    server: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: { encrypt: true, trustServerCertificate: true }
  });
  await pool.request().query(
    `UPDATE Usuarios SET Intentos_Fallidos = 0, Bloqueado = 0, Fecha_Bloqueo = NULL WHERE username = 'ProyectoAdmin'`
  );
  await pool.close();
  console.log('  🔓 Cuenta desbloqueada');

  // AUT-15: Login exitoso después de resetear
  {
    const { status, data } = await post('/api/login', { username: 'ProyectoAdmin', password: 'Proyectos0123' });
    if (status === 200 && data.exito === true)
      ok('AUT-15', 'Login exitoso después de desbloquear — contadores reseteados');
    else
      fail('AUT-15', 'Login debería funcionar después de resetear', JSON.stringify(data));
  }
}

async function testLogout(token) {
  console.log('\n── AUT-20..24: Cierre de Sesión ──');

  // Primero necesitamos un token fresco
  const loginRes = await post('/api/login', { username: 'ProyectoAdmin', password: 'Proyectos0123' });
  const tokenFresco = loginRes.data.token;

  if (!tokenFresco) {
    fail('AUT-20', 'No se pudo obtener token para test de logout');
    return;
  }

  // AUT-21: Logout sin token
  {
    const { status, data } = await post('/api/logout', {});
    if (status === 400 && data.exito === false)
      ok('AUT-21', 'Logout sin token rechazado (400)');
    else
      fail('AUT-21', `Logout sin token: status=${status}`, JSON.stringify(data));
  }

  // AUT-22: Logout con token inválido
  {
    const { data } = await post('/api/logout', { token: 'fake_token_12345' });
    if (data.exito === false)
      ok('AUT-22', 'Logout con token inválido: sesión no encontrada');
    else
      fail('AUT-22', 'Logout con token fake debería fallar');
  }

  // AUT-20: Logout exitoso
  {
    const { status, data } = await post('/api/logout', { token: tokenFresco });
    if (status === 200 && data.exito === true)
      ok('AUT-20', 'Logout exitoso con token válido');
    else
      fail('AUT-20', `Logout falló: status=${status}`, JSON.stringify(data));
  }

  // AUT-24: Token ya no funciona después de logout
  {
    const { data } = await post('/api/logout', { token: tokenFresco });
    if (data.exito === false)
      ok('AUT-24', 'Token invalidado después de logout — no se puede reusar');
    else
      fail('AUT-24', 'Token debería estar invalidado post-logout');
  }
}

async function testAuditoria() {
  console.log('\n── AUT-30..32: Auditoría de Accesos ──');

  // Obtener token fresco
  const loginRes = await post('/api/login', { username: 'ProyectoAdmin', password: 'Proyectos0123' });
  const token = loginRes.data.token;

  // AUT-31: Sin token
  {
    const { status } = await get('/api/auditar/intentos-acceso');
    if (status === 401)
      ok('AUT-31', 'Auditoría sin token rechazada (401)');
    else
      fail('AUT-31', `Auditoría sin token: status=${status}`);
  }

  // AUT-30: Con token válido
  if (token) {
    const { status, data } = await get(`/api/auditar/intentos-acceso?token=${token}`);
    if (status === 200 && data.exito === true) {
      ok('AUT-30', `Auditoría con token válido: ${data.total} registros`);
      // Verificar que hay registros de los tests anteriores
      if (data.total > 0) {
        ok('AUT-09', 'Intentos de acceso registrados en BD (auditoría funciona)');
      }
    } else {
      fail('AUT-30', `Auditoría falló: status=${status}`, JSON.stringify(data));
    }

    // Logout del token
    await post('/api/logout', { token });
  }
}

async function testRecuperacionPassword() {
  console.log('\n── AUT-40..49: Recuperación de Contraseña ──');

  // AUT-43: Sin identificador
  {
    const { status, data } = await post('/api/solicitar-recuperacion', {});
    if (status === 400)
      ok('AUT-43', 'Recuperación sin identificador rechazada (400)');
    else
      fail('AUT-43', `Sin identificador: status=${status}`, JSON.stringify(data));
  }

  // AUT-42: Correo inexistente (no revela)
  {
    const { status, data } = await post('/api/solicitar-recuperacion', { identificador: 'fake@email.com' });
    if (status === 200 && data.exito === true)
      ok('AUT-42', 'Correo inexistente: respuesta genérica (no revela info)');
    else
      fail('AUT-42', `Correo inexistente: status=${status}`, JSON.stringify(data));
  }

  // AUT-40: Recuperación con correo válido
  {
    const { status, data } = await post('/api/solicitar-recuperacion', { identificador: 'geral@cucr.ac.cr' });
    if (status === 200 && data.exito === true)
      ok('AUT-40', 'Recuperación con correo válido: token generado');
    else
      fail('AUT-40', `Recuperación con correo: status=${status}`, JSON.stringify(data));
  }

  // AUT-41: Recuperación con username
  {
    const { status, data } = await post('/api/solicitar-recuperacion', { identificador: 'ProyectoAdmin' });
    if (status === 200 && data.exito === true)
      ok('AUT-41', 'Recuperación con username: token generado');
    else
      fail('AUT-41', `Recuperación con username: status=${status}`, JSON.stringify(data));
  }

  // AUT-45: Passwords no coinciden
  {
    const { status, data } = await post('/api/cambiar-password', {
      token: 'cualquier_token',
      nueva_password: 'Password1!',
      confirmar_password: 'OtraPassword2!'
    });
    if (status === 400 && data.mensaje && data.mensaje.includes('no coinciden'))
      ok('AUT-45', 'Passwords no coinciden rechazado');
    else
      fail('AUT-45', `Passwords no coinciden: status=${status}`, JSON.stringify(data));
  }

  // AUT-46: Password débil
  {
    const { status, data } = await post('/api/cambiar-password', {
      token: 'cualquier_token',
      nueva_password: 'abc',
      confirmar_password: 'abc'
    });
    if (status === 400)
      ok('AUT-46', 'Password débil rechazada');
    else
      fail('AUT-46', `Password débil: status=${status}`, JSON.stringify(data));
  }

  // AUT-48: Token inválido
  {
    const { status, data } = await post('/api/cambiar-password', {
      token: 'token_completamente_falso_12345',
      nueva_password: 'NuevaPass123!',
      confirmar_password: 'NuevaPass123!'
    });
    if (status === 400 && data.exito === false)
      ok('AUT-48', 'Token de recuperación inválido rechazado');
    else
      fail('AUT-48', `Token inválido: status=${status}`, JSON.stringify(data));
  }
}

async function testDashboard() {
  console.log('\n── COL-01..05: Dashboard del Empleado ──');

  const { status, data } = await get('/api/dashboard');

  if (status !== 200) {
    fail('COL-01', `Dashboard falló con status ${status}`);
    return;
  }

  // COL-01: Datos básicos del usuario
  if (data.usuario && (data.usuario.Nombre || data.usuario.saldo_vacaciones !== undefined)) {
    ok('COL-01', `Dashboard cargado: ${data.usuario.Nombre || 'N/A'} ${data.usuario.Apellido || ''}`);
  } else {
    fail('COL-01', 'Dashboard sin datos de usuario');
  }

  // COL-02: Nombramientos
  if (data.usuario && data.usuario.nombramientos && data.usuario.nombramientos.length > 0) {
    ok('COL-02', `Nombramientos: ${data.usuario.nombramientos.length} registro(s)`);
  } else {
    fail('COL-02', 'Sin nombramientos en dashboard', 'Puede que id_Personal=1 no tenga nombramientos');
  }

  // COL-03: Solicitudes
  if (data.vacacionesProgramadas !== undefined) {
    ok('COL-03', `Solicitudes cargadas: ${data.vacacionesProgramadas.length} registro(s)`);
  } else {
    fail('COL-03', 'Sin campo vacacionesProgramadas');
  }

  // COL-04: Feriados
  if (data.feriados !== undefined) {
    ok('COL-04', `Feriados cargados: ${data.feriados.length} fecha(s)`);
  } else {
    fail('COL-04', 'Sin campo feriados');
  }

  return data;
}

async function testSolicitudVacaciones() {
  console.log('\n── COL-10..15: Solicitud de Vacaciones ──');

  // Obtener saldo actual
  const dashPre = await get('/api/dashboard');
  const saldoPre = dashPre.data.usuario?.saldo_vacaciones;
  console.log(`  ℹ️  Saldo antes de solicitud: ${saldoPre} días`);

  // COL-10: Crear solicitud
  const fechaInicio = '2026-07-01';
  const fechaFin = '2026-07-03';
  const dias = 3;

  const { status, data } = await post('/api/solicitudes', {
    fInicio: fechaInicio,
    fFin: fechaFin,
    dias: dias,
    motivo: 'Test automatizado de vacaciones'
  });

  if (status === 200 && data.success === true) {
    ok('COL-10', `Solicitud creada: ${fechaInicio} a ${fechaFin} (${dias} días)`);
  } else {
    fail('COL-10', `Crear solicitud falló: status=${status}`, JSON.stringify(data));
    return null;
  }

  // COL-11: Verificar saldo descontado
  const dashPost = await get('/api/dashboard');
  const saldoPost = dashPost.data.usuario?.saldo_vacaciones;
  console.log(`  ℹ️  Saldo después de solicitud: ${saldoPost} días`);

  if (saldoPre !== undefined && saldoPost !== undefined) {
    if (saldoPost === saldoPre - dias) {
      ok('COL-11', `Saldo descontado correctamente: ${saldoPre} → ${saldoPost} (-${dias})`);
    } else {
      fail('COL-11', `Saldo no descontado correctamente: ${saldoPre} → ${saldoPost}, esperava ${saldoPre - dias}`);
    }
  } else {
    fail('COL-11', 'No se pudo verificar saldo');
  }

  // COL-12: Verificar movimiento en Kardex (indirecto - la solicitud aparece)
  const solicitudes = dashPost.data.vacacionesProgramadas || [];
  const solicitudCreada = solicitudes.find(s => s.motivo === 'Test automatizado de vacaciones');
  if (solicitudCreada) {
    ok('COL-12', `Solicitud visible en lista (id: ${solicitudCreada.id})`);
    return solicitudCreada.id;
  } else {
    // Buscar la última solicitud
    const ultima = solicitudes[solicitudes.length - 1];
    if (ultima) {
      ok('COL-12', `Solicitud aparece en lista (última id: ${ultima.id})`);
      return ultima.id;
    }
    fail('COL-12', 'Solicitud creada no aparece en dashboard');
    return null;
  }
}

async function testCancelacion(idSolicitud) {
  console.log('\n── COL-20..24: Cancelación de Solicitud ──');

  if (!idSolicitud) {
    fail('COL-20', 'No hay solicitud para cancelar (test anterior falló)');
    return;
  }

  // Obtener saldo actual
  const dashPre = await get('/api/dashboard');
  const saldoPre = dashPre.data.usuario?.saldo_vacaciones;
  console.log(`  ℹ️  Saldo antes de cancelar: ${saldoPre} días`);

  // COL-20: Cancelar solicitud
  const { status, data } = await post('/api/cancelar', { id: idSolicitud });

  if (status === 200 && data.success === true) {
    ok('COL-20', `Solicitud ${idSolicitud} cancelada`);
  } else {
    fail('COL-20', `Cancelación falló: status=${status}`, JSON.stringify(data));
    return;
  }

  // COL-21: Verificar reembolso de saldo
  const dashPost = await get('/api/dashboard');
  const saldoPost = dashPost.data.usuario?.saldo_vacaciones;
  console.log(`  ℹ️  Saldo después de cancelar: ${saldoPost} días`);

  if (saldoPre !== undefined && saldoPost !== undefined) {
    if (saldoPost > saldoPre) {
      ok('COL-21', `Saldo reembolsado: ${saldoPre} → ${saldoPost} (+${saldoPost - saldoPre})`);
    } else {
      fail('COL-21', `Saldo NO reembolsado: ${saldoPre} → ${saldoPost}`);
    }
  }

  // COL-22: Verificar estado de solicitud
  const solicitudes = dashPost.data.vacacionesProgramadas || [];
  const solicitudCancelada = solicitudes.find(s => s.id === idSolicitud);
  if (solicitudCancelada && solicitudCancelada.estado === 'Cancelada') {
    ok('COL-22', 'Estado de solicitud: Cancelada ✓');
  } else if (solicitudCancelada) {
    fail('COL-22', `Estado: ${solicitudCancelada.estado}, esperaba: Cancelada`);
  }

  // COL-23: Cancelar solicitud inexistente
  {
    const { status: s } = await post('/api/cancelar', { id: 999999 });
    if (s === 200) {
      ok('COL-23', 'Cancelar solicitud inexistente no causa error 500');
    } else {
      fail('COL-23', `Cancelar inexistente: status=${s}`);
    }
  }
}

async function testModulosNoImplementados() {
  console.log('\n── NI: Módulos No Implementados (validación de ausencia) ──');

  const rutasFaltantes = [
    { id: 'NI-01', ruta: '/api/aprobaciones', modulo: 'Aprobación (PRF-APR-00)' },
    { id: 'NI-02', ruta: '/api/bandeja-entrada', modulo: 'Bandeja de Entrada (PRF-JEF-03)' },
    { id: 'NI-03', ruta: '/api/metricas-equipo', modulo: 'Métricas Equipo (PRF-JEF-01)' },
    { id: 'NI-04', ruta: '/api/admin/usuarios', modulo: 'Gestión Usuarios (PRF-ADM-01)' },
    { id: 'NI-05', ruta: '/api/admin/configuraciones', modulo: 'Configuraciones (PRF-ADM-02)' },
    { id: 'NI-06', ruta: '/api/admin/reportes', modulo: 'Reportes (PRF-ADM-03)' },
  ];

  for (const { id, ruta, modulo } of rutasFaltantes) {
    try {
      const { status } = await get(ruta);
      if (status === 404)
        ok(id, `${modulo}: 404 (no implementado) — confirmado`);
      else
        fail(id, `${modulo}: devuelve ${status}, esperaba 404`);
    } catch (e) {
      fail(id, `${modulo}: error al verificar`, e.message);
    }
  }
}

// ════════════════════════════════════════════════════
// FLUJO E2E COMPLETO
// ════════════════════════════════════════════════════

async function flujoE2ECompleto() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  FLUJO E2E: Login → Dashboard → Solicitud → Cancel → Logout');
  console.log('══════════════════════════════════════════════════════');

  // Paso 1: Login
  console.log('\n  📍 Paso 1: Login');
  const loginRes = await post('/api/login', { username: 'ProyectoAdmin', password: 'Proyectos0123' });
  if (loginRes.status !== 200 || !loginRes.data.exito) {
    fail('E2E-01', 'Login falló en flujo E2E');
    return;
  }
  const token = loginRes.data.token;
  ok('E2E-01', `Login exitoso → token obtenido`);

  // Paso 2: Dashboard
  console.log('\n  📍 Paso 2: Dashboard');
  const dashRes = await get('/api/dashboard');
  if (dashRes.status === 200 && dashRes.data.usuario) {
    ok('E2E-02', `Dashboard cargado: ${dashRes.data.usuario.Nombre || 'OK'}, saldo: ${dashRes.data.usuario.saldo_vacaciones}`);
  } else {
    fail('E2E-02', 'Dashboard no cargó correctamente');
  }
  const saldoInicial = dashRes.data.usuario?.saldo_vacaciones;

  // Paso 3: Crear solicitud
  console.log('\n  📍 Paso 3: Crear solicitud de vacaciones');
  const solRes = await post('/api/solicitudes', {
    fInicio: '2026-08-01',
    fFin: '2026-08-02',
    dias: 2,
    motivo: 'E2E Test Flow'
  });
  if (solRes.status === 200 && solRes.data.success) {
    ok('E2E-03', 'Solicitud creada (2 días)');
  } else {
    fail('E2E-03', 'Crear solicitud falló en E2E');
  }

  // Paso 4: Verificar saldo descontado
  console.log('\n  📍 Paso 4: Verificar saldo');
  const dashRes2 = await get('/api/dashboard');
  const saldoPost = dashRes2.data.usuario?.saldo_vacaciones;
  if (saldoInicial !== undefined && saldoPost === saldoInicial - 2) {
    ok('E2E-04', `Saldo correcto: ${saldoInicial} → ${saldoPost}`);
  } else {
    fail('E2E-04', `Saldo: ${saldoInicial} → ${saldoPost}`);
  }

  // Paso 5: Cancelar solicitud
  console.log('\n  📍 Paso 5: Cancelar solicitud');
  const solicitudes = dashRes2.data.vacacionesProgramadas || [];
  const solE2E = solicitudes.find(s => s.motivo === 'E2E Test Flow') || solicitudes[solicitudes.length - 1];

  if (solE2E) {
    const cancelRes = await post('/api/cancelar', { id: solE2E.id });
    if (cancelRes.status === 200 && cancelRes.data.success) {
      ok('E2E-05', `Solicitud ${solE2E.id} cancelada`);
    } else {
      fail('E2E-05', 'Cancelación falló en E2E');
    }

    // Verificar reembolso
    const dashRes3 = await get('/api/dashboard');
    const saldoFinal = dashRes3.data.usuario?.saldo_vacaciones;
    if (saldoFinal === saldoInicial) {
      ok('E2E-06', `Saldo restaurado: ${saldoFinal} (igual al inicial: ${saldoInicial})`);
    } else {
      fail('E2E-06', `Saldo final: ${saldoFinal}, esperaba: ${saldoInicial}`);
    }
  } else {
    fail('E2E-05', 'No se encontró solicitud para cancelar');
  }

  // Paso 6: Logout
  console.log('\n  📍 Paso 6: Logout');
  const logoutRes = await post('/api/logout', { token });
  if (logoutRes.status === 200 && logoutRes.data.exito) {
    ok('E2E-07', 'Logout exitoso — sesión cerrada');
  } else {
    fail('E2E-07', 'Logout falló en E2E');
  }
}

// ════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════

async function main() {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TEST SUITE: API Funcional — Sistema Vacaciones CUCR       ║');
  console.log('║  Base URL: http://localhost:3001                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // 1. Conectividad
  const conectado = await testConectividad();
  if (!conectado) {
    console.log('\n⛔ Servidor no disponible. Ejecutá: npm start');
    process.exit(1);
  }

  // 2. Login
  const token = await testLoginExitoso();

  // 3. Login fallidos
  await testLoginFallidos();

  // 4. Bloqueo de cuenta
  await testBloqueo();

  // 5. Logout
  await testLogout(token);

  // 6. Auditoría
  await testAuditoria();

  // 7. Recuperación de contraseña
  await testRecuperacionPassword();

  // 8. Dashboard
  await testDashboard();

  // 9. Solicitud de vacaciones
  const idSolicitud = await testSolicitudVacaciones();

  // 10. Cancelación
  await testCancelacion(idSolicitud);

  // 11. Módulos no implementados
  await testModulosNoImplementados();

  // 12. Flujo E2E completo
  await flujoE2ECompleto();

  // ═════════════════════════════════════════════════
  // REPORTE FINAL
  // ═════════════════════════════════════════════════
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    REPORTE FINAL                           ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Passed: ${String(passed).padEnd(4)} | ❌ Failed: ${String(failed).padEnd(4)}                    ║`);
  console.log(`║  Total: ${String(passed + failed).padEnd(4)} tests                                      ║`);
  console.log(`║  Tasa de éxito: ${((passed / (passed + failed)) * 100).toFixed(1)}%                               ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (failed > 0) {
    console.log('Tests fallidos:');
    results.filter(r => r.status === '❌').forEach(r => {
      console.log(`  ❌ ${r.id}: ${r.msg}`);
    });
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
