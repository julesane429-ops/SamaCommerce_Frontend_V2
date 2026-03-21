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
import { showSection,generateInventairePDF,generateRapportsPDF } from "./utils.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode, modifierVente } from "./ventes.js";

// ------------------- Exposer globalement -------------------
// State / auth
window.logout = logout;
window.appData = appData;
window.getCurrentUserId = getCurrentUserId;

// Rapports
window.afficherRapports = afficherRapports;
window.updateStats = updateStats;
window.afficherStatsCredits = afficherStatsCredits;

// Inventaire
window.afficherInventaire = afficherInventaire;
window.setupSearchInputs = setupSearchInputs;
window.remplirSelectProduitsCredit = remplirSelectProduitsCredit;

// Charts
window.updateCharts = updateCharts;
window.initCreditChart = initCreditChart;

// API
window.authfetch = authfetch;
window.postCategoryServer = postCategoryServer;
window.postProductServer = postProductServer;
window.syncFromServer = syncFromServer;

// Categories
window.selectEmoji = selectEmoji;
window.supprimerCategorie = supprimerCategorie;
window.ajouterCategorie = ajouterCategorie;
window.remplirSelectCategories = remplirSelectCategories;
window.afficherFiltresCategories = afficherFiltresCategories;

// Credits
window.renderCreditsHistory = renderCreditsHistory;
window.marquerCreditPaye = marquerCreditPaye;
window.confirmerRemboursement = confirmerRemboursement;
window.remplirProduitsCredit = remplirProduitsCredit;

// Modal
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

// Notification
window.showNotification = showNotification;
window.customConfirm = customConfirm;

// Premium
window.handleAddProductClick = handleAddProductClick;

// Produits
window.supprimerProduit = supprimerProduit;
window.mettreAJourProduit = mettreAJourProduit;
window.ajouterProduit = ajouterProduit;
window.filtrerProduits = filtrerProduits;
window.modifierStock = modifierStock;

// UI
window.afficherCategories = afficherCategories;
window.afficherProduits = afficherProduits;
window.afficherCategoriesVente = afficherCategoriesVente;
window.afficherProduitsCategorie = afficherProduitsCategorie;
window.verifierStockFaible = verifierStockFaible;
window.afficherCredits = afficherCredits;

// Utils
window.showSection = showSection;
window.generateInventairePDF = generateInventairePDF;
window.generateRapportsPDF = generateRapportsPDF;

// Ventes
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
    console.log("Au chargement - token :", token);
    console.log("Au chargement - rôle :", role);

    if (!token) {
      console.log("Pas de token, redirection vers login.html");
      window.location.replace('login/login.html?expired=1');
    } else if (role === "admin") {
      console.log("Utilisateur admin détecté, redirection vers admin.html");
      window.location.replace('admin/admin.html');
    } else {
      console.log("Utilisateur normal détecté, reste sur index.html");
    }
  } catch (e) {
    console.error("Erreur lors du check initial :", e);
    window.location.replace('login/login.html?expired=1');
  }
})();


// ---------- CONFIG & DATA ----------
// API_BASE can be set to full URL when deployed. To auto-detect hosted API, set a meta tag in the hosting HTML head like:
// <meta name="api-base" content="https://mon-backend.example.com">
const metaApi = document.querySelector('meta[name="api-base"]');
const API_BASE = metaApi ? metaApi.content : ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? '' : ''); // '' -> relative

const defaultData = {
  categories: [
    { id: 1, name: "Habits", emoji: "👕", couleur: "category-habits" },
    { id: 2, name: "Cosmétiques", emoji: "💄", couleur: "category-cosmetiques" },
    { id: 3, name: "Chaussures", emoji: "👠", couleur: "category-chaussures" },
    { id: 4, name: "Accessoires", emoji: "💍", couleur: "category-accessoires" }
  ],
  produits: [], // start empty to prefer server data after first sync
  ventes: [],
  panier: [],
  stats: { ventesJour: 0, chiffreAffaires: 0, paiements: { especes: 0, wave: 0, orange: 0 } }
};

// ---------- localStorage helpers ----------
export function loadAppDataLocal() {
  const raw       = localStorage.getItem('boutique_appData');
  const currentId = localStorage.getItem('userId');

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // Vérifier que le cache appartient bien à l'utilisateur connecté
      // (évite la contamination entre sessions / comptes)
      const cachedUserId = localStorage.getItem('boutique_cached_userId');
      if (cachedUserId && currentId && cachedUserId !== currentId) {
        // Cache d'un autre utilisateur → on l'efface et on repart vide
        localStorage.removeItem('boutique_appData');
        localStorage.removeItem('boutique_cached_userId');
        Object.assign(appData, JSON.parse(JSON.stringify(defaultData)));
      } else {
        Object.assign(appData, parsed);
      }
    } catch (e) {
      Object.assign(appData, JSON.parse(JSON.stringify(defaultData)));
    }
  } else {
    Object.assign(appData, JSON.parse(JSON.stringify(defaultData)));
  }

  // Normaliser les types numériques depuis le cache (peuvent être strings si vieille version)
  appData.produits.forEach(p => {
    if (typeof p.priceAchat === 'undefined') p.priceAchat = parseFloat(p.price_achat) || 0;
    p.price   = parseFloat(p.price)  || 0;
    p.stock   = parseInt(p.stock)    || 0;
    p.priceAchat = parseFloat(p.priceAchat || p.price_achat) || 0;
  });

  if (!localStorage.getItem('boutique_outbox'))
    localStorage.setItem('boutique_outbox', JSON.stringify([]));
}

export function saveAppDataLocal() {
  try {
    // Ne garder que les 200 dernières ventes en cache local pour éviter QuotaExceededError
    const dataToSave = Object.assign({}, appData);
    if (dataToSave.ventes && dataToSave.ventes.length > 200) {
      dataToSave.ventes  = dataToSave.ventes.slice(0, 200);
      dataToSave.credits = dataToSave.ventes.filter(v => {
        const pm = (v.payment_method || '').toLowerCase().trim();
        return pm === 'credit' || pm === 'crédit';
      });
    }
    localStorage.setItem('boutique_appData', JSON.stringify(dataToSave));
    const uid = localStorage.getItem('userId');
    if (uid) localStorage.setItem('boutique_cached_userId', uid);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      // Cache plein → effacer et réessayer avec données minimales
      localStorage.removeItem('boutique_appData');
      try {
        const minimal = { produits: appData.produits, categories: appData.categories,
                          ventes: [], credits: [], panier: [], stats: appData.stats };
        localStorage.setItem('boutique_appData', JSON.stringify(minimal));
      } catch (_) {}
    }
  }
}


// ---------- Outbox / Background retry ----------
export function enqueueOutbox(item) { // item example: {type:'sale', payload: {...}, tries:0, id: Date.now()}
  const q = JSON.parse(localStorage.getItem('boutique_outbox') || '[]'); q.push(item); localStorage.setItem('boutique_outbox', JSON.stringify(q));
}

export async function processOutboxOne() {
  const q = JSON.parse(localStorage.getItem('boutique_outbox') || '[]');
  if (!q.length) return null;
  const item = q[0];
  try {
    let res = null;
    if (item.type === 'sale') res = await postSaleServer(item.payload);
    else if (item.type === 'product') res = await postProductServer(item.payload);
    else if (item.type === 'category') res = await postCategoryServer(item.payload);

    if (res) { // success -> pop
      q.shift(); localStorage.setItem('boutique_outbox', JSON.stringify(q)); saveAppDataLocal();
      return { ok: true, item };
    } else {
      item.tries = (item.tries || 0) + 1;
      if (item.tries > 10) { // drop after many tries
        console.warn('Dropping outbox item after many tries', item);
        q.shift(); localStorage.setItem('boutique_outbox', JSON.stringify(q));
        return { ok: false };
      }
      q[0] = item; localStorage.setItem('boutique_outbox', JSON.stringify(q));
      return { ok: false };
    }
  } catch (err) { console.warn('Outbox process error', err); return { ok: false }; }
}

export async function processOutboxAll() { let did = false; try { while (true) { const r = await processOutboxOne(); if (!r) break; if (r.ok) did = true; else break; } } catch (e) { console.warn(e); } return did; }

// periodic retry
setInterval(() => { if (navigator.onLine) processOutboxAll(); }, 30 * 1000); // try every 30s if online
window.addEventListener('online', () => { console.log('Back online -> retry outbox'); processOutboxAll(); });


export async function updateHeader() {
  if (!localStorage.getItem('authToken')) return;
  try {
    const res = await authfetch(API_BASE + '/auth/me');
    if (res.ok) {
      const user = await res.json();
      document.getElementById("appHeader").textContent = "🏪 " + (user.company_name || "Ma Boutique");
    }
  } catch (err) {
    console.warn("Impossible de récupérer le nom de l’entreprise :", err);
  }
}



// Fonction pour calculer la date +30 jours
export function getExpirationDate() {
  const now = new Date();
  now.setDate(now.getDate() + 30);
  return now.toISOString().split("T")[0]; // format YYYY-MM-DD
}
