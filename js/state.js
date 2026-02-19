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
// state.js
export let _lastSalesKey = "";

export function setLastSalesKey(value) {
  _lastSalesKey = value;
}

export function getLastSalesKey() {
  return _lastSalesKey;
}

export let _isRenderingSalesHistory = false;

export function setIsRenderingSalesHistory(value) {
  _isRenderingSalesHistory = value;
}

export function getIsRenderingSalesHistory() {
  return _isRenderingSalesHistory;
}
export let chartVentesJourInstance = null;
export let deferredPrompt = null;
export let installBtn = document.getElementById('installBtn');

// ✅ currentSection corrigé pour pouvoir setter
export let currentSection = 'menu';
export function setCurrentSection(section) {
  currentSection = section;
}

export let chartCredits;
