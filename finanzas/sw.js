const CACHE_NAME='finanzas-v5';
const STATIC=['/index.html','/app.js','/style.css','/manifest.json','/icon-192.svg','/icon-512.svg'];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(async cache=>{
      for(const url of STATIC){
        try{await cache.add(url)}catch(err){console.warn('Cache miss:',url)}
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  // NEVER intercept cross-origin requests (CDN, API, etc.)
  if(u.origin!==self.location.origin){
    e.respondWith(fetch(e.request));
    return;
  }
  // Same-origin: cache-first for static assets
  if(STATIC.some(a=>u.pathname.endsWith(a.replace('/','')||'index.html'))||u.pathname.match(/\.(js|css|svg|json|png|woff2?)$/)){
    e.respondWith(caches.match(e.request).then(c=>{
      if(c)return c;
      return fetch(e.request).then(r=>{const cl=r.clone();caches.open(CACHE_NAME).then(ca=>ca.put(e.request,cl));return r});
    }).catch(()=>caches.match('/index.html')));
  }else{
    e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
  }
});
