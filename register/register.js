// register.js
(() => {
  const API_BASE = "https://samacommerce-backend-v2.onrender.com";

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

  document.addEventListener('DOMContentLoaded', () => {

    // Redirection si déjà connecté
    if (localStorage.getItem('authToken')) {
      window.location.href = '/index.html';
      return;
    }

    // ── Lire le token d'invitation dans l'URL ──
    const urlParams   = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite');
    const inviteEmail = urlParams.get('email');

    // Bandeau invitation
    if (inviteToken) {
      const banner = document.createElement('div');
      banner.style.cssText = `
        background:linear-gradient(135deg,#EDE9FE,#FCE7F3);
        border-radius:12px;padding:12px 14px;
        text-align:center;font-size:13px;font-weight:700;
        color:#7C3AED;margin-bottom:16px;line-height:1.4;
      `;
      banner.innerHTML = `🔗 Créez votre compte pour rejoindre la boutique.<br>
        <span style="font-weight:500;font-size:12px;">L'invitation sera acceptée automatiquement.</span>`;
      const title = document.querySelector('.section-title');
      if (title) title.after(banner);

      // Pré-remplir l'email
      if (inviteEmail) {
        const emailInput = document.getElementById('email');
        if (emailInput) {
          emailInput.value    = decodeURIComponent(inviteEmail);
          emailInput.readOnly = true; // l'email doit correspondre à l'invitation
          emailInput.style.background = '#F5F3FF';
        }
      }
    }

    // ── Bouton Créer un compte ──
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
      registerBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        const username     = document.getElementById('email')?.value.trim();
        const password     = document.getElementById('password')?.value.trim();
        const company_name = document.getElementById('companyName')?.value.trim();

        if (!username || !password || !company_name) {
          showNotification('Veuillez remplir tous les champs.', "warning");
          return;
        }

        registerBtn.disabled    = true;
        registerBtn.textContent = '⏳ Création en cours…';

        try {
          // 1. Créer le compte
          const res = await fetch(API_BASE + '/auth/register', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ username, password, company_name }),
          });

          const rawText = await res.text();
          let data;
          try { data = JSON.parse(rawText); }
          catch { data = { error: "Réponse non JSON" }; }

          if (!res.ok) {
            showNotification('❌ ' + (data.error || "Problème inconnu"), "error");
            return;
          }

          showNotification('✅ Compte créé avec succès !', "success");

          // 2. Si invitation → connexion automatique puis acceptation
          if (inviteToken) {
            showNotification('🔗 Connexion automatique pour accepter l\'invitation…', "info");

            const loginRes = await fetch(API_BASE + '/auth/login', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ username, password }),
            });
            const loginData = await loginRes.json();

            if (loginRes.ok && loginData.token) {
              const authToken = loginData.token;
              const userRole  = (loginData.user?.role || "user").trim().toLowerCase();

              localStorage.setItem('authToken', authToken);
              localStorage.setItem('userRole',  userRole);
              localStorage.setItem('userId',    loginData.user?.id);

              // Accepter l'invitation
              const acceptRes = await fetch(`${API_BASE}/members/accept`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
                body:    JSON.stringify({ invite_token: inviteToken }),
              });
              const acceptData = await acceptRes.json();

              if (acceptRes.ok) {
                showNotification(
                  `✅ Vous avez rejoint "${acceptData.boutique?.company_name || 'la boutique'}" !`,
                  "success"
                );
                localStorage.setItem('inviteBoutiqueId',   acceptData.boutique?.id);
                localStorage.setItem('inviteBoutiqueName', acceptData.boutique?.company_name || '');
                localStorage.setItem('employeeRole',       acceptData.role || 'employe');
              } else {
                showNotification(acceptData.error || "Invitation expirée, contactez le propriétaire.", "warning");
              }

              setTimeout(() => window.location.replace('/index.html'), 1000);
            } else {
              // Connexion auto échouée → renvoyer vers login avec le token
              showNotification("Compte créé ! Connectez-vous pour finaliser.", "success");
              setTimeout(() => {
                window.location.href = `/login/login.html?invite=${inviteToken}&email=${encodeURIComponent(username)}`;
              }, 1500);
            }

          } else {
            // Pas d'invitation → redirection vers login normale
            setTimeout(() => window.location.href = '/login/login.html', 1000);
          }

        } catch (err) {
          console.error("Erreur register:", err);
          showNotification("❌ Erreur de connexion au serveur.", "error");
        } finally {
          registerBtn.disabled    = false;
          registerBtn.textContent = 'Créer mon compte';
        }
      });
    }

    // Guide d'inscription
    const registerGuide = document.getElementById("registerGuideOverlay");
    if (registerGuide && localStorage.getItem("registerGuideClosed") === "true") {
      registerGuide.style.display = "none";
    }
  });

  window.closeRegisterGuide = function () {
    const registerGuide = document.getElementById("registerGuideOverlay");
    if (registerGuide) registerGuide.style.display = "none";
    localStorage.setItem("registerGuideClosed", "true");
  };
})();
