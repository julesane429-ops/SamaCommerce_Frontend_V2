import { appData, chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { updateCharts, initCreditChart } from "./charts.js";
import { getCurrentUserId, logout } from "./auth.js";
import { selectEmoji, supprimerCategorie, ajouterCategorie, remplirSelectCategories, afficherFiltresCategories } from "./categories.js";
import { renderCreditsHistory, marquerCreditPaye, confirmerRemboursement, remplirProduitsCredit } from "./credits.js";
import { loadAppDataLocal, saveAppDataLocal, enqueueOutbox, processOutboxOne, processOutboxAll, updateHeader, getExpirationDate } from "./index.js";
import { showModal, hideModal, ouvrirModalEdit, showModalCredit, hideModalCredit, ouvrirModalRemboursement, hideModalRemboursement, showModalById, hideModalById, closePremiumModal, closeContactModal, closeGuide, fermerModal } from "./modal.js";
import { showNotification, customConfirm } from "./notification.js";
import { handleAddProductClick } from "./premium.js";
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente, afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";
import { showSection } from "./utils.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode, modifierVente } from "./ventes.js";

// ── URL de base ────────────────────────────────────────────────────────────
export const API_BASE = "https://samacommerce-backend-v2.onrender.com";

// ── Helpers profil commercial ──────────────────────────────────────────────
// Récupère le mode_vente de l'utilisateur connecté
export function getModeVente() {
  return localStorage.getItem('modeVente') || 'detail';
}
// Indique si le marchandage (prix libre) est activé
export function isPrixLibre() {
  return localStorage.getItem('prixFixe') === 'false';
}

// ── Exposer sur window ─────────────────────────────────────────────────────
window.authfetch          = authfetch;
window.postSaleServer     = postSaleServer;
window.postCategoryServer = postCategoryServer;
window.postProductServer  = postProductServer;
window.syncFromServer     = syncFromServer;
window.getModeVente       = getModeVente;
window.isPrixLibre        = isPrixLibre;

// ── authfetch ──────────────────────────────────────────────────────────────
export function authfetch(url, options = {}) {
  const token = localStorage.getItem('authToken');
  if (!token) {
    console.warn("Token manquant");
    return Promise.reject(new Error('Token manquant'));
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      localStorage.removeItem('authToken');
      return Promise.reject(new Error('Token expiré'));
    }
  } catch (e) { /* silencieux */ }

  const headers = { ...(options.headers || {}), 'Authorization': 'Bearer ' + token };
  return fetch(url, { ...options, headers }).then(res => {
    if (res.status === 401) { localStorage.removeItem('authToken'); return Promise.reject(new Error('401')); }
    return res;
  });
}

// ── postSaleServer ─────────────────────────────────────────────────────────
// Retourne { ok, data } ou { ok: false, error }
export async function postSaleServer(sale) {
  try {
    const res = await authfetch(API_BASE + '/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sale)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('❌ Échec vente :', err);
      return { ok: false, error: err.error || 'Erreur inconnue' };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    console.warn('🌐 Erreur réseau /sales', e);
    return { ok: false, error: 'Erreur réseau' };
  }
}

// ── postCategoryServer ─────────────────────────────────────────────────────
export async function postCategoryServer(category) {
  try {
    const res = await authfetch(API_BASE + '/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(category)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

// ── postProductServer ──────────────────────────────────────────────────────
export async function postProductServer(product) {
  try {
    const res = await authfetch(API_BASE + '/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

// ── syncFromServer ─────────────────────────────────────────────────────────
export async function syncFromServer() {
  const syncBanner = document.getElementById('syncBanner');
  if (syncBanner) syncBanner.style.display = 'block';

  if (!navigator.onLine) {
    if (syncBanner) syncBanner.style.display = 'none';
    afficherInventaire();
    return;
  }

  try {
    const [resCat, resProd, resStats, resSales] = await Promise.allSettled([
      authfetch(API_BASE + '/categories'),
      authfetch(API_BASE + '/products'),
      authfetch(API_BASE + '/stats/ventes-par-jour'),
      authfetch(API_BASE + '/sales?limit=500'),
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { ok: false }));

    // ── Catégories ──
    if (resCat.ok) {
      const cats = await resCat.json();
      const defaultStyles = [
        { emoji: '👕', couleur: 'category-habits' },
        { emoji: '💄', couleur: 'category-cosmetiques' },
        { emoji: '👠', couleur: 'category-chaussures' },
        { emoji: '💍', couleur: 'category-accessoires' },
        { emoji: '🧴', couleur: 'bg-blue-400' },
        { emoji: '✨', couleur: 'bg-yellow-400' }
      ];
      appData.categories = cats.map((c, i) => ({
        id:      parseInt(c.id),
        name:    c.name,
        emoji:   c.emoji   || '🏷️',
        couleur: c.couleur || defaultStyles[i % defaultStyles.length].couleur
      }));
    }

    // ── Produits ── (price_gros et quantite_gros inclus)
    if (resProd.ok) {
      const prods = await resProd.json();
      appData.produits = prods.map(p => ({
        id:            parseInt(p.id),
        name:          p.name,
        category_id:   parseInt(p.category_id),
        scent:         p.scent,
        price:         parseFloat(p.price)       || 0,
        stock:         parseInt(p.stock)         || 0,
        vendu:         0,
        priceAchat:    parseFloat(p.price_achat) || 0,
        description:   p.description             || '',
        image_url:     p.image_url               || null,
        price_gros:    p.price_gros    != null ? parseFloat(p.price_gros)  : null,
        quantite_gros: p.quantite_gros != null ? parseInt(p.quantite_gros) : null,
      }));
    }

    // ── Ventes ──
    let ventesAll = [];
    if (resSales.ok) {
      ventesAll = await resSales.json();
      appData.ventes = ventesAll.map(v => ({
        ...v,
        total:          parseFloat(v.total)           || 0,
        price:          parseFloat(v.price)           || 0,
        quantity:       parseInt(v.quantity)          || 0,
        amount_paid:    parseFloat(v.amount_paid)     || 0,
        prix_negocie:   v.prix_negocie   != null ? parseFloat(v.prix_negocie)   : null,
        prix_reference: v.prix_reference != null ? parseFloat(v.prix_reference) : null,
        nb_lots:        v.nb_lots        != null ? parseInt(v.nb_lots)           : null,
        sale_type:      v.sale_type      || 'detail',
        created_at:     v.created_at ? new Date(v.created_at) : null,
        due_date:       v.due_date   ? new Date(v.due_date)   : null,
        paid:           v.paid === true || v.paid === 'true'
      }));

      appData.produits.forEach(prod => {
        prod.ventes = appData.ventes.filter(v => parseInt(v.product_id) === prod.id);
      });
      appData.credits = appData.ventes.filter(v => {
        const pm = (v.payment_method || '').toLowerCase().trim();
        return pm === 'credit' || pm === 'crédit';
      });
    }

    // ── Stats ventes du jour ──
    if (resStats.ok) {
      const statsArray = await resStats.json();
      const today      = new Date().toISOString().split('T')[0];
      const todayStat  = statsArray.find(s => s.date.startsWith(today));
      appData.stats.ventesJour      = todayStat ? parseInt(todayStat.total_montant, 10) : 0;
      appData.stats.chiffreAffaires = appData.stats.ventesJour;
      appData.stats.historique      = statsArray;
    }

    // ── Recalcul quantités vendues aujourd'hui ──
    const today = new Date().toISOString().split('T')[0];
    appData.produits.forEach(prod => { prod.vendu = 0; });
    let totalQteToday = 0;
    ventesAll.forEach(v => {
      const prod = appData.produits.find(p => p.id === parseInt(v.product_id));
      if (prod) prod.vendu += v.quantity || 0;
      const d = new Date(v.created_at);
      if (!isNaN(d) && d.toISOString().split('T')[0] === today) totalQteToday += v.quantity || 0;
    });
    appData.stats.articlesVendus = totalQteToday;

    // ── Rafraîchir le profil commercial (mode_vente / prix_fixe) ──
    try {
      const resMe = await authfetch(API_BASE + '/auth/me');
      if (resMe.ok) {
        const me = await resMe.json();
        if (me.mode_vente !== undefined) localStorage.setItem('modeVente', me.mode_vente);
        if (me.prix_fixe  !== undefined) localStorage.setItem('prixFixe',  String(me.prix_fixe));
      }
    } catch (_) { /* non bloquant */ }

    saveAppDataLocal();
    console.log('✅ Sync from server done');

  } catch (err) {
    console.warn('❌ Erreur sync serveur', err);
  }

  if (syncBanner) syncBanner.style.display = 'none';
  afficherCredits();
  await updateHeader();
}
