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

// Función auxiliar para obtener la IP del cliente
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
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
      const usuarios = await db.query('SELECT TOP 100 * FROM usuarios');
      res.writeHead(200);
      res.end(JSON.stringify(usuarios));
      return;
    }

    // --- NUEVAS RUTAS PARA EL MÓDULO COLABORADOR (PRODUCCIÓN SQL) ---
    const getBody = () => new Promise(resolve => { let b=''; req.on('data', c=>b+=c); req.on('end', ()=>resolve(JSON.parse(b||'{}'))); });

    if (url === '/api/dashboard' && method === 'GET') {
      // 1: Carga datos biológicos y saldo Consolidado
      const userRes = await db.query(`SELECT p.Nombre, p.Apellido, s.saldo_Disponible as saldo_vacaciones FROM Personal p JOIN Saldos_Vacacionales s ON p.id_Personal = s.id_Personal WHERE p.id_Personal = 1`);
      const usuario = userRes[0] || { saldo_vacaciones: 15 };
      
      // 1.5: Carga Nombramientos (Magia Multipuesto)
      const nombRes = await db.query(`SELECT r.Nombre as Rol, c.Nombre as Carrera, n.Tipo_Nombramiento as Tipo, n.Fraccion_Tiempo FROM Nombramientos n LEFT JOIN Roles r ON n.id_Rol = r.id_Rol LEFT JOIN Carreras c ON n.id_Carrera = c.id_Carrera WHERE n.id_Personal = 1`);
      usuario.nombramientos = nombRes;
      
      // 2: Carga sus solicitudes conjugadas al humano
      const solicitudes = await db.query("SELECT id_Solicitud as id, CONVERT(varchar, fecha_Inicio, 23) as inicio, CONVERT(varchar, fecha_Fin, 23) as fin, dias_Solicitados as dias, Motivo as motivo, Estado as estado FROM Solicitudes_Vacaciones WHERE id_Personal = 1");
      // 3: Carga feriados institucionales reales
      const feriados = await db.query("SELECT CONVERT(varchar, fecha, 23) as fecha, descripcion FROM Feriados");

      res.writeHead(200);
      res.end(JSON.stringify({ 
        usuario: usuario, 
        vacacionesProgramadas: solicitudes,
        feriados: feriados.map(f => f.fecha)
      }));
      return;
    }

    if (url === '/api/solicitudes' && method === 'POST') {
      const data = await getBody();
      
      // 1. Inserta la solicitud real en la BD usando la estructura correcta
      await db.query(`INSERT INTO Solicitudes_Vacaciones (id_Personal, fecha_Inicio, fecha_Fin, dias_Solicitados, Motivo, Estado) VALUES (1, '${data.fInicio}', '${data.fFin}', ${data.dias}, '${data.motivo || 'Vacaciones'}', 'Pendiente')`);
      
      // 2. Bloquear Saldo (Restar cantidad cobrada)
      await db.query(`UPDATE Saldos_Vacacionales SET saldo_Disponible = saldo_Disponible - ${data.dias} WHERE id_Personal = 1`);
      
      // 3. Registrar Movimiento (Kardex Contable Temporal)
      await db.query(`INSERT INTO Movimientos_Saldo (id_Personal, Tipo_Movimiento, Dias, Motivo) VALUES (1, 'Resta', ${data.dias}, 'Cobro automático por Solicitud de Vacaciones')`);
      
      res.writeHead(200); res.end(JSON.stringify({ success: true }));
      return;
    }

    if (url === '/api/cancelar' && method === 'POST') {
      const data = await getBody();
      
      // 1. Obtener la cantidad de días cobrados en la solicitud original
      const reqInfo = await db.query(`SELECT dias_Solicitados FROM Solicitudes_Vacaciones WHERE id_Solicitud = ${data.id}`);
      if(reqInfo && reqInfo.length > 0) {
        const diasADevolver = reqInfo[0].dias_Solicitados;
        
        // 2. Reembolsar Saldo Oficial
        await db.query(`UPDATE Saldos_Vacacionales SET saldo_Disponible = saldo_Disponible + ${diasADevolver} WHERE id_Personal = 1`);
        
        // 3. Registrar Movimiento (Reembolso)
        await db.query(`INSERT INTO Movimientos_Saldo (id_Personal, Tipo_Movimiento, Dias, Motivo) VALUES (1, 'Suma', ${diasADevolver}, 'Reembolso por Anulación de Solicitud de Vacaciones')`);
      }
      
      // 4. Cancela la solicitud en la BD (Update estado)
      await db.query(`UPDATE Solicitudes_Vacaciones SET Estado = 'Cancelada' WHERE id_Solicitud = ${data.id}`);
      
      res.writeHead(200); res.end(JSON.stringify({ success: true }));
      return;
    }

        // ===== MÓDULO JEFATURA / APROBACIÓN =====

    // GET: Bandeja de solicitudes pendientes
    if (url === '/api/jefatura/pendientes' && method === 'GET') {
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

    // GET: Historial de solicitudes procesadas
    if (url === '/api/jefatura/historial' && method === 'GET') {
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

    // POST: Aprobar solicitud
    if (url === '/api/jefatura/aprobar' && method === 'POST') {
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

    // POST: Rechazar solicitud
    if (url === '/api/jefatura/rechazar' && method === 'POST') {
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

      // Devolver el saldo porque la solicitud fue rechazada
      await db.query(`
        UPDATE Saldos_Vacacionales
        SET saldo_Disponible = saldo_Disponible + ${diasADevolver}
        WHERE id_Personal = ${idPersonal}
      `);

      // Registrar el movimiento de devolución
      await db.query(`
        INSERT INTO Movimientos_Saldo (id_Personal, Tipo_Movimiento, Dias, Motivo)
        VALUES (${idPersonal}, 'Suma', ${diasADevolver}, 'Reembolso por rechazo de solicitud de vacaciones')
      `);

      // Cambiar el estado de la solicitud
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

    // ===== MÓDULO DE AUTENTICACIÓN =====

    // HU 1: POST /api/login - Validar credenciales y crear sesión
    if (url === '/api/login' && method === 'POST') {
      const data = await getBody();
      
      // Validar entrada
      if (!data.username || !data.password) {
        res.writeHead(400);
        res.end(JSON.stringify({
          exito: false,
          mensaje: 'Usuario y contraseña son requeridos'
        }));
        return;
      }

      // Validar credenciales con auth.js
      const validacion = await auth.validarCredenciales(data.username, data.password);
      const ipCliente = obtenerIPCliente(req);
      
      if (!validacion.valido) {
        // Registrar intento fallido con IP
        await auth.registrarIntento(null, 'fallido', validacion.codigo, ipCliente);
        
        res.writeHead(401);
        res.end(JSON.stringify({
          exito: false,
          mensaje: validacion.mensaje,
          codigo: validacion.codigo
        }));
        return;
      }

      // Registrar intento exitoso con IP (ya se registró en validarCredenciales pero sin IP)
      await auth.registrarIntento(validacion.usuario.id_Usuario, 'exitoso', 'Login exitoso', ipCliente);
      
      // Crear sesión
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

    // HU 2: POST /api/logout - Cerrar sesión
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

    // HU 4 PASO 1: POST /api/solicitar-recuperacion - Generar token y enviar email
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

      // Buscar usuario
      const usuario = await auth.buscarUsuarioPorCorreoOUsername(data.identificador);
      
      if (!usuario) {
        // NO revelamos si existe o no el usuario por seguridad
        res.writeHead(200);
        res.end(JSON.stringify({
          exito: true,
          mensaje: 'Si los datos son correctos, recibirá un correo con las instrucciones.'
        }));
        return;
      }

      // Verificar que esté activo
      if (usuario.Estado !== 'Activo') {
        res.writeHead(200);
        res.end(JSON.stringify({
          exito: true,
          mensaje: 'Si los datos son correctos, recibirá un correo con las instrucciones.'
        }));
        return;
      }

      try {
        // Generar token de recuperación
        const tokenRecuperacion = await auth.generarTokenRecuperacion(usuario.id_Usuario);
        
        // Enviar email
        const emailResult = await mailer.enviarRecuperacionPassword(
          usuario.Correo,
          usuario.Nombre,
          tokenRecuperacion.token,
          auth.CONFIG.DURACION_TOKEN_RECUPERACION_MINUTOS
        );

        // En desarrollo: devolver token para testing
        // En producción: NO devolver token (solo enviar por email)
        const devReturn = {
          exito: true,
          mensaje: 'Enlace de recuperación enviado exitosamente.'
        };

        if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_USER) {
          // Modo desarrollo: incluir token para testing
          devReturn.token = tokenRecuperacion.token;
          devReturn.mensaje = '✅ [DESARROLLO] Token: ' + tokenRecuperacion.token.substring(0, 10) + '... (revisa consola o correo)';
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

    // HU 4 PASO 2: POST /api/cambiar-password - Cambiar contraseña con token
    if (url === '/api/cambiar-password' && method === 'POST') {
      const data = await getBody();
      
      // Validaciones
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

      // Validar fortaleza de contraseña (mismo cliente-side pero también validamos server-side)
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

      if (data.nueva_password.length < 6) {
        res.writeHead(400);
        res.end(JSON.stringify({
          exito: false,
          mensaje: 'La contraseña debe tener al menos 6 caracteres.'
        }));
        return;
      }

      // Cambiar contraseña
      const resultado = await auth.cambiarPasswordConToken(data.token, data.nueva_password);
      
      if (resultado.exito) {
        // Obtener información del usuario para enviar confirmación
        try {
          const sesiones = await db.query(
            `SELECT p.Nombre, p.Correo FROM Usuarios u
             JOIN Personal p ON u.id_Personal = p.id_Personal
             WHERE u.id_Usuario = (
               SELECT id_Usuario FROM Recuperacion_Password WHERE Token = @token
             )`,
            { token: data.token }
          );
          
          if (sesiones && sesiones.length > 0) {
            await mailer.enviarConfirmacionCambioPassword(
              sesiones[0].Correo,
              sesiones[0].Nombre
            );
          }
        } catch (err) {
          console.error('Error enviando confirmación:', err);
        }
      }

      res.writeHead(resultado.exito ? 200 : 400);
      res.end(JSON.stringify(resultado));
      return;
    }

    // HU 3: GET /api/auditar/intentos-acceso - Obtener intentos de acceso (Auditoría)
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

        // Validar sesión
        const validacion = await auth.validarSesion(token);
        if (!validacion.valida) {
          res.writeHead(401);
          res.end(JSON.stringify({
            exito: false,
            mensaje: 'Sesión no válida o expirada'
          }));
          return;
        }

        // Obtener intentos de acceso
        const intentos = await db.query(
          `SELECT TOP 100 
            id_Intento, id_Usuario, Fecha_Intento, Resultado, Razon_Fallo, IP_Cliente
           FROM Intentos_Acceso
           ORDER BY Fecha_Intento DESC`
        );

        res.writeHead(200);
        res.end(JSON.stringify({
          exito: true,
          total: intentos.length,
          intentos: intentos
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

  let filePath = url === '/' ? '/index.html' : url;
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
║   Rutas de API disponibles:                        ║
║   📌 Autenticación:                                ║
║      POST   /api/login                      (HU-1) ║
║      POST   /api/logout                     (HU-2) ║
║      POST   /api/solicitar-recuperacion     (HU-4) ║
║      POST   /api/cambiar-password           (HU-4) ║
║                                                    ║
║   📅 Colaborador:                                  ║
║      GET    /api/dashboard                        ║
║      POST   /api/solicitudes                      ║
║      POST   /api/cancelar                         ║
║                                                    ║
║   🔍 Testing:                                      ║
║      GET    /api/test                             ║
║      GET    /api/usuarios                         ║
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