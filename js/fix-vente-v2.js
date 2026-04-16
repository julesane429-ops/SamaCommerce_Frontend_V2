/**
 * fix-vente-v2.js — Corrections définitives
 *
 * BUG 1 — Vente à crédit ne fonctionne pas
 *   Cause : enhanced-vente.js demande de sélectionner "Crédit" PUIS confirmer
 *   avec 2 clics, mais le showModalCredit est bloqué par des race conditions.
 *   Fix : bypass complet — clic direct sur "Crédit" ouvre le modal crédit.
 *
 * BUG 2 — Client sélectionné mais stats restent à zéro
 *   Cause : client-vente.js patche window.postSaleServer, mais ventes.js
 *   utilise l'import statique ES module, pas window. Le patch n'affecte rien.
 *   Fix : wrapper window.fetch pour intercepter tout POST vers /sales
 *   et injecter client_id automatiquement.
 *
 * INTÉGRATION : <script src="js/fix-vente-v2.js"></script>
 *   REMPLACE fix-vente-clients.js (le retirer de l'index.html)
 */

(function () {

  // ══════════════════════════════════════════════════════════
  // BUG 2 — INTERCEPTER fetch POUR INJECTER client_id
  // ══════════════════════════════════════════════════════════
  var _origFetch = window.fetch;
  if (_origFetch && !_origFetch._fvc2) {
    window.fetch = function (url, opts) {
      try {
        // Ne s'applique qu'aux POST vers /sales
        if (opts && opts.method === 'POST' && typeof url === 'string' && /\/sales($|\?)/.test(url)) {
          // Récupérer le client sélectionné depuis client-vente.js
          var client = window.clientVente?.getSelected?.();
          if (client && client.id && opts.body) {
            try {
              var body = JSON.parse(opts.body);
              // Ne pas écraser si déjà présent
              if (!body.client_id) {
                body.client_id = client.id;
              }
              if (!body.client_name && client.name) {
                body.client_name = client.name;
              }
              if (!body.client_phone && client.phone) {
                body.client_phone = client.phone;
              }
              opts.body = JSON.stringify(body);
            } catch (e) { /* body n'est pas JSON, on laisse passer */ }
          }
        }
      } catch (e) { /* ne JAMAIS bloquer un fetch */ }

      return _origFetch.apply(this, arguments);
    };
    window.fetch._fvc2 = true;
  }

  // ══════════════════════════════════════════════════════════
  // BUG 1 — BOUTON CRÉDIT : OUVERTURE DIRECTE
  // ══════════════════════════════════════════════════════════
  // Au lieu de laisser enhanced-vente.js gérer le flow complexe
  // (sélectionner crédit → confirmer → ouvrir modal), on ouvre
  // directement le modal crédit au premier clic sur le bouton.

  function setupDirectCredit() {
    document.addEventListener('click', function (e) {
      // Cibler le bouton "Crédit" dans le modal enhanced-vente
      var btn = e.target.closest('.ev-method-btn[data-method="credit"]');
      if (!btn) return;

      // Intercepter : on stoppe la propagation pour éviter le flow normal
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Fermer le modal enhanced-vente
      var overlay = document.getElementById('evOverlay') ||
                    document.querySelector('.ev-overlay');
      if (overlay) overlay.remove();
      document.body.style.overflow = '';

      // Ouvrir le modal crédit
      setTimeout(function () {
        if (typeof window.showModalCredit === 'function') {
          window.showModalCredit();
        } else {
          // Fallback : ouvrir manuellement
          var mp = document.getElementById('modalPaiement');
          var mc = document.getElementById('modalCredit');
          var overlay = document.getElementById('modalOverlay');
          if (mp) mp.classList.add('hidden');
          if (mc) mc.classList.remove('hidden');
          if (overlay) overlay.classList.remove('hidden');

          // Mettre à jour la date d'échéance
          var dateInput = document.getElementById('creditDueDate');
          if (dateInput) {
            var today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
            dateInput.min = today;
          }
        }

        // Pré-remplir les infos client si un client est sélectionné
        var client = window.clientVente?.getSelected?.();
        if (client) {
          var nameField = document.getElementById('creditClientName');
          var phoneField = document.getElementById('creditClientPhone');
          if (nameField && !nameField.value) nameField.value = client.name || '';
          if (phoneField && !phoneField.value) phoneField.value = client.phone || '';
        }
      }, 150);
    }, true); // capture phase pour intercepter avant enhanced-vente
  }

  // ══════════════════════════════════════════════════════════
  // BONUS — finaliserVenteCredit doit aussi recevoir client_id
  // ══════════════════════════════════════════════════════════
  // Le modal crédit envoie via postSaleServer — notre interception
  // fetch ci-dessus attrape déjà. Mais client-vente.js clear le client
  // APRÈS la vente, or finaliserVenteCredit fait des appels async.
  // On doit s'assurer que le client reste sélectionné jusqu'à la fin.

  function preserveClientDuringCredit() {
    var origFinalizer = window.finaliserVenteCredit;
    if (!origFinalizer || origFinalizer._fvc2) return;

    window.finaliserVenteCredit = async function () {
      // NE PAS clear le client avant la fin
      var origClear = window._cvClearClient;
      window._cvClearClient = function () { /* désactivé pendant l'appel */ };

      try {
        var result = await origFinalizer.apply(this, arguments);
        // Clear manuellement après
        if (typeof origClear === 'function') {
          window._cvClearClient = origClear;
          setTimeout(origClear, 500);
        }
        return result;
      } catch (e) {
        if (typeof origClear === 'function') window._cvClearClient = origClear;
        throw e;
      }
    };
    window.finaliserVenteCredit._fvc2 = true;
  }

  // ══════════════════════════════════════════════════════════
  // RAFRAÎCHISSEMENT AUTO DES CLIENTS
  // ══════════════════════════════════════════════════════════
  function setupClientRefresh() {
    var API = document.querySelector('meta[name="api-base"]')?.content ||
              'https://samacommerce-backend-v2.onrender.com';

    async function refreshClients() {
      try {
        var res = await window.authfetch?.(API + '/clients');
        if (!res?.ok) return;
        var clients = await res.json();
        if (window.appData) window.appData.clients = clients;
        window._clientsCache = clients;

        // Re-render si on est sur la section clients
        var sec = document.getElementById('clientsSection');
        if (sec && !sec.classList.contains('hidden')) {
          window.loadClients?.();
        }
      } catch (e) { /* silent */ }
    }

    // Exposer globalement
    window.refreshClientsData = refreshClients;

    // Hook sur les fonctions de vente
    ['finaliserVente', 'finaliserVenteCredit', 'marquerRembourse',
     'confirmerRemboursement', 'partialPayment', 'partialCredit'].forEach(function (fn) {
      function tryHook() {
        if (!window[fn] || window[fn]._fvc2Refresh) return;
        var orig = window[fn];
        var wrapped = async function () {
          var result;
          try { result = await orig.apply(this, arguments); }
          catch (e) { setTimeout(refreshClients, 2000); throw e; }
          setTimeout(refreshClients, 2000);
          return result;
        };
        // Préserver les flags
        Object.keys(orig).forEach(function (k) { wrapped[k] = orig[k]; });
        wrapped._fvc2Refresh = true;
        window[fn] = wrapped;
      }
      tryHook();
      setTimeout(tryHook, 1500);
      setTimeout(tryHook, 3000);
    });
  }

  // ══════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════
  function init() {
    setupDirectCredit();
    preserveClientDuringCredit();
    setupClientRefresh();

    // Re-patcher finaliserVenteCredit quand il apparaît
    setTimeout(preserveClientDuringCredit, 1500);
    setTimeout(preserveClientDuringCredit, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 800); });
  } else {
    setTimeout(init, 800);
  }

})();
