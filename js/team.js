/**
 * team.js — Gestion multi-appareil / équipe boutique
 *
 * Corrections :
 *   ✅ L'invitation passe maintenant boutique_id (boutique active)
 *      → chaque employé est assigné à une boutique précise
 *   ✅ La limite de membres n'est plus codée en dur à 3
 *      → Enterprise = illimité, autres plans = limite du plan
 *   ✅ La bannière employé affiche le nom de la boutique spécifique
 *      (pas seulement le nom de la société du propriétaire)
 *   ✅ loadMembers passe boutique_id pour ne charger que les membres
 *      de la boutique active en mode multi-boutique
 */
(function () {

  const API    = () => document.querySelector('meta[name="api-base"]')?.content
                    || 'https://samacommerce-backend-v2.onrender.com';
  const auth   = (url, o = {}) => window.authfetch(url, o);
  const notify = (m, t)         => window.showNotification?.(m, t);
  const ok_    = r => { if (!r.ok) throw new Error(r.status); return r.json(); };

  // ── Permissions affichées dans les modals ──────────────────────
  const PERMISSIONS = [
    { key:'vente',        label:'💳 Vendre',        desc:'Effectuer des ventes' },
    { key:'stock',        label:'📦 Stock',          desc:'Gérer les produits' },
    { key:'categories',   label:'🏷️ Catégories',    desc:'Gérer les catégories' },
    { key:'rapports',     label:'📈 Rapports',       desc:'Voir les statistiques' },
    { key:'caisse',       label:'🏦 Caisse',         desc:'Accéder à la clôture de caisse' },
    { key:'credits',      label:'📝 Crédits',        desc:'Gérer les crédits clients' },
    { key:'clients',      label:'👥 Clients',        desc:'Accéder à la liste clients' },
    { key:'fournisseurs', label:'🏭 Fournisseurs',   desc:'Gérer les fournisseurs' },
    { key:'commandes',    label:'📦 Commandes',      desc:'Créer des commandes fournisseur' },
    { key:'livraisons',   label:'🚚 Livraisons',     desc:'Suivre les livraisons' },
  ];

  const SECTION_PERM_MAP = {
    stock:        'stock',
    categories:   'categories',
    rapports:     'rapports',
    caisse:       'caisse',
    credits:      'credits',
    clients:      'clients',
    fournisseurs: 'fournisseurs',
    commandes:    'commandes',
    livraisons:   'livraisons',
    inventaire:   'stock',
  };

  let members    = [];
  let _planInfo  = null; // cache plan courant

  // ── Récupérer le plan de l'utilisateur ────────────────────────
  async function getPlanInfo() {
    if (_planInfo) return _planInfo;
    try {
      const res = await auth(`${API()}/auth/me`);
      if (res?.ok) {
        const me = await res.json();
        _planInfo = { plan: me.plan, upgrade_status: me.upgrade_status };
      }
    } catch { _planInfo = { plan: 'Free' }; }
    return _planInfo || { plan: 'Free' };
  }

  // ── Limite de membres selon le plan ───────────────────────────
  function getMembersLimit(plan) {
    const LIMITS = { Free: 0, Starter: 0, Pro: 0, Business: 3, Enterprise: Infinity };
    return LIMITS[plan] ?? 0;
  }

  // ══════════════════════════════════════
  // TOGGLE — composant réutilisable
  // ══════════════════════════════════════
  function buildToggle(id, checked) {
    const label = document.createElement('label');
    label.style.cssText = 'position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;cursor:pointer;';
    const input = document.createElement('input');
    input.type      = 'checkbox';
    input.id        = id;
    input.checked   = checked;
    input.style.cssText = 'opacity:0;width:0;height:0;position:absolute;';
    const slider = document.createElement('span');
    slider.style.cssText = `
      position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;
      background:${checked ? '#7C3AED' : '#E5E7EB'};
      border-radius:24px;transition:.2s;
    `;
    slider.innerHTML = `<span style="position:absolute;height:18px;width:18px;left:${checked ? '23px' : '3px'};bottom:3px;background:#fff;border-radius:50%;transition:.2s;"></span>`;
    input.addEventListener('change', function () {
      slider.style.background = this.checked ? '#7C3AED' : '#E5E7EB';
      slider.querySelector('span').style.left = this.checked ? '23px' : '3px';
    });
    label.appendChild(input);
    label.appendChild(slider);
    return label;
  }

  function setAllToggles(container, state) {
    PERMISSIONS.forEach(p => {
      const input = container.querySelector(`#perm-${p.key}`);
      if (input) { input.checked = state; input.dispatchEvent(new Event('change')); }
    });
  }

  // ══════════════════════════════════════
  // CHARGER LES MEMBRES
  // ✅ Passe boutique_id si multi-boutique actif
  // ══════════════════════════════════════
  async function loadMembers() {
    try {
      const activeBoutiqueId = window.getActiveBoutiqueId?.() || null;
      const url = activeBoutiqueId
        ? `${API()}/members?boutique_id=${activeBoutiqueId}`
        : `${API()}/members`;

      members = await auth(url).then(ok_);
      renderTeamSection();
    } catch { notify('Erreur chargement équipe', 'error'); }
  }

  // ══════════════════════════════════════
  // RENDU SECTION ÉQUIPE
  // ══════════════════════════════════════
  async function renderTeamSection() {
    const container = document.getElementById('team-section');
    if (!container) return;

    const planInfo = await getPlanInfo();
    const limit    = getMembersLimit(planInfo.plan);
    const isActive = planInfo.upgrade_status === 'validé';
    const effectiveLimit = isActive ? limit : 0;

    const pending  = members.filter(m => m.status === 'pending').length;
    const accepted = members.filter(m => m.status === 'accepted').length;
    const total    = members.filter(m => m.status !== 'rejected').length;

    // Nom de la boutique active (multi-boutique)
    const activeBoutiqueId = window.getActiveBoutiqueId?.() || null;
    const boutiqueName     = activeBoutiqueId
      ? (window._boutiques?.find?.(b => b.id === activeBoutiqueId)?.name || '')
      : '';

    container.innerHTML = `
      <div style="font-family:'Sora',sans-serif;font-size:15px;font-weight:800;color:var(--text);
                  margin-bottom:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        👥 ${boutiqueName ? `Équipe — ${boutiqueName}` : 'Mon équipe'}
        ${accepted > 0 ? `<span style="background:#EDE9FE;color:#7C3AED;font-size:10px;padding:2px 8px;border-radius:6px;">${accepted} actif${accepted > 1 ? 's' : ''}</span>` : ''}
        ${pending  > 0 ? `<span style="background:#FEF3C7;color:#D97706;font-size:10px;padding:2px 8px;border-radius:6px;">${pending} en attente</span>` : ''}
        ${effectiveLimit === Infinity
          ? `<span style="background:#ECFDF5;color:#065F46;font-size:10px;padding:2px 8px;border-radius:6px;">Illimité</span>`
          : effectiveLimit > 0
            ? `<span style="background:#F3F4F6;color:#6B7280;font-size:10px;padding:2px 8px;border-radius:6px;">${total}/${effectiveLimit}</span>`
            : ''}
      </div>
    `;

    if (members.length === 0) {
      container.innerHTML += `
        <div style="text-align:center;padding:20px 0;color:var(--muted);">
          <div style="font-size:40px;margin-bottom:8px;">👤</div>
          <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Vous gérez seul cette boutique</div>
          <div style="font-size:12px;">Invitez des employés pour travailler ensemble</div>
        </div>
      `;
    } else {
      const list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:14px;';
      members.forEach(m => list.appendChild(buildMemberCard(m)));
      container.appendChild(list);
    }

    // ✅ Bouton d'invitation : visible si limite pas atteinte ou illimité
    const canInvite = effectiveLimit === Infinity || total < effectiveLimit;

    if (canInvite && effectiveLimit > 0) {
      const btn = document.createElement('button');
      btn.style.cssText = `width:100%;padding:12px;background:linear-gradient(135deg,#7C3AED,#EC4899);
        color:#fff;border:none;border-radius:14px;font-family:'Sora',sans-serif;font-size:13px;
        font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(124,58,237,.25);
        display:flex;align-items:center;justify-content:center;gap:8px;`;
      btn.textContent = '➕ Inviter un employé';
      btn.addEventListener('click', openInviteModal);
      container.appendChild(btn);
    } else if (effectiveLimit === 0) {
      const cap = document.createElement('div');
      cap.style.cssText = 'text-align:center;background:#FEF3C7;border-radius:12px;padding:12px;font-size:12px;color:#92400E;';
      cap.innerHTML = `🔒 La gestion d'équipe est disponible à partir du plan <strong>Business</strong>.`;
      container.appendChild(cap);
    } else {
      const cap = document.createElement('div');
      cap.style.cssText = 'text-align:center;font-size:12px;color:var(--muted);padding:8px;';
      cap.textContent = `ℹ️ Limite de ${effectiveLimit} membres atteinte pour le plan ${planInfo.plan}`;
      container.appendChild(cap);
    }
  }

  function buildMemberCard(m) {
    const statusConfig = {
      accepted: { bg:'#ECFDF5', color:'#065F46', label:'✅ Actif' },
      pending:  { bg:'#FEF3C7', color:'#92400E', label:'⏳ En attente' },
      rejected: { bg:'#FEF2F2', color:'#991B1B', label:'❌ Refusé' },
    };
    const s    = statusConfig[m.status] || statusConfig.pending;
    const role = m.role === 'gerant' ? '👔 Gérant' : '🧑‍💼 Employé';
    const ini  = (m.company_name || m.email).slice(0, 2).toUpperCase();
    const activePerms = Object.values(m.permissions || {}).filter(Boolean).length;

    const card = document.createElement('div');
    card.style.cssText = 'background:var(--surface);border-radius:16px;padding:12px 14px;border:1.5px solid #F3F4F6;display:flex;align-items:center;gap:10px;';
    card.innerHTML = `
      <div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#7C3AED,#EC4899);color:#fff;font-family:'Sora',sans-serif;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${ini}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.company_name || m.email}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">
          ${role} · ${activePerms} permission${activePerms > 1 ? 's' : ''}
          ${m.boutique_name ? ` · 🏪 ${m.boutique_name}` : ''}
        </div>
      </div>
      <span style="background:${s.bg};color:${s.color};font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;flex-shrink:0;">${s.label}</span>
      <div style="display:flex;gap:4px;flex-shrink:0;" class="card-actions"></div>
    `;

    const actions = card.querySelector('.card-actions');
    if (m.status === 'accepted') {
      const editBtn = document.createElement('button');
      editBtn.style.cssText = 'background:#EDE9FE;color:#7C3AED;border:none;padding:5px 8px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;';
      editBtn.textContent = '⚙️';
      editBtn.addEventListener('click', () => openPermissionsModal(m));
      actions.appendChild(editBtn);
    }
    if (m.status === 'pending') {
      const resendBtn = document.createElement('button');
      resendBtn.style.cssText = 'background:#EFF6FF;color:#2563EB;border:none;padding:5px 8px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;';
      resendBtn.textContent = '🔗';
      resendBtn.title = 'Revoir le lien';
      resendBtn.addEventListener('click', () => reshowInviteLink(m));
      actions.appendChild(resendBtn);
    }
    const delBtn = document.createElement('button');
    delBtn.style.cssText = 'background:#FEF2F2;color:#DC2626;border:none;padding:5px 8px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;';
    delBtn.textContent = '🗑️';
    delBtn.addEventListener('click', () => removeMember(m.id));
    actions.appendChild(delBtn);
    return card;
  }

  // ══════════════════════════════════════
  // MODAL INVITATION
  // ✅ Envoie boutique_id de la boutique active
  // ══════════════════════════════════════
  function openInviteModal() {
    const activeBoutiqueId = window.getActiveBoutiqueId?.() || null;

    const bd    = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    const sheet = document.createElement('div');
    sheet.className = 'module-sheet';
    sheet.innerHTML = `
      <div class="module-sheet-pill"></div>
      <div class="module-sheet-title">➕ Inviter un employé</div>
      <div class="form-group">
        <label>Email de l'employé *</label>
        <input id="inv-email" type="email" placeholder="employe@email.com">
      </div>
      <div class="form-group">
        <label>Rôle</label>
        <select id="inv-role">
          <option value="employe">🧑‍💼 Employé — accès limité</option>
          <option value="gerant">👔 Gérant — accès complet</option>
        </select>
      </div>
      <div id="inv-perms-wrap" style="margin-bottom:14px;">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;">Permissions</div>
      </div>
      <div class="modal-actions">
        <button class="btn-cancel" id="inv-cancel">Annuler</button>
        <button class="btn-confirm" id="inv-send">Envoyer l'invitation</button>
      </div>
    `;

    const permsWrap = sheet.querySelector('#inv-perms-wrap');
    PERMISSIONS.forEach(p => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F3F4F6;';
      row.innerHTML = `<div><div style="font-size:13px;font-weight:600;color:var(--text);">${p.label}</div><div style="font-size:11px;color:var(--muted);">${p.desc}</div></div>`;
      row.appendChild(buildToggle(`perm-${p.key}`, p.key === 'vente'));
      permsWrap.appendChild(row);
    });

    bd.appendChild(sheet);
    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
    sheet.querySelector('#inv-cancel').addEventListener('click', () => bd.remove());
    sheet.querySelector('#inv-role').addEventListener('change', function () {
      setAllToggles(sheet, this.value === 'gerant');
    });

    sheet.querySelector('#inv-send').addEventListener('click', async () => {
      const email = sheet.querySelector('#inv-email').value.trim();
      const role  = sheet.querySelector('#inv-role').value;
      if (!email) { notify('Email requis', 'warning'); return; }

      const permissions = {};
      PERMISSIONS.forEach(p => { permissions[p.key] = !!sheet.querySelector(`#perm-${p.key}`)?.checked; });

      const sendBtn = sheet.querySelector('#inv-send');
      sendBtn.disabled = true; sendBtn.textContent = '⏳ Envoi…';

      try {
        // ✅ Passe boutique_id pour assigner l'employé à la boutique active
        const body = { email, role, permissions };
        if (activeBoutiqueId) body.boutique_id = activeBoutiqueId;

        const data = await auth(`${API()}/members/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(ok_);

        notify(`✅ Invitation envoyée à ${email}`, 'success');
        bd.remove();
        if (data.invite_link) showInviteLink(data.invite_link, email, data.boutique_name);
        loadMembers();
      } catch (err) {
        const code = String(err.message);
        const msg  = code === '400' ? 'Email déjà invité ou quota atteint'
                   : code === '402' ? 'Plan insuffisant pour inviter des employés'
                   : "Erreur lors de l'invitation";
        notify(msg, 'error');
        sendBtn.disabled = false;
        sendBtn.textContent = "Envoyer l'invitation";
      }
    });
  }

  function showInviteLink(link, email, boutiqueName = '') {
    const bd = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    const waText = encodeURIComponent(`Vous êtes invité à rejoindre ma boutique${boutiqueName ? ` "${boutiqueName}"` : ''} sur Sama Commerce :\n${link}`);
    const sheet = document.createElement('div');
    sheet.className = 'module-sheet';
    sheet.innerHTML = `
      <div class="module-sheet-pill"></div>
      <div class="module-sheet-title">🔗 Lien d'invitation</div>
      <div style="background:#ECFDF5;border-radius:14px;padding:14px;margin-bottom:14px;">
        <div style="font-size:13px;color:#065F46;margin-bottom:8px;text-align:center;">
          Partagez ce lien avec <strong>${email}</strong>
          ${boutiqueName ? `<br><span style="font-size:11px;color:#059669;">📍 Boutique : ${boutiqueName}</span>` : ''}
          <br><span style="font-size:11px;color:#059669;">⏳ Valide 72 heures</span>
        </div>
        <div id="invite-link-txt" style="font-size:11px;word-break:break-all;color:#059669;background:#fff;padding:8px;border-radius:8px;">${link}</div>
      </div>
      <button id="copy-link-btn" style="width:100%;padding:12px;background:#EDE9FE;color:#7C3AED;border:none;border-radius:14px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;">📋 Copier le lien</button>
      <a href="https://wa.me/?text=${waText}" target="_blank" style="display:block;width:100%;padding:12px;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border-radius:14px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;text-align:center;text-decoration:none;margin-bottom:10px;">💬 Envoyer via WhatsApp</a>
      <button id="close-link-btn" style="width:100%;padding:12px;background:#F3F4F6;color:#6B7280;border:none;border-radius:14px;font-family:'Sora',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">Fermer</button>
    `;
    bd.appendChild(sheet);
    document.body.appendChild(bd);
    sheet.querySelector('#copy-link-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(link).then(() => notify('📋 Lien copié !', 'success'));
    });
    sheet.querySelector('#close-link-btn').addEventListener('click', () => bd.remove());
    bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
  }

  async function reshowInviteLink(member) {
    try {
      const res  = await auth(`${API()}/members/${member.id}/resend`, { method: 'POST' });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      notify('🔗 Nouveau lien généré !', 'success');
      const link = data.invite_link || '';
      if (link) showInviteLink(link, member.email, member.boutique_name);
    } catch (err) {
      notify(String(err.message) === '404' ? 'Invitation déjà acceptée' : 'Erreur lors du renvoi', 'error');
    }
  }

  // ══════════════════════════════════════
  // MODAL PERMISSIONS
  // ══════════════════════════════════════
  function openPermissionsModal(member) {
    const bd    = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    const sheet = document.createElement('div');
    sheet.className = 'module-sheet';
    sheet.innerHTML = `
      <div class="module-sheet-pill"></div>
      <div class="module-sheet-title">⚙️ Permissions — ${member.company_name || member.email}</div>
      <div id="ep-perms-wrap" style="margin-bottom:14px;"></div>
      <div class="modal-actions">
        <button class="btn-cancel" id="ep-cancel">Annuler</button>
        <button class="btn-confirm" id="ep-save">Enregistrer</button>
      </div>
    `;
    const permsWrap = sheet.querySelector('#ep-perms-wrap');
    PERMISSIONS.forEach(p => {
      const checked = !!member.permissions?.[p.key];
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #F3F4F6;';
      row.innerHTML = `<div><div style="font-size:13px;font-weight:600;color:var(--text);">${p.label}</div><div style="font-size:11px;color:var(--muted);">${p.desc}</div></div>`;
      row.appendChild(buildToggle(`ep-${p.key}`, checked));
      permsWrap.appendChild(row);
    });
    bd.appendChild(sheet);
    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
    sheet.querySelector('#ep-cancel').addEventListener('click', () => bd.remove());
    sheet.querySelector('#ep-save').addEventListener('click', async () => {
      const permissions = {};
      PERMISSIONS.forEach(p => { permissions[p.key] = !!sheet.querySelector(`#ep-${p.key}`)?.checked; });
      const saveBtn = sheet.querySelector('#ep-save');
      saveBtn.disabled = true; saveBtn.textContent = '⏳ Sauvegarde…';
      try {
        await auth(`${API()}/members/${member.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions }),
        }).then(ok_);
        notify('✅ Permissions mises à jour', 'success');
        bd.remove(); loadMembers();
      } catch {
        notify('Erreur mise à jour permissions', 'error');
        saveBtn.disabled = false; saveBtn.textContent = 'Enregistrer';
      }
    });
  }

  // ══════════════════════════════════════
  // RETIRER UN MEMBRE
  // ══════════════════════════════════════
  async function removeMember(id) {
    const m = members.find(x => x.id === id);
    const confirmed = await window.customConfirm?.(`Retirer ${m?.company_name || m?.email} de l'équipe ?`);
    if (!confirmed) return;
    try {
      await auth(`${API()}/members/${id}`, { method: 'DELETE' }).then(ok_);
      notify("Membre retiré de l'équipe", 'success');
      loadMembers();
    } catch { notify('Erreur lors de la suppression', 'error'); }
  }

  // ══════════════════════════════════════
  // RESTRICTIONS EMPLOYÉ
  // ✅ Bannière affiche le nom de la boutique spécifique
  // ══════════════════════════════════════
  async function applyEmployeeRestrictions() {
    try {
      const data = await auth(`${API()}/members/my-boutique`).then(ok_);
      if (!data) return;

      const perms = data.permissions || {};
      window._employeeMode     = true;
      window._employeePerms    = perms;
      window._employeeBoutique = data;

      // Intercepter navTo()
      const originalNavTo = window.navTo;
      if (typeof originalNavTo === 'function') {
        window.navTo = function (section) {
          const requiredPerm = SECTION_PERM_MAP[section];
          if (requiredPerm && !perms[requiredPerm]) {
            window.showNotification?.(`🔒 Accès refusé — permission "${requiredPerm}" requise`, 'warning');
            return;
          }
          originalNavTo(section);
        };
      }

      // Masquer les sections non autorisées
      const sectionMap = {
        stock:        ['[data-section="stock"]', '#nav-stock'],
        categories:   ['[data-section="categories"]'],
        rapports:     ['[data-section="rapports"]', '#nav-rapports'],
        caisse:       ['[data-section="caisse"]', '[onclick*="caisse"]'],
        credits:      ['[data-section="credits"]'],
        clients:      ['[data-section="clients"]'],
        fournisseurs: ['[data-section="fournisseurs"]'],
        commandes:    ['[data-section="commandes"]'],
        livraisons:   ['[data-section="livraisons"]'],
        inventaire:   ['[data-section="inventaire"]'],
      };
      Object.entries(sectionMap).forEach(([key, selectors]) => {
        if (!perms[key]) {
          selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.style.display = 'none');
          });
        }
      });

      // ✅ Bannière : affiche le nom de la boutique spécifique (pas juste le propriétaire)
      if (!document.getElementById('employee-banner')) {
        const banner = document.createElement('div');
        banner.id = 'employee-banner';
        banner.style.cssText = `
          background:linear-gradient(135deg,#EDE9FE,#FCE7F3);
          padding:6px 16px;text-align:center;font-size:12px;font-weight:700;
          color:#7C3AED;border-bottom:1px solid rgba(124,58,237,.15);
          position:sticky;top:0;z-index:50;
        `;
        const boutiqueName = data.boutique_name || data.company_name || data.boutique_email || '';
        const roleLabel    = data.role === 'gerant' ? 'Gérant' : 'Employé';
        banner.textContent = `🧑‍💼 Mode ${roleLabel} — 🏪 ${boutiqueName}`;
        document.body.insertBefore(banner, document.body.firstChild);
      }

      const header = document.getElementById('appHeader');
      if (header && (data.boutique_name || data.company_name)) {
        header.textContent = `🏪 ${data.boutique_name || data.company_name}`;
      }

    } catch (err) {
      console.debug('employeeRestrictions:', err.message);
    }
  }

  // ══════════════════════════════════════
  // INJECTION DANS LE PROFIL
  // ══════════════════════════════════════
  function injectTeamInProfile() {
    const obs = new MutationObserver(() => {
      const content = document.getElementById('profilContent');
      if (!content || content.querySelector('#team-section')) return;
      if (!content.querySelector('#profil-save-info')) return;

      const section = document.createElement('div');
      section.id = 'team-section';
      section.style.cssText = 'background:var(--surface);border-radius:20px;padding:18px;margin-bottom:14px;box-shadow:0 2px 14px rgba(0,0,0,.06);';
      section.innerHTML = '<div style="text-align:center;padding:10px 0;color:var(--muted);font-size:13px;">Chargement équipe…</div>';

      const logoutBtn = Array.from(content.querySelectorAll('button')).find(b => b.textContent.includes('Déconnecter'));
      if (logoutBtn) logoutBtn.parentNode.insertBefore(section, logoutBtn);
      else content.appendChild(section);

      loadMembers();
    });

    const content = document.getElementById('profilContent');
    if (content) obs.observe(content, { childList: true });
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    injectTeamInProfile();
    applyEmployeeRestrictions();

    // Recharger l'équipe quand on change de boutique
    window.addEventListener('boutique:changed', () => {
      _planInfo = null; // reset cache plan
      const section = document.getElementById('team-section');
      if (section) loadMembers();
    });

    window.addEventListener('pageChange', e => {
      if (e.detail?.key === 'profil') setTimeout(injectTeamInProfile, 300);
    });
  }

  window.teamModule = { load: loadMembers };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
