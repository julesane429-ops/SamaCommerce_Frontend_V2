/**
 * team.js — Gestion multi-appareil / équipe boutique
 *
 * Accessible depuis Profil → Équipe
 * Fonctionnalités :
 *   - Inviter un employé par email
 *   - Définir son rôle (Employé / Gérant)
 *   - Configurer ses permissions par section
 *   - Retirer un membre
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/team.js"></script>
 */

(function () {

  const API    = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth   = (url, o={}) => window.authfetch(url, o);
  const notify = (m, t) => window.showNotification?.(m, t);
  const ok_    = r => { if(!r.ok) throw new Error(r.status); return r.json(); };

  const PERMISSIONS = [
    { key:'vente',       label:'💳 Vendre',       desc:'Effectuer des ventes' },
    { key:'stock',       label:'📦 Stock',         desc:'Gérer les produits' },
    { key:'rapports',    label:'📈 Chiffres',       desc:'Voir les rapports' },
    { key:'credits',     label:'📝 Crédits',       desc:'Gérer les crédits' },
    { key:'clients',     label:'👥 Clients',       desc:'Accéder aux clients' },
    { key:'fournisseurs',label:'🏭 Fournisseurs',  desc:'Gérer les fournisseurs' },
    { key:'commandes',   label:'📦 Commandes',     desc:'Créer des commandes' },
    { key:'livraisons',  label:'🚚 Livraisons',    desc:'Suivre les livraisons' },
  ];

  let members = [];

  // ══════════════════════════════════════
  // CHARGER LES MEMBRES
  // ══════════════════════════════════════
  async function loadMembers() {
    try {
      members = await auth(`${API()}/members`).then(ok_);
      renderTeamSection();
    } catch { notify('Erreur chargement équipe', 'error'); }
  }

  // ══════════════════════════════════════
  // RENDU SECTION ÉQUIPE (injectée dans le Profil)
  // ══════════════════════════════════════
  function renderTeamSection() {
    const container = document.getElementById('team-section');
    if (!container) return;

    const pending  = members.filter(m => m.status === 'pending').length;
    const accepted = members.filter(m => m.status === 'accepted').length;

    container.innerHTML = `
      <div style="font-family:'Sora',sans-serif;font-size:15px;font-weight:800;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
        👥 Mon équipe
        ${accepted > 0 ? `<span style="background:#EDE9FE;color:#7C3AED;font-size:10px;padding:2px 8px;border-radius:6px;">${accepted} actif${accepted>1?'s':''}</span>` : ''}
        ${pending  > 0 ? `<span style="background:#FEF3C7;color:#D97706;font-size:10px;padding:2px 8px;border-radius:6px;">${pending} en attente</span>` : ''}
      </div>

      ${members.length === 0 ? `
        <div style="text-align:center;padding:20px 0;color:var(--muted);">
          <div style="font-size:40px;margin-bottom:8px;">👤</div>
          <div style="font-size:13px;font-weight:600;margin-bottom:12px;">Vous gérez seul votre boutique</div>
          <div style="font-size:12px;color:var(--muted);">Invitez jusqu'à 3 employés pour travailler ensemble</div>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
          ${members.map(m => renderMemberCard(m)).join('')}
        </div>
      `}

      ${members.length < 3 ? `
        <button id="invite-btn" style="
          width:100%;padding:12px;
          background:linear-gradient(135deg,#7C3AED,#EC4899);
          color:#fff;border:none;border-radius:14px;
          font-family:'Sora',sans-serif;font-size:13px;font-weight:700;
          cursor:pointer;box-shadow:0 3px 10px rgba(124,58,237,.25);
          display:flex;align-items:center;justify-content:center;gap:8px;
        ">
          ➕ Inviter un employé
        </button>
      ` : `
        <div style="text-align:center;font-size:12px;color:var(--muted);padding:8px;">
          ℹ️ Maximum 3 membres atteint
        </div>
      `}
    `;

    container.querySelector('#invite-btn')?.addEventListener('click', openInviteModal);

    container.querySelectorAll('[data-member-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = members.find(x => x.id === parseInt(btn.dataset.memberEdit));
        if (m) openPermissionsModal(m);
      });
    });

    container.querySelectorAll('[data-member-remove]').forEach(btn => {
      btn.addEventListener('click', () => removeMember(parseInt(btn.dataset.memberRemove)));
    });
  }

  function renderMemberCard(m) {
    const statusConfig = {
      accepted: { bg:'#ECFDF5', color:'#065F46', label:'✅ Actif' },
      pending:  { bg:'#FEF3C7', color:'#92400E', label:'⏳ En attente' },
      rejected: { bg:'#FEF2F2', color:'#991B1B', label:'❌ Refusé' },
    };
    const s    = statusConfig[m.status] || statusConfig.pending;
    const role = m.role === 'gerant' ? '👔 Gérant' : '🧑‍💼 Employé';
    const ini  = m.email.slice(0,2).toUpperCase();

    const activePerms = Object.entries(m.permissions || {})
      .filter(([,v]) => v).length;

    return `
      <div style="
        background:var(--surface);border-radius:16px;padding:12px 14px;
        border:1.5px solid #F3F4F6;display:flex;align-items:center;gap:10px;
      ">
        <!-- Avatar -->
        <div style="
          width:42px;height:42px;border-radius:12px;
          background:linear-gradient(135deg,#7C3AED,#EC4899);
          color:#fff;font-family:'Sora',sans-serif;font-size:14px;font-weight:800;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;
        ">${ini}</div>

        <!-- Infos -->
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${m.company_name || m.email}
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">
            ${role} · ${activePerms} permission${activePerms>1?'s':''}
          </div>
        </div>

        <!-- Statut -->
        <span style="background:${s.bg};color:${s.color};font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;flex-shrink:0;">
          ${s.label}
        </span>

        <!-- Actions -->
        <div style="display:flex;gap:4px;flex-shrink:0;">
          ${m.status === 'accepted' ? `
            <button data-member-edit="${m.id}" style="
              background:#EDE9FE;color:#7C3AED;border:none;padding:5px 8px;
              border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;
            ">⚙️</button>
          ` : ''}
          <button data-member-remove="${m.id}" style="
            background:#FEF2F2;color:#DC2626;border:none;padding:5px 8px;
            border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;
          ">🗑️</button>
        </div>
      </div>
    `;
  }

  // ══════════════════════════════════════
  // MODAL INVITATION
  // ══════════════════════════════════════
  function openInviteModal() {
    const bd = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet">
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
          ${PERMISSIONS.map(p => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F3F4F6;">
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--text);">${p.label}</div>
                <div style="font-size:11px;color:var(--muted);">${p.desc}</div>
              </div>
              <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;">
                <input type="checkbox" id="perm-${p.key}" ${p.key==='vente'?'checked':''} style="opacity:0;width:0;height:0;">
                <span style="position:absolute;inset:0;background:${p.key==='vente'?'var(--primary)':'#E5E7EB'};border-radius:12px;cursor:pointer;transition:background .2s;"
                  onclick="
                    const cb=document.getElementById('perm-${p.key}');
                    cb.checked=!cb.checked;
                    this.style.background=cb.checked?'var(--primary)':'#E5E7EB';
                  ">
                  <span style="position:absolute;left:${p.key==='vente'?'22px':'2px'};top:2px;width:20px;height:20px;background:#fff;border-radius:50%;transition:left .2s;box-shadow:0 1px 4px rgba(0,0,0,.2);"></span>
                </span>
              </label>
            </div>
          `).join('')}
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" id="inv-cancel">Annuler</button>
          <button class="btn-confirm" id="inv-send">Envoyer l'invitation</button>
        </div>
      </div>
    `;

    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if(e.target===bd) bd.remove(); });
    bd.querySelector('#inv-cancel').addEventListener('click', ()=>bd.remove());

    // Mettre à jour les permissions selon le rôle
    bd.querySelector('#inv-role').addEventListener('change', function() {
      const isGerant = this.value === 'gerant';
      PERMISSIONS.forEach(p => {
        const cb = bd.querySelector(`#perm-${p.key}`);
        if (cb) {
          cb.checked = isGerant;
          const span = cb.nextElementSibling;
          if (span) {
            span.style.background = isGerant ? 'var(--primary)' : '#E5E7EB';
            const dot = span.querySelector('span');
            if (dot) dot.style.left = isGerant ? '22px' : '2px';
          }
        }
      });
    });

    bd.querySelector('#inv-send').addEventListener('click', async () => {
      const email = bd.querySelector('#inv-email').value.trim();
      const role  = bd.querySelector('#inv-role').value;
      if (!email) { notify('Email requis', 'warning'); return; }

      const permissions = {};
      PERMISSIONS.forEach(p => {
        permissions[p.key] = !!bd.querySelector(`#perm-${p.key}`)?.checked;
      });

      try {
        const data = await auth(`${API()}/members/invite`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email, role, permissions }),
        }).then(ok_);

        notify(`✅ Invitation envoyée à ${email}`, 'success');
        bd.remove();

        // Afficher le lien d'invitation
        if (data.invite_link) showInviteLink(data.invite_link, email);
        loadMembers();
      } catch (err) {
        notify(err.message === '400' ? 'Email déjà invité ou quota atteint' : 'Erreur invitation', 'error');
      }
    });
  }

  function showInviteLink(link, email) {
    const bd = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">🔗 Lien d'invitation</div>
        <div style="background:#ECFDF5;border-radius:14px;padding:14px;margin-bottom:14px;text-align:center;">
          <div style="font-size:13px;color:#065F46;margin-bottom:8px;">Partagez ce lien avec <strong>${email}</strong></div>
          <div style="font-size:11px;word-break:break-all;color:#059669;background:#fff;padding:8px;border-radius:8px;">${link}</div>
        </div>
        <button onclick="navigator.clipboard.writeText('${link}');window.showNotification?.('Lien copié','success')" style="
          width:100%;padding:12px;background:#EDE9FE;color:#7C3AED;
          border:none;border-radius:14px;font-family:'Sora',sans-serif;
          font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;
        ">📋 Copier le lien</button>
        <a href="https://wa.me/?text=${encodeURIComponent(`Vous êtes invité à rejoindre ma boutique sur Sama Commerce : ${link}`)}" target="_blank"
          style="display:block;width:100%;padding:12px;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;
          border:none;border-radius:14px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;
          cursor:pointer;margin-bottom:10px;text-align:center;text-decoration:none;">
          💬 Envoyer via WhatsApp
        </a>
        <button onclick="this.closest('.module-sheet-backdrop').remove()" style="
          width:100%;padding:12px;background:#F3F4F6;color:#6B7280;
          border:none;border-radius:14px;font-family:'Sora',sans-serif;
          font-size:13px;font-weight:600;cursor:pointer;
        ">Fermer</button>
      </div>
    `;
    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if(e.target===bd) bd.remove(); });
  }

  // ══════════════════════════════════════
  // MODAL PERMISSIONS
  // ══════════════════════════════════════
  function openPermissionsModal(member) {
    const bd = document.createElement('div');
    bd.className = 'module-sheet-backdrop';

    bd.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">⚙️ Permissions — ${member.company_name || member.email}</div>

        <div style="margin-bottom:14px;">
          ${PERMISSIONS.map(p => {
            const checked = !!member.permissions?.[p.key];
            return `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #F3F4F6;">
                <div>
                  <div style="font-size:13px;font-weight:600;color:var(--text);">${p.label}</div>
                  <div style="font-size:11px;color:var(--muted);">${p.desc}</div>
                </div>
                <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;cursor:pointer;">
                  <input type="checkbox" id="ep-${p.key}" ${checked?'checked':''} style="opacity:0;width:0;height:0;">
                  <span style="position:absolute;inset:0;background:${checked?'var(--primary)':'#E5E7EB'};border-radius:12px;transition:background .2s;"
                    onclick="const cb=document.getElementById('ep-${p.key}');cb.checked=!cb.checked;this.style.background=cb.checked?'var(--primary)':'#E5E7EB';">
                    <span style="position:absolute;left:${checked?'22px':'2px'};top:2px;width:20px;height:20px;background:#fff;border-radius:50%;transition:left .2s;box-shadow:0 1px 4px rgba(0,0,0,.2);"></span>
                  </span>
                </label>
              </div>
            `;
          }).join('')}
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" id="ep-cancel">Annuler</button>
          <button class="btn-confirm" id="ep-save">Enregistrer</button>
        </div>
      </div>
    `;

    document.body.appendChild(bd);
    bd.addEventListener('click', e=>{if(e.target===bd)bd.remove();});
    bd.querySelector('#ep-cancel').addEventListener('click', ()=>bd.remove());

    bd.querySelector('#ep-save').addEventListener('click', async () => {
      const permissions = {};
      PERMISSIONS.forEach(p => {
        permissions[p.key] = !!bd.querySelector(`#ep-${p.key}`)?.checked;
      });
      try {
        await auth(`${API()}/members/${member.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type':'application/json' },
          body:    JSON.stringify({ permissions }),
        }).then(ok_);
        notify('✅ Permissions mises à jour', 'success');
        bd.remove(); loadMembers();
      } catch { notify('Erreur mise à jour', 'error'); }
    });
  }

  // ══════════════════════════════════════
  // RETIRER UN MEMBRE
  // ══════════════════════════════════════
  async function removeMember(id) {
    const m = members.find(x => x.id === id);
    if (!await window.customConfirm?.(`Retirer ${m?.company_name || m?.email} de l'équipe ?`)) return;
    try {
      await auth(`${API()}/members/${id}`, { method:'DELETE' }).then(ok_);
      notify('Membre retiré', 'success');
      loadMembers();
    } catch { notify('Erreur suppression', 'error'); }
  }

  // ══════════════════════════════════════
  // RESTRICTIONS EMPLOYÉ
  // ══════════════════════════════════════
  async function applyEmployeeRestrictions() {
    try {
      const data = await auth(`${API()}/members/my-boutique`).then(ok_);
      if (!data) return; // Pas un employé

      const perms = data.permissions || {};
      window._employeeMode     = true;
      window._employeePerms    = perms;
      window._employeeBoutique = data;

      // Masquer les sections non autorisées dans le Plus Sheet
      const sectionMap = {
        stock:        '.sheet-item[data-section="stock"], #nav-stock',
        rapports:     '.sheet-item[data-section="rapports"], #nav-rapports',
        credits:      '.sheet-item[data-section="credits"]',
        clients:      '.sheet-item[onclick*="clients"]',
        fournisseurs: '.sheet-item[onclick*="fournisseurs"]',
        commandes:    '.sheet-item[onclick*="commandes"]',
        livraisons:   '.sheet-item[onclick*="livraisons"]',
      };

      Object.entries(sectionMap).forEach(([key, selector]) => {
        if (!perms[key]) {
          document.querySelectorAll(selector).forEach(el => {
            el.style.display = 'none';
          });
        }
      });

      // Afficher le nom de la boutique principale
      const header = document.getElementById('appHeader');
      if (header) header.textContent = `🏪 ${data.boutique_name || 'Boutique'}`;

      // Bannière "Mode employé"
      const banner = document.createElement('div');
      banner.style.cssText = `
        background:linear-gradient(135deg,#EDE9FE,#FCE7F3);
        padding:6px 16px;text-align:center;
        font-size:12px;font-weight:700;color:#7C3AED;
        border-bottom:1px solid rgba(124,58,237,.15);
      `;
      banner.textContent = `🧑‍💼 Mode employé — ${data.role === 'gerant' ? 'Gérant' : 'Employé'}`;
      document.body.insertBefore(banner, document.body.firstChild);
    } catch { /* Pas un employé ou erreur réseau */ }
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
    if (content) obs.observe(content, { childList:true });
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    injectTeamInProfile();
    applyEmployeeRestrictions();

    window.addEventListener('pageChange', e => {
      if (e.detail?.key === 'profil') setTimeout(injectTeamInProfile, 500);
    });
  }

  window.teamModule = { load: loadMembers };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
