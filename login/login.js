// ⚡ Fonction de redirection selon le rôle
function redirectAccordingToRole(role) {
    console.log("Redirection selon rôle :", role);

    if (role === "admin") {
        window.location.replace('/admin/admin.html');
    } else {
        window.location.replace('/index.html');
    }
}

// ⚡ Fonction de notification
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

function closeLoginGuide() {
    document.getElementById("loginGuideOverlay").style.display = "none";
    localStorage.setItem("loginGuideClosed", "true");
}

// ⚡ Tout le DOM ready
document.addEventListener('DOMContentLoaded', () => {

    // 🔹 Redirection automatique si déjà connecté
    const token = localStorage.getItem('authToken');
    const role = localStorage.getItem('userRole')?.toLowerCase();
    if (token && role) {
        redirectAccordingToRole(role);
    }

    // 🔹 Gestion du guide de connexion
    const loginGuide = document.getElementById("loginGuideOverlay");
    if (localStorage.getItem("loginGuideClosed") === "true" && loginGuide) {
        loginGuide.style.display = "none";
    }

    // 🔹 Bouton fermer guide
    if (loginGuide) {
        loginGuide.querySelectorAll(".closeGuideBtn")?.forEach(btn => {
            btn.addEventListener("click", () => {
                loginGuide.style.display = "none";
                localStorage.setItem("loginGuideClosed", "true");
            });
        });
    }

    // 🔹 Bouton "Se connecter"
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const username = document.getElementById('email')?.value.trim();
            const password = document.getElementById('password')?.value.trim();

            if (!username || !password) {
                showNotification('Veuillez remplir tous les champs.', "warning");
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const rawText = await res.text();

                if (rawText.trim().startsWith("<")) {
                    showNotification("❌ Le serveur a renvoyé du HTML au lieu d'un JSON (voir console).", "error");
                    return;
                }

                const data = JSON.parse(rawText);

                if (!res.ok) {
                    showNotification('❌ Erreur : ' + (data.error || "Identifiants incorrects"), "error");
                    return;
                }

                if (data.twofa_required) {
                    showNotification("Un code 2FA vous a été envoyé par email.", "info");
                    localStorage.setItem("pendingUserId", data.userId);
                    const twofaSection = document.getElementById("twofaSection");
                    if (twofaSection) twofaSection.classList.remove("hidden");
                    return;
                }

                const userRole = (data.user?.role || "user").trim().toLowerCase();
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('userRole', userRole);
                localStorage.setItem('userId', data.user?.id);

                showNotification('✅ Connexion réussie.', "success");
                setTimeout(() => redirectAccordingToRole(userRole), 200);

            } catch (err) {
                console.error("Erreur lors de la requête :", err);
                showNotification("❌ Erreur de connexion au serveur.", "error");
            }
        });
    }

    // 🔹 Bouton "Vérifier le code 2FA"
    const verify2faBtn = document.getElementById("verify2faBtn");
    if (verify2faBtn) {
        verify2faBtn.addEventListener("click", async () => {
            const userId = localStorage.getItem("pendingUserId");
            const code = document.getElementById("twofaCode")?.value.trim();

            if (!userId || !code) {
                showNotification("Veuillez entrer le code.", "warning");
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/auth/verify-2fa`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId, code })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Erreur API");

                const userRole = (data.user?.role || "user").trim().toLowerCase();
                localStorage.setItem("authToken", data.token);
                localStorage.setItem("userRole", userRole);
                localStorage.setItem("userId", data.user?.id);
                localStorage.removeItem("pendingUserId");

                showNotification("✅ Connexion réussie avec 2FA.", "success");
                redirectAccordingToRole(userRole);
            } catch (err) {
                console.error("Erreur verify2fa:", err);
                showNotification("❌ Code invalide ou expiré.", "error");
            }
        });
    }
});
