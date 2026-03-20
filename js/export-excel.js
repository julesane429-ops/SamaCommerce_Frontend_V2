/**
 * export-excel.js — Export Excel complet multi-onglets
 *
 * Génère un fichier .xlsx avec 5 onglets :
 *   1. 📊 Résumé         — KPIs globaux
 *   2. 🧾 Ventes         — Historique complet
 *   3. 📦 Produits       — Stock + marges
 *   4. 👥 Clients        — Liste + CA
 *   5. 📦 Commandes      — Toutes les commandes
 *   6. 🚚 Livraisons     — Suivi livraisons
 *
 * Accessible depuis :
 *   - Bouton flottant dans Chiffres et Inventaire
 *   - window.exportAllExcel()
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/export-excel.js"></script>
 */

(function () {

  const API    = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth   = (url) => window.authfetch?.(url);

  // ══════════════════════════════════════
  // STYLES COMMUNS
  // ══════════════════════════════════════
  const S = {
    header: {
      font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill:      { fgColor: { rgb: '7C3AED' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top:    { style:'thin', color:{rgb:'5B21B6'} },
        bottom: { style:'thin', color:{rgb:'5B21B6'} },
      },
    },
    altRow: { fill: { fgColor: { rgb: 'F5F3FF' } } },
    total:  { font: { bold: true }, fill: { fgColor: { rgb: 'EDE9FE' } } },
    green:  { font: { color: { rgb: '059669' }, bold: true } },
    red:    { font: { color: { rgb: 'DC2626' }, bold: true } },
    orange: { font: { color: { rgb: 'D97706' }, bold: true } },
    center: { alignment: { horizontal: 'center' } },
    right:  { alignment: { horizontal: 'right' } },
  };

  function applyStyle(ws, ref, style) {
    if (!ws[ref]) ws[ref] = { v: '' };
    ws[ref].s = style;
  }

  function setColWidths(ws, widths) {
    ws['!cols'] = widths.map(w => ({ wch: w }));
  }

  function addRow(ws, rowData, rowIdx, isHeader = false, isAlt = false) {
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    rowData.forEach((val, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
      const cell    = { v: val, t: typeof val === 'number' ? 'n' : 's' };
      if (isHeader)       cell.s = S.header;
      else if (isAlt)     cell.s = S.altRow;
      ws[cellRef] = cell;

      range.e.r = Math.max(range.e.r, rowIdx);
      range.e.c = Math.max(range.e.c, colIdx);
      range.s.r = Math.min(range.s.r, rowIdx);
    });
    ws['!ref'] = XLSX.utils.encode_range(range);
  }

  // ══════════════════════════════════════
  // ONGLET 1 — RÉSUMÉ
  // ══════════════════════════════════════
  function buildResume(data) {
    const ws = {};
    const ventes  = data.ventes  || [];
    const produits = data.produits || [];
    const credits  = data.credits  || [];

    const caTotal     = ventes.filter(v=>v.paid).reduce((s,v)=>s+(v.total||0),0);
    const nbVentes    = ventes.length;
    const nbCredits   = credits.filter(c=>!c.paid).length;
    const totalCredit = credits.filter(c=>!c.paid).reduce((s,c)=>s+(c.total||0),0);
    const stockVal    = produits.reduce((s,p)=>s+(p.stock||0)*(p.priceAchat||p.price_achat||0),0);
    const ruptures    = produits.filter(p=>p.stock===0).length;
    const today       = new Date().toLocaleDateString('fr-FR');
    const boutique    = document.getElementById('appHeader')?.textContent?.replace('🏪','').trim() || 'Sama Commerce';

    const rows = [
      ['🏪 SAMA COMMERCE — EXPORT COMPLET'],
      [`Boutique : ${boutique}`, '', `Date : ${today}`],
      [],
      ['📊 INDICATEURS CLÉS', '', 'Valeur', 'Unité'],
      ['💰 CA total encaissé', '', caTotal, 'F CFA'],
      ['🧾 Nombre de ventes', '', nbVentes, 'ventes'],
      ['📦 Produits en stock', '', produits.length, 'produits'],
      ['💳 Crédits impayés', '', nbCredits, 'clients'],
      ['⚠️ Montant crédits dus', '', totalCredit, 'F CFA'],
      ['📦 Valeur du stock', '', stockVal, 'F CFA'],
      ['⛔ Produits en rupture', '', ruptures, 'produits'],
    ];

    rows.forEach((row, i) => {
      row.forEach((val, j) => {
        const ref = XLSX.utils.encode_cell({ r: i, c: j });
        ws[ref] = { v: val || '', t: typeof val === 'number' ? 'n' : 's' };
        if (i === 3) ws[ref].s = S.header;
        else if (i === 0) ws[ref].s = { font: { bold: true, sz: 14, color: { rgb: '7C3AED' } } };
      });
    });

    ws['!ref'] = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:rows.length,c:3} });
    setColWidths(ws, [35, 5, 18, 12]);
    return ws;
  }

  // ══════════════════════════════════════
  // ONGLET 2 — VENTES
  // ══════════════════════════════════════
  function buildVentes(data) {
    const ws      = {};
    const headers = ['Date','Heure','Produit','Catégorie','Quantité','Prix unitaire','Total','Paiement','Client','Statut'];

    addRow(ws, headers, 0, true);

    (data.ventes || []).forEach((v, i) => {
      const d    = v.created_at ? new Date(v.created_at) : null;
      const prod = data.produits?.find(p => p.id === parseInt(v.product_id));
      const cat  = prod ? data.categories?.find(c => c.id === prod.category_id) : null;
      const row  = [
        d ? d.toLocaleDateString('fr-FR') : '—',
        d ? d.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'}) : '—',
        prod?.name || v.product_name || '—',
        cat?.name || '—',
        v.quantity || 0,
        prod?.price || 0,
        v.total || 0,
        v.payment_method || '—',
        v.client_name || '—',
        v.paid ? 'Encaissé' : 'Crédit',
      ];
      addRow(ws, row, i + 1, false, i % 2 === 1);

      // Colorier la colonne Statut
      const statusRef = XLSX.utils.encode_cell({ r: i+1, c: 9 });
      ws[statusRef].s = v.paid ? S.green : S.red;
    });

    // Total
    const totalRow = data.ventes?.length + 1 || 1;
    const total    = (data.ventes||[]).filter(v=>v.paid).reduce((s,v)=>s+(v.total||0),0);
    addRow(ws, ['TOTAL ENCAISSÉ', '', '', '', '', '', total, '', '', ''], totalRow, false, false);
    applyStyle(ws, XLSX.utils.encode_cell({r:totalRow,c:0}), S.total);
    applyStyle(ws, XLSX.utils.encode_cell({r:totalRow,c:6}), { ...S.total, ...S.green });

    ws['!ref'] = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:totalRow,c:9} });
    setColWidths(ws, [12,8,25,15,8,15,12,15,20,10]);
    return ws;
  }

  // ══════════════════════════════════════
  // ONGLET 3 — PRODUITS
  // ══════════════════════════════════════
  function buildProduits(data) {
    const ws      = {};
    const headers = ['Produit','Catégorie','Prix achat','Prix vente','Stock','Vendu','Bénéfice','Marge %','Valeur stock','Statut'];

    addRow(ws, headers, 0, true);

    (data.produits || []).forEach((p, i) => {
      const cat     = data.categories?.find(c => c.id === p.category_id);
      const achat   = p.priceAchat || p.price_achat || 0;
      const vente   = p.price || 0;
      const vendu   = p.vendu || 0;
      const benefit = vendu * (vente - achat);
      const marge   = achat > 0 ? Math.round((vente - achat) / achat * 100) : 0;
      const valStock = p.stock * achat;
      const statut  = p.stock === 0 ? '⛔ Rupture' : p.stock <= 5 ? '⚠️ Faible' : '✅ OK';

      const row = [p.name, cat?.name||'—', achat, vente, p.stock, vendu, benefit, marge, valStock, statut];
      addRow(ws, row, i + 1, false, i % 2 === 1);

      // Colorier statut
      const ref = XLSX.utils.encode_cell({ r: i+1, c: 9 });
      ws[ref].s = p.stock === 0 ? S.red : p.stock <= 5 ? S.orange : S.green;
    });

    ws['!ref'] = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:(data.produits||[]).length,c:9} });
    setColWidths(ws, [25,15,12,12,8,8,14,10,14,12]);
    return ws;
  }

  // ══════════════════════════════════════
  // ONGLET 4 — CLIENTS
  // ══════════════════════════════════════
  function buildClients(clients) {
    const ws      = {};
    const headers = ['Nom','Téléphone','Email','Adresse','CA total','Nb achats','Client depuis','Notes'];

    addRow(ws, headers, 0, true);
    (clients || []).forEach((c, i) => {
      addRow(ws, [
        c.name || '—',
        c.phone || '—',
        c.email || '—',
        c.address || '—',
        +c.total_achats || 0,
        +c.nb_achats    || 0,
        c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : '—',
        c.notes || '—',
      ], i + 1, false, i % 2 === 1);
    });

    ws['!ref'] = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:(clients||[]).length,c:7} });
    setColWidths(ws, [25,15,25,25,14,10,14,25]);
    return ws;
  }

  // ══════════════════════════════════════
  // ONGLET 5 — COMMANDES
  // ══════════════════════════════════════
  function buildCommandes(commandes) {
    const ws      = {};
    const headers = ['#','Fournisseur','Total','Statut','Nb articles','Date création','Date prévue','Notes'];

    addRow(ws, headers, 0, true);
    (commandes || []).forEach((c, i) => {
      const row = [
        c.id,
        c.fournisseur_name || '—',
        +c.total || 0,
        c.status || '—',
        +c.nb_items || 0,
        c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : '—',
        c.expected_date ? new Date(c.expected_date).toLocaleDateString('fr-FR') : '—',
        c.notes || '—',
      ];
      addRow(ws, row, i + 1, false, i % 2 === 1);

      const statusRef = XLSX.utils.encode_cell({ r: i+1, c: 3 });
      ws[statusRef].s = c.status==='recue' ? S.green : c.status==='annulee' ? S.red : S.orange;
    });

    ws['!ref'] = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:(commandes||[]).length,c:7} });
    setColWidths(ws, [6,25,14,14,10,14,14,25]);
    return ws;
  }

  // ══════════════════════════════════════
  // ONGLET 6 — LIVRAISONS
  // ══════════════════════════════════════
  function buildLivraisons(livraisons) {
    const ws      = {};
    const headers = ['#','Fournisseur','Statut','Note de suivi','Créée le','Livrée le','Montant commande'];

    addRow(ws, headers, 0, true);
    (livraisons || []).forEach((l, i) => {
      addRow(ws, [
        l.id,
        l.fournisseur_name || '—',
        l.status || '—',
        l.tracking_note || '—',
        l.created_at   ? new Date(l.created_at).toLocaleDateString('fr-FR')   : '—',
        l.delivered_at ? new Date(l.delivered_at).toLocaleDateString('fr-FR') : '—',
        +l.commande_total || 0,
      ], i + 1, false, i % 2 === 1);

      const ref = XLSX.utils.encode_cell({ r: i+1, c: 2 });
      ws[ref].s = l.status==='livree' ? S.green : l.status==='probleme' ? S.red : S.orange;
    });

    ws['!ref'] = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:(livraisons||[]).length,c:6} });
    setColWidths(ws, [6,25,14,30,14,14,16]);
    return ws;
  }

  // ══════════════════════════════════════
  // EXPORT PRINCIPAL
  // ══════════════════════════════════════
  async function exportAllExcel() {
    if (!window.XLSX) {
      window.showNotification?.('SheetJS non disponible','error');
      return;
    }

    window.showNotification?.('⏳ Préparation de l\'export…','info');

    // Charger clients, commandes, livraisons en parallèle
    let clients    = [];
    let commandes  = [];
    let livraisons = [];

    try {
      const [rc, rcmd, rl] = await Promise.allSettled([
        auth(`${API()}/clients`).then(r => r?.ok ? r.json() : []),
        auth(`${API()}/commandes`).then(r => r?.ok ? r.json() : []),
        auth(`${API()}/livraisons`).then(r => r?.ok ? r.json() : []),
      ]);
      if(rc.status==='fulfilled')   clients    = rc.value    || [];
      if(rcmd.status==='fulfilled') commandes  = rcmd.value  || [];
      if(rl.status==='fulfilled')   livraisons = rl.value    || [];
    } catch {}

    const data = window.appData || {};
    const wb   = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, buildResume(data),          '📊 Résumé');
    XLSX.utils.book_append_sheet(wb, buildVentes(data),          '🧾 Ventes');
    XLSX.utils.book_append_sheet(wb, buildProduits(data),        '📦 Produits');
    XLSX.utils.book_append_sheet(wb, buildClients(clients),      '👥 Clients');
    XLSX.utils.book_append_sheet(wb, buildCommandes(commandes),  '📦 Commandes');
    XLSX.utils.book_append_sheet(wb, buildLivraisons(livraisons),'🚚 Livraisons');

    const boutique = document.getElementById('appHeader')?.textContent?.replace('🏪','').trim() || 'SamaCommerce';
    const date     = new Date().toISOString().split('T')[0];
    const filename = `${boutique.replace(/\s+/g,'_')}_export_${date}.xlsx`;

    XLSX.writeFile(wb, filename);
    window.showNotification?.('✅ Export Excel téléchargé !', 'success');
  }

  // ══════════════════════════════════════
  // BOUTON DANS LA SECTION CHIFFRES
  // ══════════════════════════════════════
  function injectExportButton() {
    if (document.getElementById('export-all-btn')) return;

    const rapports = document.getElementById('rapportsSection');
    if (!rapports) return;

    const header = rapports.querySelector('.page-header');
    if (!header) return;

    const btn = document.createElement('button');
    btn.id = 'export-all-btn';
    btn.style.cssText = `
      background:linear-gradient(135deg,#10B981,#059669);
      color:#fff; border:none; padding:8px 14px;
      border-radius:12px; font-family:'Sora',sans-serif;
      font-size:12px; font-weight:700; cursor:pointer;
      box-shadow:0 3px 10px rgba(16,185,129,.3);
      display:flex; align-items:center; gap:5px;
      transition:transform .12s;
    `;
    btn.innerHTML = '📊 Export Excel';
    btn.addEventListener('click', exportAllExcel);
    btn.addEventListener('mousedown', () => btn.style.transform='scale(.96)');
    btn.addEventListener('mouseup', () => btn.style.transform='scale(1)');
    header.appendChild(btn);
  }

  // ══════════════════════════════════════
  // API PUBLIQUE
  // ══════════════════════════════════════
  window.exportAllExcel = exportAllExcel;

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    injectExportButton();
    window.addEventListener('pageChange', e => {
      if(e.detail?.key==='rapports') setTimeout(injectExportButton, 200);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
