/**
 * client-pdf.js — Reçu PDF historique client
 *
 * Génère un PDF professionnel de l'historique d'achats d'un client :
 *   - En-tête boutique + logo texte
 *   - Fiche client (nom, téléphone, email, fidélité)
 *   - Stats (CA total, nb achats, panier moyen)
 *   - Tableau historique des achats (autoTable)
 *   - Crédits en cours (si applicable)
 *   - Pied de page avec date
 *
 * Appel depuis la fiche client :
 *   window.generateClientPDF(clientData, achats, credits)
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/client-pdf.js"></script>
 *
 * PRÉREQUIS : jsPDF + jsPDF-autoTable (déjà chargés dans index.html)
 */

(function () {

  // ── Couleurs PDF ──
  const VIOLET  = [124, 58,  237];
  const PINK    = [236, 72,  153];
  const GREEN   = [16,  185, 129];
  const RED     = [239, 68,  68 ];
  const ORANGE  = [245, 158, 11 ];
  const GRAY    = [107, 114, 128];
  const DARK    = [30,  27,  75 ];
  const LIGHT   = [243, 244, 246];

  function loyaltyLabel(n) {
    if (n >= 20) return '🏆 VIP';
    if (n >= 10) return '⭐ Fidèle';
    if (n >= 5)  return '👍 Régulier';
    return '🆕 Nouveau';
  }

  // ══════════════════════════════════════
  // GÉNÉRATION DU PDF
  // ══════════════════════════════════════
  function generateClientPDF(client, achats = [], credits = []) {
    if (!window.jspdf?.jsPDF) {
      window.showNotification?.('jsPDF non disponible', 'error');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W    = doc.internal.pageSize.getWidth();
    const H    = doc.internal.pageSize.getHeight();
    const now  = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });

    // Boutique
    const boutique = document.getElementById('appHeader')?.textContent?.replace('🏪','').trim() || 'Sama Commerce';

    // ── EN-TÊTE ──────────────────────────────────────────────
    // Fond dégradé simulé (rectangle violet + rose)
    doc.setFillColor(...VIOLET);
    doc.rect(0, 0, W, 38, 'F');

    // Titre boutique
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(boutique, 15, 16);

    // Sous-titre
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 200, 255);
    doc.text('Historique client', 15, 24);
    doc.text(dateStr, 15, 30);

    // Numéro document
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    const docNum = 'CLIENT-' + Date.now().toString().slice(-6);
    doc.text(docNum, W - 15, 24, { align: 'right' });

    let y = 48;

    // ── FICHE CLIENT ─────────────────────────────────────────
    const nb     = +client.nb_achats    || achats.length || 0;
    const caTotal = +client.total_achats || achats.reduce((s,a)=>s+(a.total||0),0);
    const panier  = nb ? Math.round(caTotal/nb) : 0;
    const lbl     = loyaltyLabel(nb);

    // Encadré client
    doc.setFillColor(...LIGHT);
    doc.roundedRect(10, y, W - 20, 36, 3, 3, 'F');
    doc.setDrawColor(...VIOLET);
    doc.setLineWidth(.4);
    doc.roundedRect(10, y, W - 20, 36, 3, 3, 'S');

    // Avatar cercle
    doc.setFillColor(...VIOLET);
    doc.circle(24, y + 18, 10, 'F');
    const ini = (client.name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    doc.setTextColor(255,255,255);
    doc.setFontSize(9);
    doc.setFont('helvetica','bold');
    doc.text(ini, 24, y + 19.5, { align:'center' });

    // Infos client
    doc.setTextColor(...DARK);
    doc.setFontSize(13);
    doc.setFont('helvetica','bold');
    doc.text(client.name || '—', 38, y + 11);

    doc.setFontSize(9);
    doc.setFont('helvetica','normal');
    doc.setTextColor(...GRAY);
    if (client.phone) doc.text(`Tél : ${client.phone}`, 38, y + 18);
    if (client.email) doc.text(`Email : ${client.email}`, 38, y + 24);
    if (client.address) doc.text(`Adresse : ${client.address}`, 38, y + 30);

    // Badge fidélité
    doc.setFontSize(8);
    doc.setFont('helvetica','bold');
    doc.setTextColor(...VIOLET);
    doc.text(lbl, W - 15, y + 11, { align:'right' });

    // Client depuis
    if (client.created_at) {
      doc.setFont('helvetica','normal');
      doc.setTextColor(...GRAY);
      doc.setFontSize(8);
      doc.text('Client depuis : ' + new Date(client.created_at).toLocaleDateString('fr-FR'), W - 15, y + 18, { align:'right' });
    }

    y += 44;

    // ── STATS ────────────────────────────────────────────────
    const stats = [
      { label:'CA total',     value: caTotal.toLocaleString('fr-FR') + ' F', color: VIOLET },
      { label:'Nb achats',    value: String(nb),                              color: GREEN  },
      { label:'Panier moyen', value: panier.toLocaleString('fr-FR') + ' F',  color: ORANGE },
    ];

    const statW = (W - 20) / 3;
    stats.forEach((s, i) => {
      const sx = 10 + i * statW;
      doc.setFillColor(245, 243, 255);
      doc.roundedRect(sx + 1, y, statW - 2, 18, 2, 2, 'F');
      doc.setTextColor(...s.color);
      doc.setFontSize(13);
      doc.setFont('helvetica','bold');
      doc.text(s.value, sx + statW/2, y + 9, { align:'center' });
      doc.setTextColor(...GRAY);
      doc.setFontSize(7.5);
      doc.setFont('helvetica','normal');
      doc.text(s.label, sx + statW/2, y + 15, { align:'center' });
    });

    y += 26;

    // ── HISTORIQUE ACHATS ────────────────────────────────────
    doc.setTextColor(...DARK);
    doc.setFontSize(12);
    doc.setFont('helvetica','bold');
    doc.text('Historique des achats', 10, y);
    y += 6;

    if (achats.length) {
      const rows = achats.map(a => [
        a.created_at ? new Date(a.created_at).toLocaleDateString('fr-FR') : '—',
        a.product_name || '—',
        String(a.quantity || 1),
        a.payment_method ? a.payment_method.charAt(0).toUpperCase() + a.payment_method.slice(1) : '—',
        (a.total || 0).toLocaleString('fr-FR') + ' F',
        a.paid === false ? 'Crédit' : 'Encaissé',
      ]);

      doc.autoTable({
        startY: y,
        head: [['Date', 'Produit', 'Qté', 'Paiement', 'Montant', 'Statut']],
        body: rows,
        styles: {
          font:       'helvetica',
          fontSize:   9,
          cellPadding: 3,
          textColor:  DARK,
        },
        headStyles: {
          fillColor:   VIOLET,
          textColor:   [255, 255, 255],
          fontStyle:   'bold',
          fontSize:    9,
        },
        alternateRowStyles: { fillColor: [249, 248, 255] },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 55 },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 24, halign: 'center' },
          4: { cellWidth: 30, halign: 'right', fontStyle: 'bold', textColor: VIOLET },
          5: { cellWidth: 22, halign: 'center' },
        },
        margin: { left: 10, right: 10 },
        didDrawCell: (data) => {
          // Colorier la colonne Statut
          if (data.column.index === 5 && data.section === 'body') {
            const val = data.cell.text?.[0];
            if (val === 'Crédit') {
              doc.setTextColor(...RED);
            } else {
              doc.setTextColor(...GREEN);
            }
          }
        },
      });

      y = doc.lastAutoTable.finalY + 8;
    } else {
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text('Aucun achat enregistré.', 10, y + 6);
      y += 14;
    }

    // ── CRÉDITS EN COURS ─────────────────────────────────────
    const crOpen = credits.filter(c => !c.paid);
    if (crOpen.length) {
      // Vérifier si on a la place sur la page
      if (y > H - 60) { doc.addPage(); y = 20; }

      doc.setFontSize(12);
      doc.setFont('helvetica','bold');
      doc.setTextColor(...RED);
      doc.text('Crédits en cours', 10, y);
      y += 6;

      const crTotal = crOpen.reduce((s,c)=>s+(c.total||0),0);

      doc.autoTable({
        startY: y,
        head: [['Produit', 'Montant', 'Échéance', 'Statut']],
        body: crOpen.map(c => [
          c.product_name || '—',
          (c.total||0).toLocaleString('fr-FR') + ' F',
          c.due_date ? new Date(c.due_date).toLocaleDateString('fr-FR') : '—',
          new Date(c.due_date) < new Date() ? '⚠️ En retard' : '⏳ En attente',
        ]),
        styles: { font:'helvetica', fontSize:9, cellPadding:3 },
        headStyles: { fillColor: RED, textColor:[255,255,255], fontStyle:'bold', fontSize:9 },
        alternateRowStyles: { fillColor:[255,242,242] },
        columnStyles: {
          1: { halign:'right', fontStyle:'bold', textColor: RED },
          2: { halign:'center' },
          3: { halign:'center' },
        },
        foot: [[
          { content:'TOTAL DÛ', styles:{ fontStyle:'bold', textColor:RED } },
          { content: crTotal.toLocaleString('fr-FR') + ' F', styles:{ fontStyle:'bold', textColor:RED, halign:'right' } },
          '', '',
        ]],
        footStyles: { fillColor:[255,228,228], textColor:RED, fontStyle:'bold' },
        margin: { left:10, right:10 },
      });

      y = doc.lastAutoTable.finalY + 8;
    }

    // ── PIED DE PAGE ─────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.setFont('helvetica','normal');

      // Ligne séparatrice
      doc.setDrawColor(...LIGHT);
      doc.setLineWidth(.3);
      doc.line(10, H - 14, W - 10, H - 14);

      doc.text(`${boutique} · Généré le ${dateStr}`, 10, H - 8);
      doc.text(`Page ${p} / ${totalPages}`, W - 10, H - 8, { align:'right' });
    }

    // ── SAUVEGARDE ───────────────────────────────────────────
    const filename = `client_${(client.name||'inconnu').replace(/\s+/g,'_')}_${now.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);

    window.showNotification?.('✅ PDF généré et téléchargé', 'success');
  }

  // ══════════════════════════════════════
  // EXPOSER GLOBALEMENT
  // ══════════════════════════════════════
  window.generateClientPDF = generateClientPDF;

  // ══════════════════════════════════════
  // INJECTER LE BOUTON DANS LA FICHE CLIENT
  // Via MutationObserver sur les bottom sheets
  // ══════════════════════════════════════
  function injectPDFButton() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (!node.classList?.contains('module-sheet-backdrop')) return;

          // Vérifier si c'est une fiche client (avatar violet/rose)
          const avatar = node.querySelector('.avatar-client.entity-hero-avatar');
          if (!avatar) return;
          if (node.querySelector('#client-pdf-btn')) return;

          // Trouver le bouton Fermer
          const closeBtn = node.querySelector('button.btn-cancel');
          if (!closeBtn) return;

          const pdfBtn = document.createElement('button');
          pdfBtn.id = 'client-pdf-btn';
          pdfBtn.style.cssText = `
            width:100%; padding:12px;
            background:linear-gradient(135deg,#7C3AED,#EC4899);
            color:#fff; border:none; border-radius:14px;
            font-family:'Sora',sans-serif; font-size:13px; font-weight:700;
            cursor:pointer; box-shadow:0 3px 10px rgba(124,58,237,.25);
            display:flex; align-items:center; justify-content:center; gap:8px;
            margin-bottom:10px; transition:transform .12s;
          `;
          pdfBtn.innerHTML = '📄 Exporter l\'historique en PDF';
          pdfBtn.addEventListener('click', async () => {
            pdfBtn.textContent = '⏳ Génération…';
            pdfBtn.style.opacity = '.7';

            // Récupérer les données depuis le cache ou l'API
            const nameEl   = node.querySelector('.entity-hero-name');
            const name     = nameEl?.childNodes[0]?.textContent?.trim() || '';
            const clientEl = window._clientsCache?.find?.(c => c.name === name);

            // Récupérer les achats depuis le serveur si possible
            let achats  = [];
            let credits = [];
            try {
              const API = document.querySelector('meta[name="api-base"]')?.content || '';
              if (clientEl?.id && API) {
                const res = await window.authfetch(`${API}/clients/${clientEl.id}`);
                if (res.ok) {
                  const data = await res.json();
                  achats  = data.achats || [];
                }
              }
              credits = (window.appData?.credits || []).filter(c =>
                (c.client_name||'').toLowerCase().trim() === name.toLowerCase().trim()
              );
            } catch {}

            generateClientPDF(clientEl || { name }, achats, credits);

            pdfBtn.innerHTML = '📄 Exporter l\'historique en PDF';
            pdfBtn.style.opacity = '1';
          });

          closeBtn.parentNode.insertBefore(pdfBtn, closeBtn);
        });
      });
    });

    observer.observe(document.body, { childList:true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPDFButton);
  } else {
    injectPDFButton();
  }

})();
