/**
 * ux-vente-boost.js — Produits récents & top ventes (#2)
 *
 * Injecte dans la section Vente, avant "Choisir produits" :
 *   - Rangée "Vendus récemment" (5 derniers produits distincts)
 *   - Rangée "Top ventes" (5 produits les plus vendus)
 *
 * Chaque chip ajoute directement au panier en 1 tap.
 * Se met à jour après chaque vente/sync.
 *
 * INTÉGRATION : <script src="js/ux-vente-boost.js"></script>
 */

(function () {

  var _containerEl = null;

  // ══════════════════════════════════════
  // DONNÉES
  // ══════════════════════════════════════
  function getRecentProducts() {
    var ventes = window.appData?.ventes || [];
    var prods = window.appData?.produits || [];
    var seen = {};
    var result = [];

    for (var i = 0; i < ventes.length && result.length < 5; i++) {
      var v = ventes[i];
      if (v._optimistic) continue;
      var pid = Number(v.product_id);
      if (seen[pid]) continue;
      seen[pid] = true;
      var p = prods.find(function (x) { return Number(x.id) === pid; });
      if (p && p.stock > 0) result.push(p);
    }
    return result;
  }

  function getTopProducts() {
    var ventes = window.appData?.ventes || [];
    var prods = window.appData?.produits || [];
    var counts = {};

    ventes.forEach(function (v) {
      if (v._optimistic) return;
      var pid = Number(v.product_id);
      counts[pid] = (counts[pid] || 0) + Number(v.quantity || 1);
    });

    var sorted = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var result = [];

    for (var i = 0; i < sorted.length && result.length < 5; i++) {
      var p = prods.find(function (x) { return Number(x.id) === Number(sorted[i]); });
      if (p && p.stock > 0) result.push(p);
    }
    return result;
  }

  // ══════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════
  function renderChips(products, labelIcon, labelText) {
    if (!products.length) return '';

    var html = '<div class="uxv-section">';
    html += '<div class="uxv-label">' + labelIcon + ' ' + labelText + '</div>';
    html += '<div class="uxv-scroll">';

    products.forEach(function (p) {
      html += '<div class="uxv-chip ux-ripple ux-ripple-dark" data-product-id="' + p.id + '">';
      html += '<div class="uxv-chip-name">' + esc(p.name) + '</div>';
      html += '<div class="uxv-chip-price">' + (p.price || 0).toLocaleString('fr-FR') + ' F</div>';
      html += '<div class="uxv-chip-stock">Stock: ' + (p.stock || 0) + '</div>';
      html += '</div>';
    });

    html += '</div></div>';
    return html;
  }

  function render() {
    if (!_containerEl) return;

    var recent = getRecentProducts();
    var top = getTopProducts();

    if (!recent.length && !top.length) {
      _containerEl.innerHTML = '';
      _containerEl.style.display = 'none';
      return;
    }

    _containerEl.style.display = 'block';
    var html = '';

    if (recent.length) {
      html += renderChips(recent, '🕐', 'Vendus récemment');
    }

    if (top.length) {
      html += renderChips(top, '🔥', 'Top ventes');
    }

    _containerEl.innerHTML = html;

    // Bind clicks → ajouter au panier
    _containerEl.querySelectorAll('.uxv-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var pid = Number(chip.dataset.productId);
        var prods = window.appData?.produits || [];
        var p = prods.find(function (x) { return Number(x.id) === pid; });
        if (!p) return;

        window.haptic?.tap();
        window.ajouterAuPanier?.(p);

        // Flash feedback
        chip.classList.add('ux-flash');
        setTimeout(function () { chip.classList.remove('ux-flash'); }, 400);
      });
    });
  }

  // ══════════════════════════════════════
  // INJECTION
  // ══════════════════════════════════════
  function inject() {
    var vente = document.getElementById('venteSection');
    if (!vente) return;

    var label = vente.querySelector('.section-label');
    if (!label) return;

    // Créer le conteneur si pas encore présent
    if (!_containerEl) {
      _containerEl = document.createElement('div');
      _containerEl.id = 'uxVenteBoost';
      label.parentNode.insertBefore(_containerEl, label);
    }

    render();
  }

  // ══════════════════════════════════════
  // OBSERVER — rafraîchir après chaque vente/sync
  // ══════════════════════════════════════
  function startObserver() {
    var target = document.getElementById('chiffreAffaires');
    if (!target) { setTimeout(startObserver, 500); return; }

    var obs = new MutationObserver(function () {
      requestAnimationFrame(inject);
    });
    obs.observe(target, { childList: true, characterData: true, subtree: true });

    // Premier rendu
    inject();

    // Aussi quand on navigue vers la section vente
    var origShow = window.showSection;
    if (origShow && !origShow._uxvHooked) {
      var hooked = function (section) {
        origShow(section);
        if (section === 'vente') setTimeout(inject, 100);
      };
      hooked._uxvHooked = true;
      window.showSection = hooked;
    }
  }

  // ══════════════════════════════════════
  // UTILS & INIT
  // ══════════════════════════════════════
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function init() {
    if (!window.appData) { setTimeout(init, 300); return; }
    startObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 700); });
  } else {
    setTimeout(init, 700);
  }

})();
