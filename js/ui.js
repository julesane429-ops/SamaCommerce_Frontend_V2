// ui.js
import { appData,chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits  } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { updateCharts, renderVentesChart, initCreditChart } from "./charts.js";
import { authfetch, postCategoryServer, postProductServer, syncFromServer } from "./api.js";
import { getCurrentUserId, logout } from "./auth.js";
import { selectEmoji, supprimerCategorie, ajouterCategorie,remplirSelectCategories, afficherFiltresCategories } from "./categories.js";
import { renderCreditsHistory,marquerCreditPaye, confirmerRemboursement, remplirProduitsCredit } from "./credits.js";
import { loadAppDataLocal, saveAppDataLocal, enqueueOutbox, processOutboxOne, processOutboxAll, updateHeader, getExpirationDate } from "./index.js";
import { showModal, hideModal, ouvrirModalEdit, showModalCredit, hideModalCredit, ouvrirModalRemboursement, hideModalRemboursement, showModalById, hideModalById, closePremiumModal, closeContactModal, closeGuide, fermerModal, modifierVente } from "./modal.js";
import { showNotification, customConfirm,  } from "./notification.js";
import { handleAddProductClick } from "./premium.js";
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";
import { showSection } from "./utils.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode } from "./ventes.js";




export function afficherCategories() {
  var ctn = document.getElementById('listeCategories');
  if (!ctn) return;
  ctn.innerHTML = '';

  if (appData.categories.length === 0) {
    ctn.innerHTML = '<div class="text-gray-500 text-center py-4">Aucune catégorie trouvée</div>';
    return;
  }

  appData.categories.forEach(function (cat) {
    var produitsCount = appData.produits.filter(function (p) { return p.category_id === cat.id; }).length;

    var div = document.createElement('div');
    div.className = (cat.couleur || '') + ' text-white rounded-2xl p-6 shadow-lg';
    div.innerHTML = `
      <div class="flex justify-between items-center">
        <div>
          <div class="text-4xl mb-2">${cat.emoji || ''}</div>
          <div class="text-xl font-bold">${cat.name}</div>
          <div class="text-sm opacity-90">${produitsCount} produits</div>
        </div>
        <button class="bg-white bg-opacity-20 text-white px-3 py-2 rounded-lg text-sm">🗑️</button>
      </div>`;

    // Rendre le bouton actif
    const btn = div.querySelector('button');
    if (btn) {
      btn.addEventListener('click', () => supprimerCategorie(cat.id));
    }

    ctn.appendChild(div);
  });
}

export function afficherProduits(categorieFilter) {
  if (typeof categorieFilter === 'undefined') categorieFilter = 'tous';

  const container = document.getElementById('listeProduits');
  if (!container) return;

  container.innerHTML = '';

  let produits = appData.produits.slice();

  if (produits.length === 0) {
    container.innerHTML = '<div class="text-gray-500 text-center py-4">Aucun produit trouvé</div>';
    return;
  }

  if (categorieFilter !== 'tous') {
    produits = produits.filter(p => p.category_id === categorieFilter);
  }

  produits.forEach(function (produit) {
    const categorie = appData.categories.find(c => c.id === produit.category_id);

    const stockColor = (produit.stock < 5) ? 'text-red-600' :
      (produit.stock < 10) ? 'text-orange-600' :
        'text-green-600';

    let stockBadge = '';
    if (produit.stock <= 5) {
      stockBadge = `<span class="ml-2 inline-block px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">⚠️</span>`;
    } else if (produit.stock < 10) {
      stockBadge = `<span class="ml-2 inline-block px-2 py-0.5 text-xs font-bold text-white bg-orange-500 rounded-full">⚠️</span>`;
    }

    let bgAlertClass = '';
    if (produit.stock <= 5) bgAlertClass = 'bg-red-50';
    else if (produit.stock < 10) bgAlertClass = 'bg-orange-50';

    const div = document.createElement('div');
    div.className = 'rounded-2xl p-4 shadow-lg ' + bgAlertClass;

    const descriptionHtml = produit.description
      ? `<div class="text-xs text-gray-500 mt-1">${produit.description}</div>`
      : '';

    div.innerHTML =
      `<div class="flex justify-between items-start mb-3">
         <div>
           <div class="text-lg font-bold">${produit.name}</div>
           <div class="text-sm text-gray-600">
             ${categorie ? (categorie.emoji + ' ' + categorie.name) : 'Sans catégorie'}
           </div>
           ${descriptionHtml}
         </div>
         <div class="text-right">
           <div class="text-xl font-bold text-green-600">${(produit.price || 0).toLocaleString()} F</div>
           <div class="text-sm ${stockColor} font-bold">Stock: ${produit.stock || 0}${stockBadge}</div>
           <div class="text-xs text-gray-500">Achat: ${(produit.priceAchat || produit.price_achat || 0).toLocaleString()} F</div>
         </div>
       </div>
       <div class="flex gap-2">
         <button class="btn-edit bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-bold">✏️ Éditer</button>
         <button class="btn-mod-stock-minus bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold">- Stock</button>
         <button class="btn-mod-stock-plus bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold">+ Stock</button>
         <button class="btn-suppr bg-gray-500 text-white px-4 py-2 rounded-lg text-sm">🗑️</button>
       </div>`;

    container.appendChild(div);

    const btnEdit = div.querySelector('.btn-edit');
    if (btnEdit) btnEdit.addEventListener('click', () => ouvrirModalEdit(produit));


    // Wire buttons
    const btnMinus = div.querySelector('.btn-mod-stock-minus');
    if (btnMinus) btnMinus.addEventListener('click', () => modifierStock(produit.id, -1));

    const btnPlus = div.querySelector('.btn-mod-stock-plus');
    if (btnPlus) btnPlus.addEventListener('click', () => modifierStock(produit.id, 1));

    const btnSuppr = div.querySelector('.btn-suppr');
    if (btnSuppr) btnSuppr.addEventListener('click', () => supprimerProduit(produit.id));
  });
}

// ---------- Vente / Panier ----------

export function afficherCategoriesVente() {
  const ctn = document.getElementById('categoriesVente'); if (!ctn) return; ctn.innerHTML = ''; if (appData.categories.length === 0) {
    ctn.innerHTML = '<div class="text-gray-500 text-center py-4">Aucune catégorie disponible</div>';
    return;
  }
  appData.categories.forEach(function (cat) { const produitsCategorie = appData.produits.filter(function (p) { return p.category_id === cat.id && p.stock > 0; }); if (!produitsCategorie.length) return; const d = document.createElement('div'); d.className = 'big-button ' + (cat.couleur || '') + ' text-white p-4 rounded-2xl text-center cursor-pointer shadow-lg'; d.addEventListener('click', function () { afficherProduitsCategorie(cat.id); }); d.innerHTML = '<div class="text-4xl mb-2">' + (cat.emoji || '') + '</div><div class="font-bold">' + cat.name + '</div><div class="text-sm opacity-90">' + produitsCategorie.length + ' produits</div>'; ctn.appendChild(d); });
}

export function afficherProduitsCategorie(categorieId) {
  const produits = appData.produits.filter(function (p) { return p.category_id === categorieId && p.stock > 0; }); const container = document.getElementById('categoriesVente'); if (!container) return; container.innerHTML = ''; const retourBtn = document.createElement('button'); retourBtn.textContent = '← Retour'; retourBtn.className = 'col-span-2 mb-4 text-blue-600 font-bold'; retourBtn.addEventListener('click', afficherCategoriesVente); container.appendChild(retourBtn);
  produits.forEach(function (produit) { const div = document.createElement('div'); div.className = 'bg-white border-2 border-gray-200 p-4 rounded-2xl text-center cursor-pointer hover:border-blue-400 transition-all'; div.addEventListener('click', function () { ajouterAuPanier(produit); }); div.innerHTML = '<div class="font-bold text-lg mb-1">' + produit.name + '</div><div class="text-2xl font-bold text-green-600 mb-1">' + (produit.price || 0).toLocaleString() + ' F</div><div class="text-sm text-gray-600">Stock: ' + (produit.stock || 0) + '</div>'; container.appendChild(div); });
}

export function verifierStockFaible() {
  if (!appData) return;
  const low = appData.produits.filter(function (p) { return p.stock > 0 && p.stock <= 5; });
  const div = document.getElementById('produitsStockFaible'); const alertDiv = document.getElementById('alertesStock');
  if (low.length) { if (alertDiv) alertDiv.style.display = 'block'; if (div) div.innerHTML = ''; low.forEach(function (produit) { const cat = appData.categories.find(function (c) { return c.id === produit.category_id; }); const el = document.createElement('div'); el.className = 'bg-white rounded-xl p-3 flex justify-between items-center'; el.innerHTML = '<span class="font-bold">' + (cat ? cat.emoji : '📦') + ' ' + produit.name + '</span><span class="text-red-600 font-bold">' + produit.stock + ' restants</span>'; if (div) div.appendChild(el); }); }
  else if (alertDiv) alertDiv.style.display = 'none';
}




// === Fonction afficherCredits ===

export function afficherCredits() {
  console.log("📊 Credits récupérés:", appData.credits);

  // --- Calcul des totaux globaux ---
  const totalDu = appData.credits.reduce((s, c) => s + (c.total || 0), 0);
  const totalRembourse = appData.credits
    .filter(c => c.paid)
    .reduce((s, c) => s + (c.total || 0), 0);
  const totalImpayes = totalDu - totalRembourse;

  // --- Mise à jour des compteurs ---
  const elEncours = document.getElementById("creditsTotalEncours");
  if (elEncours) elEncours.textContent = totalDu.toLocaleString() + " F";

  const elRemb = document.getElementById("creditsTotalRembourses");
  if (elRemb) elRemb.textContent = totalRembourse.toLocaleString() + " F";

  const elImp = document.getElementById("creditsTotalImpaye");
  if (elImp) elImp.textContent = totalImpayes.toLocaleString() + " F";

  // --- Historique par date ---
  const dailyStats = {};
  appData.credits.forEach(c => {
    const date = (c.created_at ? new Date(c.created_at) : new Date()).toISOString().split("T")[0];
    if (!dailyStats[date]) {
      dailyStats[date] = { totalDu: 0, totalRembourse: 0, totalImpayes: 0 };
    }
    dailyStats[date].totalDu += c.total || 0;
    if (c.paid) {
      dailyStats[date].totalRembourse += c.total || 0;
    } else {
      dailyStats[date].totalImpayes += c.total || 0;
    }
  });

  const labels = Object.keys(dailyStats).sort();

  // --- Transformation en cumulatif ---
  let cumulDu = 0, cumulRemb = 0, cumulImp = 0;
  const dataDu = [];
  const dataRemb = [];
  const dataImp = [];

  labels.forEach(d => {
    cumulDu += dailyStats[d].totalDu;
    cumulRemb += dailyStats[d].totalRembourse;
    cumulImp += dailyStats[d].totalImpayes;

    dataDu.push(cumulDu);
    dataRemb.push(cumulRemb);
    dataImp.push(cumulImp);
  });

  // --- Création / mise à jour du graphique ---
  const ctx = document.getElementById("chartCredits")?.getContext("2d");
  if (ctx) {
    if (window.creditChart) {
      window.creditChart.destroy();
    }
    window.creditChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Total dû",
            data: dataDu,
            borderColor: "purple",
            backgroundColor: "rgba(128,0,128,0.2)",
            fill: true
          },
          {
            label: "Remboursé",
            data: dataRemb,
            borderColor: "green",
            backgroundColor: "rgba(0,128,0,0.2)",
            fill: true
          },
          {
            label: "Impayés",
            data: dataImp,
            borderColor: "red",
            backgroundColor: "rgba(255,0,0,0.2)",
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "top" },
          title: { display: true, text: "Évolution cumulée des crédits" }
        },
        interaction: {
          mode: "index",
          intersect: false
        }
      }
    });
  }

  // --- Mise à jour du tableau ---
  const body = document.getElementById("creditsHistoryBody");
  if (body) {
    body.innerHTML = "";
    appData.credits.forEach(c => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="p-2 border">${new Date(c.created_at).toLocaleDateString()}</td>
        <td class="p-2 border">${c.client_name || "-"}</td>
        <td class="p-2 border">${c.product_name || "-"}</td>
        <td class="p-2 border">${c.quantity}</td>
        <td class="p-2 border">${(c.total || 0).toLocaleString()} F</td>
        <td class="p-2 border">${c.due_date ? new Date(c.due_date).toLocaleDateString() : "-"}</td>
        <td class="p-2 border ${c.paid ? "text-green-600" : "text-red-600"}">
          ${c.paid ? "Payé" : "Non payé"}
        </td>
        <td class="p-2 border">
          ${c.paid ? "✔️" : `<button onclick="ouvrirModalRemboursement(${c.id})" class="bg-blue-500 text-white px-2 py-1 rounded">Rembourser</button>`}
        </td>
      `;
      body.appendChild(tr);
    });
  }
}




