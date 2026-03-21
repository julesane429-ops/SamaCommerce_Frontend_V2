// login.js

const API_BASE = "https://samacommerce-backend-v2.onrender.com";

function redirectAccordingToRole(role) {
  if (role === "admin") window.location.replace('/admin/admin.html');
  else window.location.replace('/index.html');
}

function showNotification(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText = "position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function closeLoginGuide() {
  const overlay = document.getElementById('loginGuideOverlay');
  if (overlay) overlay.style.display = 'none';
  localStorage.setItem("loginGuideClosed", "true");
}
window.closeLoginGuide = closeLoginGuide;

// ── Sauvegarder le profil commercial après login ───────────────────────────
// Stocke mode_vente et prix_fixe dans localStorage pour que l'app
// puisse adapter l'interface de vente sans appel réseau supplémentaire.
function sauvegarderProfilCommercial(user) {
  if (!user) return;
  localStorage.setItem('modeVente', user.mode_vente || 'detail');
  localStorage.setItem('prixFixe',  String(user.prix_fixe !== false));
}

async function acceptInviteIfPending(token, authToken) {
  try {
    const res = await fetch(`${API_BASE}/members/accept`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
      body:    JSON.stringify({ invite_token: token }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotification(data.error || "Invitation invalide ou expirée.", "error");
      return false;
    }
    if (data.already_member) {
      showNotification(`✅ Vous êtes déjà membre de "${data.boutique?.company_name || 'la boutique'}" !`, "success");
    } else {
      showNotification(`✅ Vous avez rejoint "${data.boutique?.company_name || 'la boutique'}" !`, "success");
    }
    localStorage.setItem('inviteBoutiqueId',   data.boutique?.id);
    localStorage.setItem('inviteBoutiqueName', data.boutique?.company_name || '');
    localStorage.setItem('employeeRole',       data.role || 'employe');
    return true;
  } catch (err) {
    console.error("Erreur acceptInvite:", err);
    showNotification("Erreur lors de l'acceptation de l'invitation.", "error");
    return false;
  }
}

document.addEventListener('DOMContentLoaded', () => {

  const urlParams   = new URLSearchParams(window.location.search);
  const inviteToken = urlParams.get('invite');
  const inviteEmail = urlParams.get('email');

  // ════════════════════════════════════════
  // MODE INVITATION
  // ════════════════════════════════════════
  if (inviteToken) {
    const welcomeScreen = document.getElementById('invite-welcome');
    const loginTitle    = document.getElementById('login-title');

    if (welcomeScreen) welcomeScreen.style.display = 'flex';
    if (loginTitle)    loginTitle.style.display    = 'none';

    ['email', 'password'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.closest('.form-group').style.display = 'none';
    });

    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.style.display = 'none';
    const linkRow = document.querySelector('.link-row');
    if (linkRow) linkRow.style.display = 'none';
    const demoBtn = document.getElementById('demo-btn');
    if (demoBtn) demoBtn.style.display = 'none';

    document.getElementById('invite-go-register')?.addEventListener('click', () => {
      let url = `/register/register.html?invite=${inviteToken}`;
      if (inviteEmail) url += `&email=${encodeURIComponent(inviteEmail)}`;
      window.location.href = url;
    });

    document.getElementById('invite-go-login')?.addEventListener('click', () => {
      if (welcomeScreen) welcomeScreen.style.display = 'none';
      if (loginTitle) { loginTitle.style.display = ''; loginTitle.textContent = 'Connexion — Rejoindre la boutique'; }
      ['email', 'password'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.closest('.form-group').style.display = '';
      });
      if (loginBtn) loginBtn.style.display = '';
      if (inviteEmail) {
        const emailInput = document.getElementById('email');
        if (emailInput) emailInput.value = decodeURIComponent(inviteEmail);
      }
    });

    const loginGuide = document.getElementById("loginGuideOverlay");
    if (loginGuide) loginGuide.style.display = 'none';

  } else {
    // ════════════════════════════════════════
    // MODE NORMAL
    // ════════════════════════════════════════
    const existingToken = localStorage.getItem('authToken');
    const existingRole  = localStorage.getItem('userRole')?.toLowerCase();
    if (existingToken && existingRole) {
      redirectAccordingToRole(existingRole);
      return;
    }

    const loginGuide = document.getElementById("loginGuideOverlay");
    if (loginGuide) {
      if (localStorage.getItem("loginGuideClosed") === "true") loginGuide.style.display = "none";
      loginGuide.querySelectorAll(".closeGuideBtn")?.forEach(btn => btn.addEventListener("click", closeLoginGuide));
    }
  }

  // ════════════════════════════════════════
  // BOUTON SE CONNECTER
  // ════════════════════════════════════════
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const username = document.getElementById('email')?.value.trim();
      const password = document.getElementById('password')?.value.trim();

      if (!username || !password) {
        showNotification('Veuillez remplir tous les champs.', "warning");
        return;
      }

      loginBtn.disabled    = true;
      loginBtn.textContent = 'Connexion en cours…';

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ username, password }),
        });

        const rawText = await res.text();
        if (rawText.trim().startsWith("<")) { showNotification("Erreur serveur inattendue.", "error"); return; }
        const data = JSON.parse(rawText);
        if (!res.ok) { showNotification(data.error || "Identifiants incorrects", "error"); return; }

        // 2FA requis
        if (data.twofa_required) {
          showNotification("📧 Un code 2FA vous a été envoyé par email.", "info");
          localStorage.setItem("pendingUserId", data.userId);
          localStorage.setItem("pendingInvite",  inviteToken || '');
          document.getElementById("twofaSection")?.classList.remove("hidden");
          loginBtn.style.display = 'none';
          return;
        }

        // ── Succès login ──
        const authToken = data.token;
        const userRole  = (data.user?.role || "user").trim().toLowerCase();
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('userRole',  userRole);
        localStorage.setItem('userId',    data.user?.id);

        // ✅ Stocker le profil commercial pour adapter l'interface de vente
        sauvegarderProfilCommercial(data.user);

        if (inviteToken) {
          await acceptInviteIfPending(inviteToken, authToken);
          window.history.replaceState({}, '', window.location.pathname);
        } else {
          showNotification('✅ Connexion réussie.', "success");
        }

        setTimeout(() => redirectAccordingToRole(userRole), 800);

      } catch (err) {
        console.error("Erreur login:", err);
        showNotification("Erreur de connexion au serveur.", "error");
      } finally {
        loginBtn.disabled    = false;
        loginBtn.textContent = inviteToken ? 'Me connecter et rejoindre →' : 'Se connecter →';
      }
    });

    if (inviteToken) loginBtn.textContent = 'Me connecter et rejoindre →';
  }

  // ════════════════════════════════════════
  // VÉRIFICATION 2FA
  // ════════════════════════════════════════
  const verify2faBtn = document.getElementById("verify2faBtn");
  if (verify2faBtn) {
    verify2faBtn.addEventListener("click", async () => {
      const userId = localStorage.getItem("pendingUserId");
      const code   = document.getElementById("twofaCode")?.value.trim();
      if (!userId || !code) { showNotification("Veuillez entrer le code.", "warning"); return; }

      verify2faBtn.disabled    = true;
      verify2faBtn.textContent = 'Vérification…';

      try {
        const res  = await fetch(`${API_BASE}/auth/verify-2fa`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, code }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur API");

        // ── Succès 2FA ──
        const authToken = data.token;
        const userRole  = (data.user?.role || "user").trim().toLowerCase();
        localStorage.setItem("authToken", authToken);
        localStorage.setItem("userRole",  userRole);
        localStorage.setItem("userId",    data.user?.id);
        localStorage.removeItem("pendingUserId");

        // ✅ Stocker le profil commercial
        sauvegarderProfilCommercial(data.user);

        const pendingInvite = localStorage.getItem("pendingInvite");
        localStorage.removeItem("pendingInvite");
        if (pendingInvite) await acceptInviteIfPending(pendingInvite, authToken);
        else showNotification("✅ Connexion réussie avec 2FA.", "success");

        redirectAccordingToRole(userRole);

      } catch (err) {
        console.error("Erreur verify2fa:", err);
        showNotification("Code invalide ou expiré.", "error");
      } finally {
        verify2faBtn.disabled    = false;
        verify2faBtn.textContent = '✅ Vérifier le code';
      }
    });
  }
});
