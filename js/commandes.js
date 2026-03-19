/**
 * commandes.js — Module Gestion des Commandes
 * Section : #commandesSection
 */

(function () {

  const API    = () => document.querySelector('meta[name="api-base"]')?.content
                 || 'https://samacommerce-backend-v2.onrender.com';
  const fetch_ = (url, opts = {}) => window.authfetch(url, opts);

  let commandes    = [];
  let fournisseurs = [];
  let filterStatus = 'tous';

  const STATUS_LABELS = {
    tous:       { label: 'Toutes',    icon: '📋' },
    en_attente: { label: 'En attente', icon: '⏳' },
    confirmee:  { label: 'Confirmées', icon: '✅' },
    recue:      { label: 'Reçues',     icon: '📥' },
    annulee:    { label: 'Annulées',   icon: '❌' },
  };

  // ════════════════════════════════════════
  // CHARGEMENT
  // ════════════════════════════════════════
  async function loadCommandes() {
    try {
      const [resCmd, resFou] = await Promise.all([
        fetch_(`${API()}/commandes`),
        fetch_(`${API()}/fournisseurs`),
      ]);
      if (resCmd.ok) commandes    = await resCmd.json();
      if (resFou.ok) fournisseurs = await resFou.json();
      render();
    } catch {
      window.showNotification?.('Erreur chargement commandes', 'error');
    }
  }

  // ════════════════════════════════════════
  // RENDU
  // ════════════════════════════════════════
  function render() {
    const container = document.getElementById('commandesList');
    const statsEl   = document.getElementById('commandesStats');
    if (!container) return;

    // Stats
    const totalVal    = commandes.reduce((s, c) => s + Number(c.total || 0), 0);
    const enAttente   = commandes.filter(c => c.status === 'en_attente').length;
    const recues      = commandes.filter(c => c.status === 'recue').length;

    if (statsEl) {
      statsEl.innerHTML = `
        <div class="module-stat-tile">
          <div class="msv" style="color:var(--primary);">${commandes.length}</div>
          <div class="msl">📋 Total</div>
        </div>
        <div class="module-stat-tile">
          <div class="msv" style="color:var(--orange);">${enAttente}</div>
          <div class="msl">⏳ En attente</div>
        </div>
        <div class="module-stat-tile">
          <div class="msv" style="color:var(--green);">${recues}</div>
          <div class="msl">📥 Reçues</div>
        </div>
        <div class="module-stat-tile">
          <div class="msv" style="color:var(--blue);">${totalVal.toLocaleString('fr-FR')} F</div>
          <div class="msl">💸 Total</div>
        </div>
      `;
    }

    // Filtrer par statut
    const filtered = filterStatus === 'tous'
      ? commandes
      : commandes.filter(c => c.status === filterStatus);

    if (!filtered.length) {
      container.innerHTML = `
        <div class="module-empty">
          <div class="module-empty-icon">📦</div>
          <div class="module-empty-text">${filterStatus !== 'tous' ? 'Aucune commande dans ce statut' : 'Aucune commande encore'}</div>
          ${filterStatus === 'tous' ? '<button class="btn-primary" onclick="window.openCommandeForm()">Créer une commande</button>' : ''}
        </div>`;
      return;
    }

    container.innerHTML = '';
    filtered.forEach(c => {
      const card = document.createElement('div');
      card.className = `commande-card status-${c.status}`;
      const dateStr = new Date(c.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
      const expected = c.expected_date ? new Date(c.expected_date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' }) : null;

      card.innerHTML = `
        <div class="commande-header">
          <div>
            <div class="commande-fournisseur">${c.fournisseur_name || '— Sans fournisseur'}</div>
            <div class="commande-date">📅 ${dateStr}${expected ? ` · Attendue le ${expected}` : ''}</div>
          </div>
          <span class="status-badge badge-${c.status}">${STATUS_LABELS[c.status]?.icon || ''} ${STATUS_LABELS[c.status]?.label || c.status}</span>
        </div>
        ${c.notes ? `<div style="font-size:12px;color:var(--muted);margin-bottom:6px;">📝 ${c.notes}</div>` : ''}
        <div class="commande-footer">
          <div class="commande-items-count">📦 ${c.nb_items || 0} article${c.nb_items > 1 ? 's' : ''}</div>
          <div class="commande-total">${Number(c.total || 0).toLocaleString('fr-FR')} F</div>
        </div>
      `;
      card.addEventListener('click', () => openCommandeDetail(c.id));
      container.appendChild(card);
    });
  }

  // ════════════════════════════════════════
  // FORMULAIRE NOUVELLE COMMANDE
  // ════════════════════════════════════════
  function openCommandeForm(preselectedFournisseur = null) {
    const products = window.appData?.produits || [];
    const backdrop = document.createElement('div');
    backdrop.className = 'module-sheet-backdrop';

    backdrop.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">📦 Nouvelle commande</div>

        <div class="form-group">
          <label>Fournisseur</label>
          <select id="cmd-fournisseur">
            <option value="">— Sans fournisseur —</option>
            ${fournisseurs.map(f => `<option value="${f.id}" ${preselectedFournisseur?.id === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label>Date de livraison prévue</label>
          <input id="cmd-date" type="date">
        </div>

        <div class="form-group">
          <label>Produits à commander</label>
          <div class="product-picker" id="cmd-products">
            ${products.map(p => `
              <button type="button" class="product-pick-btn" data-id="${p.id}" data-price="${p.priceAchat || p.price_achat || 0}">
                <div class="ppn">${p.name}</div>
                <div class="ppp">${(p.priceAchat || p.price_achat || 0).toLocaleString('fr-FR')} F</div>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Items sélectionnés -->
        <div id="cmd-selected-items" style="margin-bottom:14px;"></div>

        <div class="form-group">
          <label>Notes</label>
          <textarea id="cmd-notes" style="height:60px;resize:none;" placeholder="Notes optionnelles"></textarea>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" id="cmd-cancel">Annuler</button>
          <button class="btn-confirm" id="cmd-save">Créer la commande</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    // État des items
    const selectedItems = {};

    // Clic sur un produit
    backdrop.querySelectorAll('.product-pick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id    = btn.dataset.id;
        const price = Number(btn.dataset.price);
        if (selectedItems[id]) {
          delete selectedItems[id];
          btn.classList.remove('selected');
        } else {
          selectedItems[id] = { product_id: id, quantity: 1, prix_unitaire: price };
          btn.classList.add('selected');
        }
        renderSelectedItems();
      });
    });

    function renderSelectedItems() {
      const el = document.getElementById('cmd-selected-items');
      if (!el) return;
      const entries = Object.entries(selectedItems);
      if (!entries.length) { el.innerHTML = ''; return; }

      el.innerHTML = `<div class="commande-items-list">${entries.map(([id, it]) => {
        const p = products.find(p => String(p.id) === String(id));
        return `
          <div class="commande-item-row">
            <div class="commande-item-name">${p?.name || '—'}</div>
            <input type="number" min="1" value="${it.quantity}"
                   style="width:56px;padding:5px 8px;border:1.5px solid #E5E7EB;border-radius:8px;font-size:13px;text-align:center;"
                   onchange="window._cmdUpdateQty('${id}', this.value)">
            <div class="commande-item-prix">${(it.quantity * it.prix_unitaire).toLocaleString('fr-FR')} F</div>
          </div>`;
      }).join('')}</div>`;

      // Total
      const total = entries.reduce((s, [, it]) => s + it.quantity * it.prix_unitaire, 0);
      el.innerHTML += `<div style="text-align:right;font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:var(--primary);margin-top:8px;">Total : ${total.toLocaleString('fr-FR')} F</div>`;
    }

    window._cmdUpdateQty = (id, val) => {
      if (selectedItems[id]) {
        selectedItems[id].quantity = Math.max(1, parseInt(val) || 1);
        renderSelectedItems();
      }
    };

    document.getElementById('cmd-cancel').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });

    document.getElementById('cmd-save').addEventListener('click', async () => {
      const items = Object.values(selectedItems);
      if (!items.length) {
        window.showNotification?.('Sélectionnez au moins un produit', 'warning');
        return;
      }
      const body = {
        fournisseur_id: document.getElementById('cmd-fournisseur').value || null,
        expected_date:  document.getElementById('cmd-date').value || null,
        notes:          document.getElementById('cmd-notes').value.trim() || null,
        items,
      };
      try {
        const res = await fetch_(`${API()}/commandes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        window.showNotification?.('✅ Commande créée', 'success');
        backdrop.remove();
        loadCommandes();
      } catch {
        window.showNotification?.('Erreur création commande', 'error');
      }
    });
  }

  // ════════════════════════════════════════
  // DÉTAIL COMMANDE
  // ════════════════════════════════════════
  async function openCommandeDetail(id) {
    try {
      const res = await fetch_(`${API()}/commandes/${id}`);
      if (!res.ok) throw new Error();
      const cmd = await res.json();

      const backdrop = document.createElement('div');
      backdrop.className = 'module-sheet-backdrop';
      const dateStr = new Date(cmd.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });

      backdrop.innerHTML = `
        <div class="module-sheet">
          <div class="module-sheet-pill"></div>
          <div class="module-sheet-title">📦 Commande #${cmd.id}</div>

          <div class="detail-panel">
            <div class="detail-row"><span class="detail-row-icon">🏭</span><span class="detail-row-label">Fournisseur</span><span class="detail-row-val">${cmd.fournisseur_name || '—'}</span></div>
            <div class="detail-row"><span class="detail-row-icon">📅</span><span class="detail-row-label">Date</span><span class="detail-row-val">${dateStr}</span></div>
            ${cmd.expected_date ? `<div class="detail-row"><span class="detail-row-icon">🎯</span><span class="detail-row-label">Prévue</span><span class="detail-row-val">${new Date(cmd.expected_date).toLocaleDateString('fr-FR')}</span></div>` : ''}
            <div class="detail-row"><span class="detail-row-icon">📊</span><span class="detail-row-label">Statut</span><span class="detail-row-val"><span class="status-badge badge-${cmd.status}">${STATUS_LABELS[cmd.status]?.icon} ${STATUS_LABELS[cmd.status]?.label || cmd.status}</span></span></div>
            ${cmd.notes ? `<div class="detail-row"><span class="detail-row-icon">📝</span><span class="detail-row-label">Notes</span><span class="detail-row-val">${cmd.notes}</span></div>` : ''}
          </div>

          <!-- Articles -->
          <div class="card-title" style="margin-top:14px;">🛒 Articles commandés</div>
          <div class="commande-items-list">
            ${(cmd.items || []).map(it => `
              <div class="commande-item-row">
                <div class="commande-item-name">${it.product_name || '—'}</div>
                <div class="commande-item-qty">× ${it.quantity}</div>
                <div class="commande-item-prix">${(it.quantity * it.prix_unitaire).toLocaleString('fr-FR')} F</div>
              </div>
            `).join('')}
          </div>
          <div style="text-align:right;font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:var(--primary);margin:10px 0;">
            Total : ${Number(cmd.total || 0).toLocaleString('fr-FR')} F
          </div>

          <!-- Actions selon statut -->
          <div class="action-row" id="cmd-detail-actions"></div>
          <button class="btn-cancel" style="width:100%;margin-top:10px;" id="cmd-detail-close">Fermer</button>
        </div>
      `;

      document.body.appendChild(backdrop);
      document.getElementById('cmd-detail-close').addEventListener('click', () => backdrop.remove());
      backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });

      // Actions dynamiques selon statut
      const actionsEl = document.getElementById('cmd-detail-actions');
      if (cmd.status === 'en_attente') {
        actionsEl.innerHTML = `
          <button class="btn-action btn-action-blue"  id="cd-confirm">✅ Confirmer</button>
          <button class="btn-action btn-action-danger" id="cd-annuler">❌ Annuler</button>
        `;
        document.getElementById('cd-confirm').addEventListener('click', () => changeStatus(id, 'confirmee', backdrop));
        document.getElementById('cd-annuler').addEventListener('click', () => changeStatus(id, 'annulee', backdrop));
      } else if (cmd.status === 'confirmee') {
        actionsEl.innerHTML = `
          <button class="btn-action btn-action-green" id="cd-receive">📥 Marquer reçue</button>
          <button class="btn-action btn-action-danger" id="cd-annuler2">❌ Annuler</button>
        `;
        document.getElementById('cd-receive').addEventListener('click', () => recevoir(id, backdrop));
        document.getElementById('cd-annuler2').addEventListener('click', () => changeStatus(id, 'annulee', backdrop));
      }

    } catch {
      window.showNotification?.('Erreur chargement commande', 'error');
    }
  }

  async function changeStatus(id, status, backdrop) {
    try {
      const res = await fetch_(`${API()}/commandes/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      window.showNotification?.(`✅ Commande ${STATUS_LABELS[status]?.label || status}`, 'success');
      backdrop.remove();
      loadCommandes();
    } catch {
      window.showNotification?.('Erreur mise à jour', 'error');
    }
  }

  async function recevoir(id, backdrop) {
    const ok = await window.customConfirm?.('Marquer comme reçue ? Le stock sera mis à jour automatiquement.');
    if (!ok) return;
    try {
      const res = await fetch_(`${API()}/commandes/${id}/recevoir`, { method: 'PATCH' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      window.showNotification?.(`📥 ${data.message}`, 'success');
      // Resync appData pour refléter le nouveau stock
      await window.syncFromServer?.();
      backdrop.remove();
      loadCommandes();
    } catch {
      window.showNotification?.('Erreur réception', 'error');
    }
  }

  // ════════════════════════════════════════
  // CHIPS FILTRE STATUT
  // ════════════════════════════════════════
  function renderStatusChips() {
    const el = document.getElementById('commandesStatusChips');
    if (!el) return;
    el.innerHTML = Object.entries(STATUS_LABELS).map(([key, v]) => `
      <button class="period-chip ${filterStatus === key ? 'active' : ''}"
              data-status="${key}">
        ${v.icon} ${v.label}
      </button>
    `).join('');
    el.querySelectorAll('.period-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        filterStatus = btn.dataset.status;
        renderStatusChips();
        render();
      });
    });
  }

  // ════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════
  function initCommandesSection() {
    const section = document.getElementById('commandesSection');
    if (!section || section._cmdInit) return;
    section._cmdInit = true;

    renderStatusChips();
    document.getElementById('commandesAddBtn')
      ?.addEventListener('click', () => openCommandeForm());

    loadCommandes();
  }

  window.openCommandeForm      = openCommandeForm;
  window.loadCommandes         = loadCommandes;
  window.initCommandesSection  = initCommandesSection;

  window.addEventListener('pageChange', e => {
    if (e.detail?.key === 'commandes') initCommandesSection();
  });

})();
