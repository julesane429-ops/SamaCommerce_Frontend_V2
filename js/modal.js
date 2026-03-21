import { appData, chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { updateCharts, initCreditChart } from "./charts.js";
import { authfetch, postCategoryServer, postProductServer, syncFromServer } from "./api.js";
import { getCurrentUserId, logout } from "./auth.js";
import { selectEmoji, supprimerCategorie, ajouterCategorie, remplirSelectCategories, afficherFiltresCategories } from "./categories.js";
import { renderCreditsHistory, marquerCreditPaye, confirmerRemboursement, remplirProduitsCredit } from "./credits.js";
import { loadAppDataLocal, saveAppDataLocal, enqueueOutbox, processOutboxOne, processOutboxAll, updateHeader, getExpirationDate } from "./index.js";
import { showNotification, customConfirm } from "./notification.js";
import { handleAddProductClick } from "./premium.js";
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente, afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";
import { showSection } from "./utils.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode, modifierVente } from "./ventes.js";

// ── Ouvrir une modale par nom ──────────────────────────────────────────────
export function showModal(modalName) {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('hidden');
  const modalId = 'modal' + modalName.charAt(0).toUpperCase() + modalName.slice(1);
  const modalEl = document.getElementById(modalId);
  if (modalEl) modalEl.classList.remove('hidden');
  if (modalName === 'ajoutProduit') remplirSelectCategories();
}

// ── Fermer toutes les modales ──────────────────────────────────────────────
export function hideModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.add('hidden');
  document.querySelectorAll('[id^="modal"]').forEach(m => m.classList.add('hidden'));

  // Réinitialiser les champs du formulaire ajout produit
  [
    'nomProduit', 'categorieProduit', 'prixProduit', 'prixAchatProduit',
    'stockProduit', 'descriptionProduit', 'nomCategorie', 'emojiCategorie',
    'prixGrosProduit', 'quantiteGrosProduit'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.classList.remove('bg-blue-200', 'border-blue-400');
  });
}

// ── Ouvrir la modale d'édition produit ─────────────────────────────────────
export function ouvrirModalEdit(produit) {
  // Champs de base
  document.getElementById('editNomProduit').value       = produit.name;
  document.getElementById('editPrixAchatProduit').value = produit.priceAchat || produit.price_achat || 0;
  document.getElementById('editPrixProduit').value      = produit.price;
  document.getElementById('editStockProduit').value     = produit.stock;
  document.getElementById('editDescriptionProduit').value = produit.description || '';

  // Remplir le select catégorie
  document.getElementById('editCategorieProduit').innerHTML = '<option value="">Choisir catégorie</option>';
  appData.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value       = c.id;
    opt.textContent = (c.emoji ? c.emoji + ' ' : '') + c.name;
    if (c.id === produit.category_id) opt.selected = true;
    document.getElementById('editCategorieProduit').appendChild(opt);
  });

  // ✅ Champs gros — pré-remplis si le produit a un tarif gros configuré
  const elPrixGros = document.getElementById('editPrixGrosProduit');
  const elQteGros  = document.getElementById('editQuantiteGrosProduit');
  if (elPrixGros)  elPrixGros.value  = produit.price_gros    != null ? produit.price_gros    : '';
  if (elQteGros)   elQteGros.value   = produit.quantite_gros != null ? produit.quantite_gros : '';

  // Stocker l'ID du produit en cours d'édition
  document.getElementById('modalEditProduit').dataset.id = produit.id;

  showModal('editProduit');
}

// ── Modal crédit ───────────────────────────────────────────────────────────
export function showModalCredit() {
  const modalPaiement = document.getElementById("modalPaiement");
  const modalCredit   = document.getElementById("modalCredit");

  if (modalPaiement && modalCredit) {
    modalPaiement.classList.add("hidden");
    modalCredit.classList.remove("hidden");

    const dateInput = document.getElementById("creditDueDate");
    if (dateInput) {
      const today    = new Date().toISOString().split("T")[0];
      dateInput.value = today;
      dateInput.min   = today;
    }
  }
}

export function hideModalCredit() {
  document.getElementById("modalCredit").classList.add("hidden");
  document.getElementById("modalPaiement").classList.remove("hidden");
}

// ── Modal remboursement ────────────────────────────────────────────────────
export function ouvrirModalRemboursement(saleId) {
  const modal = document.getElementById("modalRemboursement");
  document.getElementById("remboursementVenteId").value = saleId;
  modal.classList.remove("hidden");
  modal.style.display = "flex";
}
window.ouvrirModalRemboursement = ouvrirModalRemboursement;

export function hideModalRemboursement() {
  const modal = document.getElementById("modalRemboursement");
  modal.classList.add("hidden");
  modal.style.display = "none";
  document.getElementById("remboursementVenteId").value = "";
}
window.hideModalRemboursement = hideModalRemboursement;

// ── Helpers modales génériques ─────────────────────────────────────────────
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
  document.getElementById("contactModal").classList.remove("hidden");
}

export function closeContactModal() {
  document.getElementById("contactModal").classList.add("hidden");
}

export function closeGuide() {
  document.getElementById("userGuide").style.display = "none";
  localStorage.setItem("guideClosed", "true");
}
window.closeGuide = closeGuide;

export function ouvrirModal(vente) {
  document.getElementById("venteId").value       = vente.id;
  document.getElementById("venteQuantite").value = vente.quantity;
  document.getElementById("ventePaiement").value = vente.payment_method;
  document.getElementById("modalModifierVente").classList.remove("hidden");
  document.getElementById("modalModifierVente").classList.add("flex");
}

export function fermerModal() {
  document.getElementById("modalModifierVente").classList.add("hidden");
  document.getElementById("modalModifierVente").classList.remove("flex");
}
