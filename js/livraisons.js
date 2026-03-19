/**
 * livraisons.js — Module Gestion des Livraisons
 * Section : #livraisonsSection
 */

(function () {

  const API    = () => document.querySelector('meta[name="api-base"]')?.content
                 || 'https://samacommerce-backend-v2.onrender.com';
  const fetch_ = (url, opts = {}) => window.authfetch(url, opts);

  let livraisons   = [];
  let filterStatus = 'tous';

  const STATUS_CONFIG = {
    tous:       { label: 'Toutes',      icon: '🚚', color: 'var(--primary)' },
    en_attente: { label: 'En attente',  icon: '⏳', color: 'var(--orange)'  },
    en_transit: { label: 'En transit',  icon: '🚛', color: 'var(--blue)'    },
    livree:     { label: 'Livrées',     icon: '✅', color: 'var(--green)'   },
    probleme:   { label: 'Problème',    icon: '⚠️', color: 'var(--red)'     },
  };

  const LIV_ICONS = {
    en_attente: '⏳',
    en_transit: '🚛',
    livree:     '📦',
    probleme:   '⚠️',
  };

  // ════════════════════════════════════════
  // CHARGEMENT
  // ════════════════════════════════════════
  async function loadLivraisons() {
    try {
      const res = await fetch_(`${API()}/livraisons`);
      if (!res.ok) throw new Error();
      livraisons = await res.json();
      render();
    } catch {
      window.showNotification?.('Erreur chargement livraisons', 'error');
    }
  }

  // ════════════════════════════════════════
  // RENDU
  // ════════════════════════════════════════
  function render() {
    const container = document.getElementById('livraisonsList');
    const statsEl   = document.getElementById('livraisonsStats');
    if (!container) return;

    // Stats
    const enAttente = livraisons.filter(l => l.status === 'en_attente').length;
    const enTransit = livraisons.filter(l => l.status === 'en_transit').length;
    const livrees   = livraisons.filter(l => l.status === 'livree').length;
    const problemes = livraisons.filter(l => l.status === 'probleme').length;

    if (statsEl) {
      statsEl.innerHTML = `
        <div class="module-stat-tile">
          <div class="msv" style="color:var(--orange);">${enAttente}</div>
          <div class="msl">⏳ En attente</div>
        </div>
        <div class="module-stat-tile">
          <div class="msv" style="color:var(--blue);">${enTransit}</div>
          <div class="msl">🚛 En transit</div>
        </div>
        <div class="module-stat-tile">
          <div class="msv" style="color:var(--green);">${livrees}</div>
          <div class="msl">✅ Livrées</div>
        </div>
        <div class="module-stat-tile">
          <div class="msv" style="color:var(--red);">${problemes}</div>
          <div class="msl">⚠️ Problèmes</div>
        </div>
      `;
    }

    // Filtrer
    const filtered = filterStatus === 'tous'
      ? livraisons
      : livraisons.filter(l => l.status === filterStatus);

    if (!filtered.length) {
      container.innerHTML = `
        <div class="module-empty">
          <div class="module-empty-icon">🚚</div>
          <div class="module-empty-text">${filterStatus !== 'tous' ? 'Aucune livraison dans ce statut' : 'Aucune livraison encore'}</div>
          ${filterStatus === 'tous' ? '<button class="btn-primary" onclick="window.openLivraisonForm()">Créer une livraison</button>' : ''}
        </div>`;
      return;
    }

    container.innerHTML = '';
    filtered.forEach(l => {
      const card = document.createElement('div');
      card.className = `livraison-card liv-${l.status}`;
      const dateStr = new Date(l.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
      const deliveredStr = l.delivered_at
        ? new Date(l.delivered_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })
        : null;
      const expected = l.expected_date
        ? new Date(l.expected_date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' })
        : null;

      card.innerHTML = `
        <div class="livraison-header">
          <div class="livraison-icon-wrap">${LIV_ICONS[l.status] || '📦'}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${l.fournisseur_name || 'Livraison #' + l.id}
            </div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">
              📅 Créée le ${dateStr}
              ${expected ? ` · Prévue le ${expected}` : ''}
              ${deliveredStr ? ` · Livrée le ${deliveredStr}` : ''}
            </div>
            ${l.tracking_note ? `<div style="font-size:12px;color:var(--muted);margin-top:3px;">📝 ${l.tracking_note}</div>` : ''}
          </div>
          <span class="status-badge badge-${l.status}">${STATUS_CONFIG[l.status]?.icon} ${STATUS_CONFIG[l.status]?.label}</span>
        </div>
        ${l.commande_total
          ? `<div style="text-align:right;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;color:var(--primary);">
               ${Number(l.commande_total).toLocaleString('fr-FR')} F
             </div>`
          : ''}
      `;
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => openLivraisonDetail(l.id));
      container.appendChild(card);
    });
  }

  // ════════════════════════════════════════
  // FORMULAIRE NOUVELLE LIVRAISON
  // ════════════════════════════════════════
  async function openLivraisonForm(preselectedCommande = null) {
    // Charger les commandes confirmées
    let cmdOptions = [];
    try {
      const res = await fetch_(`${API()}/commandes`);
      if (res.ok) {
        const all = await res.json();
        cmdOptions = all.filter(c => c.status === 'confirmee' || c.status === 'en_attente');
      }
    } catch {}

    const backdrop = document.createElement('div');
    backdrop.className = 'module-sheet-backdrop';

    backdrop.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">🚚 Nouvelle livraison</div>

        <div class="form-group">
          <label>Commande liée (optionnel)</label>
          <select id="lf-commande">
            <option value="">— Livraison sans commande —</option>
            ${cmdOptions.map(c => `
              <option value="${c.id}" ${preselectedCommande?.id === c.id ? 'selected' : ''}>
                #${c.id} — ${c.fournisseur_name || 'Sans fournisseur'} — ${Number(c.total||0).toLocaleString('fr-FR')} F
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label>Note de suivi / Transporteur</label>
          <textarea id="lf-note" style="height:72px;resize:none;" placeholder="Ex: DHL — Numéro de suivi : 1234..."></textarea>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" id="lf-cancel">Annuler</button>
          <button class="btn-confirm" id="lf-save">Créer la livraison</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.getElementById('lf-cancel').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });

    document.getElementById('lf-save').addEventListener('click', async () => {
      const body = {
        commande_id:    document.getElementById('lf-commande').value || null,
        tracking_note:  document.getElementById('lf-note').value.trim() || null,
      };
      try {
        const res = await fetch_(`${API()}/livraisons`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        window.showNotification?.('✅ Livraison créée', 'success');
        backdrop.remove();
        loadLivraisons();
      } catch {
        window.showNotification?.('Erreur création livraison', 'error');
      }
    });
  }

  // ════════════════════════════════════════
  // DÉTAIL LIVRAISON
  // ════════════════════════════════════════
  async function openLivraisonDetail(id) {
    try {
      const res = await fetch_(`${API()}/livraisons/${id}`);
      if (!res.ok) throw new Error();
      const liv = await res.json();

      const backdrop = document.createElement('div');
      backdrop.className = 'module-sheet-backdrop';
      const dateStr = new Date(liv.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });

      backdrop.innerHTML = `
        <div class="module-sheet">
          <div class="module-sheet-pill"></div>
          <div style="text-align:center;margin-bottom:16px;">
            <div style="font-size:40px;margin-bottom:6px;">${LIV_ICONS[liv.status] || '🚚'}</div>
            <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;">Livraison #${liv.id}</div>
            <span class="status-badge badge-${liv.status}" style="margin-top:6px;display:inline-flex;">
              ${STATUS_CONFIG[liv.status]?.icon} ${STATUS_CONFIG[liv.status]?.label}
            </span>
          </div>

          <div class="detail-panel">
            <div class="detail-row"><span class="detail-row-icon">📅</span><span class="detail-row-label">Créée le</span><span class="detail-row-val">${dateStr}</span></div>
            ${liv.fournisseur_name ? `<div class="detail-row"><span class="detail-row-icon">🏭</span><span class="detail-row-label">Fournisseur</span><span class="detail-row-val">${liv.fournisseur_name}</span></div>` : ''}
            ${liv.commande_total   ? `<div class="detail-row"><span class="detail-row-icon">💰</span><span class="detail-row-label">Montant</span><span class="detail-row-val">${Number(liv.commande_total).toLocaleString('fr-FR')} F</span></div>` : ''}
            ${liv.tracking_note   ? `<div class="detail-row"><span class="detail-row-icon">📝</span><span class="detail-row-label">Suivi</span><span class="detail-row-val">${liv.tracking_note}</span></div>` : ''}
            ${liv.delivered_at    ? `<div class="detail-row"><span class="detail-row-icon">✅</span><span class="detail-row-label">Livrée le</span><span class="detail-row-val">${new Date(liv.delivered_at).toLocaleDateString('fr-FR')}</span></div>` : ''}
          </div>

          ${(liv.items || []).length ? `
            <div class="card-title" style="margin-top:14px;">📦 Articles</div>
            <div class="commande-items-list">
              ${liv.items.map(it => `
                <div class="commande-item-row">
                  <div class="commande-item-name">${it.product_name || '—'}</div>
                  <div class="commande-item-qty">× ${it.quantity}</div>
                  <div class="commande-item-prix">${(it.quantity * it.prix_unitaire).toLocaleString('fr-FR')} F</div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- Mise à jour statut -->
          <div class="form-group" style="margin-top:14px;" id="status-update-group">
            <label>Mettre à jour le statut</label>
            <div class="action-row" style="flex-wrap:wrap;">
              ${Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'tous' && k !== liv.status).map(([k, v]) => `
                <button class="btn-action btn-action-blue status-update-btn" data-status="${k}" style="min-width:100px;">
                  ${v.icon} ${v.label}
                </button>
              `).join('')}
            </div>
          </div>

          <button class="btn-cancel" style="width:100%;margin-top:10px;" id="ld-close">Fermer</button>
        </div>
      `;

      document.body.appendChild(backdrop);
      document.getElementById('ld-close').addEventListener('click', () => backdrop.remove());
      backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });

      // Boutons changement de statut
      backdrop.querySelectorAll('.status-update-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const newStatus = btn.dataset.status;
          try {
            const body = { status: newStatus };
            const res = await fetch_(`${API()}/livraisons/${id}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error();
            window.showNotification?.(`✅ Livraison : ${STATUS_CONFIG[newStatus]?.label}`, 'success');
            backdrop.remove();
            loadLivraisons();
          } catch {
            window.showNotification?.('Erreur mise à jour', 'error');
          }
        });
      });

    } catch {
      window.showNotification?.('Erreur chargement livraison', 'error');
    }
  }

  // ════════════════════════════════════════
  // CHIPS FILTRE
  // ════════════════════════════════════════
  function renderStatusChips() {
    const el = document.getElementById('livraisonsStatusChips');
    if (!el) return;
    el.innerHTML = Object.entries(STATUS_CONFIG).map(([key, v]) => `
      <button class="period-chip ${filterStatus === key ? 'active' : ''}" data-status="${key}">
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
  function initLivraisonsSection() {
    const section = document.getElementById('livraisonsSection');
    if (!section || section._livInit) return;
    section._livInit = true;

    renderStatusChips();
    document.getElementById('livraisonsAddBtn')
      ?.addEventListener('click', () => openLivraisonForm());

    loadLivraisons();
  }

  window.openLivraisonForm      = openLivraisonForm;
  window.loadLivraisons         = loadLivraisons;
  window.initLivraisonsSection  = initLivraisonsSection;

  window.addEventListener('pageChange', e => {
    if (e.detail?.key === 'livraisons') initLivraisonsSection();
  });

})();
