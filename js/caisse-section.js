/**
 * caisse-section.js — Gestion de la Caisse & Clôture quotidienne
 *
 * Section dédiée accessible depuis ☰ Plus → Caisse
 * Fonctionnalités :
 *   - Résumé du jour (espèces, Wave, Orange, crédits, retours)
 *   - Graphique des 7 derniers jours
 *   - Clôture de caisse avec export PDF
 *   - Historique des 30 dernières clôtures
 *
 * INTÉGRATION :
 *   1. Ajouter la section HTML dans index.html (voir bas de fichier)
 *   2. Ajouter 'caisse' dans sections[] de utils.js
 *   3. <script src="js/caisse-section.js"></script>
 */
(function () {
 
  const API  = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth = (url, o={}) => window.authfetch(url, o);
  const ok_  = r => { if(!r.ok) throw new Error(r.status); return r.json(); };
 
  let todayData   = null;
  let historyData = [];
  let weekChart   = null;
 
  // ══════════════════════════════════════
  // CALCULER DEPUIS appData (offline-first)
  // ══════════════════════════════════════
  function computeToday() {
    const ventes = window.appData?.ventes || [];
    const today  = new Date().toISOString().split('T')[0];
    const dj     = ventes.filter(v => {
      const d = new Date(v.created_at || v.date);
      return !isNaN(d) && d.toISOString().split('T')[0] === today;
    });
    const especes = dj.filter(v => v.payment_method === 'especes' && v.paid).reduce((s,v) => s + (parseFloat(v.total)||0), 0);
    const wave    = dj.filter(v => v.payment_method === 'wave'    && v.paid).reduce((s,v) => s + (parseFloat(v.total)||0), 0);
    const orange  = dj.filter(v => v.payment_method === 'orange'  && v.paid).reduce((s,v) => s + (parseFloat(v.total)||0), 0);
    const credits = dj.filter(v => !v.paid).reduce((s,v) => s + (parseFloat(v.total)||0), 0);
    return {
      nb_ventes: dj.length, especes, wave, orange, credits,
      total_encaisse: especes + wave + orange,
      total_retours: 0, net: especes + wave + orange,
    };
  }
 
  // ══════════════════════════════════════
  // CHARGER
  // ══════════════════════════════════════
  async function loadCaisse() {
    // Données du jour (local en priorité, serveur si dispo)
    todayData = computeToday();
    try {
      const srv = await auth(`${API()}/caisse/today`).then(ok_);
      if (srv) todayData = srv;
    } catch {}
 
    // Historique des 7 derniers jours
    try {
      historyData = await auth(`${API()}/caisse/weekly`).then(ok_);
    } catch {
      // Calculer localement les 7 derniers jours depuis appData
      historyData = computeWeekLocally();
    }
 
    render();
  }
 
  function computeWeekLocally() {
    const ventes = window.appData?.ventes || [];

    // Construire un index date→ventes en une seule itération (O(n) au lieu de O(n×7))
    const index = {};
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6); cutoff.setHours(0,0,0,0);

    ventes.forEach(v => {
      const raw = v.created_at || v.date;
      if (!raw) return;
      const vd = new Date(raw);
      if (isNaN(vd) || vd < cutoff) return;
      const ds = vd.toISOString().split('T')[0];
      if (!index[ds]) index[ds] = [];
      index[ds].push(v);
    });

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const ds = d.toISOString().split('T')[0];
      const dv = index[ds] || [];
      days.push({
        date:           ds,
        label:          d.toLocaleDateString('fr-FR', { weekday:'short', day:'2-digit' }),
        total_encaisse: dv.filter(v => v.paid).reduce((s,v) => s + (parseFloat(v.total)||0), 0),
        nb_ventes:      dv.length,
      });
    }
    return days;
  }
 
  // ══════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════
  function render() {
    const el = document.getElementById('caisseContent');
    if (!el || !todayData) return;
 
    const d       = todayData;
    const dateStr = new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long' });
    const boutique = document.getElementById('appHeader')?.textContent?.replace('🏪','').trim() || 'Boutique';
 
    el.innerHTML = `
      <!-- Date -->
      <div style="text-align:center;font-size:12px;font-weight:700;color:var(--muted);text-transform:capitalize;margin-bottom:14px;">${dateStr}</div>
 
      <!-- Net du jour -->
      <div style="background:linear-gradient(135deg,#5B21B6,#7C3AED,#EC4899);border-radius:22px;padding:22px;text-align:center;margin-bottom:14px;">
        <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;">💰 Net de caisse aujourd'hui</div>
        <div style="font-family:'Sora',sans-serif;font-size:32px;font-weight:800;color:#fff;">${(+d.net||+d.total_encaisse||0).toLocaleString('fr-FR')} F</div>
        <div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:6px;">${d.nb_ventes} vente${d.nb_ventes>1?'s':''} aujourd'hui</div>
      </div>
 
      <!-- Détail par mode -->
      <div class="module-stats" style="margin-bottom:14px;">
        <div class="module-stat-tile" style="background:#ECFDF5;">
          <div class="msv" style="color:#10B981;font-size:16px;">${(+d.especes||0).toLocaleString('fr-FR')} F</div>
          <div class="msl">💵 Espèces</div>
        </div>
        <div class="module-stat-tile" style="background:#EFF6FF;">
          <div class="msv" style="color:#3B82F6;font-size:16px;">${(+d.wave||0).toLocaleString('fr-FR')} F</div>
          <div class="msl">📱 Wave</div>
        </div>
        <div class="module-stat-tile" style="background:#FFFBEB;">
          <div class="msv" style="color:#D97706;font-size:16px;">${(+d.orange||0).toLocaleString('fr-FR')} F</div>
          <div class="msl">📞 Orange</div>
        </div>
        <div class="module-stat-tile" style="background:${(+d.credits||0)>0?'#FEF2F2':'#F0FDF4'};">
          <div class="msv" style="color:${(+d.credits||0)>0?'#EF4444':'#10B981'};font-size:16px;">${(+d.credits||0).toLocaleString('fr-FR')} F</div>
          <div class="msl">💳 Crédits</div>
        </div>
      </div>
 
      <!-- Graphique 7 jours -->
      <div style="background:var(--surface);border-radius:20px;padding:16px;margin-bottom:14px;box-shadow:0 2px 14px rgba(0,0,0,.06);">
        <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:var(--text);margin-bottom:12px;">📊 7 derniers jours</div>
        <canvas id="caisse-week-chart" height="110"></canvas>
      </div>
 
      <!-- Historique clôtures -->
      <div style="background:var(--surface);border-radius:20px;padding:16px;margin-bottom:14px;box-shadow:0 2px 14px rgba(0,0,0,.06);">
        <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:var(--text);margin-bottom:12px;">📜 Clôtures précédentes</div>
        <div id="caisse-history-list">
          ${historyData.length ? historyData.slice(0,7).map(h => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #F3F4F6;">
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--text);">
                  ${new Date(h.date).toLocaleDateString('fr-FR', {weekday:'short',day:'2-digit',month:'short'})}
                </div>
                <div style="font-size:11px;color:var(--muted);margin-top:2px;">${h.nb_ventes||0} vente${(h.nb_ventes||0)>1?'s':''}</div>
              </div>
              <div style="font-family:'Sora',sans-serif;font-size:15px;font-weight:800;color:#10B981;">
                ${(+h.total_encaisse||+h.total_net||0).toLocaleString('fr-FR')} F
              </div>
            </div>
          `).join('') : '<div style="text-align:center;color:var(--muted);font-size:13px;padding:10px 0;">Aucune clôture encore</div>'}
        </div>
      </div>
 
      <!-- Actions -->
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
        <button id="caisse-close-btn" style="
          padding:14px;background:linear-gradient(135deg,#10B981,#059669);
          color:#fff;border:none;border-radius:16px;
          font-family:'Sora',sans-serif;font-size:14px;font-weight:700;
          cursor:pointer;box-shadow:0 4px 14px rgba(16,185,129,.3);
          display:flex;align-items:center;justify-content:center;gap:8px;
        ">✅ Clôturer et exporter PDF</button>
 
        <button id="caisse-refresh-btn" style="
          padding:12px;background:#F3F4F6;color:var(--muted);
          border:none;border-radius:14px;
          font-family:'Sora',sans-serif;font-size:13px;font-weight:600;cursor:pointer;
        ">🔄 Actualiser</button>
      </div>
    `;
 
    // Graphique
    requestAnimationFrame(() => renderWeekChart());
 
    // Boutons
    el.querySelector('#caisse-close-btn').addEventListener('click', closeCaisse);
    el.querySelector('#caisse-refresh-btn').addEventListener('click', loadCaisse);
  }
 
  function renderWeekChart() {
    if (weekChart) { weekChart.destroy(); weekChart = null; }
    const ctx = document.getElementById('caisse-week-chart')?.getContext('2d');
    if (!ctx || !window.Chart) return;
 
    const labels = historyData.map(h => h.label || new Date(h.date).toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit'}));
    const data   = historyData.map(h => +h.total_encaisse || +h.total_net || 0);
 
    // Couleur du dernier jour (aujourd'hui) en violet
    const colors = data.map((_, i) => i === data.length - 1 ? '#7C3AED' : '#C4B5FD');
 
    weekChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data, backgroundColor: colors, borderRadius: 8, borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend:{ display:false }, tooltip:{
          callbacks: { label: ctx => `${ctx.parsed.y.toLocaleString('fr-FR')} F` }
        }},
        scales: {
          y: { ticks:{ callback: v => v >= 1000 ? Math.round(v/1000)+'k':v, font:{size:9} }, grid:{color:'rgba(0,0,0,.04)'} },
          x: { ticks:{ font:{size:9} }, grid:{ display:false } },
        },
      },
    });
  }
 
  // ══════════════════════════════════════
  // CLÔTURER
  // ══════════════════════════════════════
  async function closeCaisse() {
    const btn = document.getElementById('caisse-close-btn');
    if (btn) { btn.textContent = '⏳ Clôture en cours…'; btn.disabled = true; }
 
    try {
      await auth(`${API()}/caisse/close`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ notes: '' }),
      }).then(ok_);
    } catch {} // non-bloquant
 
    window.showNotification?.('✅ Caisse clôturée', 'success');
    generatePDF();
    await loadCaisse();
  }
 
  function generatePDF() {
    if (!window.jspdf?.jsPDF) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a5' });
    const W   = doc.internal.pageSize.getWidth();
    const d   = todayData || {};
    const dateStr = new Date().toLocaleDateString('fr-FR');
    const boutique = document.getElementById('appHeader')?.textContent?.replace('🏪','').trim() || 'Sama Commerce';
 
    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, W, 28, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text(boutique, W/2, 11, {align:'center'});
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('CLÔTURE DE CAISSE — ' + dateStr, W/2, 20, {align:'center'});
 
    let y = 36;
    const rows = [
      ['💵 Espèces',        `${(+d.especes||0).toLocaleString('fr-FR')} F`],
      ['📱 Wave',           `${(+d.wave||0).toLocaleString('fr-FR')} F`],
      ['📞 Orange Money',   `${(+d.orange||0).toLocaleString('fr-FR')} F`],
      ['💳 Crédits non payés', `${(+d.credits||0).toLocaleString('fr-FR')} F`],
      ['↩️ Retours',        `${(+d.total_retours||0).toLocaleString('fr-FR')} F`],
    ];
    doc.setTextColor(30,27,75); doc.setFontSize(10);
    rows.forEach(([l,v]) => {
      doc.setFont('helvetica','normal'); doc.text(l, 14, y);
      doc.setFont('helvetica','bold');   doc.text(v, W-14, y, {align:'right'});
      y += 8;
    });
    doc.setDrawColor(229,231,235); doc.line(14, y, W-14, y); y += 6;
 
    doc.setFillColor(236,253,245);
    doc.rect(10, y-4, W-20, 12, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(6,95,70);
    doc.text('NET DE CAISSE', 14, y+3);
    doc.text(`${(+d.net||+d.total_encaisse||0).toLocaleString('fr-FR')} F`, W-14, y+3, {align:'right'});
    y += 16;
 
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(107,114,128);
    doc.text(`${d.nb_ventes||0} ventes effectuées`, 14, y);
    doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, W-14, y, {align:'right'});
 
    doc.save(`caisse_${new Date().toISOString().split('T')[0]}.pdf`);
    window.showNotification?.('📄 PDF exporté', 'success');
  }
 
  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function initCaisseSection() {
    const sec = document.getElementById('caisseSection');
    if (!sec || sec._init) return; sec._init = true;
    loadCaisse();
  }
 
  window.initCaisseSection = initCaisseSection;
  window.loadCaisse = loadCaisse;
  window.addEventListener('pageChange', e => { if(e.detail?.key==='caisse') initCaisseSection(); });
 
})();
