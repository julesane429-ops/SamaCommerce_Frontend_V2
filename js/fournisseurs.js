/**
 * fournisseurs.js — Module Gestion des Fournisseurs
 * Section : #fournisseursSection
 */

(function () {

  const API  = () => document.querySelector('meta[name="api-base"]')?.content
               || 'https://samacommerce-backend-v2.onrender.com';
  const fetch_ = (url, opts = {}) => window.authfetch(url, opts);

  let fournisseurs = [];
  let searchTerm   = '';

  // ════════════════════════════════════════
  // CHARGEMENT
  // ════════════════════════════════════════
  async function loadFournisseurs() {
    try {
      const res = await fetch_(`${API()}/fournisseurs`);
      if (!res.ok) throw new Error();
      fournisseurs = await res.json();
      render();
    } catch {
      window.showNotification?.('Erreur chargement fournisseurs', 'error');
    }
  }

  // ════════════════════════════════════════
  // RENDU LISTE
  // ════════════════════════════════════════
  function render() {
    const container = document.getElementById('fournisseursList');
    const statsEl   = document.getElementById('fournisseursStats');
    if (!container) return;

    const totalCommandes = fournisseurs.reduce((s, f) => s + Number(f.nb_commandes || 0), 0);
    const totalDépensé   = fournisseurs.reduce((s, f) => s + Number(f.total_commandes || 0), 0);

    if (statsEl) {
      statsEl.innerHTML = `
        <div class="module-stat-tile">
          <div class="msv" style="color:var(--blue);">${fournisseurs.length}</div>
          <div class="msl">🏭 Fournisseurs</div>
        </div>
        <div class="module-stat-tile">
          <div class="msv" style="color:var(--orange);">${totalDépensé.toLocaleString('fr-FR')} F</div>
          <div class="msl">💸 Total dépensé</div>
        </div>
        <div class="module-stat-tile">
          <div class="msv" style="color:var(--primary);">${totalCommandes}</div>
          <div class="msl">📦 Commandes</div>
        </div>
        <div class="module-stat-tile">
          <div class="msv" style="color:var(--teal);">${fournisseurs.length ? Math.round(totalDépensé / fournisseurs.length).toLocaleString('fr-FR') : 0} F</div>
          <div class="msl">📊 Moy. commande</div>
        </div>
      `;
    }

    const filtered = fournisseurs.filter(f =>
      (f.name || '').toLowerCase().includes(searchTerm) ||
      (f.phone || '').includes(searchTerm)
    );

    if (!filtered.length) {
      container.innerHTML = `
        <div class="module-empty">
          <div class="module-empty-icon">🏭</div>
          <div class="module-empty-text">${searchTerm ? 'Aucun fournisseur trouvé' : 'Aucun fournisseur encore'}</div>
          ${!searchTerm ? '<button class="btn-primary" onclick="window.openFournisseurForm()">Ajouter un fournisseur</button>' : ''}
        </div>`;
      return;
    }

    container.innerHTML = '';
    filtered.forEach(f => {
      const initials = (f.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const card = document.createElement('div');
      card.className = 'entity-card';
      card.innerHTML = `
        <div class="entity-avatar avatar-fournisseur">${initials}</div>
        <div class="entity-info">
          <div class="entity-name">${f.name}</div>
          <div class="entity-sub">${f.phone || f.email || 'Aucun contact'}</div>
        </div>
        <div class="entity-meta">
          <div class="entity-amount">${Number(f.total_commandes || 0).toLocaleString('fr-FR')} F</div>
          <div class="entity-count">${f.nb_commandes || 0} commande${f.nb_commandes > 1 ? 's' : ''}</div>
        </div>
      `;
      card.addEventListener('click', () => openFournisseurDetail(f));
      container.appendChild(card);
    });
  }

  // ════════════════════════════════════════
  // FORMULAIRE AJOUT / ÉDITION
  // ════════════════════════════════════════
  function openFournisseurForm(existing = null) {
    const backdrop = document.createElement('div');
    backdrop.className = 'module-sheet-backdrop';

    backdrop.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">${existing ? '✏️ Modifier fournisseur' : '🏭 Nouveau fournisseur'}</div>

        <div class="form-group"><label>Nom *</label>
          <input id="ff-name" type="text" value="${existing?.name || ''}" placeholder="Nom du fournisseur"></div>
        <div class="form-group"><label>Téléphone</label>
          <input id="ff-phone" type="tel" value="${existing?.phone || ''}" placeholder="+221 XX XXX XX XX"></div>
        <div class="form-group"><label>Email</label>
          <input id="ff-email" type="email" value="${existing?.email || ''}" placeholder="email@exemple.com"></div>
        <div class="form-group"><label>Adresse</label>
          <input id="ff-address" type="text" value="${existing?.address || ''}" placeholder="Adresse / Ville"></div>
        <div class="form-group"><label>Notes</label>
          <textarea id="ff-notes" style="height:72px;resize:none;">${existing?.notes || ''}</textarea></div>

        <div class="modal-actions">
          <button class="btn-cancel" id="ff-cancel">Annuler</button>
          <button class="btn-confirm" id="ff-save">${existing ? 'Mettre à jour' : 'Ajouter'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.getElementById('ff-cancel').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });

    document.getElementById('ff-save').addEventListener('click', async () => {
      const name = document.getElementById('ff-name').value.trim();
      if (!name) { window.showNotification?.('Le nom est requis', 'warning'); return; }

      const body = {
        name,
        phone:   document.getElementById('ff-phone').value.trim()   || null,
        email:   document.getElementById('ff-email').value.trim()   || null,
        address: document.getElementById('ff-address').value.trim() || null,
        notes:   document.getElementById('ff-notes').value.trim()   || null,
      };

      try {
        const url    = existing ? `${API()}/fournisseurs/${existing.id}` : `${API()}/fournisseurs`;
        const method = existing ? 'PATCH' : 'POST';
        const res    = await fetch_(url, {
          method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        window.showNotification?.(existing ? '✅ Fournisseur mis à jour' : '✅ Fournisseur ajouté', 'success');
        backdrop.remove();
        loadFournisseurs();
      } catch {
        window.showNotification?.('Erreur lors de la sauvegarde', 'error');
      }
    });
  }

  // ════════════════════════════════════════
  // FICHE DÉTAIL
  // ════════════════════════════════════════
  function openFournisseurDetail(f) {
    const backdrop = document.createElement('div');
    backdrop.className = 'module-sheet-backdrop';

    backdrop.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>

        <div style="text-align:center;margin-bottom:18px;">
          <div class="entity-avatar avatar-fournisseur" style="width:64px;height:64px;font-size:28px;margin:0 auto 10px;">
            ${(f.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}
          </div>
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;">${f.name}</div>
        </div>

        <div class="module-stats">
          <div class="module-stat-tile">
            <div class="msv" style="color:var(--blue);">${Number(f.total_commandes||0).toLocaleString('fr-FR')} F</div>
            <div class="msl">💸 Total acheté</div>
          </div>
          <div class="module-stat-tile">
            <div class="msv" style="color:var(--primary);">${f.nb_commandes || 0}</div>
            <div class="msl">📦 Commandes</div>
          </div>
        </div>

        <div class="detail-panel">
          ${f.phone   ? `<div class="detail-row"><span class="detail-row-icon">📞</span><span class="detail-row-label">Téléphone</span><span class="detail-row-val">${f.phone}</span></div>` : ''}
          ${f.email   ? `<div class="detail-row"><span class="detail-row-icon">✉️</span><span class="detail-row-label">Email</span><span class="detail-row-val">${f.email}</span></div>` : ''}
          ${f.address ? `<div class="detail-row"><span class="detail-row-icon">📍</span><span class="detail-row-label">Adresse</span><span class="detail-row-val">${f.address}</span></div>` : ''}
          ${f.notes   ? `<div class="detail-row"><span class="detail-row-icon">📝</span><span class="detail-row-label">Notes</span><span class="detail-row-val">${f.notes}</span></div>` : ''}
        </div>

        <div class="action-row">
          <button class="btn-action btn-action-blue"    id="fd-commande">📦 Commander</button>
          <button class="btn-action btn-action-primary" id="fd-edit">✏️ Modifier</button>
          <button class="btn-action btn-action-danger"  id="fd-delete">🗑️</button>
        </div>
        <button class="btn-cancel" style="width:100%;margin-top:10px;" id="fd-close">Fermer</button>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.getElementById('fd-close').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });

    document.getElementById('fd-edit').addEventListener('click', () => {
      backdrop.remove();
      openFournisseurForm(f);
    });

    document.getElementById('fd-commande').addEventListener('click', () => {
      backdrop.remove();
      // Naviguer vers Commandes avec fournisseur pré-sélectionné
      window.navTo?.('commandes');
      setTimeout(() => window.openCommandeForm?.(f), 300);
    });

    document.getElementById('fd-delete').addEventListener('click', async () => {
      const ok = await window.customConfirm?.(`Supprimer "${f.name}" ?`);
      if (!ok) return;
      try {
        const res = await fetch_(`${API()}/fournisseurs/${f.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        window.showNotification?.('Fournisseur supprimé', 'success');
        backdrop.remove();
        loadFournisseurs();
      } catch {
        window.showNotification?.('Erreur suppression', 'error');
      }
    });
  }

  // ════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════
  function initFournisseursSection() {
    const section = document.getElementById('fournisseursSection');
    if (!section || section._fInit) return;
    section._fInit = true;

    const searchInput = document.getElementById('fournisseursSearch');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        searchTerm = searchInput.value.trim().toLowerCase();
        render();
      });
    }
    document.getElementById('fournisseursAddBtn')
      ?.addEventListener('click', () => openFournisseurForm());

    loadFournisseurs();
  }

  // Exposer
  window.openFournisseurForm      = openFournisseurForm;
  window.loadFournisseurs         = loadFournisseurs;
  window.initFournisseursSection  = initFournisseursSection;

  window.addEventListener('pageChange', e => {
    if (e.detail?.key === 'fournisseurs') initFournisseursSection();
  });

})();
