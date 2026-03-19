// ============================================================
// sw.js — Service Worker Sama Commerce
// Version 4 — Push notifications + cache amélioré
// ============================================================

const CACHE   = 'samacommerce-v4';
const API_URL = 'https://samacommerce-backend-v2.onrender.com';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/pwa/manifest.json',
  '/pwa/icons/icon-192.png',
  '/pwa/icons/icon-512.png',
];

// ── Icônes pour les notifications selon le type ──
const NOTIF_ICONS = {
  credit:    '/pwa/icons/icon-192.png',
  stock:     '/pwa/icons/icon-192.png',
  livraison: '/pwa/icons/icon-192.png',
  default:   '/pwa/icons/icon-192.png',
};

// ════════════════════════════════════════
// INSTALL
// ════════════════════════════════════════
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
  console.log('📦 SW v4 installé');
});

// ════════════════════════════════════════
// ACTIVATE
// ════════════════════════════════════════
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
  console.log('⚡ SW v4 activé');
});

// ════════════════════════════════════════
// FETCH — Cache first pour assets, network first pour API
// ════════════════════════════════════════
self.addEventListener('fetch', evt => {
  if (evt.request.method !== 'GET') return;

  // Ne pas cacher les appels API
  if (evt.request.url.startsWith(API_URL)) return;

  evt.respondWith(
    caches.match(evt.request).then(cached => {
      if (cached) return cached;

      return fetch(evt.request)
        .then(resp => {
          if (
            resp &&
            resp.status === 200 &&
            resp.type === 'basic' &&
            evt.request.url.startsWith(self.location.origin)
          ) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(evt.request, clone));
          }
          return resp;
        })
        .catch(() => {
          // Fallback offline
          const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
            <title>Hors ligne</title>
            <style>body{font-family:sans-serif;text-align:center;padding:50px;background:#f9f9f9;}
            h2{color:#7C3AED;}p{color:#444;}</style></head>
            <body><h2>⚠️ Vous êtes hors connexion</h2>
            <p>Vos données locales restent accessibles.</p></body></html>`;
          return new Response(html, { headers: { 'Content-Type': 'text/html' } });
        });
    })
  );
});

// ════════════════════════════════════════
// PUSH — Réception d'une notification push
// ════════════════════════════════════════
self.addEventListener('push', evt => {
  let data = { title: 'Sama Commerce', body: 'Vous avez une notification', type: 'default', url: '/' };

  try {
    if (evt.data) data = { ...data, ...evt.data.json() };
  } catch {
    if (evt.data) data.body = evt.data.text();
  }

  const icon  = NOTIF_ICONS[data.type] || NOTIF_ICONS.default;
  const badge = '/pwa/icons/icon-192.png';

  const options = {
    body:    data.body,
    icon,
    badge,
    tag:     data.tag || data.type || 'sc-notif',
    data:    { url: data.url || '/' },
    vibrate: [100, 50, 100],
    actions: data.actions || [],
    requireInteraction: data.important || false,
  };

  evt.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ════════════════════════════════════════
// NOTIFICATION CLICK — Ouvrir l'app
// ════════════════════════════════════════
self.addEventListener('notificationclick', evt => {
  evt.notification.close();

  const targetUrl = evt.notification.data?.url || '/';

  evt.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Si une fenêtre est déjà ouverte, la focaliser
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({ type: 'NAVIGATE', url: targetUrl });
            return;
          }
        }
        // Sinon ouvrir une nouvelle fenêtre
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ════════════════════════════════════════
// MESSAGE — Communication avec la page
// ════════════════════════════════════════
self.addEventListener('message', evt => {
  if (evt.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Déclencher une notification locale (sans push serveur)
  if (evt.data?.type === 'LOCAL_NOTIF') {
    const { title, body, tag, url, type } = evt.data;
    self.registration.showNotification(title || 'Sama Commerce', {
      body:    body  || '',
      icon:    NOTIF_ICONS[type] || NOTIF_ICONS.default,
      badge:   '/pwa/icons/icon-192.png',
      tag:     tag   || 'local',
      data:    { url: url || '/' },
      vibrate: [80, 40, 80],
    });
  }
});
