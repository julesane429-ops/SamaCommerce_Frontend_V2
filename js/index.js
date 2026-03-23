// ------------------- Importations -------------------
import { appData, chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits } from "./state.js";

import { afficherRapports, updateStats, afficherStatsCredits } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { updateCharts, initCreditChart } from "./charts.js";
import { authfetch, postCategoryServer, postProductServer, syncFromServer } from "./api.js";
import { getCurrentUserId, logout } from "./auth.js";
import { selectEmoji, supprimerCategorie, ajouterCategorie, remplirSelectCategories, afficherFiltresCategories } from "./categories.js";
import { renderCreditsHistory, marquerCreditPaye, confirmerRemboursement, remplirProduitsCredit } from "./credits.js";
import { showModal, hideModal, ouvrirModalEdit, showModalCredit, hideModalCredit, ouvrirModalRemboursement, hideModalRemboursement, showModalById, hideModalById, closePremiumModal, closeContactModal, closeGuide, fermerModal } from "./modal.js";
import { showNotification, customConfirm } from "./notification.js";
import { handleAddProductClick } from "./premium.js";
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente, afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";
import { showSection, generateInventairePDF, generateRapportsPDF } from "./utils.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode, modifierVente } from "./ventes.js";

// ------------------- Exposer globalement -------------------
window.logout = logout;
window.appData = appData;
window.getCurrentUserId = getCurrentUserId;

window.afficherRapports = afficherRapports;
window.updateStats = updateStats;
window.afficherStatsCredits = afficherStatsCredits;

window.afficherInventaire = afficherInventaire;
window.setupSearchInputs = setupSearchInputs;
window.remplirSelectProduitsCredit = remplirSelectProduitsCredit;

window.updateCharts = updateCharts;
window.initCreditChart = initCreditChart;

window.authfetch = authfetch;
window.postCategoryServer = postCategoryServer;
window.postProductServer = postProductServer;
window.syncFromServer = syncFromServer;

window.selectEmoji = selectEmoji;
window.supprimerCategorie = supprimerCategorie;
window.ajouterCategorie = ajouterCategorie;
window.remplirSelectCategories = remplirSelectCategories;
window.afficherFiltresCategories = afficherFiltresCategories;

window.renderCreditsHistory = renderCreditsHistory;
window.marquerCreditPaye = marquerCreditPaye;
window.confirmerRemboursement = confirmerRemboursement;
window.remplirProduitsCredit = remplirProduitsCredit;

window.showModal = showModal;
window.hideModal = hideModal;
window.ouvrirModalEdit = ouvrirModalEdit;
window.showModalCredit = showModalCredit;
window.hideModalCredit = hideModalCredit;
window.ouvrirModalRemboursement = ouvrirModalRemboursement;
window.hideModalRemboursement = hideModalRemboursement;
window.showModalById = showModalById;
window.hideModalById = hideModalById;
window.closePremiumModal = closePremiumModal;
window.closeContactModal = closeContactModal;
window.closeGuide = closeGuide;
window.fermerModal = fermerModal;

window.showNotification = showNotification;
window.customConfirm = customConfirm;

window.handleAddProductClick = handleAddProductClick;

window.supprimerProduit = supprimerProduit;
window.mettreAJourProduit = mettreAJourProduit;
window.ajouterProduit = ajouterProduit;
window.filtrerProduits = filtrerProduits;
window.modifierStock = modifierStock;

window.afficherCategories = afficherCategories;
window.afficherProduits = afficherProduits;
window.afficherCategoriesVente = afficherCategoriesVente;
window.afficherProduitsCategorie = afficherProduitsCategorie;
window.verifierStockFaible = verifierStockFaible;
window.afficherCredits = afficherCredits;

window.showSection = showSection;
window.generateInventairePDF = generateInventairePDF;
window.generateRapportsPDF = generateRapportsPDF;

window.annulerVente = annulerVente;
window.renderSalesHistory = renderSalesHistory;
window.finaliserVenteCredit = finaliserVenteCredit;
window.ajouterAuPanier = ajouterAuPanier;
window.afficherPanier = afficherPanier;
window.modifierQuantitePanier = modifierQuantitePanier;
window.finaliserVente = finaliserVente;
window.tryRenderSalesHistory = tryRenderSalesHistory;
window.ouvrirModal = ouvrirModal;
window.marquerRembourse = marquerRembourse;
window.purgeSalesHistoryClones = purgeSalesHistoryClones;
window.filtrerVentesParPeriode = filtrerVentesParPeriode;
window.modifierVente = modifierVente;


(function () {
  try {
    const token = localStorage.getItem('authToken');
    const role = localStorage.getItem('userRole')?.toLowerCase();
    if (!token) {
      window.location.replace('login/login.html?expired=1');
    } else if (role === "admin") {
      window.location.replace('admin/admin.html');
    }
  } catch (e) {
    console.error("Erreur lors du check initial :", e);
    window.location.replace('login/login.html?expired=1');
  }
})();


// ---------- CONFIG & DATA ----------
const metaApi = document.querySelector('meta[name="api-base"]');
const API_BASE = metaApi ? metaApi.content : '';

const defaultData = {
  categories: [
    { id: 1, name: "Habits",      emoji: "👕", couleur: "category-habits" },
    { id: 2, name: "Cosmétiques", emoji: "💄", couleur: "category-cosmetiques" },
    { id: 3, name: "Chaussures",  emoji: "👠", couleur: "category-chaussures" },
    { id: 4, name: "Accessoires", emoji: "💍", couleur: "category-accessoires" },
  ],
  produits: [],
  ventes:   [],
  panier:   [],
  stats: { ventesJour: 0, chiffreAffaires: 0, paiements: { especes: 0, wave: 0, orange: 0 } },
};

// ══════════════════════════════════════════════════════
// CACHE localStorage — clé par utilisateur ET par boutique
// Chaque boutique a son propre cache → plus de mélange de données
// ══════════════════════════════════════════════════════
function _cacheKey(suffix) {
  const uid = localStorage.getItem('userId') || 'u';
  const bid = localStorage.getItem('sc_active_boutique') || '0';
  return `sc_cache_${uid}_b${bid}_${suffix}`;
}

// Migration unique depuis les anciennes clés globales (boutique_appData, etc.)
// S'exécute une seule fois, puis nettoie les anciennes clés
function _migrateLegacyCache() {
  if (localStorage.getItem('_sc_cache_migrated')) return;

  const uid = localStorage.getItem('userId');
  if (!uid) return; // pas encore connecté

  const oldData  = localStorage.getItem('boutique_appData');
  const oldUid   = localStorage.getItem('boutique_cached_userId');
  const oldBox   = localStorage.getItem('boutique_outbox');

  if (oldData && oldUid === uid) {
    // Migrer vers la nouvelle clé (boutique 0 = inconnue au moment de la migration)
    const migratedKey = `sc_cache_${uid}_b0_appData`;
    if (!localStorage.getItem(migratedKey)) {
      localStorage.setItem(migratedKey, oldData);
    }
  }
  if (oldBox) {
    const migratedBox = `sc_cache_${uid}_b0_outbox`;
    if (!localStorage.getItem(migratedBox)) {
      localStorage.setItem(migratedBox, oldBox);
    }
  }

  // Nettoyer les anciennes clés
  localStorage.removeItem('boutique_appData');
  localStorage.removeItem('boutique_cached_userId');
  localStorage.removeItem('boutique_outbox');
  localStorage.setItem('_sc_cache_migrated', '1');
}

// ---------- localStorage helpers ----------
export function loadAppDataLocal() {
  _migrateLegacyCache();

  const key = _cacheKey('appData');
  const raw = localStorage.getItem(key);

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      Object.assign(appData, parsed);
    } catch (e) {
      Object.assign(appData, JSON.parse(JSON.stringify(defaultData)));
    }
  } else {
    Object.assign(appData, JSON.parse(JSON.stringify(defaultData)));
  }

  // Normaliser les types numériques depuis le cache
  appData.produits.forEach(p => {
    if (typeof p.priceAchat === 'undefined') p.priceAchat = parseFloat(p.price_achat) || 0;
    p.price      = parseFloat(p.price)    || 0;
    p.stock      = parseInt(p.stock)      || 0;
    p.priceAchat = parseFloat(p.priceAchat || p.price_achat) || 0;
  });

  const outboxKey = _cacheKey('outbox');
  if (!localStorage.getItem(outboxKey))
    localStorage.setItem(outboxKey, JSON.stringify([]));
}

export function saveAppDataLocal() {
  try {
    const dataToSave = Object.assign({}, appData);

    // Retirer les ventes optimistic avant de sauvegarder
    if (dataToSave.ventes) {
      dataToSave.ventes = dataToSave.ventes.filter(v => !v._optimistic);
    }

    // Ne garder que les 200 dernières ventes pour éviter QuotaExceededError
    if (dataToSave.ventes && dataToSave.ventes.length > 200) {
      dataToSave.ventes  = dataToSave.ventes.slice(0, 200);
      dataToSave.credits = dataToSave.ventes.filter(v => {
        const pm = (v.payment_method || '').toLowerCase().trim();
        return pm === 'credit' || pm === 'crédit';
      });
    }

    localStorage.setItem(_cacheKey('appData'), JSON.stringify(dataToSave));

  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      localStorage.removeItem(_cacheKey('appData'));
      try {
        const minimal = {
          produits: appData.produits, categories: appData.categories,
          ventes: [], credits: [], panier: [], stats: appData.stats,
        };
        localStorage.setItem(_cacheKey('appData'), JSON.stringify(minimal));
      } catch (_) {}
    }
  }
}


// ---------- Outbox / Background retry ----------
export function enqueueOutbox(item) {
  const key = _cacheKey('outbox');
  const q = JSON.parse(localStorage.getItem(key) || '[]');
  q.push(item);
  localStorage.setItem(key, JSON.stringify(q));
}

export async function processOutboxOne() {
  const key = _cacheKey('outbox');
  const q = JSON.parse(localStorage.getItem(key) || '[]');
  if (!q.length) return null;

  const item = q[0];
  try {
    let res = null;
    if      (item.type === 'sale')     res = await window.postSaleServer?.(item.payload);
    else if (item.type === 'product')  res = await postProductServer(item.payload);
    else if (item.type === 'category') res = await postCategoryServer(item.payload);

    if (res) {
      q.shift();
      localStorage.setItem(key, JSON.stringify(q));
      saveAppDataLocal();
      return { ok: true, item };
    } else {
      item.tries = (item.tries || 0) + 1;
      if (item.tries > 10) {
        console.warn('Dropping outbox item after many tries', item);
        q.shift();
        localStorage.setItem(key, JSON.stringify(q));
        return { ok: false };
      }
      q[0] = item;
      localStorage.setItem(key, JSON.stringify(q));
      return { ok: false };
    }
  } catch (err) {
    console.warn('Outbox process error', err);
    return { ok: false };
  }
}

export async function processOutboxAll() {
  let did = false;
  try {
    while (true) {
      const r = await processOutboxOne();
      if (!r) break;
      if (r.ok) did = true;
      else break;
    }
  } catch (e) { console.warn(e); }
  return did;
}

// Retry périodique
setInterval(() => { if (navigator.onLine) processOutboxAll(); }, 30 * 1000);
window.addEventListener('online', () => {
  console.log('Back online → retry outbox');
  processOutboxAll();
});

// Vider le cache de l'ancienne boutique quand on switch
// (pour éviter la fraction de seconde où l'ancien cache s'affiche)
window.addEventListener('boutique:changed', () => {
  // loadAppDataLocal() sera rappelé par syncFromServer → pas besoin de reset manuel
  // On vide juste le panier pour éviter la confusion entre boutiques
  if (appData.panier?.length) {
    appData.panier = [];
    saveAppDataLocal();
  }
});


export async function updateHeader() {
  if (!localStorage.getItem('authToken')) return;
  try {
    const res = await authfetch(API_BASE + '/auth/me');
    if (res.ok) {
      const user = await res.json();
      const activeName = window._activeBoutique?.name;
      const displayName = activeName || user.company_name || 'Ma Boutique';
      const el = document.getElementById('appHeader');
      if (el) el.textContent = '🏪 ' + displayName;
    }
  } catch (err) {
    console.warn("Impossible de récupérer le nom de l'entreprise :", err);
  }
}

export function getExpirationDate() {
  const now = new Date();
  now.setDate(now.getDate() + 30);
  return now.toISOString().split('T')[0];
}
