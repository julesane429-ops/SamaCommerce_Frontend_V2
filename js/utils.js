import { 
  appData,
  chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart,
  _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt,
  installBtn, currentSection, setCurrentSection, chartCredits
} from "./state.js";

import { afficherRapports, updateStats, afficherStatsCredits } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { afficherCategoriesVente, afficherProduits, afficherCategories, afficherCredits } from "./ui.js";
import { selectEmoji, supprimerCategorie, ajouterCategorie,remplirSelectCategories, afficherFiltresCategories } from "./categories.js";
import { annulerVente, renderSalesHistory, finaliserVenteCredit, ajouterAuPanier, afficherPanier, modifierQuantitePanier, finaliserVente, tryRenderSalesHistory, ouvrirModal, marquerRembourse, purgeSalesHistoryClones, filtrerVentesParPeriode, modifierVente  } from "./ventes.js";


export function showSection(section) {
  const sections = ['menu', 'vente', 'stock', 'categories', 'rapports', 'inventaire', 'credits'];
  sections.forEach(function (s) {
    const el = document.getElementById(s + 'Section');
    if (el) el.classList.add('hidden');
  });

  const target = document.getElementById(section + 'Section');
  if (target) target.classList.remove('hidden');

  const backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.style.display = (section === 'menu') ? 'none' : 'block';

  // ✅ utiliser le setter
  setCurrentSection(section);

  if (section === 'vente') {
    afficherCategoriesVente();
    afficherPanier();
  } else if (section === 'stock') {
    afficherProduits();
    afficherFiltresCategories();
  } else if (section === 'categories') {
    afficherCategories();
  } else if (section === 'rapports') {
    afficherRapports();
  } else if (section === 'inventaire') {
    afficherInventaire();
  } else if (section === 'menu') {
    updateStats();
  } else if (section === 'credits') {
    afficherCredits();
    remplirSelectProduitsCredit();
  }
}

window.showSection = showSection;

export function generateInventairePDF() {

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const date = new Date().toLocaleString("fr-FR");

    const rows = document.querySelectorAll("#inventaireListe tr");

    const data = [];

    rows.forEach(row => {

        const cols = row.querySelectorAll("td");

        if (cols.length >= 7) {

            data.push({
                produit: cols[0].innerText,
                achat: cols[1].innerText,
                vente: cols[2].innerText,
                stock: parseInt(cols[3].innerText) || 0,
                vendu: parseInt(cols[4].innerText) || 0,
                profit: cols[5].innerText,
                profitNum: parseInt(cols[5].innerText.replace(/[^\d-]/g, "")) || 0,
                marge: cols[6].innerText
            });
        }
    });


    // ===== STATISTIQUES =====

    const totalStock = data.reduce((s, p) => s + p.stock, 0);
    const totalVendu = data.reduce((s, p) => s + p.vendu, 0);
    const totalProfit = data.reduce((s, p) => s + p.profitNum, 0);

    const ruptures = data.filter(p => p.stock === 0);
    const stockFaible = data.filter(p => p.stock > 0 && p.stock <= 5);

    const topProduits = [...data]
        .sort((a, b) => b.vendu - a.vendu)
        .slice(0, 5);


    // ==============================
    // PAGE 1 — COUVERTURE
    // ==============================

    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("RAPPORT INVENTAIRE", 105, 80, { align: "center" });

    doc.setFontSize(18);
    doc.text("& BÉNÉFICES", 105, 95, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Généré le ${date}`, 105, 120, { align: "center" });

    doc.setFontSize(11);
    doc.text("Système de gestion des ventes", 105, 135, { align: "center" });


    // ==============================
    // PAGE 2 — STATISTIQUES
    // ==============================

    doc.addPage();

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Statistiques générales", 20, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");

    doc.text(`Produits en inventaire : ${data.length}`, 20, 40);
    doc.text(`Stock total : ${totalStock}`, 20, 50);
    doc.text(`Produits vendus : ${totalVendu}`, 20, 60);
    doc.text(`Profit total : ${totalProfit.toLocaleString()} F`, 20, 70);
    doc.text(`Produits en rupture : ${ruptures.length}`, 20, 80);
    doc.text(`Produits stock faible : ${stockFaible.length}`, 20, 90);


    // ==============================
    // TOP PRODUITS
    // ==============================

    const topTable = topProduits.map(p => [
        p.produit,
        p.vendu,
        p.stock
    ]);

    doc.autoTable({
        startY: 110,
        head: [["Produit", "Vendues", "Stock restant"]],
        body: topTable,
        headStyles: { fillColor: [16, 185, 129] }
    });


    // ==============================
    // PRODUITS EN RUPTURE
    // ==============================

    if (ruptures.length > 0) {

        doc.addPage();

        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("Produits en rupture", 20, 20);

        const ruptureTable = ruptures.map(p => [
            p.produit,
            p.vendu
        ]);

        doc.autoTable({
            startY: 35,
            head: [["Produit", "Vendues"]],
            body: ruptureTable,
            headStyles: { fillColor: [239, 68, 68] }
        });
    }


    // ==============================
    // INVENTAIRE COMPLET
    // ==============================

    doc.addPage();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Inventaire complet", 20, 20);

    const fullTable = data.map(p => [
        p.produit,
        p.achat,
        p.vente,
        p.stock,
        p.vendu,
        p.profit,
        p.marge
    ]);

    doc.autoTable({

        startY: 30,

        head: [[
            "Produit",
            "Achat",
            "Vente",
            "Stock",
            "Vendues",
            "Bénéfice",
            "Marge %"
        ]],

        body: fullTable,

        theme: "striped",

        headStyles: {
            fillColor: [79, 70, 229]
        },

        styles: {
            fontSize: 9
        }
    });


    // ==============================
    // GRAPHIQUE
    // ==============================

    const canvas = document.getElementById("chartInventaire");

    if (canvas) {

        const chartImage = canvas.toDataURL("image/png", 1.0);

        doc.addPage();

        doc.setFontSize(18);
        doc.text("Graphique inventaire", 105, 20, { align: "center" });

        doc.addImage(chartImage, "PNG", 15, 40, 180, 100);
    }


    // ==============================
    // PAGINATION
    // ==============================

    const pages = doc.getNumberOfPages();

    for (let i = 1; i <= pages; i++) {

        doc.setPage(i);

        doc.setFontSize(10);

        doc.text(
            `Page ${i} / ${pages}`,
            105,
            290,
            { align: "center" }
        );
    }


    // ==============================
    // EXPORT
    // ==============================

    doc.save(`rapport_inventaire_${new Date().toISOString().split("T")[0]}.pdf`);
}

export function generateRapportsPDF() {

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Rapport des Chiffres", 20, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${new Date().toLocaleString("fr-FR")}`, 20, 35);

    let y = 50;

    // 🔹 Résumé
    doc.setFont("helvetica", "bold");
    doc.text("Résumé :", 20, y);
    y += 10;

    doc.setFont("helvetica", "normal");

    const jour = document.getElementById("recettesJour")?.innerText || "0";
    const semaine = document.getElementById("recettesSemaine")?.innerText || "0";
    const mois = document.getElementById("recettesMois")?.innerText || "0";
    const tout = document.getElementById("recettesTout")?.innerText || "0";

    doc.text(`Aujourd'hui : ${jour}`, 30, y); y += 10;
    doc.text(`Cette semaine : ${semaine}`, 30, y); y += 10;
    doc.text(`Ce mois : ${mois}`, 30, y); y += 10;
    doc.text(`Total général : ${tout}`, 30, y); y += 15;

    // 🔹 Historique ventes
    doc.setFont("helvetica", "bold");
    doc.text("Historique des ventes :", 20, y);
    y += 10;

    doc.setFont("helvetica", "normal");

    const rows = document.querySelectorAll("#salesHistoryBody tr");

    rows.forEach((row, i) => {

        if (y > 270) {
            doc.addPage();
            y = 20;
        }

        const cols = row.querySelectorAll("td");

        if (cols.length >= 5) {
            doc.text(
                `${i + 1}. ${cols[0].innerText} | ${cols[1].innerText} | Qté: ${cols[2].innerText} | ${cols[3].innerText} | ${cols[4].innerText}`,
                20,
                y
            );
            y += 8;
        }
    });

    doc.save(`rapport_chiffres_${new Date().toISOString().split("T")[0]}.pdf`);
}

export function genererJournal(ventes) {
  const container = document.getElementById("journalComptable");
  if (!container) return;

  container.innerHTML = "";

  ventes.forEach(v => {
    const montant = v.total || (v.price || 0) * (v.quantity || 0);
    const statut = v.paid ? "Encaissement" : "Créance";

    // ✅ Gestion propre de la date
    const rawDate = v.date || v.created_at || v.timestamp;
    const dateObj = rawDate ? new Date(rawDate) : null;

    const dateAffichee =
      dateObj && !isNaN(dateObj)
        ? dateObj.toLocaleDateString()
        : "—";

    const div = document.createElement("div");
    div.className = "flex justify-between border-b py-1";
    div.innerHTML = `
      <div>${dateAffichee}</div>
      <div>${statut}</div>
      <div>${montant.toLocaleString()} F</div>
    `;

    container.appendChild(div);
  });
}
