/**
 * Servidor Web con Node.js + MySQL
 * Proyecto Universidad
 */

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const PORT = process.env.PORT || 3000;

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
      const usuarios = await db.query('SELECT * FROM usuarios LIMIT 100');
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
╔═══════════════════════════════════════════╗
║   Servidor iniciado                        ║
║   http://localhost:${PORT}                  ║
║                                            ║
║   Rutas de API disponibles:                ║
║   - GET  /api/test                         ║
║   - GET  /api/usuarios                     ║
╚═══════════════════════════════════════════╝
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