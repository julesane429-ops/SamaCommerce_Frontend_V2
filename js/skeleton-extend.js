/**
 * skeleton-extend.js — Extension des skeleton loaders
 *
 * Complète skeleton.js en couvrant les sections métier :
 * clients, fournisseurs, commandes, livraisons, customerOrders, deliveries.
 *
 * Intégration dans index.html (juste après skeleton.js) :
 *   <script src="js/skeleton.js"></script>
 *   <script src="js/skeleton-extend.js"></script>
 */

(function () {

  // ── Générateur de liste de cartes "sheet-item" (clients, fournisseurs…) ──
  function genListCards(n = 4, withSubline = true, withBadge = false) {
    return Array.from({ length: n }, () => `
      <div style="
        display:flex; align-items:center; gap:12px;
        padding:14px 16px; background:#fff;
        border-radius:16px; margin-bottom:8px;
        box-shadow:0 1px 4px rgba(0,0,0,.05);
      ">
        <div style="
          width:44px; height:44px; border-radius:14px; flex-shrink:0;
          background:linear-gradient(135deg,#E5E7EB,#D1D5DB);
          animation:sk-pulse 1.6s ease-in-out infinite;
        "></div>
        <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
          <div style="
            height:14px; border-radius:6px; width:55%;
            background:linear-gradient(135deg,#E5E7EB,#D1D5DB);
            animation:sk-pulse 1.6s ease-in-out infinite;
          "></div>
          ${withSubline ? `<div style="
            height:11px; border-radius:6px; width:35%;
            background:linear-gradient(135deg,#F3F4F6,#E5E7EB);
            animation:sk-pulse 1.6s ease-in-out infinite .2s;
          "></div>` : ''}
        </div>
        ${withBadge ? `<div style="
          width:56px; height:24px; border-radius:99px;
          background:linear-gradient(135deg,#E5E7EB,#D1D5DB);
          animation:sk-pulse 1.6s ease-in-out infinite .1s;
        "></div>` : ''}
      </div>
    `).join('');
  }

  // ── Générateur de tableau skeleton (commandes, livraisons) ──
  function genTableSkeleton(rows = 4, cols = 3) {
    const widths = ['55%', '35%', '20%', '30%', '15%'];
    return `
      <div style="overflow:hidden; border-radius:14px; background:#fff;
                  box-shadow:0 1px 6px rgba(0,0,0,.06);">
        ${Array.from({ length: rows }, (_, ri) => `
          <div style="
            display:flex; align-items:center; gap:10px;
            padding:12px 16px;
            ${ri < rows - 1 ? 'border-bottom:1px solid #F3F4F6;' : ''}
          ">
            ${Array.from({ length: cols }, (_, ci) => `
              <div style="
                flex:${ci === 0 ? 2 : 1}; height:12px; border-radius:5px;
                max-width:${widths[ci] || '40%'};
                background:linear-gradient(135deg,#E5E7EB,#D1D5DB);
                animation:sk-pulse 1.6s ease-in-out infinite ${ci * 0.1}s;
              "></div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── Injecteur générique ──
  function watchContainer(containerId, html, opts = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Déjà du contenu réel → ne rien faire
    const hasReal = container.children.length > 0 &&
      !Array.from(container.children).every(c => c.classList?.contains('sk-ext'));
    if (hasReal) return;

    // Injecter le wrapper skeleton
    const wrapper = document.createElement('div');
    wrapper.className = 'sk-ext';
    wrapper.innerHTML = html;
    container.appendChild(wrapper);

    // Observer : retirer dès que du vrai contenu apparaît
    const obs = new MutationObserver(() => {
      const realChildren = Array.from(container.children).filter(c => !c.classList?.contains('sk-ext'));
      if (realChildren.length > 0) {
        wrapper.remove();
        obs.disconnect();
      }
    });
    obs.observe(container, { childList: true });

    // Safety timeout
    const timeout = opts.timeout || 8000;
    setTimeout(() => { wrapper.remove(); obs.disconnect(); }, timeout);
  }

  // ── Injecter les styles keyframes si absents ──
  function injectStyles() {
    if (document.getElementById('sk-ext-styles')) return;
    const style = document.createElement('style');
    style.id = 'sk-ext-styles';
    style.textContent = `
      @keyframes sk-pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: .45; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Init sur DOMContentLoaded puis sur chaque pageChange ──
  function initSkeletons() {
    injectStyles();

    // Clients
    watchContainer('clientsList', genListCards(5, true, true));

    // Fournisseurs
    watchContainer('fournisseursList', genListCards(4, true, false));

    // Commandes réappro
    watchContainer('commandesList', genTableSkeleton(4, 4));

    // Livraisons réappro
    watchContainer('livraisonsList', genTableSkeleton(4, 3));

    // Commandes clients
    watchContainer('customerOrdersList', genTableSkeleton(5, 4));

    // Livraisons clients
    watchContainer('deliveriesList', genTableSkeleton(4, 4));
  }

  // Init au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSkeletons);
  } else {
    initSkeletons();
  }

  // Re-injecter à chaque ouverture de section (les conteneurs se vident au rechargement)
  window.addEventListener('pageChange', (e) => {
    const key = e.detail?.key;
    const map = {
      clients:       [['clientsList',         genListCards(5, true, true)]],
      fournisseurs:  [['fournisseursList',     genListCards(4)]],
      commandes:     [['commandesList',        genTableSkeleton(4, 4)]],
      livraisons:    [['livraisonsList',       genTableSkeleton(4, 3)]],
      customerOrders:[['customerOrdersList',   genTableSkeleton(5, 4)]],
      deliveries:    [['deliveriesList',       genTableSkeleton(4, 4)]],
    };
    if (map[key]) {
      // Petit délai pour laisser le module vider le conteneur d'abord
      setTimeout(() => {
        map[key].forEach(([id, html]) => watchContainer(id, html));
      }, 50);
    }
  });

  // Re-injecter au switch boutique (toutes les listes se rechargent)
  window.addEventListener('boutique:changed', () => {
    setTimeout(initSkeletons, 100);
  });

})();
