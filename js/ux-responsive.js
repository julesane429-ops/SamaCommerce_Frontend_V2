/**
 * ux-responsive.js — Ventes redesign + mode tablette/desktop
 *
 * 1. Remplace la table d'historique par des cartes colorées sur mobile
 * 2. Enrichit le widget "Dernière vente" avec les 3 dernières
 * 3. Injecte une sidebar navigation pour ≥ 768px
 * 4. Gère le basculement mobile ↔ desktop au resize
 *
 * INTÉGRATION :
 *   Ajouter ux-phase3.css au bundle features.css
 *   <script src="js/ux-responsive.js"></script>
 */

(function () {

  var PAY = {
    especes: { icon: '💵', label: 'Espèces', cls: 'especes' },
    wave:    { icon: '📱', label: 'Wave',    cls: 'wave' },
    orange:  { icon: '📞', label: 'OM',      cls: 'orange' },
    credit:  { icon: '📝', label: 'Crédit',  cls: 'credit' },
  };

  // ══════════════════════════════════════
  // 1. HISTORIQUE VENTES EN CARTES
  // ══════════════════════════════════════
  function overrideSalesHistory() {
    var orig = window.renderSalesHistory;
    if (!orig) return;
    if (orig._uxr) return;

    window.renderSalesHistory = function (ventes) {
      var tbody = document.getElementById('salesHistoryBody');
      if (!tbody) return;

      var card = tbody.closest('.card') || tbody.closest('#salesHistory');
      if (!card) { orig(ventes); return; }

      var filtered = (ventes || []).filter(function (v) { return !v._optimistic; });

      // Créer le conteneur de cartes s'il n'existe pas
      var container = card.querySelector('.sv-cards-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'sv-cards-container';
        var tableWrap = card.querySelector('[style*="overflow-x"]') || tbody.closest('table')?.parentElement;
        if (tableWrap) {
          tableWrap.style.display = 'none';
          tableWrap.insertAdjacentElement('afterend', container);
        } else {
          card.appendChild(container);
        }
      }

      container.innerHTML = '';

      if (!filtered.length) {
        container.innerHTML = '<div class="uxd-empty" style="padding:24px 0;">Aucune vente enregistrée</div>';
        updateCounter(card, 0, 0);
        return;
      }

      // Rendu par batch
      var BATCH = 30;
      var offset = { val: 0 };
      appendBatch(container, filtered, offset, BATCH);
      addSentinel(container, filtered, offset, BATCH);
      updateCounter(card, Math.min(offset.val, filtered.length), filtered.length);
    };
    window.renderSalesHistory._uxr = true;
  }

  function appendBatch(container, all, offset, batch) {
    var end = Math.min(offset.val + batch, all.length);
    var prods = window.appData?.produits || [];

    for (var i = offset.val; i < end; i++) {
      var v = all[i];
      var prod = prods.find(function (p) { return Number(p.id) === Number(v.product_id); });
      var name = v.product_name || (prod ? prod.name : 'Inconnu');
      var montant = Number.isFinite(Number(v.total)) ? Number(v.total) : (Number(v.price || 0) * Number(v.quantity || 0));
      var method = (v.payment_method || 'especes').toLowerCase();
      var pay = PAY[method] || PAY.especes;

      var el = document.createElement('div');
      el.className = 'sv-card pay-' + pay.cls;
      if (i >= batch) el.classList.add('vl-row-enter');

      el.innerHTML =
        '<div class="sv-top">' +
          '<div class="sv-icon sv-icon-' + pay.cls + '">' + pay.icon + '</div>' +
          '<div class="sv-info">' +
            '<div class="sv-name">' + esc(name) + '</div>' +
            '<div class="sv-date">' + fmtDate(v.date || v.created_at) + '</div>' +
          '</div>' +
          '<div class="sv-amount">' + Math.round(montant).toLocaleString('fr-FR') + ' F</div>' +
        '</div>' +
        '<div class="sv-bottom">' +
          '<div class="sv-meta">' +
            '<span class="sv-pill sv-pill-' + pay.cls + '">' + pay.icon + ' ' + pay.label + '</span>' +
            '<span>x' + (v.quantity || 1) + '</span>' +
          '</div>' +
          '<div class="sv-actions">' +
            '<button class="sv-btn sv-btn-edit" data-id="' + v.id + '">✏️</button>' +
            '<button class="sv-btn sv-btn-del" data-id="' + v.id + '">🗑️</button>' +
          '</div>' +
        '</div>';

      var sentinel = container.querySelector('.vl-sentinel');
      sentinel ? container.insertBefore(el, sentinel) : container.appendChild(el);

      el.querySelector('.sv-btn-edit').addEventListener('click', function () {
        window.haptic?.tap();
        window.modifierVente?.(Number(this.dataset.id));
      });
      el.querySelector('.sv-btn-del').addEventListener('click', function () {
        window.haptic?.delete();
        window.annulerVente?.(Number(this.dataset.id));
      });
    }
    offset.val = end;
    updateCounter(container.closest('.card') || container.parentElement, Math.min(offset.val, all.length), all.length);
  }

  function addSentinel(container, all, offset, batch) {
    var old = container.querySelector('.vl-sentinel');
    if (old) old.remove();
    if (offset.val >= all.length) return;

    var s = document.createElement('div');
    s.className = 'vl-sentinel';
    s.innerHTML = '<div class="vl-loader"><span class="vl-loader-dot"></span><span class="vl-loader-dot"></span><span class="vl-loader-dot"></span></div>';
    container.appendChild(s);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, obs) {
        if (entries[0].isIntersecting && offset.val < all.length) {
          appendBatch(container, all, offset, batch);
          offset.val < all.length ? addSentinel(container, all, offset, batch) : s.remove();
          obs.disconnect();
        }
      }, { rootMargin: '200px' }).observe(s);
    }
  }

  function updateCounter(card, shown, total) {
    if (!card) return;
    var c = card.querySelector('.vl-counter');
    if (!c) { c = document.createElement('div'); c.className = 'vl-counter'; card.insertBefore(c, card.querySelector('.sv-cards-container') || card.firstChild); }
    c.innerHTML = '<strong>' + shown + '</strong> / ' + total + ' vente' + (total > 1 ? 's' : '');
  }

  // ══════════════════════════════════════
  // 2. DASHBOARD — 3 DERNIÈRES VENTES
  // ══════════════════════════════════════
  function overrideDashboard() {
    // Remplacer le widget "Dernière vente" par les 3 dernières
    var origRefresh = null;

    function patchDashboard() {
      var menu = document.getElementById('menuSection');
      if (!menu) return;

      var old = menu.querySelector('#uxdLastSale');
      if (old) old.remove();

      var ventes = window.appData?.ventes || [];
      var prods = window.appData?.produits || [];
      var recent = [];
      for (var i = 0; i < ventes.length && recent.length < 3; i++) {
        if (!ventes[i]._optimistic) recent.push(ventes[i]);
      }

      var widget = document.createElement('div');
      widget.id = 'uxdLastSale';
      widget.className = 'uxd-widget-v2';

      if (!recent.length) {
        widget.innerHTML =
          '<div class="uxd-v2-header"><div class="uxd-v2-title">📊 Activité du jour</div></div>' +
          '<div class="uxd-empty">Aucune vente aujourd\'hui</div>';
      } else {
        var html = '<div class="uxd-v2-header">' +
          '<div class="uxd-v2-title">📊 Dernières ventes</div>' +
          '<span class="uxd-v2-badge">' + ventes.filter(function (v) { return !v._optimistic; }).length + ' total</span>' +
          '</div><div class="uxd-v2-list">';

        recent.forEach(function (v) {
          var prod = prods.find(function (p) { return Number(p.id) === Number(v.product_id); });
          var name = v.product_name || (prod ? prod.name : 'Produit');
          var total = Math.round(Number(v.total) || 0);
          var method = (v.payment_method || 'especes').toLowerCase();
          var pay = PAY[method] || PAY.especes;
          var bg = method === 'wave' ? '#EFF6FF' : method === 'orange' ? '#FFFBEB' : method === 'credit' ? '#FDF2F8' : '#ECFDF5';
          var color = method === 'wave' ? 'var(--blue)' : method === 'orange' ? 'var(--orange)' : method === 'credit' ? 'var(--accent,#EC4899)' : 'var(--green)';

          html += '<div class="uxd-v2-item">' +
            '<div class="uxd-v2-icon" style="background:' + bg + ';">' + pay.icon + '</div>' +
            '<div class="uxd-v2-info">' +
              '<div class="uxd-v2-name">' + esc(name) + '</div>' +
              '<div class="uxd-v2-time">' + timeAgo(v.date || v.created_at) + ' · x' + (v.quantity || 1) + '</div>' +
            '</div>' +
            '<div class="uxd-v2-amount" style="color:' + color + ';">' + total.toLocaleString('fr-FR') + ' F</div>' +
          '</div>';
        });

        html += '</div>';
        html += '<button class="uxd-v2-see-all">Voir tout l\'historique →</button>';
        widget.innerHTML = html;

        widget.querySelector('.uxd-v2-see-all').addEventListener('click', function () {
          window.haptic?.tap();
          window.showSection?.('rapports');
        });
      }

      var label = menu.querySelector('.section-label');
      if (label) menu.insertBefore(widget, label);
    }

    // Observer pour rafraîchir
    function watch() {
      var target = document.getElementById('chiffreAffaires');
      if (!target) { setTimeout(watch, 500); return; }
      new MutationObserver(function () {
        requestAnimationFrame(patchDashboard);
      }).observe(target, { childList: true, characterData: true, subtree: true });
      patchDashboard();
    }
    watch();
  }

  // ══════════════════════════════════════
  // 3. SIDEBAR NAVIGATION DESKTOP
  // ══════════════════════════════════════
  var NAV_ITEMS = [
    { section: 'menu',       icon: '🏠', label: 'Accueil',      group: 'principal' },
    { section: 'vente',      icon: '💳', label: 'Vendre',       group: 'principal', fab: true },
    { section: 'stock',      icon: '📦', label: 'Stock',        group: 'principal' },
    { section: 'rapports',   icon: '📈', label: 'Chiffres',     group: 'principal' },
    { section: 'categories',    icon: '🏷️', label: 'Catégories',   group: 'gestion' },
    { section: 'inventaire',    icon: '📋', label: 'Inventaire',   group: 'gestion' },
    { section: 'fournisseurs',  icon: '🏭', label: 'Fournisseurs', group: 'gestion' },
    { section: 'commandes',     icon: '📋', label: 'Réappro',      group: 'gestion' },
    { section: 'credits',       icon: '📝', label: 'Crédits',      group: 'finance' },
    { section: 'caisse',        icon: '🧾', label: 'Caisse',       group: 'finance' },
    { section: 'calendrier',    icon: '📅', label: 'Échéances',    group: 'finance' },
    { section: 'clients',       icon: '👥', label: 'Clients',      group: 'clients' },
    { section: 'customerOrders',icon: '📦', label: 'Commandes',    group: 'clients' },
    { section: 'deliveries',    icon: '🚚', label: 'Livraisons',   group: 'clients' },
    { section: 'profil',        icon: '👤', label: 'Mon Profil',   group: 'compte' },
  ];

  var GROUPS = {
    principal: null,
    gestion: 'Gestion',
    finance: 'Finance',
    clients: 'Clients',
    compte: 'Compte',
  };

  var _sidebar = null;
  var _isDesktop = false;

  function buildSidebar() {
    if (_sidebar) return;

    _sidebar = document.createElement('nav');
    _sidebar.className = 'dt-sidebar';
    _sidebar.setAttribute('aria-label', 'Navigation principale');

    var html = '<div class="dt-sidebar-logo">🏪 Sama Commerce</div>';
    var currentGroup = null;

    NAV_ITEMS.forEach(function (item) {
      if (item.fab) {
        html += '<button class="dt-sidebar-fab" data-nav="' + item.section + '">' + item.icon + ' ' + item.label + '</button>';
        return;
      }
      if (GROUPS[item.group] && item.group !== currentGroup) {
        currentGroup = item.group;
        html += '<div class="dt-sidebar-section">' + GROUPS[item.group] + '</div>';
      }
      html += '<button class="dt-sidebar-item" data-nav="' + item.section + '">' +
        '<span class="dt-sidebar-item-icon">' + item.icon + '</span>' +
        '<span class="dt-sidebar-item-label">' + item.label + '</span>' +
        '</button>';
    });

    _sidebar.innerHTML = html;
    document.body.insertBefore(_sidebar, document.body.firstChild);

    // Events
    _sidebar.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.haptic?.tap();
        window.showSection?.(btn.dataset.nav);
        updateSidebarActive(btn.dataset.nav);
      });
    });
  }

  function updateSidebarActive(section) {
    if (!_sidebar) return;
    _sidebar.querySelectorAll('.dt-sidebar-item, .dt-sidebar-fab').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.nav === section);
    });
  }

  function hookNavForSidebar() {
    var origShow = window.showSection;
    if (!origShow || origShow._uxrNav) return;

    var hooked = function (section) {
      origShow(section);
      if (_isDesktop) updateSidebarActive(section);
    };
    hooked._uxrNav = true;
    window.showSection = hooked;
  }

  // ══════════════════════════════════════
  // 4. RESPONSIVE SWITCHING
  // ══════════════════════════════════════
  function checkViewport() {
    var wide = window.innerWidth >= 768;
    if (wide === _isDesktop) return;
    _isDesktop = wide;

    if (wide) {
      buildSidebar();
      document.documentElement.classList.add('dt-layout');
      _sidebar.style.display = 'flex';
      updateSidebarActive(window.currentSection || 'menu');
    } else {
      document.documentElement.classList.remove('dt-layout');
      if (_sidebar) _sidebar.style.display = 'none';
    }
  }

  // ══════════════════════════════════════
  // UTILS
  // ══════════════════════════════════════
  function fmtDate(d) {
    if (!d) return '';
    try {
      var dt = new Date(d);
      var now = new Date();
      var isToday = dt.toDateString() === now.toDateString();
      if (isToday) {
        return 'Aujourd\'hui ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }
      return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return String(d); }
  }

  function timeAgo(date) {
    if (!date) return '';
    var diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (diff < 60) return 'il y a ' + diff + 's';
    if (diff < 3600) return 'il y a ' + Math.floor(diff / 60) + ' min';
    if (diff < 86400) return 'il y a ' + Math.floor(diff / 3600) + 'h';
    return 'il y a ' + Math.floor(diff / 86400) + 'j';
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    if (!window.appData) { setTimeout(init, 300); return; }

    overrideSalesHistory();
    overrideDashboard();
    hookNavForSidebar();

    // Check viewport now and on resize
    checkViewport();
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(checkViewport, 150);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 600); });
  } else {
    setTimeout(init, 600);
  }

})();
