/**
 * fix-employee-sync.js — Autorité finale des accès employé
 *
 * PROBLÈME : team.js et access-control.js se battent sur display:none.
 *   - team.js utilise les permissions individuelles et ne RE-MONTRE jamais
 *   - access-control.js a changé #nav-rapports → #nav-categories
 *   - Résultat : des incohérences après chaque changement de permissions
 *
 * FIX : ce script est le DERNIER MOT. Il :
 *   1. Attend que team.js ait fini (window._employeePerms existe)
 *   2. Applique le filtrage EXHAUSTIF sur TOUS les éléments de nav
 *   3. Explicitement MONTRE les éléments autorisés ET CACHE les interdits
 *   4. Poll toutes les 45s pour détecter les changements du propriétaire
 *   5. Se re-exécute après chaque changement détecté par MutationObserver
 *
 * INTÉGRATION : <script src="js/fix-employee-sync.js"></script>
 *   CHARGER EN TOUT DERNIER (après access-control.js et team.js)
 */

(function () {

  var POLL_MS = 45000;
  var _timer = null;
  var _lastHash = '';
  var _applied = false;

  function API() {
    return document.querySelector('meta[name="api-base"]')?.content ||
           'https://samacommerce-backend-v2.onrender.com';
  }

  function isEmployee() {
    return window._employeeMode === true ||
           window._isEmployee === true ||
           localStorage.getItem('employeeRole') === 'employe' ||
           localStorage.getItem('employeeRole') === 'gerant';
  }

  // ══════════════════════════════════════════════════════════
  // MAPPING SECTION → PERMISSION (lots groupés)
  // ══════════════════════════════════════════════════════════
  var S2P = {
    menu:           null,
    vente:          'vente',
    stock:          'stock',
    categories:     'stock',
    rapports:       'rapports',
    inventaire:     'rapports',
    caisse:         'rapports',
    calendrier:     'rapports',
    credits:        'credits',
    clients:        'clients',
    fournisseurs:   'fournisseurs',
    commandes:      'fournisseurs',
    customerOrders: 'livraisons',
    deliveries:     'livraisons',
    deliverymen:    'livraisons',
    team:           '_never',
    logs:           '_never',
    boutiques:      '_never',
    profil:         null,
  };

  function allowed(section, perms) {
    if (section === 'menu' || section === 'profil') return true;
    var key = S2P[section];
    if (!key) return false;          // inconnu → bloquer
    if (key === '_never') return false; // jamais pour un employé
    return !!perms[key];
  }

  // ══════════════════════════════════════════════════════════
  // APPLIQUER LE FILTRAGE COMPLET
  // Explicitement MONTRE les autorisés et CACHE les interdits
  // ══════════════════════════════════════════════════════════
  function applyAll(perms, notify) {
    perms = perms || {};
    _applied = true;

    // ── 1. BOTTOM NAV ──
    var nav = document.getElementById('bottomNav');
    if (nav) {
      nav.querySelectorAll('.nav-btn, .nav-fab').forEach(function (btn) {
        var section = detectSection(btn);
        if (section === null) { show(btn); return; } // Plus → toujours visible
        show(btn, allowed(section, perms));
      });
    }

    // ── 2. SIDEBAR DESKTOP ──
    var sidebar = document.querySelector('.dt-sidebar');
    if (sidebar) {
      sidebar.querySelectorAll('[data-nav]').forEach(function (btn) {
        show(btn, allowed(btn.dataset.nav, perms));
      });
      // FAB Vendre dans sidebar
      sidebar.querySelectorAll('.dt-sidebar-fab[data-nav]').forEach(function (btn) {
        show(btn, allowed(btn.dataset.nav, perms));
      });
      // Cacher les groupes vides
      sidebar.querySelectorAll('.dt-sidebar-section').forEach(function (header) {
        var next = header.nextElementSibling;
        var hasVis = false;
        while (next && !next.classList.contains('dt-sidebar-section')) {
          if (next.dataset?.nav && next.style.display !== 'none') hasVis = true;
          next = next.nextElementSibling;
        }
        show(header, hasVis);
      });
    }

    // ── 3. ACTION GRID (accueil) ──
    var grid = document.querySelector('.action-grid');
    if (grid) {
      grid.querySelectorAll('.action-btn[data-section]').forEach(function (btn) {
        show(btn, allowed(btn.dataset.section, perms));
      });
    }

    // ── 4. MENU PLUS (enhanced-plus-menu) ──
    var epSheet = document.getElementById('epSheet');
    if (epSheet) {
      filterPlusSheet(epSheet, perms);
      // Re-filtrer à chaque ouverture
      if (!epSheet._esSynced) {
        epSheet._esSynced = true;
        new MutationObserver(function () {
          if (epSheet.classList.contains('open')) filterPlusSheet(epSheet, perms);
        }).observe(epSheet, { attributes: true, attributeFilter: ['class'] });
      }
    }

    // ── 5. ÉLÉMENTS DIVERS ciblés par team.js ──
    // team.js cache aussi des éléments avec data-section et des sélecteurs spécifiques
    // On les re-montre/re-cache pour être sûr
    var allSelectors = {
      stock:        ['[data-section="stock"]'],
      categories:   ['[data-section="categories"]'],
      rapports:     ['[data-section="rapports"]'],
      caisse:       ['[data-section="caisse"]'],
      credits:      ['[data-section="credits"]'],
      clients:      ['[data-section="clients"]'],
      fournisseurs: ['[data-section="fournisseurs"]'],
      commandes:    ['[data-section="commandes"]'],
      livraisons:   ['[data-section="livraisons"]'],
      inventaire:   ['[data-section="inventaire"]'],
      customerOrders: ['[data-section="customerOrders"]'],
      deliveries:   ['[data-section="deliveries"]'],
      deliverymen:  ['[data-section="deliverymen"]'],
    };

    Object.keys(allSelectors).forEach(function (section) {
      var isAllowed = allowed(section, perms);
      allSelectors[section].forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) {
          // Ne pas toucher aux éléments dans la bottom nav ou sidebar (déjà gérés)
          if (el.closest('.bottom-nav') || el.closest('.dt-sidebar')) return;
          show(el, isAllowed);
        });
      });
    });

    // ── 6. REDIRECTION si sur une section non autorisée ──
    var cur = window.currentSection;
    if (cur && cur !== 'menu' && cur !== 'profil' && !allowed(cur, perms)) {
      window.showSection?.('menu');
      if (notify) window.showNotification?.('🔒 Vous n\'avez plus accès à cette section', 'warning');
    }

    // ── 7. NOTIFICATION ──
    if (notify) {
      window.showNotification?.('🔔 Vos accès ont été mis à jour', 'info');
      window.haptic?.tap();
    }
  }

  function filterPlusSheet(sheet, perms) {
    sheet.querySelectorAll('.ep-item[data-nav]').forEach(function (item) {
      var section = item.dataset.nav;
      show(item, allowed(section, perms));
    });
    // Cacher les groupes vides
    sheet.querySelectorAll('.ep-group').forEach(function (group) {
      var vis = group.querySelectorAll('.ep-item[data-nav]:not([style*="display: none"])');
      show(group, vis.length > 0);
    });
  }

  // ══════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════
  function show(el, visible) {
    if (visible === undefined) visible = true;
    el.style.display = visible ? '' : 'none';
  }

  function detectSection(btn) {
    if (btn.id === 'nav-menu') return 'menu';
    if (btn.id === 'nav-stock') return 'stock';
    if (btn.id === 'nav-categories') return 'categories';
    if (btn.id === 'nav-rapports') return 'rapports';
    if (btn.id === 'nav-plus') return null; // toujours visible
    if (btn.classList.contains('nav-fab')) return 'vente';
    // Fallback : onclick attribute
    var onclick = btn.getAttribute('onclick') || '';
    var m = onclick.match(/navTo\(['"](\w+)['"]\)/);
    if (m) return m[1];
    return 'menu';
  }

  // ══════════════════════════════════════════════════════════
  // POLLING — vérifie les changements de permissions
  // ══════════════════════════════════════════════════════════
  async function poll() {
    if (!isEmployee()) return;
    if (!localStorage.getItem('authToken')) return;

    try {
      var res = await window.authfetch?.(API() + '/members/my-boutique');
      if (!res?.ok) return;
      var data = await res.json();
      if (!data) return;

      var perms = data.permissions || {};
      if (typeof perms === 'string') {
        try { perms = JSON.parse(perms); } catch (e) { return; }
      }

      var hash = JSON.stringify(perms);

      // Stocker partout
      window._employeePerms = perms;
      window._employeeMode = true;
      localStorage.setItem('employeePermissions', JSON.stringify(perms));

      // Premier run ou changement ?
      var changed = _lastHash && hash !== _lastHash;
      _lastHash = hash;

      applyAll(perms, changed);
    } catch (e) { /* silencieux */ }
  }

  function startPolling() {
    poll(); // immédiat
    if (_timer) clearInterval(_timer);
    _timer = setInterval(poll, POLL_MS);

    // Aussi quand l'app revient au premier plan
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) poll();
    });
  }

  // ══════════════════════════════════════════════════════════
  // OBSERVATEUR DOM — re-filtrer quand la nav est modifiée
  // (par team.js, access-control.js, ux-responsive.js, etc.)
  // ══════════════════════════════════════════════════════════
  function watchDomChanges() {
    var targets = [
      document.getElementById('bottomNav'),
      document.querySelector('.dt-sidebar'),
      document.querySelector('.action-grid'),
    ].filter(Boolean);

    targets.forEach(function (target) {
      new MutationObserver(function () {
        if (!_applied) return;
        var perms = window._employeePerms;
        if (perms) setTimeout(function () { applyAll(perms, false); }, 50);
      }).observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    });
  }

  // ══════════════════════════════════════════════════════════
  // INIT — attendre que team.js ait posé ses flags
  // ══════════════════════════════════════════════════════════
  function init() {
    if (!isEmployee()) return;

    // Si team.js a déjà chargé les perms, on y va
    if (window._employeePerms) {
      _lastHash = JSON.stringify(window._employeePerms);
      applyAll(window._employeePerms, false);
      startPolling();
      watchDomChanges();
      return;
    }

    // Sinon attendre que team.js finisse son fetch
    var waitCount = 0;
    var waiter = setInterval(function () {
      waitCount++;
      if (window._employeePerms) {
        clearInterval(waiter);
        _lastHash = JSON.stringify(window._employeePerms);
        applyAll(window._employeePerms, false);
        startPolling();
        watchDomChanges();
      } else if (waitCount > 20) { // 10 secondes max
        clearInterval(waiter);
        // Forcer un poll
        startPolling();
        watchDomChanges();
      }
    }, 500);
  }

  // Démarrer après un délai pour laisser team.js et access-control.js finir
  function boot() {
    if (!localStorage.getItem('authToken')) return;
    setTimeout(function () {
      if (isEmployee()) init();
      else {
        // Réessayer plus tard (team.js peut mettre du temps à identifier l'employé)
        setTimeout(function () { if (isEmployee()) init(); }, 4000);
      }
    }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
