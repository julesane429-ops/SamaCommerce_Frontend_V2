// premium.js
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
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente,afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";
import { showSection } from "./utils.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode, modifierVente  } from "./ventes.js";



export async function handleAddProductClick() {
  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      showNotification("❌ Vous devez être connecté pour ajouter un produit", "error");
      return;
    }

    const userId = getCurrentUserId();
    if (!userId) {
      showNotification("❌ Utilisateur introuvable", "error");
      return;
    }

    // 🔎 Récupérer les infos de l'utilisateur connecté via /auth/me
    const userRes = await authfetch(`${API_BASE}/auth/me`);

    if (!userRes.ok) throw new Error("Erreur /auth/me " + userRes.status);

    const currentUser = await userRes.json();

    if (!currentUser) {
      showNotification("❌ Utilisateur introuvable", "error");
      return;
    }


    // 🚫 Cas 1 : Upgrade en attente = blocage total
    if (currentUser.upgrade_status === "en attente") {
      showNotification("⏳ Votre demande Premium est en attente de validation. Vous ne pouvez pas ajouter de produit pour le moment.", "warning");
      return;
    }

    // 🔄 Utiliser les produits déjà en mémoire (évite un appel réseau supplémentaire)
    const userProducts = appData.produits || [];

    // ✅ Cas 2 : Premium validé
    if (currentUser.plan === "Premium" && currentUser.upgrade_status === "validé") {
      showModal("ajoutProduit"); // pas de limite
      return;
    }

    // ✅ Cas 3 : Free ou rejeté => limite 5 produits
    if (currentUser.plan === "Free" || currentUser.upgrade_status === "rejeté") {
      if (userProducts.length >= 5) {
        showModalById("premiumModal"); // proposer upgrade
      } else {
        showModal("ajoutProduit"); // peut ajouter
      }
      return;
    }

    // 🔒 Sécurité : fallback
    showModal("ajoutProduit");

  } catch (err) {
    console.error("Erreur handleAddProductClick:", err);
    showNotification("❌ Impossible d’ajouter le produit", "error");
  }
}

// Soumission du formulaire Upgrade
document.getElementById("upgradeForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const phone = document.getElementById("phone").value.trim();
  const payment_method = document.getElementById("payment_method").value.trim();
  const amount = document.getElementById("amount").value.trim();
  const expiration = document.getElementById("expiration").value;

  if (!phone || !payment_method || !amount || !expiration) {
    showNotification("❌ Tous les champs sont requis.", "error");
    return;
  }

  try {
    const token = localStorage.getItem("authToken");

    const res = await fetch("https://ma-boutique-backend-3.onrender.com/auth/upgrade", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        phone,
        payment_method,
        amount,
        expiration,
        upgrade_status: "en_attente"
      })
    });

    if (!res.ok) {
      let errorMsg = "Impossible d’upgrader.";
      try {
        const data = await res.json();
        if (data.error) errorMsg = data.error;
      } catch (err) {
        errorMsg = await res.text();
      }
      showNotification("❌ Erreur : " + errorMsg, "error");
      return;
    }

    const data = await res.json();

    showNotification("✅ Votre demande Premium est envoyée et en attente de validation par un administrateur !", "success");
    closeContactModal();
    updateHeader?.();
    window.location.reload();

  } catch (err) {
    console.error("❌ Erreur upgrade:", err);
    showNotification("❌ Erreur réseau. Veuillez réessayer.", "error");
  }
});
