// inventaire.js
import { appData,chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits  } from "./rapports.js";
import { updateCharts, renderVentesChart, initCreditChart } from "./charts.js";
import { authfetch, postCategoryServer, postProductServer, syncFromServer } from "./api.js";
import { getCurrentUserId, logout } from "./auth.js";
import { selectEmoji, supprimerCategorie, ajouterCategorie,remplirSelectCategories, afficherFiltresCategories } from "./categories.js";
import { renderCreditsHistory,marquerCreditPaye, confirmerRemboursement, remplirProduitsCredit } from "./credits.js";
import { loadAppDataLocal, saveAppDataLocal, enqueueOutbox, processOutboxOne, processOutboxAll, updateHeader, getExpirationDate } from "./index.js";
import { showModal, hideModal, ouvrirModalEdit, showModalCredit, hideModalCredit, ouvrirModalRemboursement, hideModalRemboursement, showModalById, hideModalById, closePremiumModal, closeContactModal, closeGuide, fermerModal } from "./modal.js";
import { showNotification, customConfirm,  } from "./notification.js";
import { handleAddProductClick } from "./premium.js";
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente,afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";
import { showSection } from "./utils.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode, modifierVente  } from "./ventes.js";


// ---------- Inventaire ----------

export function afficherInventaire() {
  var tbody = document.getElementById('inventaireListe'); if (!tbody) return; tbody.innerHTML = ''; if (appData.produits.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">Aucun produit dans l’inventaire</td></tr>';
    return;
  }
  appData.produits.forEach(function (p) { var profitRealise = (p.vendu || 0) * ((p.price || 0) - (p.priceAchat || p.price_achat || 0)); var tr = document.createElement('tr'); tr.innerHTML = '<td class="p-2 border">' + p.name + '</td><td class="p-2 border">' + ((p.priceAchat || p.price_achat || 0).toLocaleString()) + ' F</td><td class="p-2 border">' + ((p.price || 0).toLocaleString()) + ' F</td><td class="p-2 border">' + (p.stock || 0) + '</td><td class="p-2 border">' + (p.vendu || 0) + '</td><td class="p-2 border">' + profitRealise.toLocaleString() + ' F</td>'; tbody.appendChild(tr); });
}

// ---------- Search handlers for inventory and categories ----------

export function setupSearchInputs() {
  var inv = document.getElementById('searchInventaire'); if (inv) { inv.addEventListener('input', function () { var term = this.value.toLowerCase(); document.querySelectorAll('#inventaireListe tr').forEach(function (row) { var prodName = (row.cells[0] && row.cells[0].textContent || '').toLowerCase(); row.style.display = prodName.indexOf(term) !== -1 ? '' : 'none'; }); }); }
  var cat = document.getElementById('searchCategorie'); if (cat) { cat.addEventListener('input', function () { var term = this.value.toLowerCase(); document.querySelectorAll('#listeCategories > div').forEach(function (div) { var catName = (div.textContent || '').toLowerCase(); div.style.display = catName.indexOf(term) !== -1 ? '' : 'none'; }); }); }
}

export function remplirSelectProduitsCredit() {
  const select = document.getElementById('creditProduct');
  if (!select) return;

  // vider avant de recharger
  select.innerHTML = '';

  if (!appData.produits || appData.produits.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Aucun produit disponible';
    select.appendChild(opt);
    return;
  }

  appData.produits.forEach(prod => {
    const opt = document.createElement('option');
    opt.value = prod.id;
    opt.textContent = `${prod.name} (${prod.stock} dispo - ${prod.price}F)`;
    select.appendChild(opt);
  });
}







