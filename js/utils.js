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

    const today = new Date().toLocaleString("fr-FR");

    // ===== TITRE =====
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Rapport Inventaire & Bénéfices", 105, 20, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Généré le : ${today}`, 105, 28, { align: "center" });


    // ===== STATISTIQUES =====
    const rows = document.querySelectorAll("#inventaireListe tr");

    let totalStock = 0;
    let totalProfit = 0;

    rows.forEach(row => {
        const cols = row.querySelectorAll("td");

        if (cols.length >= 6) {

            const stock = parseInt(cols[3].innerText) || 0;
            const profit = parseInt(cols[5].innerText.replace(/[^\d-]/g, "")) || 0;

            totalStock += stock;
            totalProfit += profit;
        }
    });

    doc.setFontSize(12);
    doc.text(`Stock total : ${totalStock}`, 20, 40);
    doc.text(`Profit total : ${totalProfit.toLocaleString()} F`, 20, 48);


    // ===== TABLEAU =====
    const tableData = [];

    rows.forEach(row => {

        const cols = row.querySelectorAll("td");

        if (cols.length >= 7) {

            tableData.push([
                cols[0].innerText,
                cols[1].innerText,
                cols[2].innerText,
                cols[3].innerText,
                cols[4].innerText,
                cols[5].innerText,
                cols[6].innerText
            ]);
        }
    });

    doc.autoTable({

        startY: 60,

        head: [[
            "Produit",
            "Prix Achat",
            "Prix Vente",
            "Stock",
            "Vendues",
            "Bénéfice",
            "Marge %"
        ]],

        body: tableData,

        theme: "striped",

        headStyles: {
            fillColor: [79, 70, 229]
        },

        styles: {
            fontSize: 10
        }
    });


    // ===== GRAPHIQUE =====
    const canvas = document.getElementById("chartInventaire");

    if (canvas) {

        const chartImage = canvas.toDataURL("image/png", 1.0);

        doc.addPage();

        doc.setFontSize(16);
        doc.text("Graphique Inventaire", 105, 20, { align: "center" });

        doc.addImage(chartImage, "PNG", 15, 40, 180, 100);
    }


    // ===== PIED DE PAGE =====
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


    // ===== EXPORT =====
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
