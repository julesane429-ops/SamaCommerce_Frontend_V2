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



export function showModal(modalName) {
  const overlay = document.getElementById('modalOverlay'); if (overlay) overlay.classList.remove('hidden');
  const modalId = 'modal' + modalName.charAt(0).toUpperCase() + modalName.slice(1);
  const modalEl = document.getElementById(modalId);
  if (modalEl) modalEl.classList.remove('hidden');
  if (modalName === 'ajoutProduit') remplirSelectCategories();
}

export function hideModal() {
  const overlay = document.getElementById('modalOverlay'); if (overlay) overlay.classList.add('hidden');
  document.querySelectorAll('[id^="modal"]').forEach(function (m) { m.classList.add('hidden'); });
  ['nomProduit', 'categorieProduit', 'prixProduit', 'prixAchatProduit', 'stockProduit', 'descriptionProduit', 'nomCategorie', 'emojiCategorie'].forEach(function (id) { const el = document.getElementById(id); if (el) el.value = ''; });
  document.querySelectorAll('.emoji-btn').forEach(function (btn) { btn.classList.remove('bg-blue-200', 'border-blue-400'); });
}

export function ouvrirModalEdit(produit) {
  // Remplir le formulaire
  document.getElementById('editNomProduit').value = produit.name;
  document.getElementById('editCategorieProduit').innerHTML = '<option value="">Choisir catégorie</option>';
  appData.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = (c.emoji ? c.emoji + ' ' : '') + c.name;
    if (c.id === produit.category_id) opt.selected = true;
    document.getElementById('editCategorieProduit').appendChild(opt);
  });
  document.getElementById('editPrixAchatProduit').value = produit.priceAchat || produit.price_achat || 0;
  document.getElementById('editPrixProduit').value = produit.price;
  document.getElementById('editStockProduit').value = produit.stock;
  document.getElementById('editDescriptionProduit').value = produit.description || '';

  // Stocker l'ID du produit en cours d'édition
  document.getElementById('modalEditProduit').dataset.id = produit.id;

  // Afficher la modale
  showModal('editProduit');
}

export function showModalCredit() {
  const modalPaiement = document.getElementById("modalPaiement");
  const modalCredit = document.getElementById("modalCredit");

  if (modalPaiement && modalCredit) {
    // Fermer la modale Paiement
    modalPaiement.classList.add("hidden");

    // Ouvrir la modale Crédit
    modalCredit.classList.remove("hidden");

    // ✅ Mettre à jour la date à chaque ouverture
    const dateInput = document.getElementById("creditDueDate");
    if (dateInput) {
      const today = new Date().toISOString().split("T")[0];
      dateInput.value = today;
      dateInput.min = today;
    }
  }
}

export function hideModalCredit() {
  document.getElementById("modalCredit").classList.add("hidden");
  document.getElementById("modalPaiement").classList.remove("hidden");
}

// 👉 Ouvrir le modal remboursement
export function ouvrirModalRemboursement(saleId) {
  console.log("🟣 ouvrirModalRemboursement appelé avec saleId =", saleId);
  const modal = document.getElementById("modalRemboursement");
  document.getElementById("remboursementVenteId").value = saleId;

  modal.classList.remove("hidden");
  modal.style.display = "flex"; // ✅ force affichage en mode flex
}

window.ouvrirModalRemboursement = ouvrirModalRemboursement; // ✅ rendre global

// 👉 Fermer le modal
export function hideModalRemboursement() {
  const modal = document.getElementById("modalRemboursement");
  modal.classList.add("hidden");
  modal.style.display = "none"; // ✅ force fermeture
  document.getElementById("remboursementVenteId").value = "";
}

window.hideModalRemboursement = hideModalRemboursement; // ✅ rendre global

export function showModalById(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}

export function hideModalById(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

export function closePremiumModal() {
  document.getElementById("premiumModal").classList.add("hidden");
  document.getElementById("contactModal").classList.remove("hidden"); // ouvre le 2e modal immédiatement
}

export function closeContactModal() {
  document.getElementById("contactModal").classList.add("hidden");
}

export function closeGuide() {
  document.getElementById("userGuide").style.display = "none";
  // ✅ On mémorise la fermeture
  localStorage.setItem("guideClosed", "true");
}

