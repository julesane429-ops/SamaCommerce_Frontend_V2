const SW_VERSION  = 'v7';
const CACHE_CORE  = 'sc-core-v7';
const CACHE_APP   = 'sc-app-v7';
const CACHE_MEDIA = 'sc-media-v7';
const API_URL     = 'https://samacommerce-backend-v2.onrender.com';

const PRECACHE = [
  '/',
  '/index.html',
  '/css/core.css',
  '/css/features.css',
  '/pwa/manifest.json',
  '/pwa/icons/icon-192.png',
  '/pwa/icons/icon-512.png',
  '/js/splash.js',
  '/js/app.js',
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_CORE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evt => {
  const keep = new Set([CACHE_CORE, CACHE_APP, CACHE_MEDIA]);
  evt.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !keep.has(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evt => {
  if (evt.request.method !== 'GET') return;
  const url = new URL(evt.request.url);

  if (url.href.startsWith(API_URL)) return;

  if (/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf)$/i.test(url.pathname) || url.pathname.startsWith('/pwa/icons/')) {
    evt.respondWith(cacheFirst(evt.request, CACHE_MEDIA));
    return;
  }

  if (url.pathname.endsWith('.css')) {
    evt.respondWith(staleWhileRevalidate(evt.request, CACHE_CORE));
    return;
  }

  if (url.pathname.endsWith('.js')) {
    evt.respondWith(staleWhileRevalidate(evt.request, CACHE_APP));
    return;
  }

  if (evt.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    evt.respondWith(networkFirst(evt.request, CACHE_CORE));
    return;
  }

  evt.respondWith(staleWhileRevalidate(evt.request, CACHE_APP));
});

function cacheFirst(req, name) {
  return caches.open(name).then(c => c.match(req).then(hit => {
    if (hit) return hit;
    return fetch(req).then(r => { if (r && r.status === 200) c.put(req, r.clone()); return r; }).catch(() => offline());
  }));
}

function staleWhileRevalidate(req, name) {
  return caches.open(name).then(c => c.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r && r.status === 200 && r.type === 'basic') c.put(req, r.clone()); return r; }).catch(() => hit || offline());
    return hit || net;
  }));
}

function networkFirst(req, name) {
  return fetch(req).then(r => {
    if (r && r.status === 200 && r.type === 'basic') caches.open(name).then(c => c.put(req, r.clone()));
    return r;
  }).catch(() => caches.match(req).then(h => h || offline()));
}

function offline() {
  return new Response('<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors ligne</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F5F3FF;color:#1E1B4B;text-align:center;padding:24px}.c{max-width:320px}h2{font-size:20px;margin:12px 0 8px;color:#7C3AED}p{font-size:14px;color:#6B7280;line-height:1.5}button{margin-top:20px;padding:12px 24px;background:#7C3AED;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer}</style></head><body><div class="c"><div style="font-size:64px">📡</div><h2>Vous êtes hors connexion</h2><p>Vérifiez votre connexion internet et réessayez.</p><button onclick="location.reload()">Réessayer</button></div></body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

const NI = '/pwa/icons/icon-192.png';
self.addEventListener('push', evt => {
  let d = { title: 'Sama Commerce', body: 'Nouvelle notification', url: '/' };
  try { if (evt.data) d = { ...d, ...evt.data.json() }; } catch { if (evt.data) d.body = evt.data.text(); }
  evt.waitUntil(self.registration.showNotification(d.title, { body: d.body, icon: NI, badge: NI, tag: d.tag || 'sc-notif', data: { url: d.url || '/' }, vibrate: [100, 50, 100] }));
});

self.addEventListener('notificationclick', evt => {
  evt.notification.close();
  const target = evt.notification.data?.url || '/';
  evt.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
    for (const c of cls) { if (c.url.includes(self.location.origin) && 'focus' in c) { c.focus(); c.postMessage({ type: 'NAVIGATE', url: target }); return; } }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  }));
});

self.addEventListener('message', evt => {
  if (evt.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (evt.data?.type === 'LOCAL_NOTIF') {
    const { title, body, tag, url } = evt.data;
    self.registration.showNotification(title || 'Sama Commerce', { body: body || '', icon: NI, badge: NI, tag: tag || 'local', data: { url: url || '/' }, vibrate: [80, 40, 80] });
  }
});
