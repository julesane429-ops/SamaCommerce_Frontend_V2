// credits.js
import { appData,chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits  } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { updateCharts, renderVentesChart, initCreditChart } from "./charts.js";
import { authfetch, postCategoryServer, postProductServer, syncFromServer } from "./api.js";
import { getCurrentUserId, logout } from "./auth.js";
import { selectEmoji, supprimerCategorie, ajouterCategorie,remplirSelectCategories, afficherFiltresCategories } from "./categories.js";
import { loadAppDataLocal, saveAppDataLocal, enqueueOutbox, processOutboxOne, processOutboxAll, updateHeader, getExpirationDate } from "./index.js";
import { showModal, hideModal, ouvrirModalEdit, showModalCredit, hideModalCredit, ouvrirModalRemboursement, hideModalRemboursement, showModalById, hideModalById, closePremiumModal, closeContactModal, closeGuide, fermerModal, modifierVente } from "./modal.js";
import { showNotification, customConfirm,  } from "./notification.js";
import { handleAddProductClick } from "./premium.js";
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente,afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";
import { showSection } from "./utils.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode } from "./ventes.js";



// Afficher l’historique des crédits

export function renderCreditsHistory() {
  const tbody = document.getElementById("creditsHistoryBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!appData.credits?.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-500 py-4">Aucun crédit enregistré</td></tr>`;
    return;
  }

  appData.credits.forEach(c => {
    // ✅ Chercher le produit lié à ce crédit
    const prod = appData.produits?.find(p => p.id === c.product_id);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="p-2 border">${c.client_name || '-'}</td>
      <td class="p-2 border">${c.client_phone || '-'}</td>
      <td class="p-2 border">${prod ? prod.name : 'Inconnu'}</td>
      <td class="p-2 border">${c.total?.toLocaleString() || 0} F</td>
      <td class="p-2 border">${c.due_date ? new Date(c.due_date).toLocaleDateString() : '-'}</td>
      <td class="p-2 border">
        ${c.paid
        ? '<span class="text-green-600 font-bold">✅ Payé</span>'
        : '<span class="text-red-600 font-bold">❌ Non payé</span>'}
      </td>
      <td class="p-2 border text-center">
        ${c.paid ? '' : `
          <button class="bg-green-500 text-white px-2 py-1 rounded text-xs" 
            onclick="marquerRembourse(${c.id})">💰 Marquer comme payé</button>
        `}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ✅ Marquer un crédit comme payé

export async function marquerCreditPaye(id) {
  const ok = await confirm("❓ Confirmer que ce crédit a été payé ?");
  if (!ok) {
    showNotification("❌ Action annulée", "warning");
    return;
  }

  try {
    const res = await authfetch(`${API_BASE}/sales/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid: true })
    });

    if (!res.ok) {
      const errMsg = await res.text();
      showNotification("❌ Erreur lors de la mise à jour du crédit : " + errMsg, "error");
      return;
    }

    showNotification("✅ Crédit marqué comme payé.", "success");
    await syncFromServer();
    afficherStatsCredits(); // rafraîchit uniquement le tableau crédits

  } catch (e) {
    console.error("Erreur réseau marquerCreditPaye:", e);
    showNotification("❌ Impossible de contacter le serveur.", "error");
  }
}

// 👉 Confirmer le remboursement avec un mode de paiement choisi

export async function confirmerRemboursement(method) {
  const id = document.getElementById("remboursementVenteId").value;
  console.log("🟢 confirmerRemboursement avec ID =", id, "méthode =", method); // ✅ Debug
  if (!id) return;

  try {
    const res = await authfetch(API_BASE + "/sales/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid: true, repayment_method: method })
    });

    if (!res.ok) {
      const errorMsg = await res.text();
      console.error("Erreur remboursement:", errorMsg);
      showNotification("❌ Erreur lors du remboursement", "error");
      return;
    }

    showNotification("✅ Crédit remboursé avec succès !", "success");
    hideModalRemboursement();

    // 🔄 Recharger les données à jour
    await syncFromServer();
    afficherCredits();
    afficherRapports();

  } catch (err) {
    console.error("Erreur confirmerRemboursement:", err);
    showNotification("❌ Erreur réseau lors du remboursement", "error");
  }
}

window.confirmerRemboursement = confirmerRemboursement; // ✅ rendre global

// Remplit la liste des produits dans le formulaire crédit
export function remplirProduitsCredit() {
  const select = document.getElementById("creditProduct");
  if (!select) return;
  select.innerHTML = "";
  (appData.produits || []).forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.price} F)`;
    select.appendChild(opt);
  });
}

