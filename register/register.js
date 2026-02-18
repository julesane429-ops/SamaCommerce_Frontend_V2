(() => {
  const API_BASE = "https://samacommerce-backend-v2.onrender.com";

  // ⚡ Fonction de notification
  function showNotification(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // ⚡ Tout le DOM ready
  document.addEventListener('DOMContentLoaded', () => {

    // 🔹 Redirection si déjà connecté
    if (localStorage.getItem('authToken')) {
      window.location.href = 'index.html';
      return;
    }

    // 🔹 Bouton Créer un compte
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
      registerBtn.addEventListener('click', async (e) => {
        e.preventDefault(); // ⚡ éviter le refresh du formulaire

        const username = document.getElementById('email')?.value.trim();
        const password = document.getElementById('password')?.value.trim();
        const company_name = document.getElementById('companyName')?.value.trim();

        if (!username || !password || !company_name) {
          showNotification('Veuillez remplir tous les champs.', "warning");
          return;
        }

        try {
          const res = await fetch(API_BASE + '/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, company_name })
          });

          const data = await res.json();

          if (res.ok) {
            showNotification('✅ Compte créé avec succès ! Connectez-vous.', "success");
            setTimeout(() => window.location.href = '/login/login.html', 500);
          } else {
            showNotification('❌ Erreur : ' + (data.error || "Problème inconnu"), "error");
          }
        } catch (err) {
          console.error("Erreur lors de la requête:", err);
          showNotification("❌ Erreur de connexion au serveur.", "error");
        }
      });
    }

    // 🔹 Gestion du guide d'inscription
    const registerGuide = document.getElementById("registerGuideOverlay");
    if (registerGuide && localStorage.getItem("registerGuideClosed") === "true") {
      registerGuide.style.display = "none";
    }
  });

  // 🔹 Fonction pour fermer le guide d'inscription
  window.closeRegisterGuide = function() {
    const registerGuide = document.getElementById("registerGuideOverlay");
    if (registerGuide) registerGuide.style.display = "none";
    localStorage.setItem("registerGuideClosed", "true");
  };
})();
