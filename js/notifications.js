/**
 * notifications.js — Gestion des notifications push PWA
 *
 * Fonctionnalités :
 *   1. Demande de permission avec UI non intrusive (banner)
 *   2. Notifications locales programmées :
 *      - Crédits arrivant à échéance (J-1, J0)
 *      - Stock épuisé ou critique (≤ 2 unités)
 *      - Livraisons en transit depuis > 3 jours
 *   3. Navigation depuis les notifications (via postMessage SW)
 *   4. Raccourcis PWA (shortcut params dans l'URL)
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/notifications.js"></script>
 */

(function () {

  const SW_PATH    = '/pwa/sw.js';
  const STORAGE_KEY = 'sc_notif_last_check';
  const PERM_KEY    = 'sc_notif_perm_dismissed';

  // ════════════════════════════════════════
  // UTILITAIRES
  // ════════════════════════════════════════

  function isSupported() {
    return 'serviceWorker' in navigator && 'Notification' in window;
  }

  function hasPermission() {
    return Notification.permission === 'granted';
  }

  function isDismissed() {
    return localStorage.getItem(PERM_KEY) === 'true';
  }

  // ════════════════════════════════════════
  // BANNER DE DEMANDE DE PERMISSION
  // Non intrusive — apparaît en bas, peut être rejeté
  // ════════════════════════════════════════
  function showPermissionBanner() {
    if (document.getElementById('notif-banner')) return;
    if (!isSupported()) return;
    if (hasPermission()) return;
    if (isDismissed()) return;
    if (Notification.permission === 'denied') return;

    const banner = document.createElement('div');
    banner.id = 'notif-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: calc(var(--nav-h, 68px) + var(--safe-b, 0px) + 12px);
      left: 12px; right: 12px;
      background: var(--surface, #fff);
      border-radius: 18px;
      padding: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,.16);
      z-index: 800;
      display: flex;
      align-items: center;
      gap: 12px;
      border: 1.5px solid rgba(124,58,237,.15);
      animation: bannerSlideUp .35s cubic-bezier(.34,1.3,.64,1) both;
      max-width: 480px;
      margin: 0 auto;
    `;

    banner.innerHTML = `
      <style>
        @keyframes bannerSlideUp {
          from { transform: translateY(30px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      </style>
      <div style="font-size:28px;flex-shrink:0;">🔔</div>
      <div style="flex:1;min-width:0;">
        <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:var(--text,#1E1B4B);margin-bottom:3px;">
          Activer les alertes
        </div>
        <div style="font-size:12px;color:var(--muted,#6B7280);line-height:1.4;">
          Rappels crédits, stock faible, livraisons en retard
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
        <button id="notif-allow" style="
          background: linear-gradient(135deg,#7C3AED,#EC4899);
          color:#fff; border:none;
          padding:8px 14px; border-radius:10px;
          font-family:'Sora',sans-serif;
          font-size:12px; font-weight:700;
          cursor:pointer;white-space:nowrap;
        ">Activer</button>
        <button id="notif-dismiss" style="
          background:#F3F4F6; color:#6B7280;
          border:none; padding:6px 14px;
          border-radius:10px; font-size:12px;
          font-weight:600; cursor:pointer;
        ">Plus tard</button>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById('notif-allow').addEventListener('click', async () => {
      banner.remove();
      await requestPermission();
    });

    document.getElementById('notif-dismiss').addEventListener('click', () => {
      banner.remove();
      localStorage.setItem(PERM_KEY, 'true');
    });

    // Auto-hide après 10s
    setTimeout(() => banner?.remove(), 10000);
  }

  async function requestPermission() {
    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        window.showNotification?.('🔔 Notifications activées !', 'success');
        // Programmer les vérifications
        scheduleChecks();
      }
    } catch (err) {
      console.warn('Erreur demande permission:', err);
    }
  }

  // ════════════════════════════════════════
  // ENVOYER UNE NOTIFICATION LOCALE via SW
  // ════════════════════════════════════════
  async function sendLocalNotif({ title, body, type, url, tag }) {
    if (!hasPermission()) return;

    try {
      const reg = await navigator.serviceWorker.ready;
      reg.active?.postMessage({
        type:  'LOCAL_NOTIF',
        title, body, tag,
        url:   url || '/',
        type:  type || 'default',
      });
    } catch {
      // Fallback direct si SW pas dispo
      try {
        new Notification(title, { body, icon: '/pwa/icons/icon-192.png', tag });
      } catch {}
    }
  }

  // ════════════════════════════════════════
  // VÉRIFICATION 1 — CRÉDITS À ÉCHÉANCE
  // ════════════════════════════════════════
  function checkCreditsEcheance() {
    const credits = window.appData?.credits || [];
    const today   = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    const dus = credits.filter(c => {
      if (c.paid) return false;
      if (!c.due_date) return false;
      const due = new Date(c.due_date);
      due.setHours(0, 0, 0, 0);
      return due <= tomorrow; // aujourd'hui ou demain
    });

    if (!dus.length) return;

    const totalDu = dus.reduce((s, c) => s + (c.total || 0), 0);
    const enRetard = dus.filter(c => new Date(c.due_date) < today).length;

    let body = '';
    if (enRetard > 0) {
      body = `${enRetard} crédit${enRetard > 1 ? 's' : ''} en retard — ${totalDu.toLocaleString('fr-FR')} F à récupérer`;
    } else {
      body = `${dus.length} crédit${dus.length > 1 ? 's' : ''} à encaisser aujourd'hui — ${totalDu.toLocaleString('fr-FR')} F`;
    }

    sendLocalNotif({
      title: '💰 Rappel crédits',
      body,
      type:  'credit',
      url:   '/?shortcut=credits',
      tag:   'credits-echeance',
    });
  }

  // ════════════════════════════════════════
  // VÉRIFICATION 2 — STOCK CRITIQUE
  // ════════════════════════════════════════
  function checkStockCritique() {
    const produits = window.appData?.produits || [];

    const enRupture = produits.filter(p => p.stock === 0);
    const critique  = produits.filter(p => p.stock > 0 && p.stock <= 2);

    if (!enRupture.length && !critique.length) return;

    let body = '';
    const parts = [];
    if (enRupture.length) parts.push(`${enRupture.length} en rupture`);
    if (critique.length)  parts.push(`${critique.length} critique${critique.length > 1 ? 's' : ''}`);
    body = parts.join(', ');

    if (enRupture.length === 1) {
      body = `"${enRupture[0].name}" est épuisé`;
    } else if (critique.length === 1 && !enRupture.length) {
      body = `"${critique[0].name}" — ${critique[0].stock} restant${critique[0].stock > 1 ? 's' : ''}`;
    }

    sendLocalNotif({
      title: '📦 Alerte stock',
      body,
      type:  'stock',
      url:   '/?shortcut=stock',
      tag:   'stock-critique',
    });
  }

  // ════════════════════════════════════════
  // VÉRIFICATION 3 — LIVRAISONS EN RETARD
  // ════════════════════════════════════════
  async function checkLivraisonsRetard() {
    if (!window.authfetch) return;
    const API = document.querySelector('meta[name="api-base"]')?.content
                || 'https://samacommerce-backend-v2.onrender.com';

    try {
      const res = await window.authfetch(`${API}/livraisons`);
      if (!res.ok) return;
      const livs = await res.json();

      const now  = new Date();
      const late = livs.filter(l => {
        if (l.status !== 'en_transit') return false;
        const days = (now - new Date(l.created_at)) / (1000 * 60 * 60 * 24);
        return days > 3;
      });

      if (!late.length) return;

      sendLocalNotif({
        title: '🚛 Livraison en retard',
        body:  `${late.length} livraison${late.length > 1 ? 's' : ''} en transit depuis plus de 3 jours`,
        type:  'livraison',
        url:   '/?shortcut=livraisons',
        tag:   'livraisons-retard',
      });
    } catch {}
  }

  // ════════════════════════════════════════
  // PLANIFIER LES VÉRIFICATIONS
  // Exécutées une fois par session, pas plus d'1x/heure
  // ════════════════════════════════════════
  function scheduleChecks() {
    if (!hasPermission()) return;

    const lastCheck = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    const now       = Date.now();
    const ONE_HOUR  = 60 * 60 * 1000;

    if (now - lastCheck < ONE_HOUR) return; // Pas plus d'1x/heure
    localStorage.setItem(STORAGE_KEY, String(now));

    // Attendre que appData soit chargé (après sync)
    setTimeout(() => {
      checkCreditsEcheance();
      checkStockCritique();
      checkLivraisonsRetard();
    }, 4000); // 4s après le chargement
  }

  // ════════════════════════════════════════
  // RACCOURCIS PWA (URL params au lancement)
  // Naviguer directement vers la bonne section
  // ════════════════════════════════════════
  function handleShortcuts() {
    const params   = new URLSearchParams(window.location.search);
    const shortcut = params.get('shortcut');
    if (!shortcut) return;

    // Attendre que showSection soit disponible
    const tryNav = (attempts = 0) => {
      if (attempts > 20) return;
      if (typeof window.showSection === 'function') {
        window.showSection(shortcut);
        // Nettoyer l'URL
        const url = new URL(window.location);
        url.searchParams.delete('shortcut');
        window.history.replaceState({}, '', url.toString());
      } else {
        setTimeout(() => tryNav(attempts + 1), 300);
      }
    };
    setTimeout(() => tryNav(), 500);
  }

  // ════════════════════════════════════════
  // ÉCOUTER LES MESSAGES DU SERVICE WORKER
  // (navigation depuis une notification cliquée)
  // ════════════════════════════════════════
  function listenSWMessages() {
    navigator.serviceWorker?.addEventListener('message', evt => {
      if (evt.data?.type === 'NAVIGATE') {
        const url  = new URL(evt.data.url, window.location.origin);
        const dest = url.searchParams.get('shortcut');
        if (dest && typeof window.showSection === 'function') {
          window.showSection(dest);
        }
      }
    });
  }

  // ════════════════════════════════════════
  // EXPOSER UNE API PUBLIQUE
  // ════════════════════════════════════════
  window.scNotifications = {
    // Permettre à app.js d'appeler scheduleChecks après sync
    check: scheduleChecks,
    // Tester une notification manuellement depuis la console
    test: (type = 'credit') => {
      const demos = {
        credit:    { title: '💰 Test crédit',    body: 'Crédit de 15 000 F à encaisser aujourd\'hui', url: '/?shortcut=credits' },
        stock:     { title: '📦 Test stock',     body: '"Produit A" est épuisé',                     url: '/?shortcut=stock'   },
        livraison: { title: '🚛 Test livraison', body: '1 livraison en transit depuis 4 jours',      url: '/?shortcut=livraisons' },
      };
      const d = demos[type] || demos.credit;
      sendLocalNotif({ ...d, type, tag: 'test' });
    },
    sendLocalNotif,
    requestPermission,
  };

  // ════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════
  async function init() {
    if (!isSupported()) return;

    // Enregistrer / mettre à jour le service worker
    try {
      const reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
      console.log('✅ SW enregistré:', reg.scope);

      // Déclencher la mise à jour si nouvelle version
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW?.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            newSW.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    } catch (err) {
      console.warn('SW registration failed:', err);
    }

    // Gérer les raccourcis PWA
    handleShortcuts();

    // Écouter les messages SW
    listenSWMessages();

    // Afficher le banner de permission après 8s (pas intrusif)
    setTimeout(() => showPermissionBanner(), 8000);

    // Programmer les vérifications si permission déjà accordée
    if (hasPermission()) {
      scheduleChecks();
    }

    // Re-checker après chaque sync
    window.addEventListener('load', () => {
      setTimeout(() => {
        const origSync = window.syncFromServer;
        if (typeof origSync === 'function') {
          window.syncFromServer = async function (...args) {
            const result = await origSync.apply(this, args);
            if (hasPermission()) scheduleChecks();
            return result;
          };
        }
      }, 1000);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
