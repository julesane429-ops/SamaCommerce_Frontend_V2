/**
 * clients.js — Module Gestion des Clients
 * Section : #clientsSection
 */

(function () {

  const API = () => document.querySelector('meta[name="api-base"]')?.content
              || 'https://samacommerce-backend-v2.onrender.com';

  const fetch_ = (url, opts = {}) => window.authfetch(url, opts);

  // ── État local ──
  let clients = [];
  let searchTerm = '';

  // ════════════════════════════════════════
  // CHARGEMENT
  // ════════════════════════════════════════
  async function loadClients() {
    try {
      const res = await fetch_(`${API()}/clients`);
      if (!res.ok) throw new Error();
      clients = await res.json();
      render();
    } catch {
      window.showNotification?.('Erreur chargement clients', 'error');
    }
  }

  // ════════════════════════════════════════
  // RENDU LISTE
  // ════════════════════════════════════════
  function render() {
    const container = document.getElementById('clientsList');
    const statsEl   = document.getElementById('clientsStats');
    if (!container) return;

    // Stats
    const totalCA    = clients.reduce((s, c) => s + Number(c.total_achats || 0), 0);
    const totalAchats = clients.reduce((s, c) => s + Number(c.nb_achats || 0), 0);
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="module-stat-tile">
          <div class="msv" style="color:var(--primary);">${clients.length}</div>
          <div class="msl">👥 Clients</div>
        </div>
        <div class="module-stat-tile">
          <div class="msv" style="color:var(--green);">${totalCA.toLocaleString('fr-FR')} F</div>
          <div class="msl">💰 CA clients</div>
        </div>
        <div class="module-stat-tile">
          <div class="msv" style="color:var(--blue);">${totalAchats}</div>
          <div class="msl">🧾 Achats total</div>
        </div>
        <div class="module-stat-tile">
          <div class="msv" style="color:var(--orange);">${clients.length ? Math.round(totalCA / clients.length).toLocaleString('fr-FR') : 0} F</div>
          <div class="msl">📊 Panier moyen</div>
        </div>
      `;
    }

    // Filtrer
    const filtered = clients.filter(c =>
      (c.name || '').toLowerCase().includes(searchTerm) ||
      (c.phone || '').includes(searchTerm)
    );

    if (!filtered.length) {
      container.innerHTML = `
        <div class="module-empty">
          <div class="module-empty-icon">👥</div>
          <div class="module-empty-text">${searchTerm ? 'Aucun client trouvé' : 'Aucun client encore'}</div>
          ${!searchTerm ? '<button class="btn-primary" onclick="window.openClientForm()">Ajouter un client</button>' : ''}
        </div>`;
      return;
    }

    container.innerHTML = '';
    filtered.forEach(c => {
      const initials = (c.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const card = document.createElement('div');
      card.className = 'entity-card';
      card.innerHTML = `
        <div class="entity-avatar avatar-client">${initials}</div>
        <div class="entity-info">
          <div class="entity-name">${c.name}</div>
          <div class="entity-sub">${c.phone || c.email || 'Aucun contact'}</div>
        </div>
        <div class="entity-meta">
          <div class="entity-amount">${Number(c.total_achats || 0).toLocaleString('fr-FR')} F</div>
          <div class="entity-count">${c.nb_achats || 0} achat${c.nb_achats > 1 ? 's' : ''}</div>
        </div>
      `;
      card.addEventListener('click', () => openClientDetail(c));
      container.appendChild(card);
    });
  }

  // ════════════════════════════════════════
  // FORMULAIRE AJOUT / ÉDITION
  // ════════════════════════════════════════
  function openClientForm(existing = null) {
    const backdrop = document.createElement('div');
    backdrop.className = 'module-sheet-backdrop';
    backdrop.id = 'client-form-backdrop';

    backdrop.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">${existing ? '✏️ Modifier client' : '👤 Nouveau client'}</div>

        <div class="form-group"><label>Nom *</label>
          <input id="cf-name" type="text" value="${existing?.name || ''}" placeholder="Nom complet"></div>
        <div class="form-group"><label>Téléphone</label>
          <input id="cf-phone" type="tel" value="${existing?.phone || ''}" placeholder="+221 XX XXX XX XX"></div>
        <div class="form-group"><label>Email</label>
          <input id="cf-email" type="email" value="${existing?.email || ''}" placeholder="email@exemple.com"></div>
        <div class="form-group"><label>Adresse</label>
          <input id="cf-address" type="text" value="${existing?.address || ''}" placeholder="Adresse"></div>
        <div class="form-group"><label>Notes</label>
          <textarea id="cf-notes" style="height:72px;resize:none;">${existing?.notes || ''}</textarea></div>

        <div class="modal-actions">
          <button class="btn-cancel" id="cf-cancel">Annuler</button>
          <button class="btn-confirm" id="cf-save">${existing ? 'Mettre à jour' : 'Ajouter'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.getElementById('cf-cancel').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });

    document.getElementById('cf-save').addEventListener('click', async () => {
      const name = document.getElementById('cf-name').value.trim();
      if (!name) {
        window.showNotification?.('Le nom est requis', 'warning');
        return;
      }
      const body = {
        name,
        phone:   document.getElementById('cf-phone').value.trim()   || null,
        email:   document.getElementById('cf-email').value.trim()   || null,
        address: document.getElementById('cf-address').value.trim() || null,
        notes:   document.getElementById('cf-notes').value.trim()   || null,
      };

      try {
        const url    = existing ? `${API()}/clients/${existing.id}` : `${API()}/clients`;
        const method = existing ? 'PATCH' : 'POST';
        const res    = await fetch_(url, {
          method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        window.showNotification?.(existing ? '✅ Client mis à jour' : '✅ Client ajouté', 'success');
        backdrop.remove();
        loadClients();
      } catch {
        window.showNotification?.('Erreur lors de la sauvegarde', 'error');
      }
    });
  }

  // ════════════════════════════════════════
  // FICHE DÉTAIL CLIENT
  // ════════════════════════════════════════
  function openClientDetail(c) {
    const backdrop = document.createElement('div');
    backdrop.className = 'module-sheet-backdrop';

    backdrop.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>

        <!-- Entête -->
        <div style="text-align:center;margin-bottom:18px;">
          <div class="entity-avatar avatar-client" style="width:64px;height:64px;font-size:28px;margin:0 auto 10px;">
            ${(c.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}
          </div>
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;">${c.name}</div>
        </div>

        <!-- Stats -->
        <div class="module-stats" style="margin-bottom:16px;">
          <div class="module-stat-tile">
            <div class="msv" style="color:var(--primary);">${Number(c.total_achats||0).toLocaleString('fr-FR')} F</div>
            <div class="msl">💰 Total achats</div>
          </div>
          <div class="module-stat-tile">
            <div class="msv" style="color:var(--blue);">${c.nb_achats || 0}</div>
            <div class="msl">🧾 Commandes</div>
          </div>
        </div>

        <!-- Infos -->
        <div class="detail-panel">
          ${c.phone   ? `<div class="detail-row"><span class="detail-row-icon">📞</span><span class="detail-row-label">Téléphone</span><span class="detail-row-val">${c.phone}</span></div>` : ''}
          ${c.email   ? `<div class="detail-row"><span class="detail-row-icon">✉️</span><span class="detail-row-label">Email</span><span class="detail-row-val">${c.email}</span></div>` : ''}
          ${c.address ? `<div class="detail-row"><span class="detail-row-icon">📍</span><span class="detail-row-label">Adresse</span><span class="detail-row-val">${c.address}</span></div>` : ''}
          ${c.notes   ? `<div class="detail-row"><span class="detail-row-icon">📝</span><span class="detail-row-label">Notes</span><span class="detail-row-val">${c.notes}</span></div>` : ''}
          <div class="detail-row"><span class="detail-row-icon">📅</span><span class="detail-row-label">Client depuis</span><span class="detail-row-val">${new Date(c.created_at).toLocaleDateString('fr-FR')}</span></div>
        </div>

        <!-- Actions -->
        <div class="action-row">
          <button class="btn-action btn-action-primary" id="cd-edit">✏️ Modifier</button>
          <button class="btn-action btn-action-danger"  id="cd-delete">🗑️ Supprimer</button>
        </div>
        <button class="btn-cancel" style="width:100%;margin-top:10px;" id="cd-close">Fermer</button>
      </div>
    `;

    document.body.appendChild(backdrop);

    document.getElementById('cd-close').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });

    document.getElementById('cd-edit').addEventListener('click', () => {
      backdrop.remove();
      openClientForm(c);
    });

    document.getElementById('cd-delete').addEventListener('click', async () => {
      const ok = await window.customConfirm?.(`Supprimer le client "${c.name}" ?`);
      if (!ok) return;
      try {
        const res = await fetch_(`${API()}/clients/${c.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        window.showNotification?.('Client supprimé', 'success');
        backdrop.remove();
        loadClients();
      } catch {
        window.showNotification?.('Erreur lors de la suppression', 'error');
      }
    });
  }

  // ════════════════════════════════════════
  // INIT SECTION
  // ════════════════════════════════════════
  function initClientsSection() {
    const section = document.getElementById('clientsSection');
    if (!section || section._clientsInit) return;
    section._clientsInit = true;

    // Recherche
    const searchInput = document.getElementById('clientsSearch');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        searchTerm = searchInput.value.trim().toLowerCase();
        render();
      });
    }

    // Bouton ajouter
    const addBtn = document.getElementById('clientsAddBtn');
    if (addBtn) addBtn.addEventListener('click', () => openClientForm());

    loadClients();
  }

  // Exposer
  window.openClientForm   = openClientForm;
  window.loadClients      = loadClients;
  window.initClientsSection = initClientsSection;

  // Auto-init quand la section devient visible
  window.addEventListener('pageChange', e => {
    if (e.detail?.key === 'clients') initClientsSection();
  });

})();
