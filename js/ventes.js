// ventes.js
import { appData,chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits  } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { updateCharts, renderVentesChart, initCreditChart } from "./charts.js";
import { authfetch, postCategoryServer, postProductServer, syncFromServer } from "./api.js";
import { getCurrentUserId, logout } from "./auth.js";
import { selectEmoji, supprimerCategorie, ajouterCategorie,remplirSelectCategories, afficherFiltresCategories } from "./categories.js";
import { renderCreditsHistory,marquerCreditPaye, confirmerRemboursement, remplirProduitsCredit } from "./credits.js";
import { loadAppDataLocal, saveAppDataLocal, enqueueOutbox, processOutboxOne, processOutboxAll, updateHeader, getExpirationDate } from "./index.js";
import { showModal, hideModal, ouvrirModalEdit, showModalCredit, hideModalCredit, ouvrirModalRemboursement, hideModalRemboursement, showModalById, hideModalById, closePremiumModal, closeContactModal, closeGuide } from "./modal.js";
import { showNotification, customConfirm,  } from "./notification.js";
import { handleAddProductClick } from "./premium.js";
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente,afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";
import { showSection } from "./utils.js";

// ✅ Annuler une vente
export async function annulerVente(id) {
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

export async function modifierVente(id) {
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

// ✅ Finaliser une vente à crédit
export async function finaliserVenteCredit() {
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

export function ajouterAuPanier(produit) { if (!appData) return; const exist = appData.panier.find(function (i) { return i.id === produit.id; }); if (exist) { if (exist.quantite < produit.stock) exist.quantite++; else { alert('❌ Stock insuffisant!'); return; } } else appData.panier.push(Object.assign({}, produit, { quantite: 1 })); afficherPanier(); saveAppDataLocal(); }

export function afficherPanier() {
  const c = document.getElementById('panierItems'); const total = document.getElementById('totalPanier'); if (!c) return; if (!appData || !appData.panier || !appData.panier.length) { c.innerHTML = '<div class="text-gray-500 text-center py-8"><div class="text-4xl mb-2">🛒</div><div>Panier vide</div></div>'; if (total) total.textContent = '0 F'; return; }
  c.innerHTML = ''; var totalPrix = 0; appData.panier.forEach(function (item) {
    const div = document.createElement('div'); div.className = 'flex justify-between items-center bg-gray-50 rounded-2xl p-3'; div.innerHTML = '<div><div class="font-bold">' + item.name + '</div><div class="text-sm text-gray-600">' + (item.price || 0).toLocaleString() + ' F × ' + item.quantite + '</div></div><div class="flex items-center gap-2"><button class="bg-red-500 text-white w-8 h-8 rounded-full text-sm font-bold">-</button><span class="font-bold text-lg w-8 text-center">' + item.quantite + '</span><button class="bg-green-500 text-white w-8 h-8 rounded-full text-sm font-bold">+</button></div>'; // wire buttons
    c.appendChild(div);
    // attach handlers to +/- buttons
    const btns = div.querySelectorAll('button'); if (btns && btns.length >= 2) { btns[0].addEventListener('click', function () { modifierQuantitePanier(item.id, -1); }); btns[1].addEventListener('click', function () { modifierQuantitePanier(item.id, 1); }); }
    totalPrix += (item.price || 0) * item.quantite;
  }); if (total) total.textContent = totalPrix.toLocaleString() + ' F';
}

export function modifierQuantitePanier(id, delta) { if (!appData) return; const item = appData.panier.find(function (i) { return i.id === id; }); const produit = appData.produits.find(function (p) { return p.id === id; }); if (item) { item.quantite += delta; if (item.quantite <= 0) appData.panier = appData.panier.filter(function (i) { return i.id !== id; }); else if (produit && item.quantite > produit.stock) { item.quantite = produit.stock; alert('❌ Stock insuffisant!'); } afficherPanier(); saveAppDataLocal(); } }

export async function finaliserVente(paymentMethod) {
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
// Remplit le tbody unique sans jamais créer de nouvelle table
export function renderSalesHistory(ventes) {
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

export function tryRenderSalesHistory(ventesFiltrees) {
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

export function ouvrirModal(vente) {
  document.getElementById("venteId").value = vente.id;
  document.getElementById("venteQuantite").value = vente.quantity;
  document.getElementById("ventePaiement").value = vente.payment_method;

  document.getElementById("modalModifierVente").classList.remove("hidden");
  document.getElementById("modalModifierVente").classList.add("flex");
}

export function fermerModal() {
  document.getElementById("modalModifierVente").classList.add("hidden");
  document.getElementById("modalModifierVente").classList.remove("flex");
}

export function marquerRembourse(venteId) {
  document.getElementById("remboursementVenteId").value = venteId;
  document.getElementById("modalRemboursement").classList.remove("hidden");
}

// Supprime toute table "fantôme" créée ailleurs que #salesHistory
export function purgeSalesHistoryClones() {
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

export function filtrerVentesParPeriode(ventes, periode) {
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
