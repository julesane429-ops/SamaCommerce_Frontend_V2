// ui.js
import { appData,chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits  } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { updateCharts, initCreditChart } from "./charts.js";
import { authfetch, postCategoryServer, postProductServer, syncFromServer } from "./api.js";
import { getCurrentUserId, logout } from "./auth.js";
import { selectEmoji, supprimerCategorie, ajouterCategorie,remplirSelectCategories, afficherFiltresCategories } from "./categories.js";
import { renderCreditsHistory,marquerCreditPaye, confirmerRemboursement, remplirProduitsCredit } from "./credits.js";
import { loadAppDataLocal, saveAppDataLocal, enqueueOutbox, processOutboxOne, processOutboxAll, updateHeader, getExpirationDate } from "./index.js";
import { showModal, hideModal, ouvrirModalEdit, showModalCredit, hideModalCredit, ouvrirModalRemboursement, hideModalRemboursement, showModalById, hideModalById, closePremiumModal, closeContactModal, closeGuide, fermerModal } from "./modal.js";
import { showNotification, customConfirm,  } from "./notification.js";
import { handleAddProductClick } from "./premium.js";
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";
import { showSection } from "./utils.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode, modifierVente  } from "./ventes.js";




export function afficherCategories() {
  var ctn = document.getElementById('listeCategories');
  if (!ctn) return;
  ctn.innerHTML = '';

  if (appData.categories.length === 0) {
    ctn.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏷️</div>
        <div class="empty-text">Aucune catégorie trouvée</div>
        <div class="empty-sub">Ajoutez votre première catégorie</div>
      </div>`;
    return;
  }

  // Grille 2 colonnes
  const grid = document.createElement('div');
  grid.className = 'categories-grid';

  appData.categories.forEach(function (cat) {
    var produitsCount = appData.produits.filter(function (p) { return p.category_id === cat.id; }).length;
    var stockTotal = appData.produits
      .filter(function (p) { return p.category_id === cat.id; })
      .reduce(function (s, p) { return s + (p.stock || 0); }, 0);

    var div = document.createElement('div');
    div.className = 'cat-card ' + (cat.couleur || 'cat-default');
    div.innerHTML = `
      <button class="cat-delete-btn" aria-label="Supprimer">🗑️</button>
      <div class="cat-emoji">${cat.emoji || '📦'}</div>
      <div class="cat-name">${cat.name}</div>
      <div class="cat-meta">
        <span class="cat-badge">${produitsCount} produit${produitsCount > 1 ? 's' : ''}</span>
        <span class="cat-stock">📦 ${stockTotal}</span>
      </div>`;

    const btn = div.querySelector('.cat-delete-btn');
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); supprimerCategorie(cat.id); });

    grid.appendChild(div);
  });

  ctn.appendChild(grid);
}

export function afficherProduits(categorieFilter) {
  if (typeof categorieFilter === 'undefined') categorieFilter = 'tous';

  const container = document.getElementById('listeProduits');
  if (!container) return;

  container.innerHTML = '';

  let produits = appData.produits.slice();

  if (produits.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <div class="empty-text">Aucun produit trouvé</div>
        <div class="empty-sub">Ajoutez votre premier produit</div>
      </div>`;
    return;
  }

  if (categorieFilter !== 'tous') {
    const catId = parseInt(categorieFilter);
    produits = produits.filter(p => parseInt(p.category_id) === catId);
  }

  produits.forEach(function (produit) {
    const categorie = appData.categories.find(c => c.id === produit.category_id);

    // Statut stock
    const stockLevel = produit.stock <= 5 ? 'critical' : produit.stock < 10 ? 'low' : 'ok';
    const stockLabel = stockLevel === 'critical' ? '🔴' : stockLevel === 'low' ? '🟠' : '🟢';

    // Marge : pour un produit mixte, la marge principale est sur le lot gros
    const priceAchat = parseFloat(produit.priceAchat || produit.price_achat) || 0;
    const marge = produit.is_mixed_sale && produit.price_gros
      ? (produit.price_gros || 0) - priceAchat
      : (produit.price || 0) - priceAchat;
    const margeSign = marge >= 0 ? '+' : '';

    const div = document.createElement('div');
    div.className = `produit-card stock-${stockLevel}`;
    div.innerHTML = `
      <div class="produit-card-header">
        <div class="produit-cat-badge ${categorie ? (categorie.couleur || '') : ''}">
          ${categorie ? (categorie.emoji + ' ' + categorie.name) : '📦 Sans catégorie'}
        </div>
        <div class="produit-stock-pill stock-pill-${stockLevel}">
          ${stockLabel} ${produit.is_mixed_sale && produit.lot_size > 1
            ? `${Math.floor((produit.stock||0)/produit.lot_size)} lots · ${produit.stock||0} u.`
            : produit.stock || 0}
        </div>
      </div>

      <div class="produit-card-body">
        <div class="produit-name">${produit.name}</div>
        ${produit.description ? `<div class="produit-desc">${produit.description}</div>` : ''}
        <div class="produit-prices">
          ${produit.is_mixed_sale && produit.lot_size > 1 ? `
            <div style="width:100%;margin-bottom:4px;">
              <span style="font-size:10px;font-weight:700;color:#7C3AED;text-transform:uppercase;">📦 Gros lot×${produit.lot_size}</span>
              <span style="font-size:15px;font-weight:800;color:#7C3AED;margin-left:6px;">${(produit.price_gros||0).toLocaleString('fr-FR')} F</span>
            </div>
            <div style="width:100%;">
              <span style="font-size:10px;font-weight:700;color:#10B981;text-transform:uppercase;">🧴 Détail</span>
              <span style="font-size:15px;font-weight:800;color:#10B981;margin-left:6px;">${(produit.price_detail||produit.price||0).toLocaleString('fr-FR')} F</span>
            </div>
            <div class="produit-price-achat" style="margin-top:4px;">Achat lot: ${(produit.priceAchat || produit.price_achat || 0).toLocaleString('fr-FR')} F</div>
          ` : `
            <div class="produit-price-main">${(produit.price || 0).toLocaleString('fr-FR')} F</div>
            <div class="produit-price-achat">Achat: ${(produit.priceAchat || produit.price_achat || 0).toLocaleString('fr-FR')} F</div>
            <div class="produit-marge ${marge >= 0 ? 'marge-pos' : 'marge-neg'}">Marge: ${margeSign}${marge.toLocaleString('fr-FR')} F</div>
          `}
        </div>
      </div>

      <div class="produit-card-actions">
        <div class="produit-stock-controls">
          <button class="btn-mod-stock-minus stock-btn">−</button>
          <span class="stock-count">${produit.stock || 0}</span>
          <button class="btn-mod-stock-plus stock-btn">+</button>
        </div>
        <div class="produit-action-btns">
          <button class="btn-edit prd-btn prd-btn-edit">✏️ Éditer</button>
          <button class="btn-suppr prd-btn prd-btn-del">🗑️</button>
        </div>
      </div>`;

    container.appendChild(div);

    div.querySelector('.btn-edit').addEventListener('click', () => ouvrirModalEdit(produit));
    div.querySelector('.btn-mod-stock-minus').addEventListener('click', () => modifierStock(produit.id, -1));
    div.querySelector('.btn-mod-stock-plus').addEventListener('click', () => modifierStock(produit.id, 1));
    div.querySelector('.btn-suppr').addEventListener('click', () => supprimerProduit(produit.id));
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
  const produits  = appData.produits.filter(p => p.category_id === categorieId && p.stock > 0);
  const container = document.getElementById('categoriesVente');
  if (!container) return;

  container.innerHTML = '';

  const retourBtn = document.createElement('button');
  retourBtn.textContent = '← Retour';
  retourBtn.className   = 'col-span-2 mb-4 text-blue-600 font-bold';
  retourBtn.addEventListener('click', afficherCategoriesVente);
  container.appendChild(retourBtn);

  produits.forEach(produit => {
    if (produit.is_mixed_sale && produit.lot_size > 1) {
      // ── Produit vente mixte : afficher 2 cartes côte à côte ──
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'grid-column:span 2;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px;';

      // Carte GROS
      const divGros = document.createElement('div');
      divGros.className  = 'bg-white border-2 border-purple-200 p-3 rounded-2xl text-center cursor-pointer';
      divGros.style.cssText = 'border-color:#DDD6FE;';
      divGros.innerHTML = `
        <div style="font-size:10px;font-weight:700;color:#7C3AED;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">📦 Lot×${produit.lot_size}</div>
        <div style="font-size:13px;font-weight:700;color:#1E1B4B;margin-bottom:4px;">${produit.name}</div>
        <div style="font-size:18px;font-weight:800;color:#7C3AED;margin-bottom:4px;">${(produit.price_gros || 0).toLocaleString()} F</div>
        <div style="font-size:11px;color:#6B7280;">Stock: ${Math.floor(produit.stock / produit.lot_size)} lot${Math.floor(produit.stock / produit.lot_size) > 1 ? 's' : ''}</div>
      `;
      divGros.addEventListener('click', () => ajouterAuPanier({
        ...produit,
        price:          produit.price_gros,
        _vente_mode:    'gros',
        _lot_qty:       produit.lot_size,   // décrémente le stock de lot_size unités
        name:           produit.name + ` (×${produit.lot_size})`,
      }));

      // Carte DÉTAIL
      const divDetail = document.createElement('div');
      divDetail.className   = 'bg-white border-2 border-green-200 p-3 rounded-2xl text-center cursor-pointer';
      divDetail.style.cssText = 'border-color:#BBF7D0;';
      divDetail.innerHTML = `
        <div style="font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">🧴 Unité</div>
        <div style="font-size:13px;font-weight:700;color:#1E1B4B;margin-bottom:4px;">${produit.name}</div>
        <div style="font-size:18px;font-weight:800;color:#10B981;margin-bottom:4px;">${(produit.price_detail || produit.price || 0).toLocaleString()} F</div>
        <div style="font-size:11px;color:#6B7280;">Stock: ${produit.stock} unité${produit.stock > 1 ? 's' : ''}</div>
      `;
      divDetail.addEventListener('click', () => ajouterAuPanier({
        ...produit,
        price:       produit.price_detail || produit.price,
        _vente_mode: 'detail',
        _lot_qty:    1,
      }));

      wrapper.appendChild(divGros);
      wrapper.appendChild(divDetail);
      container.appendChild(wrapper);

    } else {
      // ── Produit normal : une seule carte ──
      const div = document.createElement('div');
      div.className = 'bg-white border-2 border-gray-200 p-4 rounded-2xl text-center cursor-pointer';
      div.addEventListener('click', () => ajouterAuPanier(produit));
      div.innerHTML = `
        <div style="font-size:13px;font-weight:700;color:#1E1B4B;margin-bottom:4px;">${produit.name}</div>
        <div style="font-size:20px;font-weight:800;color:#10B981;margin-bottom:4px;">${(parseFloat(produit.price) || 0).toLocaleString()} F</div>
        <div style="font-size:11px;color:#6B7280;">Stock: ${produit.stock || 0}</div>
      `;
      container.appendChild(div);
    }
  });
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
    if (window.creditChart && typeof window.creditChart.destroy === "function") {
  window.creditChart.destroy();
  window.creditChart = null;
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
