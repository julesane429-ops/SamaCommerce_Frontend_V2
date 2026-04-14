/**
 * quick-win-cart.js — Panier amélioré
 *
 * Remplace l'affichage du panier par une version plus claire :
 *   - Stepper +/- stylisé avec retour haptic
 *   - Total par ligne visible
 *   - Empty state avec CTA "Parcourir les produits"
 *   - Badge quantité sur le bouton vente (nav-fab)
 *   - Animation de suppression
 *   - Résumé compact (X articles)
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <link rel="stylesheet" href="css/quick-wins.css"> (dans <head>)
 *   <script src="js/quick-win-cart.js"></script>
 */

(function () {

  // ══════════════════════════════════════
  // ATTENDRE LE CHARGEMENT
  // ══════════════════════════════════════
  let _ready = false;

  function init() {
    if (_ready) return;
    if (!window.afficherPanier) {
      setTimeout(init, 200);
      return;
    }
    _ready = true;
    overridePanier();
  }

  // ══════════════════════════════════════
  // REMPLACER afficherPanier
  // ══════════════════════════════════════
  function overridePanier() {
    const origAfficher = window.afficherPanier;

    window.afficherPanier = function () {
      const c = document.getElementById('panierItems');
      const totalEl = document.getElementById('totalPanier');
      if (!c) return;

      // Récupérer le panier depuis appData global
      const panier = window.appData?.panier || [];

      // ── Panier vide ──
      if (!panier.length) {
        c.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'qw-cart-empty';
        empty.innerHTML =
          '<div class="qw-cart-empty-icon">🛒</div>' +
          '<div class="qw-cart-empty-title">Votre panier est vide</div>' +
          '<div class="qw-cart-empty-sub">Sélectionnez des produits ci-dessous pour commencer une vente</div>' +
          '<button class="qw-cart-empty-cta" id="qwCartBrowse">🏷️ Parcourir les produits</button>';
        c.appendChild(empty);

        // Scroll vers les catégories
        const browseBtn = document.getElementById('qwCartBrowse');
        if (browseBtn) {
          browseBtn.addEventListener('click', function () {
            window.haptic?.tap();
            const cats = document.getElementById('categoriesVente');
            if (cats) cats.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }

        if (totalEl) totalEl.textContent = '0 F';
        updateCartBadge(0);
        return;
      }

      // ── Panier avec articles ──
      c.innerHTML = '';
      let totalPrix = 0;
      let totalArticles = 0;

      panier.forEach(function (item) {
        const prix = parseFloat(item.price) || 0;
        const qty = parseInt(item.quantite) || 0;
        const lineTotal = prix * qty;
        totalPrix += lineTotal;
        totalArticles += qty;

        const div = document.createElement('div');
        div.className = 'qw-cart-item';
        div.innerHTML =
          '<div class="qw-cart-info">' +
            '<div class="qw-cart-name">' + escapeHtml(item.name) + '</div>' +
            '<div class="qw-cart-price">' + prix.toLocaleString('fr-FR') + ' F × ' + qty + '</div>' +
            '<div class="qw-cart-line-total">' + lineTotal.toLocaleString('fr-FR') + ' F</div>' +
          '</div>' +
          '<div class="qw-stepper">' +
            '<button class="qw-stepper-btn minus" data-id="' + item.id + '" data-delta="-1" aria-label="Réduire">−</button>' +
            '<span class="qw-stepper-qty">' + qty + '</span>' +
            '<button class="qw-stepper-btn plus" data-id="' + item.id + '" data-delta="1" aria-label="Augmenter">+</button>' +
          '</div>';

        c.appendChild(div);

        // Events sur les boutons
        div.querySelectorAll('.qw-stepper-btn').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            window.haptic?.tap();
            const id = btn.dataset.id;
            const delta = parseInt(btn.dataset.delta);

            // Animation de suppression si on passe à 0
            if (delta === -1 && qty === 1) {
              div.classList.add('removing');
              setTimeout(function () {
                window.modifierQuantitePanier?.(id, delta);
              }, 180);
            } else {
              window.modifierQuantitePanier?.(id, delta);
            }
          });
        });
      });

      // ── Résumé compact ──
      if (panier.length > 1) {
        const summary = document.createElement('div');
        summary.className = 'qw-cart-summary';
        summary.innerHTML =
          '<span class="qw-cart-summary-count"><strong>' + totalArticles + '</strong> article' + (totalArticles > 1 ? 's' : '') + ' · ' + panier.length + ' produit' + (panier.length > 1 ? 's' : '') + '</span>';
        c.appendChild(summary);
      }

      if (totalEl) totalEl.textContent = totalPrix.toLocaleString('fr-FR') + ' F';
      updateCartBadge(totalArticles);
    };
  }

  // ══════════════════════════════════════
  // BADGE QUANTITÉ SUR NAV-FAB
  // ══════════════════════════════════════
  function updateCartBadge(count) {
    const fab = document.querySelector('.nav-fab');
    if (!fab) return;

    // Supprimer l'ancien badge
    const old = fab.querySelector('.qw-cart-badge');
    if (old) old.remove();

    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'qw-cart-badge';
      badge.textContent = count > 99 ? '99+' : count;
      fab.style.position = 'relative';
      fab.appendChild(badge);
    }
  }

  // ══════════════════════════════════════
  // UTILITAIRES
  // ══════════════════════════════════════
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ══════════════════════════════════════
  // DÉMARRAGE
  // ══════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
