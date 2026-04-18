/**
 * fix-employee-vente.js — Correctifs pour les employés avec permission "vente" seule
 *
 * 1. Charge la liste des clients via GET /clients/for-sale (permission 'vente')
 *    au lieu de GET /clients (permission 'clients') pour l'autocomplete
 *
 * 2. Supprime les erreurs 403 bruyantes dans la console
 *    (les endpoints stats/catégories retournent 403 pour un employé sans ces permissions,
 *    mais c'est normal — syncFromServer gère via allSettled)
 *
 * INTÉGRATION : <script src="js/fix-employee-vente.js"></script>
 */

(function () {

  var API = function () {
    return document.querySelector('meta[name="api-base"]')?.content ||
           'https://samacommerce-backend-v2.onrender.com';
  };

  function isEmployee() {
    return window._employeeMode === true ||
           window._isEmployee === true ||
           localStorage.getItem('employeeRole') === 'employe' ||
           localStorage.getItem('employeeRole') === 'gerant';
  }

  // ══════════════════════════════════════════════════════════
  // 1. CHARGER LES CLIENTS POUR L'AUTOCOMPLETE VENTE
  //    Utilise /clients/for-sale qui nécessite seulement 'vente'
  //    Fallback : /clients si l'employé a aussi la permission 'clients'
  // ══════════════════════════════════════════════════════════

  async function loadClientsForVente() {
    try {
      // Essayer d'abord /clients/for-sale (léger, permission 'vente')
      var res = await window.authfetch?.(API() + '/clients/for-sale');

      if (res && res.ok) {
        var clients = await res.json();
        if (Array.isArray(clients)) {
          if (window.appData) window.appData.clients = clients;
          window._clientsCache = clients;
          return;
        }
      }
    } catch (e) { /* silent */ }

    // Fallback : essayer /clients complet (si permission 'clients')
    try {
      var res2 = await window.authfetch?.(API() + '/clients');
      if (res2 && res2.ok) {
        var clients2 = await res2.json();
        if (Array.isArray(clients2)) {
          if (window.appData) window.appData.clients = clients2;
          window._clientsCache = clients2;
        }
      }
    } catch (e) { /* silent — 403 est normal pour un employé sans perm 'clients' */ }
  }

  // ══════════════════════════════════════════════════════════
  // 2. RECHARGER LES CLIENTS APRÈS CHAQUE SYNC
  // ══════════════════════════════════════════════════════════

  function setupAutoReload() {
    // Observer les changements de stats (indique qu'un sync a eu lieu)
    var target = document.getElementById('chiffreAffaires');
    if (target) {
      var _debounce = null;
      new MutationObserver(function () {
        clearTimeout(_debounce);
        _debounce = setTimeout(loadClientsForVente, 500);
      }).observe(target, { childList: true, characterData: true, subtree: true });
    }
  }

  // ══════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════

  function init() {
    // Charger les clients immédiatement
    loadClientsForVente();
    setupAutoReload();
  }

  // Attendre que l'auth soit disponible
  function waitAndInit() {
    if (localStorage.getItem('authToken')) {
      setTimeout(init, 1000);
    } else {
      setTimeout(waitAndInit, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndInit);
  } else {
    waitAndInit();
  }

})();
