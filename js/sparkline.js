/**
 * sparkline.js — Mini graphique 7 jours sur l'accueil
 *
 * Injecte une carte sur #menuSection avec :
 *   - CA des 7 derniers jours (depuis window.appData.ventes)
 *   - Courbe SVG animée
 *   - Badge de tendance (↑ / ↓ / →) vs la semaine précédente
 *   - Labels des jours (Lun, Mar, ... Auj)
 *
 * Se met à jour après chaque syncFromServer() via MutationObserver
 * sur #chiffreAffaires.
 *
 * INTÉGRATION dans index.html, juste avant </body> :
 *   <script src="js/sparkline.js"></script>
 */

(function () {

  const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  // ══════════════════════════════════════
  // CALCUL DES 7 DERNIERS JOURS
  // ══════════════════════════════════════
  function getLast7Days() {
    const data = window.appData;
    if (!data || !Array.isArray(data.ventes)) return null;

    const today   = new Date();
    const days    = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split('T')[0]; // YYYY-MM-DD
      days.push({
        date:    d,
        key,
        label:   i === 0 ? 'Auj' : JOURS[d.getDay()],
        isToday: i === 0,
        total:   0,
      });
    }

    // Agréger les ventes par jour
    data.ventes.forEach(v => {
      const raw = v.created_at || v.date || v.timestamp;
      if (!raw) return;
      const vDate = new Date(raw);
      const vKey  = vDate.toISOString().split('T')[0];
      const day   = days.find(d => d.key === vKey);
      if (day) day.total += v.total || 0;
    });

    return days;
  }

  // ══════════════════════════════════════
  // CALCUL DE LA TENDANCE
  // ══════════════════════════════════════
  function getTrend(days) {
    if (!days || days.length < 7) return { type: 'flat', text: '— Pas assez de données' };

    // Cette semaine (4 derniers jours complets + aujourd'hui) vs 3 jours précédents
    const recent = days.slice(4).reduce((s, d) => s + d.total, 0);
    const older  = days.slice(0, 4).reduce((s, d) => s + d.total, 0);

    if (older === 0 && recent === 0) return { type: 'flat', text: 'Pas encore de ventes' };
    if (older === 0) return { type: 'up', text: '+100% vs semaine dernière' };

    const pct = Math.round(((recent - older) / older) * 100);

    if (pct > 5)  return { type: 'up',   text: `+${pct}% vs sem. dernière` };
    if (pct < -5) return { type: 'down', text: `${pct}% vs sem. dernière`  };
    return { type: 'flat', text: 'Stable vs sem. dernière' };
  }

  // ══════════════════════════════════════
  // GÉNÉRATION DU SVG SPARKLINE
  // ══════════════════════════════════════
  function buildSVG(days) {
    const W   = 300;  // viewBox width (relatif)
    const H   = 50;
    const PAD = 6;
    const n   = days.length;

    const values = days.map(d => d.total);
    const max    = Math.max(...values, 1);
    const min    = 0;

    // Coordonnées des points
    const pts = values.map((v, i) => ({
      x: PAD + (i / (n - 1)) * (W - PAD * 2),
      y: H - PAD - ((v - min) / (max - min)) * (H - PAD * 2),
    }));

    // Polyline lissée (courbe de Bezier)
    function smooth(points) {
      if (points.length < 2) return '';
      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cpx  = (prev.x + curr.x) / 2;
        d += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
      }
      return d;
    }

    const linePath = smooth(pts);

    // Aire (même chemin + fermeture vers le bas)
    const areaPath = linePath
      + ` L ${pts[n - 1].x} ${H} L ${pts[0].x} ${H} Z`;

    // Point final (aujourd'hui)
    const last = pts[n - 1];

    // Couleur selon tendance
    const trend = getTrend(days);
    const color = trend.type === 'down' ? '#EF4444'
                : trend.type === 'up'   ? '#7C3AED'
                : '#7C3AED';

    const gradId  = `spk-area-grad-${Date.now()}`;
    const strokeId = `spk-stroke-grad-${Date.now()}`;

    return `
      <svg class="spk-svg" viewBox="0 0 ${W} ${H}"
           preserveAspectRatio="none"
           xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Dégradé aire -->
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="${color}" stop-opacity=".9"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
          <!-- Dégradé trait -->
          <linearGradient id="${strokeId}" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stop-color="${color}" stop-opacity=".4"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="1"/>
          </linearGradient>
        </defs>

        <!-- Aire -->
        <path class="spk-area"
              d="${areaPath}"
              fill="url(#${gradId})"/>

        <!-- Ligne -->
        <path class="spk-line"
              d="${linePath}"
              stroke="url(#${strokeId})"/>

        <!-- Point aujourd'hui -->
        <circle class="spk-dot"
                cx="${last.x}" cy="${last.y}" r="4"/>
      </svg>
    `;
  }

  // ══════════════════════════════════════
  // RENDU COMPLET DE LA CARTE
  // ══════════════════════════════════════
  function renderCard(card) {
    const days = getLast7Days();

    // CA total de la semaine
    const weekTotal = days
      ? days.reduce((s, d) => s + d.total, 0)
      : 0;

    const trend     = getTrend(days);
    const todayCA   = days ? (days[6]?.total || 0) : 0;

    const trendIcon = trend.type === 'up'   ? '↑'
                    : trend.type === 'down' ? '↓'
                    : '→';

    // Vérifier si toutes les valeurs sont à 0
    const hasData = days && days.some(d => d.total > 0);

    card.innerHTML = `
      <div class="spk-header">
        <div class="spk-left">
          <div class="spk-label">📊 Tendance 7 jours</div>
          <div class="spk-value">${weekTotal.toLocaleString('fr-FR')} F</div>
        </div>
        <div class="spk-trend ${trend.type}">
          <span class="spk-trend-icon">${trendIcon}</span>
          <span class="spk-trend-text">${trend.text}</span>
        </div>
      </div>

      <div class="spk-svg-wrap">
        ${hasData
          ? buildSVG(days)
          : '<div class="spk-empty">Les données apparaîtront après vos premières ventes</div>'
        }
      </div>

      ${hasData ? `
        <div class="spk-days">
          ${days.map(d => `
            <div class="spk-day ${d.isToday ? 'today' : ''}">${d.label}</div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  // ══════════════════════════════════════
  // INJECTER LA CARTE DANS #menuSection
  // ══════════════════════════════════════
  function injectCard() {
    if (document.getElementById('sparkline-card')) return;

    const card = document.createElement('div');
    card.id = 'sparkline-card';

    const menuSection = document.getElementById('menuSection');
    if (!menuSection) return;

    // Insérer après #daily-goal-card si présent, sinon après #alertesStock
    const anchor =
      document.getElementById('daily-goal-card') ||
      document.getElementById('alertesStock')    ||
      document.getElementById('userGuide');

    if (anchor && anchor.parentNode === menuSection) {
      anchor.parentNode.insertBefore(card, anchor.nextSibling);
    } else {
      menuSection.prepend(card);
    }

    renderCard(card);
  }

  // ══════════════════════════════════════
  // OBSERVER LES MISES À JOUR DE DONNÉES
  // Déclenché quand appData est rechargé (après syncFromServer)
  // ══════════════════════════════════════
  function watchUpdates() {
    // Observer #chiffreAffaires : il change après chaque sync
    const el = document.getElementById('chiffreAffaires');
    if (!el) return;

    let lastText = '';

    const observer = new MutationObserver(() => {
      const t = el.textContent;
      if (t === lastText) return;
      lastText = t;

      // Délai pour laisser countup.js + appData se stabiliser
      setTimeout(() => {
        const card = document.getElementById('sparkline-card');
        if (card) renderCard(card);
      }, 750);
    });

    observer.observe(el, { characterData: true, childList: true, subtree: true });
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    injectCard();
    watchUpdates();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
