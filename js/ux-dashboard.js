/**
 * ux-dashboard.js — Dashboard accueil enrichi (#1 + #4)
 *
 * Injecte sur la page d'accueil :
 *   - Widget "Dernière vente" (nom, montant, temps écoulé, méthode)
 *   - Widget "Crédits en attente" (total, nb clients)
 *   - Active les animations CountUp sur les stats du header
 *
 * Se met à jour automatiquement via MutationObserver.
 *
 * INTÉGRATION : <script src="js/ux-dashboard.js"></script>
 */

(function () {

  var _lastVenteId = null;
  var _widgetEl = null;
  var PAY_ICONS = { especes: '💵', wave: '📱', orange: '📞', credit: '📝' };

  // ══════════════════════════════════════
  // WIDGET DERNIÈRE VENTE
  // ══════════════════════════════════════
  function getLastSale() {
    var ventes = window.appData?.ventes || [];
    for (var i = 0; i < ventes.length; i++) {
      if (!ventes[i]._optimistic) return ventes[i];
    }
    return null;
  }

  function timeAgo(date) {
    if (!date) return '';
    var diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (diff < 60) return 'il y a ' + diff + 's';
    if (diff < 3600) return 'il y a ' + Math.floor(diff / 60) + ' min';
    if (diff < 86400) return 'il y a ' + Math.floor(diff / 3600) + 'h';
    return 'il y a ' + Math.floor(diff / 86400) + 'j';
  }

  function renderLastSale(container) {
    var sale = getLastSale();
    var old = container.querySelector('#uxdLastSale');
    if (old) old.remove();

    var widget = document.createElement('div');
    widget.id = 'uxdLastSale';
    widget.className = 'uxd-widget';

    if (!sale) {
      widget.innerHTML = '<div class="uxd-widget-title">Dernière vente</div>' +
        '<div class="uxd-empty">Aucune vente aujourd\'hui — faites votre première vente !</div>';
    } else {
      var prod = (window.appData?.produits || []).find(function (p) { return Number(p.id) === Number(sale.product_id); });
      var name = sale.product_name || (prod ? prod.name : 'Produit');
      var total = Math.round(Number(sale.total) || 0);
      var method = (sale.payment_method || 'especes').toLowerCase();
      var icon = PAY_ICONS[method] || '💳';
      var date = sale.date || sale.created_at;
      var bg = method === 'wave' ? '#EFF6FF' : method === 'orange' ? '#FFFBEB' : method === 'credit' ? '#F5F3FF' : '#ECFDF5';

      widget.innerHTML = '<div class="uxd-widget-title">Dernière vente</div>' +
        '<div class="uxd-last-sale">' +
          '<div class="uxd-last-icon" style="background:' + bg + ';">' + icon + '</div>' +
          '<div class="uxd-last-info">' +
            '<div class="uxd-last-name">' + esc(name) + '</div>' +
            '<div class="uxd-last-meta">' + timeAgo(date) + ' · x' + (sale.quantity || 1) + '</div>' +
          '</div>' +
          '<div class="uxd-last-amount">' + total.toLocaleString('fr-FR') + ' F</div>' +
        '</div>';

      // Animation si nouvelle vente
      if (sale.id !== _lastVenteId) {
        widget.style.animation = 'uxpSlide .3s ease-out';
        _lastVenteId = sale.id;
      }
    }

    // Insérer avant "Actions rapides"
    var label = container.querySelector('.section-label');
    if (label) {
      container.insertBefore(widget, label);
    } else {
      container.appendChild(widget);
    }
  }

  // ══════════════════════════════════════
  // WIDGET CRÉDITS EN ATTENTE
  // ══════════════════════════════════════
  function renderCreditsWidget(container) {
    var old = container.querySelector('#uxdCredits');
    if (old) old.remove();

    var credits = window.appData?.credits || [];
    var unpaid = credits.filter(function (c) { return !c.paid; });
    if (!unpaid.length) return;

    var totalUnpaid = 0;
    unpaid.forEach(function (c) { totalUnpaid += Number(c.amount || c.total || 0); });

    var widget = document.createElement('div');
    widget.id = 'uxdCredits';
    widget.className = 'uxd-widget';
    widget.style.cursor = 'pointer';
    widget.innerHTML = '<div class="uxd-widget-title">Crédits en attente</div>' +
      '<div class="uxd-credits-bar">' +
        '<div class="uxd-credits-item" style="background:#FEE2E2;">' +
          '<div class="uxd-credits-val" style="color:var(--red);">' + Math.round(totalUnpaid).toLocaleString('fr-FR') + ' F</div>' +
          '<div class="uxd-credits-label">Total dû</div>' +
        '</div>' +
        '<div class="uxd-credits-item" style="background:#FEF3C7;">' +
          '<div class="uxd-credits-val" style="color:var(--orange);">' + unpaid.length + '</div>' +
          '<div class="uxd-credits-label">Client' + (unpaid.length > 1 ? 's' : '') + '</div>' +
        '</div>' +
      '</div>';

    widget.addEventListener('click', function () {
      window.haptic?.tap();
      window.showSection?.('credits');
    });

    var label = container.querySelector('.section-label');
    if (label) {
      container.insertBefore(widget, label);
    }
  }

  // ══════════════════════════════════════
  // REFRESH
  // ══════════════════════════════════════
  function refresh() {
    var menu = document.getElementById('menuSection');
    if (!menu) return;
    renderLastSale(menu);
    renderCreditsWidget(menu);
  }

  // ══════════════════════════════════════
  // OBSERVER — se met à jour quand les stats changent
  // ══════════════════════════════════════
  function startObserver() {
    var target = document.getElementById('chiffreAffaires');
    if (!target) { setTimeout(startObserver, 500); return; }

    var obs = new MutationObserver(function () {
      requestAnimationFrame(refresh);
    });
    obs.observe(target, { childList: true, characterData: true, subtree: true });

    // Premier rendu
    refresh();
  }

  // ══════════════════════════════════════
  // ACTIVATION COUNTUP (#4)
  // Les animations sont déjà dans countup.js,
  // on s'assure juste qu'il observe les bons éléments
  // ══════════════════════════════════════
  function ensureCountUp() {
    var header = document.querySelector('.today-float');
    if (!header) return;

    // Ajouter la classe pour que les valeurs animent
    header.querySelectorAll('.v').forEach(function (el) {
      if (!el._uxCountUp) {
        el._uxCountUp = true;
        // Petit bounce quand la valeur change
        var obs = new MutationObserver(function () {
          el.classList.remove('ux-bounce');
          void el.offsetWidth;
          el.classList.add('ux-bounce');
        });
        obs.observe(el, { childList: true, characterData: true, subtree: true });
      }
    });
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function init() {
    if (!window.appData) { setTimeout(init, 300); return; }
    startObserver();
    ensureCountUp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 600); });
  } else {
    setTimeout(init, 600);
  }

})();
