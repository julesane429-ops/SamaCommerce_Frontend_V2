const CACHE = 'boutique-v3';
const PRECACHE_URLS = [
  '/', 
  '/index.html',
  '/pwa/manifest.json',
  '/pwa/icons/icon-192.png',
  '/pwa/icons/icon-512.png'
];

// === INSTALL ===
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
  console.log("📦 Service Worker installé");
});

// === ACTIVATE ===
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE) {
          console.log("🗑 Suppression ancien cache :", key);
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
  console.log("⚡ Service Worker activé");
});

// === FETCH ===
self.addEventListener('fetch', evt => {
  if (evt.request.method !== 'GET') return;

  evt.respondWith(
    caches.match(evt.request).then(cached => {
      if (cached) return cached;

      return fetch(evt.request).then(resp => {
        if (resp && resp.type === 'basic' && evt.request.url.startsWith(self.location.origin)) {
          const respClone = resp.clone();
          caches.open(CACHE).then(c => c.put(evt.request, respClone));
        }
        return resp;
      }).catch(() => {
        // Fallback → affiche le template offline intégré
        const offlineHtml = `
          <!DOCTYPE html>
          <html lang="fr">
          <head><meta charset="UTF-8"><title>Hors ligne</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; background: #f9f9f9; }
            h2 { color: #6D28D9; }
            p { color: #444; }
          </style></head>
          <body>
            <h2>⚠️ Vous êtes hors connexion</h2>
            <p>Pas d’inquiétude, vos données locales restent accessibles.<br>
            Vérifiez votre connexion Internet pour continuer.</p>
          </body></html>`;
        return new Response(offlineHtml, { headers: { 'Content-Type': 'text/html' } });
      });
    })
  );
});
