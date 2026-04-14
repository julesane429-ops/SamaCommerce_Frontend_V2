/**
 * virtual-lists.js — Virtualisation des listes longues
 *
 * Remplace les rendus complets innerHTML par des listes virtualisées :
 *   1. Produits (stockSection) : scroll infini au lieu de pagination
 *   2. Historique ventes (salesHistoryBody) : rendu progressif
 *
 * Technique : IntersectionObserver + recyclage DOM
 *   - Ne rend que les items visibles + buffer de 10
 *   - Sentinel en bas pour charger la suite
 *   - Supprime les items très éloignés du viewport
 *
 * INTÉGRATION : <script src="js/virtual-lists.js"></script>
 */

(function () {

  // ══════════════════════════════════════
  // CONFIG
  // ══════════════════════════════════════
  var PRODUCT_BATCH = 20;       // Produits affichés par lot
  var PRODUCT_BUFFER = 10;      // Buffer au-dessus/dessous
  var SALE_BATCH = 30;          // Ventes affichées par lot

  // ══════════════════════════════════════
  // 1. VIRTUAL SCROLL — PRODUITS
  // ══════════════════════════════════════
  var _prodState = {
    allProduits: [],
    rendered: 0,
    loading: false,
    observer: null,
    sentinel: null,
    filter: 'tous',
    container: null
  };

  function hookAfficherProduits() {
    var orig = window.afficherProduits;
    if (!orig) {
      setTimeout(hookAfficherProduits, 300);
      return;
    }
    if (orig._vlHooked) return;

    var hooked = function (categorieFilter) {
      if (typeof categorieFilter === 'undefined') categorieFilter = 'tous';
      virtualRenderProduits(categorieFilter);
    };
    hooked._vlHooked = true;
    window.afficherProduits = hooked;
  }

  function virtualRenderProduits(filter) {
    var container = document.getElementById('listeProduits');
    if (!container) return;

    var appData = window.appData;
    if (!appData || !appData.produits) return;

    // Filtrer
    var produits = appData.produits.slice();
    if (filter !== 'tous') {
      var catId = parseInt(filter);
      produits = produits.filter(function (p) { return parseInt(p.category_id) === catId; });
    }

    // Empty state
    if (produits.length === 0) {
      container.innerHTML = '';
      // L'empty state sera géré par quick-win-empty-states.js
      container.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-icon">📦</div>' +
          '<div class="empty-text">Aucun produit trouvé</div>' +
          '<div class="empty-sub">Ajoutez votre premier produit</div>' +
        '</div>';
      return;
    }

    // Reset
    container.innerHTML = '';
    _prodState.allProduits = produits;
    _prodState.rendered = 0;
    _prodState.filter = filter;
    _prodState.container = container;

    // Compteur
    var counter = document.createElement('div');
    counter.style.cssText = 'font-size:12px;color:var(--muted);padding:4px 2px 8px;font-weight:600;';
    counter.textContent = produits.length + ' produit' + (produits.length > 1 ? 's' : '');
    if (filter !== 'tous') {
      var cat = (appData.categories || []).find(function (c) { return c.id === parseInt(filter); });
      if (cat) counter.textContent += ' dans ' + (cat.emoji || '') + ' ' + cat.name;
    }
    container.appendChild(counter);

    // Rendre le premier lot
    renderProductBatch();

    // Sentinel
    injectProductSentinel();
  }

  function renderProductBatch() {
    var start = _prodState.rendered;
    var end = Math.min(start + PRODUCT_BATCH, _prodState.allProduits.length);
    var container = _prodState.container;
    if (!container) return;

    var appData = window.appData;
    if (!appData) return;

    for (var i = start; i < end; i++) {
      var produit = _prodState.allProduits[i];
      var el = createProductCard(produit, appData);
      container.appendChild(el);
    }

    _prodState.rendered = end;

    // Ré-injecter le sentinel
    if (_prodState.rendered < _prodState.allProduits.length) {
      injectProductSentinel();
    } else {
      removeProductSentinel();
    }
  }

  function createProductCard(produit, appData) {
    var categorie = (appData.categories || []).find(function (c) { return c.id === produit.category_id; });
    var stockLevel = produit.stock <= 5 ? 'critical' : produit.stock < 10 ? 'low' : 'ok';
    var stockLabel = stockLevel === 'critical' ? '🔴' : stockLevel === 'low' ? '🟠' : '🟢';
    var marge = (produit.price || 0) - (produit.priceAchat || produit.price_achat || 0);
    var margeSign = marge >= 0 ? '+' : '';

    var div = document.createElement('div');
    div.className = 'produit-card stock-' + stockLevel;
    div.dataset.productId = produit.id;
    div.innerHTML =
      '<div class="produit-card-header">' +
        '<div class="produit-cat-badge ' + (categorie ? (categorie.couleur || '') : '') + '">' +
          (categorie ? (categorie.emoji + ' ' + categorie.name) : '📦 Sans catégorie') +
        '</div>' +
        '<div class="produit-stock-pill stock-pill-' + stockLevel + '">' +
          stockLabel + ' ' + (produit.stock || 0) +
        '</div>' +
      '</div>' +
      '<div class="produit-card-body">' +
        '<div class="produit-name">' + (produit.name || '') + '</div>' +
        (produit.description ? '<div class="produit-desc">' + produit.description + '</div>' : '') +
        '<div class="produit-prices">' +
          '<div class="produit-price-main">' + (produit.price || 0).toLocaleString('fr-FR') + ' F</div>' +
          '<div class="produit-price-achat">Achat: ' + (produit.priceAchat || produit.price_achat || 0).toLocaleString('fr-FR') + ' F</div>' +
          '<div class="produit-marge ' + (marge >= 0 ? 'marge-pos' : 'marge-neg') + '">Marge: ' + margeSign + marge.toLocaleString('fr-FR') + ' F</div>' +
        '</div>' +
      '</div>' +
      '<div class="produit-card-actions">' +
        '<div class="produit-stock-controls">' +
          '<button class="btn-mod-stock-minus stock-btn">−</button>' +
          '<span class="stock-count">' + (produit.stock || 0) + '</span>' +
          '<button class="btn-mod-stock-plus stock-btn">+</button>' +
        '</div>' +
        '<div class="produit-action-btns">' +
          '<button class="btn-edit prd-btn prd-btn-edit">✏️ Éditer</button>' +
          '<button class="btn-suppr prd-btn prd-btn-del">🗑️</button>' +
        '</div>' +
      '</div>';

    // Event listeners
    div.querySelector('.btn-edit').addEventListener('click', function () {
      window.ouvrirModalEdit?.(produit);
    });
    div.querySelector('.btn-mod-stock-minus').addEventListener('click', function () {
      window.modifierStock?.(produit.id, -1);
    });
    div.querySelector('.btn-mod-stock-plus').addEventListener('click', function () {
      window.modifierStock?.(produit.id, 1);
    });
    div.querySelector('.btn-suppr').addEventListener('click', function () {
      window.supprimerProduit?.(produit.id);
    });

    return div;
  }

  function injectProductSentinel() {
    removeProductSentinel();

    var container = _prodState.container;
    if (!container) return;

    var sentinel = document.createElement('div');
    sentinel.id = 'vl-prod-sentinel';
    sentinel.style.cssText = 'height:1px;width:100%;';
    container.appendChild(sentinel);
    _prodState.sentinel = sentinel;

    // Observer
    if (_prodState.observer) _prodState.observer.disconnect();
    _prodState.observer = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && !_prodState.loading) {
        _prodState.loading = true;
        // Petit délai pour le rendu fluide
        requestAnimationFrame(function () {
          renderProductBatch();
          _prodState.loading = false;
        });
      }
    }, { rootMargin: '200px' });

    _prodState.observer.observe(sentinel);
  }

  function removeProductSentinel() {
    if (_prodState.observer) _prodState.observer.disconnect();
    var old = document.getElementById('vl-prod-sentinel');
    if (old) old.remove();
    _prodState.sentinel = null;
  }

  // ══════════════════════════════════════
  // 2. OPTIMISATION — HISTORIQUE VENTES
  // ══════════════════════════════════════
  // L'infinite scroll existe déjà (infinite-scroll-sales.js).
  // On optimise le rendu initial en différant les rows hors viewport.

  var _salesState = {
    pending: [],
    rendered: 0,
    observer: null,
    sentinel: null
  };

  function hookRenderSalesHistory() {
    var orig = window.renderSalesHistory;
    if (!orig) {
      setTimeout(hookRenderSalesHistory, 300);
      return;
    }
    if (orig._vlHooked) return;

    var hooked = function (ventes) {
      virtualRenderSales(ventes);
    };
    hooked._vlHooked = true;
    window.renderSalesHistory = hooked;
  }

  function virtualRenderSales(ventes) {
    // Purger les clones si la fonction existe
    if (window.purgeSalesHistoryClones) window.purgeSalesHistoryClones();

    var tbody = document.getElementById('salesHistoryBody');
    if (!tbody) return;

    var appData = window.appData;
    if (!appData) return;

    tbody.innerHTML = '';

    if (!Array.isArray(ventes) || ventes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 p-4">Aucune vente</td></tr>';
      return;
    }

    // Filtrer les optimistic
    var filtered = ventes.filter(function (v) { return !v._optimistic; });

    _salesState.pending = filtered;
    _salesState.rendered = 0;

    // Rendre le premier lot
    renderSalesBatch(tbody);

    // Sentinel
    injectSalesSentinel(tbody);
  }

  function renderSalesBatch(tbody) {
    if (!tbody) tbody = document.getElementById('salesHistoryBody');
    if (!tbody) return;

    var appData = window.appData;
    var produits = appData?.produits || [];
    var start = _salesState.rendered;
    var end = Math.min(start + SALE_BATCH, _salesState.pending.length);

    for (var i = start; i < end; i++) {
      var v = _salesState.pending[i];
      var prod = produits.find(function (p) { return Number(p.id) === Number(v.product_id); });
      var montant = Number.isFinite(Number(v.total)) ? Number(v.total) : 0;
      var nom = v.product_name || (prod ? prod.name : 'Inconnu');
      var date = new Date(v.date || v.created_at);
      var dateStr = isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });

      // Méthode de paiement avec icône
      var pm = v.payment_method || '';
      var pmIcon = pm === 'especes' ? '💵' : pm === 'wave' ? '📱' : pm === 'orange' ? '📞' : pm === 'credit' ? '📝' : '';
      var pmLabel = pmIcon ? pmIcon + ' ' + pm.charAt(0).toUpperCase() + pm.slice(1) : pm;

      var tr = document.createElement('tr');
      tr.dataset.saleId = v.id;
      tr.innerHTML =
        '<td class="p-2 border text-xs">' + dateStr + '</td>' +
        '<td class="p-2 border">' + nom + '</td>' +
        '<td class="p-2 border text-center">' + (v.quantity || 0) + '</td>' +
        '<td class="p-2 border text-right">' + montant.toLocaleString('fr-FR') + ' F</td>' +
        '<td class="p-2 border text-center">' + pmLabel + '</td>' +
        '<td class="p-2 border text-center">' +
          '<button class="bg-yellow-500 text-white px-2 py-1 rounded text-xs mr-1" data-edit="' + v.id + '">✏️</button>' +
          '<button class="bg-red-500 text-white px-2 py-1 rounded text-xs" data-delete="' + v.id + '">🗑️</button>' +
        '</td>';

      // Event delegation au lieu de onclick inline
      var editBtn = tr.querySelector('[data-edit]');
      var delBtn = tr.querySelector('[data-delete]');

      (function (saleId) {
        if (editBtn) editBtn.addEventListener('click', function () {
          window.haptic?.tap();
          window.modifierVente?.(saleId);
        });
        if (delBtn) delBtn.addEventListener('click', function () {
          window.haptic?.delete();
          window.annulerVente?.(saleId);
        });
      })(v.id);

      tbody.appendChild(tr);
    }

    _salesState.rendered = end;

    if (_salesState.rendered < _salesState.pending.length) {
      injectSalesSentinel(tbody);
    } else {
      removeSalesSentinel();
    }
  }

  function injectSalesSentinel(tbody) {
    removeSalesSentinel();

    var sentinel = document.createElement('tr');
    sentinel.id = 'vl-sales-sentinel';
    sentinel.innerHTML = '<td colspan="6" style="padding:12px;text-align:center;color:var(--muted);font-size:12px;">Chargement…</td>';
    tbody.appendChild(sentinel);
    _salesState.sentinel = sentinel;

    if (_salesState.observer) _salesState.observer.disconnect();
    _salesState.observer = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        requestAnimationFrame(function () {
          renderSalesBatch(tbody);
        });
      }
    }, { rootMargin: '300px' });

    _salesState.observer.observe(sentinel);
  }

  function removeSalesSentinel() {
    if (_salesState.observer) _salesState.observer.disconnect();
    var old = document.getElementById('vl-sales-sentinel');
    if (old) old.remove();
    _salesState.sentinel = null;
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    hookAfficherProduits();
    hookRenderSalesHistory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }

})();
