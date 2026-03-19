/**
 * vente-search.js — Recherche rapide dans la section Vendre
 *
 * Injecte une barre de recherche au-dessus de #categoriesVente.
 * Quand l'utilisateur tape, affiche une grille de produits filtrés
 * en remplacement des catégories. Taper sur un produit l'ajoute
 * au panier via ajouterAuPanier() existant.
 *
 * Quand le champ est vide, réaffiche les catégories normalement.
 *
 * INTÉGRATION dans index.html, juste avant </body> :
 *   <script src="js/vente-search.js"></script>
 */

(function () {

  // ══════════════════════════════════════
  // CONSTRUCTION DE L'UI
  // ══════════════════════════════════════
  function buildSearchBar(venteSection) {
    // Conteneur barre de recherche
    const wrap = document.createElement('div');
    wrap.className = 'vente-search-wrap';
    wrap.innerHTML = `
      <span class="vente-search-icon">🔍</span>
      <input
        type="search"
        id="venteSearchInput"
        class="vente-search-input"
        placeholder="Rechercher un produit…"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
      >
      <button class="vente-search-clear" id="venteSearchClear" aria-label="Effacer">✕</button>
    `;

    // Conteneur résultats (inséré après #categoriesVente)
    const results = document.createElement('div');
    results.id = 'vente-search-results';

    // Insérer avant le label "Choisir produits"
    const sectionLabel = venteSection.querySelector('.section-label');
    if (sectionLabel) {
      sectionLabel.parentNode.insertBefore(wrap, sectionLabel);
      sectionLabel.parentNode.insertBefore(results, sectionLabel);
    } else {
      // Fallback : insérer avant #categoriesVente
      const cv = document.getElementById('categoriesVente');
      if (cv) {
        cv.parentNode.insertBefore(wrap, cv);
        cv.parentNode.insertBefore(results, cv);
      }
    }

    return {
      input:   document.getElementById('venteSearchInput'),
      clear:   document.getElementById('venteSearchClear'),
      results,
    };
  }

  // ══════════════════════════════════════
  // HIGHLIGHT DU TERME DANS LE TEXTE
  // ══════════════════════════════════════
  function highlight(text, term) {
    if (!term) return text;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(
      new RegExp(`(${escaped})`, 'gi'),
      '<span class="sr-highlight">$1</span>'
    );
  }

  // ══════════════════════════════════════
  // RENDU DES RÉSULTATS
  // ══════════════════════════════════════
  function renderResults(results, term, appData) {
    const container = document.getElementById('vente-search-results');
    if (!container) return;

    container.innerHTML = '';

    if (results.length === 0) {
      container.innerHTML = `
        <div class="sr-label">Résultats pour « ${term} »</div>
        <div class="sr-empty">
          <div class="sr-empty-icon">🔎</div>
          <div class="sr-empty-text">Aucun produit trouvé</div>
        </div>
      `;
      container.classList.add('active');
      return;
    }

    // Label
    const label = document.createElement('div');
    label.className = 'sr-label';
    label.textContent = `${results.length} résultat${results.length > 1 ? 's' : ''} pour « ${term} »`;
    container.appendChild(label);

    results.forEach(produit => {
      const cat = appData.categories.find(c => c.id === produit.category_id);

      // Badge stock
      let stockClass = '';
      let stockText  = `${produit.stock} en stock`;
      if (produit.stock === 0)     { stockClass = 'out';  stockText = 'Rupture de stock'; }
      else if (produit.stock <= 5) { stockClass = 'low';  stockText = `⚠️ ${produit.stock} restants`; }

      const card = document.createElement('div');
      card.className = 'sr-card';
      card.innerHTML = `
        <div class="sr-cat-emoji">${cat ? cat.emoji + ' ' + cat.name : ''}</div>
        <div class="sr-name">${highlight(produit.name, term)}</div>
        <div class="sr-price">${(produit.price || 0).toLocaleString('fr-FR')} F</div>
        <div class="sr-stock ${stockClass}">${stockText}</div>
      `;

      // Ajouter au panier en cliquant
      if (produit.stock > 0) {
        card.addEventListener('click', () => {
          if (typeof window.ajouterAuPanier === 'function') {
            window.ajouterAuPanier(produit);
            // Feedback visuel rapide
            card.style.borderColor = '#10B981';
            card.style.boxShadow   = '0 0 0 3px rgba(16,185,129,.2)';
            setTimeout(() => {
              card.style.borderColor = '';
              card.style.boxShadow   = '';
            }, 500);
          }
        });
      } else {
        // Produit en rupture : désactiver
        card.style.opacity  = '.5';
        card.style.cursor   = 'not-allowed';
        card.style.pointerEvents = 'none';
      }

      container.appendChild(card);
    });

    container.classList.add('active');
  }

  // ══════════════════════════════════════
  // RECHERCHE DANS appData
  // ══════════════════════════════════════
  function searchProducts(term) {
    const appData = window.appData;
    if (!appData || !appData.produits) return [];

    const q = term.toLowerCase().trim();
    if (!q) return [];

    return appData.produits.filter(p => {
      // Chercher dans le nom
      if (p.name.toLowerCase().includes(q)) return true;
      // Chercher dans le nom de catégorie
      const cat = appData.categories.find(c => c.id === p.category_id);
      if (cat && cat.name.toLowerCase().includes(q)) return true;
      return false;
    });
  }

  // ══════════════════════════════════════
  // MONTRER / CACHER LES VUES
  // ══════════════════════════════════════
  function showSearchResults() {
    const cv      = document.getElementById('categoriesVente');
    const label   = document.querySelector('#venteSection .section-label');
    const results = document.getElementById('vente-search-results');
    if (cv)      cv.style.display      = 'none';
    if (label)   label.style.display   = 'none';
    if (results) results.classList.add('active');
  }

  function showCategories() {
    const cv      = document.getElementById('categoriesVente');
    const label   = document.querySelector('#venteSection .section-label');
    const results = document.getElementById('vente-search-results');
    if (cv)      cv.style.display      = '';
    if (label)   label.style.display   = '';
    if (results) {
      results.classList.remove('active');
      results.innerHTML = '';
    }
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    const venteSection = document.getElementById('venteSection');
    if (!venteSection) return;

    const { input, clear, results } = buildSearchBar(venteSection);
    if (!input) return;

    let debounceTimer = null;

    // ── Saisie ──
    input.addEventListener('input', () => {
      const term = input.value.trim();

      // Afficher / cacher le bouton croix
      clear.classList.toggle('visible', term.length > 0);

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!term) {
          showCategories();
          return;
        }

        const found = searchProducts(term);
        showSearchResults();
        renderResults(found, term, window.appData || { produits: [], categories: [] });
      }, 180); // debounce 180ms
    });

    // ── Effacer ──
    clear.addEventListener('click', () => {
      input.value = '';
      clear.classList.remove('visible');
      showCategories();
      input.focus();
    });

    // ── Fermer la recherche quand on change de section ──
    // (le champ se vide automatiquement à la navigation)
    window.addEventListener('pageChange', () => {
      input.value = '';
      clear.classList.remove('visible');
      showCategories();
    });
  }

  // Attendre que le DOM soit prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
