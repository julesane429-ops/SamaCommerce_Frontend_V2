/**
 * quick-win-breadcrumb.js — Breadcrumb contextuel + History API
 *
 * Ajoute au header :
 *   - Un indicateur de section courante sous le nom de boutique
 *   - Support du bouton "Retour" natif du navigateur via pushState
 *   - Titre de page dynamique (onglet navigateur)
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/quick-win-breadcrumb.js"></script>
 */

(function () {

  // ══════════════════════════════════════
  // MAPPING DES SECTIONS
  // ══════════════════════════════════════
  var SECTION_META = {
    menu:           { label: 'Accueil',              icon: '🏠', parent: null },
    vente:          { label: 'Vendre',               icon: '💳', parent: 'menu' },
    stock:          { label: 'Mon Stock',            icon: '📦', parent: 'menu' },
    categories:     { label: 'Catégories',           icon: '🏷️', parent: 'menu' },
    rapports:       { label: 'Chiffres',             icon: '📈', parent: 'menu' },
    inventaire:     { label: 'Inventaire',           icon: '📋', parent: 'menu' },
    credits:        { label: 'Crédits',              icon: '📝', parent: 'menu' },
    clients:        { label: 'Clients',              icon: '👥', parent: 'menu' },
    fournisseurs:   { label: 'Fournisseurs',         icon: '🏭', parent: 'menu' },
    commandes:      { label: 'Réappro fournisseurs', icon: '📋', parent: 'menu' },
    livraisons:     { label: 'Livraisons',           icon: '🚚', parent: 'menu' },
    customerOrders: { label: 'Commandes clients',    icon: '📦', parent: 'menu' },
    deliveries:     { label: 'Suivi livraisons',     icon: '🚚', parent: 'menu' },
    deliverymen:    { label: 'Livreurs',             icon: '🛵', parent: 'menu' },
    profil:         { label: 'Mon Profil',           icon: '👤', parent: 'menu' },
    calendrier:     { label: 'Échéances',            icon: '📅', parent: 'menu' },
    caisse:         { label: 'Caisse',               icon: '🧾', parent: 'menu' }
  };

  var _breadcrumbEl = null;
  var _lastSection = null;
  var _historyLock = false; // évite les boucles popstate ↔ showSection

  // ══════════════════════════════════════
  // CRÉER L'ÉLÉMENT BREADCRUMB
  // ══════════════════════════════════════
  function createBreadcrumb() {
    if (_breadcrumbEl) return;

    var headerCenter = document.querySelector('.header-center') ||
                       document.querySelector('.hd-center');
    if (!headerCenter) return;

    _breadcrumbEl = document.createElement('div');
    _breadcrumbEl.className = 'qw-breadcrumb';
    _breadcrumbEl.setAttribute('aria-live', 'polite');

    // Insérer après le header-sub
    var headerSub = headerCenter.querySelector('.header-sub');
    if (headerSub) {
      headerSub.insertAdjacentElement('afterend', _breadcrumbEl);
    } else {
      headerCenter.appendChild(_breadcrumbEl);
    }
  }

  // ══════════════════════════════════════
  // METTRE À JOUR LE BREADCRUMB
  // ══════════════════════════════════════
  function updateBreadcrumb(section) {
    if (!_breadcrumbEl) createBreadcrumb();
    if (!_breadcrumbEl) return;

    var meta = SECTION_META[section];
    if (!meta || section === 'menu') {
      _breadcrumbEl.innerHTML = '';
      _breadcrumbEl.classList.remove('entering');
      return;
    }

    // Construire le fil d'Ariane
    var parts = [];
    var current = section;
    while (current && SECTION_META[current]) {
      parts.unshift(current);
      current = SECTION_META[current].parent;
    }

    var html = '';
    parts.forEach(function (part, i) {
      var m = SECTION_META[part];
      if (!m) return;

      if (i > 0) {
        html += '<span class="qw-breadcrumb-sep">›</span>';
      }

      if (i === parts.length - 1) {
        // Section courante
        html += '<span class="qw-breadcrumb-current">' + m.icon + ' ' + m.label + '</span>';
      } else {
        // Section parent (cliquable)
        html += '<span style="cursor:pointer;" data-nav="' + part + '">' + m.label + '</span>';
      }
    });

    _breadcrumbEl.innerHTML = html;

    // Animation d'entrée
    if (_lastSection !== section) {
      _breadcrumbEl.classList.remove('entering');
      void _breadcrumbEl.offsetWidth; // force reflow
      _breadcrumbEl.classList.add('entering');
    }

    // Click sur parent → retour
    _breadcrumbEl.querySelectorAll('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function () {
        window.haptic?.tap();
        window.showSection?.(el.dataset.nav);
      });
    });

    // Mettre à jour le titre de la page
    document.title = meta.label + ' — Sama Commerce';

    _lastSection = section;
  }

  // ══════════════════════════════════════
  // HISTORY API — bouton retour natif
  // ══════════════════════════════════════
  function pushHistory(section) {
    if (_historyLock) return;

    // Ne pas empiler le même état
    var currentState = history.state;
    if (currentState && currentState.section === section) return;

    history.pushState({ section: section }, '', '#' + section);
  }

  function handlePopState(e) {
    var state = e.state;
    if (!state || !state.section) {
      // Pas d'état → retour au menu
      _historyLock = true;
      window.showSection?.('menu');
      _historyLock = false;
      return;
    }

    _historyLock = true;
    window.showSection?.(state.section);
    _historyLock = false;
  }

  // ══════════════════════════════════════
  // INTERCEPTER showSection
  // ══════════════════════════════════════
  function hookShowSection() {
    var origShowSection = window.showSection;
    if (!origShowSection) {
      setTimeout(hookShowSection, 200);
      return;
    }

    // Éviter double-wrapping
    if (origShowSection._qwBreadcrumb) return;

    var wrapped = function (section) {
      origShowSection(section);
      updateBreadcrumb(section);
      pushHistory(section);
    };
    wrapped._qwBreadcrumb = true;

    window.showSection = wrapped;
  }

  // ══════════════════════════════════════
  // HOOK SUR LE BOUTON RETOUR DU HEADER
  // ══════════════════════════════════════
  function hookBackButton() {
    var backBtn = document.getElementById('backBtn');
    if (!backBtn) return;

    // Cloner pour supprimer les anciens listeners
    var newBtn = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBtn, backBtn);

    newBtn.addEventListener('click', function () {
      window.haptic?.tap();
      // Essayer le history.back() d'abord
      if (history.state && history.state.section && history.state.section !== 'menu') {
        history.back();
      } else {
        window.showSection?.('menu');
      }
    });
  }

  // ══════════════════════════════════════
  // INITIALISATION
  // ══════════════════════════════════════
  function init() {
    createBreadcrumb();
    hookShowSection();
    hookBackButton();

    // Écouter popstate (bouton retour navigateur/mobile)
    window.addEventListener('popstate', handlePopState);

    // État initial
    var hash = window.location.hash.replace('#', '');
    var initialSection = (hash && SECTION_META[hash]) ? hash : 'menu';
    history.replaceState({ section: initialSection }, '', '#' + initialSection);
    updateBreadcrumb(initialSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      // Délai pour laisser les autres scripts s'initialiser
      setTimeout(init, 500);
    });
  } else {
    setTimeout(init, 500);
  }

})();
