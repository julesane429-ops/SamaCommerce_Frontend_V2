/**
 * credit-dashboard.js — Tableau de bord créances
 *
 * Injecte dans la section Crédits un résumé financier :
 *   - Total dû, total en retard, taux de recouvrement
 *   - Barre de progression créances récupérées
 *   - Top débiteurs (les plus gros montants)
 *   - Créances par échéance (aujourd'hui / cette semaine / ce mois / au-delà)
 *   - Bouton relance WhatsApp rapide
 *
 * INTÉGRATION : <script src="js/credit-dashboard.js"></script>
 */

(function () {

  const notify = (m, t) => window.showNotification?.(m, t);

  // ══════════════════════════════════════
  // CALCULS
  // ══════════════════════════════════════
  function computeStats() {
    const credits = (window.appData?.credits || window.appData?.ventes?.filter(v => {
      const pm = (v.payment_method || '').toLowerCase().trim();
      return pm === 'credit' || pm === 'crédit';
    }) || []);

    const now   = new Date(); now.setHours(0,0,0,0);
    const week  = new Date(now); week.setDate(week.getDate() + 7);
    const month = new Date(now); month.setDate(month.getDate() + 30);

    let totalDu     = 0, totalRecouvre = 0, totalRetard = 0;
    let nbTotal     = 0, nbSoldes = 0, nbRetard = 0;
    const buckets   = { aujourd_hui: [], cette_semaine: [], ce_mois: [], plus_tard: [], sans_echeance: [] };
    const parClient = {};

    credits.forEach(c => {
      const total      = parseFloat(c.total) || 0;
      const amountPaid = parseFloat(c.amount_paid) || 0;
      const restant    = total - amountPaid;
      nbTotal++;

      if (c.paid) {
        nbSoldes++;
        totalRecouvre += total;
        return;
      }

      totalDu += restant;

      // Regrouper par client
      const clientKey = c.client_name || 'Client inconnu';
      if (!parClient[clientKey]) {
        parClient[clientKey] = { name: clientKey, phone: c.client_phone, total: 0, nb: 0, credits: [] };
      }
      parClient[clientKey].total += restant;
      parClient[clientKey].nb++;
      parClient[clientKey].credits.push(c);

      // Classifier par échéance
      if (!c.due_date) {
        buckets.sans_echeance.push({ ...c, restant });
      } else {
        const due = new Date(c.due_date); due.setHours(0,0,0,0);
        if (due < now) {
          nbRetard++;
          totalRetard += restant;
          buckets.aujourd_hui.push({ ...c, restant, daysLate: Math.ceil((now - due) / 86400000) });
        } else if (due <= new Date(now.getTime() + 86400000)) {
          buckets.aujourd_hui.push({ ...c, restant, daysLate: 0 });
        } else if (due <= week) {
          buckets.cette_semaine.push({ ...c, restant });
        } else if (due <= month) {
          buckets.ce_mois.push({ ...c, restant });
        } else {
          buckets.plus_tard.push({ ...c, restant });
        }
      }
    });

    const tauxRecouvrement = (nbTotal > 0) ? Math.round((nbSoldes / nbTotal) * 100) : 0;
    const topDebiteurs = Object.values(parClient)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return { totalDu, totalRecouvre, totalRetard, nbTotal, nbSoldes, nbRetard,
             tauxRecouvrement, buckets, topDebiteurs };
  }

  // ══════════════════════════════════════
  // RENDU DU DASHBOARD
  // ══════════════════════════════════════
  function render() {
    const container = document.getElementById('credit-dashboard-widget');
    if (!container) return;

    const s   = computeStats();
    const fmt = v => Math.round(v).toLocaleString('fr-FR') + ' F';

    container.innerHTML = `
      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:14px;">
        <div style="background:linear-gradient(135deg,#FEF2F2,#fff);border:1.5px solid #FECACA;border-radius:14px;padding:13px;text-align:center;">
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:#DC2626;">${fmt(s.totalDu)}</div>
          <div style="font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.3px;margin-top:3px;">💳 Total dû</div>
        </div>
        <div style="background:linear-gradient(135deg,#FFF7ED,#fff);border:1.5px solid #FED7AA;border-radius:14px;padding:13px;text-align:center;">
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:#EA580C;">${fmt(s.totalRetard)}</div>
          <div style="font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.3px;margin-top:3px;">🚨 En retard</div>
        </div>
        <div style="background:linear-gradient(135deg,#F0FDF4,#fff);border:1.5px solid #BBF7D0;border-radius:14px;padding:13px;text-align:center;">
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:#16A34A;">${fmt(s.totalRecouvre)}</div>
          <div style="font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.3px;margin-top:3px;">✅ Récupéré</div>
        </div>
        <div style="background:linear-gradient(135deg,#EFF6FF,#fff);border:1.5px solid #BFDBFE;border-radius:14px;padding:13px;text-align:center;">
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:#2563EB;">${s.tauxRecouvrement}%</div>
          <div style="font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.3px;margin-top:3px;">📊 Taux recouvrement</div>
        </div>
      </div>

      <!-- Barre de progression -->
      <div style="background:#F9FAFB;border-radius:12px;padding:12px 14px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;color:#374151;margin-bottom:8px;">
          <span>Progression recouvrement</span>
          <span>${s.nbSoldes} / ${s.nbTotal} crédits soldés</span>
        </div>
        <div style="height:8px;background:#E5E7EB;border-radius:999px;overflow:hidden;">
          <div style="height:100%;width:${s.tauxRecouvrement}%;background:linear-gradient(135deg,#10B981,#059669);border-radius:999px;transition:width .5s ease;"></div>
        </div>
        ${s.nbRetard > 0 ? `<div style="font-size:11px;color:#EF4444;font-weight:600;margin-top:6px;">⚠️ ${s.nbRetard} crédit${s.nbRetard>1?'s':''} en retard · ${fmt(s.totalRetard)} à récupérer</div>` : ''}
      </div>

      <!-- Échéances -->
      <div style="margin-bottom:14px;">
        <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:13px;color:#111;margin-bottom:10px;">📅 Par échéance</div>
        ${renderBucketRow('🚨 En retard / Aujourd\'hui', s.buckets.aujourd_hui, '#FEF2F2', '#DC2626')}
        ${renderBucketRow('⏳ Cette semaine', s.buckets.cette_semaine, '#FFFBEB', '#D97706')}
        ${renderBucketRow('📆 Ce mois', s.buckets.ce_mois, '#EFF6FF', '#2563EB')}
        ${renderBucketRow('📌 Plus tard', s.buckets.plus_tard, '#F9FAFB', '#6B7280')}
        ${s.buckets.sans_echeance.length ? renderBucketRow('❓ Sans échéance', s.buckets.sans_echeance, '#F5F3FF', '#7C3AED') : ''}
      </div>

      <!-- Top débiteurs -->
      ${s.topDebiteurs.length ? `
        <div>
          <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:13px;color:#111;margin-bottom:10px;">👥 Principaux débiteurs</div>
          ${s.topDebiteurs.map(d => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F3F4F6;">
              <div>
                <div style="font-weight:700;font-size:13px;color:#111;">${d.name}</div>
                <div style="font-size:11px;color:#9CA3AF;">${d.nb} crédit${d.nb>1?'s':''} ouvert${d.nb>1?'s':''}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <div style="font-weight:800;font-size:14px;color:#DC2626;">${fmt(d.total)}</div>
                ${d.phone ? `
                  <button onclick="window._waRelance('${d.name}','${d.phone}',${d.total})"
                    style="background:#25D366;color:#fff;border:none;padding:5px 8px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">
                    📱 WA
                  </button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  function renderBucketRow(label, items, bg, color) {
    if (!items.length) return '';
    const total = items.reduce((s, c) => s + c.restant, 0);
    const fmt   = v => Math.round(v).toLocaleString('fr-FR') + ' F';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;background:${bg};border-radius:10px;padding:9px 12px;margin-bottom:7px;">
        <div>
          <div style="font-size:12px;font-weight:700;color:${color};">${label}</div>
          <div style="font-size:11px;color:#9CA3AF;margin-top:1px;">${items.length} crédit${items.length>1?'s':''}</div>
        </div>
        <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:14px;color:${color};">${fmt(total)}</div>
      </div>`;
  }

  // ══════════════════════════════════════
  // RELANCE WHATSAPP
  // ══════════════════════════════════════
  window._waRelance = (name, phone, amount) => {
    const msg = encodeURIComponent(
      `Bonjour ${name} 👋\n\nNous vous rappelons que vous avez un crédit de *${Math.round(amount).toLocaleString('fr-FR')} FCFA* en attente.\n\nMerci de régulariser votre situation. 🙏`
    );
    const clean = phone.replace(/\s+/g, '').replace(/^0/, '221');
    window.open(`https://wa.me/${clean}?text=${msg}`, '_blank');
  };

  // ══════════════════════════════════════
  // INJECTION DANS LA SECTION CREDITS
  // ══════════════════════════════════════
  function injectWidget() {
    // Trouver la section crédits
    const credSection = document.getElementById('creditsSection');
    if (!credSection) { setTimeout(injectWidget, 500); return; }

    // Ne pas injecter deux fois
    if (document.getElementById('credit-dashboard-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'credit-dashboard-widget';
    widget.style.cssText = 'padding:0 0 16px;';

    // Injecter en tête de section (avant le tableau existant)
    credSection.insertBefore(widget, credSection.firstChild);
    render();
  }

  // ══════════════════════════════════════
  // RAFRAÎCHISSEMENT AUTOMATIQUE
  // ══════════════════════════════════════
  function refresh() {
    if (document.getElementById('credit-dashboard-widget')) {
      render();
    }
  }

  // Écouter les changements de section
  window.addEventListener('pageChange', e => {
    if (e.detail?.key === 'credits') {
      setTimeout(injectWidget, 100);
    }
  });

  // Rafraîchir après chaque sync
  const origSync = window.syncFromServer;
  if (typeof origSync === 'function' && !origSync._creditDashPatched) {
    window.syncFromServer = async function (...args) {
      const r = await origSync.apply(this, args);
      setTimeout(refresh, 200);
      return r;
    };
    window.syncFromServer._creditDashPatched = true;
  }

  // API publique
  window.creditDashboard = { refresh, render };

  // Init
  function init() {
    if (!window.appData) { setTimeout(init, 300); return; }
    // S'injecter quand la section crédits est active
    injectWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
  } else {
    setTimeout(init, 1000);
  }

})();
