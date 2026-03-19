/**
 * skeleton.js — Skeleton loaders pour Sama Commerce
 *
 * Affiche des placeholders animés dans les conteneurs vides
 * pendant le chargement initial, puis les retire automatiquement
 * dès que le JS existant injecte du vrai contenu (via MutationObserver).
 *
 * INTÉGRATION dans index.html, juste avant </body> :
 *   <script src="js/skeleton.js"></script>
 *
 * Aucune modification du JS existant requise.
 * Fonctionne avec MutationObserver sur chaque conteneur.
 */

(function () {

  // ══════════════════════════════════════
  // GÉNÉRATEURS DE SQUELETTES
  // ══════════════════════════════════════

  /** Génère N cartes produit skeleton */
  function genProduits(n = 4) {
    return Array.from({ length: n }, () => `
      <div class="sk-produit-card">
        <div class="sk sk-produit-emoji"></div>
        <div class="sk-produit-body">
          <div class="sk sk-text-lg" style="width:65%;"></div>
          <div class="sk sk-text-sm" style="width:45%;"></div>
          <div class="sk-produit-actions">
            <div class="sk sk-produit-btn"></div>
            <div class="sk sk-produit-btn"></div>
            <div class="sk sk-produit-btn"></div>
          </div>
        </div>
      </div>
    `).join('');
  }

  /** Génère N cartes catégorie skeleton */
  function genCategories(n = 3) {
    return Array.from({ length: n }, () => `
      <div class="sk-category-card">
        <div class="sk-cat-top">
          <div style="display:flex;flex-direction:column;gap:8px;flex:1;">
            <div class="sk sk-text-xl" style="width:50px;height:50px;border-radius:14px;"></div>
            <div class="sk sk-text-lg" style="width:55%;"></div>
            <div class="sk sk-text-sm" style="width:35%;"></div>
          </div>
          <div class="sk" style="width:38px;height:38px;border-radius:10px;"></div>
        </div>
      </div>
    `).join('');
  }

  /** Génère N cartes vente (grille 2 colonnes) skeleton */
  function genVente(n = 4) {
    return `
      <div class="sk-vente-grid">
        ${Array.from({ length: n }, () => `
          <div class="sk-vente-card">
            <div class="sk sk-vente-emoji"></div>
            <div class="sk sk-vente-name"></div>
            <div class="sk sk-vente-count"></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /** Génère les tiles stats inventaire skeleton */
  function genInventaireStats(n = 4) {
    return `
      <div class="sk-stats-grid">
        ${Array.from({ length: n }, () => `
          <div class="sk-stat-tile">
            <div class="sk sk-text-sm" style="width:60%;"></div>
            <div class="sk sk-text-xl" style="width:80%;"></div>
            <div class="sk sk-text-sm" style="width:50%;"></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /** Génère N lignes historique skeleton */
  function genTableRows(n = 5) {
    return Array.from({ length: n }, () => `
      <div class="sk-table-row">
        <div class="sk sk-col sk-col-date"></div>
        <div class="sk sk-col sk-col-name"></div>
        <div class="sk sk-col sk-col-num"></div>
        <div class="sk sk-col sk-col-amt"></div>
        <div class="sk sk-col sk-col-badge"></div>
      </div>
    `).join('');
  }

  /** Génère les tiles crédit skeleton */
  function genCreditTiles() {
    return `
      <div class="sk-credit-tiles">
        ${Array.from({ length: 3 }, () => `
          <div class="sk-credit-tile">
            <div class="sk sk-text-xl" style="width:70%;"></div>
            <div class="sk sk-text-sm" style="width:55%;"></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /** Génère le résumé rapports skeleton (4 tiles 2x2) */
  function genRapportStats() {
    return `
      <div class="sk-stats-grid">
        ${Array.from({ length: 4 }, () => `
          <div class="sk-stat-tile">
            <div class="sk sk-text-xl" style="width:75%;"></div>
            <div class="sk sk-text-sm" style="width:55%;"></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ══════════════════════════════════════
  // LOGIQUE PRINCIPALE
  // ══════════════════════════════════════

  /**
   * Pour un conteneur donné :
   * 1. Injecter le squelette si le conteneur est vide
   * 2. Observer via MutationObserver
   * 3. Retirer le squelette dès qu'un vrai enfant apparaît
   *
   * @param {string}   containerId  ID du conteneur HTML
   * @param {string}   skHtml       HTML du squelette à injecter
   * @param {Function} [isEmpty]    Prédicat optionnel : le conteneur est-il "vide" ?
   */
  function watch(containerId, skHtml, isEmpty) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const defaultIsEmpty = (el) =>
      el.children.length === 0 ||
      (el.children.length === 1 && el.children[0].classList.contains('text-gray-500'));

    const checkEmpty = isEmpty || defaultIsEmpty;

    // Créer le wrapper skeleton
    const skWrapper = document.createElement('div');
    skWrapper.className = 'sk-wrapper';
    skWrapper.innerHTML = skHtml;

    function inject() {
      if (checkEmpty(container) && !container.querySelector('.sk-wrapper')) {
        container.parentNode.insertBefore(skWrapper, container);
        container.style.display = 'none';
      }
    }

    function removeSkeleton() {
      if (!checkEmpty(container)) {
        skWrapper.classList.add('sk-hidden');
        container.style.display = '';
        observer.disconnect();
      }
    }

    const observer = new MutationObserver(removeSkeleton);
    observer.observe(container, { childList: true, subtree: false });

    // Injecter si vide au démarrage
    inject();

    // Sécurité : retirer après 6s quoi qu'il arrive
    setTimeout(() => {
      skWrapper.classList.add('sk-hidden');
      container.style.display = '';
      observer.disconnect();
    }, 6000);
  }

  // ══════════════════════════════════════
  // INIT — après chargement du DOM
  // ══════════════════════════════════════
  function init() {

    // ── Produits (stock) ──
    watch('listeProduits', genProduits(4));

    // ── Catégories ──
    watch('listeCategories', genCategories(3));

    // ── Vente (choix catégories) ──
    watch('categoriesVente', genVente(4));

    // ── Stats inventaire ──
    watch(
      'inventaireStats',
      genInventaireStats(4),
      (el) => el.children.length === 0
    );

    // ── Historique ventes (tbody) ──
    watch(
      'salesHistoryBody',
      genTableRows(5),
      (el) => el.children.length === 0
    );

    // ── Historique crédits (tbody) ──
    watch(
      'creditsHistoryBody',
      genTableRows(4),
      (el) => el.children.length === 0
    );

    // ── Inventaire liste (tbody) ──
    watch(
      'inventaireListe',
      genTableRows(5),
      (el) => el.children.length === 0
    );

    // ── Résumé rapports ──
    // (Les tiles .st sont déjà dans le HTML mais avec "0 F" — pas besoin)

    // ── Produits populaires ──
    watch(
      'produitsPopulaires',
      `<div style="padding:8px 0;">
        ${Array.from({ length: 3 }, (_, i) => `
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #F3F4F6;">
            <div class="sk" style="width:28px;height:28px;border-radius:8px;flex-shrink:0;"></div>
            <div class="sk sk-text" style="flex:1;"></div>
            <div class="sk sk-text" style="width:70px;"></div>
          </div>
        `).join('')}
      </div>`,
      (el) => el.children.length === 0
    );

    // ── Paiements ──
    watch(
      'rapportsPaiements',
      `<div style="padding:4px 0;">
        ${Array.from({ length: 3 }, () => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #F3F4F6;">
            <div style="display:flex;gap:10px;align-items:center;">
              <div class="sk" style="width:32px;height:32px;border-radius:10px;flex-shrink:0;"></div>
              <div class="sk sk-text" style="width:90px;"></div>
            </div>
            <div class="sk sk-text-lg" style="width:80px;"></div>
          </div>
        `).join('')}
      </div>`,
      (el) => el.children.length === 0
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
