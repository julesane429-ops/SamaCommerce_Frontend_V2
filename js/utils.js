import { 
  appData,
  chartVentesByDay, chartTopProduits, chartPaiements, chartStocksFaibles, creditChart,
  _lastSalesKey, _isRenderingSalesHistory, chartVentesJourInstance, deferredPrompt,
  installBtn, currentSection, setCurrentSection, chartCredits
} from "./state.js";

import { afficherRapports, updateStats, afficherStatsCredits } from "./rapports.js";
import { afficherInventaire, setupSearchInputs, remplirSelectProduitsCredit } from "./inventaire.js";
import { afficherCategoriesVente, afficherPanier, afficherProduits, afficherCategories, afficherCredits } from "./ui.js";
import { selectEmoji, supprimerCategorie, ajouterCategorie,remplirSelectCategories, afficherFiltresCategories } from "./categories.js";

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
