// charts.js — Graphiques redesignés pour Sama Commerce
// Remplace le fichier charts.js existant
// Mêmes exports, mêmes canvas IDs, même interface — uniquement le style change

import { appData } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { authfetch, postCategoryServer, postProductServer, syncFromServer } from "./api.js";
import { getCurrentUserId, logout } from "./auth.js";
window.logout = logout;
import { selectEmoji, supprimerCategorie, ajouterCategorie, remplirSelectCategories, afficherFiltresCategories } from "./categories.js";
import { renderCreditsHistory, marquerCreditPaye, confirmerRemboursement, remplirProduitsCredit } from "./credits.js";
import { loadAppDataLocal, saveAppDataLocal, enqueueOutbox, processOutboxOne, processOutboxAll, updateHeader, getExpirationDate } from "./index.js";
import { showModal, hideModal, ouvrirModalEdit, showModalCredit, hideModalCredit, ouvrirModalRemboursement, hideModalRemboursement, showModalById, hideModalById, closePremiumModal, closeContactModal, closeGuide, fermerModal } from "./modal.js";
import { showNotification, customConfirm } from "./notification.js";
import { handleAddProductClick } from "./premium.js";
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente, afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";
import { showSection } from "./utils.js";
window.showSection = showSection;
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode, modifierVente } from "./ventes.js";


// ═══════════════════════════════════════════════════════
// PALETTE & DESIGN SYSTEM
// ═══════════════════════════════════════════════════════

const isDark = () => document.documentElement.classList.contains('dark');

const COLORS = {
  primary:  '#7C3AED',
  accent:   '#EC4899',
  green:    '#10B981',
  blue:     '#3B82F6',
  orange:   '#F59E0B',
  teal:     '#14B8A6',
  red:      '#EF4444',
  purple:   '#8B5CF6',
  pink:     '#F472B6',
  indigo:   '#6366F1',
};

// Palettes pour graphiques multi-séries
const PALETTE = [
  '#7C3AED', '#10B981', '#3B82F6', '#F59E0B',
  '#EC4899', '#14B8A6', '#EF4444', '#8B5CF6',
];

// Couleurs texte et grille selon le thème
function gridColor()  { return isDark() ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)'; }
function textColor()  { return isDark() ? '#9CA3AF' : '#6B7280'; }
function labelColor() { return isDark() ? '#F1F0FF' : '#1E1B4B'; }
function surfaceColor() { return isDark() ? '#1E1B2E' : '#FFFFFF'; }

// ═══════════════════════════════════════════════════════
// DÉGRADÉ POUR LES LINE CHARTS
// ═══════════════════════════════════════════════════════

function makeGradient(ctx, color, alpha1 = .35, alpha2 = .02) {
  const h = ctx.canvas.height || 200;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, hexToRgba(color, alpha1));
  grad.addColorStop(1, hexToRgba(color, alpha2));
  return grad;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ═══════════════════════════════════════════════════════
// OPTIONS GLOBALES PARTAGÉES
// ═══════════════════════════════════════════════════════

function baseOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 700,
      easing: 'easeOutQuart',
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'start',
        labels: {
          color: textColor(),
          font:  { family: "'DM Sans', sans-serif", size: 12, weight: '600' },
          boxWidth: 10,
          boxHeight: 10,
          borderRadius: 4,
          padding: 16,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: surfaceColor(),
        titleColor:      labelColor(),
        bodyColor:       textColor(),
        borderColor:     isDark() ? 'rgba(167,139,250,.2)' : 'rgba(0,0,0,.08)',
        borderWidth:     1,
        padding:         12,
        cornerRadius:    12,
        titleFont:  { family: "'Sora', sans-serif",   size: 13, weight: '700' },
        bodyFont:   { family: "'DM Sans', sans-serif", size: 12, weight: '500' },
        displayColors: true,
        boxWidth:  8,
        boxHeight: 8,
        callbacks: {
          label(ctx) {
            const val = ctx.raw;
            if (typeof val === 'number' && val > 999) {
              return ` ${val.toLocaleString('fr-FR')} F`;
            }
            return ` ${val}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid:  { color: gridColor(), drawBorder: false },
        ticks: { color: textColor(), font: { family: "'DM Sans', sans-serif", size: 11 }, maxRotation: 30 },
        border: { display: false },
      },
      y: {
        grid:      { color: gridColor(), drawBorder: false },
        ticks:     { color: textColor(), font: { family: "'DM Sans', sans-serif", size: 11 }, callback: v => v >= 1000 ? (v / 1000) + 'k' : v },
        border:    { display: false },
        beginAtZero: true,
      },
    },
    ...extra,
  };
}

// ═══════════════════════════════════════════════════════
// UTILITAIRE : FORMATER LES DATES EN LABELS COURTS
// ═══════════════════════════════════════════════════════

function shortDate(isoStr) {
  const d = new Date(isoStr);
  if (isNaN(d)) return isoStr;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

// ═══════════════════════════════════════════════════════
// UTILITAIRE : DÉTRUIRE UN CHART EXISTANT
// ═══════════════════════════════════════════════════════

function destroy(instance) {
  if (instance && typeof instance.destroy === 'function') instance.destroy();
}


// ═══════════════════════════════════════════════════════════════
// updateCharts() — tous les graphiques de la section Chiffres
// ═══════════════════════════════════════════════════════════════

export function updateCharts(ventesFiltrees) {
  const ventes = ventesFiltrees || appData.ventes || [];

  // ── 1. Ventes par jour (line) ────────────────────────────────
  {
    const byDay = {};
    ventes.forEach(v => {
      const raw = v.date || v.created_at || v.timestamp;
      if (!raw) return;
      const d = new Date(raw).toISOString().slice(0, 10);
      if (!isNaN(new Date(d))) byDay[d] = (byDay[d] || 0) + (v.total || 0);
    });

    const labels = Object.keys(byDay).sort().map(shortDate);
    const data   = Object.keys(byDay).sort().map(k => byDay[k]);

    destroy(window.chartVentesByDay);

    const el = document.getElementById('chartVentesByDay');
    if (el) {
      el.parentElement.style.height = '220px';
      const ctx = el.getContext('2d');
      window.chartVentesByDay = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Ventes par jour',
            data,
            borderColor:     COLORS.primary,
            backgroundColor: makeGradient(ctx, COLORS.primary),
            borderWidth:     2.5,
            fill:            true,
            tension:         0.42,
            pointRadius:     4,
            pointBackgroundColor: COLORS.primary,
            pointBorderColor:     surfaceColor(),
            pointBorderWidth:     2,
            pointHoverRadius:     6,
          }],
        },
        options: baseOptions({
          plugins: {
            legend: { display: false },
            tooltip: {
              ...baseOptions().plugins.tooltip,
              callbacks: {
                title: t => t[0].label,
                label: t => ` ${t.raw.toLocaleString('fr-FR')} F`,
              },
            },
          },
        }),
      });
    }
  }

  // ── 2. Top produits (bar horizontal) ─────────────────────────
  {
    const sorted = (appData.produits || [])
      .slice()
      .sort((a, b) => (b.vendu || 0) - (a.vendu || 0))
      .slice(0, 8);

    const labels = sorted.map(p => p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name);
    const data   = sorted.map(p => p.vendu || 0);
    const colors = sorted.map((_, i) => PALETTE[i % PALETTE.length]);

    destroy(window.chartTopProduits);

    const el = document.getElementById('chartTopProduits');
    if (el) {
      el.parentElement.style.height = `${Math.max(180, sorted.length * 36 + 60)}px`;
      const ctx = el.getContext('2d');
      window.chartTopProduits = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Quantités vendues',
            data,
            backgroundColor: colors.map(c => hexToRgba(c, .85)),
            borderColor:     colors,
            borderWidth:     0,
            borderRadius:    8,
            borderSkipped:   false,
          }],
        },
        options: {
          ...baseOptions({ indexAxis: 'y' }),
          plugins: {
            legend: { display: false },
            tooltip: {
              ...baseOptions().plugins.tooltip,
              callbacks: {
                label: t => ` ${t.raw} unité${t.raw > 1 ? 's' : ''} vendue${t.raw > 1 ? 's' : ''}`,
              },
            },
          },
          scales: {
            x: { ...baseOptions().scales.x, ticks: { ...baseOptions().scales.x.ticks, callback: v => v } },
            y: { grid: { display: false }, border: { display: false }, ticks: { color: labelColor(), font: { family: "'DM Sans', sans-serif", size: 12, weight: '600' } } },
          },
        },
      });
    }
  }

  // ── 3. Répartition paiements (doughnut) ──────────────────────
  {
    const pays    = appData.stats?.paiements || {};
    const rawKeys = Object.keys(pays);
    const total   = Object.values(pays).reduce((s, v) => s + v, 0);

    const labels = rawKeys.map(k => {
      const name = k.charAt(0).toUpperCase() + k.slice(1);
      const pct  = total > 0 ? ((pays[k] / total) * 100).toFixed(0) : 0;
      return `${name} — ${pct}%`;
    });
    const data   = rawKeys.map(k => pays[k] || 0);
    const colors = [COLORS.green, COLORS.blue, COLORS.orange, COLORS.purple, COLORS.pink];

    destroy(window.chartPaiements);

    const el = document.getElementById('chartPaiements');
    if (el) {
      el.parentElement.style.height = '220px';
      const ctx = el.getContext('2d');
      window.chartPaiements = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors.slice(0, data.length).map(c => hexToRgba(c, .88)),
            borderColor:     surfaceColor(),
            borderWidth:     3,
            hoverBorderWidth: 0,
            hoverOffset:     8,
          }],
        },
        options: {
          responsive:         true,
          maintainAspectRatio: false,
          cutout:             '62%',
          animation: { animateRotate: true, duration: 800, easing: 'easeOutQuart' },
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color:      textColor(),
                font:       { family: "'DM Sans', sans-serif", size: 12, weight: '600' },
                boxWidth:   10, boxHeight: 10,
                borderRadius: 4,
                padding:    12,
                usePointStyle: true,
                pointStyle: 'circle',
              },
            },
            tooltip: {
              ...baseOptions().plugins.tooltip,
              callbacks: {
                label: t => ` ${t.raw.toLocaleString('fr-FR')} F`,
              },
            },
          },
        },
      });
    }
  }

  // ── 4. Stocks faibles (bar horizontal coloré par urgence) ────
  {
    const faibles = (appData.produits || [])
      .filter(p => p.stock <= 5)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);

    const labels = faibles.map(p => p.name.length > 16 ? p.name.slice(0, 15) + '…' : p.name);
    const data   = faibles.map(p => p.stock);
    const colors = faibles.map(p =>
      p.stock === 0 ? hexToRgba(COLORS.red, .85)
      : p.stock <= 2 ? hexToRgba(COLORS.orange, .85)
      : hexToRgba(COLORS.primary, .75)
    );

    destroy(window.chartStocksFaibles);

    const el = document.getElementById('chartStocksFaibles');
    if (el) {
      el.parentElement.style.height = `${Math.max(160, faibles.length * 34 + 60)}px`;
      const ctx = el.getContext('2d');
      window.chartStocksFaibles = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Stock restant',
            data,
            backgroundColor: colors,
            borderRadius:    8,
            borderSkipped:   false,
          }],
        },
        options: {
          ...baseOptions({ indexAxis: 'y' }),
          plugins: {
            legend: { display: false },
            tooltip: {
              ...baseOptions().plugins.tooltip,
              callbacks: {
                label: t => t.raw === 0 ? ' ⛔ Rupture' : ` ${t.raw} en stock`,
              },
            },
          },
          scales: {
            x: { ...baseOptions().scales.x, ticks: { ...baseOptions().scales.x.ticks, callback: v => v, stepSize: 1 }, max: 5 },
            y: { grid: { display: false }, border: { display: false }, ticks: { color: labelColor(), font: { family: "'DM Sans', sans-serif", size: 12, weight: '600' } } },
          },
        },
      });
    }
  }
}


// ═══════════════════════════════════════════════════════════════
// chartEvolutionCA() — CA encaissé (section Chiffres)
// ═══════════════════════════════════════════════════════════════

export function chartEvolutionCA(ventes) {
  const el = document.getElementById('chartVentesJour');
  if (!el) return;

  destroy(window.chartVentesJourInstance);
  window.chartVentesJourInstance = null;

  const map = {};
  ventes.forEach(v => {
    if (!v.paid) return;
    const raw = v.date || v.created_at || v.timestamp;
    if (!raw) return;
    const d = new Date(raw).toISOString().slice(0, 10);
    if (!isNaN(new Date(d))) map[d] = (map[d] || 0) + (v.total || 0);
  });

  const sorted  = Object.keys(map).sort();
  const labels  = sorted.map(shortDate);
  const data    = sorted.map(k => map[k]);

  // Calcul de la tendance pour colorer la ligne
  const last  = data[data.length - 1] || 0;
  const prev  = data[data.length - 2] || 0;
  const color = last >= prev ? COLORS.green : COLORS.red;

  el.parentElement.style.height = '240px';
  const ctx = el.getContext('2d');

  window.chartVentesJourInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label:            'CA encaissé',
        data,
        borderColor:      color,
        backgroundColor:  makeGradient(ctx, color, .3, .02),
        borderWidth:      2.5,
        fill:             true,
        tension:          0.42,
        pointRadius:      (ctx) => ctx.dataIndex === data.length - 1 ? 6 : 3,
        pointBackgroundColor: color,
        pointBorderColor:     surfaceColor(),
        pointBorderWidth:     2,
        pointHoverRadius:     7,
      }],
    },
    options: {
      ...baseOptions(),
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseOptions().plugins.tooltip,
          callbacks: {
            title: t => t[0].label,
            label: t => ` ${t.raw.toLocaleString('fr-FR')} F encaissés`,
          },
        },
      },
      scales: {
        ...baseOptions().scales,
        x: { ...baseOptions().scales.x, ticks: { ...baseOptions().scales.x.ticks, autoSkip: true, maxTicksLimit: 10 } },
      },
    },
  });
}


// ═══════════════════════════════════════════════════════════════
// initCreditChart() — Graphique crédits (section Crédits)
// ═══════════════════════════════════════════════════════════════

export function initCreditChart() {
  const el = document.getElementById('chartCredits');
  if (!el) return;

  destroy(window.creditChart);

  el.parentElement.style.height = '200px';
  const ctx = el.getContext('2d');

  window.creditChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label:           'Total dû',
          data:            [],
          borderColor:     COLORS.primary,
          backgroundColor: makeGradient(ctx, COLORS.primary, .25, .02),
          fill:            true,
          tension:         0.4,
          borderWidth:     2,
          pointRadius:     3,
          pointBackgroundColor: COLORS.primary,
          pointBorderColor:     surfaceColor(),
          pointBorderWidth:     2,
        },
        {
          label:           'Remboursé',
          data:            [],
          borderColor:     COLORS.green,
          backgroundColor: makeGradient(ctx, COLORS.green, .2, .02),
          fill:            true,
          tension:         0.4,
          borderWidth:     2,
          pointRadius:     3,
          pointBackgroundColor: COLORS.green,
          pointBorderColor:     surfaceColor(),
          pointBorderWidth:     2,
        },
        {
          label:           'Impayés',
          data:            [],
          borderColor:     COLORS.red,
          backgroundColor: makeGradient(ctx, COLORS.red, .15, .02),
          fill:            true,
          tension:         0.4,
          borderWidth:     2,
          pointRadius:     3,
          pointBackgroundColor: COLORS.red,
          pointBorderColor:     surfaceColor(),
          pointBorderWidth:     2,
        },
      ],
    },
    options: {
      ...baseOptions(),
      plugins: {
        ...baseOptions().plugins,
        legend: {
          ...baseOptions().plugins.legend,
          position: 'top',
        },
        tooltip: {
          ...baseOptions().plugins.tooltip,
          callbacks: {
            title: t => t[0].label,
            label: t => ` ${t.raw.toLocaleString('fr-FR')} F`,
          },
        },
      },
    },
  });
}


// ═══════════════════════════════════════════════════════════════
// chartInventaire() — Graphique inventaire (section Inventaire)
// Appelé directement depuis inventaire.js (window.Chart)
// On surcharge la config via un plugin Chart.js global léger
// ═══════════════════════════════════════════════════════════════

// Intercepter la création du graphique inventaire en remplaçant
// la configuration après coup via un helper exposé sur window

export function applyInventaireChartStyle(instance) {
  if (!instance) return;

  // Modifier les datasets
  if (instance.data?.datasets?.[0]) {
    instance.data.datasets[0].backgroundColor = hexToRgba(COLORS.blue,  .75);
    instance.data.datasets[0].borderColor      = COLORS.blue;
    instance.data.datasets[0].borderRadius     = 8;
    instance.data.datasets[0].borderSkipped    = false;
  }
  if (instance.data?.datasets?.[1]) {
    instance.data.datasets[1].backgroundColor = hexToRgba(COLORS.green, .75);
    instance.data.datasets[1].borderColor      = COLORS.green;
    instance.data.datasets[1].borderRadius     = 8;
    instance.data.datasets[1].borderSkipped    = false;
  }

  // Modifier les options
  const opts = instance.options;
  opts.animation            = { duration: 700, easing: 'easeOutQuart' };
  opts.plugins ??= {};
  opts.plugins.legend       = {
    position: 'top', align: 'start',
    labels: {
      color: textColor(),
      font:  { family: "'DM Sans', sans-serif", size: 12, weight: '600' },
      boxWidth: 10, boxHeight: 10, borderRadius: 4, padding: 16,
      usePointStyle: true, pointStyle: 'circle',
    },
  };
  opts.plugins.tooltip      = baseOptions().plugins.tooltip;
  opts.scales ??= {};
  opts.scales.x ??= {};
  opts.scales.x.grid        = { color: gridColor(), drawBorder: false };
  opts.scales.x.ticks       = { color: textColor(), font: { family: "'DM Sans', sans-serif", size: 11 } };
  opts.scales.x.border      = { display: false };
  opts.scales.y ??= {};
  opts.scales.y.grid        = { color: gridColor(), drawBorder: false };
  opts.scales.y.ticks       = { color: textColor(), font: { family: "'DM Sans', sans-serif", size: 11 } };
  opts.scales.y.border      = { display: false };
  opts.scales.y.beginAtZero = true;

  instance.update('none');
}

// Exposer sur window pour que inventaire.js puisse l'appeler
window.applyInventaireChartStyle = applyInventaireChartStyle;
