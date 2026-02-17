(() => {
      const API_BASE = "https://ma-boutique-backend-3.onrender.com";

      document.addEventListener('DOMContentLoaded', () => {
        if (localStorage.getItem('authToken')) {
          window.location.href = 'index.html';
        }
      });

      document.getElementById('registerBtn')?.addEventListener('click', async () => {
        const username = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        const company_name = document.getElementById('companyName').value.trim();

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
            window.location.href = 'login.html';
          } else {
            showNotification('❌ Erreur : ' + (data.error || "Problème inconnu"), "error");
          }
        } catch (err) {
          console.error("Erreur lors de la requête:", err);
          showNotification("❌ Erreur de connexion au serveur.", "error");
        }
      });
    })();

    function closeRegisterGuide() {
      document.getElementById("registerGuideOverlay").style.display = "none";
      localStorage.setItem("registerGuideClosed", "true");
    }

    document.addEventListener("DOMContentLoaded", () => {
      if (localStorage.getItem("registerGuideClosed") === "true") {
        document.getElementById("registerGuideOverlay").style.display = "none";
      }
    });

    function showNotification(message, type = "info") {
      // Créer le conteneur si non existant
      let container = document.getElementById("toast-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
      }

      // Créer le toast
      const toast = document.createElement("div");
      toast.className = `toast ${type}`;
      toast.textContent = message;

      // Ajouter le toast au conteneur
      container.appendChild(toast);

      // Retirer après 4s
      setTimeout(() => {
        toast.remove();
      }, 4000);
    }