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
    // /auth/me — profil de l'utilisateur connecté uniquement (sécurisé)
    const meRes = await authfetch(`${API_BASE}/auth/me`);
    if (!meRes.ok) {
      showNotification("\u274C Impossible de v\u00e9rifier votre compte", "error");
      return;
    }
    const me = await meRes.json();

    // Upgrade en attente
    if (me.upgrade_status === "en attente") {
      showNotification("\u23F3 Votre demande Premium est en cours de validation.", "warning");
      return;
    }

    // Plan payant valide (Starter / Pro / Business / Enterprise)
    const PAID = ['Starter', 'Pro', 'Business', 'Enterprise'];
    const isPaid  = PAID.includes(me.plan) && me.upgrade_status === 'validé';
    const expired = me.expiration && new Date(me.expiration) < new Date();

    if (isPaid && !expired) {
      showModal('ajoutProduit');
      return;
    }

    if (isPaid && expired) {
      showNotification('\u26A0\uFE0F Votre abonnement a expiré. Renouvelez pour continuer.', 'warning');
      showModalById('premiumModal');
      return;
    }

    // Plan Free ou expiré — vérifier quota selon le plan
    const prodRes  = await authfetch(`${API_BASE}/products`);
    const products = prodRes.ok ? await prodRes.json() : [];
    const limit    = window.getPlan?.(me.plan)?.products_limit ?? 5;

    if (limit !== Infinity && products.length >= limit) {
      showModalById('premiumModal');
    } else {
      showModal('ajoutProduit');
    }

  } catch (err) {
    console.error("Erreur handleAddProductClick:", err);
    showNotification("\u274C Impossible d'ajouter le produit", "error");
  }
}

// Soumission du formulaire Upgrade
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('upgradeForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const phone          = document.getElementById('phone')?.value.trim();
    const payment_method = document.getElementById('payment_method')?.value.trim();
    const amount         = document.getElementById('amount')?.value.trim();

    if (!phone || !payment_method || !amount) {
      showNotification('\u274C Tous les champs sont requis.', 'error');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = '\u23F3 Envoi en cours\u2026'; }

    try {
      // Récupérer le plan sélectionné depuis le formulaire
      const plan = document.getElementById('selectedPlan')?.value || 'Pro';

      const res = await authfetch(`${API_BASE}/auth/upgrade`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, payment_method, amount, plan })
      });

      const data = await res.json();

      if (!res.ok) {
        showNotification('\u274C ' + (data.error || "Impossible d'envoyer la demande."), 'error');
        return;
      }

      showNotification('\u2705 Demande Premium envoy\u00e9e ! Validation sous 24h.', 'success');
      hideModalById?.('contactModal');
      setTimeout(() => window.location.reload(), 1200);

    } catch (err) {
      console.error('\u274C Erreur upgrade:', err);
      showNotification('\u274C Erreur r\u00e9seau. Veuillez r\u00e9essayer.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Envoyer ma demande'; }
    }
  });
});
