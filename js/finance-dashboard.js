/**
 * finance-dashboard.js — Tableau de bord financier avancé
 *
 * Accessible depuis Chiffres → onglet "Analyse"
 *   - Courbe CA sur 12 mois
 *   - Taux de marge mensuel
 *   - Break-even point
 *   - Capital immobilisé en stock
 *   - Top 5 produits par marge
 *
 * INTÉGRATION : <script src="js/finance-dashboard.js"></script>
 */

(function () {

  const API  = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth = (url, o={}) => window.authfetch(url, o);

  // ══════════════════════════════════════
  // CALCULS FINANCIERS
  // ══════════════════════════════════════
  function computeFinance() {
    const ventes   = window.appData?.ventes   || [];
    const produits = window.appData?.produits  || [];
    const now      = new Date();

    // ── CA et coûts par mois (12 derniers mois) ──
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleDateString('fr-FR', { month:'short', year:'2-digit' }),
        year:  d.getFullYear(),
        month: d.getMonth(),
        ca:    0,
        cout:  0,
        nb:    0,
      });
    }

    ventes.forEach(v => {
      const d = new Date(v.created_at || v.date);
      if (isNaN(d)) return;
      const slot = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
      if (!slot) return;
      slot.ca += v.total || 0;
      slot.nb++;

      // Estimer le coût (prix_achat × quantité)
      const prod = produits.find(p => p.id === parseInt(v.product_id));
      const achat = prod ? (prod.priceAchat || prod.price_achat || 0) : 0;
      slot.cout += achat * (v.quantity || 1);
    });

    months.forEach(m => { m.marge = m.ca > 0 ? Math.round((m.ca - m.cout) / m.ca * 100) : 0; });

    // ── Capital immobilisé ──
    const capitalStock = produits.reduce((s, p) => {
      return s + (p.stock || 0) * (p.priceAchat || p.price_achat || 0);
    }, 0);

    // ── Valeur marchande du stock ──
    const valeurMarche = produits.reduce((s, p) => s + (p.stock || 0) * (p.price || 0), 0);

    // ── Break-even (seuil de rentabilité mensuel approximatif) ──
    const totalCouts  = months.reduce((s, m) => s + m.cout, 0);
    const moyenneCout = Math.round(totalCouts / 12);
    const breakEven   = moyenneCout;

    // ── Top 5 par marge brute ──
    const topProduits = [...produits]
      .filter(p => (p.vendu || 0) > 0)
      .map(p => {
        const achat  = p.priceAchat || p.price_achat || 0;
        const marge  = achat > 0 ? Math.round((p.price - achat) / achat * 100) : 0;
        const benefice = (p.vendu || 0) * (p.price - achat);
        return { ...p, marge, benefice };
      })
      .sort((a, b) => b.benefice - a.benefice)
      .slice(0, 5);

    // ── Mois courant ──
    const currentMonth = months[months.length - 1];
    const prevMonth    = months[months.length - 2];
    const caEvol       = prevMonth.ca > 0
      ? Math.round((currentMonth.ca - prevMonth.ca) / prevMonth.ca * 100)
      : 0;

    return { months, capitalStock, valeurMarche, breakEven, topProduits, currentMonth, caEvol };
  }

  // ══════════════════════════════════════
  // OUVRIR LE DASHBOARD
  // ══════════════════════════════════════
  function openFinanceDashboard() {
    const fin = computeFinance();
    document.getElementById('finance-dashboard-modal')?.remove();

    const bd = document.createElement('div');
    bd.id = 'finance-dashboard-modal';
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet" style="max-height:94dvh;">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">💹 Tableau de bord financier</div>

        <!-- KPIs -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:16px;">
          <div style="background:#EDE9FE;border-radius:16px;padding:14px;text-align:center;">
            <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:#7C3AED;">
              ${fin.currentMonth.ca.toLocaleString('fr-FR')} F
            </div>
            <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;margin-top:4px;">CA ce mois</div>
            <div style="font-size:11px;color:${fin.caEvol>=0?'#10B981':'#EF4444'};font-weight:700;margin-top:3px;">
              ${fin.caEvol>=0?'▲':'▼'} ${Math.abs(fin.caEvol)}% vs mois préc.
            </div>
          </div>
          <div style="background:#ECFDF5;border-radius:16px;padding:14px;text-align:center;">
            <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:#10B981;">
              ${fin.currentMonth.marge}%
            </div>
            <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;margin-top:4px;">Taux de marge</div>
            <div style="font-size:11px;color:${fin.currentMonth.marge>=30?'#10B981':fin.currentMonth.marge>=15?'#F59E0B':'#EF4444'};font-weight:700;margin-top:3px;">
              ${fin.currentMonth.marge>=30?'✅ Excellent':fin.currentMonth.marge>=15?'⚠️ Moyen':'❌ Faible'}
            </div>
          </div>
          <div style="background:#EFF6FF;border-radius:16px;padding:14px;text-align:center;">
            <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:#3B82F6;">
              ${fin.capitalStock.toLocaleString('fr-FR')} F
            </div>
            <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;margin-top:4px;">Capital stock</div>
            <div style="font-size:11px;color:#6B7280;margin-top:3px;">Prix d'achat</div>
          </div>
          <div style="background:#FFFBEB;border-radius:16px;padding:14px;text-align:center;">
            <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:#D97706;">
              ${fin.breakEven.toLocaleString('fr-FR')} F
            </div>
            <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;margin-top:4px;">Seuil mensuel</div>
            <div style="font-size:11px;color:#6B7280;margin-top:3px;">Coûts moyens</div>
          </div>
        </div>

        <!-- Graphique CA 12 mois -->
        <div style="background:var(--surface);border-radius:16px;padding:14px;margin-bottom:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
          <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:var(--text);margin-bottom:10px;">📈 Évolution CA — 12 mois</div>
          <canvas id="fin-chart-ca" height="120"></canvas>
        </div>

        <!-- Graphique marge mensuelle -->
        <div style="background:var(--surface);border-radius:16px;padding:14px;margin-bottom:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
          <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:var(--text);margin-bottom:10px;">📊 Taux de marge mensuel</div>
          <canvas id="fin-chart-marge" height="100"></canvas>
        </div>

        <!-- Top 5 produits -->
        ${fin.topProduits.length ? `
          <div style="background:var(--surface);border-radius:16px;padding:14px;margin-bottom:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
            <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:var(--text);margin-bottom:10px;">🏆 Top 5 produits par bénéfice</div>
            ${fin.topProduits.map((p,i) => {
              const maxB = fin.topProduits[0].benefice || 1;
              const pct  = Math.round((p.benefice / maxB) * 100);
              return `
                <div style="margin-bottom:10px;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <div style="font-size:12px;font-weight:700;color:var(--text);">${i+1}. ${p.name}</div>
                    <div style="font-size:12px;font-weight:800;color:#10B981;">${p.benefice.toLocaleString('fr-FR')} F</div>
                  </div>
                  <div style="background:#F3F4F6;border-radius:999px;height:4px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#7C3AED,#10B981);border-radius:999px;"></div>
                  </div>
                  <div style="font-size:10px;color:var(--muted);margin-top:2px;">Marge : ${p.marge}% · ${p.vendu||0} vendu${(p.vendu||0)>1?'s':''}</div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        <button onclick="document.getElementById('finance-dashboard-modal').remove()" style="
          width:100%;padding:13px;background:#F9FAFB;color:#6B7280;
          border:none;border-radius:14px;font-family:'Sora',sans-serif;
          font-size:14px;font-weight:600;cursor:pointer;
        ">Fermer</button>
      </div>
    `;

    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if(e.target===bd) bd.remove(); });

    // Rendre les graphiques après affichage
    requestAnimationFrame(() => {
      renderCharts(fin);
    });
  }

  function renderCharts(fin) {
    const labels = fin.months.map(m => m.label);

    // Graphique CA
    const caCtx = document.getElementById('fin-chart-ca')?.getContext('2d');
    if (caCtx && window.Chart) {
      new window.Chart(caCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'CA (F)',
            data: fin.months.map(m => m.ca),
            borderColor: '#7C3AED',
            backgroundColor: 'rgba(124,58,237,.1)',
            borderWidth: 2.5,
            fill: true,
            tension: .4,
            pointRadius: 3,
            pointBackgroundColor: '#7C3AED',
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { ticks: { callback: v => v.toLocaleString('fr-FR') + ' F', font:{size:9} }, grid:{ color:'rgba(0,0,0,.04)' } },
            x: { ticks: { font:{size:9} }, grid:{ display:false } },
          },
        },
      });
    }

    // Graphique marge
    const margeCtx = document.getElementById('fin-chart-marge')?.getContext('2d');
    if (margeCtx && window.Chart) {
      new window.Chart(margeCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Marge %',
            data: fin.months.map(m => m.marge),
            backgroundColor: fin.months.map(m =>
              m.marge >= 30 ? 'rgba(16,185,129,.7)' :
              m.marge >= 15 ? 'rgba(245,158,11,.7)' :
              'rgba(239,68,68,.7)'
            ),
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display:false } },
          scales: {
            y: { ticks: { callback: v => v+'%', font:{size:9} }, max:100, grid:{ color:'rgba(0,0,0,.04)' } },
            x: { ticks: { font:{size:9} }, grid:{ display:false } },
          },
        },
      });
    }
  }

  // ══════════════════════════════════════
  // INJECTER BOUTON DANS CHIFFRES
  // ══════════════════════════════════════
  function injectFinanceButton() {
    if (document.getElementById('finance-dash-btn')) return;
    const header = document.querySelector('#rapportsSection .page-header');
    if (!header) return;

    const btn = document.createElement('button');
    btn.id = 'finance-dash-btn';
    btn.style.cssText = `
      background:linear-gradient(135deg,#1D4ED8,#06B6D4);
      color:#fff;border:none;padding:8px 12px;border-radius:12px;
      font-family:'Sora',sans-serif;font-size:12px;font-weight:700;
      cursor:pointer;box-shadow:0 3px 8px rgba(29,78,216,.3);
      display:flex;align-items:center;gap:5px;
    `;
    btn.innerHTML = '💹 Analyse';
    btn.addEventListener('click', openFinanceDashboard);
    header.appendChild(btn);
  }

  window.openFinanceDashboard = openFinanceDashboard;

  function init() {
    injectFinanceButton();
    window.addEventListener('pageChange', e => {
      if (e.detail?.key==='rapports') setTimeout(injectFinanceButton, 200);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
