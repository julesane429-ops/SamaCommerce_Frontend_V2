import { appData, chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { updateCharts, initCreditChart } from "./charts.js";
import { getCurrentUserId, logout } from "./auth.js";
import { selectEmoji, supprimerCategorie, ajouterCategorie, remplirSelectCategories, afficherFiltresCategories } from "./categories.js";
import { renderCreditsHistory, marquerCreditPaye, confirmerRemboursement, remplirProduitsCredit } from "./credits.js";
import { loadAppDataLocal, saveAppDataLocal, enqueueOutbox, processOutboxOne, processOutboxAll, updateHeader, getExpirationDate } from "./index.js";
import { showModal, hideModal, ouvrirModalEdit, showModalCredit, hideModalCredit, ouvrirModalRemboursement, hideModalRemboursement, showModalById, hideModalById, closePremiumModal, closeContactModal, closeGuide, fermerModal } from "./modal.js";
import { showNotification, customConfirm, } from "./notification.js";
import { handleAddProductClick } from "./premium.js";
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente, afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";
import { showSection } from "./utils.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode, modifierVente } from "./ventes.js";

// api.js
// URL de base de ton serveur API
export const API_BASE = "https://samacommerce-backend-v2.onrender.com";

// Expose toutes les fonctions sur window si nécessaire
window.authfetch = authfetch;
window.postSaleServer = postSaleServer;
window.postCategoryServer = postCategoryServer;
window.postProductServer = postProductServer;
window.syncFromServer = syncFromServer;


export function authfetch(url, options = {}) {
  const token = localStorage.getItem('authToken');
  if (!token) {
    console.warn("Token manquant, rejet de la promesse");
    return Promise.reject(new Error('Token manquant'));
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.warn("⚠️ Token expiré");
      localStorage.removeItem('authToken');
      return Promise.reject(new Error('Token expiré'));
    }
  } catch (e) {
    console.error("Erreur décodage token:", e);
  }

  const headers = {
    ...(options.headers || {}),
    'Authorization': 'Bearer ' + token
  };

  return fetch(url, { ...options, headers }).then(res => {
    if (res.status === 401) {
      localStorage.removeItem('authToken');
      return Promise.reject(new Error('401 Unauthorized'));
    }
    return res;
  });
}
export async function postSaleServer(sale) {
  try {
    // sale peut contenir : product_id, quantity, payment_method
    // et éventuellement client_name, client_phone, due_date, paid
    const res = await authfetch(API_BASE + '/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sale)
    });

    if (!res.ok) {
      const errorMsg = await res.text();
      console.warn('❌ Échec enregistrement vente :', errorMsg);
      return null;
    }

    const data = await res.json();
    console.log('✅ Vente enregistrée sur serveur :', data);
    return data;
  } catch (e) {
    console.warn('🌐 Erreur réseau lors du POST /sales', e);
    return null;
  }
}

export async function postCategoryServer(category) {
  try {
    const res = await authfetch(API_BASE + '/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category) // category = { name: "..." }
    });

    if (!res.ok) {
      const errorMsg = await res.text();
      console.warn('Add category failed', errorMsg);
      return null;
    }

    return await res.json();
  } catch (e) {
    console.warn('Network error adding category', e);
    return null;
  }
}

export async function postProductServer(product) {
  try {
    const res = await authfetch(API_BASE + '/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    if (!res.ok) {
      const errorMsg = await res.text();
      console.warn('Add product failed', errorMsg);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn('Network error adding product', e);
    return null;
  }
}

// ---------- Sync with server (read only) ----------
export async function syncFromServer() {
  const syncBanner = document.getElementById('syncBanner');
  if (syncBanner) syncBanner.style.display = 'block';

  if (!navigator.onLine) {
    console.warn('Mode hors ligne : données locales utilisées.');
    if (syncBanner) syncBanner.style.display = 'none';
    afficherInventaire();

    return;
  }

  try {
    // Récupération en parallèle — allSettled pour ne pas tout perdre si 1 endpoint échoue
    const [resCat, resProd, resStats, resSales] = await Promise.allSettled([
      authfetch(API_BASE + '/categories'),
      authfetch(API_BASE + '/products'),
      authfetch(API_BASE + '/stats/ventes-par-jour'),
      authfetch(API_BASE + '/sales?limit=500'),
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { ok: false }));

    // --- Catégories ---
    if (resCat.ok) {
      const cats = await resCat.json();
      const defaultCategoryStyles = [
        { emoji: '👕', couleur: 'category-habits' },
        { emoji: '💄', couleur: 'category-cosmetiques' },
        { emoji: '👠', couleur: 'category-chaussures' },
        { emoji: '💍', couleur: 'category-accessoires' },
        { emoji: '🧴', couleur: 'bg-blue-400' },
        { emoji: '✨', couleur: 'bg-yellow-400' }
      ];
      appData.categories = cats.map((c, index) => {
        const style = defaultCategoryStyles[index % defaultCategoryStyles.length];
        return {
          id: parseInt(c.id),
          name: c.name,
          emoji: c.emoji || '🏷️',
          couleur: c.couleur || style.couleur
        };
      });
    }

    // --- Produits ---
    if (resProd.ok) {
      const prods = await resProd.json();
      appData.produits = prods.map(p => ({
        id:          parseInt(p.id),
        name:        p.name,
        category_id: parseInt(p.category_id),
        scent:       p.scent,
        price:       parseFloat(p.price)       || 0,
        stock:       parseInt(p.stock)         || 0,
        vendu:       0,
        priceAchat:  parseFloat(p.price_achat) || 0,
        description: p.description || ''
      }));
    }

    // --- Ventes ---
    let ventesAll = [];
    if (resSales.ok) {
      ventesAll = await resSales.json();

      // ⚡ Normalisation des ventes/crédits
      appData.ventes = ventesAll.map(v => ({
        ...v,
        total:    parseFloat(v.total)    || 0,
        price:    parseFloat(v.price)    || 0,
        quantity: parseInt(v.quantity)   || 0,
        amount_paid: parseFloat(v.amount_paid) || 0,
        created_at: v.created_at ? new Date(v.created_at) : null,
        due_date:   v.due_date   ? new Date(v.due_date)   : null,
        paid: v.paid === true || v.paid === 'true'
      }));

      // 🔗 Rattacher les ventes à chaque produit
      appData.produits.forEach(prod => {
        prod.ventes = appData.ventes.filter(v =>
          parseInt(v.product_id) === prod.id
        );
      });

      // Filtrer les crédits — uniquement les references, pas de duplication complète
      appData.credits = appData.ventes.filter(v => {
        const pm = (v.payment_method || '').toLowerCase().trim();
        return pm === 'credit' || pm === 'crédit';
      });

      // ✅ Debug complet
      console.log("🛒 Toutes les ventes normalisées :", appData.ventes);
      console.log("📦 Crédits filtrés :", appData.credits);
      console.log("💳 Méthodes de paiement distinctes :",
        [...new Set(appData.ventes.map(v => (v.payment_method || '').trim()))]);
    }


    // --- Stats ventes du jour ---
    if (resStats.ok) {
      const statsArray = await resStats.json();
      const today = new Date().toISOString().split('T')[0];
      const todayStat = statsArray.find(s => s.date.startsWith(today));

      appData.stats.ventesJour = todayStat ? parseInt(todayStat.total_montant, 10) : 0;
      appData.stats.chiffreAffaires = appData.stats.ventesJour;
      appData.stats.historique = statsArray;
    }

    // --- Recalcul vendu + articles vendus ---
    const today = new Date().toISOString().split('T')[0];
    appData.produits.forEach(prod => { prod.vendu = 0; });
    let totalQteToday = 0;

    ventesAll.forEach(v => {
      const prodId = parseInt(v.product_id);
      const qte = v.quantity || 0;

      const prod = appData.produits.find(p => p.id === prodId);
      if (prod) prod.vendu += qte;

      const venteDate = new Date(v.created_at);
      if (!isNaN(venteDate) && venteDate.toISOString().split('T')[0] === today) {
        totalQteToday += qte;
      }
    });

    appData.stats.articlesVendus = totalQteToday;

    // --- Sauvegarde ---
    saveAppDataLocal();
    console.log('✅ Sync from server done');

  } catch (err) {
    console.warn('❌ Erreur lors de la synchronisation depuis le serveur', err);
    console.warn('⚠️ Impossible de contacter le serveur API. Vérifiez la connexion ou la configuration CORS.');
  }

  if (syncBanner) syncBanner.style.display = 'none';

  afficherCredits();

  await updateHeader();

}
