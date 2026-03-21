import { appData,chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits  } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { updateCharts, initCreditChart } from "./charts.js";
import { authfetch, postCategoryServer, postProductServer, syncFromServer } from "./api.js";
import { API_BASE } from "./api.js";
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

  const isMixed     = document.getElementById('editIsMixedSale')?.checked || false;
  const lotSize     = parseInt(document.getElementById('editLotSizeProduit')?.value) || 1;
  const priceGros   = parseFloat(document.getElementById('editPrixGrosProduit')?.value) || null;
  const priceDetail = parseFloat(document.getElementById('editPrixDetailProduit')?.value) || null;
  const priceSimple = parseFloat(document.getElementById('editPrixProduit').value);
  const price       = isMixed ? (priceDetail || 0) : priceSimple;

  const produit = {
    name:          document.getElementById('editNomProduit').value,
    category_id:   parseInt(document.getElementById('editCategorieProduit').value),
    price_achat:   parseFloat(document.getElementById('editPrixAchatProduit').value),
    price,
    stock:         parseInt(document.getElementById('editStockProduit').value),
    description:   document.getElementById('editDescriptionProduit').value,
    is_mixed_sale: isMixed,
    lot_size:      isMixed ? lotSize    : 1,
    price_gros:    isMixed ? priceGros  : null,
    price_detail:  isMixed ? priceDetail: null,
  };

  if (!produit.name || isNaN(produit.price_achat) || isNaN(produit.stock)) {
    showNotification('❌ Remplissez tous les champs correctement.', 'error');
    return;
  }
  if (!isMixed && isNaN(priceSimple)) {
    showNotification('❌ Saisissez le prix de vente.', 'error');
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
  const name        = document.getElementById('nomProduit').value;
  const category_id = parseInt(document.getElementById('categorieProduit').value);
  const scentEl     = document.getElementById('parfumProduit');
  const scent       = scentEl ? scentEl.value : '';
  const priceAchat  = parseFloat(document.getElementById('prixAchatProduit').value);
  const stock       = parseInt(document.getElementById('stockProduit').value);

  // Vente mixte
  const isMixed     = document.getElementById('isMixedSale')?.checked || false;
  const lotSize     = parseInt(document.getElementById('lotSizeProduit')?.value) || 1;
  const priceGros   = parseFloat(document.getElementById('prixGrosProduit')?.value) || null;
  const priceDetail = parseFloat(document.getElementById('prixDetailProduit')?.value) || null;

  // Le prix principal = prix détail si mixte, sinon prix vente simple
  const price = isMixed
    ? (priceDetail || 0)
    : parseFloat(document.getElementById('prixProduit').value);

  // Validations
  if (!name || !category_id || isNaN(priceAchat) || isNaN(stock)) {
    showNotification('❌ Remplissez tous les champs correctement.', 'error');
    return;
  }
  if (!isMixed && isNaN(price)) {
    showNotification('❌ Saisissez le prix de vente.', 'error');
    return;
  }
  if (isMixed && (!priceGros || !priceDetail || isNaN(lotSize) || lotSize < 2)) {
    showNotification('❌ Pour la vente mixte : saisissez les unités par lot, le prix gros et le prix detail.', 'error');
    return;
  }

  const produit = {
    name,
    category_id,
    scent,
    price,
    price_achat:  priceAchat,
    stock,
    is_mixed_sale: isMixed,
    lot_size:      isMixed ? lotSize    : 1,
    price_gros:    isMixed ? priceGros  : null,
    price_detail:  isMixed ? priceDetail: null,
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

export function filtrerProduits(categorieId) {
  document.querySelectorAll('.filtre-btn').forEach(function (btn) {
    btn.classList.remove('bg-blue-500', 'text-white');
    btn.classList.add('bg-gray-200');
  });
  if (window.event && window.event.target) {
    var t = window.event.target;
    t.classList.add('bg-blue-500', 'text-white');
    t.classList.remove('bg-gray-200');
  }
  // Normaliser en number pour que === fonctionne correctement
  const id = categorieId === 'tous' ? 'tous' : parseInt(categorieId);
  afficherProduits(id);
}

export function modifierStock(id, delta) {
  var produit = appData.produits.find(function (p) { return p.id === id; });
  if (produit) {
    // S'assurer que stock est bien un number avant l'opération
    const stockActuel = parseInt(produit.stock) || 0;
    const newStock    = stockActuel + delta;
    if (newStock < 0) return; // pas de stock négatif
    produit.stock = newStock;

    // Mettre à jour le compteur dans la carte sans tout re-rendre
    const cards = document.querySelectorAll('.produit-card');
    cards.forEach(card => {
      const minusBtn = card.querySelector('.btn-mod-stock-minus');
      if (minusBtn) {
        // Identifier la carte par le listener — on re-render uniquement cette carte
        // Pour l'instant on update juste le badge visible
        const countEl = card.querySelector('.stock-count');
        if (countEl && card._produitId === id) countEl.textContent = newStock;
      }
    });

    // Re-render complet (nécessaire pour mettre à jour la couleur de bordure stock)
    afficherProduits();
    updateStats();
    saveAppDataLocal();

    authfetch(API_BASE + '/products/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:        produit.name,
        price:       parseFloat(produit.price)                          || 0,
        price_achat: parseFloat(produit.priceAchat || produit.price_achat) || 0,
        stock:       newStock,
        description: produit.description || ''
      })
    }).then(function (r) {
      if (!r.ok) console.warn('modifierStock: update failed', r.status);
    }).catch(function () {});
  }
}
