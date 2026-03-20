/**
 * offline-cache.js — Cache IndexedDB + Mode hors-ligne amélioré
 *
 * Fonctionnalités :
 *   - Cache IndexedDB pour : clients, fournisseurs, commandes, livraisons
 *   - Intercepte window.authfetch pour servir le cache si hors-ligne
 *   - File d'attente des opérations (POST/PATCH/DELETE) hors-ligne
 *   - Sync automatique au retour en ligne
 *   - Indicateur visuel de statut (pill vert/orange/rouge)
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/offline-cache.js"></script>
 *   (doit être chargé AVANT clients.js, fournisseurs.js, etc.)
 */

(function () {

  const DB_NAME    = 'SamaCommerceDB';
  const DB_VERSION = 1;
  const STORES     = ['clients', 'fournisseurs', 'commandes', 'livraisons', 'outbox'];
  const API_BASE   = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';

  let db = null;

  // ══════════════════════════════════════
  // OUVERTURE DE LA BASE INDEXEDDB
  // ══════════════════════════════════════
  function openDB() {
    return new Promise((resolve, reject) => {
      if (db) { resolve(db); return; }

      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = e => {
        const idb = e.target.result;
        STORES.forEach(name => {
          if (!idb.objectStoreNames.contains(name)) {
            idb.createObjectStore(name, { keyPath: 'id', autoIncrement: name === 'outbox' });
          }
        });
      };

      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror   = e => { console.warn('IndexedDB error:', e); reject(e); };
    });
  }

  // ══════════════════════════════════════
  // OPÉRATIONS CRUD INDEXEDDB
  // ══════════════════════════════════════
  async function idbGetAll(store) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = d.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });
  }

  async function idbPutAll(store, items) {
    if (!items?.length) return;
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      items.forEach(item => os.put({ ...item, id: item.id || Date.now() + Math.random() }));
      tx.oncomplete = resolve;
      tx.onerror    = reject;
    });
  }

  async function idbClear(store) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = d.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = resolve;
      tx.onerror    = reject;
    });
  }

  async function idbAdd(store, item) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = d.transaction(store, 'readwrite');
      const req = tx.objectStore(store).add(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async function idbGetAllOutbox() { return idbGetAll('outbox'); }

  async function idbDeleteOutbox(id) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = d.transaction('outbox', 'readwrite');
      tx.objectStore('outbox').delete(id);
      tx.oncomplete = resolve;
      tx.onerror    = reject;
    });
  }

  // ══════════════════════════════════════
  // MAPPING URL → STORE
  // ══════════════════════════════════════
  function urlToStore(url) {
    const path = url.replace(API_BASE(), '');
    if (path.startsWith('/clients'))      return 'clients';
    if (path.startsWith('/fournisseurs')) return 'fournisseurs';
    if (path.startsWith('/commandes'))    return 'commandes';
    if (path.startsWith('/livraisons'))   return 'livraisons';
    return null;
  }

  function isListUrl(url) {
    const path = url.replace(API_BASE(), '');
    return /^\/(clients|fournisseurs|commandes|livraisons)\/?$/.test(path);
  }

  // ══════════════════════════════════════
  // INTERCEPTEUR AUTHFETCH
  // ══════════════════════════════════════
  function interceptAuthFetch() {
    const origFetch = window.authfetch;
    if (typeof origFetch !== 'function') { setTimeout(interceptAuthFetch, 300); return; }

    window.authfetch = async function (url, opts = {}) {
      const method = (opts.method || 'GET').toUpperCase();
      const store  = urlToStore(url);
      const online = navigator.onLine;

      // ── GET : servir le cache si hors-ligne ──
      if (method === 'GET' && store && !online) {
        console.log(`📦 Cache IndexedDB servi : ${store}`);
        const cached = await idbGetAll(store);
        if (cached.length) {
          return new Response(JSON.stringify(cached), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // ── GET en ligne → mettre en cache si liste ──
      if (method === 'GET' && store && online && isListUrl(url)) {
        try {
          const res  = await origFetch(url, opts);
          if (res.ok) {
            const cloned = res.clone();
            const data   = await cloned.json();
            if (Array.isArray(data)) {
              await idbClear(store);
              await idbPutAll(store, data);
            }
            return res;
          }
          return res;
        } catch {
          // Réseau KO → fallback cache
          const cached = await idbGetAll(store);
          return new Response(JSON.stringify(cached), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // ── POST/PATCH/DELETE hors-ligne → mettre en file ──
      if (['POST','PATCH','DELETE'].includes(method) && store && !online) {
        await enqueueOutbox({ url, method, body: opts.body || null, timestamp: Date.now() });
        window.showNotification?.('📥 Opération sauvegardée — sera envoyée à la reconnexion', 'warning');

        // Réponse simulée optimiste
        const fakeId = Date.now();
        let fakeBody = {};
        try { fakeBody = JSON.parse(opts.body || '{}'); } catch {}
        return new Response(JSON.stringify({ ...fakeBody, id: fakeId, _offline: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // ── Normal (en ligne) ──
      return origFetch(url, opts);
    };
  }

  // ══════════════════════════════════════
  // FILE D'ATTENTE OUTBOX
  // ══════════════════════════════════════
  async function enqueueOutbox(operation) {
    await idbAdd('outbox', operation);
    updateOutboxBadge();
  }

  async function processOutbox() {
    if (!navigator.onLine) return;
    const origFetch = window._origAuthFetch || window.authfetch;

    const items = await idbGetAllOutbox();
    if (!items.length) return;

    console.log(`🔄 Sync outbox : ${items.length} opération(s)`);
    let success = 0, failed = 0;

    for (const item of items) {
      try {
        const res = await (window._origAuthFetch || fetch)(item.url, {
          method:  item.method,
          headers: {
            'Content-Type':  'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('authToken'),
          },
          body: item.body,
        });

        if (res.ok) {
          await idbDeleteOutbox(item.id);
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    if (success > 0) {
      window.showNotification?.(`✅ ${success} opération${success>1?'s':''} synchronisée${success>1?'s':''}`, 'success');
      // Resync les données
      await refreshCaches();
      window.syncFromServer?.();
    }
    if (failed > 0) {
      window.showNotification?.(`⚠️ ${failed} opération${failed>1?'s':''} en échec — réessayez`, 'warning');
    }

    updateOutboxBadge();
  }

  // ══════════════════════════════════════
  // REFRESH CACHES APRÈS SYNC
  // ══════════════════════════════════════
  async function refreshCaches() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const headers = { 'Content-Type':'application/json', 'Authorization':'Bearer '+token };

    await Promise.allSettled(
      ['clients','fournisseurs','commandes','livraisons'].map(async store => {
        try {
          const res  = await fetch(`${API_BASE()}/${store}`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              await idbClear(store);
              await idbPutAll(store, data);
            }
          }
        } catch {}
      })
    );
  }

  // ══════════════════════════════════════
  // BADGE OUTBOX
  // ══════════════════════════════════════
  async function updateOutboxBadge() {
    const items = await idbGetAllOutbox();
    const badge = document.getElementById('offline-outbox-badge');
    if (badge) {
      badge.textContent  = items.length;
      badge.style.display = items.length > 0 ? 'inline-flex' : 'none';
    }
  }

  // ══════════════════════════════════════
  // INDICATEUR CONNEXION
  // ══════════════════════════════════════
  function updateConnectionUI(online) {
    const pill = document.getElementById('connection-pill');
    if (!pill) return;

    if (online) {
      pill.style.background = '#ECFDF5';
      pill.style.color      = '#059669';
      pill.textContent      = '🟢 En ligne';
    } else {
      pill.style.background = '#FEF2F2';
      pill.style.color      = '#DC2626';
      pill.textContent      = '🔴 Hors-ligne · Cache actif';
    }
  }

  function injectConnectionPill() {
    if (document.getElementById('connection-pill')) return;

    const pill = document.createElement('div');
    pill.id = 'connection-pill';
    pill.style.cssText = `
      position: fixed;
      top: calc(var(--header-h, 100px) + 8px);
      left: 50%; transform: translateX(-50%);
      padding: 5px 14px;
      border-radius: 999px;
      font-size: 11px; font-weight: 700;
      z-index: 800;
      transition: all .3s ease;
      box-shadow: 0 2px 10px rgba(0,0,0,.12);
      white-space: nowrap;
      pointer-events: none;
      display: none;
    `;

    // Badge outbox
    const badge = document.createElement('span');
    badge.id = 'offline-outbox-badge';
    badge.style.cssText = `
      display:none; align-items:center; justify-content:center;
      background:#EF4444; color:#fff;
      font-size:9px; font-weight:800;
      padding:1px 6px; border-radius:999px; margin-left:6px;
    `;
    pill.appendChild(badge);

    document.body.appendChild(pill);

    // Afficher uniquement hors-ligne
    window.addEventListener('offline', () => {
      updateConnectionUI(false);
      pill.style.display = 'flex';
      pill.style.alignItems = 'center';
      window.showNotification?.('🔴 Hors-ligne — les données locales restent disponibles', 'warning');
    });

    window.addEventListener('online', () => {
      updateConnectionUI(true);
      setTimeout(() => { pill.style.display = 'none'; }, 3000);
      processOutbox();
      window.showNotification?.('🟢 Connexion rétablie — synchronisation…', 'success');
    });

    if (!navigator.onLine) {
      updateConnectionUI(false);
      pill.style.display = 'flex';
      pill.style.alignItems = 'center';
    }
  }

  // ══════════════════════════════════════
  // PRÉ-CHARGEMENT DES CACHES
  // ══════════════════════════════════════
  async function preCacheAll() {
    if (!navigator.onLine) return;
    const token = localStorage.getItem('authToken');
    if (!token) return;

    // Charger silencieusement en arrière-plan
    await refreshCaches();
    console.log('✅ Caches IndexedDB pré-chargés');
  }

  // ══════════════════════════════════════
  // API PUBLIQUE
  // ══════════════════════════════════════
  window.offlineCache = {
    getAll:       idbGetAll,
    putAll:       idbPutAll,
    clear:        idbClear,
    processOutbox,
    refreshCaches,
    getOutbox:    idbGetAllOutbox,
    preCacheAll,
  };

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  async function init() {
    await openDB();
    interceptAuthFetch();
    injectConnectionPill();
    updateOutboxBadge();

    // Pré-cache 8s après chargement (laisser le sync principal se faire)
    window.addEventListener('load', () => {
      setTimeout(preCacheAll, 8000);
    });

    // Sync outbox au retour en ligne
    window.addEventListener('online', processOutbox);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
