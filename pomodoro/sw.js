/* ==========================================================
   Service Worker — sw.js  (v4)
   ----------------------------------------------------------
   Simplified: only handles offline caching and on-demand
   notifications. Timer logic runs in the main thread with
   Wake Lock keeping the screen on.
   ========================================================== */

const CACHE_NAME = 'pomodoro-v8';
const PRECACHE_URLS = [
  './', './index.html', './styles.css', './app.js',
  './manifest.json', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ns) =>
      Promise.all(ns.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((resp) => {
        if (e.request.method === 'GET' && e.request.url.startsWith(self.location.origin)) {
          caches.open(CACHE_NAME).then((c) => c.put(e.request, resp.clone()));
        }
        return resp;
      });
    }).catch(() => {
      if (e.request.mode === 'navigate') return caches.match('./index.html');
    })
  );
});

/* On-demand notification from main thread */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(e.data.title, {
      body: e.data.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: e.data.tag || 'pomodoro',
      vibrate: [200, 100, 400, 100, 200],
      requireInteraction: true,
      renotify: true,
      actions: [{ action: 'open', title: 'Abrir' }]
    });
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cls) => {
      for (const c of cls) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow('/');
    })
  );
});
