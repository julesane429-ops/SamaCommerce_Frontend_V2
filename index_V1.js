
// ==================== PATCH ANTI-DUPLICATION HISTORIQUE DES VENTES ====================
let _lastSalesKey = "";
let _isRenderingSalesHistory = false;

// Supprime toute table "fantôme" créée ailleurs que #salesHistory
function purgeSalesHistoryClones() {
  const reports = document.getElementById('rapportsSection');
  const keep = document.getElementById('salesHistory');
  if (!reports || !keep) return;

  reports.querySelectorAll('h1,h2,h3,h4').forEach(h => {
    if (/Historique des ventes/i.test(h.textContent) && !keep.contains(h)) {
      const box = h.closest('div');
      if (box && box !== keep) box.remove();
    }
  });

  reports.querySelectorAll('table').forEach(t => {
    if (keep.contains(t)) return;
    const headers = Array.from(t.querySelectorAll('th')).map(th => th.textContent.trim().toLowerCase());
    const expected = ['date', 'produit', 'qté', 'montant', 'paiement', 'actions'];
    if (expected.every(h => headers.includes(h))) {
      const box = t.closest('div');
      if (box && box !== keep) box.remove();
      else t.remove();
    }
  });
}

// Remplit le tbody unique sans jamais créer de nouvelle table
function renderSalesHistory(ventes) {
  purgeSalesHistoryClones();

  const tbody = document.getElementById('salesHistoryBody');
  if (!tbody) return;

  const periode = document.getElementById('periodeRapports')?.value || 'tout';
  const key = `${periode}|${ventes?.length || 0}|${appData.produits?.length || 0}`;
  if (key === _lastSalesKey) return;
  _lastSalesKey = key;

  tbody.innerHTML = '';

  if (!Array.isArray(ventes) || ventes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-500 p-4">Aucune vente</td></tr>`;
    return;
  }

  for (const v of ventes) {
    const prod = (appData.produits || []).find(p => Number(p.id) === Number(v.product_id));
    const unit = Number(v.price ?? 0);
    const qty = Number(v.quantity ?? 0);
    const montant = Number.isFinite(Number(v.total)) ? Number(v.total) : (unit * qty);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2 border">${new Date(v.date || v.created_at).toLocaleString()}</td>
      <td class="p-2 border">${prod ? prod.name : 'Inconnu'}</td>
      <td class="p-2 border">${v.quantity ?? 0}</td>
      <td class="p-2 border">${(Number.isFinite(montant) ? montant : 0).toLocaleString()} F</td>
      <td class="p-2 border">${v.payment_method || ''}</td>
      <td class="p-2 border text-center">
        <button class="bg-yellow-500 text-white px-2 py-1 rounded text-xs" onclick="modifierVente(${v.id})">✏️</button>
        <button class="bg-red-500 text-white px-2 py-1 rounded text-xs" onclick="annulerVente(${v.id})">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function tryRenderSalesHistory(ventesFiltrees) {
  if (_isRenderingSalesHistory) return;
  _isRenderingSalesHistory = true;
  try {
    if (!appData?.ventes?.length || !appData?.produits?.length) {
      const tbody = document.getElementById('salesHistoryBody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-500 p-4">Chargement…</td></tr>`;
    } else {
      renderSalesHistory(ventesFiltrees);
    }
  } finally {
    _isRenderingSalesHistory = false;
  }
}
// ==================== FIN PATCH ====================


(function () {
  try {
    const token = localStorage.getItem('authToken');
    const role = localStorage.getItem('userRole')?.toLowerCase();
    console.log("Au chargement - token :", token);
    console.log("Au chargement - rôle :", role);

    if (!token) {
      console.log("Pas de token, redirection vers login.html");
      window.location.replace('login.html?expired=1');
    } else if (role === "admin") {
      console.log("Utilisateur admin détecté, redirection vers admin.html");
      window.location.replace('admin.html');
    } else {
      console.log("Utilisateur normal détecté, reste sur index.html");
    }
  } catch (e) {
    console.error("Erreur lors du check initial :", e);
    window.location.replace('login.html?expired=1');
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

let appData = null;
let chartVentesByDay = null, chartTopProduits = null, chartPaiements = null;

// ---------- localStorage helpers ----------
function loadAppDataLocal() {
  const raw = localStorage.getItem('boutique_appData');
  if (raw) {
    try { appData = JSON.parse(raw); }
    catch (e) { appData = JSON.parse(JSON.stringify(defaultData)); }
  } else appData = JSON.parse(JSON.stringify(defaultData));
  appData.produits.forEach(p => { if (typeof p.priceAchat === 'undefined') p.priceAchat = p.price_achat || 0; });
  // ensure outbox exists
  if (!localStorage.getItem('boutique_outbox')) localStorage.setItem('boutique_outbox', JSON.stringify([]));
}
function saveAppDataLocal() { localStorage.setItem('boutique_appData', JSON.stringify(appData)); }

// ---------- Outbox / Background retry ----------
function enqueueOutbox(item) { // item example: {type:'sale', payload: {...}, tries:0, id: Date.now()}
  const q = JSON.parse(localStorage.getItem('boutique_outbox') || '[]'); q.push(item); localStorage.setItem('boutique_outbox', JSON.stringify(q));
}

async function processOutboxOne() {
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

async function processOutboxAll() { let did = false; try { while (true) { const r = await processOutboxOne(); if (!r) break; if (r.ok) did = true; else break; } } catch (e) { console.warn(e); } return did; }

// periodic retry
setInterval(() => { if (navigator.onLine) processOutboxAll(); }, 30 * 1000); // try every 30s if online
window.addEventListener('online', () => { console.log('Back online -> retry outbox'); processOutboxAll(); });

// ---------- Sync with server (read only) ----------
async function syncFromServer() {
  const syncBanner = document.getElementById('syncBanner');
  if (syncBanner) syncBanner.style.display = 'block';

  if (!navigator.onLine) {
    console.warn('Mode hors ligne : données locales utilisées.');
    if (syncBanner) syncBanner.style.display = 'none';
    return;
  }

  try {
    // Récupération en parallèle avec authFetch
    const [resCat, resProd, resStats, resSales] = await Promise.all([
      authfetch(API_BASE + '/categories'),
      authfetch(API_BASE + '/products'),
      authfetch(API_BASE + '/stats/ventes-par-jour'),
      authfetch(API_BASE + '/sales'),
    ]);

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
        id: parseInt(p.id),
        name: p.name,
        category_id: parseInt(p.category_id),
        scent: p.scent,
        price: p.price,
        stock: p.stock,
        vendu: 0,
        priceAchat: p.price_achat || 0,
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
        created_at: v.created_at ? new Date(v.created_at) : null,
        due_date: v.due_date ? new Date(v.due_date) : null,
        paid: v.paid === true || v.paid === "true" // si string "true" => bool
      }));

      // ✅ filtre les crédits (tolère casse + accents + espaces)
      appData.credits = appData.ventes.filter(v => {
        const pm = (v.payment_method || "").toLowerCase().trim();
        return pm === "credit" || pm === "crédit";
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

async function updateHeader() {
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


async function postCategoryServer(category) {
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

async function postProductServer(product) {
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


async function postSaleServer(sale) {
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

// Fonction pour calculer la date +30 jours
function getExpirationDate() {
  const now = new Date();
  now.setDate(now.getDate() + 30);
  return now.toISOString().split("T")[0]; // format YYYY-MM-DD
}

// ---------- Init ---------- 
document.addEventListener('DOMContentLoaded', async function () {
  // Chargement et initialisation des données
  loadAppDataLocal();
  updateStats();
  verifierStockFaible();
  afficherCategoriesVente();
  afficherProduits();
  afficherCategories();
  afficherRapports();
  afficherInventaire();
  setupSearchInputs();

  // Premier synchronisation avec le serveur
  await syncFromServer();
  updateStats();
  verifierStockFaible();
  afficherCategoriesVente();
  afficherProduits();
  afficherCategories();
  afficherRapports();
  afficherInventaire();

  // Vérification des crédits après la synchro
  console.log("📦 Crédits après sync :", appData.credits);

  // ✅ Pré-remplir la date d’expiration dans le formulaire Upgrade
  const expirationInput = document.getElementById("expiration");
  const expirationDisplay = document.getElementById("expiration_display");

  if (expirationInput && expirationDisplay) {
    const expDate = getExpirationDate(); // YYYY-MM-DD
    expirationInput.value = expDate;

    // Affichage en format FR (JJ/MM/AAAA)
    const [year, month, day] = expDate.split("-");
    expirationDisplay.value = `Expire le : ${day}/${month}/${year}`;
  }

  // Rafraîchissement automatique toutes les 30 secondes
  setInterval(async () => {
    await syncFromServer();
    updateStats();
    verifierStockFaible();
    afficherCategoriesVente();
    afficherProduits();
    afficherCategories();
    afficherRapports();
    afficherInventaire();

    console.log("♻️ Crédits après refresh auto :", appData.credits);
  }, 30000);

  // Ajout de l'écouteur d'événement pour la sélection de période des rapports
  const periodeRapports = document.getElementById('periodeRapports');
  if (periodeRapports) {
    periodeRapports.addEventListener('change', afficherRapports);
  } else {
    console.warn("L'élément #periodeRapports n'a pas été trouvé.");
  }

  // Gestion du bouton "Enregistrer à Crédit" dans le modal
  const enregistrerCreditBtnObserver = new MutationObserver(() => {
    const enregistrerCreditBtn = document.querySelector('#modalCredit button.bg-purple-600');
    if (enregistrerCreditBtn) {
      enregistrerCreditBtn.addEventListener('click', async function () {
        const clientName = document.getElementById('creditClientName')?.value.trim();
        const clientPhone = document.getElementById('creditClientPhone')?.value.trim();
        const dueDate = document.getElementById('creditDueDate')?.value;

        if (!clientName || !clientPhone || !dueDate) {
          showNotification("⚠️ Merci de remplir toutes les informations du crédit.", "warning");
          return;
        }

        const creditData = {
          client_name: clientName,
          client_phone: clientPhone,
          due_date: dueDate,
        };

        // Finaliser la vente à crédit
        await finaliserVente("credit", creditData);

        // Fermer le modal après l'enregistrement
        hideModalCredit();
      });

      enregistrerCreditBtnObserver.disconnect();
    }
  });

  enregistrerCreditBtnObserver.observe(document.body, { childList: true, subtree: true });

  // Gestion du message d'expiration de session
  const params = new URLSearchParams(window.location.search);
  if (params.get('expired') === '1') {
    showNotification("⚠️ Votre session a expiré. Veuillez vous reconnecter.", "warning");
  }

  // Initialisation de la page pour les crédits
  remplirProduitsCredit();
  renderCreditsHistory();
});




// ---------- Navigation & UI helpers (structure kept) ----------
let currentSection = 'menu';
function showSection(section) {
  const sections = ['menu', 'vente', 'stock', 'categories', 'rapports', 'inventaire', 'credits'];
  sections.forEach(function (s) { const el = document.getElementById(s + 'Section'); if (el) el.classList.add('hidden'); });
  const target = document.getElementById(section + 'Section'); if (target) target.classList.remove('hidden');
  const backBtn = document.getElementById('backBtn'); if (backBtn) backBtn.style.display = (section === 'menu') ? 'none' : 'block';
  currentSection = section;
  if (section === 'vente') { afficherCategoriesVente(); afficherPanier(); }
  else if (section === 'stock') { afficherProduits(); afficherFiltresCategories(); }
  else if (section === 'categories') { afficherCategories(); }
  else if (section === 'rapports') { afficherRapports(); }
  else if (section === 'inventaire') { afficherInventaire(); }
  else if (section === 'menu') { updateStats(); verifierStockFaible(); }
  else if (section === 'credits') {
    afficherCredits(); // ta fonction qui remplit le tableau
    remplirSelectProduitsCredit();
  }

}

function showModal(modalName) {
  const overlay = document.getElementById('modalOverlay'); if (overlay) overlay.classList.remove('hidden');
  const modalId = 'modal' + modalName.charAt(0).toUpperCase() + modalName.slice(1);
  const modalEl = document.getElementById(modalId);
  if (modalEl) modalEl.classList.remove('hidden');
  if (modalName === 'ajoutProduit') remplirSelectCategories();
}
function hideModal() {
  const overlay = document.getElementById('modalOverlay'); if (overlay) overlay.classList.add('hidden');
  document.querySelectorAll('[id^="modal"]').forEach(function (m) { m.classList.add('hidden'); });
  ['nomProduit', 'categorieProduit', 'prixProduit', 'prixAchatProduit', 'stockProduit', 'descriptionProduit', 'nomCategorie', 'emojiCategorie'].forEach(function (id) { const el = document.getElementById(id); if (el) el.value = ''; });
  document.querySelectorAll('.emoji-btn').forEach(function (btn) { btn.classList.remove('bg-blue-200', 'border-blue-400'); });
}

function showModalById(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}

function hideModalById(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

// ---------- Stats & alerts ----------
function updateStats() {
  if (!appData) return;
  const ventesTodayEl = document.getElementById('ventesToday'); if (ventesTodayEl) ventesTodayEl.textContent = appData.stats.ventesJour || 0;
  const chiffreEl = document.getElementById('chiffreAffaires'); if (chiffreEl) chiffreEl.textContent = (appData.stats.chiffreAffaires || 0).toLocaleString() + ' F';
  const articlesEl = document.getElementById('articlesVendus');
  if (articlesEl) articlesEl.textContent = appData.stats.articlesVendus || 0;
  const stockTotalEl = document.getElementById('stockTotal'); if (stockTotalEl) stockTotalEl.textContent = appData.produits.reduce(function (t, p) { return t + (p.stock || 0); }, 0);
}
function verifierStockFaible() {
  if (!appData) return;
  const low = appData.produits.filter(function (p) { return p.stock > 0 && p.stock <= 5; });
  const div = document.getElementById('produitsStockFaible'); const alertDiv = document.getElementById('alertesStock');
  if (low.length) { if (alertDiv) alertDiv.style.display = 'block'; if (div) div.innerHTML = ''; low.forEach(function (produit) { const cat = appData.categories.find(function (c) { return c.id === produit.category_id; }); const el = document.createElement('div'); el.className = 'bg-white rounded-xl p-3 flex justify-between items-center'; el.innerHTML = '<span class="font-bold">' + (cat ? cat.emoji : '📦') + ' ' + produit.name + '</span><span class="text-red-600 font-bold">' + produit.stock + ' restants</span>'; if (div) div.appendChild(el); }); }
  else if (alertDiv) alertDiv.style.display = 'none';
}

// ---------- Vente / Panier ----------
function afficherCategoriesVente() {
  const ctn = document.getElementById('categoriesVente'); if (!ctn) return; ctn.innerHTML = ''; if (appData.categories.length === 0) {
    ctn.innerHTML = '<div class="text-gray-500 text-center py-4">Aucune catégorie disponible</div>';
    return;
  }
  appData.categories.forEach(function (cat) { const produitsCategorie = appData.produits.filter(function (p) { return p.category_id === cat.id && p.stock > 0; }); if (!produitsCategorie.length) return; const d = document.createElement('div'); d.className = 'big-button ' + (cat.couleur || '') + ' text-white p-4 rounded-2xl text-center cursor-pointer shadow-lg'; d.addEventListener('click', function () { afficherProduitsCategorie(cat.id); }); d.innerHTML = '<div class="text-4xl mb-2">' + (cat.emoji || '') + '</div><div class="font-bold">' + cat.name + '</div><div class="text-sm opacity-90">' + produitsCategorie.length + ' produits</div>'; ctn.appendChild(d); });
}

function afficherProduitsCategorie(categorieId) {
  const produits = appData.produits.filter(function (p) { return p.category_id === categorieId && p.stock > 0; }); const container = document.getElementById('categoriesVente'); if (!container) return; container.innerHTML = ''; const retourBtn = document.createElement('button'); retourBtn.textContent = '← Retour'; retourBtn.className = 'col-span-2 mb-4 text-blue-600 font-bold'; retourBtn.addEventListener('click', afficherCategoriesVente); container.appendChild(retourBtn);
  produits.forEach(function (produit) { const div = document.createElement('div'); div.className = 'bg-white border-2 border-gray-200 p-4 rounded-2xl text-center cursor-pointer hover:border-blue-400 transition-all'; div.addEventListener('click', function () { ajouterAuPanier(produit); }); div.innerHTML = '<div class="font-bold text-lg mb-1">' + produit.name + '</div><div class="text-2xl font-bold text-green-600 mb-1">' + (produit.price || 0).toLocaleString() + ' F</div><div class="text-sm text-gray-600">Stock: ' + (produit.stock || 0) + '</div>'; container.appendChild(div); });
}

function ajouterAuPanier(produit) { if (!appData) return; const exist = appData.panier.find(function (i) { return i.id === produit.id; }); if (exist) { if (exist.quantite < produit.stock) exist.quantite++; else { alert('❌ Stock insuffisant!'); return; } } else appData.panier.push(Object.assign({}, produit, { quantite: 1 })); afficherPanier(); saveAppDataLocal(); }

function afficherPanier() {
  const c = document.getElementById('panierItems'); const total = document.getElementById('totalPanier'); if (!c) return; if (!appData || !appData.panier || !appData.panier.length) { c.innerHTML = '<div class="text-gray-500 text-center py-8"><div class="text-4xl mb-2">🛒</div><div>Panier vide</div></div>'; if (total) total.textContent = '0 F'; return; }
  c.innerHTML = ''; var totalPrix = 0; appData.panier.forEach(function (item) {
    const div = document.createElement('div'); div.className = 'flex justify-between items-center bg-gray-50 rounded-2xl p-3'; div.innerHTML = '<div><div class="font-bold">' + item.name + '</div><div class="text-sm text-gray-600">' + (item.price || 0).toLocaleString() + ' F × ' + item.quantite + '</div></div><div class="flex items-center gap-2"><button class="bg-red-500 text-white w-8 h-8 rounded-full text-sm font-bold">-</button><span class="font-bold text-lg w-8 text-center">' + item.quantite + '</span><button class="bg-green-500 text-white w-8 h-8 rounded-full text-sm font-bold">+</button></div>'; // wire buttons
    c.appendChild(div);
    // attach handlers to +/- buttons
    const btns = div.querySelectorAll('button'); if (btns && btns.length >= 2) { btns[0].addEventListener('click', function () { modifierQuantitePanier(item.id, -1); }); btns[1].addEventListener('click', function () { modifierQuantitePanier(item.id, 1); }); }
    totalPrix += (item.price || 0) * item.quantite;
  }); if (total) total.textContent = totalPrix.toLocaleString() + ' F';
}

function modifierQuantitePanier(id, delta) { if (!appData) return; const item = appData.panier.find(function (i) { return i.id === id; }); const produit = appData.produits.find(function (p) { return p.id === id; }); if (item) { item.quantite += delta; if (item.quantite <= 0) appData.panier = appData.panier.filter(function (i) { return i.id !== id; }); else if (produit && item.quantite > produit.stock) { item.quantite = produit.stock; alert('❌ Stock insuffisant!'); } afficherPanier(); saveAppDataLocal(); } }

async function finaliserVente(paymentMethod) {
  if (paymentMethod === "credit") {
    // ⚡ On ne passe plus ici, on ouvre le formulaire Crédit
    showModalCredit();
    return;
  }

  if (!appData.panier.length) {
    showNotification('❌ Panier vide.', "error");
    return;
  }

  // ✅ Envoi des ventes une par une au backend
  for (const item of appData.panier) {
    const vente = {
      product_id: item.id,
      quantity: item.quantite,
      payment_method: paymentMethod
    };
    const created = await postSaleServer(vente);
    if (!created) {
      showNotification('❌ Erreur lors de l\'enregistrement de la vente.', "error");
      return;
    }
  }

  showNotification('✅ Vente enregistrée.', "success");

  // 🔄 Vider le panier local
  appData.panier = [];
  saveAppDataLocal();

  // 🔄 Recharger toutes les données depuis le serveur
  await syncFromServer();

  // 🔄 Rafraîchir toute l'UI
  updateStats();
  afficherCategoriesVente();
  afficherProduits();
  afficherCategories();
  afficherRapports();
  afficherInventaire();
  afficherCredits(); // ⚡ Ajout pour que la section crédits soit à jour

  hideModal();
}


// ---------- Produits / catégories gestion (avec POST) ----------
function remplirSelectCategories() {
  const select = document.getElementById('categorieProduit');
  if (!select) return;
  select.innerHTML = '<option value="">Choisir catégorie</option>';
  appData.categories.forEach(function (categ) {
    var opt = document.createElement('option');
    opt.value = categ.id;
    opt.textContent = (categ.emoji ? categ.emoji + ' ' : '') + categ.name;
    select.appendChild(opt);
  });
}

async function ajouterProduit() {
  const name = document.getElementById('nomProduit').value;
  const category_id = parseInt(document.getElementById('categorieProduit').value);
  const scentEl = document.getElementById('parfumProduit');
  const scent = scentEl ? scentEl.value : '';
  const priceAchat = parseFloat(document.getElementById('prixAchatProduit').value); // ✅ prix achat
  const price = parseFloat(document.getElementById('prixProduit').value);
  const stock = parseInt(document.getElementById('stockProduit').value);

  // Validation
  if (!name || !category_id || isNaN(price) || isNaN(stock) || isNaN(priceAchat)) {
    showNotification('❌ Remplissez tous les champs correctement.', "error");
    return;
  }

  // ✅ envoyer avec le nom correct pour la BDD
  const produit = {
    name: name,
    category_id: category_id,
    scent: scent,
    price: price,
    price_achat: priceAchat,
    stock: stock
  };

  const created = await postProductServer(produit);
  if (created) {
    showNotification('✅ Produit ajouté (serveur).', "success");
    await syncFromServer();
    updateStats();
    verifierStockFaible();
    afficherCategoriesVente();
    afficherProduits();
    afficherCategories();
    afficherRapports();
    afficherInventaire();
    hideModal();
  } else {
    showNotification('❌ Erreur lors de l\'ajout du produit.', "error");
  }
}

async function ajouterCategorie() {
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

function afficherFiltresCategories() {
  const container = document.getElementById('filtreCategories'); if (!container) return; container.innerHTML = ''; var btnAll = document.createElement('button'); btnAll.className = 'filtre-btn bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap'; btnAll.textContent = 'Tous'; btnAll.addEventListener('click', function () { filtrerProduits('tous'); }); container.appendChild(btnAll);
  appData.categories.forEach(function (c) { var button = document.createElement('button'); button.className = 'filtre-btn bg-gray-200 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap'; button.textContent = (c.emoji ? c.emoji + ' ' : '') + c.name; button.addEventListener('click', function () { filtrerProduits(c.id); }); container.appendChild(button); });
}

function filtrerProduits(categorieId) { document.querySelectorAll('.filtre-btn').forEach(function (btn) { btn.classList.remove('bg-blue-500', 'text-white'); btn.classList.add('bg-gray-200'); }); if (window.event && window.event.target) { var t = window.event.target; t.classList.add('bg-blue-500', 'text-white'); t.classList.remove('bg-gray-200'); } afficherProduits(categorieId); }

function afficherProduits(categorieFilter) {
  if (typeof categorieFilter === 'undefined') categorieFilter = 'tous';

  const container = document.getElementById('listeProduits');
  if (!container) return;

  container.innerHTML = '';

  let produits = appData.produits.slice();

  if (produits.length === 0) {
    container.innerHTML = '<div class="text-gray-500 text-center py-4">Aucun produit trouvé</div>';
    return;
  }

  if (categorieFilter !== 'tous') {
    produits = produits.filter(p => p.category_id === categorieFilter);
  }

  produits.forEach(function (produit) {
    const categorie = appData.categories.find(c => c.id === produit.category_id);

    const stockColor = (produit.stock < 5) ? 'text-red-600' :
      (produit.stock < 10) ? 'text-orange-600' :
        'text-green-600';

    let stockBadge = '';
    if (produit.stock <= 5) {
      stockBadge = `<span class="ml-2 inline-block px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">⚠️</span>`;
    } else if (produit.stock < 10) {
      stockBadge = `<span class="ml-2 inline-block px-2 py-0.5 text-xs font-bold text-white bg-orange-500 rounded-full">⚠️</span>`;
    }

    let bgAlertClass = '';
    if (produit.stock <= 5) bgAlertClass = 'bg-red-50';
    else if (produit.stock < 10) bgAlertClass = 'bg-orange-50';

    const div = document.createElement('div');
    div.className = 'rounded-2xl p-4 shadow-lg ' + bgAlertClass;

    const descriptionHtml = produit.description
      ? `<div class="text-xs text-gray-500 mt-1">${produit.description}</div>`
      : '';

    div.innerHTML =
      `<div class="flex justify-between items-start mb-3">
         <div>
           <div class="text-lg font-bold">${produit.name}</div>
           <div class="text-sm text-gray-600">
             ${categorie ? (categorie.emoji + ' ' + categorie.name) : 'Sans catégorie'}
           </div>
           ${descriptionHtml}
         </div>
         <div class="text-right">
           <div class="text-xl font-bold text-green-600">${(produit.price || 0).toLocaleString()} F</div>
           <div class="text-sm ${stockColor} font-bold">Stock: ${produit.stock || 0}${stockBadge}</div>
           <div class="text-xs text-gray-500">Achat: ${(produit.priceAchat || produit.price_achat || 0).toLocaleString()} F</div>
         </div>
       </div>
       <div class="flex gap-2">
         <button class="btn-edit bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-bold">✏️ Éditer</button>
         <button class="btn-mod-stock-minus bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold">- Stock</button>
         <button class="btn-mod-stock-plus bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold">+ Stock</button>
         <button class="btn-suppr bg-gray-500 text-white px-4 py-2 rounded-lg text-sm">🗑️</button>
       </div>`;

    container.appendChild(div);

    const btnEdit = div.querySelector('.btn-edit');
    if (btnEdit) btnEdit.addEventListener('click', () => ouvrirModalEdit(produit));


    // Wire buttons
    const btnMinus = div.querySelector('.btn-mod-stock-minus');
    if (btnMinus) btnMinus.addEventListener('click', () => modifierStock(produit.id, -1));

    const btnPlus = div.querySelector('.btn-mod-stock-plus');
    if (btnPlus) btnPlus.addEventListener('click', () => modifierStock(produit.id, 1));

    const btnSuppr = div.querySelector('.btn-suppr');
    if (btnSuppr) btnSuppr.addEventListener('click', () => supprimerProduit(produit.id));
  });
}

function modifierStock(id, delta) {
  var produit = appData.produits.find(function (p) { return p.id === id; });
  if (produit && produit.stock + delta >= 0) {
    produit.stock += delta;
    afficherProduits();
    updateStats();
    saveAppDataLocal();

    // ✅ on envoie bien "price_achat"
    authfetch(API_BASE + '/products/' + id, {
      method: 'PATCH', // PATCH plutôt que PUT pour ne mettre à jour que les champs modifiés
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: produit.name,
        price: produit.price,
        price_achat: produit.priceAchat || produit.price_achat || 0,
        stock: produit.stock,
        description: produit.description
      })
    }).then(function (r) {
      if (!r.ok) console.warn('update failed');
    }).catch(function () { });
  }
}

async function supprimerProduit(id) {
  const ok = await confirm("❓ Supprimer ce produit ?");
  if (!ok) {
    showNotification("❌ Suppression annulée", "warning");
    return;
  }

  // Suppression locale
  appData.produits = appData.produits.filter(p => p.id !== id);
  afficherProduits();
  updateStats();
  saveAppDataLocal();

  // Suppression côté backend
  authfetch(API_BASE + "/products/" + id, { method: "DELETE" })
    .then(() => {
      showNotification("✅ Produit supprimé avec succès", "success");
    })
    .catch(() => {
      showNotification("⚠️ Erreur lors de la suppression côté serveur", "error");
    });
}

// ---------- Catégories UI ----------
function selectEmoji(emoji) { var el = document.getElementById('emojiCategorie'); if (el) el.value = emoji; document.querySelectorAll('.emoji-btn').forEach(function (btn) { btn.classList.remove('bg-blue-200', 'border-blue-400'); }); if (window.event && window.event.target) window.event.target.classList.add('bg-blue-200', 'border-blue-400'); }

function afficherCategories() {
  var ctn = document.getElementById('listeCategories');
  if (!ctn) return;
  ctn.innerHTML = '';

  if (appData.categories.length === 0) {
    ctn.innerHTML = '<div class="text-gray-500 text-center py-4">Aucune catégorie trouvée</div>';
    return;
  }

  appData.categories.forEach(function (cat) {
    var produitsCount = appData.produits.filter(function (p) { return p.category_id === cat.id; }).length;

    var div = document.createElement('div');
    div.className = (cat.couleur || '') + ' text-white rounded-2xl p-6 shadow-lg';
    div.innerHTML = `
      <div class="flex justify-between items-center">
        <div>
          <div class="text-4xl mb-2">${cat.emoji || ''}</div>
          <div class="text-xl font-bold">${cat.name}</div>
          <div class="text-sm opacity-90">${produitsCount} produits</div>
        </div>
        <button class="bg-white bg-opacity-20 text-white px-3 py-2 rounded-lg text-sm">🗑️</button>
      </div>`;

    // Rendre le bouton actif
    const btn = div.querySelector('button');
    if (btn) {
      btn.addEventListener('click', () => supprimerCategorie(cat.id));
    }

    ctn.appendChild(div);
  });
}

// ✅ Supprimer une catégorie
async function supprimerCategorie(id) {
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

function afficherRapports() {
  // Vérification si les données sont prêtes
  if (!appData.ventes?.length || !appData.produits?.length) {
    console.warn("⏳ Données ventes/produits pas encore prêtes, on attend...");
    document.getElementById('rapportLoading').style.display = 'block';
    return;
  }

  // ✅ Masquer le message de chargement si données prêtes
  document.getElementById('rapportLoading').style.display = 'none';

  const periode = document.getElementById('periodeRapports')?.value || 'tout';
  const ventesFiltrees = filtrerVentesParPeriode(appData.ventes || [], periode);

  // --- Calcul paiements filtrés ---
  const paiementsMap = {};
  ventesFiltrees.forEach(v => {
    const method = v.payment_method || 'inconnu';
    const montant = parseFloat(v.total || (v.price || 0) * (v.quantity || 0)) || 0;
    paiementsMap[method] = (paiementsMap[method] || 0) + montant;
  });
  appData.stats.paiements = paiementsMap;

  // --- Chiffre d’affaires ---
  const totalJour = filtrerVentesParPeriode(appData.ventes, 'jour')
    .reduce((s, v) => s + (v.total || (v.price || 0) * (v.quantity || 0)), 0);
  const totalSemaine = filtrerVentesParPeriode(appData.ventes, 'semaine')
    .reduce((s, v) => s + (v.total || (v.price || 0) * (v.quantity || 0)), 0);
  const totalMois = filtrerVentesParPeriode(appData.ventes, 'mois')
    .reduce((s, v) => s + (v.total || (v.price || 0) * (v.quantity || 0)), 0);
  const totalTout = filtrerVentesParPeriode(appData.ventes, 'tout')
    .reduce((s, v) => s + (v.total || (v.price || 0) * (v.quantity || 0)), 0);

  // --- Injection DOM ---
  document.getElementById('recettesJour').textContent = totalJour.toLocaleString() + ' F';
  document.getElementById('recettesSemaine').textContent = totalSemaine.toLocaleString() + ' F';
  document.getElementById('recettesMois').textContent = totalMois.toLocaleString() + ' F';
  if (document.getElementById('recettesTout')) {
    document.getElementById('recettesTout').textContent = totalTout.toLocaleString() + ' F';
  }

  // --- Paiements ---
  const containerPaiements = document.getElementById('rapportsPaiements');
  containerPaiements.innerHTML = '';
  const methodesNoms = {
    especes: { name: 'Espèces', emoji: '💵', couleur: 'green' },
    wave: { name: 'Wave', emoji: '📱', couleur: 'blue' },
    orange: { name: 'Orange Money', emoji: '📞', couleur: 'orange' }
  };
  const totalPaiements = Object.values(paiementsMap).reduce((s, v) => s + v, 0);

  Object.keys(paiementsMap).forEach(m => {
    const montant = paiementsMap[m] || 0;
    const info = methodesNoms[m] || { name: m, emoji: '', couleur: 'gray' };
    const pct = totalPaiements > 0 ? ((montant / totalPaiements) * 100).toFixed(1) : 0;
    const div = document.createElement('div');
    div.className = `bg-${info.couleur}-50 rounded-2xl p-3 flex justify-between items-center`;
    div.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="text-2xl">${info.emoji || ''}</span>
        <span class="font-bold">${info.name}</span>
      </div>
      <div class="text-right">
        <div class="font-bold">${montant.toLocaleString()} F</div>
        <div class="text-xs text-gray-600">${pct}% du total</div>
      </div>
    `;
    containerPaiements.appendChild(div);
  });

  // --- Produits populaires ---
  const cPop = document.getElementById('produitsPopulaires');
  cPop.innerHTML = '';
  const populaires = appData.produits.filter(p => p.vendu > 0)
    .sort((a, b) => b.vendu - a.vendu)
    .slice(0, 5);

  if (!populaires.length) {
    cPop.innerHTML = '<div class="text-gray-500 text-center py-4">Aucune vente</div>';
  } else {
    populaires.forEach(p => {
      const d = document.createElement('div');
      d.className = 'flex justify-between items-center bg-gray-50 rounded-lg p-3';
      d.innerHTML = `<div class="font-bold">${p.name}</div>
                     <div class="text-blue-600 font-bold">${p.vendu} vendus</div>`;
      cPop.appendChild(d);
    });
  }

  // --- Graphiques filtrés ---
  updateCharts(ventesFiltrees);

  // --- Historique des ventes --- 
  tryRenderSalesHistory(ventesFiltrees);

  // --- Crédits --- 
  if (appData?.credits?.length) {
    afficherStatsCredits();
  } else {
    console.warn("⏳ Données crédits pas encore prêtes ou vides");
  }
}


function updateCharts(ventesFiltrees) {
  var ventes = ventesFiltrees || appData.ventes || [];

  // --- Graphique ventes par jour ---
  var byDay = {};
  ventes.forEach(function (v) {
    if (!v.date) return;
    let dateObj = new Date(v.date || v.created_at || v.timestamp);
    if (isNaN(dateObj)) return;
    var d = dateObj.toISOString().slice(0, 10);
    byDay[d] = (byDay[d] || 0) + (v.total || (v.price || 0) * (v.quantity || 0));
  });
  var labels = Object.keys(byDay).sort();
  var data = labels.map(function (l) { return byDay[l]; });
  if (chartVentesByDay) chartVentesByDay.destroy();
  var ctx1 = document.getElementById('chartVentesByDay');
  if (ctx1) {
    chartVentesByDay = new Chart(ctx1.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total ventes par jour',
          data: data,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79,70,229,0.15)',
          fill: true
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // --- Produits populaires ---
  var productsSorted = (appData.produits || []).slice().sort(function (a, b) {
    return (b.vendu || 0) - (a.vendu || 0);
  }).slice(0, 8);
  var labels2 = productsSorted.map(function (p) { return p.name; });
  var data2 = productsSorted.map(function (p) { return p.vendu || 0; });
  if (chartTopProduits) chartTopProduits.destroy();
  var ctx2 = document.getElementById('chartTopProduits');
  if (ctx2) {
    chartTopProduits = new Chart(ctx2.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels2,
        datasets: [{
          label: 'Quantités vendues',
          data: data2,
          backgroundColor: 'rgba(16,185,129,0.8)'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // --- Graphique paiements avec pourcentages ---
  var pays = appData.stats.paiements || {};
  var totalPaiements = Object.values(pays).reduce((sum, val) => sum + val, 0);
  var labels3 = Object.keys(pays).map(function (k) {
    var pct = totalPaiements > 0 ? ((pays[k] / totalPaiements) * 100).toFixed(1) : 0;
    return `${k.charAt(0).toUpperCase() + k.slice(1)} (${pct}%)`;
  });
  var data3 = Object.keys(pays).map(function (k) { return pays[k] || 0; });
  if (chartPaiements) chartPaiements.destroy();
  var ctx3 = document.getElementById('chartPaiements');
  if (ctx3) {
    chartPaiements = new Chart(ctx3.getContext('2d'), {
      type: 'pie',
      data: {
        labels: labels3,
        datasets: [{
          data: data3,
          backgroundColor: ['#10b981', '#3b82f6', '#f97316', '#6b7280'] // Vert, bleu, orange, gris
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // --- Graphique stocks faibles ---
  var produitsFaibles = (appData.produits || []).filter(p => p.stock <= 5);
  var labelsStock = produitsFaibles.map(p => p.name);
  var dataStock = produitsFaibles.map(p => p.stock);
  if (window.chartStocksFaibles && typeof window.chartStocksFaibles.destroy === 'function') {
    window.chartStocksFaibles.destroy();
  }
  var ctxStock = document.getElementById('chartStocksFaibles');
  if (ctxStock) {
    window.chartStocksFaibles = new Chart(ctxStock.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labelsStock,
        datasets: [{
          label: 'Stock restant',
          data: dataStock,
          backgroundColor: 'rgba(239,68,68,0.8)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: { x: { beginAtZero: true } }
      }
    });
  }
}


// ---------- Inventaire ----------
function afficherInventaire() {
  var tbody = document.getElementById('inventaireListe'); if (!tbody) return; tbody.innerHTML = ''; if (appData.produits.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">Aucun produit dans l’inventaire</td></tr>';
    return;
  }
  appData.produits.forEach(function (p) { var profitRealise = (p.vendu || 0) * ((p.price || 0) - (p.priceAchat || p.price_achat || 0)); var tr = document.createElement('tr'); tr.innerHTML = '<td class="p-2 border">' + p.name + '</td><td class="p-2 border">' + ((p.priceAchat || p.price_achat || 0).toLocaleString()) + ' F</td><td class="p-2 border">' + ((p.price || 0).toLocaleString()) + ' F</td><td class="p-2 border">' + (p.stock || 0) + '</td><td class="p-2 border">' + (p.vendu || 0) + '</td><td class="p-2 border">' + profitRealise.toLocaleString() + ' F</td>'; tbody.appendChild(tr); });
}

// ---------- Search handlers for inventory and categories ----------
function setupSearchInputs() {
  var inv = document.getElementById('searchInventaire'); if (inv) { inv.addEventListener('input', function () { var term = this.value.toLowerCase(); document.querySelectorAll('#inventaireListe tr').forEach(function (row) { var prodName = (row.cells[0] && row.cells[0].textContent || '').toLowerCase(); row.style.display = prodName.indexOf(term) !== -1 ? '' : 'none'; }); }); }
  var cat = document.getElementById('searchCategorie'); if (cat) { cat.addEventListener('input', function () { var term = this.value.toLowerCase(); document.querySelectorAll('#listeCategories > div').forEach(function (div) { var catName = (div.textContent || '').toLowerCase(); div.style.display = catName.indexOf(term) !== -1 ? '' : 'none'; }); }); }
}


function ouvrirModalEdit(produit) {
  // Remplir le formulaire
  document.getElementById('editNomProduit').value = produit.name;
  document.getElementById('editCategorieProduit').innerHTML = '<option value="">Choisir catégorie</option>';
  appData.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = (c.emoji ? c.emoji + ' ' : '') + c.name;
    if (c.id === produit.category_id) opt.selected = true;
    document.getElementById('editCategorieProduit').appendChild(opt);
  });
  document.getElementById('editPrixAchatProduit').value = produit.priceAchat || produit.price_achat || 0;
  document.getElementById('editPrixProduit').value = produit.price;
  document.getElementById('editStockProduit').value = produit.stock;
  document.getElementById('editDescriptionProduit').value = produit.description || '';

  // Stocker l'ID du produit en cours d'édition
  document.getElementById('modalEditProduit').dataset.id = produit.id;

  // Afficher la modale
  showModal('editProduit');
}

async function mettreAJourProduit() {
  const id = document.getElementById('modalEditProduit').dataset.id;
  const produit = {
    name: document.getElementById('editNomProduit').value,
    category_id: parseInt(document.getElementById('editCategorieProduit').value),
    price_achat: parseFloat(document.getElementById('editPrixAchatProduit').value),
    price: parseFloat(document.getElementById('editPrixProduit').value),
    stock: parseInt(document.getElementById('editStockProduit').value),
    description: document.getElementById('editDescriptionProduit').value
  };

  if (!produit.name || isNaN(produit.price) || isNaN(produit.price_achat) || isNaN(produit.stock)) {
    showNotification('❌ Remplissez tous les champs correctement.', 'error');
    return;
  }

  try {
    const res = await authfetch(API_BASE + '/products/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(produit)
    });

    if (!res.ok) {
      showNotification('❌ Erreur lors de la mise à jour du produit.', 'error');
      return;
    }

    showNotification('✅ Produit mis à jour.', 'success');
    hideModal();
    await syncFromServer();
    afficherProduits();
    afficherInventaire();
    updateStats();
  } catch (err) {
    console.error(err);
    showNotification('❌ Impossible de contacter le serveur.', 'error');
  }
}


function filtrerVentesParPeriode(ventes, periode) {
  const now = new Date();
  return ventes.filter(v => {
    const dateVente = new Date(v.date || v.created_at || v.timestamp);
    if (isNaN(dateVente)) return false;

    if (periode === 'jour') {
      return dateVente.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
    }
    if (periode === 'semaine') {
      const debutSemaine = new Date(now);
      debutSemaine.setDate(now.getDate() - now.getDay()); // dimanche comme début
      debutSemaine.setHours(0, 0, 0, 0);
      return dateVente >= debutSemaine && dateVente <= now;
    }
    if (periode === 'mois') {
      return dateVente.getMonth() === now.getMonth() &&
        dateVente.getFullYear() === now.getFullYear();
    }
    return true; // "tout"
  });
}

// ✅ Annuler une vente
async function annulerVente(id) {
  const ok = await confirm('❓ Annuler cette vente ?');
  if (!ok) {
    showNotification("❌ Annulation annulée", "warning");
    return;
  }

  try {
    const res = await authfetch(API_BASE + '/sales/' + id, { method: 'DELETE' });
    if (!res.ok) {
      showNotification('❌ Erreur lors de l\'annulation de la vente.', 'error');
      return;
    }
    showNotification('✅ Vente annulée.', 'success');
    await syncFromServer();
    afficherRapports();
    updateStats();
  } catch (err) {
    console.error(err);
    showNotification('❌ Impossible de contacter le serveur.', 'error');
  }
}

async function modifierVente(id) {
  const vente = appData.ventes.find(v => Number(v.id) === Number(id));
  if (!vente) {
    showNotification("❌ Vente introuvable", 'error');
    return;
  }

  // Demande la nouvelle quantité (laisser vide = pas de changement)
  let newQuantity = prompt(
    `Quantité actuelle: ${vente.quantity}\n👉 Nouvelle quantité (laisser vide pour ne pas changer) :`
  );

  // Demande le nouveau mode de paiement
  let newPayment = prompt(
    `Paiement actuel: ${vente.payment_method}\n👉 Nouveau mode de paiement (especes, wave, orange...) (laisser vide pour ne pas changer) :`
  );

  // Préparer le corps de la requête
  const body = {};
  if (newQuantity && !isNaN(newQuantity)) {
    body.quantity = Number(newQuantity);
  }
  if (newPayment && newPayment.trim() !== "") {
    body.payment_method = newPayment.trim();
  }

  if (Object.keys(body).length === 0) {
    showNotification("⚠️ Aucun changement effectué.", 'warning');
    return;
  }

  try {
    const res = await authfetch(API_BASE + "/sales/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errData = await res.json();
      showNotification("❌ Erreur lors de la modification : " + (errData.error || res.status), 'error');
      return;
    }

    const updated = await res.json();
    showNotification("✅ Vente modifiée avec succès !", 'success');
    console.log("Vente mise à jour :", updated);

    // Recharge les données depuis le serveur
    syncFromServer();

  } catch (e) {
    console.error("Erreur modifierVente:", e);
    showNotification("❌ Erreur réseau ou serveur", 'error');
  }
}


<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

let chartVentesJourInstance = null;
function renderVentesChart() {
  if (!appData.stats.historique || appData.stats.historique.length === 0) return;

  if (chartVentesJourInstance) {
    chartVentesJourInstance.destroy();
  }

  const labels = appData.stats.historique.map(s => new Date(s.date).toLocaleDateString());
  const dataCA = appData.stats.historique.map(s => parseInt(s.total_montant, 10));
  const dataQte = appData.stats.historique.map(s => parseInt(s.total_quantite || 0, 10));

  const ctx = document.getElementById('chartVentesJour').getContext('2d');
  chartVentesJourInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Chiffre d\'affaires (F)',
          data: dataCA,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          yAxisID: 'y'
        },
        {
          label: 'Articles vendus',
          data: dataQte,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      stacked: false,
      scales: {
        y: { type: 'linear', position: 'left' },
        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } }
      }
    }
  });
}

function authfetch(url, options = {}) {
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

function renderSalesHistory(ventes) {
  const tbody = document.getElementById('salesHistoryBody');
  tbody.innerHTML = ''; // Vider avant remplissage

  ventes.forEach(v => {
    // Trouver le produit correspondant
    const prod = appData.produits.find(p => Number(p.id) === Number(v.product_id));

    // Calcul du montant
    const montant = Number(v.total) || (Number(v.price) * Number(v.quantity));

    // Créer la ligne de la vente
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2 border">${new Date(v.date || v.created_at).toLocaleString()}</td>
      <td class="p-2 border">${prod ? prod.name : 'Inconnu'}</td>
      <td class="p-2 border">${v.quantity}</td>
      <td class="p-2 border">${montant.toLocaleString()} F</td>
      <td class="p-2 border">${v.payment_method || ''}</td>
      <td class="p-2 border text-center">
        <button class="bg-yellow-500 text-white px-2 py-1 rounded text-xs" onclick="modifierVente(${v.id})">✏️</button>
        <button class="bg-red-500 text-white px-2 py-1 rounded text-xs" onclick="annulerVente(${v.id})">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function ouvrirModal(vente) {
  document.getElementById("venteId").value = vente.id;
  document.getElementById("venteQuantite").value = vente.quantity;
  document.getElementById("ventePaiement").value = vente.payment_method;

  document.getElementById("modalModifierVente").classList.remove("hidden");
  document.getElementById("modalModifierVente").classList.add("flex");
}

function fermerModal() {
  document.getElementById("modalModifierVente").classList.add("hidden");
  document.getElementById("modalModifierVente").classList.remove("flex");
}

// Quand on soumet le formulaire
document.addEventListener("DOMContentLoaded", () => {
  const formModifier = document.getElementById("formModifierVente");
  if (formModifier) {
    formModifier.addEventListener("submit", async (e) => {
      e.preventDefault();

      const id = document.getElementById("venteId")?.value;
      const quantity = parseInt(document.getElementById("venteQuantite")?.value, 10);
      const payment_method = document.getElementById("ventePaiement")?.value;

      if (!id || !quantity || quantity <= 0 || !payment_method) {
        showNotification("❌ Champs invalides.", "error");
        return;
      }

      try {
        const res = await authfetch(`${API_BASE}/sales/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity, payment_method })
        });

        if (!res.ok) throw new Error("Erreur lors de la modification");

        showNotification("✅ Vente modifiée avec succès", "success");
        fermerModal();
        syncFromServer(); // recharge les données

      } catch (err) {
        console.error("Erreur modifierVente:", err);
        showNotification("❌ Erreur lors de la modification de la vente", "error");
      }
    });
  }
});

// Quand on clique sur ✏️ dans le tableau
function modifierVente(id) {
  const vente = appData.ventes.find(v => Number(v.id) === Number(id));
  if (!vente) {
    showNotification("❌ Vente introuvable", "error");
    return;
  }
  ouvrirModal(vente);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/pwa/sw.js")
      .then(() => console.log("📦 Service Worker installé et ⚡ activé"))
      .catch(err => console.error("❌ Erreur SW:", err));
  });
}

// --- Données locales pour les crédits ---
if (!appData || typeof appData !== "object") appData = {};
if (!appData.credits) appData.credits = [];

// Remplit la liste des produits dans le formulaire crédit
function remplirProduitsCredit() {
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

// Soumission formulaire crédit
document.addEventListener("DOMContentLoaded", () => {
  const creditForm = document.getElementById("creditForm");
  if (creditForm) {
    creditForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const client = document.getElementById("creditClient")?.value.trim();
      const product_id = document.getElementById("creditProduct")?.value;
      const quantity = parseInt(document.getElementById("creditQuantity")?.value, 10);
      const due_date = document.getElementById("creditDueDate")?.value;

      if (!client || !product_id || !quantity || quantity <= 0) {
        showNotification("❌ Veuillez remplir tous les champs correctement.", "error");
        return;
      }

      // Trouver le produit
      const produit = appData.produits.find(p => p.id == product_id);
      if (!produit) {
        showNotification("❌ Produit introuvable.", "error");
        return;
      }

      const montant = (produit.price || 0) * quantity;
      const credit = {
        id: Date.now(), // id temporaire local
        date: new Date().toISOString(),
        client,
        product_id,
        product_name: produit.name,
        quantity,
        montant,
        due_date,
        status: "non payé"
      };

      // Sauvegarde locale (backend à connecter plus tard)
      appData.credits.push(credit);

      renderCreditsHistory();
      creditForm.reset();
      showNotification("✅ Vente à crédit enregistrée !", "success");
    });
  }
});

// Afficher l’historique des crédits
function renderCreditsHistory() {
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

function showModalCredit() {
  const modalPaiement = document.getElementById("modalPaiement");
  const modalCredit = document.getElementById("modalCredit");

  if (modalPaiement && modalCredit) {
    // Fermer la modale Paiement
    modalPaiement.classList.add("hidden");

    // Ouvrir la modale Crédit
    modalCredit.classList.remove("hidden");

    // ✅ Mettre à jour la date à chaque ouverture
    const dateInput = document.getElementById("creditDueDate");
    if (dateInput) {
      const today = new Date().toISOString().split("T")[0];
      dateInput.value = today;
      dateInput.min = today;
    }
  }
}


function hideModalCredit() {
  document.getElementById("modalCredit").classList.add("hidden");
  document.getElementById("modalPaiement").classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  const formCredit = document.getElementById("formCredit");
  if (formCredit) {
    formCredit.addEventListener("submit", async (e) => {
      e.preventDefault();

      const creditData = {
        client_name: document.getElementById("creditClientName")?.value.trim(),
        client_phone: document.getElementById("creditClientPhone")?.value.trim(),
        due_date: document.getElementById("creditDueDate")?.value || null
      };

      if (!creditData.client_name || !creditData.client_phone) {
        showNotification("❌ Veuillez renseigner le nom et le téléphone du client.", "error");
        return;
      }

      await finaliserVente("credit", creditData);
      showNotification("✅ Crédit enregistré avec succès !", "success");
    });
  }
});


let chartCredits; // global

// === Initialisation du graphique crédits ===
let creditChart; // variable globale

function initCreditChart() {
  const ctx = document.getElementById("chartCredits");
  if (!ctx) return;

  creditChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [], // Dates
      datasets: [
        {
          label: "Total dû",
          data: [],
          borderColor: "rgba(139, 92, 246, 1)", // violet
          backgroundColor: "rgba(139, 92, 246, 0.2)",
          fill: true,
          tension: 0.3
        },
        {
          label: "Remboursé",
          data: [],
          borderColor: "rgba(34, 197, 94, 1)", // vert
          backgroundColor: "rgba(34, 197, 94, 0.2)",
          fill: true,
          tension: 0.3
        },
        {
          label: "Impayés",
          data: [],
          borderColor: "rgba(239, 68, 68, 1)", // rouge
          backgroundColor: "rgba(239, 68, 68, 0.2)",
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        title: { display: true, text: "Évolution des crédits" }
      },
      scales: {
        x: { title: { display: true, text: "Date" } },
        y: { title: { display: true, text: "Montant (F)" }, beginAtZero: true }
      }
    }
  });
}


// === Fonction afficherCredits ===
function afficherCredits() {
  console.log("📊 Credits récupérés:", appData.credits);

  // --- Calcul des totaux globaux ---
  const totalDu = appData.credits.reduce((s, c) => s + (c.total || 0), 0);
  const totalRembourse = appData.credits
    .filter(c => c.paid)
    .reduce((s, c) => s + (c.total || 0), 0);
  const totalImpayes = totalDu - totalRembourse;

  // --- Mise à jour des compteurs ---
  const elEncours = document.getElementById("creditsTotalEncours");
  if (elEncours) elEncours.textContent = totalDu.toLocaleString() + " F";

  const elRemb = document.getElementById("creditsTotalRembourses");
  if (elRemb) elRemb.textContent = totalRembourse.toLocaleString() + " F";

  const elImp = document.getElementById("creditsTotalImpaye");
  if (elImp) elImp.textContent = totalImpayes.toLocaleString() + " F";

  // --- Historique par date ---
  const dailyStats = {};
  appData.credits.forEach(c => {
    const date = (c.created_at ? new Date(c.created_at) : new Date()).toISOString().split("T")[0];
    if (!dailyStats[date]) {
      dailyStats[date] = { totalDu: 0, totalRembourse: 0, totalImpayes: 0 };
    }
    dailyStats[date].totalDu += c.total || 0;
    if (c.paid) {
      dailyStats[date].totalRembourse += c.total || 0;
    } else {
      dailyStats[date].totalImpayes += c.total || 0;
    }
  });

  const labels = Object.keys(dailyStats).sort();

  // --- Transformation en cumulatif ---
  let cumulDu = 0, cumulRemb = 0, cumulImp = 0;
  const dataDu = [];
  const dataRemb = [];
  const dataImp = [];

  labels.forEach(d => {
    cumulDu += dailyStats[d].totalDu;
    cumulRemb += dailyStats[d].totalRembourse;
    cumulImp += dailyStats[d].totalImpayes;

    dataDu.push(cumulDu);
    dataRemb.push(cumulRemb);
    dataImp.push(cumulImp);
  });

  // --- Création / mise à jour du graphique ---
  const ctx = document.getElementById("chartCredits")?.getContext("2d");
  if (ctx) {
    if (window.creditChart) {
      window.creditChart.destroy();
    }
    window.creditChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Total dû",
            data: dataDu,
            borderColor: "purple",
            backgroundColor: "rgba(128,0,128,0.2)",
            fill: true
          },
          {
            label: "Remboursé",
            data: dataRemb,
            borderColor: "green",
            backgroundColor: "rgba(0,128,0,0.2)",
            fill: true
          },
          {
            label: "Impayés",
            data: dataImp,
            borderColor: "red",
            backgroundColor: "rgba(255,0,0,0.2)",
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "top" },
          title: { display: true, text: "Évolution cumulée des crédits" }
        },
        interaction: {
          mode: "index",
          intersect: false
        }
      }
    });
  }

  // --- Mise à jour du tableau ---
  const body = document.getElementById("creditsHistoryBody");
  if (body) {
    body.innerHTML = "";
    appData.credits.forEach(c => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="p-2 border">${new Date(c.created_at).toLocaleDateString()}</td>
        <td class="p-2 border">${c.client_name || "-"}</td>
        <td class="p-2 border">${c.product_name || "-"}</td>
        <td class="p-2 border">${c.quantity}</td>
        <td class="p-2 border">${(c.total || 0).toLocaleString()} F</td>
        <td class="p-2 border">${c.due_date ? new Date(c.due_date).toLocaleDateString() : "-"}</td>
        <td class="p-2 border ${c.paid ? "text-green-600" : "text-red-600"}">
          ${c.paid ? "Payé" : "Non payé"}
        </td>
        <td class="p-2 border">
          ${c.paid ? "✔️" : `<button onclick="ouvrirModalRemboursement(${c.id})" class="bg-blue-500 text-white px-2 py-1 rounded">Rembourser</button>`}
        </td>
      `;
      body.appendChild(tr);
    });
  }
}




// ✅ Finaliser une vente à crédit
async function finaliserVenteCredit() {
  if (!appData.panier.length) {
    showNotification("❌ Panier vide.", "error");
    return;
  }

  // Récupérer les infos du formulaire crédit
  const clientName = document.getElementById("creditClientName")?.value.trim();
  const clientPhone = document.getElementById("creditClientPhone")?.value.trim();
  const dueDateInput = document.getElementById("creditDueDate");
  const dueDate = dueDateInput?.value || null;

  console.log("Infos crédit saisies :", { clientName, clientPhone, dueDate });

  if (!clientName || !clientPhone || !dueDate) {
    showNotification("⚠️ Merci de remplir toutes les informations du crédit.", "warning");
    return;
  }

  // Envoyer les ventes une par une
  for (const item of appData.panier) {
    const venteCredit = {
      product_id: item.id,
      quantity: item.quantite,
      payment_method: "credit", // ✅ Marqué comme crédit
      client_name: clientName,
      client_phone: clientPhone,
      due_date: dueDate,
      paid: false // ✅ Par défaut non payé
    };

    const created = await postSaleServer(venteCredit);
    if (!created) {
      showNotification("❌ Erreur lors de l'enregistrement de la vente à crédit.", "error");
      return;
    }
  }

  showNotification("✅ Vente à crédit enregistrée.", "success");

  // Vider le panier local
  appData.panier = [];
  saveAppDataLocal();

  // Recharger toutes les données depuis le serveur
  await syncFromServer();

  // Rafraîchir toute l'UI
  updateStats();
  afficherCategoriesVente();
  afficherProduits();
  afficherCategories();
  afficherRapports();
  afficherInventaire();
  afficherCredits();
  verifierStockFaible();

  // Ne ferme QUE le modal crédit
  hideModalCredit();
}

// ✅ Marquer un crédit comme payé
async function marquerCreditPaye(id) {
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

// 👉 Ouvrir le modal remboursement
function ouvrirModalRemboursement(saleId) {
  console.log("🟣 ouvrirModalRemboursement appelé avec saleId =", saleId);
  const modal = document.getElementById("modalRemboursement");
  document.getElementById("remboursementVenteId").value = saleId;

  modal.classList.remove("hidden");
  modal.style.display = "flex"; // ✅ force affichage en mode flex
}

window.ouvrirModalRemboursement = ouvrirModalRemboursement; // ✅ rendre global

// 👉 Fermer le modal
function hideModalRemboursement() {
  const modal = document.getElementById("modalRemboursement");
  modal.classList.add("hidden");
  modal.style.display = "none"; // ✅ force fermeture
  document.getElementById("remboursementVenteId").value = "";
}

window.hideModalRemboursement = hideModalRemboursement; // ✅ rendre global

// 👉 Confirmer le remboursement avec un mode de paiement choisi
async function confirmerRemboursement(method) {
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



function afficherStatsCredits() {
  const container = document.getElementById("creditsListe");
  if (!container) return;

  container.innerHTML = "";

  const credits = appData?.credits || [];

  if (!credits.length) {
    container.innerHTML = `<tr><td colspan="7" class="text-center text-gray-500 py-4">Aucun crédit enregistré</td></tr>`;
    return;
  }

  credits.forEach(c => {
    const produit = appData.produits?.find(p => p.id === parseInt(c.product_id));
    const produitName = produit ? produit.name : "Inconnu";

    const statut = c.paid ?
      `<span class="text-green-600 font-bold">Payé</span>` :
      `<span class="text-red-600 font-bold">Impayé</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="p-2 border">${c.client_name || "-"}</td>
      <td class="p-2 border">${c.client_phone || "-"}</td>
      <td class="p-2 border">${produitName}</td>
      <td class="p-2 border">${(c.total || 0).toLocaleString()} F</td>
      <td class="p-2 border">${c.due_date ? new Date(c.due_date).toLocaleDateString() : "-"}</td>
      <td class="p-2 border">${statut}</td>
      <td class="p-2 border text-center">
        ${!c.paid ? `
          <button class="bg-green-500 text-white px-2 py-1 rounded text-xs"
            onclick="marquerCreditPaye(${c.id})">✅ Marquer payé</button>
        ` : ""}
      </td>
    `;
    container.appendChild(tr);
  });
}

function marquerRembourse(venteId) {
  document.getElementById("remboursementVenteId").value = venteId;
  document.getElementById("modalRemboursement").classList.remove("hidden");
}

function remplirSelectProduitsCredit() {
  const select = document.getElementById('creditProduct');
  if (!select) return;

  // vider avant de recharger
  select.innerHTML = '';

  if (!appData.produits || appData.produits.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Aucun produit disponible';
    select.appendChild(opt);
    return;
  }

  appData.produits.forEach(prod => {
    const opt = document.createElement('option');
    opt.value = prod.id;
    opt.textContent = `${prod.name} (${prod.stock} dispo - ${prod.price}F)`;
    select.appendChild(opt);
  });
}

function logout() {
  localStorage.removeItem('authToken');
  window.location.replace('login.html');
}

let deferredPrompt;
const installBtn = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
  console.log("📲 Événement beforeinstallprompt déclenché !");
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove('hidden'); // Afficher le bouton
});

installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) {
    console.log("⚠️ Aucun prompt disponible (app peut déjà être installée)");
    return;
  }

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`✅ Résultat installation: ${outcome}`);
  deferredPrompt = null;
  installBtn.classList.add('hidden'); // Cacher après installation
});

// Juste pour debug
console.log("🔎 Script bouton d’installation chargé !");

function getCurrentUserId() {
  const id = localStorage.getItem("userId");
  return id ? parseInt(id, 10) : null;
}

async function handleAddProductClick() {
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

    // 🔎 Vérifier l’utilisateur connecté
    const userRes = await fetch(`${API_BASE}/auth/users`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!userRes.ok) throw new Error("Erreur API Utilisateurs " + userRes.status);

    const users = await userRes.json();
    const currentUser = users.find(u => u.id === userId);

    if (!currentUser) {
      showNotification("❌ Utilisateur introuvable", "error");
      return;
    }

    // 🚫 Cas 1 : Upgrade en attente = blocage total
    if (currentUser.upgrade_status === "en attente") {
      showNotification("⏳ Votre demande Premium est en attente de validation. Vous ne pouvez pas ajouter de produit pour le moment.", "warning");
      return;
    }

    // 🔄 Charger produits existants
    const prodRes = await fetch(`${API_BASE}/products`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!prodRes.ok) throw new Error("Erreur API Produits " + prodRes.status);

    const products = await prodRes.json();
    const userProducts = products.filter(p => p.user_id === userId);

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


function closePremiumModal() {
  document.getElementById("premiumModal").classList.add("hidden");
  document.getElementById("contactModal").classList.remove("hidden"); // ouvre le 2e modal immédiatement
}

function closeContactModal() {
  document.getElementById("contactModal").classList.add("hidden");
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

function showNotification(message, type = "info") {
  // Créer le conteneur si non existant
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  // Créer le toast
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  // Ajouter le toast au conteneur
  container.appendChild(toast);

  // Retirer après 4s
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function closeGuide() {
  document.getElementById("userGuide").style.display = "none";
  // ✅ On mémorise la fermeture
  localStorage.setItem("guideClosed", "true");
}

document.addEventListener("DOMContentLoaded", () => {
  // ✅ Vérifie si l’utilisateur a déjà fermé le guide
  if (localStorage.getItem("guideClosed") === "true") {
    document.getElementById("userGuide").style.display = "none";
  }
});

// ✅ Remplace confirm par une version moderne
function customConfirm(message) {
  return new Promise((resolve) => {
    // Créer l’overlay
    const overlay = document.createElement("div");
    overlay.id = "custom-confirm-overlay";

    // Contenu (avec backticks !)
    overlay.innerHTML = `
      <div class="custom-confirm-box">
        <p>${message}</p>
        <div class="custom-confirm-actions">
          <button class="custom-confirm-btn custom-confirm-yes">Confirmer</button>
          <button class="custom-confirm-btn custom-confirm-no">Annuler</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Boutons
    overlay.querySelector(".custom-confirm-yes").addEventListener("click", () => {
      resolve(true);
      overlay.remove();
    });
    overlay.querySelector(".custom-confirm-no").addEventListener("click", () => {
      resolve(false);
      overlay.remove();
    });
  });
}

// ✅ Polyfill : remplacer confirm natif
window.confirm = function (message) {
  console.log("⚡ confirm appelé avec :", message);
  return customConfirm(message);
};
