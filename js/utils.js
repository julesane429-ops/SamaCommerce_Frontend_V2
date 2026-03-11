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


export function genererGraphiquesPDF(data) {

    const top = [...data]
        .sort((a,b)=>b.vendu-a.vendu)
        .slice(0,5);

    const ctxTop = document.getElementById("chartTopProduits").getContext("2d");

    new Chart(ctxTop,{
        type:"bar",
        data:{
            labels:top.map(p=>p.produit),
            datasets:[{
                label:"Produits vendus",
                data:top.map(p=>p.vendu),
                backgroundColor:"rgba(16,185,129,0.7)"
            }]
        },
        options:{responsive:false}
    });


    const rupture = data.filter(p=>p.stock===0).length;
    const faible = data.filter(p=>p.stock>0 && p.stock<=5).length;
    const normal = data.filter(p=>p.stock>5).length;

    const ctxStock = document.getElementById("chartStockAlert").getContext("2d");

    new Chart(ctxStock,{
        type:"pie",
        data:{
            labels:["Rupture","Stock faible","Stock normal"],
            datasets:[{
                data:[rupture,faible,normal],
                backgroundColor:[
                    "#ef4444",
                    "#f59e0b",
                    "#10b981"
                ]
            }]
        },
        options:{responsive:false}
    });

}

export function generateInventairePDF() {

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const date = new Date().toLocaleString("fr-FR");

    const rows = document.querySelectorAll("#inventaireListe tr");

    const data = [];

    rows.forEach(row=>{

        const cols=row.querySelectorAll("td");

        if(cols.length>=7){

            data.push({

                produit:cols[0].innerText,
                achat:cols[1].innerText,
                vente:cols[2].innerText,
                stock:parseInt(cols[3].innerText)||0,
                vendu:parseInt(cols[4].innerText)||0,
                profit:cols[5].innerText,
                profitNum:parseInt(cols[5].innerText.replace(/[^\d-]/g,""))||0,
                marge:cols[6].innerText

            });
        }

    });


    // ====================
    // STATISTIQUES
    // ====================

    const totalStock=data.reduce((s,p)=>s+p.stock,0);
    const totalVendu=data.reduce((s,p)=>s+p.vendu,0);
    const totalProfit=data.reduce((s,p)=>s+p.profitNum,0);
    const valeurStock=data.reduce((s,p)=>s+(p.stock*parseInt(p.achat)),0);


    // ====================
    // PAGE COUVERTURE
    // ====================

    doc.setFontSize(28);
    doc.text("RAPPORT INVENTAIRE",105,80,{align:"center"});

    doc.setFontSize(18);
    doc.text("Analyse des ventes",105,95,{align:"center"});

    doc.setFontSize(12);
    doc.text(`Date : ${date}`,105,120,{align:"center"});


    // ====================
    // PAGE STATISTIQUES
    // ====================

    doc.addPage();

    doc.setFontSize(20);
    doc.text("Indicateurs clés",20,20);

    doc.setFontSize(12);

    doc.text(`Produits : ${data.length}`,20,40);
    doc.text(`Stock total : ${totalStock}`,20,50);
    doc.text(`Articles vendus : ${totalVendu}`,20,60);
    doc.text(`Profit total : ${totalProfit.toLocaleString()} F`,20,70);
    doc.text(`Valeur du stock : ${valeurStock.toLocaleString()} F`,20,80);


    // ====================
    // TOP PRODUITS
    // ====================

    const top=[...data].sort((a,b)=>b.vendu-a.vendu).slice(0,10);

    doc.autoTable({

        startY:100,

        head:[["Produit","Vendues","Stock"]],

        body:top.map(p=>[

            p.produit,
            p.vendu,
            p.stock

        ]),

        headStyles:{fillColor:[16,185,129]}

    });


    // ====================
    // INVENTAIRE COMPLET
    // ====================

    doc.addPage();

    doc.text("Inventaire détaillé",20,20);

    doc.autoTable({

        startY:30,

        head:[[
            "Produit",
            "Achat",
            "Vente",
            "Stock",
            "Vendues",
            "Profit",
            "Marge"
        ]],

        body:data.map(p=>[

            p.produit,
            p.achat,
            p.vente,
            p.stock,
            p.vendu,
            p.profit,
            p.marge

        ]),

        theme:"striped",

        styles:{fontSize:9}

    });


    // ====================
    // GRAPHIQUE INVENTAIRE
    // ====================

    const canvas1=document.getElementById("chartInventaire");

    if(canvas1){

        const img=canvas1.toDataURL("image/png");

        doc.addPage();

        doc.text("Graphique inventaire",105,20,{align:"center"});

        doc.addImage(img,"PNG",15,40,180,100);

    }


    // ====================
    // PAGINATION
    // ====================

    const pages=doc.getNumberOfPages();

    for(let i=1;i<=pages;i++){

        doc.setPage(i);

        doc.setFontSize(10);

        doc.text(
            `Page ${i} / ${pages}`,
            105,
            290,
            {align:"center"}
        );
    }

    doc.save(`rapport_inventaire_${new Date().toISOString().split("T")[0]}.pdf`);

}

export function generateRapportsPDF() {

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const today = new Date().toLocaleString("fr-FR");

    // =========================
    // PAGE COUVERTURE
    // =========================

    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text("RAPPORT FINANCIER", 105, 90, { align: "center" });

    doc.setFontSize(16);
    doc.text("Analyse des ventes", 105, 105, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Généré le ${today}`, 105, 120, { align: "center" });

    // =========================
    // PAGE RESUME
    // =========================

    doc.addPage();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Résumé financier", 20, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");

    const jour = document.getElementById("recettesJour")?.innerText || "0";
    const semaine = document.getElementById("recettesSemaine")?.innerText || "0";
    const mois = document.getElementById("recettesMois")?.innerText || "0";
    const tout = document.getElementById("recettesTout")?.innerText || "0";

    const encaissé = document.getElementById("caEncaisse")?.innerText || "0";
    const attente = document.getElementById("caEnAttente")?.innerText || "0";
    const credits = document.getElementById("creditsEnCours")?.innerText || "0";
    const taux = document.getElementById("tauxRecouvrement")?.innerText || "0";

    doc.text(`Aujourd'hui : ${jour}`, 20, 40);
    doc.text(`Cette semaine : ${semaine}`, 20, 50);
    doc.text(`Ce mois : ${mois}`, 20, 60);
    doc.text(`Total général : ${tout}`, 20, 70);

    doc.text(`CA encaissé : ${encaissé}`, 20, 90);
    doc.text(`CA en attente : ${attente}`, 20, 100);
    doc.text(`Crédits en cours : ${credits}`, 20, 110);
    doc.text(`Taux recouvrement : ${taux}`, 20, 120);


    // =========================
    // PAIEMENTS
    // =========================

    const paiements = Object.entries(window.appData?.stats?.paiements || {})
        .map(([m, v]) => [m, v.toLocaleString() + " F"]);

    if (paiements.length) {

        doc.autoTable({
            startY: 140,
            head: [["Méthode de paiement", "Montant"]],
            body: paiements,
            headStyles: { fillColor: [16,185,129] }
        });

    }


    // =========================
    // HISTORIQUE VENTES
    // =========================

    const rows = document.querySelectorAll("#salesHistoryBody tr");

    const ventes = [];

    rows.forEach(row => {

        const cols = row.querySelectorAll("td");

        if (cols.length >= 5) {

            ventes.push([
                cols[0].innerText,
                cols[1].innerText,
                cols[2].innerText,
                cols[3].innerText,
                cols[4].innerText
            ]);

        }

    });

    doc.addPage();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Historique des ventes", 20, 20);

    doc.autoTable({

        startY: 30,

        head: [[
            "Date",
            "Produit",
            "Qté",
            "Montant",
            "Paiement"
        ]],

        body: ventes,

        theme: "striped",

        headStyles: {
            fillColor: [79,70,229]
        },

        styles: {
            fontSize: 9
        }

    });


    // =========================
    // GRAPHIQUES
    // =========================

    const charts = [
        "chartVentesByDay",
        "chartTopProduits",
        "chartPaiements",
        "chartStocksFaibles",
        "chartVentesJour"
    ];

    charts.forEach(id => {

        const canvas = document.getElementById(id);

        if (canvas) {

            const img = canvas.toDataURL("image/png", 1.0);

            doc.addPage();

            doc.setFontSize(16);
            doc.text(`Graphique : ${id}`, 105, 20, { align: "center" });

            doc.addImage(img, "PNG", 15, 40, 180, 100);

        }

    });


    // =========================
    // PAGINATION
    // =========================

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
