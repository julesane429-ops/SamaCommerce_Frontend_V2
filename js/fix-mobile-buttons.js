/**
 * fix-mobile-buttons.js — Correctif boutons mobiles
 *
 * Problème : les boutons Ajouter/Aide dans les sections (Clients,
 * Fournisseurs, Commandes, etc.) ne fonctionnent pas sur mobile
 * car pageChange ne se déclenche pas si la chaîne de wrappers
 * showSection a une erreur.
 *
 * Ce script :
 *   1. Protège la chaîne de wrappers avec try/catch
 *   2. Garantit que pageChange se déclenche toujours
 *   3. Force l'init des sections au premier accès
 *
 * INTÉGRATION : <script src="js/fix-mobile-buttons.js"></script>
 * (charger en DERNIER, après tous les autres scripts)
 */

(function () {

  // Sections qui dépendent de pageChange pour leur init
  var PAGE_CHANGE_SECTIONS = [
    'clients', 'fournisseurs', 'commandes', 'livraisons',
    'customerOrders', 'deliveries', 'deliverymen',
    'caisse', 'profil', 'calendrier'
  ];

  // Init functions exposées sur window par chaque module
  var INIT_MAP = {
    clients:        'initClientsSection',
    fournisseurs:   'initFournisseursSection',
    commandes:      'initCommandesSection',
    livraisons:     'initLivraisonsSection',
    customerOrders: 'initCustomerOrdersSection',
    deliveries:     'initDeliveriesSection',
    deliverymen:    'initDeliverymenSection',
    caisse:         'initCaisseSection',
    calendrier:     'initCalendrierSection',
    profil:         'initProfilSection',
  };

  var _inited = {};

  function init() {
    var origShow = window.showSection;
    if (!origShow) { setTimeout(init, 300); return; }
    if (origShow._fmb) return;

    // Wrapper de sécurité : try/catch + dispatch pageChange en fallback
    window.showSection = function (section) {
      // Appeler le wrapper original avec protection
      try {
        origShow(section);
      } catch (e) {
        console.warn('[fix-mobile-buttons] showSection error:', e);
        // Fallback : au moins montrer la section
        fallbackShowSection(section);
      }

      // Garantir que pageChange se déclenche pour les sections IIFE
      if (PAGE_CHANGE_SECTIONS.indexOf(section) > -1) {
        ensureSectionInit(section);
      }
    };
    window.showSection._fmb = true;
  }

  // Fallback minimal si le showSection original casse
  function fallbackShowSection(section) {
    var sections = [
      'menu','vente','stock','categories','rapports','inventaire','credits',
      'clients','fournisseurs','commandes','livraisons',
      'customerOrders','deliveries','deliverymen',
      'profil','calendrier','caisse'
    ];

    sections.forEach(function (s) {
      var el = document.getElementById(s + 'Section');
      if (el) el.classList.add('hidden');
    });

    var target = document.getElementById(section + 'Section');
    if (target) target.classList.remove('hidden');

    var backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.style.display = (section === 'menu') ? 'none' : 'block';
  }

  // Garantir l'init d'une section IIFE
  function ensureSectionInit(section) {
    // Toujours dispatcher pageChange (les listeners dédupliquent eux-mêmes)
    try {
      window.dispatchEvent(new CustomEvent('pageChange', { detail: { key: section } }));
    } catch (e) {
      // Fallback : appeler directement la fonction d'init
      var fnName = INIT_MAP[section];
      if (fnName && typeof window[fnName] === 'function' && !_inited[section]) {
        _inited[section] = true;
        try { window[fnName](); } catch (e2) {
          console.warn('[fix-mobile-buttons] init error for', section, e2);
        }
      }
    }
  }

  // Démarrage — attendre que tous les scripts soient chargés
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 800); });
  } else {
    setTimeout(init, 800);
  }

})();
