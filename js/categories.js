import { appData,chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits  } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { updateCharts, initCreditChart } from "./charts.js";
import { authfetch, postCategoryServer, postProductServer, syncFromServer } from "./api.js";
import { getCurrentUserId, logout } from "./auth.js";
import { renderCreditsHistory,marquerCreditPaye, confirmerRemboursement, remplirProduitsCredit } from "./credits.js";
import { loadAppDataLocal, saveAppDataLocal, enqueueOutbox, processOutboxOne, processOutboxAll, updateHeader, getExpirationDate } from "./index.js";
import { showModal, hideModal, ouvrirModalEdit, showModalCredit, hideModalCredit, ouvrirModalRemboursement, hideModalRemboursement, showModalById, hideModalById, closePremiumModal, closeContactModal, closeGuide, fermerModal } from "./modal.js";
import { showNotification, customConfirm,  } from "./notification.js";
import { handleAddProductClick } from "./premium.js";
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente,afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";
import { showSection } from "./utils.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode, modifierVente  } from "./ventes.js";




// ---------- Catégories UI ----------
export function selectEmoji(emoji) { var el = document.getElementById('emojiCategorie'); if (el) el.value = emoji; document.querySelectorAll('.emoji-btn').forEach(function (btn) { btn.classList.remove('bg-blue-200', 'border-blue-400'); }); if (window.event && window.event.target) window.event.target.classList.add('bg-blue-200', 'border-blue-400'); }

// ✅ Supprimer une catégorie
export async function supprimerCategorie(id) {
  const ok = await confirm('❓ Supprimer cette catégorie ?');
  if (!ok) {
    showNotification("❌ Suppression annulée", "warning");
    return;
  }

  try {
    const res = await authfetch(API_BASE + '/categories/' + id, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      // 🔴 Erreur renvoyée par le backend
      showNotification('❌ ' + (data.error || 'Erreur lors de la suppression de la catégorie'), "error");
      return;
    }

    // ✅ Suppression réussie
    showNotification('✅ ' + (data.message || 'Catégorie supprimée avec succès'), "success");

    // Retirer de la liste locale
    appData.categories = appData.categories.filter(c => c.id !== id);
    afficherCategories();
    saveAppDataLocal();

  } catch (err) {
    console.error('Erreur réseau lors de la suppression de catégorie', err);
    showNotification('❌ Impossible de contacter le serveur.', "error");
  }
}

export async function ajouterCategorie() {
  if (!appData) return;

  const name = (document.getElementById('nomCategorie') || {}).value;
  const emoji = (document.getElementById('emojiCategorie') || {}).value || '🏷️';

  if (name) {
    const newCatLocal = { id: Date.now(), name: name, emoji: emoji, couleur: 'category-habits' };
    appData.categories.push(newCatLocal);

    if (currentSection === 'categories') afficherCategories();
    hideModal();
    saveAppDataLocal();

    const created = await postCategoryServer({ name: name, emoji: emoji });

    if (created) {
      const idx = appData.categories.findIndex(c => c.id === newCatLocal.id);
      if (idx >= 0) appData.categories[idx] = created;
      saveAppDataLocal();
      syncFromServer();
      showNotification('✅ Catégorie ajoutée (serveur).', "success");
      await syncFromServer();
      afficherCategories();
      afficherCategoriesVente();
      afficherProduits();

    } else {
      enqueueOutbox({ type: 'category', payload: { name: name }, tries: 0, id: Date.now() });
      showNotification('✅ Catégorie ajoutée localement et mise en file d\'envoi.', "info");
    }
  } else {
    showNotification('❌ Saisir un name', "error");
  }
}

// ---------- Produits / catégories gestion (avec POST) ----------
export function remplirSelectCategories() {
  const select = document.getElementById('categorieProduit');
  if (!select) return;
  select.innerHTML = '<option value="">Choisir catégorie</option>';
  appData.categories.forEach(function (categ) {
    var opt = document.createElement('option');
    opt.value = parseInt(categ.id);
    opt.textContent = (categ.emoji ? categ.emoji + ' ' : '') + categ.name;
    select.appendChild(opt);
  });
}

export function afficherFiltresCategories() {
  const container = document.getElementById('filtreCategories'); if (!container) return; container.innerHTML = ''; var btnAll = document.createElement('button'); btnAll.className = 'filtre-btn bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap'; btnAll.textContent = 'Tous'; btnAll.addEventListener('click', function () { filtrerProduits('tous'); }); container.appendChild(btnAll);
  appData.categories.forEach(function (c) { var button = document.createElement('button'); button.className = 'filtre-btn bg-gray-200 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap'; button.textContent = (c.emoji ? c.emoji + ' ' : '') + c.name; button.addEventListener('click', function () { filtrerProduits(c.id); }); container.appendChild(button); });
}
