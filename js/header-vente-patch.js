/**
 * header-vente-patch.js — Patch DOM header + section vente
 * v2 — sans patch de window.afficherPanier (trop fragile avec les modules ES)
 *
 * Utilise MutationObserver sur #panierItems pour détecter les changements
 * du panier et mettre à jour le badge + bouton Vider en temps réel.
 *
 * Requiert : css/header-vente.css
 * Intégration dans index.html (après app.js) :
 *   <script src="js/header-vente-patch.js"></script>
 */

(function () {

  // ══════════════════════════════════════
  // 1. SUPPRIMER LE 💰 HEADER-ICON
  // ══════════════════════════════════════
  function removeHeaderIcon() {
    document.querySelector('.header-icon')?.remove();
  }

  // ══════════════════════════════════════
  // 2. PATCH DE LA SECTION VENTE
  // ══════════════════════════════════════
  function patchVenteSection() {
    const venteSection = document.getElementById('venteSection');
    if (!venteSection || venteSection._patched) return;
    venteSection._patched = true;

    // ── a. Remplacer le page-header ──
    const oldHeader = venteSection.querySelector('.page-header');
    if (oldHeader) {
      const newHeader = document.createElement('div');
      newHeader.className = 'vente-page-header';
      newHeader.innerHTML = `
        <h2>💳 Vendre</h2>
        <button class="btn-vider-panier" id="btn-vider-panier">
          🗑️ Vider
        </button>
      `;
      newHeader.querySelector('#btn-vider-panier')
        .addEventListener('click', viderPanier);
      oldHeader.replaceWith(newHeader);
    }

    // ── b. Récupérer total-bar et btn-encaisser ──
    const totalBar     = venteSection.querySelector('.total-bar');
    const btnEncaisser = venteSection.querySelector('.btn-encaisser');
    if (!totalBar || !btnEncaisser) return;

    // ── c. Créer la sticky bar ──
    const stickyBar = document.createElement('div');
    stickyBar.className = 'vente-sticky-cta';

    const btnWrapper = document.createElement('div');
    btnWrapper.className = 'btn-encaisser-wrapper';

    const badge = document.createElement('span');
    badge.className = 'btn-encaisser-badge';
    badge.id = 'encaisser-badge';

    // Déplacer dans la sticky bar
    totalBar.parentNode.insertBefore(stickyBar, totalBar);
    stickyBar.appendChild(totalBar);
    btnWrapper.appendChild(badge);
    btnWrapper.appendChild(btnEncaisser);
    stickyBar.appendChild(btnWrapper);

    // ── d. Wrapper la zone produits ──
    const sectionLabel  = venteSection.querySelector('.section-label');
    const categoriesDiv = document.getElementById('categoriesVente');
    const scanRow       = document.getElementById('vente-scan-btn-row');

    const anchor = scanRow || sectionLabel || categoriesDiv;
    if (anchor?.parentNode === venteSection) {
      const productsArea = document.createElement('div');
      productsArea.className = 'vente-products-area';
      venteSection.insertBefore(productsArea, anchor);
      if (scanRow)       productsArea.appendChild(scanRow);
      if (sectionLabel)  productsArea.appendChild(sectionLabel);
      if (categoriesDiv) productsArea.appendChild(categoriesDiv);
    }

    // ── e. Observer #panierItems via MutationObserver ──
    //    Pas de patch de window.afficherPanier — trop fragile avec ES modules.
    //    On observe directement le DOM de #panierItems.
    watchPanierItems();
  }

  // ══════════════════════════════════════
  // 3. OBSERVER #panierItems
  //    Déclenché chaque fois que ventes.js rerender le panier
  // ══════════════════════════════════════
  function watchPanierItems() {
    const panierItems = document.getElementById('panierItems');
    if (!panierItems) return;

    // Mise à jour initiale
    updateCartUI();

    // Observer les mutations (innerHTML changé par afficherPanier)
    const obs = new MutationObserver(() => updateCartUI());
    obs.observe(panierItems, { childList: true, subtree: true });
  }

  // ══════════════════════════════════════
  // 4. METTRE À JOUR L'UI DU PANIER
  //    Badge articles + bouton Vider + total-bar style
  // ══════════════════════════════════════
  function updateCartUI() {
    const panier = window.appData?.panier || [];
    const qte    = panier.reduce((s, i) => s + (parseInt(i.quantite) || 0), 0);

    // Badge nombre d'articles sur ENCAISSER
    const badge = document.getElementById('encaisser-badge');
    if (badge) {
      badge.textContent = qte > 0 ? qte : '';
      badge.classList.toggle('visible', qte > 0);
    }

    // Bouton Vider — visible seulement si panier non vide
    const viderBtn = document.getElementById('btn-vider-panier');
    if (viderBtn) {
      viderBtn.classList.toggle('visible', qte > 0);
    }

    // Total bar — légère animation quand on ajoute un item
    const totalBar = document.querySelector('.vente-sticky-cta .total-bar');
    if (totalBar && qte > 0) {
      totalBar.style.transition = 'transform .15s';
      totalBar.style.transform  = 'scale(1.02)';
      setTimeout(() => { totalBar.style.transform = ''; }, 150);
    }
  }

  // ══════════════════════════════════════
  // 5. VIDER LE PANIER
  // ══════════════════════════════════════
  function viderPanier() {
    if (!window.appData?.panier?.length) return;
    if (!confirm('🗑️ Vider le panier ?')) return;
    window.haptic?.warning();
    window.appData.panier = [];
    window.saveAppDataLocal?.();
    window.afficherPanier?.();   // appel window.afficherPanier (exposé par index.js)
    window.showNotification?.('🗑️ Panier vidé', 'info');
  }

  window._viderPanier = viderPanier;

  // ══════════════════════════════════════
  // 6. INIT
  // ══════════════════════════════════════
  function init() {
    removeHeaderIcon();

    if (document.getElementById('venteSection')) {
      patchVenteSection();
    } else {
      const obs = new MutationObserver(() => {
        if (document.getElementById('venteSection')) {
          obs.disconnect();
          patchVenteSection();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-patcher après switch boutique (l'UI se reconstruit)
  window.addEventListener('boutique:changed', () => {
    setTimeout(() => {
      const v = document.getElementById('venteSection');
      if (v) { v._patched = false; patchVenteSection(); }
      watchPanierItems();
    }, 300);
  });

})();
