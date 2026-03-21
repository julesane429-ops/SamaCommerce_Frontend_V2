// ==========================
// IMPORTS
// ==========================
import { appData } from "./state.js";

import { afficherRapports, updateStats, initRapportPDF } from "./rapports.js";
import { afficherInventaire, setupSearchInputs,initInventaire } from "./inventaire.js";
import { initCreditChart } from "./charts.js";
import { authfetch, syncFromServer } from "./api.js";
import { renderCreditsHistory, remplirProduitsCredit } from "./credits.js";
import { loadAppDataLocal, getExpirationDate } from "./index.js";
import { hideModalCredit, fermerModal, closeGuide } from "./modal.js";
import { showNotification } from "./notification.js";
import { afficherCategories, afficherProduits, afficherCategoriesVente, verifierStockFaible, afficherCredits } from "./ui.js";
import { finaliserVente } from "./ventes.js";
import { showSection } from "./utils.js";

// ==========================
// CONFIG
// ==========================
const API_BASE = document.querySelector('meta[name="api-base"]')?.content;

// ==========================
// INIT PRINCIPAL
// ==========================
document.addEventListener("DOMContentLoaded", async () => {

  // ======================
  // 0️⃣ Vérifier le token JWT (ne jamais faire confiance à localStorage.userRole seul)
  // ======================
  const _token = localStorage.getItem('authToken');
  if (!_token) { window.location.replace('/login/login.html'); return; }
  try {
    const _payload = JSON.parse(atob(_token.split('.')[1]));
    const _now     = Math.floor(Date.now() / 1000);
    if (_payload.exp && _payload.exp < _now) {
      localStorage.removeItem('authToken');
      window.location.replace('/login/login.html?expired=1');
      return;
    }
    // Synchroniser le rôle depuis le token (source de vérité) et non localStorage
    const _roleFromToken = (_payload.role || 'user').toLowerCase();
    localStorage.setItem('userRole', _roleFromToken);
  } catch (_) {
    localStorage.removeItem('authToken');
    window.location.replace('/login/login.html');
    return;
  }

  // ======================
  // 1️⃣ Chargement local
  // ======================
  loadAppDataLocal();

  updateStats();
  verifierStockFaible();
  afficherCategoriesVente();
  afficherProduits();
  afficherCategories();
  afficherRapports();
  afficherInventaire();
  afficherCredits();

  setupSearchInputs();
  initCreditChart();
  remplirProduitsCredit();
  renderCreditsHistory();

  // ======================
  // 2️⃣ Sync serveur initial
  // ======================
  // Afficher le syncBanner si la sync prend plus de 600ms (réseau lent)
  const _syncTimer = setTimeout(() => {
    const banner = document.getElementById('syncBanner');
    if (banner) {
      banner.textContent = '🔄 Chargement des données…';
      banner.style.display = 'block';
    }
  }, 600);

  await syncFromServer();
  clearTimeout(_syncTimer);

  window.hideSplash?.();
  window.scNotifications?.check();
  updateStats();
  verifierStockFaible();
  afficherCategoriesVente();
  afficherProduits();
  afficherCategories();
  afficherRapports();
  afficherInventaire();

  console.log("📦 Crédits après sync :", appData.credits);

  // ======================
  // 3️⃣ Date expiration Premium
  // ======================
  const expirationInput = document.getElementById("expiration");
  const expirationDisplay = document.getElementById("expiration_display");

  if (expirationInput && expirationDisplay) {
    const expDate = getExpirationDate();
    expirationInput.value = expDate;

    const [year, month, day] = expDate.split("-");
    expirationDisplay.value = `Expire le : ${day}/${month}/${year}`;
  }

  // ======================
  // 4️⃣ Auto refresh 30s
  // ======================
  setInterval(async () => {
    await syncFromServer();
    updateStats();
    verifierStockFaible();
    afficherCategoriesVente();
    afficherProduits();
    afficherCategories();
    afficherRapports();
    afficherInventaire();

    console.log("♻️ Refresh auto OK");
  }, 30000);

  // ======================
  // 5️⃣ Changement période rapports
  // ======================
  const periodeRapports = document.getElementById('periodeRapports');
  if (periodeRapports) {
    periodeRapports.addEventListener('change', afficherRapports);
  }

    initInventaire();

  // ======================
  // 6️⃣ Enregistrement crédit (modal)
  // ======================
  const enregistrerCreditBtn = document.querySelector('#modalCredit button.bg-purple-600');

  if (enregistrerCreditBtn) {
    enregistrerCreditBtn.addEventListener('click', async () => {

      const clientName = document.getElementById('creditClientName')?.value.trim();
      const clientPhone = document.getElementById('creditClientPhone')?.value.trim();
      const dueDate = document.getElementById('creditDueDate')?.value;

      if (!clientName || !clientPhone || !dueDate) {
        showNotification("⚠️ Merci de remplir toutes les informations du crédit.", "warning");
        return;
      }

      const creditData = {
        client_name: clientName,
        client_phone: clientPhone,
        due_date: dueDate,
      };

      await finaliserVente("credit", creditData);
      hideModalCredit();
    });
  }

  // ======================
  // 7️⃣ Formulaire crédit simple
  // ======================
  const creditForm = document.getElementById("creditForm");

  if (creditForm) {
    creditForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const client = document.getElementById("creditClient")?.value.trim();
      const product_id = document.getElementById("creditProduct")?.value;
      const quantity = parseInt(document.getElementById("creditQuantity")?.value, 10);
      const due_date = document.getElementById("creditDueDate")?.value;

      if (!client || !product_id || !quantity || quantity <= 0) {
        showNotification("❌ Veuillez remplir tous les champs correctement.", "error");
        return;
      }

      const produit = appData.produits.find(p => p.id == product_id);
      if (!produit) {
        showNotification("❌ Produit introuvable.", "error");
        return;
      }

      const montant = (produit.price || 0) * quantity;

      appData.credits.push({
        id: Date.now(),
        date: new Date().toISOString(),
        client,
        product_id,
        product_name: produit.name,
        quantity,
        montant,
        due_date,
        status: "non payé"
      });

      renderCreditsHistory();
      creditForm.reset();
      showNotification("✅ Vente à crédit enregistrée !", "success");
    });
  }

  // ======================
  // 8️⃣ Modifier vente
  // ======================
  const formModifier = document.getElementById("formModifierVente");

  if (formModifier && API_BASE) {
    formModifier.addEventListener("submit", async (e) => {
      e.preventDefault();

      const id = document.getElementById("venteId")?.value;
      const quantity = parseInt(document.getElementById("venteQuantite")?.value, 10);
      const payment_method = document.getElementById("ventePaiement")?.value;

      if (!id || !quantity || quantity <= 0 || !payment_method) {
        showNotification("❌ Champs invalides.", "error");
        return;
      }

      try {
        const res = await authfetch(`${API_BASE}/sales/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity, payment_method })
        });

        if (!res.ok) throw new Error();

        showNotification("✅ Vente modifiée avec succès", "success");
        fermerModal();
        await syncFromServer();

      } catch (err) {
        console.error(err);
        showNotification("❌ Erreur lors de la modification", "error");
      }
    });
  }

  // ======================
  // 9️⃣ Message session expirée
  // ======================
  const params = new URLSearchParams(window.location.search);
  if (params.get('expired') === '1') {
    showNotification("⚠️ Votre session a expiré. Veuillez vous reconnecter.", "warning");
  }

  // ======================
  // 🔟 Guide utilisateur
  // ======================

  const btnCloseGuide = document.getElementById("btnCloseGuide");

  if (btnCloseGuide) {
    btnCloseGuide.addEventListener("click", closeGuide);
  }

  if (localStorage.getItem("guideClosed") === "true") {
    const guide = document.getElementById("userGuide");
    if (guide) guide.style.display = "none";
  }

  // Tous les boutons principaux
  document.querySelectorAll('.big-button[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      showSection(section);
    });
  });

  // Bouton retour
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => showSection('menu'));
  }
  /// PDF boutons
  const btnInv = document.getElementById("btnPdfInventaire");
  if (btnInv) {
    btnInv.addEventListener("click", generateInventairePDF);
  }

  const btnRap = document.getElementById("btnPdfRapports");
  if (btnRap) {
    btnRap.addEventListener("click", generateRapportsPDF);
  }

  initRapportPDF();

});
