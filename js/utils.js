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

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Inventaire & Bénéfices", 20, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${new Date().toLocaleString("fr-FR")}`, 20, 35);

    let startY = 50;

    const rows = document.querySelectorAll("#inventaireListe tr");

    rows.forEach((row, i) => {

        if (startY > 270) {
            doc.addPage();
            startY = 20;
        }

        const cols = row.querySelectorAll("td");

        if (cols.length >= 6) {
            doc.text(
                `${i + 1}. ${cols[0].innerText} | Achat: ${cols[1].innerText} | Vente: ${cols[2].innerText} | Stock: ${cols[3].innerText} | Vendues: ${cols[4].innerText} | Bénéfice: ${cols[5].innerText}`,
                20,
                startY
            );
            startY += 10;
        }
    });

    doc.save(`inventaire_${new Date().toISOString().split("T")[0]}.pdf`);
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
