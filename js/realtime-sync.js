/**
 * realtime-sync.js — Synchronisation en temps réel
 *
 * Polling intelligent toutes les 30s :
 *   - Compare le hash des données avant/après pour éviter
 *     les re-renders inutiles
 *   - Indicateur visuel discret (pill animé)
 *   - Pause automatique quand l'onglet est inactif
 *   - Accélère à 10s après une vente (convergence rapide)
 *   - Notifie si de nouvelles ventes apparaissent sur un autre appareil
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/realtime-sync.js"></script>
 */

(function () {

  const INTERVAL_NORMAL  = 30 * 1000;  // 30s en usage normal
  const INTERVAL_ACTIVE  = 10 * 1000;  // 10s juste après une vente
  const INTERVAL_HIDDEN  = 60 * 1000;  // 60s quand l'onglet est caché

  let timer        = null;
  let lastSalesKey = null;  // Hash simple du nb de ventes
  let lastHash     = null;
  let isSyncing    = false;
  let activeMode   = false;
  let activeModeTimer = null;

  // ══════════════════════════════════════
  // HASH RAPIDE pour détecter les changements
  // ══════════════════════════════════════
  function quickHash(data) {
    const ventes  = window.appData?.ventes?.length  || 0;
    const credits = window.appData?.credits?.filter(c=>!c.paid).length || 0;
    const stock   = window.appData?.produits?.reduce((s,p) => s + (p.stock||0), 0) || 0;
    return `${ventes}-${credits}-${stock}`;
  }

  // ══════════════════════════════════════
  // INDICATEUR VISUEL
  // ══════════════════════════════════════
  function injectIndicator() {
    if (document.getElementById('rt-sync-indicator')) return;

    const el = document.createElement('div');
    el.id = 'rt-sync-indicator';
    el.style.cssText = `
      position: fixed;
      top: 10px; right: 12px;
      z-index: 850;
      display: flex; align-items: center; gap: 5px;
      padding: 4px 10px;
      background: rgba(255,255,255,.15);
      backdrop-filter: blur(6px);
      border-radius: 999px;
      font-size: 10px; font-weight: 700;
      color: #fff;
      pointer-events: none;
      opacity: 0;
      transition: opacity .3s ease;
    `;
    el.innerHTML = `
      <span id="rt-dot" style="
        width:6px; height:6px; border-radius:50%;
        background:#10B981; flex-shrink:0;
        animation: rtPulse 1.5s infinite;
      "></span>
      <span id="rt-label">Sync…</span>
      <style>
        @keyframes rtPulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:.5; transform:scale(.7); }
        }
      </style>
    `;
    document.body.appendChild(el);
  }

  function showSyncing() {
    const el = document.getElementById('rt-sync-indicator');
    if (!el) return;
    el.style.opacity = '1';
    el.querySelector('#rt-dot').style.background   = '#F59E0B';
    el.querySelector('#rt-label').textContent = 'Sync…';
  }

  function showSynced(changed) {
    const el = document.getElementById('rt-sync-indicator');
    if (!el) return;
    el.querySelector('#rt-dot').style.background = '#10B981';
    el.querySelector('#rt-label').textContent = changed ? '✓ Mis à jour' : '✓ À jour';
    setTimeout(() => { if(el) el.style.opacity = '0'; }, changed ? 2500 : 1200);
  }

  function showError() {
    const el = document.getElementById('rt-sync-indicator');
    if (!el) return;
    el.querySelector('#rt-dot').style.background = '#EF4444';
    el.querySelector('#rt-label').textContent = 'Hors-ligne';
    setTimeout(() => { if(el) el.style.opacity = '0'; }, 2000);
  }

  // ══════════════════════════════════════
  // SYNC PRINCIPALE
  // ══════════════════════════════════════
  async function doSync(silent = true) {
    if (isSyncing) return;
    if (!navigator.onLine) { if(!silent) showError(); return; }
    if (!localStorage.getItem('authToken')) return;

    isSyncing = true;
    const hashBefore = quickHash();

    if (!silent) showSyncing();

    try {
      await window.syncFromServer?.();

      const hashAfter = quickHash();
      const changed   = hashAfter !== hashBefore;

      if (changed) {
        // Rafraîchir l'UI si des données ont changé
        window.updateStats?.();
        window.verifierStockFaible?.();

        // Notifier si de nouvelles ventes viennent d'un autre appareil
        const newVentes = (window.appData?.ventes?.length || 0);
        const oldVentes = parseInt(lastSalesKey || '0');
        if (lastSalesKey !== null && newVentes > oldVentes) {
          const diff = newVentes - oldVentes;
          window.showNotification?.(
            `📱 ${diff} nouvelle${diff>1?'s':''} vente${diff>1?'s':''} depuis un autre appareil`,
            'info'
          );
        }
        lastSalesKey = String(newVentes);
      }

      if (!silent) showSynced(changed);
      lastHash = hashAfter;
    } catch {
      if (!silent) showError();
    } finally {
      isSyncing = false;
    }
  }

  // ══════════════════════════════════════
  // DÉMARRER / ARRÊTER LE POLLING
  // ══════════════════════════════════════
  function getInterval() {
    if (!navigator.onLine)        return INTERVAL_HIDDEN;
    if (document.hidden)          return INTERVAL_HIDDEN;
    if (activeMode)               return INTERVAL_ACTIVE;
    return INTERVAL_NORMAL;
  }

  function startPolling() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => doSync(true), getInterval());
  }

  function resetTimer() {
    startPolling();
  }

  // ══════════════════════════════════════
  // MODE ACTIF (après une vente)
  // ══════════════════════════════════════
  function activateActiveMode() {
    activeMode = true;
    clearTimeout(activeModeTimer);
    resetTimer();
    // Retour au mode normal après 5 minutes
    activeModeTimer = setTimeout(() => {
      activeMode = false;
      resetTimer();
    }, 5 * 60 * 1000);
  }

  // ══════════════════════════════════════
  // HOOKS
  // ══════════════════════════════════════
  function hookVentes() {
    const hookFn = (orig) => async function (...args) {
      const result = await orig.apply(this, args);
      activateActiveMode();
      return result;
    };

    const tryHook = () => {
      let hooked = false;
      if (typeof window.finaliserVente === 'function' && !window.finaliserVente._rtHooked) {
        const orig = window.finaliserVente;
        window.finaliserVente = hookFn(orig);
        window.finaliserVente._rtHooked = true;
        hooked = true;
      }
      if (typeof window.finaliserVenteCredit === 'function' && !window.finaliserVenteCredit._rtHooked) {
        const orig = window.finaliserVenteCredit;
        window.finaliserVenteCredit = hookFn(orig);
        window.finaliserVenteCredit._rtHooked = true;
        hooked = true;
      }
      if (!hooked) setTimeout(tryHook, 300);
    };
    tryHook();
  }

  // ══════════════════════════════════════
  // BOUTON SYNC MANUEL dans le header
  // ══════════════════════════════════════
  function injectSyncButton() {
    if (document.getElementById('rt-sync-btn')) return;
    const header = document.querySelector('.header-inner');
    if (!header) return;

    const btn = document.createElement('button');
    btn.id = 'rt-sync-btn';
    btn.setAttribute('aria-label', 'Synchroniser maintenant');
    btn.style.cssText = `
      background:rgba(255,255,255,.2); border:none;
      width:38px; height:38px; border-radius:11px;
      color:#fff; font-size:16px; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      backdrop-filter:blur(6px); flex-shrink:0;
      transition:background .2s, transform .3s;
      -webkit-tap-highlight-color: transparent;
    `;
    btn.textContent = '🔄';
    btn.title = 'Synchroniser';
    btn.addEventListener('click', async () => {
      btn.style.transform = 'rotate(360deg)';
      btn.style.pointerEvents = 'none';
      await doSync(false);
      setTimeout(() => {
        btn.style.transform = 'rotate(0deg)';
        btn.style.transition = 'transform 0s';
        setTimeout(() => btn.style.transition = 'background .2s, transform .3s', 50);
        btn.style.pointerEvents = 'auto';
      }, 600);
    });

    // Insérer avant le bouton 🔍 ou .header-icon
    const searchBtn = document.getElementById('global-search-btn');
    const iconEl    = header.querySelector('.header-icon');
    const anchor    = searchBtn || iconEl;
    if (anchor) header.insertBefore(btn, anchor);
    else header.appendChild(btn);
  }

  // ══════════════════════════════════════
  // VISIBILITÉ DE L'ONGLET
  // ══════════════════════════════════════
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // Retour au premier plan → sync immédiate
      doSync(true);
    }
    resetTimer();
  });

  window.addEventListener('online',  () => { doSync(false); resetTimer(); });
  window.addEventListener('offline', () => { resetTimer(); });

  // ══════════════════════════════════════
  // API PUBLIQUE
  // ══════════════════════════════════════
  window.realtimeSync = {
    sync:   () => doSync(false),
    start:  startPolling,
    stop:   () => clearInterval(timer),
    active: activateActiveMode,
  };

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    injectIndicator();
    hookVentes();
    window.addEventListener('load', () => {
      setTimeout(() => {
        injectSyncButton();
        lastSalesKey = String(window.appData?.ventes?.length || 0);
        lastHash     = quickHash();
        startPolling();
      }, 2000);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
