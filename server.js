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

const PORT = process.env.PORT || 3001;

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
    req.on('end', () => resolve(JSON.parse(b || '{}')));
  });

  async function validarTokenJefatura(req, res) {
    const token = req.headers['authorization']?.replace('Bearer ', '');

    if (!token) {
      res.writeHead(401);
      res.end(JSON.stringify({ success: false, mensaje: 'Token requerido' }));
      return false;
    }

    const sesion = await auth.validarSesion(token);

    if (!sesion.valida) {
      res.writeHead(401);
      res.end(JSON.stringify({ success: false, mensaje: 'Sesión inválida o expirada' }));
      return false;
    }

    const usuarioInfo = sesion.usuario || sesion.datos || {};
    const idUsuario = usuarioInfo.id_Usuario || usuarioInfo.idUsuario || usuarioInfo.id;

    if (!idUsuario) {
      res.writeHead(401);
      res.end(JSON.stringify({ success: false, mensaje: 'No se pudo identificar al usuario de la sesión' }));
      return false;
    }

    const roles = await db.query(`
      SELECT r.Nombre as Rol
      FROM Usuarios u
      JOIN Nombramientos n ON u.id_Personal = n.id_Personal
      JOIN Roles r ON n.id_Rol = r.id_Rol
      WHERE u.id_Usuario = ${Number(idUsuario)}
    `);

    const esJefatura = roles && roles.some(r =>
      (r.Rol || '').toLowerCase().includes('jefatura')
    );

    if (!esJefatura) {
      res.writeHead(403);
      res.end(JSON.stringify({ success: false, mensaje: 'No tiene permisos de jefatura' }));
      return false;
    }

    return true;
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
      const userRes = await db.query(`
        SELECT p.Nombre, p.Apellido, s.saldo_Disponible as saldo_vacaciones
        FROM Personal p
        JOIN Saldos_Vacacionales s ON p.id_Personal = s.id_Personal
        WHERE p.id_Personal = 1
      `);

      const usuario = userRes[0] || { saldo_vacaciones: 15 };

      const nombRes = await db.query(`
        SELECT r.Nombre as Rol, c.Nombre as Carrera, n.Tipo_Nombramiento as Tipo, n.Fraccion_Tiempo
        FROM Nombramientos n
        LEFT JOIN Roles r ON n.id_Rol = r.id_Rol
        LEFT JOIN Carreras c ON n.id_Carrera = c.id_Carrera
        WHERE n.id_Personal = 1
      `);

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
        WHERE id_Personal = 1
      `);

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
      const data = await getBody();

      await db.query(`
        INSERT INTO Solicitudes_Vacaciones
        (id_Personal, fecha_Inicio, fecha_Fin, dias_Solicitados, Motivo, Estado)
        VALUES
        (1, '${data.fInicio}', '${data.fFin}', ${data.dias}, '${data.motivo || 'Vacaciones'}', 'Pendiente')
      `);

      await db.query(`
        UPDATE Saldos_Vacacionales
        SET saldo_Disponible = saldo_Disponible - ${data.dias}
        WHERE id_Personal = 1
      `);

      await db.query(`
        INSERT INTO Movimientos_Saldo (id_Personal, Tipo_Movimiento, Dias, Motivo)
        VALUES (1, 'Resta', ${data.dias}, 'Cobro automático por Solicitud de Vacaciones')
      `);

      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (url === '/api/cancelar' && method === 'POST') {
      const data = await getBody();

      const reqInfo = await db.query(`
        SELECT dias_Solicitados
        FROM Solicitudes_Vacaciones
        WHERE id_Solicitud = ${data.id}
      `);

      if (reqInfo && reqInfo.length > 0) {
        const diasADevolver = reqInfo[0].dias_Solicitados;

        await db.query(`
          UPDATE Saldos_Vacacionales
          SET saldo_Disponible = saldo_Disponible + ${diasADevolver}
          WHERE id_Personal = 1
        `);

        await db.query(`
          INSERT INTO Movimientos_Saldo (id_Personal, Tipo_Movimiento, Dias, Motivo)
          VALUES (1, 'Suma', ${diasADevolver}, 'Reembolso por Anulación de Solicitud de Vacaciones')
        `);
      }

      await db.query(`
        UPDATE Solicitudes_Vacaciones
        SET Estado = 'Cancelada'
        WHERE id_Solicitud = ${data.id}
      `);

      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (url === '/api/jefatura/dashboard' && method === 'GET') {
      if (!(await validarTokenJefatura(req, res))) return;

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
      if (!(await validarTokenJefatura(req, res))) return;

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
      if (!(await validarTokenJefatura(req, res))) return;

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
      if (!(await validarTokenJefatura(req, res))) return;

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
      if (!(await validarTokenJefatura(req, res))) return;

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
      if (!(await validarTokenJefatura(req, res))) return;

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
        WHERE id_Solicitud = ${Number(data.id)}
      `);

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
        WHERE id_Solicitud = ${Number(data.id)}
      `);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        mensaje: 'Solicitud aprobada correctamente.'
      }));
      return;
    }

    if (url === '/api/jefatura/rechazar' && method === 'POST') {
      if (!(await validarTokenJefatura(req, res))) return;

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
        WHERE id_Solicitud = ${Number(data.id)}
      `);

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
        SET saldo_Disponible = saldo_Disponible + ${diasADevolver}
        WHERE id_Personal = ${idPersonal}
      `);

      await db.query(`
        INSERT INTO Movimientos_Saldo (id_Personal, Tipo_Movimiento, Dias, Motivo)
        VALUES (${idPersonal}, 'Suma', ${diasADevolver}, 'Reembolso por rechazo de solicitud de vacaciones')
      `);

      await db.query(`
        UPDATE Solicitudes_Vacaciones
        SET Estado = 'Rechazada'
        WHERE id_Solicitud = ${Number(data.id)}
      `);

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

      const resultado = await auth.cerrarSesion(token);

      res.writeHead(200);
      res.end(JSON.stringify(resultado));
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

      res.writeHead(resultado.exito ? 200 : 400);
      res.end(JSON.stringify(resultado));
      return;
    }

    if (url === '/api/auditar/intentos-acceso' && method === 'GET') {
      try {
        const token = req.headers['authorization']?.replace('Bearer ', '') ||
          new URL(`http://localhost${req.url}`, 'http://localhost').searchParams.get('token');

        if (!token) {
          res.writeHead(401);
          res.end(JSON.stringify({
            exito: false,
            mensaje: 'Token de sesión requerido para acceder a auditoría'
          }));
          return;
        }

        const validacion = await auth.validarSesion(token);

        if (!validacion.valida) {
          res.writeHead(401);
          res.end(JSON.stringify({
            exito: false,
            mensaje: 'Sesión no válida o expirada'
          }));
          return;
        }

        const intentos = await db.query(`
          SELECT TOP 100
            id_Intento, id_Usuario, Fecha_Intento, Resultado, Razon_Fallo, IP_Cliente
          FROM Intentos_Acceso
          ORDER BY Fecha_Intento DESC
        `);

        res.writeHead(200);
        res.end(JSON.stringify({
          exito: true,
          total: intentos.length,
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

  const filePath = url === '/' ? '/index.html' : url;
  const fullPath = path.join(__dirname, 'public', filePath);
  servirArchivo(req, res, fullPath);
});

async function iniciarServidor() {
  await db.probarConexion();

  server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║   Servidor iniciado                                ║
║   http://localhost:${PORT}                          ║
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