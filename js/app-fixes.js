/**
 * app-fixes.js v4
 *
 * 1. Stabilise #alertesStock — intercepte les display:none rapides via MutationObserver
 *    et ne cache vraiment que si appData confirme l'absence de stock faible
 *
 * 2. Debounce des fonctions de notification en rafale
 *
 * Intégration : dernier script avant </body>
 *   <script src="js/app-fixes.js"></script>
 */
(function () {

  // ══════════════════════════════════════
  // 1. STABILISER #alertesStock
  //    verifierStockFaible() est appelé plusieurs fois pendant syncFromServer
  //    → appData.produits passe par [] → display:none → display:block → clignotement
  //
  //    Fix : quand display:none arrive, on l'annule immédiatement et on reporte
  //    la décision de masquage 700ms plus tard en vérifiant appData directement.
  // ══════════════════════════════════════
  function stabilizeAlertDiv() {
    var el = document.getElementById('alertesStock');
    if (!el || el._scStabilized) return;
    el._scStabilized = true;

    var _hideTimer  = null;
    var _skipNext   = false;   // flag pour ignorer les mutations qu'on génère nous-mêmes

    function reallyHide() {
      var produits    = window.appData && window.appData.produits ? window.appData.produits : [];
      var hasLowStock = produits.some(function(p) { return p.stock > 0 && p.stock <= 5; });
      if (!hasLowStock && produits.length > 0) {
        _skipNext = true;
        el.style.display = 'none';
      }
      // Si produits est vide (sync en cours) → on ne masque pas
    }

    var obs = new MutationObserver(function() {
      if (_skipNext) { _skipNext = false; return; }

      var d = el.style.display;

      if (d === 'none') {
        // Annuler le masquage immédiat
        _skipNext = true;
        el.style.display = '';

        // Replanifier un vrai masquage 700ms plus tard
        clearTimeout(_hideTimer);
        _hideTimer = setTimeout(reallyHide, 700);

      } else {
        // On veut afficher → annuler tout masquage en attente
        clearTimeout(_hideTimer);
      }
    });

    obs.observe(el, { attributes: true, attributeFilter: ['style'] });
  }

  // Lancer dès que #alertesStock est dans le DOM
  function waitForAlert() {
    if (document.getElementById('alertesStock')) {
      stabilizeAlertDiv();
    } else {
      setTimeout(waitForAlert, 200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForAlert);
  } else {
    waitForAlert();
  }

  // Re-stabiliser après switch de boutique (l'élément est parfois recréé)
  window.addEventListener('boutique:changed', function() {
    setTimeout(function() {
      var el = document.getElementById('alertesStock');
      if (el) { el._scStabilized = false; stabilizeAlertDiv(); }
    }, 400);
  });


  // ══════════════════════════════════════
  // 2. DEBOUNCE NOTIFICATIONS EN RAFALE
  //    inapp-notifications.js + notifications.js patchent tous deux syncFromServer
  //    → refresh() + check() appelés 4-5× par sync
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
    if (window.inappNotifications && window.inappNotifications.refresh && !window.inappNotifications.refresh._db) {
      var r = makeDebounced(window.inappNotifications.refresh, 700);
      r._db = true;
      window.inappNotifications.refresh = r;
    }
    if (window.scNotifications && window.scNotifications.check && !window.scNotifications.check._db) {
      var c = makeDebounced(window.scNotifications.check, 700);
      c._db = true;
      window.scNotifications.check = c;
    }
  }

  var _att = 0;
  function waitAndDebounce() {
    if (window.inappNotifications && window.scNotifications) {
      applyDebounces();
    } else if (_att++ < 30) {
      setTimeout(waitAndDebounce, 300);
    }
  }
  setTimeout(waitAndDebounce, 800);

})();
