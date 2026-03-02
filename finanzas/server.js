/**
 * server.js — Servidor local para Finanzas PWA
 * 
 * Uso:
 *   node server.js
 *   node server.js --port 8080
 * 
 * Endpoints:
 *   GET  /api/data        → devuelve finanzas-data.json
 *   POST /api/data        → reemplaza finanzas-data.json con el body JSON
 *   GET  /api/status      → { ok: true, version, dataFile }
 */

const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const url      = require('url');

// ── Configuración ──────────────────────────────────────────────────────────────
const PORT      = process.argv.includes('--port')
  ? parseInt(process.argv[process.argv.indexOf('--port') + 1])
  : 3000;
const ROOT      = __dirname;
const DATA_FILE = path.join(ROOT, 'finanzas-data.json');
const VERSION   = '1.0.0';

// ── MIME types ────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// ── CORS headers ──────────────────────────────────────────────────────────────
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Leer body JSON ────────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end',  () => {
      try { resolve(JSON.parse(body)); }
      catch(e) { reject(new Error('JSON inválido: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

// ── Servidor ──────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url);
  const pathname = parsed.pathname;

  setCORS(res);

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── API ────────────────────────────────────────────────────────────────────
  if (pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok:       true,
      version:  VERSION,
      dataFile: DATA_FILE,
      dataExists: fs.existsSync(DATA_FILE),
    }));
    return;
  }

  if (pathname === '/api/data') {

    if (req.method === 'GET') {
      if (!fs.existsSync(DATA_FILE)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'finanzas-data.json no encontrado' }));
        return;
      }
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(data);
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await readBody(req);

        // Backup automático antes de sobreescribir
        if (fs.existsSync(DATA_FILE)) {
          const ts     = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const backup = path.join(ROOT, `finanzas-data.backup-${ts}.json`);
          fs.copyFileSync(DATA_FILE, backup);
          console.log(`[backup] ${path.basename(backup)}`);
        }

        // Agregar timestamp de última modificación
        body._meta = {
          ...(body._meta || {}),
          lastModified: new Date().toISOString(),
          modifiedBy:   'server-api',
        };

        fs.writeFileSync(DATA_FILE, JSON.stringify(body, null, 2), 'utf-8');
        console.log(`[saved]  finanzas-data.json (${JSON.stringify(body).length} bytes)`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, savedAt: body._meta.lastModified }));
      } catch (err) {
        console.error('[error] POST /api/data:', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  // ── Archivos estáticos ─────────────────────────────────────────────────────
  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  // Seguridad: no salir del ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end(`Not found: ${pathname}`);
    return;
  }

  const ext  = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Finanzas PWA — servidor local          ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║   http://localhost:${PORT}                  ║`);
  console.log(`║   Datos: finanzas-data.json               ║`);
  console.log('║   Ctrl+C para detener                    ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});
