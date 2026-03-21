import { appData, chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { updateCharts, initCreditChart } from "./charts.js";
import { authfetch, postCategoryServer, postProductServer, syncFromServer } from "./api.js";
import { API_BASE } from "./api.js";
import { getCurrentUserId, logout } from "./auth.js";
import { selectEmoji, supprimerCategorie, ajouterCategorie, remplirSelectCategories, afficherFiltresCategories } from "./categories.js";
import { renderCreditsHistory, marquerCreditPaye, confirmerRemboursement, remplirProduitsCredit } from "./credits.js";
import { loadAppDataLocal, saveAppDataLocal, enqueueOutbox, processOutboxOne, processOutboxAll, updateHeader, getExpirationDate } from "./index.js";
import { showModal, hideModal, ouvrirModalEdit, showModalCredit, hideModalCredit, ouvrirModalRemboursement, hideModalRemboursement, showModalById, hideModalById, closePremiumModal, closeContactModal, closeGuide, fermerModal } from "./modal.js";
import { showNotification, customConfirm } from "./notification.js";
import { handleAddProductClick } from "./premium.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente, afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";
import { showSection } from "./utils.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode, modifierVente } from "./ventes.js";

// ── Supprimer un produit ───────────────────────────────────────────────────
export async function supprimerProduit(id) {
  const ok = await confirm("❓ Supprimer ce produit ?");
  if (!ok) { showNotification("❌ Suppression annulée", "warning"); return; }

  appData.produits = appData.produits.filter(p => p.id !== id);
  afficherProduits();
  updateStats();
  saveAppDataLocal();

  authfetch(API_BASE + "/products/" + id, { method: "DELETE" })
    .then(() => showNotification("✅ Produit supprimé avec succès", "success"))
    .catch(() => showNotification("⚠️ Erreur lors de la suppression côté serveur", "error"));
}

// ── Mettre à jour un produit ───────────────────────────────────────────────
export async function mettreAJourProduit() {
  const id = document.getElementById('modalEditProduit')?.dataset.id;
  if (!id) return;

  // Champs de base
  const produit = {
    name:        document.getElementById('editNomProduit')?.value?.trim(),
    category_id: parseInt(document.getElementById('editCategorieProduit')?.value),
    price_achat: parseFloat(document.getElementById('editPrixAchatProduit')?.value),
    price:       parseFloat(document.getElementById('editPrixProduit')?.value),
    stock:       parseInt(document.getElementById('editStockProduit')?.value),
    description: document.getElementById('editDescriptionProduit')?.value || ''
  };

  // Champs gros (optionnels — présents seulement si les éléments existent dans le DOM)
  const elPrixGros    = document.getElementById('editPrixGrosProduit');
  const elQteGros     = document.getElementById('editQuantiteGrosProduit');

  if (elPrixGros && elQteGros) {
    const prixGros = elPrixGros.value.trim();
    const qteGros  = elQteGros.value.trim();

    if (prixGros || qteGros) {
      // L'utilisateur a renseigné au moins un champ gros — valider la cohérence
      if (!prixGros || !qteGros) {
        showNotification('❌ Renseignez le prix ET la quantité pour la vente en gros.', 'error');
        return;
      }
      produit.price_gros    = parseFloat(prixGros);
      produit.quantite_gros = parseInt(qteGros);
      if (isNaN(produit.price_gros) || produit.price_gros < 0) {
        showNotification('❌ Prix gros invalide.', 'error'); return;
      }
      if (isNaN(produit.quantite_gros) || produit.quantite_gros < 1) {
        showNotification('❌ Quantité gros invalide (minimum 1).', 'error'); return;
      }
    } else {
      // Les deux vides → supprimer les tarifs gros
      produit.price_gros    = null;
      produit.quantite_gros = null;
    }
  }

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
      const err = await res.json().catch(() => ({}));
      showNotification('❌ ' + (err.error || 'Erreur lors de la mise à jour.'), 'error');
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

// ── Ajouter un produit ─────────────────────────────────────────────────────
export async function ajouterProduit() {
  const name        = document.getElementById('nomProduit')?.value?.trim();
  const category_id = parseInt(document.getElementById('categorieProduit')?.value);
  const scent       = document.getElementById('parfumProduit')?.value || '';
  const priceAchat  = parseFloat(document.getElementById('prixAchatProduit')?.value);
  const price       = parseFloat(document.getElementById('prixProduit')?.value);
  const stock       = parseInt(document.getElementById('stockProduit')?.value);
  const description = document.getElementById('descriptionProduit')?.value || '';

  if (!name || !category_id || isNaN(price) || isNaN(stock) || isNaN(priceAchat)) {
    showNotification('❌ Remplissez tous les champs correctement.', 'error');
    return;
  }

  const produit = { name, category_id, scent, price, price_achat: priceAchat, stock, description };

  // Champs gros optionnels
  const elPrixGros = document.getElementById('prixGrosProduit');
  const elQteGros  = document.getElementById('quantiteGrosProduit');

  if (elPrixGros && elQteGros) {
    const prixGros = elPrixGros.value.trim();
    const qteGros  = elQteGros.value.trim();

    if (prixGros || qteGros) {
      if (!prixGros || !qteGros) {
        showNotification('❌ Renseignez le prix ET la quantité pour la vente en gros.', 'error');
        return;
      }
      produit.price_gros    = parseFloat(prixGros);
      produit.quantite_gros = parseInt(qteGros);
      if (isNaN(produit.price_gros) || produit.price_gros < 0) {
        showNotification('❌ Prix gros invalide.', 'error'); return;
      }
      if (isNaN(produit.quantite_gros) || produit.quantite_gros < 1) {
        showNotification('❌ Quantité gros invalide (minimum 1).', 'error'); return;
      }
    }
  }

  const created = await postProductServer(produit);
  if (created) {
    showNotification('✅ Produit ajouté.', 'success');
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
    showNotification("❌ Erreur lors de l'ajout du produit.", 'error');
  }
}

// ── Filtrer les produits ───────────────────────────────────────────────────
export function filtrerProduits(categorieId) {
  document.querySelectorAll('.filtre-btn').forEach(btn => {
    btn.classList.remove('bg-blue-500', 'text-white');
    btn.classList.add('bg-gray-200');
  });
  if (window.event?.target) {
    window.event.target.classList.add('bg-blue-500', 'text-white');
    window.event.target.classList.remove('bg-gray-200');
  }
  const id = categorieId === 'tous' ? 'tous' : parseInt(categorieId);
  afficherProduits(id);
}

// ── Modifier le stock ──────────────────────────────────────────────────────
export function modifierStock(id, delta) {
  const produit = appData.produits.find(p => p.id === id);
  if (!produit) return;

  const newStock = Math.max(0, (parseInt(produit.stock) || 0) + delta);
  produit.stock = newStock;

  afficherProduits();
  updateStats();
  saveAppDataLocal();

  authfetch(API_BASE + '/products/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name:        produit.name,
      price:       parseFloat(produit.price)                              || 0,
      price_achat: parseFloat(produit.priceAchat || produit.price_achat)  || 0,
      stock:       newStock,
      description: produit.description || ''
    })
  }).catch(() => {});
}
