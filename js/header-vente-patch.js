/**
 * header-vente-patch.js — Patch DOM header + section vente
 *
 * Sans modifier index.html :
 *  1. Supprime le 💰 header-icon (remplacé par la cloche de notif)
 *  2. Ajoute un badge nombre d'articles sur le bouton ENCAISSER
 *  3. Ajoute un bouton "Vider le panier" dans le header vente
 *  4. Enveloppe total-bar + btn-encaisser dans une sticky bar
 *  5. Améliore le rendu du panier avec des rows compacts
 *
 * Requiert : css/header-vente.css (déjà chargé)
 *
 * Intégration dans index.html (après app.js) :
 *   <script src="js/header-vente-patch.js"></script>
 */

(function () {

  // ══════════════════════════════════════
  // 1. SUPPRIMER LE 💰 HEADER-ICON
  //    (la cloche de notification le remplace)
  // ══════════════════════════════════════
  function removeHeaderIcon() {
    const icon = document.querySelector('.header-icon');
    if (icon) icon.remove();
  }

  // ══════════════════════════════════════
  // 2. PATCH DE LA SECTION VENTE
  //    Sticky CTA + panier amélioré + vider
  // ══════════════════════════════════════
  function patchVenteSection() {
    const venteSection = document.getElementById('venteSection');
    if (!venteSection || venteSection._patched) return;
    venteSection._patched = true;

    // ── a. Remplacer le page-header par un header avec bouton Vider ──
    const oldHeader = venteSection.querySelector('.page-header');
    if (oldHeader) {
      const newHeader = document.createElement('div');
      newHeader.className = 'vente-page-header';
      newHeader.innerHTML = `
        <h2>💳 Vendre</h2>
        <button class="btn-vider-panier" id="btn-vider-panier" onclick="window._viderPanier()">
          🗑️ Vider
        </button>
      `;
      oldHeader.replaceWith(newHeader);
    }

    // ── b. Trouver total-bar et btn-encaisser ──
    const totalBar    = venteSection.querySelector('.total-bar');
    const btnEncaisser = venteSection.querySelector('.btn-encaisser');
    if (!totalBar || !btnEncaisser) return;

    // ── c. Créer la sticky bar ──
    const stickyBar = document.createElement('div');
    stickyBar.className = 'vente-sticky-cta';

    // Wrapper du bouton avec badge
    const btnWrapper = document.createElement('div');
    btnWrapper.className = 'btn-encaisser-wrapper';

    const badge = document.createElement('span');
    badge.className = 'btn-encaisser-badge';
    badge.id = 'encaisser-badge';
    badge.textContent = '0';

    // Déplacer total-bar et btn-encaisser dans la sticky bar
    totalBar.parentNode.insertBefore(stickyBar, totalBar);
    stickyBar.appendChild(totalBar);
    btnWrapper.appendChild(badge);
    btnWrapper.appendChild(btnEncaisser);
    stickyBar.appendChild(btnWrapper);

    // ── d. Wrapper la zone produits ──
    const sectionLabel  = venteSection.querySelector('.section-label');
    const categoriesDiv = document.getElementById('categoriesVente');
    const scanRow       = document.getElementById('vente-scan-btn-row');

    if (sectionLabel || categoriesDiv) {
      const productsArea = document.createElement('div');
      productsArea.className = 'vente-products-area';

      const anchor = scanRow || sectionLabel || categoriesDiv;
      if (anchor?.parentNode === venteSection) {
        venteSection.insertBefore(productsArea, anchor);
        if (scanRow) productsArea.appendChild(scanRow);
        if (sectionLabel) productsArea.appendChild(sectionLabel);
        if (categoriesDiv) productsArea.appendChild(categoriesDiv);
      }
    }

    // ── e. Désactiver le bouton ENCAISSER si panier vide ──
    updateEncaisserState();
  }

  // ══════════════════════════════════════
  // 3. PATCH afficherPanier
  //    Remplace le rendu panier par des rows compacts
  //    + met à jour le badge + bouton vider
  // ══════════════════════════════════════
  function patchAfficherPanier() {
    const orig = window.afficherPanier;
    if (!orig || orig._hvPatched) return;

    window.afficherPanier = function () {
      const panier = window.appData?.panier || [];
      const c      = document.getElementById('panierItems');
      const total  = document.getElementById('totalPanier');

      if (!c) { orig(); return; }

      if (!panier.length) {
        // Panier vide
        c.innerHTML = `
          <div class="panier-empty-state">
            <div class="empty-icon">🛒</div>
            <div class="empty-text">Votre panier est vide</div>
          </div>`;
        if (total) total.textContent = '0 F';
        updateEncaisserState(0);
        return;
      }

      // Render rows compacts
      c.innerHTML = '';
      let totalPrix = 0;
      let totalQte  = 0;

      panier.forEach(item => {
        const prix      = parseFloat(item.price) || 0;
        const qte       = parseInt(item.quantite) || 0;
        const sousTotal = prix * qte;
        totalPrix += sousTotal;
        totalQte  += qte;

        const row = document.createElement('div');
        row.className = 'panier-item-row';
        row.innerHTML = `
          <span class="panier-item-name">${item.name}</span>
          <div class="panier-qty-controls">
            <button class="panier-qty-btn minus" data-id="${item.id}" data-delta="-1">−</button>
            <span class="panier-qty-value">${qte}</span>
            <button class="panier-qty-btn plus"  data-id="${item.id}" data-delta="1">+</button>
          </div>
          <span class="panier-item-price">${sousTotal.toLocaleString('fr-FR')} F</span>
        `;

        // Wirer les boutons +/-
        row.querySelectorAll('[data-delta]').forEach(btn => {
          btn.addEventListener('click', () => {
            window.haptic?.tap();
            window.modifierQuantitePanier?.(item.id, parseInt(btn.dataset.delta));
          });
        });

        c.appendChild(row);
      });

      if (total) total.textContent = totalPrix.toLocaleString('fr-FR') + ' F';
      updateEncaisserState(totalQte);
    };

    window.afficherPanier._hvPatched = true;
  }

  // ══════════════════════════════════════
  // 4. HELPERS
  // ══════════════════════════════════════
  function updateEncaisserState(totalQte) {
    const panier = window.appData?.panier || [];
    const qte    = totalQte !== undefined ? totalQte : panier.reduce((s, i) => s + (i.quantite || 0), 0);

    // Badge sur le bouton ENCAISSER
    const badge = document.getElementById('encaisser-badge');
    if (badge) {
      badge.textContent = qte;
      badge.classList.toggle('visible', qte > 0);
    }

    // Désactiver/activer le bouton
    const btn = document.querySelector('.btn-encaisser');
    if (btn) {
      btn.disabled = qte === 0;
    }

    // Bouton Vider (visible si panier non vide)
    const viderBtn = document.getElementById('btn-vider-panier');
    if (viderBtn) {
      viderBtn.classList.toggle('visible', qte > 0);
    }
  }

  // Vider le panier
  window._viderPanier = function () {
    if (!window.appData?.panier?.length) return;
    if (!confirm('🗑️ Vider le panier ?')) return;
    window.haptic?.warning();
    window.appData.panier = [];
    window.saveAppDataLocal?.();
    window.afficherPanier?.();
    window.showNotification?.('🗑️ Panier vidé', 'info');
  };

  // ══════════════════════════════════════
  // 5. INIT
  // ══════════════════════════════════════
  function init() {
    removeHeaderIcon();
    patchVenteSection();
    patchAfficherPanier();

    // Re-patch si afficherPanier remplacé plus tard
    setTimeout(() => {
      if (window.afficherPanier && !window.afficherPanier._hvPatched) {
        patchAfficherPanier();
      }
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Recréer les patches après le switch boutique
  window.addEventListener('boutique:changed', () => {
    setTimeout(() => {
      if (window.afficherPanier && !window.afficherPanier._hvPatched) patchAfficherPanier();
      window.afficherPanier?.();
    }, 200);
  });

})();
