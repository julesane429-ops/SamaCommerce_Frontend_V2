// utils.js
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



// ---------- Navigation & UI helpers (structure kept) ----------

export function showSection(section) {
  const sections = ['menu', 'vente', 'stock', 'categories', 'rapports', 'inventaire', 'credits'];
  sections.forEach(function (s) { const el = document.getElementById(s + 'Section'); if (el) el.classList.add('hidden'); });
  const target = document.getElementById(section + 'Section'); if (target) target.classList.remove('hidden');
  const backBtn = document.getElementById('backBtn'); if (backBtn) backBtn.style.display = (section === 'menu') ? 'none' : 'block';
  currentSection = section;
  if (section === 'vente') { afficherCategoriesVente(); afficherPanier(); }
  else if (section === 'stock') { afficherProduits(); afficherFiltresCategories(); }
  else if (section === 'categories') { afficherCategories(); }
  else if (section === 'rapports') { afficherRapports(); }
  else if (section === 'inventaire') { afficherInventaire(); }
  else if (section === 'menu') { updateStats(); verifierStockFaible(); }
  else if (section === 'credits') {
    afficherCredits(); // ta fonction qui remplit le tableau
    remplirSelectProduitsCredit();
  }

}

