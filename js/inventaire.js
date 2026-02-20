// inventaire.js
import { appData } from "./state.js";
import { syncFromServer } from "./api.js"

let chartInventaireInstance = null;

// ---------- Affichage Inventaire ----------
export function afficherInventaire() {
  const tbody = document.getElementById("inventaireListe");
  const statsContainer = document.getElementById("inventaireStats");
  if (!tbody || !statsContainer) return;

  tbody.innerHTML = "";
  statsContainer.innerHTML = "";

  if (!appData.produits || appData.produits.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center text-gray-400 py-6">Aucun produit dans l’inventaire</td></tr>';
    return;
  }

  // --- Filtrage ---
  const termeRecherche = document.getElementById("searchInventaire")?.value.toLowerCase() || "";
  const filtreStock = document.getElementById("filterStock")?.value || "";
  const periode = document.getElementById("filterPeriode")?.value || "tout";

  let produitsFiltres = appData.produits
    .filter(p => (p.name || "").toLowerCase().includes(termeRecherche))
    .map(p => {
      let vendu = p.vendu || 0;

      if (periode !== "tout" && p.ventes) {
        const now = new Date();
        const ventesPeriode = p.ventes.filter(v => {
          const d = new Date(v.date || v.created_at);
          if (periode === "jour") return d.toDateString() === now.toDateString();
          if (periode === "semaine") {
            const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
            return d >= weekStart && d <= now;
          }
          if (periode === "mois") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          return true;
        });
        vendu = ventesPeriode.reduce((s, v) => s + (v.quantity || 0), 0);
      }

      return { ...p, vendu };
    })
    .filter(p => {
      if (filtreStock === "low") return p.stock <= 5 && p.stock > 0;
      if (filtreStock === "out") return p.stock === 0;
      return true;
    });

  if (produitsFiltres.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center text-gray-500 py-4">Aucun produit correspondant</td></tr>';
  }

  // --- Statistiques mini-cartes ---
  const totalStock = produitsFiltres.reduce((s, p) => s + (p.stock || 0), 0);
  const valeurStock = produitsFiltres.reduce((s, p) => s + (p.stock || 0) * (p.priceAchat || p.price_achat || 0), 0);
  const profitTotal = produitsFiltres.reduce((s, p) => s + ((p.vendu || 0) * ((p.price || 0) - (p.priceAchat || p.price_achat || 0))), 0);
  const margeMoyenne = produitsFiltres.length
    ? (produitsFiltres.reduce((s, p) => s + ((p.vendu || 0) * ((p.price || 0) - (p.priceAchat || p.price_achat || 0)) / ((p.priceAchat || p.price_achat) || 1)), 0) / produitsFiltres.length) * 100
    : 0;

  const stats = [
    { label: "Stock total", value: totalStock, color: "blue" },
    { label: "Valeur stock", value: valeurStock.toLocaleString() + " F", color: "green" },
    { label: "Profit total", value: profitTotal.toLocaleString() + " F", color: "purple" },
    { label: "Marge moyenne", value: margeMoyenne.toFixed(1) + " %", color: "orange" }
  ];

  stats.forEach(stat => {
    const div = document.createElement("div");
    div.className = `bg-${stat.color}-50 rounded-2xl p-4 shadow flex flex-col items-center`;
    div.innerHTML = `<div class="text-gray-600">${stat.label}</div>
                     <div class="text-xl font-bold text-${stat.color}-600 mt-1">${stat.value}</div>`;
    statsContainer.appendChild(div);
  });

  // --- Tableau inventaire ---
  produitsFiltres.forEach(p => {
    const prixAchat = p.priceAchat || p.price_achat || 0;
    const prixVente = p.price || 0;
    const stock = p.stock || 0;
    const vendu = p.vendu || 0;
    const profitRealise = vendu * (prixVente - prixAchat);
    const marge = prixAchat > 0 ? ((prixVente - prixAchat) / prixAchat * 100).toFixed(1) : 0;

    const stockClass = stock === 0 ? "text-red-600 font-bold" : stock <= 5 ? "text-orange-500 font-semibold" : "text-green-600 font-semibold";
    const profitClass = profitRealise >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold";
    const margeClass = marge >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold";

    const tr = document.createElement("tr");
    tr.className = "hover:bg-gray-50 transition";
    tr.innerHTML = `
      <td class="p-3 font-medium text-gray-800">${p.name}</td>
      <td class="p-3 text-right">${prixAchat.toLocaleString()} F</td>
      <td class="p-3 text-right">${prixVente.toLocaleString()} F</td>
      <td class="p-3 text-center ${stockClass}">${stock}</td>
      <td class="p-3 text-center">${vendu}</td>
      <td class="p-3 text-right ${profitClass}">${profitRealise.toLocaleString()} F</td>
      <td class="p-3 text-center ${margeClass}">${marge} %</td>
    `;
    tbody.appendChild(tr);
  });

  // --- Graphique inventaire ---
  const ctx = document.getElementById("chartInventaire")?.getContext("2d");
  if (ctx) {
    if (chartInventaireInstance) chartInventaireInstance.destroy();
    chartInventaireInstance = new window.Chart(ctx, {
      type: "bar",
      data: {
        labels: produitsFiltres.map(p => p.name),
        datasets: [
          { label: "Stock", data: produitsFiltres.map(p => p.stock || 0), backgroundColor: "rgba(59,130,246,0.6)" },
          { label: "Vendues", data: produitsFiltres.map(p => p.vendu || 0), backgroundColor: "rgba(16,185,129,0.6)" }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "top" } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }
}

// ---------- Setup inputs ----------
export function setupInventaireInputs() {
  const searchInput = document.getElementById("searchInventaire");
  const filterStock = document.getElementById("filterStock");
  const filterPeriode = document.getElementById("filterPeriode");

  if (searchInput) {
    searchInput.addEventListener("input", afficherInventaire);
  }

  if (filterStock) {
    filterStock.addEventListener("change", afficherInventaire);
  }

  if (filterPeriode) {
    filterPeriode.addEventListener("change", afficherInventaire);
  }
}

// ---------- Initialisation ----------
export async function initInventaire() {
  await syncFromServer();
  afficherInventaire();
  setupInventaireInputs();
}

export function remplirSelectProduitsCredit() {
  const select = document.getElementById('creditProduct');
  if (!select) return;

  // vider avant de recharger
  select.innerHTML = '';

  if (!appData.produits || appData.produits.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Aucun produit disponible';
    select.appendChild(opt);
    return;
  }

  appData.produits.forEach(prod => {
    const opt = document.createElement('option');
    opt.value = prod.id;
    opt.textContent = `${prod.name} (${prod.stock} dispo - ${prod.price}F)`;
    select.appendChild(opt);
  });
}
// ---------- Search handlers for inventory and categories ----------

export function setupSearchInputs() {
  var inv = document.getElementById('searchInventaire'); if (inv) { inv.addEventListener('input', function () { var term = this.value.toLowerCase(); document.querySelectorAll('#inventaireListe tr').forEach(function (row) { var prodName = (row.cells[0] && row.cells[0].textContent || '').toLowerCase(); row.style.display = prodName.indexOf(term) !== -1 ? '' : 'none'; }); }); }
  var cat = document.getElementById('searchCategorie'); if (cat) { cat.addEventListener('input', function () { var term = this.value.toLowerCase(); document.querySelectorAll('#listeCategories > div').forEach(function (div) { var catName = (div.textContent || '').toLowerCase(); div.style.display = catName.indexOf(term) !== -1 ? '' : 'none'; }); }); }
}
