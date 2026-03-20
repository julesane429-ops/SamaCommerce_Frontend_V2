/**
 * perf-sync.js — Sync paginée + Lazy loading produits
 *
 * Remplace le chargement "tout d'un coup" par :
 *   1. Sync paginée : ventes chargées par pages de 100
 *   2. Lazy loading produits : IntersectionObserver sur les cartes
 *   3. Virtualisation légère de la liste produits (max 50 visibles)
 *
 * INTÉGRATION : <script src="js/perf-sync.js"></script>
 */

(function () {

  const API  = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth = (url, o={}) => window.authfetch(url, o);

  const PAGE_SIZE = 100; // Ventes par page

  // ══════════════════════════════════════
  // SYNC PAGINÉE DES VENTES
  // ══════════════════════════════════════
  async function syncSalesPaginated(forceReload = false) {
    const data = window.appData;
    if (!data) return;

    // Si moins de 200 ventes → pas besoin de pagination
    if (!forceReload && (data.ventes?.length || 0) < 200) return;

    try {
      let page = 1, allSales = [], hasMore = true;

      while (hasMore) {
        const res  = await auth(`${API()}/sales?page=${page}&limit=${PAGE_SIZE}`);
        if (!res.ok) break;

        const rows = await res.json();
        allSales.push(...rows);

        if (rows.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          page++;
        }

        // Mettre à jour partiellement pour avoir un rendu progressif
        if (allSales.length % 200 === 0) {
          data.ventes = allSales;
          window.updateStats?.();
        }

        // Limit safety
        if (page > 50) break;
      }

      data.ventes = allSales;
      window.updateStats?.();
      console.log(`✅ Sync paginée : ${allSales.length} ventes chargées`);
    } catch (err) {
      console.warn('Sync paginée échouée, fallback normal', err);
    }
  }

  // ══════════════════════════════════════
  // LAZY LOADING DES IMAGES PRODUITS
  // ══════════════════════════════════════
  function lazyLoadProductImages() {
    if (!('IntersectionObserver' in window)) return;

    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          delete img.dataset.src;
          img.classList.remove('lazy');
          obs.unobserve(img);
        }
      });
    }, { rootMargin: '100px' });

    // Observer toutes les images avec data-src
    document.querySelectorAll('img.lazy[data-src]').forEach(img => obs.observe(img));

    // Aussi observer les nouvelles images ajoutées dynamiquement
    const mutObs = new MutationObserver(() => {
      document.querySelectorAll('img.lazy[data-src]').forEach(img => {
        if (!img._lazyObserved) {
          img._lazyObserved = true;
          obs.observe(img);
        }
      });
    });
    mutObs.observe(document.body, { childList:true, subtree:true });
  }

  // ══════════════════════════════════════
  // VIRTUALISATION LISTE PRODUITS
  // Afficher max 50 à la fois, charger en scrollant
  // ══════════════════════════════════════
  function virtualizeProduitsList() {
    const list = document.getElementById('listeProduits');
    if (!list) return;

    const obs = new MutationObserver(() => {
      const cards = Array.from(list.querySelectorAll('[data-produit-id], .product-card'));
      if (cards.length <= 50) return; // Pas besoin

      // Masquer les cartes au-delà de 50
      cards.forEach((card, i) => {
        card.style.display = i < 50 ? '' : 'none';
      });

      // Sentinel pour charger plus
      let sentinel = list.querySelector('#prod-load-more');
      if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = 'prod-load-more';
        sentinel.style.cssText = 'height:20px;width:100%;';
        list.appendChild(sentinel);

        let visible = 50;
        const loadObs = new IntersectionObserver(entries => {
          if (!entries[0].isIntersecting) return;
          const all = Array.from(list.querySelectorAll('[data-produit-id], .product-card'));
          const next = all.slice(visible, visible + 20);
          next.forEach(c => { c.style.display = ''; });
          visible += 20;
          if (visible >= all.length) loadObs.disconnect();
        });
        loadObs.observe(sentinel);
      }
    });

    obs.observe(list, { childList:true });
  }

  // ══════════════════════════════════════
  // DEBOUNCE AFFICHER PRODUITS
  // Éviter les re-renders inutiles rapprochés
  // ══════════════════════════════════════
  function debounceAfficherProduits() {
    const orig = window.afficherProduits;
    if (typeof orig !== 'function' || orig._debouncedPerf) return;

    let timer = null;
    window.afficherProduits = function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => orig.apply(this, args), 80);
    };
    window.afficherProduits._debouncedPerf = true;
  }

  // ══════════════════════════════════════
  // PATCH GET /sales backend (à ajouter dans routes/sales.js)
  // ══════════════════════════════════════
  /*
    // Remplacer le GET / par cette version paginée :
    router.get('/', verifyToken, async (req, res) => {
      try {
        const page  = Math.max(1, parseInt(req.query.page  || '1'));
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '0')));
        const offset = limit > 0 ? (page - 1) * limit : 0;
        const limitClause = limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : '';

        const result = await db.query(`
          SELECT s.*, p.name AS product_name
          FROM sales s
          JOIN products p ON s.product_id = p.id
          WHERE s.user_id = $1
          ORDER BY s.created_at DESC
          ${limitClause}
        `, [req.user.id]);

        res.json(result.rows);
      } catch (err) {
        console.error("Erreur GET /sales :", err);
        res.status(500).json({ error: 'Erreur serveur' });
      }
    });
  */

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    lazyLoadProductImages();
    virtualizeProduitsList();

    window.addEventListener('load', () => {
      setTimeout(() => {
        debounceAfficherProduits();
        // Sync paginée si gros dataset
        const nbVentes = window.appData?.ventes?.length || 0;
        if (nbVentes >= 200) {
          syncSalesPaginated(true);
        }
      }, 2000);
    });
  }

  window.perfSync = {
    syncPaginated: syncSalesPaginated,
    lazyLoad:      lazyLoadProductImages,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
