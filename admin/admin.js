let subscribers = [];
let filteredSubscribers = [];

async function loadSubscribers() {
    try {
        const res = await fetch(API_BASE + "/auth/users", {
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("authToken")
            }
        });

        if (!res.ok) {
            throw new Error("Erreur API " + res.status);
        }

        subscribers = await res.json();
        console.log("📦 Abonnés récupérés:", subscribers);
        filteredSubscribers = [...subscribers];
        populateSubscribersGrid();
    } catch (err) {
        console.error("❌ Impossible de charger les abonnés:", err);
        showNotification("Erreur lors du chargement des abonnés", "error");
    }
}

// Sample transactions
const transactions = [
    { id: 1, type: "income", description: "Paiement Premium - Jean Dupont", amount: 29.99, date: "Aujourd'hui, 14:30", method: "wave" },
    { id: 2, type: "income", description: "Paiement Premium - Sophie Leroy", amount: 29.99, date: "Hier, 09:15", method: "wave" },
    { id: 3, type: "expense", description: "Frais de service", amount: -125.00, date: "Hier, 08:00", method: "main" },
    { id: 4, type: "income", description: "Paiement Premium - Thomas Bernard", amount: 29.99, date: "2 jours, 16:45", method: "orange" },
    { id: 5, type: "income", description: "Paiement Cash - Pierre Durand", amount: 29.99, date: "3 jours, 11:20", method: "cash" }
];

let sidebarVisible = true;

function logout() {
    // Supprimer les infos d'auth
    localStorage.removeItem("authToken");
    localStorage.removeItem("userRole");

    // Notification
    showNotification("✅ Déconnexion réussie", "info");

    // Redirection vers la page de login
    setTimeout(() => {
        window.location.href = "/login/login.html";
    }, 800);
}


// Sidebar toggle function
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const toggleIcon = document.getElementById('toggleIcon');

    sidebarVisible = !sidebarVisible;

    if (sidebarVisible) {
        // Afficher la sidebar
        sidebar.classList.remove('sidebar-hidden');
        mainContent.classList.remove('main-expanded');
        mainContent.style.marginLeft = '16rem'; // 256px = 16rem
        toggleIcon.textContent = '←';
    } else {
        // Masquer la sidebar
        sidebar.classList.add('sidebar-hidden');
        mainContent.classList.add('main-expanded');
        mainContent.style.marginLeft = '0';
        toggleIcon.textContent = '☰';
    }
}

// Filter subscribers function
function filterSubscribers() {
    const searchTerm = document.getElementById('subscriberSearch').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    filteredSubscribers = subscribers.filter(subscriber => {
        const username = subscriber.username ? subscriber.username.toLowerCase() : "";
        const company = subscriber.company_name ? subscriber.company_name.toLowerCase() : "";

        // Recherche par nom ou société
        const matchesSearch =
            username.includes(searchTerm) || company.includes(searchTerm);

        // Filtrage par statut
        const matchesStatus =
            !statusFilter ||
            subscriber.status === statusFilter ||
            (statusFilter === 'En retard' && subscriber.payment_status === 'En retard');

        return matchesSearch && matchesStatus;
    });

    populateSubscribersGrid();
}


// Filter revenue function
function filterRevenue() {
    const period = document.getElementById('revenuePeriodFilter').value;
    const info = document.getElementById('revenueFilterInfo');

    const periodTexts = {
        'all': 'Tous les revenus affichés',
        'daily': 'Revenus journaliers affichés',
        'weekly': 'Revenus hebdomadaires affichés',
        'monthly': 'Revenus mensuels affichés'
    };

    info.textContent = periodTexts[period];

    // Update revenue display based on period
    updateRevenueDisplay(period);
}

// Filter accounts function
function filterAccounts() {
    const period = document.getElementById('accountsPeriodFilter').value;
    const info = document.getElementById('accountsFilterInfo');

    const periodTexts = {
        'all': 'Tous les montants affichés',
        'daily': 'Montants journaliers affichés',
        'weekly': 'Montants hebdomadaires affichés',
        'monthly': 'Montants mensuels affichés'
    };

    info.textContent = periodTexts[period];

    // Update accounts display based on period
    updateAccountsDisplay(period);
}

// Update revenue display
function updateRevenueDisplay(period) {
    const amounts = {
        'daily': { main: 'FCFA4,230.00', monthly: 'FCFA1,450.00', pending: 'FCFA320.00' },
        'weekly': { main: 'FCFA28,450.00', monthly: 'FCFA9,850.00', pending: 'FCFA1,200.00' },
        'monthly': { main: 'FCFA127,450.00', monthly: 'FCFA45,230.00', pending: 'FCFA8,750.00' },
        'all': { main: 'FCFA542,180.00', monthly: 'FCFA198,450.00', pending: 'FCFA25,300.00' }
    };

    const data = amounts[period];
    document.querySelector('.bg-gradient-to-r.from-violet-500 .text-3xl').textContent = data.main;
    document.querySelector('.bg-gradient-to-r.from-green-500 .text-3xl').textContent = data.monthly;
    document.querySelector('.bg-gradient-to-r.from-orange-500 .text-3xl').textContent = data.pending;
}

// Update accounts display
function updateAccountsDisplay(period) {
    const amounts = {
        'daily': { orange: 'FCFA1,230.50', wave: 'FCFA890.75', cash: 'FCFA420.00' },
        'weekly': { orange: 'FCFA8,450.50', wave: 'FCFA6,180.75', cash: 'FCFA2,840.00' },
        'monthly': { orange: 'FCFA45,230.50', wave: 'FCFA32,180.75', cash: 'FCFA15,420.00' },
        'all': { orange: 'FCFA198,450.50', wave: 'FCFA145,680.75', cash: 'FCFA67,890.00' }
    };

    const data = amounts[period];
    document.querySelectorAll('.bg-gradient-to-r')[3].querySelector('.text-2xl').textContent = data.orange;
    document.querySelectorAll('.bg-gradient-to-r')[4].querySelector('.text-2xl').textContent = data.wave;
    document.querySelectorAll('.bg-gradient-to-r')[5].querySelector('.text-2xl').textContent = data.cash;
}

// Ignorer une alerte
async function ignoreAlert(alertId) {
    const token = localStorage.getItem("authToken");
    try {
        const res = await fetch(`${API_BASE}/alerts/${alertId}/ignore`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur API");

        document.getElementById(alertId).style.opacity = "0.5";

        showNotification(data.message || "✅ Alerte ignorée", "info");
        await loadAlerts();
    } catch (err) {
        console.error("Erreur ignoreAlert:", err);
        showNotification("❌ Impossible d’ignorer l’alerte", "error");
    }
}

// Fermer une alerte
async function closeAlert(alertId) {
    const token = localStorage.getItem("authToken");
    try {
        const res = await fetch(`${API_BASE}/alerts/${alertId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur API");

        document.getElementById(alertId).remove();
        alertCount--;
        updateAlertBadge();

        showNotification(data.message || "✅ Alerte fermée", "success");
        await loadAlerts();
    } catch (err) {
        console.error("Erreur closeAlert:", err);
        showNotification("❌ Impossible de fermer l’alerte", "error");
    }
}

function updateAlertBadge() {
    const badge = document.getElementById('alertBadge');
    if (alertCount > 0) {
        badge.textContent = alertCount;
    } else {
        badge.style.display = 'none';
    }
}

// Navigation functions
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Remove active class from all sidebar links
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
        link.classList.add('text-gray-700');
        link.classList.remove('text-violet-600', 'font-medium');
    });

    // Show selected section
    document.getElementById(sectionName).classList.add('active');

    // Add active class to selected sidebar link
    const activeLink = document.querySelector(`.${sectionName}-link`);
    if (activeLink) {
        activeLink.classList.add('active', 'text-violet-600', 'font-medium');
        activeLink.classList.remove('text-gray-700');
    }
}
// Populate subscribers grid avec gestion des upgrades
function populateSubscribersGrid() {
    const grid = document.getElementById('subscribersGrid');
    grid.innerHTML = '';

    if (!filteredSubscribers || filteredSubscribers.length === 0) {
        grid.innerHTML = `<div class="text-gray-500 text-center py-4">Aucun abonné trouvé</div>`;
        return;
    }

    filteredSubscribers.forEach((subscriber) => {
        // Normalisation
        const isPending = subscriber.upgrade_status === "en attente";
        const isRejected = subscriber.upgrade_status === "rejeté";
        const isValidated = subscriber.upgrade_status === "validé";

        // Badges statut utilisateur
        const statusBadge = subscriber.status === "Actif"
            ? '<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Actif</span>'
            : '<span class="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Bloqué</span>';

        // Badge plan avec gestion upgrade
        let planBadge = "";
        if (subscriber.plan === "Premium" && isValidated) {
            planBadge = '<span class="px-2 py-1 text-xs font-medium bg-violet-100 text-violet-800 rounded-full">Premium</span>';
        } else if (subscriber.plan === "Free" && isPending) {
            planBadge = '<span class="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Free</span> ' +
                '<span class="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Demande en attente</span>';
        } else if (subscriber.plan === "Free" && isRejected) {
            planBadge = '<span class="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Free</span> ' +
                '<span class="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Demande rejetée</span>';
        } else {
            planBadge = '<span class="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Free</span>';
        }

        // Badge paiement
        const paymentBadge = subscriber.payment_status === "À jour"
            ? '<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">À jour</span>'
            : '<span class="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">En retard</span>';

        const paymentMethodIcons = {
            "wave": "🌊 Wave",
            "orange": "🟠 Orange",
            "cash": "💵 Cash",
            "none": "_"
        };

        // Boutons admin pour upgrade en attente
        const upgradeActions = isPending
            ? `<button onclick="approveUpgrade(${subscriber.id})" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs mr-2 mb-2">Valider</button>
         <button onclick="rejectUpgrade(${subscriber.id})" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs mb-2">Rejeter</button>`
            : '';

        // Boutons admin classiques
        const actions = subscriber.status === "Actif"
            ? `<button onclick="blockUser(${subscriber.id})" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs mr-2 mb-2">Bloquer</button>
         <button onclick="sendReminder(${subscriber.id})" class="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-xs mr-2 mb-2">Rappel</button>
         <button onclick="deleteUser(${subscriber.id})" class="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs mb-2">Supprimer</button>`
            : `<button onclick="activateUser(${subscriber.id})" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs mr-2 mb-2">Réactiver</button>
         <button onclick="deleteUser(${subscriber.id})" class="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs mb-2">Supprimer</button>`;

        // Création de la carte
        const card = document.createElement('div');
        card.className = 'subscriber-card bg-white rounded-xl shadow-sm border border-gray-100 p-6';
        card.setAttribute("data-id", subscriber.id);
        card.innerHTML = `
      <div class="flex items-center space-x-4 mb-4">
        <div class="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center">
          <span class="text-violet-600 font-semibold">${subscriber.username.charAt(0).toUpperCase()}</span>
        </div>
        <div class="flex-1">
          <h3 class="font-semibold text-gray-800">${subscriber.username}</h3>
          <p class="text-sm text-gray-500">${subscriber.company_name || "—"}</p>
          <p class="text-sm text-gray-500">📞 ${subscriber.phone || "—"}</p>
        </div>
      </div>

      <div class="space-y-3 mb-4">
        <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Statut:</span> ${statusBadge}</div>
        <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Plan:</span> ${planBadge}</div>
        <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Paiement:</span> ${paymentBadge}</div>
        <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Méthode:</span>
          <span class="text-sm font-medium">${paymentMethodIcons[subscriber.payment_method] || "—"}</span>
        </div>
        <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Expiration:</span>
          <span class="text-sm font-medium">${subscriber.expiration || "—"}</span>
        </div>
        <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Montant:</span>
          <span class="text-sm font-medium">FCFA${subscriber.amount || "0.00"}</span>
        </div>
      </div>

      <div class="border-t pt-4 flex flex-wrap gap-2">
        ${actions} ${upgradeActions}
      </div>
    `;
        grid.appendChild(card);
    });
}

// ==========================
//  Upgrade : Valider / Rejeter
// ==========================

async function approveUpgrade(userId) {
    try {
        const res = await fetch(`${API_BASE}/auth/upgrade/${userId}/approve`, {
            method: "PUT",
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("authToken"),
                "Content-Type": "application/json"
            }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur API");

        // 🔄 Mise à jour locale
        filteredSubscribers = filteredSubscribers.map(u =>
            u.id === userId ? { ...u, plan: "Premium", upgrade_status: "validé" } : u
        );

        // 🔄 Mise à jour visuelle
        updateSubscriberCard(userId);

        showNotification(`✅ Upgrade validé pour ${data.user?.username || userId}`, "success");
    } catch (err) {
        console.error("Erreur approveUpgrade:", err);
        showNotification("❌ Impossible de valider l'upgrade", "error");
    }
}

async function rejectUpgrade(userId) {
    try {
        const res = await fetch(`${API_BASE}/auth/upgrade/${userId}/reject`, {
            method: "PUT",
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("authToken"),
                "Content-Type": "application/json"
            }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur API");

        // 🔄 Mise à jour locale
        filteredSubscribers = filteredSubscribers.map(u =>
            u.id === userId ? { ...u, upgrade_status: "rejeté" } : u
        );

        // 🔄 Mise à jour visuelle
        updateSubscriberCard(userId);

        showNotification(`🚫 Upgrade rejeté pour ${data.user?.username || userId}`, "error");
    } catch (err) {
        console.error("Erreur rejectUpgrade:", err);
        showNotification("❌ Impossible de rejeter l'upgrade", "error");
    }
}

// ==========================
//  Rafraîchir 1 seule carte
// ==========================
function updateSubscriberCard(userId) {
    const subscriber = filteredSubscribers.find(u => u.id === userId);
    if (!subscriber) return;

    const oldCard = document.querySelector(`.subscriber-card[data-id="${userId}"]`);
    if (oldCard) {
        const newCard = document.createElement("div");
        newCard.className = oldCard.className;
        newCard.setAttribute("data-id", userId);
        newCard.innerHTML = generateSubscriberCardHTML(subscriber);
        oldCard.replaceWith(newCard);
    }
}

// ==========================
//  Générer HTML d’une carte
// ==========================
function generateSubscriberCardHTML(subscriber) {
    const statusBadge = subscriber.status === "Actif"
        ? '<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Actif</span>'
        : '<span class="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Bloqué</span>';

    const planBadge = subscriber.plan === "Premium"
        ? '<span class="px-2 py-1 text-xs font-medium bg-violet-100 text-violet-800 rounded-full">Premium</span>'
        : '<span class="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Free</span>';

    const paymentBadge = subscriber.payment_status === "À jour"
        ? '<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">À jour</span>'
        : '<span class="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">En retard</span>';

    const upgradeBadge = subscriber.upgrade_status === "en attente"
        ? '<span class="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">En attente</span>'
        : (subscriber.upgrade_status === "rejeté"
            ? '<span class="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Rejeté</span>'
            : "");

    const paymentMethodIcons = {
        "wave": "🌊 Wave",
        "orange": "🟠 Orange",
        "cash": "💵 Cash",
        "none": "_"
    };

    const upgradeActions = subscriber.upgrade_status === "en attente"
        ? `<button onclick="approveUpgrade(${subscriber.id})" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs mr-2 mb-2">Valider</button>
       <button onclick="rejectUpgrade(${subscriber.id})" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs mb-2">Rejeter</button>`
        : "";

    const actions = subscriber.status === "Actif"
        ? `<button onclick="blockUser(${subscriber.id})" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs mr-2 mb-2">Bloquer</button>
       <button onclick="sendReminder(${subscriber.id})" class="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-xs mr-2 mb-2">Rappel</button>
       <button onclick="deleteUser(${subscriber.id})" class="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs mb-2">Supprimer</button>`
        : `<button onclick="activateUser(${subscriber.id})" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs mr-2 mb-2">Réactiver</button>
       <button onclick="deleteUser(${subscriber.id})" class="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs mb-2">Supprimer</button>`;

    return `
    <div class="flex items-center space-x-4 mb-4">
      <div class="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center">
        <span class="text-violet-600 font-semibold">${subscriber.username.charAt(0).toUpperCase()}</span>
      </div>
      <div class="flex-1">
        <h3 class="font-semibold text-gray-800">${subscriber.username}</h3>
        <p class="text-sm text-gray-500">${subscriber.company_name || "—"}</p>
        <p class="text-sm text-gray-500">📞 ${subscriber.phone || "—"}</p>
      </div>
    </div>

    <div class="space-y-3 mb-4">
      <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Statut:</span> ${statusBadge}</div>
      <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Plan:</span> ${planBadge} ${upgradeBadge}</div>
      <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Paiement:</span> ${paymentBadge}</div>
      <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Méthode:</span>
        <span class="text-sm font-medium">${paymentMethodIcons[subscriber.payment_method] || "—"}</span>
      </div>
      <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Expiration:</span>
        <span class="text-sm font-medium">${subscriber.expiration || "—"}</span>
      </div>
      <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Montant:</span>
        <span class="text-sm font-medium">FCFA${subscriber.amount || "0.00"}</span>
      </div>
    </div>

    <div class="border-t pt-4 flex flex-wrap gap-2">
      ${actions} ${upgradeActions}
    </div>
  `;
}

// Populate transactions list
function populateTransactionsList() {
    const list = document.getElementById('transactionsList');
    list.innerHTML = '';

    transactions.forEach(transaction => {
        const methodIcons = {
            'wave': '🌊',
            'orange': '🟠',
            'cash': '💵',
            'main': '💳'
        };

        const div = document.createElement('div');
        div.className = `transaction-item ${transaction.type} p-4 hover:bg-gray-50`;
        div.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 ${transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'} rounded-full flex items-center justify-center">
                                <span class="${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}">${transaction.type === 'income' ? '💰' : '💸'}</span>
                            </div>
                            <div>
                                <p class="font-medium text-gray-800">${transaction.description}</p>
                                <p class="text-sm text-gray-500">${transaction.date} • ${methodIcons[transaction.method]} ${transaction.method.charAt(0).toUpperCase() + transaction.method.slice(1)}</p>
                            </div>
                        </div>
                        <span class="${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'} font-semibold">
                            ${transaction.type === 'income' ? '+' : ''}FCFA${Math.abs(transaction.amount).toFixed(2)}
                        </span>
                    </div>
                `;
        list.appendChild(div);
    });
}

// Modal functions
function openAddSubscriberModal() {
    document.getElementById('addSubscriberModal').classList.remove('hidden');
}

function closeAddSubscriberModal() {
    document.getElementById('addSubscriberModal').classList.add('hidden');
    // Clear form
    document.getElementById('newSubscriberName').value = '';
    document.getElementById('newSubscriberEmail').value = '';
    document.getElementById('newSubscriberPhone').value = '';
    document.getElementById('newSubscriberPlan').value = 'Free';
    document.getElementById('newSubscriberPaymentMethod').value = 'wave';
}

// ➕ Ajouter un abonné en BDD
async function addSubscriber() {
    const name = document.getElementById('newSubscriberName').value.trim();
    const email = document.getElementById('newSubscriberEmail').value.trim();
    const phone = document.getElementById('newSubscriberPhone').value.trim();
    const plan = document.getElementById('newSubscriberPlan').value;
    const paymentMethod = document.getElementById('newSubscriberPaymentMethod').value;

    if (!name || !email || !phone) {
        showNotification('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("authToken"),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: email,
                password: "changeme123",
                company_name: name,
                status: "Actif",
                plan: plan,
                payment_status: "À jour",
                payment_method: paymentMethod,
                expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                amount: plan === "Premium" ? 29.99 : 0.00
            })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

        showNotification(`✅ Abonné ${data.user?.username || email} ajouté avec succès`, "success");

        // 🔄 Recharge la liste depuis l’API
        await loadSubscribers();

        // Ferme la modal
        closeAddSubscriberModal();
    } catch (err) {
        console.error("Erreur addSubscriber:", err);
        showNotification("Erreur ajout: " + err.message, "error");
    }
}

function openWithdrawModal() {
    document.getElementById('withdrawModal').classList.remove('hidden');
}

function closeWithdrawModal() {
    document.getElementById('withdrawModal').classList.add('hidden');
}

function processWithdraw() {
    const amount = document.getElementById('withdrawAmount').value;
    const to = document.getElementById('withdrawTo').value;

    if (!amount || amount <= 0) {
        showNotification('Veuillez entrer un montant valide', 'error');
        return;
    }

    showNotification(`Retrait de FCFA${amount} vers ${to} en cours...`, 'info');
    closeWithdrawModal();
}

// --- Ouvrir le modal transfert depuis un compte ---
function openTransferModal(account) {
    document.getElementById("fromAccount").value = account;
    showModal("transferModal");
}

// --- Soumission transfert ---
document.getElementById("transferForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const from = document.getElementById("fromAccount").value;
    const to = document.getElementById("toAccount").value;
    const amount = parseFloat(document.getElementById("transferAmount").value);

    if (!amount || amount <= 0 || from === to) {
        alert("⚠️ Choisissez deux comptes différents et un montant valide.");
        return;
    }

    try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`${API_BASE}/admin-transfers`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ from, to, amount })
        });

        if (!res.ok) throw new Error(await res.text());

        alert(`✅ Transfert de FCFA${amount} de ${from} vers ${to} effectué !`);
        hideModal("transferModal");
        loadAdminAccounts(); // 🔄 recharge les soldes
    } catch (err) {
        console.error("❌ Erreur transfert:", err);
        alert("Erreur transfert: " + err.message);
    }
});


function closeTransferModal() {
    document.getElementById('transferModal').classList.add('hidden');
}

function processTransfer() {
    const amount = document.getElementById('transferAmount').value;
    const from = document.getElementById('transferFrom').value;
    const to = document.getElementById('transferTo').value;

    if (!amount || amount <= 0) {
        showNotification('Veuillez entrer un montant valide', 'error');
        return;
    }

    showNotification(`Transfert de FCFA${amount} de ${from} vers ${to} effectué`, 'success');
    closeTransferModal();
}

// 📊 Générer un rapport PDF complet des revenus + transactions
async function generateReport() {
    try {
        const token = localStorage.getItem("authToken");

        // 👉 Récupération des revenus (solde, pending, etc.)
        const resRevenus = await fetch(API_BASE + "/admin-stats/revenus?period=all", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!resRevenus.ok) throw new Error("Erreur API revenus");
        const revenus = await resRevenus.json();

        // 👉 Récupération des transactions récentes
        const resTx = await fetch(API_BASE + "/admin-stats/transactions?limit=10", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!resTx.ok) throw new Error("Erreur API transactions");
        const transactions = await resTx.json();

        // 📄 Création du PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Titre
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("Rapport des Revenus - Admin", 20, 20);

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Date: ${new Date().toLocaleString("fr-FR")}`, 20, 35);

        // Résumé
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Résumé :", 20, 50);

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`- Solde total validé: FCFA ${revenus.balance}`, 30, 65);
        doc.text(`- Revenus (tous temps): FCFA ${revenus.periodTotal}`, 30, 80);
        doc.text(`- Montant en attente: FCFA ${revenus.pending}`, 30, 95);

        // Transactions
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Transactions récentes :", 20, 115);

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");

        let startY = 125;
        transactions.forEach((tx, i) => {
            if (startY > 270) { // saut de page si trop bas
                doc.addPage();
                startY = 20;
            }

            doc.text(
                `${i + 1}. ${tx.username} | ${tx.amount} FCFA | ${tx.payment_method || "N/A"} | ${tx.upgrade_status} | exp: ${tx.expiration ? tx.expiration.split("T")[0] : "-"}`,
                25,
                startY
            );
            startY += 10;
        });

        // Pied de page
        doc.setFontSize(10);
        doc.text("⚠️ Rapport généré automatiquement par le système admin", 20, 285);

        // 📥 Téléchargement
        doc.save(`rapport_revenus_${new Date().toISOString().split("T")[0]}.pdf`);

        showNotification("✅ Rapport PDF généré avec succès", "success");

    } catch (err) {
        console.error("❌ Erreur rapport:", err);
        showNotification("Erreur lors de la génération du rapport", "error");
    }
}

// 📋 Historique des transactions Premium
async function showTransactionHistory() {
    try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(API_BASE + "/admin-stats/transactions?limit=10", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Erreur API transactions");
        const transactions = await res.json();

        const list = document.getElementById("transactionsList");
        list.innerHTML = "";

        if (transactions.length === 0) {
            list.innerHTML = `<div class="p-4 text-gray-500">Aucune transaction trouvée.</div>`;
            return;
        }

        transactions.forEach(tx => {
            const statusColor = tx.upgrade_status === "validé" ? "text-green-600" : "text-orange-500";
            const row = `
        <div class="px-6 py-3 flex justify-between items-center">
          <div>
            <p class="font-medium">${tx.username} (${tx.payment_method || "-"})</p>
            <p class="text-sm text-gray-500">Expire: ${tx.expiration ? new Date(tx.expiration).toLocaleDateString() : "-"}</p>
          </div>
          <div class="text-right">
            <p class="font-bold">FCFA${tx.amount}</p>
            <p class="text-sm ${statusColor}">${tx.upgrade_status}</p>
          </div>
        </div>`;
            list.insertAdjacentHTML("beforeend", row);
        });
    } catch (err) {
        console.error("❌ Erreur historique:", err);
        showNotification("Erreur lors du chargement de l’historique", "error");
    }
}

// --- Bouton Détails ---
async function viewAccountDetails(account) {
    try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`${API_BASE}/admin-stats/accounts/${account}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Erreur API " + res.status);
        const data = await res.json();

        // Titre
        document.getElementById("accountDetailsTitle").textContent = `Détails - ${account.toUpperCase()}`;
        const container = document.getElementById("accountTransactions");
        container.innerHTML = "";

        // Abonnements validés
        if (data.subscriptions.length > 0) {
            const subsTitle = document.createElement("h3");
            subsTitle.className = "font-bold mt-2 text-gray-700";
            subsTitle.textContent = "✅ Abonnements Premium validés";
            container.appendChild(subsTitle);

            data.subscriptions.forEach(tx => {
                const div = document.createElement("div");
                div.className = "flex justify-between border-b pb-1 text-sm";
                div.innerHTML = `
          <span>${tx.username || "Utilisateur"}</span>
          <span class="font-bold">FCFA${tx.amount}</span>
          <span class="text-gray-500">${tx.expiration?.split("T")[0] || ""}</span>
        `;
                container.appendChild(div);
            });
        }

        // Retraits validés
        if (data.withdrawals.length > 0) {
            const wTitle = document.createElement("h3");
            wTitle.className = "font-bold mt-3 text-red-600";
            wTitle.textContent = "⬇️ Retraits validés";
            container.appendChild(wTitle);

            data.withdrawals.forEach(tx => {
                const div = document.createElement("div");
                div.className = "flex justify-between border-b pb-1 text-sm";
                div.innerHTML = `
          <span>Retrait</span>
          <span class="font-bold text-red-600">-FCFA${tx.amount}</span>
          <span class="text-gray-500">${tx.created_at?.split("T")[0] || ""}</span>
        `;
                container.appendChild(div);
            });
        }

        // Transferts internes
        if (data.transfers.length > 0) {
            const tTitle = document.createElement("h3");
            tTitle.className = "font-bold mt-3 text-blue-600";
            tTitle.textContent = "🔄 Transferts internes";
            container.appendChild(tTitle);

            data.transfers.forEach(tx => {
                const isOut = tx.from_account === account;
                const div = document.createElement("div");
                div.className = "flex justify-between border-b pb-1 text-sm";
                div.innerHTML = `
          <span>${isOut ? "Vers " + tx.to_account : "De " + tx.from_account}</span>
          <span class="font-bold ${isOut ? "text-red-600" : "text-green-600"}">
            ${isOut ? "-" : "+"}FCFA${tx.amount}
          </span>
          <span class="text-gray-500">${tx.created_at?.split("T")[0] || ""}</span>
        `;
                container.appendChild(div);
            });
        }

        // Rien trouvé ?
        if (
            data.subscriptions.length === 0 &&
            data.withdrawals.length === 0 &&
            data.transfers.length === 0
        ) {
            container.innerHTML = "<p class='text-gray-500 text-sm'>Aucune transaction trouvée.</p>";
        }

        showModal("accountDetailsModal");
    } catch (err) {
        console.error("❌ Erreur viewAccountDetails:", err);
        alert("Impossible de charger les transactions.");
    }
}

function showNotification(message, type) {
    const colors = {
        'success': 'bg-green-500',
        'error': 'bg-red-500',
        'info': 'bg-blue-500'
    };

    const notification = document.createElement('div');
    notification.className = `fixed top-20 right-4 px-4 py-2 rounded-lg text-white z-50 ${colors[type]}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Initialize charts
function initCharts() {
    // Revenue Chart
    const ctx1 = document.getElementById('revenueChart').getContext('2d');
    new Chart(ctx1, {
        type: 'line',
        data: {
            labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
            datasets: [{
                label: 'Revenus (FCFA)',
                data: [32000, 35000, 38000, 42000, 39000, 45000, 48000, 52000, 49000, 55000, 58000, 62000],
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: '#f3f4f6' },
                    ticks: { callback: function (value) { return 'FCFA' + value.toLocaleString(); } }
                },
                x: { grid: { display: false } }
            }
        }
    });

    // Revenue Breakdown Chart
    const ctx2 = document.getElementById('revenueBreakdownChart');
    if (ctx2) {
        new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: ['Wave', 'Orange Money', 'Espèces'],
                datasets: [{
                    data: [45, 35, 20],
                    backgroundColor: ['#3b82f6', '#f97316', '#10b981']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    // Growth Chart
    const ctx3 = document.getElementById('growthChart');
    if (ctx3) {
        new Chart(ctx3, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun'],
                datasets: [{
                    label: 'Croissance (%)',
                    data: [12, 15, 8, 18, 22, 15],
                    backgroundColor: '#8b5cf6'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }
}

// Close modals when clicking outside
document.addEventListener('click', function (event) {
    const modals = ['addSubscriberModal', 'withdrawModal', 'transferModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            modal.classList.add('hidden');
        }
    });

    const panel = document.getElementById('notificationPanel');
    const button = event.target.closest('button');

    if (!panel.contains(event.target) && (!button || !button.onclick || button.onclick.toString().indexOf('toggleNotifications') === -1)) {
        panel.classList.add('hidden');
    }
});

// Initialize the page
document.addEventListener('DOMContentLoaded', function () {
    // Initialize dashboard directly
    populateSubscribersGrid();
    populateTransactionsList();
    initCharts();
    loadSubscribers();

    // Initialize sidebar state
    const mainContent = document.getElementById('mainContent');
    const toggleIcon = document.getElementById('toggleIcon');

    if (sidebarVisible) {
        mainContent.style.marginLeft = '16rem';
        toggleIcon.textContent = '←';
    } else {
        mainContent.style.marginLeft = '0';
        toggleIcon.textContent = '☰';
    }

    // Show welcome message
    showNotification('Bienvenue dans votre tableau de bord !', 'success');
});

// ---------- Admin Revenus (frontend) ----------
async function fetchAdminRevenus(period = "monthly") {
    const token = localStorage.getItem("authToken");
    if (!token) {
        console.warn("Aucun token — vous devez être connecté en admin.");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/admin-stats/revenus?period=${encodeURIComponent(period)}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`API revenus: ${res.status} ${txt}`);
        }
        const data = await res.json();

        // Formatage simple (FCFA + séparateur)
        const fmt = (num) => `FCFA${Number(num || 0).toLocaleString()}`;

        document.getElementById("balanceMain").textContent = fmt(data.balance);
        document.getElementById("revenuePeriodValue").textContent = fmt(data.periodTotal);
        document.getElementById("pendingAmount").textContent = fmt(data.pending);
    } catch (err) {
        console.error("Erreur fetchAdminRevenus:", err);
        // ne pas alerter trop fort en prod, afficher console + notification si tu as la fonction
        if (typeof showNotification === "function") showNotification("Erreur chargement revenus", "error");
    }
}

// Hook sur le select
document.getElementById('revenuePeriodFilter')?.addEventListener('change', function () {
    const period = this.value || 'monthly';
    // met à jour l'affichage
    fetchAdminRevenus(period);
    // met à jour l'info texte si tu veux
    const info = document.getElementById('revenueFilterInfo');
    if (info) {
        const map = {
            all: 'Tous les revenus affichés',
            daily: 'Revenus journaliers affichés',
            weekly: 'Revenus hebdomadaires affichés',
            monthly: 'Revenus mensuels affichés'
        };
        info.textContent = map[period] || '';
    }
});

// Lancer au chargement (par défaut 'monthly')
document.addEventListener('DOMContentLoaded', () => {
    // Seul l'admin doit voir ces chiffres : sécurité assurée côté backend.
    fetchAdminRevenus(document.getElementById('revenuePeriodFilter')?.value || 'monthly');
});

// ---------- Admin Transactions ----------
async function fetchAdminTransactions(limit = 10) {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE}/admin-stats/transactions?limit=${limit}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Erreur API transactions " + res.status);

        const data = await res.json();

        const list = document.getElementById("transactionsList");
        list.innerHTML = "";

        if (data.length === 0) {
            list.innerHTML = `<div class="px-6 py-4 text-gray-500">Aucune transaction trouvée</div>`;
            return;
        }

        data.forEach(tx => {
            const div = document.createElement("div");
            div.className = "px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition";
            div.innerHTML = `
        <div>
          <p class="font-medium text-gray-800">${tx.username}</p>
          <p class="text-sm text-gray-500">${tx.plan} • ${tx.payment_method || "-"}</p>
        </div>
        <div class="text-right">
          <p class="font-bold ${tx.upgrade_status === "en attente" ? "text-orange-500" : "text-green-600"}">
            FCFA${Number(tx.amount || 0).toLocaleString()}
          </p>
          <p class="text-xs text-gray-400">${tx.expiration ? new Date(tx.expiration).toLocaleDateString() : ""}</p>
        </div>
      `;
            list.appendChild(div);
        });
    } catch (err) {
        console.error("Erreur fetchAdminTransactions:", err);
        if (typeof showNotification === "function") showNotification("Erreur chargement transactions", "error");
    }
}

// Charger transactions récentes au démarrage
document.addEventListener("DOMContentLoaded", () => {
    fetchAdminTransactions(10);
});


// ==========================
//  Actions sur les abonnés
// ==========================

// 🔒 Bloquer un utilisateur
async function blockUser(id) {
    if (!confirm("Voulez-vous vraiment bloquer cet utilisateur ?")) return;

    try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`${API_BASE}/auth/users/${id}/block`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Erreur blocage " + res.status);
        alert("✅ Utilisateur bloqué avec succès !");
        loadSubscribers(); // recharge la liste
    } catch (err) {
        console.error("❌ Erreur blockUser:", err);
        alert("Impossible de bloquer l’utilisateur.");
    }
}


// ✅ Réactiver un utilisateur
async function activateUser(id) {
    if (!confirm("Voulez-vous réactiver cet utilisateur ?")) return;

    try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`${API_BASE}/auth/users/${id}/activate`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Erreur activation " + res.status);
        alert("✅ Utilisateur réactivé !");
        loadSubscribers();
    } catch (err) {
        console.error("❌ Erreur activateUser:", err);
        alert("Impossible de réactiver l’utilisateur.");
    }
}


// 🗑 Supprimer un utilisateur
async function deleteUser(id) {
    if (!confirm("Voulez-vous supprimer définitivement cet utilisateur ?")) return;

    try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`${API_BASE}/auth/users/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Erreur suppression " + res.status);
        alert("🗑️ Utilisateur supprimé !");
        loadSubscribers();
    } catch (err) {
        console.error("❌ Erreur deleteUser:", err);
        alert("Impossible de supprimer l’utilisateur.");
    }
}

// 📩 Envoyer un rappel
async function sendReminder(id) {
    try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`${API_BASE}/auth/users/${id}/reminder`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Erreur reminder " + res.status);
        const data = await res.json();
        alert("📩 " + data.message);
    } catch (err) {
        console.error("❌ Erreur sendReminder:", err);
        alert("Impossible d’envoyer le rappel.");
    }
}

// ---------- Admin Withdrawals ----------
function openWithdrawModal() {
    document.getElementById("withdrawModal").classList.remove("hidden");
}

function closeWithdrawModal() {
    document.getElementById("withdrawModal").classList.add("hidden");
}

async function submitWithdraw() {
    console.log("✅ Fonction submitWithdraw déclenchée !");
    const amount = parseFloat(document.getElementById("withdrawAmount").value); // ✅ cast en number
    const method = document.getElementById("withdrawMethod").value;
    const token = localStorage.getItem("authToken");
    console.log("Valeurs saisies:", { amount, method, token });

    if (!amount || amount <= 0) {
        alert("Veuillez entrer un montant valide");
        return;
    }

    try {
        console.log("📤 Envoi retrait:", { amount, method }); // 👀 log frontend

        const res = await fetch(`${API_BASE}/admin-withdrawals`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ amount, method })
        });

        const data = await res.json();
        console.log("📥 Réponse API retrait:", data); // 👀 log réponse

        if (!res.ok) throw new Error(data.error || "Erreur API");

        showNotification("✅ Demande de retrait enregistrée", "success");
        closeWithdrawModal();

        // (Optionnel) Rafraîchir la liste des retraits
        // await loadWithdrawals();

    } catch (err) {
        console.error("❌ Erreur submitWithdraw:", err);
        showNotification("❌ Erreur lors du retrait", "error");
    }
}


async function loadAdminAccounts() {
    try {
        const res = await fetch(API_BASE + "/admin-stats/accounts", {
            headers: { "Authorization": "Bearer " + localStorage.getItem("authToken") }
        });

        if (!res.ok) throw new Error("Erreur API " + res.status);
        const data = await res.json();

        // Mettre à jour les cartes
        document.querySelector("#orangeBalance").textContent = `FCFA${data.accounts.orange || 0}`;
        document.querySelector("#waveBalance").textContent = `FCFA${data.accounts.wave || 0}`;
        document.querySelector("#cashBalance").textContent = `FCFA${data.accounts.cash || 0}`;

        // Résumé des comptes
        document.querySelector("#totalDisponible").textContent = `FCFA${data.total}`;
        document.querySelector("#entriesToday").textContent = `FCFA${data.entries}`;
        document.querySelector("#withdrawalsToday").textContent = `FCFA${data.withdrawals}`;
        document.querySelector("#netProfit").textContent = `FCFA${data.net}`;
    } catch (err) {
        console.error("❌ Impossible de charger les comptes:", err);
        showNotification("Erreur lors du chargement des comptes", "error");
    }
}

// Charger au démarrage
document.addEventListener("DOMContentLoaded", loadAdminAccounts);

// --- Utils pour gérer les modals ---
function showModal(id) {
    document.getElementById(id).classList.remove("hidden");
}

function hideModal(id) {
    document.getElementById(id).classList.add("hidden");
}

// Instances Chart.js
let revenueBreakdownChart = null;
let growthChart = null;

/* ====== Utilitaires ====== */
function formatFCFA(n) {
    const num = Number(n || 0);
    return 'FCFA' + num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function fetchAuthJSON(path, opts = {}) {
    const token = localStorage.getItem('authToken');
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API_BASE + path, Object.assign({}, opts, { headers }));
    if (!res.ok) {
        const text = await res.text().catch(() => null);
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
        const err = new Error('API error ' + res.status + (body && body.error ? (': ' + body.error) : ''));
        err.status = res.status; err.body = body;
        throw err;
    }
    return res.json();
}

/* ====== Chargement principal ====== */
async function loadAnalytics(period = 'monthly') {
    try {
        // Indicateur console pour debug
        console.log("🔎 loadAnalytics period =", period);

        // Lancer les requêtes en parallèle
        const [revenus, transactions, accounts, users] = await Promise.all([
            fetchAuthJSON(`/admin-stats/revenus?period=${encodeURIComponent(period)}`),
            fetchAuthJSON(`/admin-stats/transactions?limit=100`),
            fetchAuthJSON(`/admin-stats/accounts`),
            fetchAuthJSON(`/auth/users`)
        ]);

        console.log('📊 revenus', revenus, '📥 transactions', transactions, '🏦 accounts', accounts);

        // KPI 1 : Chiffre d'affaires (balance total)
        document.getElementById('kpiCA').textContent = formatFCFA(revenus.balance || 0);

        // KPI 2 : Taux de conversion = validatedPremium / totalUsers * 100
        const totalUsers = Array.isArray(users) ? users.length : 0;
        const validatedPremiumUsers = (users || []).filter(u => u.plan === 'Premium' && (u.upgrade_status === 'validé' || u.upgrade_status === 'validé'.toLowerCase()));
        const validatedCount = validatedPremiumUsers.length;
        const conversion = totalUsers ? ((validatedCount / totalUsers) * 100) : 0;
        document.getElementById('kpiConversion').textContent = conversion.toFixed(1) + '%';

        // KPI 3 : Valeur moyenne par abonnement (balance / validatedCount)
        const avgValue = validatedCount ? ((revenus.balance || 0) / validatedCount) : 0;
        document.getElementById('kpiAvgValue').textContent = formatFCFA(avgValue);

        // KPI 4 : Rétention = proportion des premium validés dont expiration > today
        const now = new Date();
        const premiumWithFutureExp = validatedPremiumUsers.filter(u => u.expiration && new Date(u.expiration) > now).length;
        const retention = validatedCount ? ((premiumWithFutureExp / validatedCount) * 100) : 0;
        document.getElementById('kpiRetention').textContent = retention.toFixed(1) + '%';

        // Balance / Period / Pending (section Revenus déjà sur la page)
        if (revenus) {
            if (document.getElementById('balanceMain')) document.getElementById('balanceMain').textContent = formatFCFA(revenus.balance || 0);
            if (document.getElementById('revenuePeriodValue')) document.getElementById('revenuePeriodValue').textContent = formatFCFA(revenus.periodTotal || 0);
            if (document.getElementById('pendingAmount')) document.getElementById('pendingAmount').textContent = formatFCFA(revenus.pending || 0);
        }

        // Transactions récentes (liste simple)
        renderTransactionsList(transactions);

        // Graph 1 : répartition des revenus par méthode — on essaie d'utiliser accounts.accounts en priorité
        let breakdownData = { wave: 0, orange: 0, cash: 0 };
        if (accounts && accounts.accounts) {
            breakdownData = Object.assign(breakdownData, accounts.accounts);
        } else {
            // fallback : calculer à partir des transactions
            (transactions || []).forEach(t => {
                const m = (t.payment_method || t.method || '').toLowerCase();
                if (m === 'wave' || m === 'orange' || m === 'cash') {
                    breakdownData[m] = (breakdownData[m] || 0) + Number(t.amount || t.total || 0);
                }
            });
        }
        renderRevenueBreakdownChart(breakdownData);

        // Graph 2 : croissance mensuelle à partir des transactions (regrouper par mois)
        const monthly = aggregateMonthly(transactions || []);
        renderGrowthChart(monthly);

    } catch (err) {
        console.error("Erreur loadAnalytics:", err);
        // message simple pour l'admin
        showNotification ? showNotification("Impossible de charger les analyses", "error") : alert("Erreur chargement analyses : " + (err.message || err));
    }
}

/* ====== Rendu transactions ====== */
function renderTransactionsList(transactions) {
    const container = document.getElementById('transactionsList');
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(transactions) || transactions.length === 0) {
        container.innerHTML = '<div class="p-6 text-gray-500 text-center">Aucune transaction récente</div>';
        return;
    }

    transactions.slice(0, 20).forEach(t => {
        const amount = Number(t.amount || t.total || 0);
        const when = t.created_at ? (new Date(t.created_at)).toLocaleString('fr-FR') : '—';
        const method = t.payment_method || t.method || '—';
        const user = t.username || t.user || '—';

        const node = document.createElement('div');
        node.className = 'px-6 py-4 flex items-center justify-between';
        node.innerHTML = `
      <div>
        <div class="font-medium text-gray-800">${user} <span class="text-xs text-gray-500">(${t.plan || '—'})</span></div>
        <div class="text-sm text-gray-500">${t.description || ''}</div>
      </div>
      <div class="text-right">
        <div class="font-bold text-gray-800">${formatFCFA(amount)}</div>
        <div class="text-xs text-gray-500">${method} • ${when}</div>
      </div>
    `;
        container.appendChild(node);
    });
}

/* ====== Chart helpers ====== */
function renderRevenueBreakdownChart(dataObj) {
    const ctx = document.getElementById('revenueBreakdownChart').getContext('2d');

    // ✅ Forcer la destruction si le canvas est occupé
    if (Chart.getChart(ctx)) {
        Chart.getChart(ctx).destroy();
    }

    const labels = [];
    const values = [];
    if ((dataObj.wave || 0) > 0) { labels.push('Wave'); values.push(Number(dataObj.wave || 0)); }
    if ((dataObj.orange || 0) > 0) { labels.push('Orange'); values.push(Number(dataObj.orange || 0)); }
    if ((dataObj.cash || 0) > 0) { labels.push('Cash'); values.push(Number(dataObj.cash || 0)); }
    if (labels.length === 0) { labels.push('Aucun'); values.push(0); }

    revenueBreakdownChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data: values }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: ctx => formatFCFA(ctx.raw) } }
            }
        }
    });
}

function renderGrowthChart(monthlyObj) {
    const ctx = document.getElementById('growthChart').getContext('2d');

    // ✅ Forcer la destruction si le canvas est occupé
    if (Chart.getChart(ctx)) {
        Chart.getChart(ctx).destroy();
    }

    const labels = Object.keys(monthlyObj);
    const values = labels.map(k => Number(monthlyObj[k] || 0));

    growthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Revenus',
                data: values,
                tension: 0.3,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => formatFCFA(ctx.raw) } }
            },
            scales: {
                y: { ticks: { callback: v => v >= 1000 ? (v / 1000) + 'k' : v } }
            }
        }
    });
}

/* ====== Aggregations ====== */
function aggregateMonthly(transactions) {
    // Retourne un objet avec les 6 derniers mois (clé YYYY-MM) et somme des montants
    const map = {};
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 7); // YYYY-MM
        months.push(key);
        map[key] = 0;
    }

    transactions.forEach(t => {
        const date = t.created_at ? new Date(t.created_at) : null;
        if (!date || isNaN(date)) return;
        const key = date.toISOString().slice(0, 7);
        if (map.hasOwnProperty(key)) {
            map[key] += Number(t.amount || t.total || 0);
        }
    });

    // assure l'ordre des 6 mois
    const ordered = {};
    months.forEach(k => { ordered[k] = map[k] || 0; });
    return ordered;
}

/* ====== Hook sur select période ====== */
document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('revenuePeriodFilter');
    if (select) {
        select.addEventListener('change', (e) => {
            const period = e.target.value || 'monthly';
            // Mettre à jour l'info d'affichage comme tu avais
            const infoMap = {
                all: 'Tous les revenus affichés',
                daily: 'Revenus journaliers affichés',
                weekly: 'Revenus hebdomadaires affichés',
                monthly: 'Revenus mensuels affichés'
            };
            const infoElm = document.getElementById('revenueFilterInfo');
            if (infoElm) infoElm.textContent = infoMap[period] || 'Revenus affichés';
            // Recharger les données
            loadAnalytics(period);
        });
    }

    // Appel initial
    loadAnalytics('monthly');
});

// ✅ Charger les paramètres
async function loadSettings() {
    const token = localStorage.getItem("authToken");
    try {
        const res = await fetch(`${API_BASE}/admin-settings`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const settings = await res.json();

        // Remplir les inputs
        document.querySelector("#settings input[type='text']").value = settings.app_name;
        document.querySelector("#settings input[type='email']").value = settings.contact_email;
        document.querySelector("#settings select").value = settings.timezone;

        const numberInputs = document.querySelectorAll("#settings input[type='number']");
        numberInputs[0].value = settings.premium_price;
        numberInputs[1].value = settings.grace_period;

        const checkboxes = document.querySelectorAll("#settings input[type='checkbox']");
        checkboxes[0].checked = settings.alerts_enabled;          // ✅ correct
        checkboxes[1].checked = settings.notify_new_subs;         // ✅ correct
        checkboxes[2].checked = settings.notify_late_payments;    // ✅ correct
        checkboxes[3].checked = settings.notify_reports;          // ✅ correct
        checkboxes[4].checked = settings.multi_sessions;          // ✅ correct
    } catch (err) {
        console.error("Erreur loadSettings:", err);
    }
}


window.addEventListener("DOMContentLoaded", async () => {
    await loadSettings();
});


// ✅ Sauvegarder les paramètres
async function saveSettings() {
    const token = localStorage.getItem("authToken");

    const numberInputs = document.querySelectorAll("#settings input[type='number']");
    const checkboxes = document.querySelectorAll("#settings input[type='checkbox']");

    const payload = {
        app_name: document.querySelector("#settings input[type='text']").value,
        contact_email: document.querySelector("#settings input[type='email']").value,
        timezone: document.querySelector("#settings select").value,
        premium_price: parseFloat(numberInputs[0].value),
        grace_period: parseInt(numberInputs[1].value),
        alerts_enabled: checkboxes[0].checked,
        notify_new_subs: checkboxes[1].checked,
        notify_late_payments: checkboxes[2].checked,
        notify_reports: checkboxes[3].checked,
        multi_sessions: checkboxes[4].checked,
    };

    try {
        const res = await fetch(`${API_BASE}/admin-settings`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur API");
        showNotification("✅ Paramètres sauvegardés", "success");
    } catch (err) {
        console.error("Erreur saveSettings:", err);
        showNotification("❌ Erreur lors de la sauvegarde", "error");
    }
}

async function toggle2FA() {
    const token = localStorage.getItem("authToken");

    try {
        const res = await fetch(`${API_BASE}/admin-settings/twofa`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur API");

        showNotification(`🔐 2FA ${data.enabled ? "activée" : "désactivée"}`, "success");
    } catch (err) {
        console.error("Erreur toggle2FA:", err);
        showNotification("❌ Erreur lors de l’activation 2FA", "error");
    }
}

// Charger la courbe des revenus
let revenueChartInstance = null; // variable globale

async function loadRevenueChart() {
    try {
        const res = await fetch(API_BASE + "/admin-stats/revenus/evolution", {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("authToken"),
                "Content-Type": "application/json"
            }
        });
        const data = await res.json();

        // ✅ Vérifie s’il existe déjà un graphique sur ce canvas et détruis-le
        const existingChart = Chart.getChart("revenueChart");
        if (existingChart) {
            existingChart.destroy();
        }

        const ctx = document.getElementById("revenueChart").getContext("2d");

        new Chart(ctx, {
            type: "line",
            data: {
                labels: data.map(item => item.mois),
                datasets: [{
                    label: "Revenus",
                    data: data.map(item => item.total),
                    borderColor: "#8b5cf6",
                    backgroundColor: "rgba(139,92,246,0.1)",
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: true }
                }
            }
        });
    } catch (err) {
        console.error("❌ Erreur loadRevenueChart:", err);
    }
}



// Charger l’overview
async function loadDashboardOverview() {
    try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`${API_BASE}/admin-stats/overview`, {
            headers: { "Authorization": "Bearer " + token }
        });

        if (!res.ok) throw new Error("Erreur API " + res.status);
        const data = await res.json();

        // ✅ Mise à jour des cartes (valeurs totales)
        document.getElementById("totalUsers").textContent = data.totalUsers;
        document.getElementById("activePremium").textContent = data.activePremium;
        document.getElementById("revenues").textContent = `FCFA${data.revenues}`;
        document.getElementById("pendingSubs").textContent = data.pending;

        // ✅ Fonction de calcul + couleur dynamique
        function calcGrowth(current, prev) {
            if (prev === 0) {
                return { text: "+0%", class: "text-gray-500" };
            }
            const pct = ((current - prev) / prev * 100).toFixed(1);
            return {
                text: (pct >= 0 ? "+" : "") + pct + "%",
                class: pct > 0 ? "text-green-500" : (pct < 0 ? "text-red-500" : "text-gray-500")
            };
        }

        // ✅ Total Users Growth
        let g1 = calcGrowth(data.growth.totalUsers.current, data.growth.totalUsers.previous);
        let el1 = document.getElementById("totalUsersGrowth");
        el1.textContent = g1.text;
        el1.className = g1.class + " text-sm font-medium";

        // ✅ Active Premium Growth
        let g2 = calcGrowth(data.growth.activePremium.current, data.growth.activePremium.previous);
        let el2 = document.getElementById("activePremiumGrowth");
        el2.textContent = g2.text;
        el2.className = g2.class + " text-sm font-medium";

        // ✅ Revenues Growth
        let g3 = calcGrowth(data.growth.revenues.current, data.growth.revenues.previous);
        let el3 = document.getElementById("revenuesGrowth");
        el3.textContent = g3.text;
        el3.className = g3.class + " text-sm font-medium";

    } catch (err) {
        console.error("❌ Erreur loadDashboardOverview:", err);
        showNotification("Erreur chargement dashboard", "error");
    }
}


// Auto-chargement au démarrage
document.addEventListener("DOMContentLoaded", () => {
    loadDashboardOverview();
    //  loadAdminAccounts();   // ⚡ déjà implémenté plus haut
    loadRevenueChart();
});

let alertCount = 0;

async function loadAlerts() {
    const token = localStorage.getItem("authToken");
    try {
        const res = await fetch(`${API_BASE}/alerts`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const alerts = await res.json();

        const panel = document.querySelector("#notificationPanel .max-h-64");
        panel.innerHTML = ""; // reset

        alerts.forEach(a => {
            const color = a.type === "late" ? "bg-red-500" : "bg-orange-500";

            const div = document.createElement("div");
            div.className = "p-3 border-b border-gray-100 hover:bg-gray-50";
            div.id = a.id;
            div.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-2 h-2 ${color} rounded-full"></div>
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-800">${a.username || "Utilisateur"}</p>
              <p class="text-xs text-gray-500">${a.message}</p>
            </div>
          </div>
          <div class="flex space-x-1">
            <button onclick="markAsSeen('${a.id}')" class="text-gray-400 hover:text-blue-500 p-1" title="Marquer comme vue">👁️</button>
            <button onclick="ignoreAlert('${a.id}')" class="text-gray-400 hover:text-orange-500 p-1" title="Ignorer">👁️‍🗨️</button>
            <button onclick="closeAlert('${a.id}')" class="text-gray-400 hover:text-red-500 p-1" title="Fermer">✕</button>
          </div>
        </div>
      `;
            panel.appendChild(div);
        });

        alertCount = alerts.length;
        updateAlertBadge();
    } catch (err) {
        console.error("Erreur loadAlerts:", err);
    }
}

// Ouvrir/fermer panneau
function toggleNotifications() {
    document.getElementById("notificationPanel").classList.toggle("hidden");
}

// Charger au démarrage
window.addEventListener("DOMContentLoaded", loadAlerts);

// Rafraîchir les alertes (simple reload depuis la DB)
async function refreshAlerts() {
    try {
        await loadAlerts();
        showNotification("🔄 Alertes rechargées", "success");
    } catch (err) {
        console.error("Erreur refreshAlerts:", err);
        showNotification("❌ Impossible de rafraîchir les alertes", "error");
    }
}

// Marquer une alerte comme vue
async function markAsSeen(alertId) {
    const token = localStorage.getItem("authToken");
    try {
        const res = await fetch(`${API_BASE}/alerts/${alertId}/seen`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur API");

        // Style "vue"
        const el = document.getElementById(alertId);
        if (el) el.classList.add("opacity-70");

        showNotification(data.message || "👁️ Alerte marquée comme vue", "info");
        await loadAlerts();
    } catch (err) {
        console.error("Erreur markAsSeen:", err);
        showNotification("❌ Impossible de marquer comme vue", "error");
    }
}

async function loadAdminInfo() {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { "Authorization": "Bearer " + token }
        });

        if (!res.ok) throw new Error("Erreur API");
        const data = await res.json();

        // ✅ Injecter l’email dans le span
        document.getElementById("adminEmail").textContent = data.username || "Admin";
    } catch (err) {
        console.error("❌ Erreur loadAdminInfo:", err);
        document.getElementById("adminEmail").textContent = "Admin";
    }
}

// Charger au démarrage
document.addEventListener("DOMContentLoaded", loadAdminInfo);
