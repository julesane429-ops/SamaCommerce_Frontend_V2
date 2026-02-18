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
import { handleAddProductClick } from "./premium.js";
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente,afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";
import { showSection } from "./utils.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, fermerModal, modifierVente, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode } from "./ventes.js";



export function showNotification(message, type = "info") {
  // Créer le conteneur si non existant
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  // Créer le toast
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  // Ajouter le toast au conteneur
  container.appendChild(toast);

  // Retirer après 4s
  setTimeout(() => {
    toast.remove();
  }, 4000);
}
// ✅ Remplace confirm par une version moderne
export function customConfirm(message) {
  return new Promise((resolve) => {
    // Créer l’overlay
    const overlay = document.createElement("div");
    overlay.id = "custom-confirm-overlay";

    // Contenu (avec backticks !)
    overlay.innerHTML = `
      <div class="custom-confirm-box">
        <p>${message}</p>
        <div class="custom-confirm-actions">
          <button class="custom-confirm-btn custom-confirm-yes">Confirmer</button>
          <button class="custom-confirm-btn custom-confirm-no">Annuler</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Boutons
    overlay.querySelector(".custom-confirm-yes").addEventListener("click", () => {
      resolve(true);
      overlay.remove();
    });
    overlay.querySelector(".custom-confirm-no").addEventListener("click", () => {
      resolve(false);
      overlay.remove();
    });
  });
}

// ✅ Polyfill : remplacer confirm natif
window.confirm = function (message) {
  console.log("⚡ confirm appelé avec :", message);
  return customConfirm(message);
};
