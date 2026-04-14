/**
 * Servidor Web con Node.js + SQL Server
 * Sistema de Gestión de Vacaciones CUCR
 */

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const auth = require('./auth');
const mailer = require('./mailer');
const audit = require('./audit');

const PORT = process.env.PORT || 3002;

function obtenerIPCliente(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.socket.remoteAddress ||
         req.connection.remoteAddress ||
         'desconocida';
}

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function servirArchivo(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(__dirname, 'public', '404.html'), (err404, content404) => {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(content404 || '404 - No encontrado');
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 - Error interno');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

async function manejarAPI(req, res) {
  const url = req.url.split('?')[0];
  const method = req.method;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const getBody = () => new Promise(resolve => {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => {
      try {
        resolve(JSON.parse(b || '{}'));
      } catch (err) {
        console.error('[BODY_ERROR] Fallo al parsear JSON:', err.message);
        resolve({}); // Devolvemos objeto vacío para que las validaciones de negocio lo manejen
      }
    });
  });

  const obtenerToken = () => req.headers['authorization']?.replace('Bearer ', '');

  async function obtenerUsuarioAutenticado(req, res) {
    const token = obtenerToken();

    if (!token) {
      res.writeHead(401);
      res.end(JSON.stringify({ success: false, mensaje: 'Token requerido' }));
      return null;
    }

    const sesion = await auth.validarSesion(token);
    if (!sesion.valida) {
      res.writeHead(401);
      res.end(JSON.stringify({ success: false, mensaje: 'Sesión inválida o expirada' }));
      return null;
    }

    const usuarioInfo = sesion.usuario || sesion.datos || {};
    const idUsuario = Number(usuarioInfo.id_Usuario || usuarioInfo.idUsuario || usuarioInfo.id);

    if (!idUsuario) {
      res.writeHead(401);
      res.end(JSON.stringify({ success: false, mensaje: 'No se pudo identificar al usuario de la sesión' }));
      return null;
    }

    const usuarioBD = await db.query(
      `SELECT id_Usuario, id_Personal
       FROM Usuarios
       WHERE id_Usuario = @id_usuario`,
      { id_usuario: idUsuario }
    );

    if (!usuarioBD || usuarioBD.length === 0) {
      res.writeHead(401);
      res.end(JSON.stringify({ success: false, mensaje: 'Usuario de sesión no encontrado' }));
      return null;
    }

    return {
      token,
      idUsuario,
      idPersonal: Number(usuarioBD[0].id_Personal),
      sesion
    };
  }

  async function registrarAuditoriaSegura(evento) {
    try {
      const resultado = await audit.emitirEventoAuditoria(evento);
      if (!resultado.ok) {
        console.error('[AUDITORIA] Evento rechazado:', resultado.errores || 'error desconocido');
      }
    } catch (error) {
      console.error('[AUDITORIA] Error registrando evento:', error.message);
    }
  }

  // ── Helper: validar token RRHH ────────────────────────────────────────
  async function validarTokenRRHH(req, res) {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) {
      res.writeHead(401);
      res.end(JSON.stringify({ success: false, mensaje: 'Token requerido' }));
      return null;
    }

    const sesion = await auth.validarSesion(token);
    if (!sesion.valida) {
      res.writeHead(401);
      res.end(JSON.stringify({ success: false, mensaje: 'Sesión inválida o expirada' }));
      return null;
    }

    const usuarioInfo = sesion.usuario || sesion.datos || {};
    const idUsuario = Number(usuarioInfo.id_Usuario || usuarioInfo.idUsuario || usuarioInfo.id || 0);

    if (!idUsuario) {
      res.writeHead(401);
      res.end(JSON.stringify({ success: false, mensaje: 'No se pudo identificar al usuario' }));
      return null;
    }

    const roles = await db.query(`
      SELECT r.Nombre as Rol
      FROM Usuarios u
      JOIN Nombramientos n ON u.id_Personal = n.id_Personal
      JOIN Roles r ON n.id_Rol = r.id_Rol
      WHERE u.id_Usuario = @id_usuario
    `, { id_usuario: idUsuario });

    const esRRHH = roles && roles.some(r => (r.Rol || '').toLowerCase().includes('rrhh'));
    if (!esRRHH) {
      res.writeHead(403);
      res.end(JSON.stringify({ success: false, mensaje: 'No tiene permisos de RRHH' }));
      return null;
    }

    return idUsuario;
  }

  // ── Helper: registrar en log de auditoría RRHH ─────────────────────────
  async function registrarLogRRHH(idUsuario, accion, detalle) {
    try {
      await db.query(`
        INSERT INTO Log_Auditoria_Admin (id_Usuario, Accion, Detalle)
        VALUES (@id_usuario, @accion, @detalle)
      `, { id_usuario: Number(idUsuario), accion, detalle });
    } catch (e) {
      console.error('Error al registrar log RRHH:', e.message);
    }
  }

  // ── PRF-ADM-01/02/03/04  MÓDULO ADMINISTRACIÓN RRHH ─────────────────────

  // Estadísticas generales del módulo
  if (url === '/api/rrhh/estadisticas' && method === 'GET') {
    const idRRHH = await validarTokenRRHH(req, res);
    if (!idRRHH) return;

    const [activosRes, inactivosRes, sinCuentaRes, ajustesMesRes, logTotalRes] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total FROM Usuarios WHERE Estado = 'Activo'`),
      db.query(`SELECT COUNT(*) AS total FROM Usuarios WHERE Estado = 'Inactivo'`),
      db.query(`
        SELECT COUNT(*) AS total FROM Personal p
        WHERE NOT EXISTS (SELECT 1 FROM Usuarios u WHERE u.id_Personal = p.id_Personal AND u.Estado = 'Activo')
      `),
      db.query(`
        SELECT COUNT(*) AS total FROM Movimientos_Saldo
        WHERE MONTH(Fecha) = MONTH(GETDATE()) AND YEAR(Fecha) = YEAR(GETDATE())
      `),
      db.query(`SELECT COUNT(*) AS total FROM Log_Auditoria_Admin`),
    ]);

    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      estadisticas: {
        activos:    activosRes[0]?.total   || 0,
        inactivos:  inactivosRes[0]?.total || 0,
        sinCuenta:  sinCuentaRes[0]?.total || 0,
        ajustesMes: ajustesMesRes[0]?.total|| 0,
        logTotal:   logTotalRes[0]?.total  || 0,
      }
    }));
    return;
  }

  // Listado completo de usuarios
  if (url === '/api/rrhh/usuarios' && method === 'GET') {
    const idRRHH = await validarTokenRRHH(req, res);
    if (!idRRHH) return;

    const usuarios = await db.query(`
      SELECT
        u.id_Usuario                                    AS id,
        u.username,
        (ISNULL(p.Nombre,'') + ' ' + ISNULL(p.Apellido,'')) AS nombre,
        r.Nombre                                        AS rol,
        u.Estado                                        AS estado,
        ISNULL(sv.saldo_Disponible, 0)                  AS saldo
      FROM Usuarios u
      INNER JOIN Personal p ON u.id_Personal = p.id_Personal
      LEFT JOIN Nombramientos n ON u.id_Personal = n.id_Personal
      LEFT JOIN Roles r ON n.id_Rol = r.id_Rol
      LEFT JOIN Saldos_Vacacionales sv ON u.id_Personal = sv.id_Personal
      ORDER BY u.id_Usuario DESC
    `);

    res.writeHead(200);
    res.end(JSON.stringify({ success: true, usuarios }));
    return;
  }

  // Usuarios activos (para select de ajuste de saldo)
  if (url === '/api/rrhh/usuarios-activos' && method === 'GET') {
    const idRRHH = await validarTokenRRHH(req, res);
    if (!idRRHH) return;

    const usuarios = await db.query(`
      SELECT
        u.id_Usuario AS id,
        (ISNULL(p.Nombre,'') + ' ' + ISNULL(p.Apellido,'')) AS nombre,
        ISNULL(sv.saldo_Disponible, 0) AS saldo
      FROM Usuarios u
      INNER JOIN Personal p ON u.id_Personal = p.id_Personal
      LEFT JOIN Saldos_Vacacionales sv ON u.id_Personal = sv.id_Personal
      WHERE u.Estado = 'Activo'
      ORDER BY p.Nombre
    `);

    res.writeHead(200);
    res.end(JSON.stringify({ success: true, usuarios }));
    return;
  }

  // Empleados sin cuenta activa (para crear usuario)
  if (url === '/api/rrhh/empleados-sin-cuenta' && method === 'GET') {
    const idRRHH = await validarTokenRRHH(req, res);
    if (!idRRHH) return;

    const empleados = await db.query(`
      SELECT p.id_Personal AS id,
             (ISNULL(p.Nombre,'') + ' ' + ISNULL(p.Apellido,'')) AS nombre
      FROM Personal p
      WHERE NOT EXISTS (
        SELECT 1 FROM Usuarios u WHERE u.id_Personal = p.id_Personal AND u.Estado = 'Activo'
      )
      ORDER BY p.Nombre
    `);

    res.writeHead(200);
    res.end(JSON.stringify({ success: true, empleados }));
    return;
  }

  // Crear usuario (PRF-ADM-01)
  if (url === '/api/rrhh/crear-usuario' && method === 'POST') {
    const idRRHH = await validarTokenRRHH(req, res);
    if (!idRRHH) return;

    const data = await getBody();
    const { idEmpleado, rol, email, saldo } = data;

    if (!idEmpleado || !rol || !email || saldo === undefined || saldo === null) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, mensaje: 'Faltan datos requeridos.' }));
      return;
    }

    if (!['Colaborador','Jefatura','RRHH'].includes(rol)) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, mensaje: 'Rol inválido seleccionado.' }));
      return;
    }

    if (Number(saldo) < 0) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, mensaje: 'El saldo inicial debe ser un valor positivo.' }));
      return;
    }

    // Verificar que empleado no tenga cuenta activa
    const cuentaExistente = await db.query(`
      SELECT id_Usuario FROM Usuarios
      WHERE id_Personal = @id_personal AND Estado = 'Activo'
    `, { id_personal: Number(idEmpleado) });

    if (cuentaExistente && cuentaExistente.length > 0) {
      res.writeHead(409);
      res.end(JSON.stringify({ success: false, mensaje: 'El empleado ya posee una cuenta activa.' }));
      return;
    }

    // Obtener datos del empleado para generar username
    const personal = await db.query(`
      SELECT id_Personal, Nombre, Apellido FROM Personal WHERE id_Personal = @id_personal
    `, { id_personal: Number(idEmpleado) });

    if (!personal || personal.length === 0) {
      res.writeHead(404);
      res.end(JSON.stringify({ success: false, mensaje: 'Empleado no encontrado.' }));
      return;
    }

    const p = personal[0];
    const baseUsername = (p.Nombre.charAt(0) + p.Apellido).toLowerCase().replace(/\s+/g,'') + p.id_Personal;
    const tempPassword = 'Temp' + Math.random().toString(36).slice(2, 8).toUpperCase() + '!';

    // Obtener id_Rol
    const rolRes = await db.query(`SELECT id_Rol FROM Roles WHERE Nombre = @rol_nombre`, { rol_nombre: rol });
    const idRol = rolRes?.[0]?.id_Rol;

    // Insertar usuario
    await db.query(`
      INSERT INTO Usuarios (id_Personal, username, Password, Estado, Correo_Electronico, Intentos_Fallidos, Bloqueado)
      VALUES (@id_personal, @username, @password, 'Activo', @email, 0, 0)
    `, {
      id_personal: Number(idEmpleado),
      username: baseUsername,
      password: tempPassword,
      email: email
    });

    // Obtener el nuevo id
    const nuevoUsuario = await db.query(`SELECT id_Usuario FROM Usuarios WHERE username = @username`, { username: baseUsername });
    const idNuevoUsuario = nuevoUsuario?.[0]?.id_Usuario;

    // Nombramiento (rol)
    if (idRol && idNuevoUsuario) {
      await db.query(`
        INSERT INTO Nombramientos (id_Personal, id_Rol)
        VALUES (@id_personal, @id_rol)
      `, { id_personal: Number(idEmpleado), id_rol: Number(idRol) });
    }

    // Saldo vacacional inicial
    const saldoExistente = await db.query(`
      SELECT id_Personal FROM Saldos_Vacacionales WHERE id_Personal = @id_personal
    `, { id_personal: Number(idEmpleado) });

    if (saldoExistente && saldoExistente.length > 0) {
      await db.query(`
        UPDATE Saldos_Vacacionales SET saldo_Disponible = @saldo
        WHERE id_Personal = @id_personal
      `, { saldo: Number(saldo), id_personal: Number(idEmpleado) });
    } else {
      await db.query(`
        INSERT INTO Saldos_Vacacionales (id_Personal, saldo_Disponible)
        VALUES (@id_personal, @saldo)
      `, { id_personal: Number(idEmpleado), saldo: Number(saldo) });
    }

    await registrarLogRRHH(idRRHH, 'crear_usuario',
      `Creó usuario '${baseUsername}' (${rol}) para empleado ID ${idEmpleado} con saldo inicial ${saldo} días`);

    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      mensaje: 'Usuario creado correctamente. Credenciales generadas.',
      credenciales: { username: baseUsername, password: tempPassword, rol, saldo }
    }));
    return;
  }

  // Modificar usuario (PRF-ADM-01)
  if (url === '/api/rrhh/modificar-usuario' && method === 'POST') {
    const idRRHH = await validarTokenRRHH(req, res);
    if (!idRRHH) return;

    const data = await getBody();
    const { id, rol, estado } = data;

    if (!id) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, mensaje: 'ID de usuario requerido.' }));
      return;
    }

    if (rol && !['Colaborador','Jefatura','RRHH'].includes(rol)) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, mensaje: 'Rol inválido seleccionado.' }));
      return;
    }

    const usuarioActual = await db.query(`
      SELECT u.id_Usuario, u.Estado, u.id_Personal, r.Nombre AS rol_actual
      FROM Usuarios u
      LEFT JOIN Nombramientos n ON u.id_Personal = n.id_Personal
      LEFT JOIN Roles r ON n.id_Rol = r.id_Rol
      WHERE u.id_Usuario = @id_usuario
    `, { id_usuario: Number(id) });

    if (!usuarioActual || usuarioActual.length === 0) {
      res.writeHead(404);
      res.end(JSON.stringify({ success: false, mensaje: 'Usuario no encontrado.' }));
      return;
    }

    const ua = usuarioActual[0];

    if (estado) {
      await db.query(`UPDATE Usuarios SET Estado = @estado WHERE id_Usuario = @id_usuario`,
        { estado, id_usuario: Number(id) });
    }

    if (rol && rol !== ua.rol_actual) {
      const rolRes = await db.query(`SELECT id_Rol FROM Roles WHERE Nombre = @rol_nombre`, { rol_nombre: rol });
      const idRol = rolRes?.[0]?.id_Rol;
      if (idRol) {
        await db.query(`DELETE FROM Nombramientos WHERE id_Personal = @id_personal`,
          { id_personal: Number(ua.id_Personal) });
        await db.query(`INSERT INTO Nombramientos (id_Personal, id_Rol) VALUES (@id_personal, @id_rol)`,
          { id_personal: Number(ua.id_Personal), id_rol: Number(idRol) });
      }
    }

    await registrarLogRRHH(idRRHH, 'modificar_usuario',
      `Modificó usuario ID ${id}: estado=${estado || ua.Estado}, rol=${rol || ua.rol_actual}`);

    res.writeHead(200);
    res.end(JSON.stringify({ success: true, mensaje: 'Usuario modificado correctamente.' }));
    return;
  }

  // Ajuste manual de saldo (PRF-ADM-04)
  if (url === '/api/rrhh/ajuste-saldo' && method === 'POST') {
    const idRRHH = await validarTokenRRHH(req, res);
    if (!idRRHH) return;

    const data = await getBody();
    const { idColaborador, tipo, dias, motivo } = data;

    if (!idColaborador) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, mensaje: 'Colaborador requerido.' }));
      return;
    }

    if (!dias || Number(dias) <= 0) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, mensaje: 'La cantidad de días debe ser un valor positivo.' }));
      return;
    }

    if (!motivo || String(motivo).trim() === '') {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, mensaje: 'El motivo del ajuste es obligatorio.' }));
      return;
    }

    // Obtener usuario activo y su id_Personal + saldo actual
    const usuarioRes = await db.query(`
      SELECT u.id_Personal, sv.saldo_Disponible AS saldo
      FROM Usuarios u
      LEFT JOIN Saldos_Vacacionales sv ON u.id_Personal = sv.id_Personal
      WHERE u.id_Usuario = @id_usuario AND u.Estado = 'Activo'
    `, { id_usuario: Number(idColaborador) });

    if (!usuarioRes || usuarioRes.length === 0) {
      res.writeHead(404);
      res.end(JSON.stringify({ success: false, mensaje: 'Colaborador no encontrado o inactivo.' }));
      return;
    }

    const idPersonal  = usuarioRes[0].id_Personal;
    const saldoActual = Number(usuarioRes[0].saldo || 0);
    const diasNum     = Number(dias);

    const esIncremento = (tipo || '').toLowerCase() === 'incremento';
    const saldoNuevo   = esIncremento ? saldoActual + diasNum : saldoActual - diasNum;

    if (!esIncremento && saldoNuevo < 0) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, mensaje: 'El saldo resultante no puede ser negativo.' }));
      return;
    }

    await db.query(`
      UPDATE Saldos_Vacacionales
      SET saldo_Disponible = @saldo_nuevo
      WHERE id_Personal = @id_personal
    `, { saldo_nuevo: saldoNuevo, id_personal: Number(idPersonal) });

    await db.query(`
      INSERT INTO Movimientos_Saldo (id_Personal, id_Usuario_RRHH, Tipo_Movimiento, Dias, Saldo_Anterior, Saldo_Nuevo, Motivo)
      VALUES (@id_personal, @id_rrhh, @tipo, @dias, @saldo_anterior, @saldo_nuevo, @motivo)
    `, {
      id_personal: Number(idPersonal),
      id_rrhh: Number(idRRHH),
      tipo,
      dias: diasNum,
      saldo_anterior: saldoActual,
      saldo_nuevo: saldoNuevo,
      motivo: String(motivo)
    });

    await registrarLogRRHH(idRRHH, 'ajuste_saldo',
      `${tipo} de ${diasNum} días al colaborador ID ${idColaborador}. Saldo: ${saldoActual} → ${saldoNuevo}. Motivo: ${motivo}`);

    res.writeHead(200);
    res.end(JSON.stringify({ success: true, mensaje: 'Saldo de vacaciones ajustado correctamente.' }));
    return;
  }

  // Historial de ajustes
  if (url === '/api/rrhh/ajustes' && method === 'GET') {
    const idRRHH = await validarTokenRRHH(req, res);
    if (!idRRHH) return;

    const ajustes = await db.query(`
      SELECT TOP 100
        ms.Fecha                                                          AS fecha,
        (ISNULL(pr.Nombre,'') + ' ' + ISNULL(pr.Apellido,''))            AS responsable,
        (ISNULL(pc.Nombre,'') + ' ' + ISNULL(pc.Apellido,''))            AS colaborador,
        ms.Tipo_Movimiento                                                AS tipo,
        ms.Dias                                                           AS dias,
        ms.Saldo_Anterior                                                 AS saldo_anterior,
        ms.Saldo_Nuevo                                                    AS saldo_nuevo,
        ms.Motivo                                                         AS motivo
      FROM Movimientos_Saldo ms
      LEFT JOIN Usuarios ur ON ms.id_Usuario_RRHH = ur.id_Usuario
      LEFT JOIN Personal pr ON ur.id_Personal = pr.id_Personal
      INNER JOIN Personal pc ON ms.id_Personal = pc.id_Personal
      ORDER BY ms.Fecha DESC
    `);

    res.writeHead(200);
    res.end(JSON.stringify({ success: true, ajustes }));
    return;
  }

  // Leer políticas (PRF-ADM-02)
  if (url === '/api/rrhh/politicas' && method === 'GET') {
    const idRRHH = await validarTokenRRHH(req, res);
    if (!idRRHH) return;

    const rows = await db.query(`
      SELECT TOP 1
        max_dias_consecutivos, min_dias_antiguedad,
        min_dias_entre_solicitudes, aviso_previo_dias
      FROM Configuracion_Politicas
      ORDER BY id_Config DESC
    `);

    const politicas = rows?.[0] || {};
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, politicas }));
    return;
  }

  // Guardar políticas (PRF-ADM-02)
  if (url === '/api/rrhh/politicas' && method === 'POST') {
    const idRRHH = await validarTokenRRHH(req, res);
    if (!idRRHH) return;

    const data = await getBody();
    const { max_dias_consecutivos, min_dias_antiguedad, min_dias_entre_solicitudes, aviso_previo_dias } = data;

    if ([max_dias_consecutivos, min_dias_antiguedad, min_dias_entre_solicitudes, aviso_previo_dias]
        .some(v => v === undefined || isNaN(Number(v)) || Number(v) < 0)) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, mensaje: 'Error: Los valores ingresados no son válidos.' }));
      return;
    }

    await db.query(`
      INSERT INTO Configuracion_Politicas
        (max_dias_consecutivos, min_dias_antiguedad, min_dias_entre_solicitudes, aviso_previo_dias, id_Usuario_Modifico)
      VALUES (@max_dias, @min_antiguedad, @min_entre, @aviso_previo, @id_rrhh)
    `, {
      max_dias: Number(max_dias_consecutivos),
      min_antiguedad: Number(min_dias_antiguedad),
      min_entre: Number(min_dias_entre_solicitudes),
      aviso_previo: Number(aviso_previo_dias),
      id_rrhh: Number(idRRHH)
    });

    await registrarLogRRHH(idRRHH, 'cambio_politica',
      `Políticas actualizadas: max_dias=${max_dias_consecutivos}, min_antiguedad=${min_dias_antiguedad}, min_entre=${min_dias_entre_solicitudes}, aviso=${aviso_previo_dias}`);

    res.writeHead(200);
    res.end(JSON.stringify({ success: true, mensaje: 'Configuración actualizada correctamente.' }));
    return;
  }

  // Reporte gerencial (PRF-ADM-03)
  if (url.startsWith('/api/rrhh/reporte') && method === 'GET') {
    const idRRHH = await validarTokenRRHH(req, res);
    if (!idRRHH) return;

    const params = new URL(req.url, 'http://localhost').searchParams;
    const inicio = params.get('inicio');
    const fin    = params.get('fin');
    const tipo   = params.get('tipo') || 'departamento';

    if (!inicio || !fin || inicio > fin) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, mensaje: 'Rango de fechas inválido.' }));
      return;
    }

    const filas = await db.query(`
      SELECT
        (ISNULL(p.Nombre,'') + ' ' + ISNULL(p.Apellido,''))  AS colaborador,
        ISNULL(d.Nombre_Departamento, 'Sin departamento')     AS departamento,
        CONVERT(varchar, sv.fecha_Inicio, 23)                 AS inicio,
        CONVERT(varchar, sv.fecha_Fin, 23)                    AS fin,
        sv.dias_Solicitados                                   AS dias,
        sv.Estado                                             AS estado
      FROM Solicitudes_Vacaciones sv
      INNER JOIN Personal p ON sv.id_Personal = p.id_Personal
      LEFT JOIN Departamentos d ON p.id_Departamento = d.id_Departamento
      WHERE sv.fecha_Inicio >= @inicio AND sv.fecha_Fin <= @fin
      ORDER BY ${tipo === 'empleado' ? 'p.Nombre' : 'd.Nombre_Departamento'}, sv.fecha_Inicio
    `, { inicio, fin });

    res.writeHead(200);
    res.end(JSON.stringify({ success: true, filas: filas || [] }));
    return;
  }

  // Log de auditoría RRHH (PRF-ADM-03)
  if (url === '/api/rrhh/log' && method === 'GET') {
    const idRRHH = await validarTokenRRHH(req, res);
    if (!idRRHH) return;

    const eventos = await db.query(`
      SELECT TOP 200
        l.Fecha                                               AS fecha,
        ISNULL(u.username, 'Sistema')                        AS responsable,
        l.Accion                                              AS accion,
        l.Detalle                                             AS detalle
      FROM Log_Auditoria_Admin l
      LEFT JOIN Usuarios u ON l.id_Usuario = u.id_Usuario
      ORDER BY l.Fecha DESC
    `);

    res.writeHead(200);
    res.end(JSON.stringify({ success: true, eventos: eventos || [] }));
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────
  async function validarTokenJefatura(req, res) {
    const usuario = await obtenerUsuarioAutenticado(req, res);
    if (!usuario) return null;

    const roles = await db.query(
      `SELECT r.Nombre as Rol
       FROM Usuarios u
       JOIN Nombramientos n ON u.id_Personal = n.id_Personal
       JOIN Roles r ON n.id_Rol = r.id_Rol
       WHERE u.id_Usuario = @id_usuario`,
      { id_usuario: usuario.idUsuario }
    );

    const esJefatura = roles && roles.some(r => {
      const rol = (r.Rol || '').toLowerCase();
      return rol.includes('jefatura') || rol.includes('director');
    });

    if (!esJefatura) {
      res.writeHead(403);
      res.end(JSON.stringify({ success: false, mensaje: 'No tiene permisos de jefatura' }));
      return null;
    }

    return usuario;
  }


  try {
    if (url === '/api/test' && method === 'GET') {
      const conexionOk = await db.probarConexion();
      res.writeHead(200);
      res.end(JSON.stringify({
        mensaje: 'API funcionando',
        baseDeDatos: conexionOk ? 'conectada' : 'error'
      }));
      return;
    }

    if (url === '/api/usuarios' && method === 'GET') {
      const usuarios = await db.query('SELECT TOP 100 * FROM Usuarios');
      res.writeHead(200);
      res.end(JSON.stringify(usuarios));
      return;
    }

    if (url === '/api/dashboard' && method === 'GET') {
      const usuarioSesion = await obtenerUsuarioAutenticado(req, res);
      if (!usuarioSesion) return;

      const userRes = await db.query(`
        SELECT p.Nombre, p.Apellido, ISNULL(s.saldo_Disponible, 0) as saldo_vacaciones
        FROM Personal p
        LEFT JOIN Saldos_Vacacionales s ON p.id_Personal = s.id_Personal
        WHERE p.id_Personal = @id_personal
      `, { id_personal: usuarioSesion.idPersonal });

      const usuario = userRes[0] || { saldo_vacaciones: 15 };

      const nombRes = await db.query(`
        SELECT r.Nombre as Rol, c.Nombre as Carrera, n.Tipo_Nombramiento as Tipo, n.Fraccion_Tiempo
        FROM Nombramientos n
        LEFT JOIN Roles r ON n.id_Rol = r.id_Rol
        LEFT JOIN Carreras c ON n.id_Carrera = c.id_Carrera
        WHERE n.id_Personal = @id_personal
      `, { id_personal: usuarioSesion.idPersonal });

      usuario.nombramientos = nombRes;

      const solicitudes = await db.query(`
        SELECT
          id_Solicitud as id,
          CONVERT(varchar, fecha_Inicio, 23) as inicio,
          CONVERT(varchar, fecha_Fin, 23) as fin,
          dias_Solicitados as dias,
          Motivo as motivo,
          Estado as estado
        FROM Solicitudes_Vacaciones
        WHERE id_Personal = @id_personal
      `, { id_personal: usuarioSesion.idPersonal });

      const feriados = await db.query(`
        SELECT CONVERT(varchar, fecha, 23) as fecha, descripcion
        FROM Feriados
      `);

      res.writeHead(200);
      res.end(JSON.stringify({
        usuario,
        vacacionesProgramadas: solicitudes,
        feriados: feriados.map(f => f.fecha)
      }));
      return;
    }

    if (url === '/api/solicitudes' && method === 'POST') {
      const usuarioSesion = await obtenerUsuarioAutenticado(req, res);
      if (!usuarioSesion) return;

      const data = await getBody();
      const diasSolicitados = Number(data.dias || 0);

      if (!data.fInicio || !data.fFin || !diasSolicitados || diasSolicitados <= 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, mensaje: 'Datos de solicitud incompletos o inválidos' }));
        return;
      }

      const insertRes = await db.query(`
        INSERT INTO Solicitudes_Vacaciones
        (id_Personal, fecha_Inicio, fecha_Fin, dias_Solicitados, Motivo, Estado)
        VALUES
        (@id_personal, @f_inicio, @f_fin, @dias, @motivo, 'Pendiente');
        SELECT CAST(SCOPE_IDENTITY() AS INT) as id_solicitud;
      `, {
        id_personal: usuarioSesion.idPersonal,
        f_inicio: data.fInicio,
        f_fin: data.fFin,
        dias: diasSolicitados,
        motivo: data.motivo || 'Vacaciones'
      });

      const idSolicitud = insertRes[0]?.id_solicitud;

      await db.query(`
        UPDATE Saldos_Vacacionales
        SET saldo_Disponible = saldo_Disponible - @dias
        WHERE id_Personal = @id_personal
      `, { dias: diasSolicitados, id_personal: usuarioSesion.idPersonal });

      await db.query(`
        INSERT INTO Movimientos_Saldo (id_Personal, Tipo_Movimiento, Dias, Motivo)
        VALUES (@id_personal, 'Resta', @dias, 'Cobro automático por Solicitud de Vacaciones')
      `, { id_personal: usuarioSesion.idPersonal, dias: diasSolicitados });

      await registrarAuditoriaSegura({
        usuario_id: usuarioSesion.idUsuario,
        tipo_accion: 'INSERT',
        entidad_afectada: 'Solicitudes_Vacaciones',
        registro_id: idSolicitud || 'sin_id',
        ip_origen: obtenerIPCliente(req),
        detalle_json: {
          fecha_inicio: data.fInicio,
          fecha_fin: data.fFin,
          dias: diasSolicitados
        }
      });

      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (url === '/api/cancelar' && method === 'POST') {
      const usuarioSesion = await obtenerUsuarioAutenticado(req, res);
      if (!usuarioSesion) return;

      const data = await getBody();
      const idSolicitud = Number(data.id);

      if (!idSolicitud) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, mensaje: 'ID de solicitud inválido' }));
        return;
      }

      const reqInfo = await db.query(`
        SELECT id_Personal, dias_Solicitados, Estado, CONVERT(varchar, fecha_Inicio, 23) AS fecha_Inicio
        FROM Solicitudes_Vacaciones
        WHERE id_Solicitud = @id_solicitud
      `, { id_solicitud: idSolicitud });

      if (!reqInfo || reqInfo.length === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, mensaje: 'La solicitud no existe' }));
        return;
      }

      const solicitud = reqInfo[0];
      const estado = String(solicitud.Estado || '').trim();
      const fechaInicio = new Date(`${solicitud.fecha_Inicio}T00:00:00`);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      if (Number(solicitud.id_Personal) !== usuarioSesion.idPersonal) {
        res.writeHead(403);
        res.end(JSON.stringify({ success: false, mensaje: 'No puede cancelar solicitudes de otro colaborador' }));
        return;
      }

      if (estado !== 'Pendiente' && estado !== 'Aprobada') {
        res.writeHead(409);
        res.end(JSON.stringify({ success: false, mensaje: 'Solo se pueden cancelar solicitudes en estado Pendiente o Aprobada' }));
        return;
      }

      if (hoy >= fechaInicio) {
        res.writeHead(409);
        res.end(JSON.stringify({ success: false, mensaje: 'No se puede cancelar porque la fecha de inicio ya comenzó' }));
        return;
      }

      const estadoRevision = estado.toLowerCase();
      if (estadoRevision.includes('revision')) {
        res.writeHead(409);
        res.end(JSON.stringify({ success: false, mensaje: 'Existe un proceso de revisión activo que impide la cancelación' }));
        return;
      }

      if (reqInfo && reqInfo.length > 0) {
        const diasADevolver = Number(reqInfo[0].dias_Solicitados || 0);

        await db.query(`
          UPDATE Saldos_Vacacionales
          SET saldo_Disponible = saldo_Disponible + @dias
          WHERE id_Personal = @id_personal
        `, { dias: diasADevolver, id_personal: usuarioSesion.idPersonal });

        await db.query(`
          INSERT INTO Movimientos_Saldo (id_Personal, Tipo_Movimiento, Dias, Motivo)
          VALUES (@id_personal, 'Suma', @dias, 'Reembolso por Anulación de Solicitud de Vacaciones')
        `, { id_personal: usuarioSesion.idPersonal, dias: diasADevolver });
      }

      await db.query(`
        UPDATE Solicitudes_Vacaciones
        SET Estado = 'Cancelada'
        WHERE id_Solicitud = @id_solicitud
      `, { id_solicitud: idSolicitud });

      await registrarAuditoriaSegura({
        usuario_id: usuarioSesion.idUsuario,
        tipo_accion: 'UPDATE',
        entidad_afectada: 'Solicitudes_Vacaciones',
        registro_id: idSolicitud,
        ip_origen: obtenerIPCliente(req),
        detalle_json: { nuevo_estado: 'Cancelada' }
      });

      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (url === '/api/jefatura/dashboard' && method === 'GET') {
      const usuarioJefatura = await validarTokenJefatura(req, res);
      if (!usuarioJefatura) return;

      const pendientesRes = await db.query(`
        SELECT COUNT(*) AS total
        FROM Solicitudes_Vacaciones
        WHERE Estado = 'Pendiente'
      `);

      const aprobadasRes = await db.query(`
        SELECT COUNT(*) AS total
        FROM Solicitudes_Vacaciones
        WHERE Estado = 'Aprobada'
      `);

      const rechazadasRes = await db.query(`
        SELECT COUNT(*) AS total
        FROM Solicitudes_Vacaciones
        WHERE Estado = 'Rechazada'
      `);

      const procesadasRes = await db.query(`
        SELECT COUNT(*) AS total
        FROM Solicitudes_Vacaciones
        WHERE Estado IN ('Aprobada', 'Rechazada')
      `);

      const equipoRes = await db.query(`
        SELECT COUNT(DISTINCT id_Personal) AS total
        FROM Solicitudes_Vacaciones
      `);

      const mesRes = await db.query(`
        SELECT COUNT(*) AS total
        FROM Solicitudes_Vacaciones
        WHERE MONTH(fecha_Creacion) = MONTH(GETDATE())
          AND YEAR(fecha_Creacion) = YEAR(GETDATE())
      `);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        metricas: {
          pendientes: pendientesRes[0]?.total || 0,
          aprobadas: aprobadasRes[0]?.total || 0,
          rechazadas: rechazadasRes[0]?.total || 0,
          procesadas: procesadasRes[0]?.total || 0,
          totalEquipo: equipoRes[0]?.total || 0,
          solicitudesMes: mesRes[0]?.total || 0
        }
      }));
      return;
    }

    if (url === '/api/jefatura/pendientes' && method === 'GET') {
      const usuarioJefatura = await validarTokenJefatura(req, res);
      if (!usuarioJefatura) return;

      const solicitudesPendientes = await db.query(`
        SELECT
          sv.id_Solicitud as id,
          CONVERT(varchar, sv.fecha_Inicio, 23) as inicio,
          CONVERT(varchar, sv.fecha_Fin, 23) as fin,
          sv.dias_Solicitados as dias,
          sv.Motivo as motivo,
          sv.Estado as estado,
          (ISNULL(p.Nombre, '') + ' ' + ISNULL(p.Apellido, '')) as colaborador
        FROM Solicitudes_Vacaciones sv
        INNER JOIN Personal p ON sv.id_Personal = p.id_Personal
        WHERE sv.Estado = 'Pendiente'
        ORDER BY sv.id_Solicitud DESC
      `);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        solicitudes: solicitudesPendientes
      }));
      return;
    }

    if (url === '/api/jefatura/historial' && method === 'GET') {
      const usuarioJefatura = await validarTokenJefatura(req, res);
      if (!usuarioJefatura) return;

      const historial = await db.query(`
        SELECT
          sv.id_Solicitud as id,
          CONVERT(varchar, sv.fecha_Inicio, 23) as inicio,
          CONVERT(varchar, sv.fecha_Fin, 23) as fin,
          sv.dias_Solicitados as dias,
          sv.Motivo as motivo,
          sv.Estado as estado,
          (ISNULL(p.Nombre, '') + ' ' + ISNULL(p.Apellido, '')) as colaborador
        FROM Solicitudes_Vacaciones sv
        INNER JOIN Personal p ON sv.id_Personal = p.id_Personal
        WHERE sv.Estado IN ('Aprobada', 'Rechazada')
        ORDER BY sv.id_Solicitud DESC
      `);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        solicitudes: historial
      }));
      return;
    }

    if (url === '/api/jefatura/calendario' && method === 'GET') {
      const usuarioJefatura = await validarTokenJefatura(req, res);
      if (!usuarioJefatura) return;

      const ausencias = await db.query(`
        SELECT
          sv.id_Solicitud as id,
          CONVERT(varchar, sv.fecha_Inicio, 23) as inicio,
          CONVERT(varchar, sv.fecha_Fin, 23) as fin,
          sv.dias_Solicitados as dias,
          sv.Motivo as motivo,
          sv.Estado as estado,
          (ISNULL(p.Nombre, '') + ' ' + ISNULL(p.Apellido, '')) as colaborador
        FROM Solicitudes_Vacaciones sv
        INNER JOIN Personal p ON sv.id_Personal = p.id_Personal
        WHERE sv.Estado IN ('Pendiente', 'Aprobada')
        ORDER BY sv.fecha_Inicio ASC
      `);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        ausencias
      }));
      return;
    }

    if (url === '/api/jefatura/conflictos' && method === 'GET') {
      const usuarioJefatura = await validarTokenJefatura(req, res);
      if (!usuarioJefatura) return;

      const conflictos = await db.query(`
        SELECT
          a.id_Solicitud AS id1,
          (ISNULL(pa.Nombre, '') + ' ' + ISNULL(pa.Apellido, '')) AS colaborador1,
          b.id_Solicitud AS id2,
          (ISNULL(pb.Nombre, '') + ' ' + ISNULL(pb.Apellido, '')) AS colaborador2,
          CONVERT(varchar,
            CASE WHEN a.fecha_Inicio > b.fecha_Inicio THEN a.fecha_Inicio ELSE b.fecha_Inicio END
          , 23) AS inicio_conflicto,
          CONVERT(varchar,
            CASE WHEN a.fecha_Fin < b.fecha_Fin THEN a.fecha_Fin ELSE b.fecha_Fin END
          , 23) AS fin_conflicto,
          'Traslape de fechas' AS tipo
        FROM Solicitudes_Vacaciones a
        INNER JOIN Solicitudes_Vacaciones b
          ON a.id_Solicitud < b.id_Solicitud
         AND a.id_Personal <> b.id_Personal
         AND a.Estado IN ('Pendiente', 'Aprobada')
         AND b.Estado IN ('Pendiente', 'Aprobada')
         AND a.fecha_Inicio <= b.fecha_Fin
         AND b.fecha_Inicio <= a.fecha_Fin
        INNER JOIN Personal pa ON a.id_Personal = pa.id_Personal
        INNER JOIN Personal pb ON b.id_Personal = pb.id_Personal
        ORDER BY inicio_conflicto ASC
      `);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        conflictos
      }));
      return;
    }

    if (url === '/api/jefatura/aprobar' && method === 'POST') {
      const usuarioJefatura = await validarTokenJefatura(req, res);
      if (!usuarioJefatura) return;

      const data = await getBody();

      if (!data.id) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          mensaje: 'El id de la solicitud es requerido.'
        }));
        return;
      }

      const solicitud = await db.query(`
        SELECT id_Solicitud, Estado
        FROM Solicitudes_Vacaciones
        WHERE id_Solicitud = @id_solicitud
      `, { id_solicitud: Number(data.id) });

      if (!solicitud || solicitud.length === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({
          success: false,
          mensaje: 'La solicitud no existe.'
        }));
        return;
      }

      if (solicitud[0].Estado !== 'Pendiente') {
        res.writeHead(409);
        res.end(JSON.stringify({
          success: false,
          mensaje: 'La solicitud ya fue procesada o no está pendiente.'
        }));
        return;
      }

      await db.query(`
        UPDATE Solicitudes_Vacaciones
        SET Estado = 'Aprobada'
        WHERE id_Solicitud = @id_solicitud
      `, { id_solicitud: Number(data.id) });

      await registrarAuditoriaSegura({
        usuario_id: usuarioJefatura.idUsuario,
        tipo_accion: 'APPROVE',
        entidad_afectada: 'Solicitudes_Vacaciones',
        registro_id: Number(data.id),
        ip_origen: obtenerIPCliente(req),
        detalle_json: { nuevo_estado: 'Aprobada' }
      });

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        mensaje: 'Solicitud aprobada correctamente.'
      }));
      return;
    }

    if (url === '/api/jefatura/rechazar' && method === 'POST') {
      const usuarioJefatura = await validarTokenJefatura(req, res);
      if (!usuarioJefatura) return;

      const data = await getBody();

      if (!data.id) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          mensaje: 'El id de la solicitud es requerido.'
        }));
        return;
      }

      const solicitud = await db.query(`
        SELECT id_Solicitud, Estado, dias_Solicitados, id_Personal
        FROM Solicitudes_Vacaciones
        WHERE id_Solicitud = @id_solicitud
      `, { id_solicitud: Number(data.id) });

      if (!solicitud || solicitud.length === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({
          success: false,
          mensaje: 'La solicitud no existe.'
        }));
        return;
      }

      if (solicitud[0].Estado !== 'Pendiente') {
        res.writeHead(409);
        res.end(JSON.stringify({
          success: false,
          mensaje: 'La solicitud ya fue procesada o no está pendiente.'
        }));
        return;
      }

      const diasADevolver = Number(solicitud[0].dias_Solicitados || 0);
      const idPersonal = Number(solicitud[0].id_Personal);

      await db.query(`
        UPDATE Saldos_Vacacionales
        SET saldo_Disponible = saldo_Disponible + @dias
        WHERE id_Personal = @id_personal
      `, { dias: diasADevolver, id_personal: idPersonal });

      await db.query(`
        INSERT INTO Movimientos_Saldo (id_Personal, Tipo_Movimiento, Dias, Motivo)
        VALUES (@id_personal, 'Suma', @dias, 'Reembolso por rechazo de solicitud de vacaciones')
      `, { id_personal: idPersonal, dias: diasADevolver });

      await db.query(`
        UPDATE Solicitudes_Vacaciones
        SET Estado = 'Rechazada'
        WHERE id_Solicitud = @id_solicitud
      `, { id_solicitud: Number(data.id) });

      await registrarAuditoriaSegura({
        usuario_id: usuarioJefatura.idUsuario,
        tipo_accion: 'REJECT',
        entidad_afectada: 'Solicitudes_Vacaciones',
        registro_id: Number(data.id),
        ip_origen: obtenerIPCliente(req),
        detalle_json: { nuevo_estado: 'Rechazada' }
      });

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        mensaje: 'Solicitud rechazada correctamente.'
      }));
      return;
    }

    if (url === '/api/validar-sesion' && method === 'GET') {
      const token = req.headers['authorization']?.replace('Bearer ', '');

      if (!token) {
        res.writeHead(401);
        res.end(JSON.stringify({
          valida: false,
          mensaje: 'Token requerido'
        }));
        return;
      }

      const resultado = await auth.validarSesion(token);

      if (!resultado.valida) {
        res.writeHead(401);
        res.end(JSON.stringify(resultado));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify(resultado));
      return;
    }

    if (url === '/api/login' && method === 'POST') {
      const data = await getBody();

      if (!data.username || !data.password) {
        res.writeHead(400);
        res.end(JSON.stringify({
          exito: false,
          mensaje: 'Usuario y contraseña son requeridos'
        }));
        return;
      }

      const validacion = await auth.validarCredenciales(data.username, data.password);
      const ipCliente = obtenerIPCliente(req);

      if (!validacion.valido) {
        await auth.registrarIntento(null, 'fallido', validacion.codigo, ipCliente);

        await registrarAuditoriaSegura({
          usuario_id: validacion.usuario?.id_Usuario || 0,
          tipo_accion: 'LOGIN',
          entidad_afectada: 'Sesiones',
          registro_id: data.username || 'desconocido',
          ip_origen: ipCliente,
          detalle_json: { resultado: 'fallido', codigo: validacion.codigo }
        });

        res.writeHead(401);
        res.end(JSON.stringify({
          exito: false,
          mensaje: validacion.mensaje,
          codigo: validacion.codigo
        }));
        return;
      }

      await auth.registrarIntento(validacion.usuario.id_Usuario, 'exitoso', 'Login exitoso', ipCliente);

      const sesion = await auth.crearSesion(validacion.usuario.id_Usuario);

      await registrarAuditoriaSegura({
        usuario_id: validacion.usuario.id_Usuario,
        tipo_accion: 'LOGIN',
        entidad_afectada: 'Sesiones',
        registro_id: (sesion.token || '').substring(0, 24),
        ip_origen: ipCliente,
        detalle_json: { resultado: 'exitoso' }
      });

      res.writeHead(200);
      res.end(JSON.stringify({
        exito: true,
        mensaje: validacion.mensaje,
        token: sesion.token,
        usuario: validacion.usuario,
        expiracion: sesion.expiracion
      }));
      return;
    }

    if (url === '/api/logout' && method === 'POST') {
      const data = await getBody();
      const token = data.token || req.headers['authorization']?.replace('Bearer ', '');

      if (!token) {
        res.writeHead(400);
        res.end(JSON.stringify({
          exito: false,
          mensaje: 'Token de sesión requerido'
        }));
        return;
      }

      const sesionActiva = await auth.validarSesion(token);
      const resultado = await auth.cerrarSesion(token);

      if (resultado.exito && sesionActiva.valida) {
        await registrarAuditoriaSegura({
          usuario_id: sesionActiva.usuario.id_Usuario,
          tipo_accion: 'LOGOUT',
          entidad_afectada: 'Sesiones',
          registro_id: token.substring(0, 24),
          ip_origen: obtenerIPCliente(req),
          detalle_json: { resultado: 'cerrada' }
        });
      }

      res.writeHead(200);
      res.end(JSON.stringify(resultado));
      return;
    }

    if (url === '/api/auditoria/acciones' && method === 'GET') {
      const usuarioSesion = await obtenerUsuarioAutenticado(req, res);
      if (!usuarioSesion) return;

      const roles = await db.query(
        `SELECT r.Nombre as Rol
         FROM Usuarios u
         JOIN Nombramientos n ON u.id_Personal = n.id_Personal
         JOIN Roles r ON n.id_Rol = r.id_Rol
         WHERE u.id_Usuario = @id_usuario`,
        { id_usuario: usuarioSesion.idUsuario }
      );

      const puedeVerAuditoria = (roles || []).some(r => {
        const rol = (r.Rol || '').toLowerCase();
        return rol.includes('admin') || rol.includes('rrhh') || rol.includes('patrocinador') || rol.includes('jefatura');
      });

      if (!puedeVerAuditoria) {
        res.writeHead(403);
        res.end(JSON.stringify({ exito: false, mensaje: 'No tiene permisos para consultar auditoría de acciones' }));
        return;
      }

      const params = new URL(req.url, 'http://localhost').searchParams;
      const filtros = {
        fechaDesde: params.get('fechaDesde') || undefined,
        fechaHasta: params.get('fechaHasta') || undefined,
        usuario_id: params.get('usuario_id') || undefined,
        tipo_accion: params.get('tipo_accion') || undefined,
        entidad_afectada: params.get('entidad_afectada') || undefined,
        page: parseInt(params.get('page')) || 1,
        limit: parseInt(params.get('limit')) || 50
      };

      const resultado = await audit.consultarEventos(filtros);

      res.writeHead(200);
      res.end(JSON.stringify({ exito: true, ...resultado }));
      return;
    }

    if (url === '/api/auditoria/metricas' && method === 'GET') {
      const usuarioSesion = await obtenerUsuarioAutenticado(req, res);
      if (!usuarioSesion) return;

      const roles = await db.query(
        `SELECT r.Nombre as Rol
         FROM Usuarios u
         JOIN Nombramientos n ON u.id_Personal = n.id_Personal
         JOIN Roles r ON n.id_Rol = r.id_Rol
         WHERE u.id_Usuario = @id_usuario`,
        { id_usuario: usuarioSesion.idUsuario }
      );

      const puedeVer = (roles || []).some(r => {
        const rol = (r.Rol || '').toLowerCase();
        return rol.includes('admin') || rol.includes('rrhh') || rol.includes('patrocinador') || rol.includes('jefatura');
      });

      if (!puedeVer) {
        res.writeHead(403);
        res.end(JSON.stringify({ exito: false, mensaje: 'No tiene permisos para ver métricas de auditoría' }));
        return;
      }

      const metricas = await audit.getMetricas();

      res.writeHead(200);
      res.end(JSON.stringify({ exito: true, metricas }));
      return;
    }

    if (url === '/api/solicitar-recuperacion' && method === 'POST') {
      const data = await getBody();

      if (!data.identificador) {
        res.writeHead(400);
        res.end(JSON.stringify({
          exito: false,
          mensaje: 'Correo o usuario es requerido'
        }));
        return;
      }

      const usuario = await auth.buscarUsuarioPorCorreoOUsername(data.identificador);

      if (!usuario || usuario.Estado !== 'Activo') {
        res.writeHead(200);
        res.end(JSON.stringify({
          exito: true,
          mensaje: 'Si los datos son correctos, recibirá un correo con las instrucciones.'
        }));
        return;
      }

      try {
        const tokenRecuperacion = await auth.generarTokenRecuperacion(usuario.id_Usuario);

        await mailer.enviarRecuperacionPassword(
          usuario.Correo,
          usuario.Nombre,
          tokenRecuperacion.token,
          auth.CONFIG.DURACION_TOKEN_RECUPERACION_MINUTOS
        );

        await registrarAuditoriaSegura({
          usuario_id: usuario.id_Usuario,
          tipo_accion: 'UPDATE',
          entidad_afectada: 'Recuperacion_Password',
          registro_id: tokenRecuperacion.token.substring(0, 24),
          ip_origen: obtenerIPCliente(req),
          detalle_json: { correo: usuario.Correo, resultado: 'enviado' }
        });

        const devReturn = {
          exito: true,
          mensaje: 'Enlace de recuperación enviado exitosamente.'
        };

        if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_USER) {
          devReturn.token = tokenRecuperacion.token;
          devReturn.mensaje = '✅ [DESARROLLO] Token: ' + tokenRecuperacion.token.substring(0, 10) + '...';
        }

        res.writeHead(200);
        res.end(JSON.stringify(devReturn));
      } catch (error) {
        console.error('Error en recuperación:', error);
        res.writeHead(500);
        res.end(JSON.stringify({
          exito: false,
          mensaje: 'Error al procesar la solicitud'
        }));
      }
      return;
    }

    if (url === '/api/cambiar-password' && method === 'POST') {
      const data = await getBody();

      if (!data.token || !data.nueva_password || !data.confirmar_password) {
        res.writeHead(400);
        res.end(JSON.stringify({
          exito: false,
          mensaje: 'Datos incompletos'
        }));
        return;
      }

      if (data.nueva_password !== data.confirmar_password) {
        res.writeHead(400);
        res.end(JSON.stringify({
          exito: false,
          mensaje: 'Las contraseñas no coinciden.'
        }));
        return;
      }

      const validaciones = [];
      if (data.nueva_password.length < 8) validaciones.push('Mínimo 8 caracteres');
      if (!/[a-z]/.test(data.nueva_password)) validaciones.push('Letras minúsculas');
      if (!/[A-Z]/.test(data.nueva_password)) validaciones.push('Letras mayúsculas');
      if (!/[0-9]/.test(data.nueva_password)) validaciones.push('Números');
      if (!/[!@#$%^&*()_+\-=\[\]{};:'",.<>?]/.test(data.nueva_password)) validaciones.push('Caracteres especiales');

      if (validaciones.length > 0) {
        res.writeHead(400);
        res.end(JSON.stringify({
          exito: false,
          mensaje: 'La contraseña no cumple con la política de seguridad: ' + validaciones.join(', ')
        }));
        return;
      }

      const resultado = await auth.cambiarPasswordConToken(data.token, data.nueva_password);

      if (resultado.exito) {
        await registrarAuditoriaSegura({
          usuario_id: resultado.id_Usuario || 0,
          tipo_accion: 'UPDATE',
          entidad_afectada: 'Usuarios',
          registro_id: String(resultado.id_Usuario || '0'),
          ip_origen: obtenerIPCliente(req),
          detalle_json: { accion: 'cambio_password', resultado: 'exitoso' }
        });
      }

      res.writeHead(resultado.exito ? 200 : 400);
      res.end(JSON.stringify(resultado));
      return;
    }

    if (url === '/api/auditar/intentos-acceso' && method === 'GET') {
      try {
        const usuarioSesion = await obtenerUsuarioAutenticado(req, res);
        if (!usuarioSesion) return;

        const roles = await db.query(
          `SELECT r.Nombre as Rol
           FROM Usuarios u
           JOIN Nombramientos n ON u.id_Personal = n.id_Personal
           JOIN Roles r ON n.id_Rol = r.id_Rol
           WHERE u.id_Usuario = @id_usuario`,
          { id_usuario: usuarioSesion.idUsuario }
        );

        const puedeVer = (roles || []).some(r => {
          const rol = (r.Rol || '').toLowerCase();
          return rol.includes('admin') || rol.includes('rrhh') || rol.includes('patrocinador') || rol.includes('jefatura');
        });

        if (!puedeVer) {
          res.writeHead(403);
          res.end(JSON.stringify({ exito: false, mensaje: 'No tiene permisos para consultar intentos de acceso' }));
          return;
        }

        const params = new URL(req.url, 'http://localhost').searchParams;
        const limit = parseInt(params.get('limit')) || 100;
        const offset = (parseInt(params.get('page') || '1') - 1) * limit;

        const intentos = await db.query(
          `SELECT ia.id_Intento, ia.id_Usuario, CONVERT(varchar, ia.Fecha_Intento, 120) as Fecha_Intento,
                  ia.Resultado, ia.Razon_Fallo, ia.IP_Cliente,
                  ISNULL(p.Nombre, '') + ' ' + ISNULL(p.Apellido, '') as nombre_usuario
           FROM Intentos_Acceso ia
           LEFT JOIN Usuarios u ON ia.id_Usuario = u.id_Usuario
           LEFT JOIN Personal p ON u.id_Personal = p.id_Personal
           ORDER BY ia.Fecha_Intento DESC
           OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`
        );

        res.writeHead(200);
        res.end(JSON.stringify({
          exito: true,
          total: intentos.length,
          page: parseInt(params.get('page') || '1'),
          intentos
        }));
        return;
      } catch (error) {
        console.error('Error en auditoría:', error);
        res.writeHead(500);
        res.end(JSON.stringify({
          exito: false,
          mensaje: 'Error al obtener intentos de acceso'
        }));
        return;
      }
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
  } catch (error) {
    console.error('Error en API:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Error interno del servidor' }));
  }
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (url.startsWith('/api/')) {
    await manejarAPI(req, res);
    return;
  }

  const filePath = url === '/' ? '/login.html' : url;
  const fullPath = path.join(__dirname, 'public', filePath);
  servirArchivo(req, res, fullPath);
});

async function iniciarServidor() {
  await db.probarConexion();

  const ACTIVE_PORT = process.env.PORT || 3002;
  server.listen(ACTIVE_PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║   Servidor iniciado                                ║
║   http://localhost:${ACTIVE_PORT}                   ║
║                                                    ║
║   📌 Autenticación                                 ║
║      POST   /api/login                             ║
║      POST   /api/logout                            ║
║      GET    /api/validar-sesion                    ║
║                                                    ║
║   📅 Colaborador                                   ║
║      GET    /api/dashboard                         ║
║      POST   /api/solicitudes                       ║
║      POST   /api/cancelar                          ║
║                                                    ║
║   ✅ Jefatura                                      ║
║      GET    /api/jefatura/dashboard                ║
║      GET    /api/jefatura/pendientes               ║
║      GET    /api/jefatura/historial                ║
║      GET    /api/jefatura/calendario               ║
║      GET    /api/jefatura/conflictos               ║
║      POST   /api/jefatura/aprobar                  ║
║      POST   /api/jefatura/rechazar                 ║
╚════════════════════════════════════════════════════╝
    `);
  });
}

process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor...');
  await db.cerrarConexion();
  server.close(() => {
    console.log('Servidor detenido');
    process.exit(0);
  });
});

iniciarServidor();