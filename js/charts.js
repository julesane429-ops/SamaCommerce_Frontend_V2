// charts.js
import { appData } from "./state.js";

// ---------- RAPPORTS & INVENTAIRE ----------
import { afficherRapports, updateStats, afficherStatsCredits } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";

// ---------- API ----------
import { authfetch, postCategoryServer, postProductServer, syncFromServer } from "./api.js";

// ---------- AUTH ----------
import { getCurrentUserId, logout } from "./auth.js";
window.logout = logout;

// ---------- CATEGORIES ----------
import { selectEmoji, supprimerCategorie, ajouterCategorie, remplirSelectCategories, afficherFiltresCategories } from "./categories.js";

// ---------- CREDITS ----------
import { renderCreditsHistory, marquerCreditPaye, confirmerRemboursement, remplirProduitsCredit } from "./credits.js";

// ---------- INDEX ----------
import { loadAppDataLocal, saveAppDataLocal, enqueueOutbox, processOutboxOne, processOutboxAll, updateHeader, getExpirationDate } from "./index.js";

// ---------- MODALS ----------
import { showModal, hideModal, ouvrirModalEdit, showModalCredit, hideModalCredit, ouvrirModalRemboursement, hideModalRemboursement, showModalById, hideModalById, closePremiumModal, closeContactModal, closeGuide, fermerModal } from "./modal.js";

// ---------- NOTIFICATIONS ----------
import { showNotification, customConfirm } from "./notification.js";

// ---------- PREMIUM ----------
import { handleAddProductClick } from "./premium.js";

// ---------- PRODUITS ----------
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";

// ---------- UI ----------
import { afficherCategories, afficherProduits, afficherCategoriesVente, afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";

// ---------- UTILS ----------
import { showSection } from "./utils.js";
window.showSection = showSection;

// ---------- VENTES ----------
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode, modifierVente } from "./ventes.js";

// =========================
// ==== FONCTIONS CHARTS ====
// =========================

export function updateCharts(ventesFiltrees) {
  const ventes = ventesFiltrees || appData.ventes || [];

  // --- Graphique ventes par jour ---
  const byDay = {};
  ventes.forEach(v => {
    if (!v.date) return;
    const dateObj = new Date(v.date || v.created_at || v.timestamp);
    if (isNaN(dateObj)) return;
    const d = dateObj.toISOString().slice(0, 10);
    byDay[d] = (byDay[d] || 0) + (v.total || (v.price || 0) * (v.quantity || 0));
  });

  const labels = Object.keys(byDay).sort();
  const data = labels.map(l => byDay[l]);

  if (window.chartVentesByDay && typeof window.chartVentesByDay.destroy === "function") {
    window.chartVentesByDay.destroy();
  }

  const ctx1 = document.getElementById('chartVentesByDay');
  if (ctx1) {
    window.chartVentesByDay = new Chart(ctx1.getContext('2d'), {
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
  const productsSorted = (appData.produits || []).slice()
    .sort((a, b) => (b.vendu || 0) - (a.vendu || 0))
    .slice(0, 8);

  const labels2 = productsSorted.map(p => p.name);
  const data2 = productsSorted.map(p => p.vendu || 0);

  if (window.chartTopProduits && typeof window.chartTopProduits.destroy === "function") {
    window.chartTopProduits.destroy();
  }

  const ctx2 = document.getElementById('chartTopProduits');
  if (ctx2) {
    window.chartTopProduits = new Chart(ctx2.getContext('2d'), {
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

  // --- Graphique paiements ---
  const pays = appData.stats.paiements || {};
  const totalPaiements = Object.values(pays).reduce((sum, val) => sum + val, 0);
  const labels3 = Object.keys(pays).map(k => {
    const pct = totalPaiements > 0 ? ((pays[k] / totalPaiements) * 100).toFixed(1) : 0;
    return `${k.charAt(0).toUpperCase() + k.slice(1)} (${pct}%)`;
  });
  const data3 = Object.keys(pays).map(k => pays[k] || 0);

  if (window.chartPaiements && typeof window.chartPaiements.destroy === "function") {
    window.chartPaiements.destroy();
  }

  const ctx3 = document.getElementById('chartPaiements');
  if (ctx3) {
    window.chartPaiements = new Chart(ctx3.getContext('2d'), {
      type: 'pie',
      data: { labels: labels3, datasets: [{ data: data3, backgroundColor: ['#10b981','#3b82f6','#f97316','#6b7280'] }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // --- Stocks faibles ---
  const produitsFaibles = (appData.produits || []).filter(p => p.stock <= 5);
  const labelsStock = produitsFaibles.map(p => p.name);
  const dataStock = produitsFaibles.map(p => p.stock);

  if (window.chartStocksFaibles && typeof window.chartStocksFaibles.destroy === "function") {
    window.chartStocksFaibles.destroy();
  }

  const ctxStock = document.getElementById('chartStocksFaibles');
  if (ctxStock) {
    window.chartStocksFaibles = new Chart(ctxStock.getContext('2d'), {
      type: 'bar',
      data: { labels: labelsStock, datasets: [{ label: 'Stock restant', data: dataStock, backgroundColor: 'rgba(239,68,68,0.8)' }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: { x: { beginAtZero: true } }
      }
    });
  }
}


// ==========================
// ==== CREDITS CHART ====
// ==========================
export function initCreditChart() {
  const ctx = document.getElementById("chartCredits");
  if (!ctx) return;

  if (window.creditChart && typeof window.creditChart.destroy === "function") {
    window.creditChart.destroy();
  }

  window.creditChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "Total dû", data: [], borderColor: "rgba(139,92,246,1)", backgroundColor: "rgba(139,92,246,0.2)", fill: true, tension: 0.3 },
        { label: "Remboursé", data: [], borderColor: "rgba(34,197,94,1)", backgroundColor: "rgba(34,197,94,0.2)", fill: true, tension: 0.3 },
        { label: "Impayés", data: [], borderColor: "rgba(239,68,68,1)", backgroundColor: "rgba(239,68,68,0.2)", fill: true, tension: 0.3 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true }, title: { display: true, text: "Évolution des crédits" } },
      scales: { x: { title: { display: true, text: "Date" } }, y: { title: { display: true, text: "Montant (F)" }, beginAtZero: true } }
    }
  });
}

export function chartEvolutionCA(ventes) {
  const ctx = document.getElementById("chartVentesJour");
  if (!ctx) return;

  // 🔥 On détruit l'ancien graphique
  if (window.chartVentesJourInstance && typeof window.chartVentesJourInstance.destroy === "function") {
    window.chartVentesJourInstance.destroy();
  }

  const map = {};

  ventes.forEach(v => {
    if (!v.paid) return;

    const dateObj = new Date(v.date || v.created_at || v.timestamp);
    if (isNaN(dateObj)) return;

    const date = dateObj.toISOString().slice(0, 10);
    const montant = v.total || (v.price || 0) * (v.quantity || 0);

    map[date] = (map[date] || 0) + montant;
  });

  window.chartVentesJourInstance = new Chart(ctx.getContext("2d"), {
    type: "line",
    data: {
      labels: Object.keys(map),
      datasets: [{
        label: "CA encaissé",
        data: Object.values(map),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}
