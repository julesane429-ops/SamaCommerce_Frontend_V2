import { appData,chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits  } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { updateCharts, renderVentesChart, initCreditChart } from "./charts.js";
import { authfetch, postCategoryServer, postProductServer, syncFromServer } from "./api.js";
import { getCurrentUserId, logout } from "./auth.js";
import { selectEmoji, supprimerCategorie, ajouterCategorie,remplirSelectCategories, afficherFiltresCategories } from "./categories.js";
import { renderCreditsHistory,marquerCreditPaye, confirmerRemboursement, remplirProduitsCredit } from "./credits.js";
import { showModal, hideModal, ouvrirModalEdit, showModalCredit, hideModalCredit, ouvrirModalRemboursement, hideModalRemboursement, showModalById, hideModalById, closePremiumModal, closeContactModal, closeGuide, fermerModal } from "./modal.js";
import { showNotification, customConfirm,  } from "./notification.js";
import { handleAddProductClick } from "./premium.js";
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente,afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";
import { showSection } from "./utils.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode, modifierVente  } from "./ventes.js";




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
  const raw = localStorage.getItem('boutique_appData');
  if (raw) {
    try { appData = JSON.parse(raw); }
    catch (e) { appData = JSON.parse(JSON.stringify(defaultData)); }
  } else appData = JSON.parse(JSON.stringify(defaultData));
  appData.produits.forEach(p => { if (typeof p.priceAchat === 'undefined') p.priceAchat = p.price_achat || 0; });
  // ensure outbox exists
  if (!localStorage.getItem('boutique_outbox')) localStorage.setItem('boutique_outbox', JSON.stringify([]));
}

export function saveAppDataLocal() { localStorage.setItem('boutique_appData', JSON.stringify(appData)); }


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





















