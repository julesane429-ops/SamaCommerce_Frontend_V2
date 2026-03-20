/**
 * badge-widget.js — Badge dynamique PWA + Widget CA du jour
 *
 * Fonctionnalités :
 *   1. Badge numérique sur l'icône de l'app (API Badging)
 *      → Affiche le nombre de ventes du jour
 *   2. Mise à jour du badge après chaque vente
 *   3. Raccourcis PWA dynamiques mis à jour dans le manifest
 *   4. Notification silencieuse de fin de journée avec résumé
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/badge-widget.js"></script>
 *
 * BACKEND : ajouter GET /stats/today dans routes/stats.js
 *   (voir PATCH_stats_today.js)
 */

(function () {

  const API = () => document.querySelector('meta[name="api-base"]')?.content
               || 'https://samacommerce-backend-v2.onrender.com';

  // ══════════════════════════════════════
  // API BADGING (Chrome Android / iOS 16.4+)
  // ══════════════════════════════════════
  const canBadge = 'setAppBadge' in navigator;

  async function setBadge(count) {
    if (!canBadge) return;
    try {
      if (count > 0) {
        await navigator.setAppBadge(count);
      } else {
        await navigator.clearAppBadge();
      }
    } catch { /* silencieux si non supporté */ }
  }

  async function clearBadge() {
    if (!canBadge) return;
    try { await navigator.clearAppBadge(); } catch {}
  }

  // ══════════════════════════════════════
  // RÉCUPÉRER LES STATS DU JOUR
  // ══════════════════════════════════════
  async function getTodayStats() {
    // Utiliser appData si disponible (plus rapide)
    const data = window.appData;
    if (data?.ventes) {
      const today  = new Date().toISOString().split('T')[0];
      const ventesJour = data.ventes.filter(v => {
        const d = new Date(v.created_at || v.date);
        return !isNaN(d) && d.toISOString().split('T')[0] === today;
      });
      const ca = ventesJour.filter(v => v.paid).reduce((s,v) => s + (v.total||0), 0);
      return { nb_ventes: ventesJour.length, ca_jour: ca };
    }

    // Fallback API
    try {
      const res = await window.authfetch?.(`${API()}/stats/today`);
      if (res?.ok) return await res.json();
    } catch {}

    return { nb_ventes: 0, ca_jour: 0 };
  }

  // ══════════════════════════════════════
  // METTRE À JOUR LE BADGE
  // ══════════════════════════════════════
  async function updateBadge() {
    const stats = await getTodayStats();
    await setBadge(stats.nb_ventes);

    // Mettre à jour le titre de l'onglet avec le CA du jour
    const ca = (stats.ca_jour || 0).toLocaleString('fr-FR');
    const boutique = document.getElementById('appHeader')?.textContent?.replace('🏪','').trim() || 'Sama Commerce';

    if (stats.nb_ventes > 0) {
      document.title = `${ca} F · ${boutique}`;
    } else {
      document.title = boutique;
    }

    return stats;
  }

  // ══════════════════════════════════════
  // HOOK SUR FINALISER VENTE
  // Met à jour le badge après chaque vente
  // ══════════════════════════════════════
  function hookVentes() {
    const origFV  = window.finaliserVente;
    const origFVC = window.finaliserVenteCredit;

    if (typeof origFV === 'function') {
      window.finaliserVente = async function (...args) {
        const result = await origFV.apply(this, args);
        setTimeout(updateBadge, 1000);
        return result;
      };
    }

    if (typeof origFVC === 'function') {
      window.finaliserVenteCredit = async function (...args) {
        const result = await origFVC.apply(this, args);
        setTimeout(updateBadge, 1000);
        return result;
      };
    }

    if (!origFV && !origFVC) setTimeout(hookVentes, 300);
  }

  // ══════════════════════════════════════
  // OBSERVER appData pour mise à jour auto
  // ══════════════════════════════════════
  function watchCA() {
    const el = document.getElementById('chiffreAffaires');
    if (!el) return;

    let lastText = '';
    const obs = new MutationObserver(() => {
      const t = el.textContent;
      if (t === lastText) return;
      lastText = t;
      setTimeout(updateBadge, 500);
    });
    obs.observe(el, { characterData:true, childList:true, subtree:true });
  }

  // ══════════════════════════════════════
  // NOTIFICATION RÉSUMÉ FIN DE JOURNÉE
  // Via SW — uniquement si app en arrière-plan
  // ══════════════════════════════════════
  async function sendDailySummaryNotif() {
    if (Notification.permission !== 'granted') return;
    const hour = new Date().getHours();
    if (hour < 18) return;

    const KEY_EOD = 'sc_badge_eod_sent';
    const today   = new Date().toISOString().split('T')[0];
    if (localStorage.getItem(KEY_EOD) === today) return;

    const stats = await getTodayStats();
    if (stats.nb_ventes === 0) return;

    localStorage.setItem(KEY_EOD, today);

    const reg = await navigator.serviceWorker?.ready;
    reg?.showNotification?.('📊 Bilan du jour', {
      body:    `${stats.nb_ventes} vente${stats.nb_ventes>1?'s':''} · ${(stats.ca_jour||0).toLocaleString('fr-FR')} F encaissés`,
      icon:    '/pwa/icons/icon-192.png',
      badge:   '/pwa/icons/icon-192.png',
      tag:     'daily-summary',
      data:    { url: '/?shortcut=rapports' },
      vibrate: [100, 50, 100],
    });
  }

  // ══════════════════════════════════════
  // RESET BADGE À MINUIT
  // ══════════════════════════════════════
  function scheduleReset() {
    const now  = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const ms = next - now;
    setTimeout(() => { clearBadge(); document.title = document.getElementById('appHeader')?.textContent?.replace('🏪','').trim() || 'Sama Commerce'; scheduleReset(); }, ms);
  }

  // ══════════════════════════════════════
  // API PUBLIQUE
  // ══════════════════════════════════════
  window.badgeWidget = {
    update: updateBadge,
    clear:  clearBadge,
    set:    setBadge,
  };

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    hookVentes();
    watchCA();
    scheduleReset();

    // Premier badge après chargement
    setTimeout(updateBadge, 3000);

    // Résumé fin de journée
    setTimeout(sendDailySummaryNotif, 5000);
    // Revérifier toutes les heures
    setInterval(sendDailySummaryNotif, 60 * 60 * 1000);
  }

  window.addEventListener('load', () => setTimeout(init, 500));

})();
