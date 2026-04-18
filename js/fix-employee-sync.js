/**
 * fix-employee-sync.js v3 — Autorité finale des accès employé
 *
 * BUG 1 : team.js wraps navTo avec une closure sur `perms` capturée au login.
 *   Quand les permissions changent, la closure est STALE → clics bloqués.
 *   FIX : re-wraps navTo pour utiliser window._employeePerms (frais).
 *
 * BUG 2 : activity-logs-section.js crée #logsSection sans .hidden,
 *   et showLogsSection() cache toutes les .section-page sans restaurer.
 *   FIX : s'assure que logsSection a .hidden par défaut et est exclu du flow normal.
 *
 * + Polling 45s, DOM observer, filtrage exhaustif de toute la nav.
 *
 * CHARGER EN TOUT DERNIER.
 */

(function () {

  var POLL_MS = 45000;
  var _timer = null;
  var _lastHash = '';

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
    menu: null, vente: 'vente', stock: 'stock', categories: 'stock',
    rapports: 'rapports', inventaire: 'rapports', caisse: 'rapports',
    calendrier: 'rapports', credits: 'credits', clients: 'clients',
    fournisseurs: 'fournisseurs', commandes: 'fournisseurs',
    customerOrders: 'livraisons', deliveries: 'livraisons',
    deliverymen: 'livraisons', team: '_never', logs: '_never',
    boutiques: '_never', profil: null,
  };

  function allowed(section) {
    if (section === 'menu' || section === 'profil') return true;
    var key = S2P[section];
    if (!key) return true; // inconnu → laisser passer (pas employee-related)
    if (key === '_never') return false;
    var perms = window._employeePerms || {};
    return !!perms[key];
  }

  // ══════════════════════════════════════════════════════════
  // FIX 1 — RE-WRAPPER navTo AVEC PERMS FRAÎCHES
  // Le wrapper de team.js utilise une closure stale.
  // On le remplace par un wrapper qui lit window._employeePerms.
  // ══════════════════════════════════════════════════════════
  function fixNavTo() {
    var current = window.navTo;
    if (!current || current._esFixed) return;

    window.navTo = function (section) {
      // EMPLOYÉ : bypass la chaîne de wrappers (team.js a un closure stale)
      // → vérifier avec window._employeePerms (frais) puis showSection direct
      if (isEmployee()) {
        if (!allowed(section)) {
          window.haptic?.error();
          window.showNotification?.('🔒 Accès non autorisé', 'warning');
          return;
        }
        try { window.showSection?.(section); } catch (e) {}
        return;
      }
      // PROPRIÉTAIRE : laisser la chaîne normale (subscription-guard etc.)
      current.apply(this, arguments);
    };
    window.navTo._esFixed = true;
  }

  // ══════════════════════════════════════════════════════════
  // FIX 2 — CACHER LOGS SECTION PAR DÉFAUT
  // ══════════════════════════════════════════════════════════
  function fixLogsSection() {
    var logs = document.getElementById('logsSection');
    if (logs && !logs.classList.contains('hidden')) {
      // Ne cacher que si on n'est pas actuellement dessus
      if (window.currentSection !== 'logs') {
        logs.classList.add('hidden');
      }
    }
  }

  // Observer la création du logsSection (créé dynamiquement)
  function watchLogsCreation() {
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.id === 'logsSection' || (node.querySelector && node.querySelector('#logsSection'))) {
            var el = node.id === 'logsSection' ? node : node.querySelector('#logsSection');
            if (el && window.currentSection !== 'logs') {
              el.classList.add('hidden');
            }
          }
        });
      });
    }).observe(document.querySelector('.scroll-content') || document.body, { childList: true, subtree: true });
  }

  // Aussi : quand showSection est appelé pour une AUTRE section, s'assurer que logs est caché
  function patchShowSectionForLogs() {
    var orig = window.showSection;
    if (!orig || orig._esLogs) return;

    window.showSection = function (section) {
      // Si on navigue AILLEURS que logs, cacher logsSection
      if (section !== 'logs') {
        var logs = document.getElementById('logsSection');
        if (logs) logs.classList.add('hidden');
      }

      // Vérifier l'accès employé
      if (isEmployee() && !allowed(section)) {
        return; // silencieux — le guard navTo a déjà notifié
      }

      orig.apply(this, arguments);
    };
    window.showSection._esLogs = true;
    // Préserver les flags
    Object.keys(orig).forEach(function (k) {
      if (k !== '_esLogs') window.showSection[k] = orig[k];
    });
  }

  // ══════════════════════════════════════════════════════════
  // FILTRAGE EXHAUSTIF DE LA NAV
  // ══════════════════════════════════════════════════════════
  function show(el, visible) {
    el.style.display = (visible === false) ? 'none' : '';
  }

  function detectSection(btn) {
    if (btn.id === 'nav-menu') return 'menu';
    if (btn.id === 'nav-stock') return 'stock';
    if (btn.id === 'nav-categories') return 'categories';
    if (btn.id === 'nav-rapports') return 'rapports';
    if (btn.id === 'nav-plus') return null;
    if (btn.classList.contains('nav-fab')) return 'vente';
    var oc = btn.getAttribute('onclick') || '';
    var m = oc.match(/navTo\(['"](\w+)['"]\)/);
    return m ? m[1] : null;
  }

  function applyAll(notify) {
    var perms = window._employeePerms || {};

    // Bottom nav
    var nav = document.getElementById('bottomNav');
    if (nav) {
      nav.querySelectorAll('.nav-btn, .nav-fab').forEach(function (btn) {
        var s = detectSection(btn);
        if (s === null) { show(btn); return; }
        show(btn, allowed(s));
      });
    }

    // Sidebar
    var sidebar = document.querySelector('.dt-sidebar');
    if (sidebar) {
      sidebar.querySelectorAll('[data-nav]').forEach(function (btn) {
        show(btn, allowed(btn.dataset.nav));
      });
      sidebar.querySelectorAll('.dt-sidebar-fab[data-nav]').forEach(function (btn) {
        show(btn, allowed(btn.dataset.nav));
      });
      sidebar.querySelectorAll('.dt-sidebar-section').forEach(function (h) {
        var next = h.nextElementSibling;
        var has = false;
        while (next && !next.classList.contains('dt-sidebar-section')) {
          if (next.dataset?.nav && next.style.display !== 'none') has = true;
          next = next.nextElementSibling;
        }
        show(h, has);
      });
    }

    // Action grid
    var grid = document.querySelector('.action-grid');
    if (grid) {
      grid.querySelectorAll('.action-btn[data-section]').forEach(function (btn) {
        show(btn, allowed(btn.dataset.section));
      });
    }

    // Plus menu
    var ep = document.getElementById('epSheet');
    if (ep) {
      ep.querySelectorAll('.ep-item[data-nav]').forEach(function (i) {
        show(i, allowed(i.dataset.nav));
      });
      ep.querySelectorAll('.ep-group').forEach(function (g) {
        show(g, g.querySelectorAll('.ep-item[data-nav]:not([style*="display: none"])').length > 0);
      });
    }

    // Sections data-section elsewhere
    ['stock','categories','rapports','caisse','credits','clients','fournisseurs',
     'commandes','livraisons','inventaire','customerOrders','deliveries','deliverymen'].forEach(function (s) {
      document.querySelectorAll('[data-section="' + s + '"]').forEach(function (el) {
        if (el.closest('.bottom-nav,.dt-sidebar,.action-grid')) return;
        show(el, allowed(s));
      });
    });

    // Logs
    fixLogsSection();

    // Redirect si sur section non autorisée
    var cur = window.currentSection;
    if (cur && cur !== 'menu' && cur !== 'profil' && !allowed(cur)) {
      window.showSection?.('menu');
      if (notify) window.showNotification?.('🔒 Accès retiré', 'warning');
    }

    if (notify) {
      window.showNotification?.('🔔 Vos accès ont été mis à jour', 'info');
      window.haptic?.tap();
    }
  }

  // ══════════════════════════════════════════════════════════
  // POLLING
  // ══════════════════════════════════════════════════════════
  async function poll() {
    if (!isEmployee() || !localStorage.getItem('authToken')) return;

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
      window._employeePerms = perms;
      window._employeeMode = true;
      localStorage.setItem('employeePermissions', JSON.stringify(perms));

      var changed = _lastHash && hash !== _lastHash;
      _lastHash = hash;
      applyAll(changed);
    } catch (e) { /* silent */ }
  }

  // ══════════════════════════════════════════════════════════
  // DOM OBSERVER — re-filtrer quand d'autres scripts touchent la nav
  // ══════════════════════════════════════════════════════════
  function watchDom() {
    var _debounce = null;
    function refilter() {
      clearTimeout(_debounce);
      _debounce = setTimeout(function () { if (window._employeePerms) applyAll(false); }, 100);
    }

    [document.getElementById('bottomNav'),
     document.querySelector('.dt-sidebar'),
     document.querySelector('.action-grid')
    ].filter(Boolean).forEach(function (el) {
      new MutationObserver(refilter).observe(el, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['style']
      });
    });

    // Aussi surveiller le menu Plus
    var ep = document.getElementById('epSheet');
    if (ep) {
      new MutationObserver(function () {
        if (ep.classList.contains('open')) refilter();
      }).observe(ep, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // ══════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════
  function init() {
    if (!isEmployee()) return;

    fixNavTo();
    patchShowSectionForLogs();
    watchLogsCreation();

    // Attendre que team.js ait posé _employeePerms
    function waitPerms() {
      if (window._employeePerms) {
        _lastHash = JSON.stringify(window._employeePerms);
        applyAll(false);
        watchDom();
        // Démarrer le polling
        poll();
        if (_timer) clearInterval(_timer);
        _timer = setInterval(poll, POLL_MS);
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden) poll();
        });
      } else {
        setTimeout(waitPerms, 500);
      }
    }
    waitPerms();
  }

  function boot() {
    if (!localStorage.getItem('authToken')) return;
    // Laisser team.js finir son init
    setTimeout(function () {
      if (isEmployee()) init();
      else setTimeout(function () { if (isEmployee()) init(); }, 4000);
    }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
