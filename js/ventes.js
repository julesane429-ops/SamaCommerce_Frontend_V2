// ventes.js
import { appData, chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart, _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt, installBtn, currentSection, chartCredits, getIsRenderingSalesHistory, setIsRenderingSalesHistory, getLastSalesKey, setLastSalesKey } from "./state.js";
import { afficherRapports, updateStats, afficherStatsCredits } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { updateCharts, initCreditChart } from "./charts.js";
// ✅ postSaleServer ajouté aux imports
import { authfetch, postCategoryServer, postProductServer, postSaleServer, syncFromServer } from "./api.js";
import { API_BASE } from "./api.js";
import { getCurrentUserId, logout } from "./auth.js";
import { selectEmoji, supprimerCategorie, ajouterCategorie, remplirSelectCategories, afficherFiltresCategories } from "./categories.js";
import { renderCreditsHistory, marquerCreditPaye, confirmerRemboursement, remplirProduitsCredit } from "./credits.js";
import { loadAppDataLocal, saveAppDataLocal, enqueueOutbox, processOutboxOne, processOutboxAll, updateHeader, getExpirationDate } from "./index.js";
import { showModal, hideModal, ouvrirModalEdit, showModalCredit, hideModalCredit, ouvrirModalRemboursement, hideModalRemboursement, showModalById, hideModalById, closePremiumModal, closeContactModal, closeGuide } from "./modal.js";
import { showNotification, customConfirm } from "./notification.js";
import { handleAddProductClick } from "./premium.js";
import { supprimerProduit, mettreAJourProduit, ajouterProduit, filtrerProduits, modifierStock } from "./produits.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente, afficherProduitsCategorie, verifierStockFaible, afficherCredits } from "./ui.js";
import { showSection } from "./utils.js";

// ✅ Annuler une vente
export async function annulerVente(id) {
  const ok = await confirm('❓ Annuler cette vente ?');
  if (!ok) {
    showNotification("❌ Annulation annulée", "warning");
    return;
  }

  window.haptic?.delete();

  try {
    const res = await authfetch(API_BASE + '/sales/' + id, { method: 'DELETE' });
    if (!res.ok) {
      window.haptic?.error();
      showNotification('❌ Erreur lors de l\'annulation de la vente.', 'error');
      return;
    }
    showNotification('✅ Vente annulée.', 'success');
    await syncFromServer();
    afficherRapports();
    updateStats();
  } catch (err) {
    console.error(err);
    window.haptic?.error();
    showNotification('❌ Impossible de contacter le serveur.', 'error');
  }
}

export async function modifierVente(id) {
  const vente = appData.ventes.find(v => Number(v.id) === Number(id));
  if (!vente) {
    showNotification("❌ Vente introuvable", 'error');
    return;
  }

  let newQuantity = prompt(
    `Quantité actuelle: ${vente.quantity}\n👉 Nouvelle quantité (laisser vide pour ne pas changer) :`
  );
  let newPayment = prompt(
    `Paiement actuel: ${vente.payment_method}\n👉 Nouveau mode de paiement (laisser vide pour ne pas changer) :`
  );

  const body = {};
  if (newQuantity && !isNaN(newQuantity)) body.quantity = Number(newQuantity);
  if (newPayment && newPayment.trim() !== '') body.payment_method = newPayment.trim();

  if (Object.keys(body).length === 0) {
    showNotification("⚠️ Aucun changement effectué.", 'warning');
    return;
  }

  try {
    const res = await authfetch(API_BASE + "/sales/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errData = await res.json();
      window.haptic?.error();
      showNotification("❌ Erreur : " + (errData.error || res.status), 'error');
      return;
    }

    window.haptic?.success();
    showNotification("✅ Vente modifiée avec succès !", 'success');
    syncFromServer();
  } catch (e) {
    console.error("Erreur modifierVente:", e);
    window.haptic?.error();
    showNotification("❌ Erreur réseau ou serveur", 'error');
  }
}

// ✅ Finaliser une vente à crédit
export async function finaliserVenteCredit() {
  if (!appData.panier.length) {
    showNotification("❌ Panier vide.", "error");
    return;
  }

  const clientName  = document.getElementById("creditClientName")?.value.trim();
  const clientPhone = document.getElementById("creditClientPhone")?.value.trim();
  const dueDate     = document.getElementById("creditDueDate")?.value || null;

  if (!clientName || !clientPhone || !dueDate) {
    showNotification("⚠️ Merci de remplir toutes les informations du crédit.", "warning");
    return;
  }

  // Copie du panier avant de le vider
  const panierCopy = appData.panier.map(i => ({ ...i }));

  // ── Optimistic : décrémenter le stock immédiatement ──
  for (const item of panierCopy) {
    const prod = appData.produits.find(p => p.id === item.id);
    if (prod) prod.stock = Math.max(0, prod.stock - item.quantite);
  }

  appData.panier = [];
  saveAppDataLocal();
  updateStats();
  afficherCategoriesVente();
  afficherProduits();
  hideModalCredit();

  window.haptic?.success();
  showNotification("✅ Crédit enregistré.", "success");

  // ── Envoi serveur en arrière-plan ──
  ;(async () => {
    for (const item of panierCopy) {
      const created = await postSaleServer({
        product_id: item.id,
        quantity: item.quantite,
        payment_method: "credit",
        client_name: clientName,
        client_phone: clientPhone,
        due_date: dueDate,
        paid: false,
      });
      if (!created) {
        showNotification("⚠️ Erreur de synchronisation — rechargement", 'warning');
        window.haptic?.error();
        await syncFromServer();
        updateStats();
        afficherProduits();
        afficherCredits();
        return;
      }
    }
    // Sync silencieux pour avoir les vraies IDs
    await syncFromServer();
    afficherCredits();
    verifierStockFaible();
  })();
}

// ✅ Ajouter au panier — avec haptique
export function ajouterAuPanier(produit) {
  if (!appData) return;

  const exist = appData.panier.find(i => i.id === produit.id);
  if (exist) {
    if (exist.quantite < produit.stock) {
      exist.quantite++;
      // Haptique double tap pour incrément
      window.haptic?.double();
    } else {
      window.haptic?.error();
      alert('❌ Stock insuffisant!');
      return;
    }
  } else {
    appData.panier.push(Object.assign({}, produit, { quantite: 1 }));
    // Haptique tap pour premier ajout
    window.haptic?.tap();
  }

  afficherPanier();
  saveAppDataLocal();
}

export function afficherPanier() {
  const c = document.getElementById('panierItems');
  const total = document.getElementById('totalPanier');
  if (!c) return;
  if (!appData || !appData.panier || !appData.panier.length) {
    c.innerHTML = '<div class="text-gray-500 text-center py-8"><div class="text-4xl mb-2">🛒</div><div>Panier vide</div></div>';
    if (total) total.textContent = '0 F';
    return;
  }
  c.innerHTML = '';
  var totalPrix = 0;
  appData.panier.forEach(function (item) {
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center bg-gray-50 rounded-2xl p-3';
    div.innerHTML = '<div><div class="font-bold">' + item.name + '</div><div class="text-sm text-gray-600">' + (parseFloat(item.price) || 0).toLocaleString() + ' F × ' + item.quantite + '</div></div><div class="flex items-center gap-2"><button class="bg-red-500 text-white w-8 h-8 rounded-full text-sm font-bold">-</button><span class="font-bold text-lg w-8 text-center">' + item.quantite + '</span><button class="bg-green-500 text-white w-8 h-8 rounded-full text-sm font-bold">+</button></div>';
    c.appendChild(div);
    const btns = div.querySelectorAll('button');
    if (btns && btns.length >= 2) {
      btns[0].addEventListener('click', function () { window.haptic?.tap(); modifierQuantitePanier(item.id, -1); });
      btns[1].addEventListener('click', function () { window.haptic?.tap(); modifierQuantitePanier(item.id, 1); });
    }
    totalPrix += (parseFloat(item.price) || 0) * (parseInt(item.quantite) || 0);
  });
  if (total) total.textContent = totalPrix.toLocaleString() + ' F';
}

export function modifierQuantitePanier(id, delta) {
  if (!appData) return;
  const item    = appData.panier.find(i => i.id === id);
  const produit = appData.produits.find(p => p.id === id);
  if (item) {
    item.quantite += delta;
    if (item.quantite <= 0) {
      appData.panier = appData.panier.filter(i => i.id !== id);
    } else if (produit && item.quantite > produit.stock) {
      item.quantite = produit.stock;
      window.haptic?.error();
      alert('❌ Stock insuffisant!');
    }
    afficherPanier();
    saveAppDataLocal();
  }
}

function genererNumeroRecu() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  let compteur = localStorage.getItem("compteurRecu") || 0;
  compteur++;
  localStorage.setItem("compteurRecu", compteur);
  return `RC-${y}${m}${d}-${String(compteur).padStart(4, "0")}`;
}

export function imprimerRecu(paymentMethod = "especes") {
  if (!appData.panier.length) return;

  const numeroRecu = genererNumeroRecu();
  const date = new Date().toLocaleString("fr-FR");
  let total = 0;

  let lignes = appData.panier.map(item => {
    const prix = parseFloat(item.price) || 0;
    const qte = item.quantite || 0;
    const sousTotal = prix * qte;
    total += sousTotal;
    return `
      <tr>
        <td>${item.name}</td>
        <td style="text-align:center">${qte}</td>
        <td style="text-align:right">${sousTotal.toLocaleString()} F</td>
      </tr>
    `;
  }).join("");

  const contenu = `
  <html>
  <head><title>Reçu</title>
  <style>
    body { font-family: monospace; width:300px; margin:auto; }
    h2 { text-align:center; margin-bottom:5px; }
    .center { text-align:center; }
    table { width:100%; font-size:12px; margin-top:10px; }
    td { padding:3px 0; }
    .total { font-weight:bold; font-size:16px; text-align:right; margin-top:10px; }
    hr { border-top:1px dashed black; }
  </style>
  </head>
  <body>
  <h2>🧾 REÇU</h2>
  <div class="center">Reçu N° : ${numeroRecu}</div>
  <div class="center">${date}</div>
  <hr>
  <table>${lignes}</table>
  <hr>
  <div class="total">TOTAL : ${total.toLocaleString()} F</div>
  <div class="center">Paiement : ${paymentMethod}</div>
  <br>
  <div class="center">Merci pour votre achat 🙏</div>
  </body>
  </html>`;

  const win = window.open("", "PRINT", "height=600,width=400");
  win.document.write(contenu);
  win.document.close();
  win.focus();
  win.print();
  win.close();

  document.getElementById("btnPrintReceipt")?.classList.add("hidden");
}

window.imprimerRecu = imprimerRecu;

// ══════════════════════════════════════════════════════
// ✅ finaliserVente — avec Optimistic UI + haptique
// ══════════════════════════════════════════════════════
export async function finaliserVente(paymentMethod) {
  if (paymentMethod === "credit") {
    showModalCredit();
    return;
  }

  if (!appData.panier.length) {
    showNotification('❌ Panier vide.', "error");
    return;
  }

  // ── Snapshot du panier avant toute modification ──
  const panierCopy = appData.panier.map(i => ({ ...i }));

  // ── 1. OPTIMISTIC : mettre à jour l'UI immédiatement ──

  // Décrémenter le stock localement
  for (const item of panierCopy) {
    const prod = appData.produits.find(p => p.id === item.id);
    if (prod) prod.stock = Math.max(0, prod.stock - item.quantite);
  }

  // Ajouter des ventes optimistic à l'historique local
  const now = new Date();
  const optimisticIds = [];
  for (const item of panierCopy) {
    const tempId = `opt_${Date.now()}_${item.id}`;
    optimisticIds.push(tempId);
    appData.ventes.unshift({
      id:             tempId,
      product_id:     item.id,
      product_name:   item.name,
      quantity:       item.quantite,
      total:          item.price * item.quantite,
      payment_method: paymentMethod,
      created_at:     now,
      paid:           true,
      _optimistic:    true,
    });
  }

  // Afficher le reçu (pendant que le panier est encore plein)
  document.getElementById("btnPrintReceipt")?.classList.remove("hidden");
  imprimerRecu(paymentMethod);

  // Haptique + notification immédiate
  window.haptic?.success();
  showNotification('✅ Vente enregistrée.', "success");

  // Vider le panier + fermer le modal
  appData.panier = [];
  saveAppDataLocal();
  hideModal();

  // Rafraîchir l'UI immédiatement avec les données optimistic
  updateStats();
  afficherCategoriesVente();
  afficherProduits();

  // ── 2. ENVOI SERVEUR en arrière-plan ──
  ;(async () => {
    let serverError = false;

    for (const item of panierCopy) {
      const created = await postSaleServer({
        product_id:     item.id,
        quantity:       item.quantite,
        payment_method: paymentMethod,
      });
      if (!created) {
        serverError = true;
        break;
      }
    }

    // Retirer toutes les entrées optimistic
    appData.ventes = appData.ventes.filter(v => !v._optimistic);

    if (serverError) {
      // Erreur → notifier + resync pour récupérer l'état réel
      window.haptic?.error();
      showNotification('⚠️ Erreur de synchronisation — rechargement', 'warning');
      await syncFromServer();
      updateStats();
      afficherProduits();
    } else {
      // Succès → sync silencieux pour avoir les vraies IDs et le stock exact
      await syncFromServer();
      updateStats();
    }
  })();
}

// Remplit le tbody unique sans jamais créer de nouvelle table
export function renderSalesHistory(ventes) {
  purgeSalesHistoryClones();

  const tbody = document.getElementById('salesHistoryBody');
  if (!tbody) return;

  const periode = document.getElementById('periodeRapports')?.value || 'tout';
  const key = `${periode}|${ventes?.length || 0}|${appData.produits?.length || 0}`;

  if (key === getLastSalesKey()) return;
  setLastSalesKey(key);

  tbody.innerHTML = '';

  if (!Array.isArray(ventes) || ventes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-500 p-4">Aucune vente</td></tr>`;
    return;
  }

  for (const v of ventes) {
    if (v._optimistic) continue; // ignorer les ventes en cours d'envoi
    const prod   = (appData.produits || []).find(p => Number(p.id) === Number(v.product_id));
    const unit   = Number(v.price ?? 0);
    const qty    = Number(v.quantity ?? 0);
    const montant = Number.isFinite(Number(v.total)) ? Number(v.total) : (unit * qty);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2 border">${new Date(v.date || v.created_at).toLocaleString()}</td>
      <td class="p-2 border">${v.product_name || (prod ? prod.name : 'Inconnu')}</td>
      <td class="p-2 border">${v.quantity ?? 0}</td>
      <td class="p-2 border">${(Number.isFinite(montant) ? montant : 0).toLocaleString()} F</td>
      <td class="p-2 border">${v.payment_method || ''}</td>
      <td class="p-2 border text-center">
        <button class="bg-yellow-500 text-white px-2 py-1 rounded text-xs" onclick="window.haptic?.tap();modifierVente(${v.id})">✏️</button>
        <button class="bg-red-500 text-white px-2 py-1 rounded text-xs" onclick="window.haptic?.delete();annulerVente(${v.id})">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

export function tryRenderSalesHistory(ventesFiltrees) {
  if (getIsRenderingSalesHistory()) return;
  setIsRenderingSalesHistory(true);
  try {
    if (!appData?.ventes?.length || !appData?.produits?.length) {
      const tbody = document.getElementById('salesHistoryBody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-500 p-4">Chargement…</td></tr>`;
    } else {
      renderSalesHistory(ventesFiltrees);
    }
  } finally {
    setIsRenderingSalesHistory(false);
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

export function purgeSalesHistoryClones() {
  const reports = document.getElementById('rapportsSection');
  const keep    = document.getElementById('salesHistory');
  if (!reports || !keep) return;

  reports.querySelectorAll('h1,h2,h3,h4').forEach(h => {
    if (/Historique des ventes/i.test(h.textContent) && !keep.contains(h)) {
      const box = h.closest('div');
      if (box && box !== keep) box.remove();
    }
  });

  reports.querySelectorAll('table').forEach(t => {
    if (keep.contains(t)) return;
    const headers  = Array.from(t.querySelectorAll('th')).map(th => th.textContent.trim().toLowerCase());
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
      const debut = new Date(now);
      debut.setDate(now.getDate() - now.getDay());
      debut.setHours(0, 0, 0, 0);
      return dateVente >= debut && dateVente <= now;
    }
    if (periode === 'mois') {
      return dateVente.getMonth() === now.getMonth() &&
             dateVente.getFullYear() === now.getFullYear();
    }
    return true;
  });
}
