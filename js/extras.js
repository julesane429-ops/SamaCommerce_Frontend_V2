/**
 * extras.js — 6 améliorations UX restantes
 *
 * 1. Export Excel (Inventaire + Chiffres)
 * 2. Recherche rapide dans Stock
 * 3. Badge compteur crédits sur nav bar
 * 4. Confirmation visuelle remboursement
 * 5. Filtre période dans Stock
 * 6. Onboarding tooltips (première visite)
 *
 * INTÉGRATION dans index.html, juste avant </body> :
 *   <script src="js/extras.js"></script>
 *
 * PRÉREQUIS : ajouter SheetJS dans <head> :
 *   <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
 */

(function () {

  // ════════════════════════════════════════════════════════════
  // 1. EXPORT EXCEL
  // ════════════════════════════════════════════════════════════

  function exportInventaireExcel() {
    const data = window.appData;
    if (!data?.produits?.length) {
      window.showNotification?.('Aucun produit à exporter.', 'warning');
      return;
    }

    const rows = data.produits.map(p => {
      const achat  = p.priceAchat || p.price_achat || 0;
      const vente  = p.price || 0;
      const vendu  = p.vendu || 0;
      const stock  = p.stock || 0;
      const profit = vendu * (vente - achat);
      const marge  = achat > 0 ? ((vente - achat) / achat * 100).toFixed(1) + ' %' : '—';
      const cat    = data.categories?.find(c => c.id === p.category_id);

      return {
        'Produit':     p.name,
        'Catégorie':   cat ? cat.name : '—',
        'Prix achat':  achat,
        'Prix vente':  vente,
        'Stock':       stock,
        'Vendues':     vendu,
        'Bénéfice':    profit,
        'Marge %':     marge,
      };
    });

    const ws  = XLSX.utils.json_to_sheet(rows);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventaire');

    // Largeur automatique des colonnes
    const colWidths = Object.keys(rows[0]).map(k =>
      ({ wch: Math.max(k.length, ...rows.map(r => String(r[k]).length)) + 2 })
    );
    ws['!cols'] = colWidths;

    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `inventaire_${date}.xlsx`);
    window.showNotification?.('✅ Export Excel téléchargé !', 'success');
  }

  function exportChiffresExcel() {
    const data = window.appData;
    if (!data?.ventes?.length) {
      window.showNotification?.('Aucune vente à exporter.', 'warning');
      return;
    }

    const rows = data.ventes.map(v => {
      const prod = data.produits?.find(p => p.id === v.product_id);
      return {
        'Date':              v.created_at ? new Date(v.created_at).toLocaleDateString('fr-FR') : '—',
        'Produit':           prod?.name || v.product_name || '—',
        'Quantité':          v.quantity || 0,
        'Montant (F)':       v.total || 0,
        'Mode de paiement':  v.payment_method || '—',
        'Client':            v.client_name || '—',
        'Statut':            v.paid ? 'Encaissé' : 'Crédit',
      };
    });

    const ws  = XLSX.utils.json_to_sheet(rows);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ventes');

    const colWidths = Object.keys(rows[0]).map(k =>
      ({ wch: Math.max(k.length, ...rows.map(r => String(r[k]).length)) + 2 })
    );
    ws['!cols'] = colWidths;

    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `chiffres_${date}.xlsx`);
    window.showNotification?.('✅ Export Excel téléchargé !', 'success');
  }

  function injectExcelButtons() {
    // ── Inventaire ──
    const invHeader = document.querySelector('#inventaireSection .page-header, #page-inventaire .page-header');
    if (invHeader && !document.getElementById('btn-excel-inv')) {
      const pdfBtn = document.getElementById('btnPdfInventaire');
      if (pdfBtn) {
        const wrap = document.createElement('div');
        wrap.className = 'export-btns';
        pdfBtn.parentNode.insertBefore(wrap, pdfBtn);
        wrap.appendChild(pdfBtn);
        const excelBtn = document.createElement('button');
        excelBtn.id = 'btn-excel-inv';
        excelBtn.className = 'btn-excel';
        excelBtn.innerHTML = '📊 Excel';
        excelBtn.addEventListener('click', exportInventaireExcel);
        wrap.appendChild(excelBtn);
      }
    }

    // ── Chiffres ──
    const rapHeader = document.querySelector('#rapportsSection .page-header, #page-rapports .page-header');
    if (rapHeader && !document.getElementById('btn-excel-rap')) {
      const pdfBtn = document.getElementById('btnPdfRapports');
      if (pdfBtn) {
        const wrap = document.createElement('div');
        wrap.className = 'export-btns';
        pdfBtn.parentNode.insertBefore(wrap, pdfBtn);
        wrap.appendChild(pdfBtn);
        const excelBtn = document.createElement('button');
        excelBtn.id = 'btn-excel-rap';
        excelBtn.className = 'btn-excel';
        excelBtn.innerHTML = '📊 Excel';
        excelBtn.addEventListener('click', exportChiffresExcel);
        wrap.appendChild(excelBtn);
      }
    }
  }

  // Exposer globalement
  window.exportInventaireExcel = exportInventaireExcel;
  window.exportChiffresExcel   = exportChiffresExcel;


  // ════════════════════════════════════════════════════════════
  // 2. RECHERCHE RAPIDE STOCK
  // ════════════════════════════════════════════════════════════

  function injectStockSearch() {
    const stockSection = document.getElementById('stockSection') || document.getElementById('page-stock');
    if (!stockSection || document.getElementById('stockSearchInput')) return;

    const filtreDiv = document.getElementById('filtreCategories');
    if (!filtreDiv) return;

    const wrap = document.createElement('div');
    wrap.className = 'stock-search-wrap';
    wrap.innerHTML = `
      <span class="stock-search-icon">🔍</span>
      <input type="search" id="stockSearchInput" class="stock-search-input"
             placeholder="Rechercher dans le stock…"
             autocomplete="off" autocorrect="off" spellcheck="false">
      <button class="stock-search-clear" id="stockSearchClear">✕</button>
    `;

    filtreDiv.parentNode.insertBefore(wrap, filtreDiv);

    const input = document.getElementById('stockSearchInput');
    const clear = document.getElementById('stockSearchClear');

    input.addEventListener('input', () => {
      const term = input.value.trim().toLowerCase();
      clear.classList.toggle('visible', term.length > 0);

      // Filtrer les cartes visibles dans #listeProduits
      const cards = document.querySelectorAll('#listeProduits > div');
      cards.forEach(card => {
        const name = card.querySelector('.produit-nom, .text-lg, .font-bold')?.textContent?.toLowerCase() || card.textContent.toLowerCase();
        card.style.display = name.includes(term) ? '' : 'none';
      });

      // Si listeProduits est vide ou non chargé, filtrer via appData
      if (!cards.length && window.appData?.produits) {
        const filtered = window.appData.produits.filter(p =>
          (p.name || '').toLowerCase().includes(term)
        );
        window.afficherProduits?.();
        // Re-filter après render
        setTimeout(() => {
          document.querySelectorAll('#listeProduits > div').forEach(card => {
            const name = card.textContent.toLowerCase();
            card.style.display = name.includes(term) ? '' : 'none';
          });
        }, 100);
      }
    });

    clear.addEventListener('click', () => {
      input.value = '';
      clear.classList.remove('visible');
      document.querySelectorAll('#listeProduits > div').forEach(c => c.style.display = '');
      input.focus();
    });

    // Reset au changement de section
    window.addEventListener('pageChange', () => {
      input.value = '';
      clear.classList.remove('visible');
      document.querySelectorAll('#listeProduits > div').forEach(c => c.style.display = '');
    });
  }


  // ════════════════════════════════════════════════════════════
  // 3. BADGE COMPTEUR CRÉDITS SUR NAV BAR
  // ════════════════════════════════════════════════════════════

  function updateCreditBadge() {
    const data = window.appData;
    const count = data?.credits?.filter(c => !c.paid)?.length || 0;

    let badge = document.getElementById('nav-credit-badge');
    const navPlus = document.getElementById('nav-plus');
    if (!navPlus) return;

    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'nav-credit-badge';
      badge.className = 'nav-badge';
      navPlus.style.position = 'relative';
      navPlus.appendChild(badge);
    }

    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  // Observer les changements d'appData via MutationObserver sur #creditsTotalImpaye
  function watchCreditBadge() {
    updateCreditBadge();
    const el = document.getElementById('creditsTotalImpaye');
    if (!el) return;
    const observer = new MutationObserver(updateCreditBadge);
    observer.observe(el, { characterData: true, childList: true, subtree: true });
    // Aussi updater après sync
    window.addEventListener('pageChange', updateCreditBadge);
  }


  // ════════════════════════════════════════════════════════════
  // 4. CONFIRMATION VISUELLE REMBOURSEMENT
  // ════════════════════════════════════════════════════════════

  function buildRemboursTostElement() {
    if (document.getElementById('rembours-toast')) return;
    const el = document.createElement('div');
    el.id = 'rembours-toast';
    el.innerHTML = `
      <div class="rembours-icon">✅</div>
      <div class="rembours-title">Remboursement enregistré</div>
      <div class="rembours-sub" id="rembours-detail"></div>
    `;
    document.body.appendChild(el);
  }

  function showRemboursFeedback(method) {
    buildRemboursTostElement();
    const toast  = document.getElementById('rembours-toast');
    const detail = document.getElementById('rembours-detail');

    const labels = { especes: '💵 Espèces', wave: '📱 Wave', orange: '📞 Orange Money' };
    if (detail) detail.textContent = `Payé en ${labels[method] || method}`;

    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2000);
  }

  function hookRemboursement() {
    const orig = window.confirmerRemboursement;
    if (typeof orig !== 'function') {
      setTimeout(hookRemboursement, 200);
      return;
    }
    window.confirmerRemboursement = async function (method, ...args) {
      const result = await orig.call(this, method, ...args);
      showRemboursFeedback(method);
      updateCreditBadge();
      return result;
    };
  }


  // ════════════════════════════════════════════════════════════
  // 5. FILTRE PÉRIODE DANS STOCK
  // ════════════════════════════════════════════════════════════

  const PERIOD_LABELS = [
    { key: 'tout',    label: 'Tous' },
    { key: 'jour',    label: 'Aujourd\'hui' },
    { key: 'semaine', label: 'Cette semaine' },
    { key: 'mois',    label: 'Ce mois' },
  ];

  let currentStockPeriod = 'tout';

  function injectStockPeriodChips() {
    const filtreDiv = document.getElementById('filtreCategories');
    if (!filtreDiv || document.getElementById('stock-period-chips')) return;

    const wrap = document.createElement('div');
    wrap.className = 'stock-period-chips';
    wrap.id = 'stock-period-chips';

    PERIOD_LABELS.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'period-chip' + (p.key === 'tout' ? ' active' : '');
      btn.dataset.period = p.key;
      btn.textContent = p.label;
      btn.addEventListener('click', () => {
        currentStockPeriod = p.key;
        wrap.querySelectorAll('.period-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyStockPeriodFilter();
      });
      wrap.appendChild(btn);
    });

    filtreDiv.parentNode.insertBefore(wrap, filtreDiv.nextSibling);
  }

  function applyStockPeriodFilter() {
    if (currentStockPeriod === 'tout') {
      document.querySelectorAll('#listeProduits > div').forEach(c => c.style.display = '');
      return;
    }

    const data = window.appData;
    if (!data?.ventes || !data?.produits) return;

    const now = new Date();

    // Compter les ventes par produit sur la période
    const ventesMap = {};
    data.ventes.forEach(v => {
      const raw = v.created_at || v.date;
      if (!raw) return;
      const d = new Date(raw);

      let inPeriod = false;
      if (currentStockPeriod === 'jour')    inPeriod = d.toDateString() === now.toDateString();
      if (currentStockPeriod === 'semaine') {
        const ws = new Date(now); ws.setDate(now.getDate() - now.getDay());
        inPeriod = d >= ws && d <= now;
      }
      if (currentStockPeriod === 'mois') inPeriod = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();

      if (inPeriod) {
        ventesMap[v.product_id] = (ventesMap[v.product_id] || 0) + (v.quantity || 0);
      }
    });

    // Afficher uniquement les produits qui ont été vendus sur la période
    const activeIds = new Set(Object.keys(ventesMap).map(String));

    document.querySelectorAll('#listeProduits > div').forEach(card => {
      // Trouver l'ID du produit depuis les boutons (data-id ou via le nom)
      const btn = card.querySelector('[onclick*="supprimerProduit"]') || card.querySelector('.btn-suppr');
      if (btn) {
        // Essayer de récupérer l'ID depuis l'attribut onclick
        const match = (btn.getAttribute('onclick') || '').match(/\d+/);
        if (match) {
          card.style.display = activeIds.has(match[0]) ? '' : 'none';
          return;
        }
      }
      // Fallback : chercher dans le nom du produit
      const name = card.querySelector('.text-lg.font-bold, .produit-nom, .font-bold')?.textContent?.trim();
      if (name) {
        const prod = data.produits.find(p => p.name === name);
        if (prod) {
          card.style.display = activeIds.has(String(prod.id)) ? '' : 'none';
          return;
        }
      }
      card.style.display = '';
    });
  }


  // ════════════════════════════════════════════════════════════
  // 6. ONBOARDING TOOLTIPS
  // ════════════════════════════════════════════════════════════

  const ONB_KEY = 'sc_onboarding_done';

  const STEPS = [
    {
      targetId:   'nav-menu',
      title:      '👋 Bienvenue !',
      text:       'Vous êtes sur l\'accueil. Toutes les infos clés de votre boutique sont ici.',
      arrow:      'arrow-bottom',
      position:   'top',
    },
    {
      targetId:   'nav-stock',
      title:      '📦 Stock',
      text:       'Gérez vos produits, ajustez les prix et les quantités en stock.',
      arrow:      'arrow-bottom',
      position:   'top',
    },
    {
      targetSelector: '.nav-fab',
      title:      '💳 Vendre',
      text:       'Appuyez ici pour démarrer une vente. Choisissez les produits et encaissez.',
      arrow:      'arrow-bottom',
      position:   'top',
    },
    {
      targetId:   'nav-rapports',
      title:      '📈 Chiffres',
      text:       'Consultez votre CA, vos graphiques et l\'historique de toutes vos ventes.',
      arrow:      'arrow-bottom',
      position:   'top',
    },
    {
      targetId:   'nav-plus',
      title:      '☰ Plus',
      text:       'Accédez aux Catégories, l\'Inventaire et la gestion des Crédits clients.',
      arrow:      'arrow-bottom',
      position:   'top',
    },
  ];

  let onbStep  = 0;
  let onbOverlay = null;

  function getStepTarget(step) {
    if (step.targetId)       return document.getElementById(step.targetId);
    if (step.targetSelector) return document.querySelector(step.targetSelector);
    return null;
  }

  function showOnbStep(index) {
    if (index >= STEPS.length) { endOnboarding(); return; }

    const step   = STEPS[index];
    const target = getStepTarget(step);
    if (!target) { showOnbStep(index + 1); return; }

    const rect = target.getBoundingClientRect();

    // Créer ou recycler l'overlay
    if (!onbOverlay) {
      onbOverlay = document.createElement('div');
      onbOverlay.id = 'onboarding-overlay';
      document.body.appendChild(onbOverlay);
    }

    const padding = 8;
    const spotStyle = `
      left:${rect.left - padding}px;
      top:${rect.top - padding}px;
      width:${rect.width + padding * 2}px;
      height:${rect.height + padding * 2}px;
    `;

    // Position de la bulle
    let bubbleTop, bubbleLeft;
    if (step.position === 'top') {
      bubbleTop  = rect.top - 8;
      bubbleLeft = Math.max(10, Math.min(rect.left, window.innerWidth - 240));
      // Ajuster si trop bas
      if (bubbleTop < 80) bubbleTop = rect.bottom + 16;
    } else {
      bubbleTop  = rect.bottom + 12;
      bubbleLeft = Math.max(10, rect.left);
    }

    // Calculer la bulle estimée à ~170px de haut
    if (bubbleTop + 170 > window.innerHeight - 80) {
      bubbleTop = rect.top - 180;
    }

    const arrowClass = bubbleTop < rect.top ? 'arrow-bottom' : 'arrow-top';

    onbOverlay.innerHTML = `
      <div class="onb-spotlight" style="${spotStyle}"></div>
      <div class="onb-bubble ${arrowClass}"
           style="top:${bubbleTop}px;left:${bubbleLeft}px;">
        <div class="onb-step">Étape ${index + 1} / ${STEPS.length}</div>
        <div class="onb-title">${step.title}</div>
        <div class="onb-text">${step.text}</div>
        <div class="onb-actions">
          <button class="onb-skip" id="onb-skip">Passer</button>
          <div class="onb-dots">
            ${STEPS.map((_, i) => `<div class="onb-dot ${i === index ? 'active' : ''}"></div>`).join('')}
          </div>
          <button class="onb-next" id="onb-next">
            ${index < STEPS.length - 1 ? 'Suivant →' : 'Terminer ✓'}
          </button>
        </div>
      </div>
    `;

    document.getElementById('onb-next')?.addEventListener('click', () => showOnbStep(index + 1));
    document.getElementById('onb-skip')?.addEventListener('click', endOnboarding);
  }

  function endOnboarding() {
    onbOverlay?.remove();
    onbOverlay = null;
    localStorage.setItem(ONB_KEY, 'true');
  }

  function startOnboarding() {
    if (localStorage.getItem(ONB_KEY)) return; // déjà vu
    onbStep = 0;
    // Démarrer après le splash + chargement
    setTimeout(() => showOnbStep(0), 3000);
  }


  // ════════════════════════════════════════════════════════════
  // INIT GLOBAL
  // ════════════════════════════════════════════════════════════

  function init() {
    // 1. Boutons Excel (injecté au chargement et à chaque changement de section)
    injectExcelButtons();
    window.addEventListener('pageChange', injectExcelButtons);
    window.addEventListener('load', injectExcelButtons);

    // 2. Recherche stock
    injectStockSearch();

    // 3. Badge crédits
    watchCreditBadge();

    // 4. Confirmation remboursement
    buildRemboursTostElement();
    window.addEventListener('load', () => setTimeout(hookRemboursement, 300));

    // 5. Filtre période stock
    injectStockPeriodChips();
    // Re-injecter si la section est recréée
    window.addEventListener('pageChange', () => {
      injectStockPeriodChips();
      injectStockSearch();
    });

    // 6. Onboarding
    startOnboarding();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
