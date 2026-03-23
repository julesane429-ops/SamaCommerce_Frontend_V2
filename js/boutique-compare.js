/**
 * boutique-compare.js — Graphique comparatif multi-boutiques
 *
 * S'affiche dans la section menu UNIQUEMENT quand la boutique principale
 * (vue cumulative) est active. Compare visuellement les boutiques
 * secondaires sur 3 métriques : CA, ventes, produits.
 *
 * Requiert : Chart.js (déjà chargé dans index.html)
 *
 * Intégration dans index.html (après boutique-switcher.js) :
 *   <script src="js/boutique-compare.js"></script>
 */

(function () {
  const API = () =>
    document.querySelector('meta[name="api-base"]')?.content ||
    'https://samacommerce-backend-v2.onrender.com';

  let _chart = null;
  let _card  = null;

  // ── Couleurs par boutique (cycle) ──
  const COLORS = [
    '#7C3AED', '#EC4899', '#10B981', '#F59E0B',
    '#3B82F6', '#EF4444', '#8B5CF6', '#06B6D4',
  ];

  // ══════════════════════════════════════
  // FETCH STATS PAR BOUTIQUE
  // ══════════════════════════════════════
  async function fetchBoutiquesStats() {
    try {
      const res = await window.authfetch?.(API() + '/boutiques');
      if (!res?.ok) return null;
      const boutiques = await res.json();

      // Exclure la boutique principale de la comparaison
      const secondaires = boutiques.filter(b => !b.is_primary);
      if (secondaires.length < 2) return { boutiques: secondaires, tooFew: true };

      // Fetch stats détaillées pour chaque boutique secondaire
      const statsPromises = secondaires.map(async (b) => {
        try {
          const r = await window.authfetch?.(API() + `/boutiques/${b.id}/stats`);
          const s = r?.ok ? await r.json() : {};
          return {
            id:          b.id,
            name:        b.name,
            emoji:       b.emoji || '🏪',
            nb_produits: s.nb_produits || b.nb_produits || 0,
            nb_ventes:   s.nb_ventes   || b.nb_ventes   || 0,
            ca_total:    s.ca_total    || 0,
          };
        } catch {
          return { id: b.id, name: b.name, emoji: b.emoji || '🏪',
                   nb_produits: 0, nb_ventes: 0, ca_total: 0 };
        }
      });

      const stats = await Promise.all(statsPromises);
      return { boutiques: stats, tooFew: false };
    } catch (err) {
      console.warn('[boutique-compare] fetchBoutiquesStats:', err.message);
      return null;
    }
  }

  // ══════════════════════════════════════
  // RENDU DU GRAPHIQUE
  // ══════════════════════════════════════
  function renderChart(canvas, data) {
    if (_chart) { _chart.destroy(); _chart = null; }

    const labels  = data.map(b => `${b.emoji} ${b.name}`);
    const colors  = data.map((_, i) => COLORS[i % COLORS.length]);
    const caData  = data.map(b => Math.round(b.ca_total));
    const venteData = data.map(b => b.nb_ventes);

    _chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'CA (F)',
            data:  caData,
            backgroundColor: colors.map(c => c + 'CC'),
            borderColor:     colors,
            borderWidth: 2,
            borderRadius: 8,
            yAxisID: 'yCA',
          },
          {
            label: 'Ventes',
            data:  venteData,
            backgroundColor: colors.map(c => c + '44'),
            borderColor:     colors.map(c => c + 'AA'),
            borderWidth:  2,
            borderRadius: 8,
            type: 'line',
            yAxisID: 'yVentes',
            tension: 0.3,
            pointRadius: 6,
            pointHoverRadius: 8,
          },
        ],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: "'DM Sans', sans-serif", size: 11, weight: '600' },
              padding: 12,
              usePointStyle: true,
              pointStyleWidth: 8,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(10,7,30,.9)',
            titleFont: { family: "'Sora', sans-serif", size: 12, weight: '800' },
            bodyFont:  { family: "'DM Sans', sans-serif", size: 11 },
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.label === 'CA (F)') {
                  return ` CA : ${ctx.raw.toLocaleString('fr-FR')} F`;
                }
                return ` Ventes : ${ctx.raw}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: "'DM Sans', sans-serif", size: 10, weight: '600' } },
          },
          yCA: {
            position: 'left',
            grid: { color: '#F3F4F6' },
            ticks: {
              font: { size: 9 },
              callback: v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v,
            },
          },
          yVentes: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { font: { size: 9 } },
          },
        },
      },
    });
  }

  // ══════════════════════════════════════
  // CARTE COMPARATIVE
  // ══════════════════════════════════════
  async function injectCompareCard() {
    // Nettoyer si déjà présente
    document.getElementById('boutique-compare-card')?.remove();
    if (_chart) { _chart.destroy(); _chart = null; }

    // Vérifier : on est sur la boutique principale ?
    const isPrimary = window._activeBoutiqueIsPrimary ||
                      localStorage.getItem('sc_active_boutique_is_primary') === '1';
    if (!isPrimary) return;

    // Vérifier que Chart.js est disponible
    if (typeof Chart === 'undefined') return;

    // Fetcher les stats
    const result = await fetchBoutiquesStats();
    if (!result) return;

    // Trouver le bon conteneur dans menuSection
    const menuSection = document.getElementById('menuSection');
    if (!menuSection) return;

    _card = document.createElement('div');
    _card.id = 'boutique-compare-card';
    _card.style.cssText = `
      background:#fff; border-radius:20px; padding:18px;
      margin: 0 0 16px; box-shadow:0 2px 14px rgba(0,0,0,.06);
    `;

    if (result.tooFew) {
      _card.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <div style="font-size:20px;">📊</div>
          <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:14px;color:var(--text);">
            Comparaison boutiques
          </div>
        </div>
        <div style="font-size:12px;color:var(--muted);text-align:center;padding:20px 0;">
          Créez au moins 2 boutiques secondaires pour voir la comparaison 📈
        </div>
      `;
    } else {
      // Mini summary tiles
      const totalCA    = result.boutiques.reduce((s, b) => s + b.ca_total, 0);
      const totalVentes = result.boutiques.reduce((s, b) => s + b.nb_ventes, 0);
      const bestBoutique = result.boutiques.reduce((a, b) => b.ca_total > a.ca_total ? b : a);

      _card.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:15px;color:var(--text);">
            📊 Comparaison boutiques
          </div>
          <button id="compare-refresh" style="
            background:none;border:none;font-size:14px;cursor:pointer;
            color:var(--muted);padding:4px 8px;border-radius:8px;
          ">🔄</button>
        </div>

        <!-- Mini KPIs -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
          <div style="background:var(--bg,#F5F3FF);border-radius:14px;padding:10px;text-align:center;">
            <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px;">CA Total</div>
            <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:13px;color:var(--primary);margin-top:4px;">
              ${totalCA >= 1000 ? (totalCA/1000).toFixed(1)+'k' : totalCA.toLocaleString('fr-FR')} F
            </div>
          </div>
          <div style="background:var(--bg,#F5F3FF);border-radius:14px;padding:10px;text-align:center;">
            <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px;">Ventes</div>
            <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:13px;color:var(--primary);margin-top:4px;">
              ${totalVentes}
            </div>
          </div>
          <div style="background:var(--bg,#F5F3FF);border-radius:14px;padding:10px;text-align:center;">
            <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px;">Top</div>
            <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:12px;color:var(--primary);margin-top:4px;">
              ${bestBoutique.emoji} ${bestBoutique.name.slice(0, 8)}…
            </div>
          </div>
        </div>

        <!-- Graphique -->
        <div style="height:200px; position:relative;">
          <canvas id="boutique-compare-canvas"></canvas>
        </div>
      `;

      // Insérer avant d'autres cartes pour que le canvas soit dans le DOM
      const alertesStock = document.getElementById('alertesStock');
      if (alertesStock?.parentNode === menuSection) {
        menuSection.insertBefore(_card, alertesStock);
      } else {
        menuSection.prepend(_card);
      }

      // Render chart (après insertion dans le DOM)
      await new Promise(r => setTimeout(r, 0));
      const canvas = document.getElementById('boutique-compare-canvas');
      if (canvas) renderChart(canvas, result.boutiques);

      // Bouton refresh
      _card.querySelector('#compare-refresh')?.addEventListener('click', () => {
        window.haptic?.tap();
        injectCompareCard();
      });

      return; // sortir avant le insertBefore en bas
    }

    // Insérer la carte (cas tooFew)
    const alertesStock = document.getElementById('alertesStock');
    if (alertesStock?.parentNode === menuSection) {
      menuSection.insertBefore(_card, alertesStock);
    } else {
      menuSection.prepend(_card);
    }
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    // Écouter les changements de boutique
    window.addEventListener('boutique:changed', (e) => {
      const boutique = e.detail;
      if (boutique?.is_primary || !boutique) {
        // On est sur la boutique principale → afficher la comparaison
        setTimeout(injectCompareCard, 500);
      } else {
        // Boutique secondaire → retirer la carte
        document.getElementById('boutique-compare-card')?.remove();
        if (_chart) { _chart.destroy(); _chart = null; }
      }
    });

    // Init au démarrage si on est sur la boutique principale
    const checkInit = () => {
      const isPrimary = window._activeBoutiqueIsPrimary ||
                        localStorage.getItem('sc_active_boutique_is_primary') === '1' ||
                        !localStorage.getItem('sc_active_boutique');
      if (isPrimary && typeof Chart !== 'undefined') {
        setTimeout(injectCompareCard, 800);
      } else if (typeof Chart === 'undefined') {
        setTimeout(checkInit, 500);
      }
    };
    checkInit();

    // Refresh quand on revient sur le menu
    window.addEventListener('pageChange', (e) => {
      if (e.detail?.key === 'menu') {
        const isPrimary = window._activeBoutiqueIsPrimary ||
                          localStorage.getItem('sc_active_boutique_is_primary') === '1';
        if (isPrimary) setTimeout(injectCompareCard, 300);
      }
    });
  }

  window.boutiqueCompare = { refresh: injectCompareCard };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
