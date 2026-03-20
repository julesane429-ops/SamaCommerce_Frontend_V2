/**
 * reappro-prediction.js — Prédiction intelligente d'épuisement de stock
 *
 * Étend reappro.js avec une analyse de la vitesse d'écoulement :
 *   - Calcule les ventes/semaine pour chaque produit (sur 4 semaines)
 *   - Prédit le nombre de jours avant épuisement
 *   - Trie les produits par urgence (jours restants)
 *   - Remplace la bannière simple par une bannière enrichie avec prédictions
 *   - Ajoute un bloc "Stock Intelligence" dans la section Stock
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/reappro-prediction.js"></script>
 *   (après reappro.js)
 */

(function () {

  const SEMAINES_ANALYSE = 4; // Analyser les 4 dernières semaines
  const JOURS_URGENCE    = 7; // ≤ 7 jours = urgent
  const JOURS_ATTENTION  = 14; // ≤ 14 jours = attention

  // ══════════════════════════════════════
  // CALCUL VITESSE D'ÉCOULEMENT
  // ══════════════════════════════════════

  function analyserProduit(produit) {
    const ventes  = window.appData?.ventes || [];
    const now     = new Date();
    const debut   = new Date(now);
    debut.setDate(debut.getDate() - (SEMAINES_ANALYSE * 7));

    // Ventes du produit sur la période d'analyse
    const ventesRecentes = ventes.filter(v => {
      if (parseInt(v.product_id) !== produit.id) return false;
      const d = new Date(v.created_at || v.date);
      return !isNaN(d) && d >= debut && d <= now;
    });

    const totalVendu = ventesRecentes.reduce((s, v) => s + (v.quantity || 0), 0);
    const joursAnalyse = SEMAINES_ANALYSE * 7;

    // Vitesse : unités/jour
    const vitesse = totalVendu / joursAnalyse;

    // Jours restants avant épuisement
    const joursRestants = vitesse > 0
      ? Math.floor(produit.stock / vitesse)
      : (produit.stock > 0 ? Infinity : 0);

    // Quantité suggérée à commander (pour 4 semaines)
    const qteCommandee = Math.max(
      Math.ceil(vitesse * 28) - produit.stock,
      10 - produit.stock,
      1
    );

    return {
      produit,
      vitesse:       Math.round(vitesse * 10) / 10, // unités/jour arrondi
      ventesParSemaine: Math.round(vitesse * 7 * 10) / 10,
      joursRestants,
      qteCommandee,
      urgence: joursRestants === 0        ? 'rupture'
             : joursRestants <= JOURS_URGENCE   ? 'urgent'
             : joursRestants <= JOURS_ATTENTION  ? 'attention'
             : 'ok',
    };
  }

  function analyserTousProduits() {
    const produits = window.appData?.produits || [];
    return produits
      .map(p => analyserProduit(p))
      .filter(a => a.urgence !== 'ok' && !isIgnoredToday(a.produit.id))
      .sort((a, b) => {
        // Trier : rupture d'abord, puis jours restants croissants
        if (a.urgence === 'rupture' && b.urgence !== 'rupture') return -1;
        if (b.urgence === 'rupture' && a.urgence !== 'rupture') return 1;
        return (a.joursRestants === Infinity ? 9999 : a.joursRestants)
             - (b.joursRestants === Infinity ? 9999 : b.joursRestants);
      });
  }

  // ══════════════════════════════════════
  // GESTION DES IGNORÉS (réutilise reappro.js)
  // ══════════════════════════════════════
  function isIgnoredToday(id) {
    try {
      const d     = JSON.parse(localStorage.getItem('sc_reappro_dismissed') || '{}');
      const today = new Date().toISOString().split('T')[0];
      return d[String(id)] === today;
    } catch { return false; }
  }

  function ignoreToday(id) {
    try {
      const d = JSON.parse(localStorage.getItem('sc_reappro_dismissed') || '{}');
      d[String(id)] = new Date().toISOString().split('T')[0];
      localStorage.setItem('sc_reappro_dismissed', JSON.stringify(d));
    } catch {}
  }

  // ══════════════════════════════════════
  // HELPERS AFFICHAGE
  // ══════════════════════════════════════
  function urgenceConfig(urgence) {
    return {
      rupture:   { bg:'#FEF2F2', border:'#FCA5A5', color:'#DC2626', badge:'⛔ Rupture',    badgeBg:'#FEE2E2' },
      urgent:    { bg:'#FFF7ED', border:'#FED7AA', color:'#C2410C', badge:'🚨 Urgent',     badgeBg:'#FFEDD5' },
      attention: { bg:'#FFFBEB', border:'#FDE68A', color:'#D97706', badge:'⚠️ Attention',  badgeBg:'#FEF3C7' },
    }[urgence] || {};
  }

  function joursLabel(jours) {
    if (jours === 0)        return 'En rupture';
    if (jours === Infinity) return 'Stock statique';
    if (jours === 1)        return '1 jour restant';
    if (jours < 30)         return `${jours} jours restants`;
    return `${Math.floor(jours/30)} mois restants`;
  }

  function vitesseLabel(v) {
    if (v === 0) return 'Aucune vente récente';
    if (v < 0.5) return `~${Math.round(v*7*10)/10} /semaine`;
    return `~${v} /jour`;
  }

  // ══════════════════════════════════════
  // BANNIÈRE INTELLIGENTE (remplace celle de reappro.js)
  // ══════════════════════════════════════
  function showSmartBanner(analyses) {
    document.getElementById('reappro-banner')?.remove();
    document.getElementById('reappro-smart-banner')?.remove();

    if (!analyses.length) return;

    const menu = document.getElementById('menuSection');
    if (!menu || menu.classList.contains('hidden')) return;

    const ruptures   = analyses.filter(a => a.urgence === 'rupture');
    const urgents    = analyses.filter(a => a.urgence === 'urgent');
    const attentions = analyses.filter(a => a.urgence === 'attention');

    const banner = document.createElement('div');
    banner.id = 'reappro-smart-banner';
    banner.style.cssText = `
      background:var(--surface);
      border:1.5px solid #F59E0B;
      border-radius:20px;
      padding:16px;
      margin-bottom:12px;
      box-shadow:0 4px 16px rgba(245,158,11,.15);
      animation:reapproIn .35s cubic-bezier(.34,1.3,.64,1) both;
    `;

    // En-tête avec résumé
    const totalUrgent = ruptures.length + urgents.length;
    banner.innerHTML = `
      <style>
        @keyframes reapproIn { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        .pred-item { border-radius:12px; padding:10px 12px; margin-bottom:7px; }
        .pred-bar-wrap { background:#F3F4F6; border-radius:999px; height:4px; margin-top:6px; overflow:hidden; }
        .pred-bar { height:100%; border-radius:999px; transition:width .6s ease; }
      </style>

      <!-- En-tête -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:var(--text);">
          🧠 Intelligence Stock
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${totalUrgent > 0 ? `<span style="background:#FEE2E2;color:#DC2626;font-size:10px;font-weight:800;padding:3px 9px;border-radius:999px;">${totalUrgent} urgent${totalUrgent>1?'s':''}</span>` : ''}
          <button id="pred-close" style="background:none;border:none;font-size:18px;color:var(--muted);cursor:pointer;padding:0;">✕</button>
        </div>
      </div>

      <!-- Liste produits avec prédictions -->
      <div id="pred-list">
        ${analyses.slice(0, 5).map(a => {
          const cfg = urgenceConfig(a.urgence);
          const cat = window.appData?.categories?.find(c => c.id === a.produit.category_id);
          // Barre de stock (% avant épuisement)
          const maxJours = 30;
          const pct = a.joursRestants === Infinity ? 100
                    : Math.min(100, Math.round((a.joursRestants / maxJours) * 100));
          const barColor = a.urgence === 'rupture' ? '#DC2626'
                         : a.urgence === 'urgent'  ? '#EA580C'
                         : '#D97706';

          return `
            <div class="pred-item" style="background:${cfg.bg};border:1px solid ${cfg.border};">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
                  <span style="font-size:20px;">${cat?.emoji || '📦'}</span>
                  <div style="min-width:0;">
                    <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:${cfg.color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      ${a.produit.name}
                    </div>
                    <div style="font-size:11px;color:${cfg.color};opacity:.8;margin-top:1px;">
                      ${vitesseLabel(a.vitesse)} · ${a.produit.stock} en stock
                    </div>
                  </div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                  <span style="background:${cfg.badgeBg};color:${cfg.color};font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;">
                    ${a.urgence === 'rupture' ? '⛔ Rupture' : joursLabel(a.joursRestants)}
                  </span>
                </div>
              </div>
              <!-- Barre progression jours restants -->
              ${a.urgence !== 'rupture' ? `
                <div class="pred-bar-wrap">
                  <div class="pred-bar" style="width:${pct}%;background:${barColor};"></div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
        ${analyses.length > 5 ? `<div style="text-align:center;font-size:12px;color:var(--muted);font-weight:600;">+ ${analyses.length-5} autre${analyses.length-5>1?'s':''}</div>` : ''}
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button id="pred-order-btn" style="
          flex:2;padding:11px;
          background:linear-gradient(135deg,#F59E0B,#D97706);
          color:#fff;border:none;border-radius:12px;
          font-family:'Sora',sans-serif;font-size:13px;font-weight:800;
          cursor:pointer;box-shadow:0 3px 10px rgba(245,158,11,.3);
          display:flex;align-items:center;justify-content:center;gap:6px;">
          📦 Commander <span style="background:rgba(255,255,255,.25);padding:2px 8px;border-radius:6px;font-size:10px;">AUTO</span>
        </button>
        <button id="pred-view-btn" style="
          flex:1;padding:11px;
          background:var(--surface);color:var(--primary);
          border:1.5px solid rgba(124,58,237,.2);border-radius:12px;
          font-family:'Sora',sans-serif;font-size:12px;font-weight:700;
          cursor:pointer;">
          📊 Détails
        </button>
        <button id="pred-dismiss-btn" style="
          padding:11px 14px;
          background:#F3F4F6;color:var(--muted);
          border:none;border-radius:12px;
          font-size:12px;font-weight:600;cursor:pointer;">
          ✕
        </button>
      </div>
    `;

    // Insérer après alertesStock
    const alertes = document.getElementById('alertesStock');
    if (alertes?.parentNode) alertes.parentNode.insertBefore(banner, alertes.nextSibling);
    else menu.prepend(banner);

    // Bouton commander
    banner.querySelector('#pred-order-btn')?.addEventListener('click', () => {
      banner.remove();
      window.navTo?.('commandes');
      setTimeout(() => {
        window.openCommandeForm?.();
        setTimeout(() => {
          analyses.slice(0, 8).forEach(a => {
            const btn = document.querySelector(`.product-pick-btn[data-id="${a.produit.id}"]`);
            if (btn && !btn.classList.contains('selected')) {
              btn.click();
              if (window._cmdSel?.[a.produit.id]) {
                window._cmdSel[a.produit.id].quantity = a.qteCommandee;
              }
            }
          });
          window.showNotification?.(`📦 ${Math.min(analyses.length,8)} produits pré-sélectionnés avec quantités suggérées`, 'success');
        }, 500);
      }, 400);
    });

    // Détails → section Stock avec indicateurs
    banner.querySelector('#pred-view-btn')?.addEventListener('click', () => {
      banner.remove();
      window.navTo?.('stock');
      setTimeout(() => injectStockPredictions(analyses), 400);
    });

    // Ignorer
    banner.querySelector('#pred-dismiss-btn')?.addEventListener('click', () => {
      analyses.forEach(a => ignoreToday(a.produit.id));
      banner.remove();
    });

    banner.querySelector('#pred-close')?.addEventListener('click', () => banner.remove());
  }

  // ══════════════════════════════════════
  // INJECTION DANS LA SECTION STOCK
  // ══════════════════════════════════════
  function injectStockPredictions(analyses) {
    document.getElementById('stock-predictions')?.remove();

    const stockSection = document.getElementById('stockSection');
    if (!stockSection || !analyses?.length) return;

    const block = document.createElement('div');
    block.id = 'stock-predictions';
    block.style.cssText = 'margin-bottom:14px;';

    block.innerHTML = `
      <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:var(--text);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        🧠 Prévisions d'épuisement
        <span style="background:linear-gradient(135deg,#EDE9FE,#FCE7F3);color:#7C3AED;font-size:10px;padding:2px 8px;border-radius:6px;font-weight:700;">IA</span>
      </div>
      ${analyses.slice(0, 6).map(a => {
        const cfg = urgenceConfig(a.urgence);
        const cat = window.appData?.categories?.find(c => c.id === a.produit.category_id);
        const maxJ = 30;
        const pct  = a.joursRestants === Infinity ? 100 : Math.min(100, Math.round((a.joursRestants/maxJ)*100));
        const barC = a.urgence==='rupture'?'#DC2626': a.urgence==='urgent'?'#EA580C':'#D97706';

        return `
          <div style="background:${cfg.bg};border:1px solid ${cfg.border};border-radius:14px;padding:10px 12px;margin-bottom:7px;">
            <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
                <span style="font-size:18px;">${cat?.emoji||'📦'}</span>
                <div style="min-width:0;">
                  <div style="font-size:13px;font-weight:700;color:${cfg.color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.produit.name}</div>
                  <div style="font-size:11px;color:${cfg.color};opacity:.75;margin-top:2px;">${vitesseLabel(a.vitesse)} · ${a.produit.stock} restants · Suggéré : ${a.qteCommandee} à commander</div>
                </div>
              </div>
              <span style="background:${cfg.badgeBg};color:${cfg.color};font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;flex-shrink:0;">
                ${a.urgence==='rupture' ? '⛔' : joursLabel(a.joursRestants)}
              </span>
            </div>
            ${a.urgence !== 'rupture' ? `<div style="background:#F3F4F6;border-radius:999px;height:3px;margin-top:7px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${barC};border-radius:999px;"></div></div>` : ''}
          </div>`;
      }).join('')}
    `;

    const filtreDiv = document.getElementById('filtreCategories');
    if (filtreDiv?.parentNode) filtreDiv.parentNode.insertBefore(block, filtreDiv);
  }

  // ══════════════════════════════════════
  // HOOK SUR verifierStockFaible
  // ══════════════════════════════════════
  function hookVerification() {
    const orig = window.verifierStockFaible;
    if (typeof orig !== 'function') { setTimeout(hookVerification, 400); return; }

    let lastRun = 0;
    window.verifierStockFaible = function (...args) {
      const result = orig.apply(this, args);
      const now    = Date.now();
      if (now - lastRun < 5 * 60 * 1000) return result; // max 1x/5min
      lastRun = now;

      const analyses = analyserTousProduits();
      if (!analyses.length) return result;

      const menuVisible = !document.getElementById('menuSection')?.classList.contains('hidden');
      if (menuVisible) setTimeout(() => showSmartBanner(analyses), 400);

      return result;
    };
  }

  // ══════════════════════════════════════
  // NAVIGATION VERS STOCK → injecter prédictions
  // ══════════════════════════════════════
  function watchStockNav() {
    window.addEventListener('pageChange', e => {
      if (e.detail?.key !== 'stock') return;
      setTimeout(() => {
        const analyses = analyserTousProduits();
        if (analyses.length) injectStockPredictions(analyses);
      }, 300);
    });
  }

  // ══════════════════════════════════════
  // API PUBLIQUE
  // ══════════════════════════════════════
  window.stockPrediction = {
    analyser:    analyserProduit,
    analyserTous: analyserTousProduits,
    showBanner:  () => showSmartBanner(analyserTousProduits()),
  };

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        hookVerification();
        watchStockNav();
        // Vérification initiale 5s après chargement
        setTimeout(() => {
          const analyses = analyserTousProduits();
          const menuVisible = !document.getElementById('menuSection')?.classList.contains('hidden');
          if (analyses.length && menuVisible) showSmartBanner(analyses);
        }, 5000);
      }, 800);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
