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