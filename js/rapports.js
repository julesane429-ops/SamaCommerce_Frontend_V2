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
  btn.addEventListener("click", generateRapportPDF);
}

export function generateRapportPDF() {
  if (!window.jspdf?.jsPDF) {
    window.showNotification?.('jsPDF non disponible', 'error');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W       = doc.internal.pageSize.getWidth();
  const now     = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
  const periode = document.getElementById('periodeRapports')?.value || 'tout';
  const boutique = localStorage.getItem('sc_company') ||
    document.getElementById('appHeader')?.textContent?.replace('🏪','').trim() || 'Sama Commerce';

  const VIOLET = [124, 58, 237];
  const GREEN  = [16, 185, 129];
  const RED    = [239, 68, 68];
  const GRAY   = [107, 114, 128];
  const DARK   = [30, 27, 75];
  const LIGHT  = [249, 250, 251];

  // ── EN-TÊTE ──
  doc.setFillColor(...VIOLET);
  doc.rect(0, 0, W, 35, 'F');
  doc.setFillColor(236, 72, 153);
  doc.triangle(W-40, 0, W, 0, W, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text(boutique, 14, 14);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('RAPPORT FINANCIER', 14, 22);
  doc.setFontSize(9);
  doc.text(`Période : ${periode} · Généré le ${dateStr}`, 14, 29);

  // ── KPIs ──
  let y = 46;
  const ventes = appData.ventes || [];
  const now0 = new Date(); now0.setHours(0,0,0,0);

  // Filtrer selon période
  const filterVentes = (v) => {
    const d = new Date(v.created_at);
    if (periode === 'jour')    return d >= now0;
    if (periode === 'semaine') return d >= new Date(now0 - 6*86400000);
    if (periode === 'mois')    return d >= new Date(now0.getFullYear(), now0.getMonth(), 1);
    return true;
  };
  const filtered = ventes.filter(filterVentes);
  const caEncaisse  = filtered.filter(v => v.paid).reduce((s,v) => s + (parseFloat(v.total)||0), 0);
  const caCredit    = filtered.filter(v => !v.paid).reduce((s,v) => s + (parseFloat(v.total)||0), 0);
  const nbVentes    = filtered.length;
  const panierMoyen = nbVentes > 0 ? caEncaisse / nbVentes : 0;

  // Répartition paiements
  const paiements = { especes: 0, wave: 0, orange: 0 };
  filtered.filter(v => v.paid).forEach(v => {
    const m = (v.payment_method||'').toLowerCase();
    if (paiements[m] !== undefined) paiements[m] += parseFloat(v.total)||0;
  });

  // Cartes KPI (2x2)
  const fmt = v => Math.round(v).toLocaleString('fr-FR') + ' F';
  const kpis = [
    { label: 'CA Encaissé',    value: fmt(caEncaisse),  color: GREEN },
    { label: 'CA Crédit',      value: fmt(caCredit),    color: RED   },
    { label: 'Nb Ventes',      value: nbVentes,         color: VIOLET},
    { label: 'Panier Moyen',   value: fmt(panierMoyen), color: GRAY  },
  ];

  const cardW = (W - 30) / 2;
  kpis.forEach((k, i) => {
    const cx = 10 + (i % 2) * (cardW + 10);
    const cy = y + Math.floor(i / 2) * 22;
    doc.setFillColor(...LIGHT);
    doc.roundedRect(cx, cy, cardW, 18, 3, 3, 'F');
    doc.setFillColor(...k.color);
    doc.rect(cx, cy, 3, 18, 'F');
    doc.setTextColor(...DARK); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(k.label.toUpperCase(), cx+7, cy+6);
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.setTextColor(...k.color);
    doc.text(String(k.value), cx+7, cy+14);
  });
  y += 50;

  // ── RÉPARTITION PAIEMENTS ──
  doc.setTextColor(...DARK); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('Répartition des paiements', 14, y); y += 6;
  doc.setDrawColor(229,231,235); doc.line(14, y, W-14, y); y += 5;

  const payRows = [
    ['💵 Espèces',      paiements.especes, caEncaisse],
    ['📱 Wave',         paiements.wave,    caEncaisse],
    ['📞 Orange Money', paiements.orange,  caEncaisse],
  ];
  payRows.forEach(([label, amount, total]) => {
    const pct = total > 0 ? Math.round((amount/total)*100) : 0;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY);
    doc.text(label, 14, y);
    doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold');
    doc.text(fmt(amount), W-50, y);
    doc.setTextColor(...GRAY); doc.setFont('helvetica', 'normal');
    doc.text(`${pct}%`, W-14, y, { align: 'right' });
    // Barre
    doc.setFillColor(229,231,235); doc.rect(14, y+2, W-28, 3, 'F');
    if (pct > 0) { doc.setFillColor(...VIOLET); doc.rect(14, y+2, (W-28)*pct/100, 3, 'F'); }
    y += 10;
  });
  y += 4;

  // ── TOP PRODUITS ──
  doc.setTextColor(...DARK); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('Top produits', 14, y); y += 6;
  doc.setDrawColor(229,231,235); doc.line(14, y, W-14, y); y += 3;

  const topMap = {};
  filtered.forEach(v => {
    const k = v.product_name || 'Inconnu';
    if (!topMap[k]) topMap[k] = { name: k, ca: 0, nb: 0 };
    topMap[k].ca += parseFloat(v.total)||0;
    topMap[k].nb += parseInt(v.quantity)||0;
  });
  const top5 = Object.values(topMap).sort((a,b) => b.ca - a.ca).slice(0,5);

  if (top5.length > 0 && doc.autoTable) {
    doc.autoTable({
      startY: y,
      head: [['Produit', 'Ventes', 'CA']],
      body: top5.map(p => [p.name, p.nb + ' unités', fmt(p.ca)]),
      styles:     { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: VIOLET, textColor: [255,255,255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: { 0: {cellWidth:'auto'}, 1:{cellWidth:30,halign:'center'}, 2:{cellWidth:35,halign:'right'} },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ── PIED DE PAGE ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(249,250,251); doc.rect(0, doc.internal.pageSize.getHeight()-12, W, 12, 'F');
    doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(`${boutique} · Rapport ${periode} · Page ${i}/${pageCount}`, W/2, doc.internal.pageSize.getHeight()-4, {align:'center'});
  }

  const filename = `rapport_${periode}_${now.toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
  window.showNotification?.('📄 Rapport PDF exporté', 'success');
}
