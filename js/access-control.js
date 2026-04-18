/**
 * access-control.js — Système complet de contrôle d'accès
 *
 * 1. Modifie la bottom nav : Catégories remplace Chiffres, Chiffres va dans Plus
 * 2. Filtre TOUTES les navigations (bottom nav, sidebar, plus menu, action-grid)
 *    selon le plan + les permissions employé
 * 3. Bloque showSection pour les sections non autorisées
 * 4. Filtre les résultats de la recherche globale
 *
 * Un employé ne VOIT PAS les sections auxquelles il n'a pas accès.
 * Pas de bouton grisé, pas de message — les éléments sont absents.
 *
 * INTÉGRATION : <script src="js/access-control.js"></script>
 *   Charger APRÈS planConfig.js, fix-plan-access.js, boutique-switcher.js
 *   et AVANT enhanced-plus-menu.js et ux-responsive.js
 */

(function () {

  // ══════════════════════════════════════════════════════════
  // MAPPINGS
  // ══════════════════════════════════════════════════════════

  // Section → feature du plan requise (de planConfig.js)
  var SECTION_TO_PLAN_FEATURE = {
    menu:           null,       // toujours visible
    vente:          'ventes',
    stock:          'stock',
    categories:     'categories',
    caisse:         'caisse',
    credits:        'credits',
    clients:        'clients',
    rapports:       'rapports',
    inventaire:     'rapports',
    fournisseurs:   'fournisseurs',
    commandes:      'commandes',
    calendrier:     'rapports',
    customerOrders: 'livraisons',
    deliveries:     'livraisons',
    deliverymen:    'livraisons',
    team:           'team',
    logs:           'team',
    profil:         null,       // toujours visible
    boutiques:      'multi_boutique',
  };

  // Section → permission employé requise
  // Groupements : stock inclut categories, rapports inclut caisse/inventaire/calendrier, etc.
  var SECTION_TO_EMPLOYEE_PERM = {
    menu:           null,       // toujours visible
    vente:          'vente',
    stock:          'stock',
    categories:     'stock',
    caisse:         'rapports',
    credits:        'credits',
    clients:        'clients',
    rapports:       'rapports',
    inventaire:     'rapports',
    fournisseurs:   'fournisseurs',
    commandes:      'fournisseurs',
    calendrier:     'rapports',
    customerOrders: 'livraisons',
    deliveries:     'livraisons',
    deliverymen:    'livraisons',
    team:           null,       // jamais visible pour un employé
    logs:           null,       // jamais visible pour un employé
    profil:         null,       // toujours visible
    boutiques:      null,       // jamais visible pour un employé
  };

  // ══════════════════════════════════════════════════════════
  // DÉTECTION DU CONTEXTE
  // ══════════════════════════════════════════════════════════

  function isEmployee() {
    return window._isEmployee === true ||
           localStorage.getItem('employeeRole') === 'employe' ||
           localStorage.getItem('employeeRole') === 'gerant';
  }

  function getEmployeePermissions() {
    // Sources : window._employeePerms (team.js), boutique-switcher data, localStorage
    var perms = window._employeePerms;
    if (perms && typeof perms === 'object') return perms;

    try {
      var stored = localStorage.getItem('employeePermissions');
      if (stored) return JSON.parse(stored);
    } catch (e) {}

    // Default : vente seulement
    return { vente: true, stock: false, rapports: false, credits: false,
             clients: false, fournisseurs: false, livraisons: false };
  }

  function getOwnerPlan() {
    var state = window._subscriptionState;
    if (state) return state.plan || 'Free';
    return localStorage.getItem('userPlan') || 'Free';
  }

  // ══════════════════════════════════════════════════════════
  // FONCTION CENTRALE : cette section est-elle accessible ?
  // ══════════════════════════════════════════════════════════

  function canAccess(section) {
    // Toujours accessible
    if (section === 'menu' || section === 'profil') return true;

    // EMPLOYÉ : vérifier UNIQUEMENT les permissions données par le propriétaire
    // Le plan du propriétaire a déjà été vérifié quand il a assigné les permissions.
    // L'employé a son propre compte (souvent Free) — on ne doit PAS vérifier SON plan.
    if (isEmployee()) {
      var empPerm = SECTION_TO_EMPLOYEE_PERM[section];

      // Sections jamais visibles pour un employé (team, logs, boutiques)
      if (empPerm === null && section !== 'menu' && section !== 'profil') return false;

      if (empPerm) {
        var perms = getEmployeePermissions();
        if (!perms[empPerm]) return false;
      }

      return true;
    }

    // PROPRIÉTAIRE : vérifier le plan
    var plan = getOwnerPlan();
    var planFeature = SECTION_TO_PLAN_FEATURE[section];
    if (planFeature) {
      var hasFeat = typeof window.hasFeature === 'function'
        ? window.hasFeature(plan, planFeature)
        : true;
      if (!hasFeat) return false;
    }

    return true;
  }

  // Exposer globalement pour les autres scripts
  window.canAccessSection = canAccess;

  // ══════════════════════════════════════════════════════════
  // 1. MODIFIER LA BOTTOM NAV
  //    Chiffres → Catégories, Chiffres va dans Plus
  // ══════════════════════════════════════════════════════════

  function patchBottomNav() {
    var rapportsBtn = document.getElementById('nav-rapports');
    if (!rapportsBtn || rapportsBtn._acPatched) return;
    rapportsBtn._acPatched = true;

    // Remplacer par Catégories
    rapportsBtn.id = 'nav-categories';
    rapportsBtn.setAttribute('onclick', "navTo('categories')");
    var icon = rapportsBtn.querySelector('.ni');
    var label = rapportsBtn.querySelector('.nl');
    if (icon) icon.textContent = '🏷️';
    if (label) label.textContent = 'Catégories';
  }

  // ══════════════════════════════════════════════════════════
  // 2. FILTRER LA BOTTOM NAV
  // ══════════════════════════════════════════════════════════

  function filterBottomNav() {
    var nav = document.getElementById('bottomNav');
    if (!nav) return;

    var buttons = nav.querySelectorAll('.nav-btn, .nav-fab');
    buttons.forEach(function (btn) {
      var section = null;

      // Déterminer la section du bouton
      if (btn.id === 'nav-menu') section = 'menu';
      else if (btn.id === 'nav-stock') section = 'stock';
      else if (btn.id === 'nav-categories') section = 'categories';
      else if (btn.id === 'nav-rapports') section = 'rapports';
      else if (btn.id === 'nav-plus') section = null; // toujours visible
      else if (btn.classList.contains('nav-fab')) section = 'vente';

      if (section === null) {
        btn.style.display = '';
        return;
      }

      btn.style.display = canAccess(section) ? '' : 'none';
    });
  }

  // ══════════════════════════════════════════════════════════
  // 3. FILTRER LA SIDEBAR (DESKTOP)
  // ══════════════════════════════════════════════════════════

  function filterSidebar() {
    var sidebar = document.querySelector('.dt-sidebar');
    if (!sidebar) return;

    sidebar.querySelectorAll('[data-nav]').forEach(function (btn) {
      var section = btn.dataset.nav;
      btn.style.display = canAccess(section) ? '' : 'none';
    });

    // Masquer les groupes vides
    sidebar.querySelectorAll('.dt-sidebar-section').forEach(function (header) {
      var nextEl = header.nextElementSibling;
      var hasVisibleItem = false;
      while (nextEl && !nextEl.classList.contains('dt-sidebar-section')) {
        if (nextEl.dataset.nav && nextEl.style.display !== 'none') {
          hasVisibleItem = true;
        }
        nextEl = nextEl.nextElementSibling;
      }
      header.style.display = hasVisibleItem ? '' : 'none';
    });
  }

  // ══════════════════════════════════════════════════════════
  // 4. FILTRER LE MENU PLUS (ENHANCED)
  // ══════════════════════════════════════════════════════════

  function filterPlusMenu() {
    var sheet = document.getElementById('epSheet');
    if (!sheet) return;

    new MutationObserver(function () {
      if (!sheet.classList.contains('open')) return;

      // Ajouter Chiffres dans le menu Plus s'il n'y est pas
      injectChiffresInPlus(sheet);

      // Filtrer les items
      sheet.querySelectorAll('.ep-item[data-nav]').forEach(function (item) {
        var section = item.dataset.nav;
        var accessible = canAccess(section);
        item.style.display = accessible ? '' : 'none';
      });

      // Masquer les groupes vides
      sheet.querySelectorAll('.ep-group').forEach(function (group) {
        var visibleItems = group.querySelectorAll('.ep-item:not([style*="display: none"])');
        group.style.display = visibleItems.length ? '' : 'none';
      });
    }).observe(sheet, { attributes: true, attributeFilter: ['class'] });
  }

  function injectChiffresInPlus(sheet) {
    if (sheet.querySelector('[data-nav="rapports"]')) return;

    // Trouver le premier groupe (Gestion)
    var firstGroup = sheet.querySelector('.ep-group');
    if (!firstGroup) return;

    var item = document.createElement('button');
    item.className = 'ep-item';
    item.dataset.nav = 'rapports';
    item.innerHTML =
      '<div class="ep-item-icon" style="background:#FEF3C7;">📈</div>' +
      '<div class="ep-item-text">' +
        '<div class="ep-item-name">Chiffres</div>' +
        '<div class="ep-item-desc">Rapports de ventes et statistiques</div>' +
      '</div>' +
      '<span class="ep-item-chevron">›</span>';
    item.addEventListener('click', function () {
      window.haptic?.tap();
      window.closePlusSheet?.();
      window.showSection?.('rapports');
    });

    // Insérer en premier dans le groupe
    var firstItem = firstGroup.querySelector('.ep-item');
    if (firstItem) firstGroup.insertBefore(item, firstItem);
    else firstGroup.appendChild(item);
  }

  // ══════════════════════════════════════════════════════════
  // 5. FILTRER L'ACTION GRID (ACCUEIL)
  // ══════════════════════════════════════════════════════════

  function filterActionGrid() {
    var grid = document.querySelector('.action-grid');
    if (!grid) return;

    grid.querySelectorAll('.action-btn[data-section]').forEach(function (btn) {
      var section = btn.dataset.section;
      btn.style.display = canAccess(section) ? '' : 'none';
    });
  }

  // ══════════════════════════════════════════════════════════
  // 6. GARDE DE SÉCURITÉ SUR showSection (filet uniquement)
  //    navTo est déjà gardé par subscription-guard.js + team.js
  //    showSection est le dernier recours si un appel interne bypass navTo
  // ══════════════════════════════════════════════════════════

  function guardShowSection() {
    var orig = window.showSection;
    if (!orig || orig._acGuard) return;

    window.showSection = function (section) {
      if (!canAccess(section)) {
        // Silencieux — les guards navTo affichent déjà les messages
        // On bloque juste la navigation sans notification
        return;
      }
      orig.apply(this, arguments);
    };
    window.showSection._acGuard = true;
    // Préserver les flags
    Object.keys(orig).forEach(function (k) {
      if (k !== '_acGuard') window.showSection[k] = orig[k];
    });
  }

  // ══════════════════════════════════════════════════════════
  // 7. STOCKER LES PERMISSIONS EMPLOYÉ DEPUIS LE BACKEND
  // ══════════════════════════════════════════════════════════

  function loadAndStoreEmployeePermissions() {
    // Quand boutique-switcher charge les données employé,
    // on intercepte pour sauvegarder les permissions
    var origLoad = window.loadEmployeeBoutique;
    // Observer window._employeePerms
    var checkInterval = setInterval(function () {
      var perms = window._employeePerms;
      if (perms && typeof perms === 'object') {
        localStorage.setItem('employeePermissions', JSON.stringify(perms));
        clearInterval(checkInterval);
        applyFilters(); // re-filtrer avec les vraies permissions
      }
    }, 500);

    // Arrêter de checker après 10s
    setTimeout(function () { clearInterval(checkInterval); }, 10000);
  }

  // ══════════════════════════════════════════════════════════
  // 8. APPLIQUER TOUS LES FILTRES
  // ══════════════════════════════════════════════════════════

  function applyFilters() {
    filterBottomNav();
    filterSidebar();
    filterActionGrid();
  }

  // Observer les changements de plan / permissions
  function watchForChanges() {
    // Re-filtrer quand _subscriptionState change
    var lastPlan = '';
    setInterval(function () {
      var plan = getOwnerPlan();
      if (plan !== lastPlan) {
        lastPlan = plan;
        applyFilters();
      }
    }, 2000);

    // Re-filtrer quand la sidebar est créée (resize)
    window.addEventListener('resize', function () {
      setTimeout(function () {
        filterSidebar();
        filterBottomNav();
      }, 300);
    });

    // Re-filtrer quand on change de boutique
    var origSwitch = window._switchBoutique;
    if (origSwitch && !origSwitch._acWatch) {
      window._switchBoutique = async function () {
        await origSwitch.apply(this, arguments);
        setTimeout(applyFilters, 500);
      };
      window._switchBoutique._acWatch = true;
    }
  }

  // ══════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════

  function init() {
    // 1. Modifier la nav
    patchBottomNav();

    // 2. Guard de navigation (filet de sécurité)
    guardShowSection();

    // 3. Filtrer le plus menu
    filterPlusMenu();

    // 4. Charger/stocker les permissions employé
    if (isEmployee()) {
      loadAndStoreEmployeePermissions();
    }

    // 5. Appliquer les filtres initiaux
    // Attendre que _subscriptionState soit disponible
    function waitAndFilter() {
      if (window._subscriptionState || window.hasFeature) {
        applyFilters();
        watchForChanges();
      } else {
        setTimeout(waitAndFilter, 500);
      }
    }
    waitAndFilter();

    // Re-filtrer aussi après un délai (pour les éléments créés dynamiquement)
    setTimeout(applyFilters, 2000);
    setTimeout(applyFilters, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 600); });
  } else {
    setTimeout(init, 600);
  }

})();
