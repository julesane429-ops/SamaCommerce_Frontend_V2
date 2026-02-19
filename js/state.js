export let appData = {
  ventes: [],
  produits: [],
  categories: [],
  credits: [],
  panier: [],
  stats: {
    paiements: {},
    historique: []
  }
};

export let chartVentesByDay = null;
export let chartTopProduits = null;
export let chartPaiements = null;
export let chartStocksFaibles = null;
export let creditChart = null;
export let _lastSalesKey = "";
export let _isRenderingSalesHistory = false;
export let chartVentesJourInstance = null;
export let deferredPrompt = null;
export let installBtn = document.getElementById('installBtn');

// ✅ currentSection corrigé pour pouvoir setter
export let currentSection = 'menu';
export function setCurrentSection(section) {
  currentSection = section;
}

export let chartCredits;
