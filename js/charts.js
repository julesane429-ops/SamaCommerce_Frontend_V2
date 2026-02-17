// charts.js
import { appData,chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits  } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { updateCharts, renderVentesChart, initCreditChart } from "./charts.js";
import { authfetch, postCategoryServer, postProductServer, syncFromServer } from "./api.js";
import { getCurrentUserId, logout } from "./auth.js";
import { selectEmoji, supprimerCategorie, ajouterCategorie,remplirSelectCategories, afficherFiltresCategories } from "./categories.js";
import { renderCreditsHistory,marquerCreditPaye, confirmerRemboursement, remplirProduitsCredit } from "./credits.js";
import { loadAppDataLocal, saveAppDataLocal, enqueueOutbox, processOutboxOne, processOutboxAll, updateHeader, getExpirationDate } from "./index.js";
import { showModal, hideModal, ouvrirModalEdit, showModalCredit, hideModalCredit, ouvrirModalRemboursement, hideModalRemboursement, showModalById, hideModalById, closePremiumModal, closeContactModal, closeGuide } from "./modal.js";
import { showNotification, customConfirm,  } from "./notification.js";
import { handleAddProductClick } from "./premium.js";
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente,afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";
import { showSection } from "./utils.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, fermerModal, modifierVente, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode } from "./ventes.js";



export function updateCharts(ventesFiltrees) {
  var ventes = ventesFiltrees || appData.ventes || [];

  // --- Graphique ventes par jour ---
  var byDay = {};
  ventes.forEach(function (v) {
    if (!v.date) return;
    let dateObj = new Date(v.date || v.created_at || v.timestamp);
    if (isNaN(dateObj)) return;
    var d = dateObj.toISOString().slice(0, 10);
    byDay[d] = (byDay[d] || 0) + (v.total || (v.price || 0) * (v.quantity || 0));
  });
  var labels = Object.keys(byDay).sort();
  var data = labels.map(function (l) { return byDay[l]; });
  if (chartVentesByDay) chartVentesByDay.destroy();
  var ctx1 = document.getElementById('chartVentesByDay');
  if (ctx1) {
    chartVentesByDay = new Chart(ctx1.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total ventes par jour',
          data: data,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79,70,229,0.15)',
          fill: true
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // --- Produits populaires ---
  var productsSorted = (appData.produits || []).slice().sort(function (a, b) {
    return (b.vendu || 0) - (a.vendu || 0);
  }).slice(0, 8);
  var labels2 = productsSorted.map(function (p) { return p.name; });
  var data2 = productsSorted.map(function (p) { return p.vendu || 0; });
  if (chartTopProduits) chartTopProduits.destroy();
  var ctx2 = document.getElementById('chartTopProduits');
  if (ctx2) {
    chartTopProduits = new Chart(ctx2.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels2,
        datasets: [{
          label: 'Quantités vendues',
          data: data2,
          backgroundColor: 'rgba(16,185,129,0.8)'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // --- Graphique paiements avec pourcentages ---
  var pays = appData.stats.paiements || {};
  var totalPaiements = Object.values(pays).reduce((sum, val) => sum + val, 0);
  var labels3 = Object.keys(pays).map(function (k) {
    var pct = totalPaiements > 0 ? ((pays[k] / totalPaiements) * 100).toFixed(1) : 0;
    return `${k.charAt(0).toUpperCase() + k.slice(1)} (${pct}%)`;
  });
  var data3 = Object.keys(pays).map(function (k) { return pays[k] || 0; });
  if (chartPaiements) chartPaiements.destroy();
  var ctx3 = document.getElementById('chartPaiements');
  if (ctx3) {
    chartPaiements = new Chart(ctx3.getContext('2d'), {
      type: 'pie',
      data: {
        labels: labels3,
        datasets: [{
          data: data3,
          backgroundColor: ['#10b981', '#3b82f6', '#f97316', '#6b7280'] // Vert, bleu, orange, gris
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // --- Graphique stocks faibles ---
  var produitsFaibles = (appData.produits || []).filter(p => p.stock <= 5);
  var labelsStock = produitsFaibles.map(p => p.name);
  var dataStock = produitsFaibles.map(p => p.stock);
  if (window.chartStocksFaibles && typeof window.chartStocksFaibles.destroy === 'function') {
    window.chartStocksFaibles.destroy();
  }
  var ctxStock = document.getElementById('chartStocksFaibles');
  if (ctxStock) {
    window.chartStocksFaibles = new Chart(ctxStock.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labelsStock,
        datasets: [{
          label: 'Stock restant',
          data: dataStock,
          backgroundColor: 'rgba(239,68,68,0.8)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: { x: { beginAtZero: true } }
      }
    });
  }
}

export function renderVentesChart() {
  if (!appData.stats.historique || appData.stats.historique.length === 0) return;

  if (chartVentesJourInstance) {
    chartVentesJourInstance.destroy();
  }

  const labels = appData.stats.historique.map(s => new Date(s.date).toLocaleDateString());
  const dataCA = appData.stats.historique.map(s => parseInt(s.total_montant, 10));
  const dataQte = appData.stats.historique.map(s => parseInt(s.total_quantite || 0, 10));

  const ctx = document.getElementById('chartVentesJour').getContext('2d');
  chartVentesJourInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Chiffre d\'affaires (F)',
          data: dataCA,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          yAxisID: 'y'
        },
        {
          label: 'Articles vendus',
          data: dataQte,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      stacked: false,
      scales: {
        y: { type: 'linear', position: 'left' },
        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } }
      }
    }
  });
}

export function initCreditChart() {
  const ctx = document.getElementById("chartCredits");
  if (!ctx) return;

  creditChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [], // Dates
      datasets: [
        {
          label: "Total dû",
          data: [],
          borderColor: "rgba(139, 92, 246, 1)", // violet
          backgroundColor: "rgba(139, 92, 246, 0.2)",
          fill: true,
          tension: 0.3
        },
        {
          label: "Remboursé",
          data: [],
          borderColor: "rgba(34, 197, 94, 1)", // vert
          backgroundColor: "rgba(34, 197, 94, 0.2)",
          fill: true,
          tension: 0.3
        },
        {
          label: "Impayés",
          data: [],
          borderColor: "rgba(239, 68, 68, 1)", // rouge
          backgroundColor: "rgba(239, 68, 68, 0.2)",
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        title: { display: true, text: "Évolution des crédits" }
      },
      scales: {
        x: { title: { display: true, text: "Date" } },
        y: { title: { display: true, text: "Montant (F)" }, beginAtZero: true }
      }
    }
  });
}

