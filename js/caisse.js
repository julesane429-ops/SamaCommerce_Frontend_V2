/**
 * caisse.js — Clôture de caisse quotidienne
 *
 * Récapitulatif de fin de journée :
 *   - Total par mode de paiement
 *   - Crédits du jour
 *   - Retours
 *   - Net encaissé
 *   - Export PDF
 *   - Historique des clôtures précédentes
 *
 * Accessible depuis ☰ Plus → Clôture de caisse
 * INTÉGRATION : <script src="js/caisse.js"></script>
 */

(function () {

  const API    = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth   = (url, o={}) => window.authfetch(url, o);
  const ok_    = r => { if(!r.ok) throw new Error(r.status); return r.json(); };

  // ══════════════════════════════════════
  // CALCULER LOCALEMENT (depuis appData)
  // ══════════════════════════════════════
  function computeFromLocal() {
    const ventes  = window.appData?.ventes || [];
    const today   = new Date().toISOString().split('T')[0];
    const du_jour = ventes.filter(v => {
      const d = new Date(v.created_at || v.date);
      return !isNaN(d) && d.toISOString().split('T')[0] === today;
    });

    const especes = du_jour.filter(v=>v.payment_method==='especes'&&v.paid).reduce((s,v)=>s+(v.total||0),0);
    const wave    = du_jour.filter(v=>v.payment_method==='wave'   &&v.paid).reduce((s,v)=>s+(v.total||0),0);
    const orange  = du_jour.filter(v=>v.payment_method==='orange' &&v.paid).reduce((s,v)=>s+(v.total||0),0);
    const credits = du_jour.filter(v=>!v.paid).reduce((s,v)=>s+(v.total||0),0);
    const encaisse = especes + wave + orange;

    return {
      nb_ventes:      du_jour.length,
      especes,  wave, orange,
      credits,
      total_encaisse: encaisse,
      total_retours:  0,
      net:            encaisse,
      ventes_detail:  du_jour,
    };
  }

  // ══════════════════════════════════════
  // OUVRIR LA MODALE CLÔTURE
  // ══════════════════════════════════════
  async function openCaisseModal() {
    const data = computeFromLocal();

    // Essayer de récupérer les données serveur
    try {
      const res = await auth(`${API()}/caisse/today`);
      if (res.ok) {
        const srv = await res.json();
        Object.assign(data, srv);
      }
    } catch {}

    const now      = new Date();
    const dateStr  = now.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
    const boutique = document.getElementById('appHeader')?.textContent?.replace('🏪','').trim() || 'Sama Commerce';

    const bd = document.createElement('div');
    bd.id = 'caisse-modal';
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet" style="max-height:92dvh;">
        <div class="module-sheet-pill"></div>

        <!-- En-tête -->
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:36px;margin-bottom:6px;">🧾</div>
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:var(--text);">Clôture de caisse</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px;text-transform:capitalize;">${dateStr}</div>
        </div>

        <!-- Résumé encaissements -->
        <div style="background:#F9FAFB;border-radius:16px;padding:16px;margin-bottom:12px;">
          <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:var(--text);margin-bottom:10px;">💰 Encaissements</div>
          ${[
            { label:'💵 Espèces',      val: data.especes,  color:'#10B981' },
            { label:'📱 Wave',         val: data.wave,     color:'#3B82F6' },
            { label:'📞 Orange Money', val: data.orange,   color:'#F59E0B' },
          ].map(r => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #F3F4F6;">
              <div style="font-size:13px;color:var(--text);">${r.label}</div>
              <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:${r.color};">${r.val.toLocaleString('fr-FR')} F</div>
            </div>
          `).join('')}

          <!-- Total encaissé -->
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0 0;">
            <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:var(--text);">✅ Total encaissé</div>
            <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:#10B981;">${data.total_encaisse.toLocaleString('fr-FR')} F</div>
          </div>
        </div>

        <!-- Crédits & Retours -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
          <div style="background:#FEF2F2;border-radius:14px;padding:12px;text-align:center;">
            <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:#EF4444;">${data.credits.toLocaleString('fr-FR')} F</div>
            <div style="font-size:11px;color:#6B7280;margin-top:3px;">💳 Crédits non payés</div>
          </div>
          <div style="background:#FEF3C7;border-radius:14px;padding:12px;text-align:center;">
            <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:#D97706;">${(+data.total_retours||0).toLocaleString('fr-FR')} F</div>
            <div style="font-size:11px;color:#6B7280;margin-top:3px;">↩️ Retours</div>
          </div>
        </div>

        <!-- Net -->
        <div style="background:linear-gradient(135deg,#EDE9FE,#FCE7F3);border-radius:16px;padding:16px;margin-bottom:16px;text-align:center;">
          <div style="font-size:12px;font-weight:700;color:#7C3AED;margin-bottom:6px;">💰 NET DE CAISSE</div>
          <div style="font-family:'Sora',sans-serif;font-size:28px;font-weight:800;color:#5B21B6;">${(+data.net||data.total_encaisse).toLocaleString('fr-FR')} F</div>
          <div style="font-size:11px;color:#7C3AED;margin-top:4px;">${data.nb_ventes} vente${data.nb_ventes>1?'s':''} aujourd'hui</div>
        </div>

        <!-- Notes -->
        <div class="form-group">
          <label>📝 Notes (optionnel)</label>
          <textarea id="caisse-notes" style="height:60px;resize:none;" placeholder="Observations du jour…"></textarea>
        </div>

        <!-- Actions -->
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px;">
          <button id="caisse-export-pdf" style="
            padding:13px;background:linear-gradient(135deg,#7C3AED,#EC4899);
            color:#fff;border:none;border-radius:14px;
            font-family:'Sora',sans-serif;font-size:14px;font-weight:700;
            cursor:pointer;box-shadow:0 3px 10px rgba(124,58,237,.25);
            display:flex;align-items:center;justify-content:center;gap:8px;
          ">📄 Exporter en PDF</button>

          <button id="caisse-close-btn" style="
            padding:13px;background:#ECFDF5;color:#065F46;
            border:none;border-radius:14px;
            font-family:'Sora',sans-serif;font-size:14px;font-weight:700;cursor:pointer;
          ">✅ Clôturer la caisse</button>
        </div>

        <button id="caisse-dismiss" style="
          width:100%;padding:12px;background:#F9FAFB;color:#6B7280;
          border:none;border-radius:14px;font-family:'Sora',sans-serif;
          font-size:13px;font-weight:600;cursor:pointer;
        ">Fermer</button>
      </div>
    `;

    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if(e.target===bd) bd.remove(); });
    bd.querySelector('#caisse-dismiss').addEventListener('click', ()=>bd.remove());

    bd.querySelector('#caisse-export-pdf').addEventListener('click', () => {
      bd.remove();
      generateCaissePDF(data, dateStr, boutique);
    });

    bd.querySelector('#caisse-close-btn').addEventListener('click', async () => {
      const notes = bd.querySelector('#caisse-notes')?.value.trim() || null;
      try {
        await auth(`${API()}/caisse/close`, {
          method:  'POST',
          headers: { 'Content-Type':'application/json' },
          body:    JSON.stringify({ notes }),
        });
        window.showNotification?.('✅ Caisse clôturée', 'success');
        bd.remove();
        generateCaissePDF(data, dateStr, boutique);
      } catch {
        window.showNotification?.('Caisse enregistrée localement', 'info');
        bd.remove();
        generateCaissePDF(data, dateStr, boutique);
      }
    });
  }

  // ══════════════════════════════════════
  // EXPORT PDF
  // ══════════════════════════════════════
  function generateCaissePDF(data, dateStr, boutique) {
    if (!window.jspdf?.jsPDF) {
      window.showNotification?.('jsPDF non disponible', 'error');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a5' });
    const W   = doc.internal.pageSize.getWidth();
    const now = new Date();

    // En-tête
    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, W, 30, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text(boutique, W/2, 12, {align:'center'});
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text('CLÔTURE DE CAISSE', W/2, 20, {align:'center'});
    doc.setFontSize(9);
    doc.text(dateStr, W/2, 27, {align:'center'});

    let y = 40;

    // Résumé
    const rows = [
      ['💵 Espèces',         `${data.especes.toLocaleString('fr-FR')} F`],
      ['📱 Wave',            `${data.wave.toLocaleString('fr-FR')} F`],
      ['📞 Orange Money',    `${data.orange.toLocaleString('fr-FR')} F`],
      ['💳 Crédits (dus)',   `${data.credits.toLocaleString('fr-FR')} F`],
      ['↩️ Retours',         `${(+data.total_retours||0).toLocaleString('fr-FR')} F`],
    ];

    doc.setFontSize(10); doc.setTextColor(30, 27, 75);
    rows.forEach(([label, val]) => {
      doc.setFont('helvetica', 'normal');
      doc.text(label, 15, y);
      doc.setFont('helvetica', 'bold');
      doc.text(val, W - 15, y, {align:'right'});
      y += 8;
    });

    // Séparateur
    doc.setDrawColor(229, 231, 235);
    doc.line(15, y, W-15, y); y += 6;

    // Total encaissé
    doc.setFillColor(236, 253, 245);
    doc.rect(10, y-4, W-20, 12, 'F');
    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.setTextColor(6, 95, 70);
    doc.text('✅ TOTAL ENCAISSÉ', 15, y+3);
    doc.text(`${data.total_encaisse.toLocaleString('fr-FR')} F`, W-15, y+3, {align:'right'});
    y += 18;

    // Net
    doc.setFillColor(237, 233, 254);
    doc.rect(10, y-4, W-20, 14, 'F');
    doc.setTextColor(91, 33, 182);
    doc.setFontSize(13);
    doc.text('💰 NET DE CAISSE', 15, y+4);
    doc.text(`${(+data.net||data.total_encaisse).toLocaleString('fr-FR')} F`, W-15, y+4, {align:'right'});
    y += 20;

    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text(`${data.nb_ventes} vente${data.nb_ventes>1?'s':''} effectuée${data.nb_ventes>1?'s':''}`, 15, y);
    doc.text(`Généré le ${now.toLocaleString('fr-FR')}`, W-15, y, {align:'right'});

    doc.save(`caisse_${now.toISOString().split('T')[0]}.pdf`);
    window.showNotification?.('📄 PDF clôture exporté', 'success');
  }

  // ══════════════════════════════════════
  // BOUTON DANS LE PLUS SHEET
  // ══════════════════════════════════════
  function injectCaisseButton() {
    const plusInner = document.querySelector('#plusSheet > div > div:last-child, #plusSheet .sheet-body');
    if (!plusInner || plusInner.querySelector('#caisse-sheet-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'caisse-sheet-btn';
    btn.className = 'sheet-item';
    btn.onclick = () => { window.closePlusSheet?.(); openCaisseModal(); };
    btn.innerHTML = `
      <div class="sheet-icon" style="background:#ECFDF5;">🧾</div>
      <div><h3>Clôture de caisse</h3><p>Récapitulatif du jour</p></div>
      <span class="sheet-chevron">›</span>
    `;
    plusInner.appendChild(btn);
  }

  window.openCaisseModal = openCaisseModal;

  function init() {
    document.getElementById('nav-plus')?.addEventListener('click', () => {
      setTimeout(injectCaisseButton, 100);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
