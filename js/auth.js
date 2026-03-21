import { appData,chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits  } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { updateCharts, initCreditChart } from "./charts.js";
import { authfetch, postCategoryServer, postProductServer, syncFromServer } from "./api.js";
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




export function getCurrentUserId() {
    const id = localStorage.getItem("userId");
    return id ? parseInt(id, 10) : null;
}
export function logout() {
    // Nettoyer toutes les clés de session (employé + propriétaire)
    const KEYS_TO_CLEAR = [
        'authToken', 'userRole', 'userId',
        'inviteBoutiqueId', 'inviteBoutiqueName', 'employeeRole',
        'sc_refresh_token', 'pendingUserId', 'pendingInvite',
        'boutique_appData', 'boutique_cached_userId', 'boutique_outbox'
    ];
    KEYS_TO_CLEAR.forEach(k => localStorage.removeItem(k));

    // Demander au Service Worker de vider le cache pages
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
    }

    window.location.replace('/login/login.html');
}
