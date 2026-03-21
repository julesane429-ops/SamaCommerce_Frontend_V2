// ============================================================
// sw.js — Service Worker Sama Commerce
// Version 5 — Network First JS/HTML/CSS, Cache First assets
// ============================================================

const CACHE_STATIC = 'samacommerce-static-v5';
const CACHE_PAGES  = 'samacommerce-pages-v5';
const API_URL      = 'https://samacommerce-backend-v2.onrender.com';

const STATIC_ASSETS = [
  '/pwa/manifest.json',
  '/pwa/icons/icon-192.png',
  '/pwa/icons/icon-512.png',
];

const NOTIF_ICONS = {
  credit:    '/pwa/icons/icon-192.png',
  stock:     '/pwa/icons/icon-192.png',
  livraison: '/pwa/icons/icon-192.png',
  default:   '/pwa/icons/icon-192.png',
};

// ════════════════════════════════════════
// INSTALL — pré-cache uniquement les assets statiques
// ════════════════════════════════════════
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ════════════════════════════════════════
// ACTIVATE — purger tous les anciens caches
// ════════════════════════════════════════
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_PAGES)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ════════════════════════════════════════
// FETCH
// ════════════════════════════════════════
self.addEventListener('fetch', evt => {
  if (evt.request.method !== 'GET') return;

  const url = evt.request.url;

  // 1. Appels API → toujours réseau, jamais de cache
  if (url.startsWith(API_URL)) return;

  // 2. Images et manifest → Cache First
  const isStaticAsset = /\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf)$/i.test(url)
    || url.includes('/pwa/');

  if (isStaticAsset) {
    evt.respondWith(
      caches.open(CACHE_STATIC).then(cache =>
        cache.match(evt.request).then(cached => {
          if (cached) return cached;
          return fetch(evt.request).then(resp => {
            if (resp && resp.status === 200) cache.put(evt.request, resp.clone());
            return resp;
          });
        })
      )
    );
    return;
  }

  // 3. HTML, JS, CSS → Network First (fraîcheur garantie)
  evt.respondWith(
    fetch(evt.request)
      .then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          caches.open(CACHE_PAGES).then(c => c.put(evt.request, resp.clone()));
        }
        return resp;
      })
      .catch(() =>
        caches.match(evt.request).then(cached => {
          if (cached) return cached;
          const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
            <title>Hors ligne – Sama Commerce</title>
            <style>body{font-family:sans-serif;text-align:center;padding:50px;background:#f9f9f9;}
            h2{color:#7C3AED;}p{color:#444;}</style></head>
            <body><h2>⚠️ Vous êtes hors connexion</h2>
            <p>Reconnectez-vous à Internet pour accéder à Sama Commerce.</p></body></html>`;
          return new Response(html, { headers: { 'Content-Type': 'text/html' } });
        })
      )
  );
});

// ════════════════════════════════════════
// PUSH
// ════════════════════════════════════════
self.addEventListener('push', evt => {
  let data = { title: 'Sama Commerce', body: 'Vous avez une notification', type: 'default', url: '/' };
  try {
    if (evt.data) data = { ...data, ...evt.data.json() };
  } catch {
    if (evt.data) data.body = evt.data.text();
  }

  evt.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    NOTIF_ICONS[data.type] || NOTIF_ICONS.default,
      badge:   '/pwa/icons/icon-192.png',
      tag:     data.tag || data.type || 'sc-notif',
      data:    { url: data.url || '/' },
      vibrate: [100, 50, 100],
      actions: data.actions || [],
      requireInteraction: data.important || false,
    })
  );
});

// ════════════════════════════════════════
// NOTIFICATION CLICK
// ════════════════════════════════════════
self.addEventListener('notificationclick', evt => {
  evt.notification.close();
  const targetUrl = evt.notification.data?.url || '/';

  evt.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({ type: 'NAVIGATE', url: targetUrl });
            return;
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      })
  );
});

// ════════════════════════════════════════
// MESSAGE
// ════════════════════════════════════════
self.addEventListener('message', evt => {
  if (evt.data?.type === 'SKIP_WAITING') self.skipWaiting();

  if (evt.data?.type === 'LOCAL_NOTIF') {
    const { title, body, tag, url, type } = evt.data;
    self.registration.showNotification(title || 'Sama Commerce', {
      body:    body || '',
      icon:    NOTIF_ICONS[type] || NOTIF_ICONS.default,
      badge:   '/pwa/icons/icon-192.png',
      tag:     tag || 'local',
      data:    { url: url || '/' },
      vibrate: [80, 40, 80],
    });
  }
});
