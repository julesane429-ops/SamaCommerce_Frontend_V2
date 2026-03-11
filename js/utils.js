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
