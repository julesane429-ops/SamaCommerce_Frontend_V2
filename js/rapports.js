// rapports.js
import { appData } from "./state.js";
import { updateCharts, chartEvolutionCA} from "./charts.js";
import { tryRenderSalesHistory, filtrerVentesParPeriode } from "./ventes.js";
import { genererJournal } from "./utils.js";


export function updateStats() {
  if (!appData) return;
  const ventesTodayEl = document.getElementById('ventesToday'); if (ventesTodayEl) ventesTodayEl.textContent = appData.stats.ventesJour || 0;
  const chiffreEl = document.getElementById('chiffreAffaires'); if (chiffreEl) chiffreEl.textContent = (appData.stats.chiffreAffaires || 0).toLocaleString() + ' F';
  const articlesEl = document.getElementById('articlesVendus');
  if (articlesEl) articlesEl.textContent = appData.stats.articlesVendus || 0;
  const stockTotalEl = document.getElementById('stockTotal'); if (stockTotalEl) stockTotalEl.textContent = appData.produits.reduce(function (t, p) { return t + (parseInt(p.stock) || 0); }, 0);
}

export function afficherRapports() {
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

  // ==========================
  // 📊 STATISTIQUES COMPTABLES
  // ==========================

  let caEncaisse = 0;
  let caEnAttente = 0;
  let totalCredits = 0;
  let creditsPayes = 0;

  ventesFiltrees.forEach(v => {
    const montant = parseFloat(
      v.total || (v.price || 0) * (v.quantity || 0)
    ) || 0;

    if (v.paid) {
      caEncaisse += montant;
    }

    if (v.payment_method === "credit" && !v.paid) {
      caEnAttente += montant;
    }
  });

  // --- Stats crédits détaillés ---
  (appData.credits || []).forEach(c => {
    const montant = parseFloat(c.total || 0) || 0;
    totalCredits += montant;
    if (c.paid) creditsPayes += montant;
  });

  const creditsImpayes = totalCredits - creditsPayes;
  const tauxRecouvrement = totalCredits > 0
    ? ((creditsPayes / totalCredits) * 100).toFixed(1)
    : 0;

  // ==========================
  // 💉 Injection dans le DOM
  // ==========================

  document.getElementById("caEncaisse") &&
    (document.getElementById("caEncaisse").textContent =
      caEncaisse.toLocaleString() + " F");

  document.getElementById("caEnAttente") &&
    (document.getElementById("caEnAttente").textContent =
      caEnAttente.toLocaleString() + " F");

  document.getElementById("creditsEnCours") &&
    (document.getElementById("creditsEnCours").textContent =
      creditsImpayes.toLocaleString() + " F");

  document.getElementById("tauxRecouvrement") &&
    (document.getElementById("tauxRecouvrement").textContent =
      tauxRecouvrement + " %");
  if (tauxRecouvrement < 50) {
    document.getElementById("tauxRecouvrement").className = "text-xl font-bold text-red-600";
  } else if (tauxRecouvrement >= 50 && tauxRecouvrement < 80) {
    document.getElementById("tauxRecouvrement").className = "text-xl font-bold text-orange-600";
  } else {
    document.getElementById("tauxRecouvrement").className = "text-xl font-bold text-green-600";
  }
  // --- Calcul paiements filtrés (corrigé) ---
  const paiementsMap = {};

  ventesFiltrees.forEach(v => {
    // ❌ On ignore les ventes non payées
    if (!v.paid) return;

    // 💰 Montant
    const montant = parseFloat(
      v.total || (v.price || 0) * (v.quantity || 0)
    ) || 0;

    // ✅ Méthode réelle de paiement
    let method;

    if (v.payment_method === "credit") {
      // Si crédit remboursé → on prend la méthode de remboursement
      method = v.repayment_method || "inconnu";
    } else {
      method = v.payment_method || "inconnu";
    }

    // ❌ On ignore les crédits non remboursés
    if (!method || method === "credit") return;

    paiementsMap[method] = (paiementsMap[method] || 0) + montant;
  });

  appData.stats.paiements = paiementsMap;

  // --- Chiffre d’affaires ---
  const totalJour = filtrerVentesParPeriode(appData.ventes, 'jour')
    .reduce((s, v) => {
      if (!v.paid) return s;
      return s + (parseFloat(v.total) || (parseFloat(v.price) || 0) * (parseInt(v.quantity) || 0));
    }, 0);
  const totalSemaine = filtrerVentesParPeriode(appData.ventes, 'semaine')
    .reduce((s, v) => {
      if (!v.paid) return s;
      return s + (parseFloat(v.total) || (parseFloat(v.price) || 0) * (parseInt(v.quantity) || 0));
    }, 0);
  const totalMois = filtrerVentesParPeriode(appData.ventes, 'mois')
    .reduce((s, v) => {
      if (!v.paid) return s;
      return s + (parseFloat(v.total) || (parseFloat(v.price) || 0) * (parseInt(v.quantity) || 0));
    }, 0);
  const totalTout = filtrerVentesParPeriode(appData.ventes, 'tout')
    .reduce((s, v) => {
      if (!v.paid) return s;
      return s + (parseFloat(v.total) || (parseFloat(v.price) || 0) * (parseInt(v.quantity) || 0));
    }, 0);

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

  updateCharts(ventesFiltrees);
  chartEvolutionCA(ventesFiltrees);
  genererJournal(ventesFiltrees);

  // --- Crédits --- 
  if (appData?.credits?.length) {
    afficherStatsCredits();
  } else {
    console.warn("⏳ Données crédits pas encore prêtes ou vides");
  }
}

export function afficherStatsCredits() {
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

export function initRapportPDF() {
  const btn = document.getElementById("btnPdfRapports");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const periode = document.getElementById("periodeRapports").value;

    const caEncaisse = document.getElementById("caEncaisse").textContent;
    const caEnAttente = document.getElementById("caEnAttente").textContent;
    const credits = document.getElementById("creditsEnCours").textContent;
    const taux = document.getElementById("tauxRecouvrement").textContent;

    doc.setFontSize(18);
    doc.text("RAPPORT FINANCIER", 20, 20);

    doc.setFontSize(12);
    doc.text("Période: " + periode, 20, 35);

    doc.text("CA encaissé: " + caEncaisse, 20, 50);
    doc.text("CA en attente: " + caEnAttente, 20, 60);
    doc.text("Crédits en cours: " + credits, 20, 70);
    doc.text("Taux recouvrement: " + taux, 20, 80);

    let y = 100;
    doc.text("Répartition paiements :", 20, y);
    y += 10;

    Object.entries(appData.stats.paiements || {}).forEach(([m, v]) => {
      doc.text(`${m} : ${v.toLocaleString()} F`, 25, y);
      y += 8;
    });

    doc.save("rapport_financier.pdf");
  });
}
