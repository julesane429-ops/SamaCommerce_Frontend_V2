/**
 * admin-modules.js — Extension du dashboard admin
 *
 * Ajoute 3 nouvelles sections dans l'admin :
 *   - Vue globale des Clients (tous utilisateurs)
 *   - Vue globale des Commandes (toutes boutiques)
 *   - Vue globale des Livraisons (toutes boutiques)
 *
 * + 3 nouvelles cartes KPI sur le tableau de bord :
 *   - Total clients enregistrés
 *   - Commandes en attente
 *   - Livraisons en retard
 *
 * INTÉGRATION dans admin.html :
 *   1. Ajouter dans <head> : <script src="admin-modules.js" defer></script>
 *   2. Copier les sections HTML (voir PATCH_admin.html)
 *   3. Ajouter les liens dans la sidebar (voir PATCH_admin.html)
 */

(function () {

  const API = () => {
    // API_BASE est défini globalement dans admin.html
    return window.API_BASE || 'https://samacommerce-backend-v2.onrender.com';
  };

  function authHeaders() {
    return {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + localStorage.getItem('authToken'),
    };
  }

  async function apiFetch(path) {
    const res = await fetch(API() + path, { headers: authHeaders() });
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return res.json();
  }

  // ── Notification (réutilise celle d'admin.js si disponible) ──
  function notify(msg, type = 'info') {
    if (typeof window.showNotification === 'function') {
      window.showNotification(msg, type);
    } else {
      console.log(`[${type}]`, msg);
    }
  }

  // ════════════════════════════════════════════════════════════
  // KPI CARDS — Injectées dans le dashboard existant
  // ════════════════════════════════════════════════════════════

  async function loadModulesKPIs() {
    try {
      // Appels en parallèle — endpoint admin qui agrège tous les users
      // Ces endpoints nécessitent role=admin (vérifiés côté backend)
      const [clients, commandes, livraisons] = await Promise.allSettled([
        apiFetch('/admin-stats/clients'),
        apiFetch('/admin-stats/commandes'),
        apiFetch('/admin-stats/livraisons'),
      ]);

      const totalClients  = clients.status     === 'fulfilled' ? (clients.value.total     || 0) : '—';
      const cmdEnAttente  = commandes.status   === 'fulfilled' ? (commandes.value.en_attente || 0) : '—';
      const livRetard     = livraisons.status  === 'fulfilled' ? (livraisons.value.en_retard  || 0) : '—';

      injectKPICards(totalClients, cmdEnAttente, livRetard);
    } catch (err) {
      console.warn('admin-modules KPI:', err);
      injectKPICards('—', '—', '—');
    }
  }

  function injectKPICards(clients, commandes, livraisons) {
    const grid = document.querySelector('#dashboard .stats-grid, #dashboard .grid');
    if (!grid || document.getElementById('kpi-clients-card')) return;

    const cards = [
      {
        id:     'kpi-clients-card',
        label:  'Total Clients',
        value:  clients,
        icon:   '👥',
        bg:     '#EFF6FF',
        color:  '#2563EB',
        sub:    'Clients enregistrés',
        nav:    'adminClients',
      },
      {
        id:     'kpi-commandes-card',
        label:  'Commandes en attente',
        value:  commandes,
        icon:   '📦',
        bg:     '#FFFBEB',
        color:  '#D97706',
        sub:    'À réceptionner',
        nav:    'adminCommandes',
      },
      {
        id:     'kpi-livraisons-card',
        label:  'Livraisons en retard',
        value:  livraisons,
        icon:   '🚛',
        bg:     livraisons > 0 ? '#FEF2F2' : '#ECFDF5',
        color:  livraisons > 0 ? '#DC2626'  : '#059669',
        sub:    livraisons > 0 ? 'Attention requise' : 'Tout est à jour',
        nav:    'adminLivraisons',
      },
    ];

    cards.forEach(card => {
      const el = document.createElement('div');
      el.id = card.id;
      el.className = 'stat-card bg-white rounded-xl shadow-sm p-6 border border-gray-100';
      el.style.cursor = 'pointer';
      el.innerHTML = `
        <div class="stat-card-top">
          <div class="stat-card-label">${card.label}</div>
          <div class="stat-icon" style="background:${card.bg};">${card.icon}</div>
        </div>
        <div class="stat-value" style="color:${card.color};">${card.value}</div>
        <div class="stat-footer">
          <span style="font-size:12px;color:#6B7280;">${card.sub}</span>
        </div>
      `;
      el.addEventListener('click', () => {
        if (typeof window.showSection === 'function') window.showSection(card.nav);
      });
      grid.appendChild(el);
    });
  }

  // ════════════════════════════════════════════════════════════
  // SECTION CLIENTS ADMIN
  // ════════════════════════════════════════════════════════════

  let allClients    = [];
  let clientsFilter = '';

  async function loadAdminClients() {
    const container = document.getElementById('adminClientsList');
    if (!container) return;

    container.innerHTML = '<div class="text-center text-gray-500 py-8">⏳ Chargement…</div>';

    try {
      // Récupérer tous les users puis leur clients
      const users = await apiFetch('/auth/users');

      // Pour chaque user, charger ses clients en parallèle
      const results = await Promise.allSettled(
        users.map(u => apiFetch(`/clients?_admin_user=${u.id}`).catch(() => []))
      );

      // Agréger avec le nom de l'utilisateur
      allClients = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const list = Array.isArray(r.value) ? r.value : [];
          list.forEach(c => {
            allClients.push({ ...c, _boutique: users[i].company_name || users[i].username });
          });
        }
      });

      renderAdminClients();
    } catch (err) {
      console.warn('loadAdminClients:', err);
      // Fallback : afficher message d'aide
      container.innerHTML = `
        <div class="text-center text-gray-500 py-8">
          <div class="text-4xl mb-3">👥</div>
          <div class="font-semibold mb-2">Données clients non disponibles</div>
          <div class="text-sm">L'endpoint admin pour les clients sera disponible après déploiement.</div>
        </div>
      `;
    }
  }

  function renderAdminClients() {
    const container = document.getElementById('adminClientsList');
    if (!container) return;

    const term     = clientsFilter.toLowerCase();
    const filtered = allClients.filter(c =>
      !term ||
      (c.name  || '').toLowerCase().includes(term) ||
      (c.phone || '').includes(term) ||
      (c._boutique || '').toLowerCase().includes(term)
    );

    // Stats
    const totalCA = allClients.reduce((s, c) => s + Number(c.total_achats || 0), 0);
    const statsEl = document.getElementById('adminClientsStats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="bg-blue-50 rounded-xl p-4 text-center">
            <div class="text-2xl font-bold text-blue-600">${allClients.length}</div>
            <div class="text-sm text-blue-700">Total clients</div>
          </div>
          <div class="bg-green-50 rounded-xl p-4 text-center">
            <div class="text-2xl font-bold text-green-600">${totalCA.toLocaleString('fr-FR')} F</div>
            <div class="text-sm text-green-700">CA clients</div>
          </div>
          <div class="bg-purple-50 rounded-xl p-4 text-center">
            <div class="text-2xl font-bold text-purple-600">
              ${allClients.length ? Math.round(totalCA / allClients.length).toLocaleString('fr-FR') : 0} F
            </div>
            <div class="text-sm text-purple-700">Panier moyen</div>
          </div>
        </div>
      `;
    }

    if (!filtered.length) {
      container.innerHTML = '<div class="text-center text-gray-500 py-8">Aucun client trouvé</div>';
      return;
    }

    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="p-3 text-left font-semibold text-gray-600">Client</th>
              <th class="p-3 text-left font-semibold text-gray-600">Contact</th>
              <th class="p-3 text-left font-semibold text-gray-600">Boutique</th>
              <th class="p-3 text-right font-semibold text-gray-600">CA total</th>
              <th class="p-3 text-center font-semibold text-gray-600">Achats</th>
              <th class="p-3 text-left font-semibold text-gray-600">Depuis</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${filtered.map(c => `
              <tr class="hover:bg-gray-50 transition">
                <td class="p-3">
                  <div class="flex items-center gap-3">
                    <div style="
                      width:34px;height:34px;border-radius:10px;
                      background:linear-gradient(135deg,#7C3AED,#EC4899);
                      color:#fff;font-weight:700;font-size:12px;
                      display:flex;align-items:center;justify-content:center;
                      flex-shrink:0;
                    ">
                      ${(c.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}
                    </div>
                    <div>
                      <div class="font-semibold text-gray-800">${c.name || '—'}</div>
                      ${c.email ? `<div class="text-xs text-gray-500">${c.email}</div>` : ''}
                    </div>
                  </div>
                </td>
                <td class="p-3 text-gray-600">${c.phone || '—'}</td>
                <td class="p-3">
                  <span class="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-1 rounded-full">
                    ${c._boutique || '—'}
                  </span>
                </td>
                <td class="p-3 text-right font-bold text-purple-600">
                  ${Number(c.total_achats || 0).toLocaleString('fr-FR')} F
                </td>
                <td class="p-3 text-center text-gray-600">${c.nb_achats || 0}</td>
                <td class="p-3 text-gray-500 text-xs">
                  ${c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════
  // SECTION COMMANDES ADMIN
  // ════════════════════════════════════════════════════════════

  let allCommandes    = [];
  let commandesStatus = 'tous';

  const STATUS_COLORS = {
    en_attente: { bg: '#FEF3C7', text: '#92400E', label: '⏳ En attente' },
    confirmee:  { bg: '#EFF6FF', text: '#1E40AF', label: '✅ Confirmée'  },
    recue:      { bg: '#ECFDF5', text: '#065F46', label: '📥 Reçue'      },
    annulee:    { bg: '#FEE2E2', text: '#991B1B', label: '❌ Annulée'    },
  };

  async function loadAdminCommandes() {
    const container = document.getElementById('adminCommandesList');
    if (!container) return;

    container.innerHTML = '<div class="text-center text-gray-500 py-8">⏳ Chargement…</div>';

    try {
      const users = await apiFetch('/auth/users');

      const results = await Promise.allSettled(
        users.map(u => apiFetch(`/commandes`).catch(() => []))
      );

      allCommandes = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const list = Array.isArray(r.value) ? r.value : [];
          list.forEach(c => {
            allCommandes.push({ ...c, _boutique: users[i].company_name || users[i].username });
          });
        }
      });

      renderAdminCommandesStats();
      renderAdminCommandes();
    } catch (err) {
      console.warn('loadAdminCommandes:', err);
      container.innerHTML = `
        <div class="text-center text-gray-500 py-8">
          <div class="text-4xl mb-3">📦</div>
          <div class="font-semibold">Données non disponibles</div>
        </div>
      `;
    }
  }

  function renderAdminCommandesStats() {
    const el = document.getElementById('adminCommandesStats');
    if (!el) return;

    const total      = allCommandes.length;
    const enAttente  = allCommandes.filter(c => c.status === 'en_attente').length;
    const recues     = allCommandes.filter(c => c.status === 'recue').length;
    const totalVal   = allCommandes.reduce((s, c) => s + Number(c.total || 0), 0);

    el.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-purple-50 rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-purple-600">${total}</div>
          <div class="text-sm text-purple-700">Total</div>
        </div>
        <div class="bg-yellow-50 rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-yellow-600">${enAttente}</div>
          <div class="text-sm text-yellow-700">En attente</div>
        </div>
        <div class="bg-green-50 rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-green-600">${recues}</div>
          <div class="text-sm text-green-700">Reçues</div>
        </div>
        <div class="bg-blue-50 rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-blue-600">${totalVal.toLocaleString('fr-FR')} F</div>
          <div class="text-sm text-blue-700">Valeur totale</div>
        </div>
      </div>
    `;
  }

  function renderAdminCommandes() {
    const container = document.getElementById('adminCommandesList');
    if (!container) return;

    const filtered = commandesStatus === 'tous'
      ? allCommandes
      : allCommandes.filter(c => c.status === commandesStatus);

    if (!filtered.length) {
      container.innerHTML = '<div class="text-center text-gray-500 py-6">Aucune commande</div>';
      return;
    }

    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="p-3 text-left font-semibold text-gray-600">#</th>
              <th class="p-3 text-left font-semibold text-gray-600">Boutique</th>
              <th class="p-3 text-left font-semibold text-gray-600">Fournisseur</th>
              <th class="p-3 text-right font-semibold text-gray-600">Total</th>
              <th class="p-3 text-center font-semibold text-gray-600">Statut</th>
              <th class="p-3 text-left font-semibold text-gray-600">Date</th>
              <th class="p-3 text-left font-semibold text-gray-600">Prévue le</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${filtered.map(c => {
              const sc = STATUS_COLORS[c.status] || STATUS_COLORS.en_attente;
              const isLate = c.expected_date && new Date(c.expected_date) < new Date() && c.status !== 'recue';
              return `
                <tr class="hover:bg-gray-50 transition ${isLate ? 'bg-red-50' : ''}">
                  <td class="p-3 text-gray-500">#${c.id}</td>
                  <td class="p-3">
                    <span class="bg-violet-100 text-violet-700 text-xs font-semibold px-2 py-1 rounded-full">
                      ${c._boutique || '—'}
                    </span>
                  </td>
                  <td class="p-3 font-medium text-gray-800">${c.fournisseur_name || '—'}</td>
                  <td class="p-3 text-right font-bold text-violet-600">
                    ${Number(c.total || 0).toLocaleString('fr-FR')} F
                  </td>
                  <td class="p-3 text-center">
                    <span style="background:${sc.bg};color:${sc.text};"
                          class="text-xs font-bold px-2 py-1 rounded-full">
                      ${sc.label}
                    </span>
                  </td>
                  <td class="p-3 text-gray-500 text-xs">
                    ${new Date(c.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td class="p-3 text-xs ${isLate ? 'text-red-600 font-bold' : 'text-gray-500'}">
                    ${c.expected_date ? new Date(c.expected_date).toLocaleDateString('fr-FR') : '—'}
                    ${isLate ? ' ⚠️' : ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════
  // SECTION LIVRAISONS ADMIN
  // ════════════════════════════════════════════════════════════

  let allLivraisons    = [];
  let livraisonsStatus = 'tous';

  const LIV_COLORS = {
    en_attente: { bg: '#FFFBEB', text: '#92400E', label: '⏳ En attente', icon: '⏳' },
    en_transit: { bg: '#EFF6FF', text: '#1E40AF', label: '🚛 En transit',  icon: '🚛' },
    livree:     { bg: '#ECFDF5', text: '#065F46', label: '✅ Livrée',      icon: '✅' },
    probleme:   { bg: '#FEE2E2', text: '#991B1B', label: '⚠️ Problème',    icon: '⚠️' },
  };

  async function loadAdminLivraisons() {
    const container = document.getElementById('adminLivraisonsList');
    if (!container) return;

    container.innerHTML = '<div class="text-center text-gray-500 py-8">⏳ Chargement…</div>';

    try {
      const users = await apiFetch('/auth/users');

      const results = await Promise.allSettled(
        users.map(u => apiFetch('/livraisons').catch(() => []))
      );

      allLivraisons = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const list = Array.isArray(r.value) ? r.value : [];
          list.forEach(l => {
            allLivraisons.push({ ...l, _boutique: users[i].company_name || users[i].username });
          });
        }
      });

      renderAdminLivraisonsStats();
      renderAdminLivraisons();
    } catch (err) {
      console.warn('loadAdminLivraisons:', err);
      container.innerHTML = `
        <div class="text-center text-gray-500 py-8">
          <div class="text-4xl mb-3">🚚</div>
          <div class="font-semibold">Données non disponibles</div>
        </div>
      `;
    }
  }

  function renderAdminLivraisonsStats() {
    const el = document.getElementById('adminLivraisonsStats');
    if (!el) return;

    const now       = new Date();
    const enTransit = allLivraisons.filter(l => l.status === 'en_transit').length;
    const livrees   = allLivraisons.filter(l => l.status === 'livree').length;
    const problemes = allLivraisons.filter(l => l.status === 'probleme').length;
    const retard    = allLivraisons.filter(l => {
      if (l.status !== 'en_transit') return false;
      return (now - new Date(l.created_at)) / (1000 * 60 * 60 * 24) > 3;
    }).length;

    el.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-blue-50 rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-blue-600">${enTransit}</div>
          <div class="text-sm text-blue-700">En transit</div>
        </div>
        <div class="bg-green-50 rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-green-600">${livrees}</div>
          <div class="text-sm text-green-700">Livrées</div>
        </div>
        <div class="bg-red-50 rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-red-600">${retard}</div>
          <div class="text-sm text-red-700">En retard</div>
        </div>
        <div class="bg-orange-50 rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-orange-600">${problemes}</div>
          <div class="text-sm text-orange-700">Problèmes</div>
        </div>
      </div>
    `;
  }

  function renderAdminLivraisons() {
    const container = document.getElementById('adminLivraisonsList');
    if (!container) return;

    const now      = new Date();
    const filtered = livraisonsStatus === 'tous'
      ? allLivraisons
      : allLivraisons.filter(l => l.status === livraisonsStatus);

    if (!filtered.length) {
      container.innerHTML = '<div class="text-center text-gray-500 py-6">Aucune livraison</div>';
      return;
    }

    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="p-3 text-left font-semibold text-gray-600">#</th>
              <th class="p-3 text-left font-semibold text-gray-600">Boutique</th>
              <th class="p-3 text-left font-semibold text-gray-600">Fournisseur</th>
              <th class="p-3 text-center font-semibold text-gray-600">Statut</th>
              <th class="p-3 text-left font-semibold text-gray-600">Note</th>
              <th class="p-3 text-left font-semibold text-gray-600">Créée le</th>
              <th class="p-3 text-left font-semibold text-gray-600">Livrée le</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${filtered.map(l => {
              const sc    = LIV_COLORS[l.status] || LIV_COLORS.en_attente;
              const days  = (now - new Date(l.created_at)) / (1000 * 60 * 60 * 24);
              const isLate = l.status === 'en_transit' && days > 3;
              return `
                <tr class="hover:bg-gray-50 transition ${isLate ? 'bg-orange-50' : ''}">
                  <td class="p-3 text-gray-500">#${l.id}</td>
                  <td class="p-3">
                    <span class="bg-violet-100 text-violet-700 text-xs font-semibold px-2 py-1 rounded-full">
                      ${l._boutique || '—'}
                    </span>
                  </td>
                  <td class="p-3 font-medium text-gray-800">${l.fournisseur_name || '—'}</td>
                  <td class="p-3 text-center">
                    <span style="background:${sc.bg};color:${sc.text};"
                          class="text-xs font-bold px-2 py-1 rounded-full">
                      ${sc.label}
                    </span>
                    ${isLate ? '<div class="text-xs text-orange-600 font-bold mt-1">⏰ ' + Math.floor(days) + 'j en transit</div>' : ''}
                  </td>
                  <td class="p-3 text-gray-500 text-xs max-w-32 truncate">
                    ${l.tracking_note || '—'}
                  </td>
                  <td class="p-3 text-gray-500 text-xs">
                    ${new Date(l.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td class="p-3 text-gray-500 text-xs">
                    ${l.delivered_at ? new Date(l.delivered_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════
  // CHIPS FILTRES STATUT
  // ════════════════════════════════════════════════════════════

  function buildStatusChips(containerId, statuses, current, onChange) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = statuses.map(s => `
      <button
        class="px-3 py-1 rounded-full text-xs font-bold transition mr-2 mb-2
               ${current === s.key
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
        data-key="${s.key}"
        onclick="(function(btn){
          document.querySelectorAll('#${containerId} button').forEach(b => {
            b.className = b.className.replace('bg-violet-600 text-white','bg-gray-100 text-gray-600 hover:bg-gray-200');
          });
          btn.className = btn.className.replace('bg-gray-100 text-gray-600 hover:bg-gray-200','bg-violet-600 text-white');
        })(this); window._adminModulesChipChange('${containerId}','${s.key}');"
      >${s.label}</button>
    `).join('');
  }

  window._adminModulesChipChange = function (containerId, key) {
    if (containerId === 'adminCommandesChips') {
      commandesStatus = key;
      renderAdminCommandes();
    }
    if (containerId === 'adminLivraisonsChips') {
      livraisonsStatus = key;
      renderAdminLivraisons();
    }
  };

  // ════════════════════════════════════════════════════════════
  // HOOK showSection() — charger les données à la navigation
  // ════════════════════════════════════════════════════════════

  function hookShowSection() {
    const orig = window.showSection;
    if (typeof orig !== 'function') {
      setTimeout(hookShowSection, 200);
      return;
    }

    window.showSection = function (name, ...args) {
      orig.call(this, name, ...args);

      if (name === 'adminClients') {
        loadAdminClients();
        const searchEl = document.getElementById('adminClientsSearch');
        if (searchEl && !searchEl._wired) {
          searchEl._wired = true;
          searchEl.addEventListener('input', () => {
            clientsFilter = searchEl.value.trim();
            renderAdminClients();
          });
        }
      }

      if (name === 'adminCommandes') {
        loadAdminCommandes();
        buildStatusChips('adminCommandesChips', [
          { key: 'tous',       label: 'Toutes'      },
          { key: 'en_attente', label: '⏳ En attente' },
          { key: 'confirmee',  label: '✅ Confirmées' },
          { key: 'recue',      label: '📥 Reçues'    },
          { key: 'annulee',    label: '❌ Annulées'  },
        ], commandesStatus, () => {});
      }

      if (name === 'adminLivraisons') {
        loadAdminLivraisons();
        buildStatusChips('adminLivraisonsChips', [
          { key: 'tous',       label: 'Toutes'       },
          { key: 'en_attente', label: '⏳ En attente'  },
          { key: 'en_transit', label: '🚛 En transit'  },
          { key: 'livree',     label: '✅ Livrées'     },
          { key: 'probleme',   label: '⚠️ Problèmes'   },
        ], livraisonsStatus, () => {});
      }
    };
  }

  // ════════════════════════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════════════════════════

  function init() {
    // KPI cards sur le dashboard
    loadModulesKPIs();

    // Hook navigation
    hookShowSection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
