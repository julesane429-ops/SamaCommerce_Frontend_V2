/**
 * app-fixes.js v3
 *
 * 1. Debounce alerts/notifications — cible directement les fonctions de refresh
 *    (pas syncFromServer qui est déjà patché 2× en chaîne)
 *
 * 2. CSS : transition douce sur #alertesStock (évite le flash show/hide)
 *
 * Intégration : dernier script avant </body>
 *   <script src="js/app-fixes.js"></script>
 */
(function () {

  // ══════════════════════════════════════
  // 1. TRANSITION CSS sur #alertesStock
  //    Évite le clignotement brutal show/hide
  // ══════════════════════════════════════
  function addAlertTransition() {
    const style = document.createElement('style');
    style.textContent = `
      #alertesStock {
        transition: opacity .35s ease, max-height .35s ease !important;
        overflow: hidden !important;
      }
      #alertesStock[style*="display: none"],
      #alertesStock[style*="display:none"] {
        opacity: 0 !important;
        max-height: 0 !important;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }
  addAlertTransition();

  // ══════════════════════════════════════
  // 2. DEBOUNCE DES FONCTIONS DE REFRESH
  //    verifierStockFaible, inappNotifications.refresh, scNotifications.check
  //    sont appelés en rafale après syncFromServer
  // ══════════════════════════════════════
  function makeDebounced(fn, delay) {
    var t;
    return function() {
      var args = arguments;
      var ctx  = this;
      clearTimeout(t);
      t = setTimeout(function() { fn.apply(ctx, args); }, delay);
    };
  }

  function applyDebounces() {
    // a. verifierStockFaible — cause principale des alertes qui clignotent
    if (window.verifierStockFaible && !window.verifierStockFaible._debounced) {
      var origVSF = window.verifierStockFaible;
      window.verifierStockFaible = makeDebounced(origVSF, 500);
      window.verifierStockFaible._debounced = true;
    }

    // b. inapp-notifications refresh
    if (window.inappNotifications?.refresh && !window.inappNotifications.refresh._debounced) {
      var origIR = window.inappNotifications.refresh;
      window.inappNotifications.refresh = makeDebounced(origIR, 700);
      window.inappNotifications.refresh._debounced = true;
    }

    // c. scNotifications.check (notifications.js)
    if (window.scNotifications?.check && !window.scNotifications.check._debounced) {
      var origSC = window.scNotifications.check;
      window.scNotifications.check = makeDebounced(origSC, 700);
      window.scNotifications.check._debounced = true;
    }
  }

  // Attendre que les modules soient initialisés
  var _attempts = 0;
  function waitAndApply() {
    _attempts++;
    var ready = window.verifierStockFaible
             && window.inappNotifications?.refresh
             && window.scNotifications?.check;

    if (ready) {
      applyDebounces();
    } else if (_attempts < 30) {
      setTimeout(waitAndApply, 300);
    }
  }

  // Lancer après le chargement complet
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(waitAndApply, 500); });
  } else {
    setTimeout(waitAndApply, 500);
  }

  // Re-appliquer si les fonctions sont re-définies (après switch boutique)
  window.addEventListener('boutique:changed', function() {
    setTimeout(applyDebounces, 500);
  });

})();
