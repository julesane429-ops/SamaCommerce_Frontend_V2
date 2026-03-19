/**
 * end-of-day.js — Résumé de fin de journée
 *
 * Affiche un bottom sheet automatiquement quand :
 *   1. L'heure est >= 18h00
 *   2. L'utilisateur revient sur l'accueil (#menuSection)
 *   3. Le résumé n'a pas encore été affiché aujourd'hui
 *
 * Contient :
 *   - CA du jour, articles vendus, nombre de ventes, montant moyen
 *   - Progression vers l'objectif du jour (si défini)
 *   - Top produit de la journée
 *   - Message motivant contextuel
 *
 * INTÉGRATION dans index.html, juste avant </body> :
 *   <script src="js/end-of-day.js"></script>
 */

(function () {

  const STORAGE_KEY  = 'sc_eod_last_shown';
  const TRIGGER_HOUR = 18; // heure à partir de laquelle afficher

  // ══════════════════════════════════════
  // VÉRIFIER SI DÉJÀ AFFICHÉ AUJOURD'HUI
  // ══════════════════════════════════════
  function alreadyShownToday() {
    const last = localStorage.getItem(STORAGE_KEY);
    if (!last) return false;
    const today = new Date().toISOString().split('T')[0];
    return last === today;
  }

  function markShownToday() {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(STORAGE_KEY, today);
  }

  // ══════════════════════════════════════
  // CALCULER LES STATS DU JOUR
  // ══════════════════════════════════════
  function getDayStats() {
    const data = window.appData;
    if (!data || !Array.isArray(data.ventes)) {
      return { ca: 0, articles: 0, nbVentes: 0, moyVente: 0, topProduit: null };
    }

    const today = new Date().toISOString().split('T')[0];

    const ventesJour = data.ventes.filter(v => {
      const raw = v.created_at || v.date || v.timestamp;
      if (!raw) return false;
      return new Date(raw).toISOString().split('T')[0] === today;
    });

    const ca       = ventesJour.reduce((s, v) => s + (v.total || 0), 0);
    const articles = ventesJour.reduce((s, v) => s + (v.quantity || 0), 0);
    const nbVentes = ventesJour.length;
    const moyVente = nbVentes > 0 ? Math.round(ca / nbVentes) : 0;

    // Top produit (par CA)
    const prodMap = {};
    ventesJour.forEach(v => {
      const pid = v.product_id;
      if (!pid) return;
      if (!prodMap[pid]) prodMap[pid] = { ca: 0, qty: 0 };
      prodMap[pid].ca  += v.total    || 0;
      prodMap[pid].qty += v.quantity || 0;
    });

    let topProduit = null;
    let topCA      = 0;
    Object.entries(prodMap).forEach(([pid, s]) => {
      if (s.ca > topCA) {
        topCA = s.ca;
        const prod = data.produits?.find(p => String(p.id) === String(pid));
        const cat  = prod ? data.categories?.find(c => c.id === prod.category_id) : null;
        topProduit = { name: prod?.name || '—', emoji: cat?.emoji || '📦', ca: s.ca, qty: s.qty };
      }
    });

    return { ca, articles, nbVentes, moyVente, topProduit };
  }

  // ══════════════════════════════════════
  // LIRE L'OBJECTIF DU JOUR
  // ══════════════════════════════════════
  function getGoal() {
    const uid = localStorage.getItem('userId') || 'default';
    const raw = localStorage.getItem(`sc_daily_goal_${uid}`);
    return raw ? parseInt(raw, 10) : null;
  }

  // ══════════════════════════════════════
  // MESSAGE MOTIVANT CONTEXTUEL
  // ══════════════════════════════════════
  function getMessage(stats, goal) {
    if (stats.ca === 0)        return '🛒 Demain sera meilleur, continuez !';
    if (goal && stats.ca >= goal) return '🏆 Exceptionnel ! Objectif atteint, bravo !';
    if (goal && stats.ca >= goal * .8) return '💪 Presque là ! Encore un effort demain.';
    if (stats.nbVentes >= 10) return '🚀 Excellente journée, continuez sur cette lancée !';
    if (stats.nbVentes >= 5)  return '👍 Bonne journée ! Demain encore mieux.';
    return '✨ Chaque vente compte. À demain !';
  }

  // ══════════════════════════════════════
  // CONSTRUIRE ET AFFICHER LE SHEET
  // ══════════════════════════════════════
  function show() {
    if (document.getElementById('eod-backdrop')) return; // déjà ouvert

    const stats = getDayStats();
    const goal  = getGoal();
    const pct   = goal ? Math.min(Math.round((stats.ca / goal) * 100), 100) : null;
    const msg   = getMessage(stats, goal);

    // ── Bloc objectif ──
    let goalHTML = '';
    if (goal) {
      const reached = stats.ca >= goal;
      goalHTML = `
        <div class="eod-goal-row">
          <div class="eod-goal-left">
            <div class="eod-goal-label">🎯 Objectif du jour</div>
            <div class="eod-goal-bar-wrap">
              <div class="eod-goal-bar ${reached ? 'reached' : ''}"
                   style="width:0%"
                   data-pct="${pct}"></div>
            </div>
          </div>
          <div>
            <div class="eod-goal-pct ${reached ? 'reached' : ''}">${pct}%</div>
            <div class="eod-goal-badge ${reached ? 'reached' : 'missed'}">
              ${reached ? '🎉 Atteint' : `${(goal - stats.ca).toLocaleString('fr-FR')} F restants`}
            </div>
          </div>
        </div>
      `;
    } else {
      goalHTML = `
        <div class="eod-goal-row">
          <div class="eod-goal-label">🎯 Objectif du jour</div>
          <div class="eod-goal-badge no-goal">Non défini</div>
        </div>
      `;
    }

    // ── Top produit ──
    let topHTML = '';
    if (stats.topProduit) {
      topHTML = `
        <div class="eod-top-product">
          <div class="eod-top-emoji">${stats.topProduit.emoji}</div>
          <div class="eod-top-info">
            <div class="eod-top-name">${stats.topProduit.name}</div>
            <div class="eod-top-sub">
              ${stats.topProduit.qty} vendu${stats.topProduit.qty > 1 ? 's' : ''}
              · ${stats.topProduit.ca.toLocaleString('fr-FR')} F
            </div>
          </div>
          <div class="eod-top-badge">🏅 Top</div>
        </div>
      `;
    }

    // ── Date d'aujourd'hui ──
    const dateStr = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long'
    });

    // ── Injecter ──
    const backdrop = document.createElement('div');
    backdrop.id = 'eod-backdrop';
    backdrop.innerHTML = `
      <div id="eod-sheet">

        <!-- Hero -->
        <div class="eod-hero">
          <div class="eod-pill"></div>
          <div class="eod-icon">🌙</div>
          <div class="eod-title">Bilan du jour</div>
          <div class="eod-subtitle">${dateStr}</div>
        </div>

        <!-- Corps -->
        <div class="eod-body">

          <!-- Stats -->
          <div class="eod-stats">
            <div class="eod-stat">
              <div class="eod-stat-val">${stats.ca.toLocaleString('fr-FR')} F</div>
              <div class="eod-stat-label">💰 CA du jour</div>
            </div>
            <div class="eod-stat">
              <div class="eod-stat-val">${stats.articles}</div>
              <div class="eod-stat-label">📦 Articles</div>
            </div>
            <div class="eod-stat">
              <div class="eod-stat-val">${stats.nbVentes}</div>
              <div class="eod-stat-label">🧾 Ventes</div>
            </div>
            <div class="eod-stat">
              <div class="eod-stat-val">${stats.moyVente.toLocaleString('fr-FR')} F</div>
              <div class="eod-stat-label">📊 Moy. vente</div>
            </div>
          </div>

          <!-- Objectif -->
          ${goalHTML}

          <!-- Top produit -->
          ${topHTML}

          <!-- Message -->
          <div class="eod-message">${msg}</div>

        </div>

        <!-- Bouton -->
        <button class="eod-close-btn" id="eod-close">
          Bonne nuit ! 🌙
        </button>
      </div>
    `;

    document.body.appendChild(backdrop);
    markShownToday();

    // Animer la barre objectif après injection
    requestAnimationFrame(() => {
      setTimeout(() => {
        const bar = backdrop.querySelector('.eod-goal-bar[data-pct]');
        if (bar) bar.style.width = bar.dataset.pct + '%';
      }, 200);
    });

    // Fermeture
    function close() {
      backdrop.style.animation = 'eodBackdropIn .2s ease reverse both';
      setTimeout(() => backdrop.remove(), 220);
    }

    document.getElementById('eod-close')
      ?.addEventListener('click', close);
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) close();
    });
  }

  // ══════════════════════════════════════
  // DÉCLENCHEUR : retour sur #menuSection
  // ══════════════════════════════════════
  function shouldShow() {
    const hour = new Date().getHours();
    return hour >= TRIGGER_HOUR && !alreadyShownToday();
  }

  function hookNavigation() {
    // Observer l'événement pageChange émis par index.html router
    window.addEventListener('pageChange', e => {
      if (e.detail?.key !== 'menu' && e.detail?.section !== 'menuSection') return;
      if (!shouldShow()) return;

      // Attendre que appData soit chargé
      setTimeout(() => {
        if (shouldShow()) show();
      }, 600);
    });

    // Aussi observer showSection (compat utils.js)
    const origShow = window.showSection;
    if (typeof origShow === 'function') {
      window.showSection = function (section) {
        origShow(section);
        if (section === 'menu' && shouldShow()) {
          setTimeout(() => { if (shouldShow()) show(); }, 600);
        }
      };
    }
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    hookNavigation();

    // Vérifier aussi au premier chargement
    setTimeout(() => {
      if (shouldShow()) show();
    }, 2500); // après splash + sync
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
