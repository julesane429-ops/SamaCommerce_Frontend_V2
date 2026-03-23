/**
 * team.js — Gestion multi-appareil / équipe boutique
 */
(function () {

  const API    = () => document.querySelector('meta[name="api-base"]')?.content
                    || 'https://samacommerce-backend-v2.onrender.com';
  const auth   = (url, o={}) => window.authfetch(url, o);
  const notify = (m, t)      => window.showNotification?.(m, t);
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

  // ── Map section navTo → clé de permission ─────────────────────
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

  let members = [];

  // ════════════════════════════════════════
  // TOGGLE — composant réutilisable
  // ════════════════════════════════════════
  function buildToggle(id, checked) {
    const label = document.createElement('label');
    label.style.cssText = 'position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;cursor:pointer;';

    const input = document.createElement('input');
    input.type    = 'checkbox';
    input.id      = id;
    input.checked = checked;
    input.style.cssText = 'opacity:0;width:0;height:0;position:absolute;';

    const track = document.createElement('span');
    track.style.cssText = `position:absolute;inset:0;border-radius:12px;background:${checked ? 'var(--primary)' : '#E5E7EB'};transition:background .2s;`;

    const dot = document.createElement('span');
    dot.style.cssText = `position:absolute;left:${checked ? '22px' : '2px'};top:2px;width:20px;height:20px;background:#fff;border-radius:50%;transition:left .2s;box-shadow:0 1px 4px rgba(0,0,0,.2);`;

    track.appendChild(dot);
    label.appendChild(input);
    label.appendChild(track);

    input.addEventListener('change', () => {
      track.style.background = input.checked ? 'var(--primary)' : '#E5E7EB';
      dot.style.left         = input.checked ? '22px' : '2px';
    });

    return label;
  }

  function setAllToggles(container, state) {
    PERMISSIONS.forEach(p => {
      const input = container.querySelector(`#perm-${p.key}`);
      if (input) { input.checked = state; input.dispatchEvent(new Event('change')); }
    });
  }

  // ════════════════════════════════════════
  // CHARGER LES MEMBRES
  // ════════════════════════════════════════
  async function loadMembers() {
    try {
      const _bid = localStorage.getItem("sc_active_boutique");
      const _isPrimary = localStorage.getItem("sc_active_boutique_is_primary") === "1";
      const _url = (_bid && !_isPrimary) ? `${API()}/members?boutique_id=${_bid}` : `${API()}/members`;
      members = await auth(_url).then(ok_);
      renderTeamSection();
    } catch { notify('Erreur chargement équipe', 'error'); }
  }

  // ════════════════════════════════════════
  // RENDU SECTION ÉQUIPE
  // ════════════════════════════════════════
  function renderTeamSection() {
    const container = document.getElementById('team-section');
    if (!container) return;

    const pending  = members.filter(m => m.status === 'pending').length;
    const accepted = members.filter(m => m.status === 'accepted').length;

    container.innerHTML = `
      <div style="font-family:'Sora',sans-serif;font-size:15px;font-weight:800;color:var(--text);
                  margin-bottom:14px;display:flex;align-items:center;gap:8px;">
        👥 Mon équipe
        ${accepted > 0 ? `<span style="background:#EDE9FE;color:#7C3AED;font-size:10px;padding:2px 8px;border-radius:6px;">${accepted} actif${accepted>1?'s':''}</span>` : ''}
        ${pending  > 0 ? `<span style="background:#FEF3C7;color:#D97706;font-size:10px;padding:2px 8px;border-radius:6px;">${pending} en attente</span>` : ''}
      </div>
    `;

    if (members.length === 0) {
      container.innerHTML += `
        <div style="text-align:center;padding:20px 0;color:var(--muted);">
          <div style="font-size:40px;margin-bottom:8px;">👤</div>
          <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Vous gérez seul votre boutique</div>
          <div style="font-size:12px;">Invitez jusqu'à 3 employés pour travailler ensemble</div>
        </div>
      `;
    } else {
      const list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:14px;';
      members.forEach(m => list.appendChild(buildMemberCard(m)));
      container.appendChild(list);
    }

    if (members.length < 3) {
      const btn = document.createElement('button');
      btn.style.cssText = `width:100%;padding:12px;background:linear-gradient(135deg,#7C3AED,#EC4899);color:#fff;border:none;border-radius:14px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(124,58,237,.25);display:flex;align-items:center;justify-content:center;gap:8px;`;
      btn.textContent = '➕ Inviter un employé';
      btn.addEventListener('click', openInviteModal);
      container.appendChild(btn);
    } else {
      const cap = document.createElement('div');
      cap.style.cssText = 'text-align:center;font-size:12px;color:var(--muted);padding:8px;';
      cap.textContent = 'ℹ️ Maximum 3 membres atteint';
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
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">${role} · ${activePerms} permission${activePerms > 1 ? 's' : ''}</div>
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

  // ════════════════════════════════════════
  // MODAL INVITATION
  // ════════════════════════════════════════
  function openInviteModal() {
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
        // ✅ Rattacher l'invitation à la boutique active
        const _invBid = localStorage.getItem('sc_active_boutique');
        const _invPrimary = localStorage.getItem('sc_active_boutique_is_primary') === '1';
        const _invBoutiqueId = (_invBid && !_invPrimary) ? parseInt(_invBid) : null;

        const data = await auth(`${API()}/members/invite`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role, permissions, boutique_id: _invBoutiqueId }),
        }).then(ok_);

        notify(`✅ Invitation envoyée à ${email}`, 'success');
        bd.remove();
        if (data.invite_link) showInviteLink(data.invite_link, email);
        loadMembers();
      } catch (err) {
        notify(err.message === '400' ? 'Email déjà invité ou quota atteint' : "Erreur lors de l'invitation", 'error');
        sendBtn.disabled = false; sendBtn.textContent = "Envoyer l'invitation";
      }
    });
  }

  function showInviteLink(link, email) {
    const bd = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    const waText = encodeURIComponent(`Vous êtes invité à rejoindre ma boutique sur Sama Commerce :\n${link}`);
    const sheet = document.createElement('div');
    sheet.className = 'module-sheet';
    sheet.innerHTML = `
      <div class="module-sheet-pill"></div>
      <div class="module-sheet-title">🔗 Lien d'invitation</div>
      <div style="background:#ECFDF5;border-radius:14px;padding:14px;margin-bottom:14px;">
        <div style="font-size:13px;color:#065F46;margin-bottom:8px;text-align:center;">
          Partagez ce lien avec <strong>${email}</strong><br>
          <span style="font-size:11px;color:#059669;">⏳ Valide 72 heures — l'employé devra créer un compte ou se connecter</span>
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
      const res = await auth(`${API()}/members/${member.id}/resend`, { method: 'POST' });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      notify('🔗 Nouveau lien généré !', 'success');
      // Afficher le lien dans une modale simple
      const link = data.invite_link || '';
      if (link) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
          <div style="background:#fff;border-radius:20px;padding:24px;max-width:340px;width:90%;text-align:center;">
            <div style="font-size:20px;margin-bottom:8px;">🔗 Lien d'invitation</div>
            <div style="font-size:11px;color:#6B7280;margin-bottom:12px;">Valide 72h</div>
            <input readonly value="${link}" style="width:100%;padding:10px;border:1.5px solid #E5E7EB;border-radius:12px;font-size:11px;margin-bottom:12px;box-sizing:border-box;">
            <button onclick="navigator.clipboard.writeText('${link}');this.textContent='✅ Copié !'" style="width:100%;padding:12px;background:#7C3AED;color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;margin-bottom:8px;">📋 Copier le lien</button>
            <button onclick="this.closest('[style*=fixed]').remove()" style="width:100%;padding:10px;background:#F3F4F6;border:none;border-radius:12px;cursor:pointer;">Fermer</button>
          </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
      }
    } catch (err) {
      const msg = String(err.message) === '404' ? 'Invitation déjà acceptée' : 'Erreur lors du renvoi';
      notify(msg, 'error');
    }
  }

  // ════════════════════════════════════════
  // MODAL PERMISSIONS
  // ════════════════════════════════════════
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

  // ════════════════════════════════════════
  // RETIRER UN MEMBRE
  // ════════════════════════════════════════
  async function removeMember(id) {
    const m = members.find(x => x.id === id);
    const confirmed = await window.customConfirm?.(`Retirer ${m?.company_name || m?.email} de l'équipe ?`);
    if (!confirmed) return;
    try {
      await auth(`${API()}/members/${id}`, { method: 'DELETE' }).then(ok_);
      notify('Membre retiré de l\'équipe', 'success');
      loadMembers();
    } catch { notify('Erreur lors de la suppression', 'error'); }
  }

  // ════════════════════════════════════════
  // RESTRICTIONS EMPLOYÉ
  // ════════════════════════════════════════
  async function applyEmployeeRestrictions() {
    try {
      const data = await auth(`${API()}/members/my-boutique`).then(ok_);
      if (!data) return;

      const perms = data.permissions || {};
      window._employeeMode     = true;
      window._employeePerms    = perms;
      window._employeeBoutique = data;

      // Intercepter navTo() pour bloquer les sections non autorisées
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

      // Masquer les éléments de nav non autorisés
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

      // Bannière mode employé
      if (!document.getElementById('employee-banner')) {
        const banner = document.createElement('div');
        banner.id = 'employee-banner';
        banner.style.cssText = 'background:linear-gradient(135deg,#EDE9FE,#FCE7F3);padding:6px 16px;text-align:center;font-size:12px;font-weight:700;color:#7C3AED;border-bottom:1px solid rgba(124,58,237,.15);position:sticky;top:0;z-index:50;';
        banner.textContent = `🧑‍💼 Mode ${data.role === 'gerant' ? 'Gérant' : 'Employé'} — ${data.boutique_email || data.company_name || ''}`;
        document.body.insertBefore(banner, document.body.firstChild);
      }

      const header = document.getElementById('appHeader');
      if (header && data.company_name) header.textContent = `🏪 ${data.company_name}`;

    } catch (err) {
      console.debug('employeeRestrictions:', err.message);
    }
  }

  // ════════════════════════════════════════
  // INJECTION DANS LE PROFIL
  // ════════════════════════════════════════
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

  // ════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════
  function init() {
    injectTeamInProfile();
    applyEmployeeRestrictions();
    window.addEventListener('pageChange', e => {
      if (e.detail?.key === 'profil') setTimeout(injectTeamInProfile, 300);
    });

    // ✅ Recharger les membres quand on change de boutique
    window.addEventListener('boutique:changed', () => {
      setTimeout(loadMembers, 300);
    });
  }

  window.teamModule = { load: loadMembers };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
