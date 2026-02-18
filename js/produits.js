import { appData,chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits  } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { updateCharts, renderVentesChart, initCreditChart } from "./charts.js";
import { authfetch, postCategoryServer, postProductServer, syncFromServer } from "./api.js";
import { getCurrentUserId, logout } from "./auth.js";
import { selectEmoji, supprimerCategorie, ajouterCategorie,remplirSelectCategories, afficherFiltresCategories } from "./categories.js";
import { renderCreditsHistory,marquerCreditPaye, confirmerRemboursement, remplirProduitsCredit } from "./credits.js";
import { loadAppDataLocal, saveAppDataLocal, enqueueOutbox, processOutboxOne, processOutboxAll, updateHeader, getExpirationDate } from "./index.js";
import { showModal, hideModal, ouvrirModalEdit, showModalCredit, hideModalCredit, ouvrirModalRemboursement, hideModalRemboursement, showModalById, hideModalById, closePremiumModal, closeContactModal, closeGuide, fermerModal } from "./modal.js";
import { showNotification, customConfirm,  } from "./notification.js";
import { handleAddProductClick } from "./premium.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente,afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";
import { showSection } from "./utils.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode, modifierVente  } from "./ventes.js";



export async function supprimerProduit(id) {
  const ok = await confirm("❓ Supprimer ce produit ?");
  if (!ok) {
    showNotification("❌ Suppression annulée", "warning");
    return;
  }

  // Suppression locale
  appData.produits = appData.produits.filter(p => p.id !== id);
  afficherProduits();
  updateStats();
  saveAppDataLocal();

  // Suppression côté backend
  authfetch(API_BASE + "/products/" + id, { method: "DELETE" })
    .then(() => {
      showNotification("✅ Produit supprimé avec succès", "success");
    })
    .catch(() => {
      showNotification("⚠️ Erreur lors de la suppression côté serveur", "error");
    });
}

export async function mettreAJourProduit() {
  const id = document.getElementById('modalEditProduit').dataset.id;
  const produit = {
    name: document.getElementById('editNomProduit').value,
    category_id: parseInt(document.getElementById('editCategorieProduit').value),
    price_achat: parseFloat(document.getElementById('editPrixAchatProduit').value),
    price: parseFloat(document.getElementById('editPrixProduit').value),
    stock: parseInt(document.getElementById('editStockProduit').value),
    description: document.getElementById('editDescriptionProduit').value
  };

  if (!produit.name || isNaN(produit.price) || isNaN(produit.price_achat) || isNaN(produit.stock)) {
    showNotification('❌ Remplissez tous les champs correctement.', 'error');
    return;
  }

  try {
    const res = await authfetch(API_BASE + '/products/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(produit)
    });

    if (!res.ok) {
      showNotification('❌ Erreur lors de la mise à jour du produit.', 'error');
      return;
    }

    showNotification('✅ Produit mis à jour.', 'success');
    hideModal();
    await syncFromServer();
    afficherProduits();
    afficherInventaire();
    updateStats();
  } catch (err) {
    console.error(err);
    showNotification('❌ Impossible de contacter le serveur.', 'error');
  }
}

export async function ajouterProduit() {
  const name = document.getElementById('nomProduit').value;
  const category_id = parseInt(document.getElementById('categorieProduit').value);
  const scentEl = document.getElementById('parfumProduit');
  const scent = scentEl ? scentEl.value : '';
  const priceAchat = parseFloat(document.getElementById('prixAchatProduit').value); // ✅ prix achat
  const price = parseFloat(document.getElementById('prixProduit').value);
  const stock = parseInt(document.getElementById('stockProduit').value);

  // Validation
  if (!name || !category_id || isNaN(price) || isNaN(stock) || isNaN(priceAchat)) {
    showNotification('❌ Remplissez tous les champs correctement.', "error");
    return;
  }

  // ✅ envoyer avec le nom correct pour la BDD
  const produit = {
    name: name,
    category_id: category_id,
    scent: scent,
    price: price,
    price_achat: priceAchat,
    stock: stock
  };

  const created = await postProductServer(produit);
  if (created) {
    showNotification('✅ Produit ajouté (serveur).', "success");
    await syncFromServer();
    updateStats();
    verifierStockFaible();
    afficherCategoriesVente();
    afficherProduits();
    afficherCategories();
    afficherRapports();
    afficherInventaire();
    hideModal();
  } else {
    showNotification('❌ Erreur lors de l\'ajout du produit.', "error");
  }
}

export function filtrerProduits(categorieId) { document.querySelectorAll('.filtre-btn').forEach(function (btn) { btn.classList.remove('bg-blue-500', 'text-white'); btn.classList.add('bg-gray-200'); }); if (window.event && window.event.target) { var t = window.event.target; t.classList.add('bg-blue-500', 'text-white'); t.classList.remove('bg-gray-200'); } afficherProduits(categorieId); }

export function modifierStock(id, delta) {
  var produit = appData.produits.find(function (p) { return p.id === id; });
  if (produit && produit.stock + delta >= 0) {
    produit.stock += delta;
    afficherProduits();
    updateStats();
    saveAppDataLocal();

    // ✅ on envoie bien "price_achat"
    authfetch(API_BASE + '/products/' + id, {
      method: 'PATCH', // PATCH plutôt que PUT pour ne mettre à jour que les champs modifiés
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: produit.name,
        price: produit.price,
        price_achat: produit.priceAchat || produit.price_achat || 0,
        stock: produit.stock,
        description: produit.description
      })
    }).then(function (r) {
      if (!r.ok) console.warn('update failed');
    }).catch(function () { });
  }
}
