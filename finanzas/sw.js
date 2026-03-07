/**
 * sw.js — Service Worker para Finanzas PWA
 * 
 * Estrategia:
 *   - Shell (HTML, JS, CSS, fuentes): Cache First → siempre disponible offline
 *   - /api/data GET: Network First con fallback a cache → datos frescos si hay red
 *   - /api/data POST: Network Only → escritura siempre requiere servidor
 *   - mindicador.cl: Network First con fallback (indicadores económicos)
 */

const CACHE_VERSION  = 'finanzas-v1';
const CACHE_SHELL    = `${CACHE_VERSION}-shell`;
const CACHE_DATA     = `${CACHE_VERSION}-data`;

// Rutas relativas al scope del SW (funciona en cualquier subdirectorio)
const SCOPE = self.registration.scope; // ej: https://user.github.io/finanzas/

// ── Install: pre-cachear el shell con rutas relativas al scope ───────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_SHELL)
      .then(cache => cache.addAll([
        SCOPE,
        SCOPE + 'index.html',
        SCOPE + 'manifest.json',
        SCOPE + 'styles/main.css',
        SCOPE + 'js/db.js',
        SCOPE + 'js/data.js',
        SCOPE + 'js/views/tarjetas.js',
        SCOPE + 'js/views/deudas.js',
        SCOPE + 'js/views/efectivo.js',
        SCOPE + 'js/views/resumen.js',
        SCOPE + 'js/app.js',
        SCOPE + 'icon-192.png',
        SCOPE + 'icon-512.png',
      ]))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: limpiar caches viejas ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('finanzas-') && k !== CACHE_SHELL && k !== CACHE_DATA)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: lógica de cache por tipo de recurso ────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // POST a la API → siempre red (no cachear escrituras)
  if (request.method === 'POST') {
    event.respondWith(fetch(request));
    return;
  }

  // GET /api/data → Network First con fallback a cache
  if (url.pathname.endsWith('/api/data')) {
    event.respondWith(networkFirstData(request));
    return;
  }

  // mindicador.cl → Network First, sin fallo crítico
  if (url.hostname === 'mindicador.cl') {
    event.respondWith(
      fetch(request)
        .catch(() => new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        }))
    );
    return;
  }

  // Fuentes de Google → Cache First (se cachean al primer uso)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, CACHE_SHELL));
    return;
  }

  // Shell y estáticos → Cache First
  event.respondWith(cacheFirst(request, CACHE_SHELL));
});

// ── Estrategias ───────────────────────────────────────────────────────────────
async function networkFirstData(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_DATA);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request, { cacheName: CACHE_DATA });
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline, sin datos en cache' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request, { cacheName });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && response.status < 400) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Recurso no disponible offline', { status: 503 });
  }
}

// ── Mensajes desde la app ─────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_SHELL).then(() => {
      if (event.ports[0]) event.ports[0].postMessage({ ok: true });
    });
  }
});
