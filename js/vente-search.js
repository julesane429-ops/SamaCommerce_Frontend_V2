/**
 * vente-search.js v2 — Recherche rapide dans la section Vendre
 *
 * CORRECTIF v1 → v2 :
 * appData n'était pas exposé sur window dans index.js.
 * Fix en deux parties :
 *   1. Ajouter window.appData = appData; dans js/index.js (voir ci-dessous)
 *   2. Ce script lit window.appData avec un retry si pas encore dispo
 *
 * ─── MODIFICATION REQUISE dans js/index.js ───────────────────
 * Ajouter cette ligne juste après "window.logout = logout;" (ligne 21) :
 *
 *   window.appData = appData;
 *
 * ─────────────────────────────────────────────────────────────
 *
 * INTÉGRATION dans index.html, juste avant </body> :
 *   <script src="js/vente-search.js"></script>
 */

(function () {

  // ══════════════════════════════════════
  // ACCÈS À appData avec retry
  // ══════════════════════════════════════
  function getData() {
    // Tenter window.appData (exposé après le fix index.js)
    if (window.appData && Array.isArray(window.appData.produits)) {
      return window.appData;
    }
    return null;
  }

  // ══════════════════════════════════════
  // CONSTRUCTION DE L'UI
  // ══════════════════════════════════════
  function buildSearchBar(venteSection) {
    if (document.getElementById('venteSearchInput')) return null; // déjà injecté

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

    const results = document.createElement('div');
    results.id = 'vente-search-results';

    // Insérer avant le label "Choisir produits" ou avant #categoriesVente
    const cv = document.getElementById('categoriesVente');
    if (!cv) return null;

    // Chercher le .section-label juste avant #categoriesVente
    const sectionLabel = cv.previousElementSibling;
    const insertBefore = (sectionLabel && sectionLabel.classList.contains('section-label'))
      ? sectionLabel
      : cv;

    insertBefore.parentNode.insertBefore(wrap, insertBefore);
    insertBefore.parentNode.insertBefore(results, insertBefore);

    return {
      input:   document.getElementById('venteSearchInput'),
      clear:   document.getElementById('venteSearchClear'),
      results,
    };
  }

  // ══════════════════════════════════════
  // HIGHLIGHT
  // ══════════════════════════════════════
  function highlight(text, term) {
    if (!term) return text;
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${esc})`, 'gi'), '<span class="sr-highlight">$1</span>');
  }

  // ══════════════════════════════════════
  // RECHERCHE
  // ══════════════════════════════════════
  function searchProducts(term) {
    const data = getData();
    if (!data) return [];

    const q = term.toLowerCase().trim();
    if (!q) return [];

    return data.produits.filter(p => {
      if ((p.name || '').toLowerCase().includes(q)) return true;
      const cat = data.categories.find(c => c.id === p.category_id);
      if (cat && (cat.name || '').toLowerCase().includes(q)) return true;
      return false;
    });
  }

  // ══════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════
  function renderResults(found, term) {
    const container = document.getElementById('vente-search-results');
    if (!container) return;

    const data = getData();
    container.innerHTML = '';

    if (found.length === 0) {
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

    const label = document.createElement('div');
    label.className = 'sr-label';
    label.textContent = `${found.length} résultat${found.length > 1 ? 's' : ''} pour « ${term} »`;
    container.appendChild(label);

    found.forEach(produit => {
      const cat = data
        ? data.categories.find(c => c.id === produit.category_id)
        : null;

      let stockClass = '', stockText = `${produit.stock} en stock`;
      if (produit.stock === 0)     { stockClass = 'out'; stockText = 'Rupture de stock'; }
      else if (produit.stock <= 5) { stockClass = 'low'; stockText = `⚠️ ${produit.stock} restants`; }

      const card = document.createElement('div');
      card.className = 'sr-card';
      card.innerHTML = `
        <div class="sr-cat-emoji">${cat ? cat.emoji + ' ' + cat.name : ''}</div>
        <div class="sr-name">${highlight(produit.name, term)}</div>
        <div class="sr-price">${(produit.price || 0).toLocaleString('fr-FR')} F</div>
        <div class="sr-stock ${stockClass}">${stockText}</div>
      `;

      if (produit.stock > 0) {
        card.addEventListener('click', () => {
          if (typeof window.ajouterAuPanier === 'function') {
            window.ajouterAuPanier(produit);
            // Flash vert de confirmation
            card.style.transition   = 'border-color .15s, box-shadow .15s';
            card.style.borderColor  = '#10B981';
            card.style.boxShadow    = '0 0 0 3px rgba(16,185,129,.2)';
            setTimeout(() => {
              card.style.borderColor = '';
              card.style.boxShadow   = '';
            }, 500);
          }
        });
      } else {
        card.style.opacity       = '.45';
        card.style.cursor        = 'not-allowed';
        card.style.pointerEvents = 'none';
      }

      container.appendChild(card);
    });

    container.classList.add('active');
  }

  // ══════════════════════════════════════
  // AFFICHER / CACHER
  // ══════════════════════════════════════
  function showSearchView() {
    const cv    = document.getElementById('categoriesVente');
    const label = document.querySelector('#venteSection .section-label');
    const res   = document.getElementById('vente-search-results');
    if (cv)    cv.style.display    = 'none';
    if (label) label.style.display = 'none';
    if (res)   res.classList.add('active');
  }

  function showCategoryView() {
    const cv    = document.getElementById('categoriesVente');
    const label = document.querySelector('#venteSection .section-label');
    const res   = document.getElementById('vente-search-results');
    if (cv)    cv.style.display    = '';
    if (label) label.style.display = '';
    if (res)  { res.classList.remove('active'); res.innerHTML = ''; }
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    const venteSection = document.getElementById('venteSection');
    if (!venteSection) return;

    const ui = buildSearchBar(venteSection);
    if (!ui) return;

    const { input, clear } = ui;
    let debounce = null;

    input.addEventListener('input', () => {
      const term = input.value.trim();
      clear.classList.toggle('visible', term.length > 0);

      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (!term) { showCategoryView(); return; }

        // Si appData pas encore chargé → réessayer dans 300ms
        if (!getData()) {
          setTimeout(() => input.dispatchEvent(new Event('input')), 300);
          return;
        }

        const found = searchProducts(term);
        showSearchView();
        renderResults(found, term);
      }, 200);
    });

    clear.addEventListener('click', () => {
      input.value = '';
      clear.classList.remove('visible');
      showCategoryView();
      input.focus();
    });

    // Réinitialiser quand on change de section
    window.addEventListener('pageChange', () => {
      input.value = '';
      clear.classList.remove('visible');
      showCategoryView();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
