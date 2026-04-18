/**
 * fix-employee-sync.js — Synchronisation des permissions employé
 *
 * PROBLÈME : les permissions sont chargées une seule fois au login.
 *   Si le propriétaire les modifie, l'employé garde l'ancien accès
 *   jusqu'à Ctrl+F5.
 *
 * FIX : poll GET /members/my-boutique toutes les 45 secondes.
 *   Si les permissions ont changé, met à jour l'interface :
 *   - bottom nav, sidebar, action grid, menu plus
 *   - notifie l'employé du changement
 *
 * INTÉGRATION : <script src="js/fix-employee-sync.js"></script>
 *   (charger en dernier)
 */

(function () {

  var POLL_INTERVAL = 45000; // 45 secondes
  var _pollTimer = null;
  var _lastPermsHash = '';

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

  function hashPerms(perms) {
    if (!perms) return '';
    return JSON.stringify(perms);
  }

  // ══════════════════════════════════════════════════════════
  // VÉRIFIER LES PERMISSIONS
  // ══════════════════════════════════════════════════════════
  async function checkPermissions() {
    if (!isEmployee()) return;
    if (!localStorage.getItem('authToken')) return;

    try {
      var res = await window.authfetch?.(API() + '/members/my-boutique');
      if (!res?.ok) return;

      var data = await res.json();
      if (!data) return;

      var newPerms = data.permissions || {};
      if (typeof newPerms === 'string') {
        try { newPerms = JSON.parse(newPerms); } catch (e) { return; }
      }

      var newHash = hashPerms(newPerms);

      // Première exécution → stocker le hash sans notifier
      if (!_lastPermsHash) {
        _lastPermsHash = newHash;
        applyPermissions(newPerms, false);
        return;
      }

      // Pas de changement
      if (newHash === _lastPermsHash) return;

      // Permissions ont changé
      _lastPermsHash = newHash;
      applyPermissions(newPerms, true);

    } catch (e) {
      // Silencieux — erreur réseau, on réessaiera
    }
  }

  // ══════════════════════════════════════════════════════════
  // APPLIQUER LES PERMISSIONS SUR L'INTERFACE
  // ══════════════════════════════════════════════════════════
  function applyPermissions(perms, notify) {
    // 1. Mettre à jour les caches
    window._employeePerms = perms;
    window._employeeMode = true;
    localStorage.setItem('employeePermissions', JSON.stringify(perms));

    // 2. Notifier l'employé
    if (notify) {
      window.showNotification?.('🔔 Vos accès ont été mis à jour par votre gérant', 'info');
      window.haptic?.tap();
    }

    // 3. Mapping section → permission
    var SECTION_PERM = {
      vente:          'vente',
      stock:          'stock',
      categories:     'stock',       // stock inclut catégories
      rapports:       'rapports',
      inventaire:     'rapports',
      caisse:         'rapports',    // rapports inclut caisse
      calendrier:     'rapports',
      credits:        'credits',
      clients:        'clients',
      fournisseurs:   'fournisseurs',
      commandes:      'fournisseurs', // fournisseurs inclut commandes
      customerOrders: 'livraisons',
      deliveries:     'livraisons',
      deliverymen:    'livraisons',
    };

    // 4. Filtrer BOTTOM NAV
    var nav = document.getElementById('bottomNav');
    if (nav) {
      nav.querySelectorAll('.nav-btn, .nav-fab').forEach(function (btn) {
        var section = null;
        if (btn.id === 'nav-menu') section = 'menu';
        else if (btn.id === 'nav-stock') section = 'stock';
        else if (btn.id === 'nav-categories') section = 'categories';
        else if (btn.id === 'nav-rapports') section = 'rapports';
        else if (btn.id === 'nav-plus') { btn.style.display = ''; return; }
        else if (btn.classList.contains('nav-fab')) section = 'vente';

        if (!section || section === 'menu') { btn.style.display = ''; return; }
        var perm = SECTION_PERM[section];
        btn.style.display = (!perm || perms[perm]) ? '' : 'none';
      });
    }

    // 5. Filtrer SIDEBAR DESKTOP
    var sidebar = document.querySelector('.dt-sidebar');
    if (sidebar) {
      sidebar.querySelectorAll('[data-nav]').forEach(function (btn) {
        var section = btn.dataset.nav;
        if (section === 'menu' || section === 'profil') { btn.style.display = ''; return; }
        // Sections jamais visibles pour un employé
        if (['team', 'logs', 'boutiques'].indexOf(section) >= 0) { btn.style.display = 'none'; return; }
        var perm = SECTION_PERM[section];
        btn.style.display = (!perm || perms[perm]) ? '' : 'none';
      });

      // Masquer les groupes vides
      sidebar.querySelectorAll('.dt-sidebar-section').forEach(function (header) {
        var next = header.nextElementSibling;
        var hasVisible = false;
        while (next && !next.classList.contains('dt-sidebar-section')) {
          if (next.dataset?.nav && next.style.display !== 'none') hasVisible = true;
          next = next.nextElementSibling;
        }
        header.style.display = hasVisible ? '' : 'none';
      });
    }

    // 6. Filtrer ACTION GRID (accueil)
    var grid = document.querySelector('.action-grid');
    if (grid) {
      grid.querySelectorAll('.action-btn[data-section]').forEach(function (btn) {
        var section = btn.dataset.section;
        if (section === 'menu') { btn.style.display = ''; return; }
        var perm = SECTION_PERM[section];
        btn.style.display = (!perm || perms[perm]) ? '' : 'none';
      });
    }

    // 7. Filtrer les items du menu Plus (si ouvert)
    var epSheet = document.getElementById('epSheet');
    if (epSheet) {
      epSheet.querySelectorAll('.ep-item[data-nav]').forEach(function (item) {
        var section = item.dataset.nav;
        if (section === 'profil') { item.style.display = ''; return; }
        if (['team', 'logs', 'boutiques'].indexOf(section) >= 0) { item.style.display = 'none'; return; }
        var perm = SECTION_PERM[section];
        item.style.display = (!perm || perms[perm]) ? '' : 'none';
      });
    }

    // 8. Si l'employé est actuellement sur une section non autorisée, le rediriger
    var currentSection = window.currentSection;
    if (currentSection && currentSection !== 'menu' && currentSection !== 'profil') {
      var requiredPerm = SECTION_PERM[currentSection];
      if (requiredPerm && !perms[requiredPerm]) {
        window.showSection?.('menu');
        window.showNotification?.('🔒 Vous n\'avez plus accès à cette section', 'warning');
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // DÉMARRER LE POLLING
  // ══════════════════════════════════════════════════════════
  function startPolling() {
    if (_pollTimer) return;

    // Premier check immédiat
    checkPermissions();

    // Puis toutes les 45 secondes
    _pollTimer = setInterval(checkPermissions, POLL_INTERVAL);

    // Aussi vérifier quand l'app revient au premier plan
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) checkPermissions();
    });
  }

  function stopPolling() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  // ══════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════
  function init() {
    if (!isEmployee()) return;
    startPolling();
  }

  // Attendre que l'app soit chargée
  function waitAndInit() {
    if (!localStorage.getItem('authToken')) return;

    // Attendre que team.js ait posé ses flags
    if (isEmployee()) {
      setTimeout(init, 2000);
    } else {
      // Réessayer au cas où team.js n'a pas encore fini
      setTimeout(function () {
        if (isEmployee()) init();
      }, 5000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndInit);
  } else {
    waitAndInit();
  }

})();
