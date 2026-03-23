/**
 * boutique-switcher.js — Sélecteur de boutique multi-boutiques
 *
 * ✅ Changements v2 :
 *   - Limite Infinity pour Enterprise → pas de message "limite atteinte"
 *   - Indicateur de boutique active visible pour TOUS (propriétaire + employés)
 *   - Invite d'employé par boutique (avec sélection de la boutique cible)
 *   - Badge "Boutique active" persistant dans le header
 *   - Rechargement auto des données au changement de boutique
 */

(function () {
  const API  = () => document.querySelector('meta[name="api-base"]')?.content
                  || 'https://samacommerce-backend-v2.onrender.com';
  const auth = (url, o = {}) => window.authfetch?.(url, o);
  const KEY  = 'sc_active_boutique';

  let _boutiques      = [];
  let _activeBoutique = null;
  let _isEmployee     = false;
  let _employeeBoutique = null; // boutique fixe de l'employé

  // ══════════════════════════════════════
  // ÉTAT ACTIF
  // ══════════════════════════════════════
  function getActiveBoutiqueId() {
    return parseInt(localStorage.getItem(KEY) || '0') || null;
  }

  function setActiveBoutique(boutique) {
    _activeBoutique = boutique;
    if (boutique?.id) {
      localStorage.setItem(KEY, String(boutique.id));
    } else {
      localStorage.removeItem(KEY);
    }
    window._activeBoutiqueId = boutique?.id || null;
    updateHeaderDisplay();
    window.dispatchEvent(new CustomEvent('boutique:changed', { detail: boutique }));
  }

  // ══════════════════════════════════════
  // PATCH authfetch pour injecter X-Boutique-Id
  // ══════════════════════════════════════
  function patchAuthfetch() {
    const orig = window.authfetch;
    if (!orig || orig._boutiquePatch) return;

    window.authfetch = function (url, options = {}) {
      const boutiqueId = window._activeBoutiqueId;
      if (boutiqueId) {
        options = {
          ...options,
          headers: {
            ...(options.headers || {}),
            'X-Boutique-Id': String(boutiqueId),
          },
        };
      }
      return orig(url, options);
    };
    window.authfetch._boutiquePatch = true;
  }

  // ══════════════════════════════════════
  // CHARGEMENT PROPRIÉTAIRE
  // ══════════════════════════════════════
  async function loadBoutiques() {
    try {
      const res = await auth(`${API()}/boutiques`);
      if (!res?.ok) return;
      _boutiques = await res.json();

      const savedId = getActiveBoutiqueId();
      const saved   = _boutiques.find(b => b.id === savedId);
      const primary = _boutiques.find(b => b.is_primary);

      setActiveBoutique(saved || primary || _boutiques[0] || null);
    } catch (err) {
      console.warn('boutique-switcher loadBoutiques:', err.message);
    }
  }

  // ══════════════════════════════════════
  // CHARGEMENT EMPLOYÉ
  // ══════════════════════════════════════
  async function loadEmployeeBoutique() {
    try {
      const res = await auth(`${API()}/members/my-boutique`);
      if (!res?.ok) return;
      const data = await res.json();
      if (!data) return;

      _employeeBoutique = data;
      _isEmployee = true;

      // L'employé a une boutique fixe — on la fixe comme active
      setActiveBoutique({
        id:    data.boutique_id,
        name:  data.boutique_name,
        emoji: data.boutique_emoji || '🏪',
      });

      injectEmployeeBadge(data);
    } catch (err) {
      console.warn('boutique-switcher loadEmployeeBoutique:', err.message);
    }
  }

  // ══════════════════════════════════════
  // BADGE POUR EMPLOYÉS (boutique fixe, non switchable)
  // ══════════════════════════════════════
  function injectEmployeeBadge(data) {
    if (document.getElementById('boutique-employee-badge')) return;

    const header = document.querySelector('.top-header, .header-inner, header');
    if (!header) return;

    const badge = document.createElement('div');
    badge.id = 'boutique-employee-badge';
    badge.style.cssText = `
      display:flex; align-items:center; gap:6px;
      background:rgba(255,255,255,.18); border:1.5px solid rgba(255,255,255,.3);
      color:#fff; padding:5px 10px; border-radius:10px;
      font-family:'Sora',sans-serif; font-size:11px; font-weight:700;
      max-width:160px; overflow:hidden;
    `;
    badge.innerHTML = `
      <span style="font-size:16px;">${data.boutique_emoji || '🏪'}</span>
      <div style="overflow:hidden;">
        <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;">${data.boutique_name || 'Ma Boutique'}</div>
        <div style="font-size:9px;opacity:.75;text-transform:uppercase;letter-spacing:.5px;">${data.role === 'gerant' ? '👑 Gérant' : '👤 Employé'}</div>
      </div>
    `;
    header.insertBefore(badge, header.firstChild);
  }

  // ══════════════════════════════════════
  // SÉLECTEUR POUR PROPRIÉTAIRES (switchable)
  // ══════════════════════════════════════
  function injectSwitcher() {
    if (document.getElementById('boutique-switcher')) return;

    const state = window._subscriptionState;
    if (!state || state.plan !== 'Enterprise') return;

    const header = document.querySelector('.top-header, .header-inner, header');
    if (!header) return;

    const switcher = document.createElement('button');
    switcher.id = 'boutique-switcher';
    switcher.style.cssText = `
      display:flex; align-items:center; gap:6px;
      background:rgba(255,255,255,.15); border:none; color:#fff;
      padding:6px 10px; border-radius:10px; cursor:pointer;
      font-family:'Sora',sans-serif; font-size:12px; font-weight:700;
      max-width:150px; overflow:hidden; transition:background .15s;
    `;
    switcher.innerHTML = `
      <span id="boutique-switcher-emoji">🏪</span>
      <span id="boutique-switcher-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Boutique</span>
      <span style="opacity:.7;font-size:10px;">▼</span>
    `;
    switcher.addEventListener('click', openSwitcherModal);
    header.insertBefore(switcher, header.firstChild);
    updateHeaderDisplay();
  }

  function updateHeaderDisplay() {
    const nameEl  = document.getElementById('boutique-switcher-name');
    const emojiEl = document.getElementById('boutique-switcher-emoji');
    if (!nameEl || !_activeBoutique) return;
    nameEl.textContent  = _activeBoutique.name;
    emojiEl.textContent = _activeBoutique.emoji || '🏪';
  }

  // ══════════════════════════════════════
  // MODAL DE SÉLECTION (propriétaire)
  // ══════════════════════════════════════
  function openSwitcherModal() {
    document.getElementById('boutique-modal')?.remove();

    // ✅ Pas de limite affichée pour Enterprise (Infinity)
    const isEnterprise = window._subscriptionState?.plan === 'Enterprise';
    const canAdd = isEnterprise; // Enterprise = toujours possible d'ajouter

    const modal = document.createElement('div');
    modal.id = 'boutique-modal';
    modal.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,.5);
      z-index:1200; display:flex; align-items:flex-end; justify-content:center; padding:0;
    `;

    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:480px;
                  padding:0 0 env(safe-area-inset-bottom); max-height:85vh;overflow-y:auto;
                  box-shadow:0 -8px 32px rgba(0,0,0,.18);">

        <!-- Header -->
        <div style="padding:16px 20px 12px;display:flex;align-items:center;
                    justify-content:space-between;border-bottom:1px solid #F3F4F6;">
          <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:16px;color:#111;">
            🏪 Mes Boutiques
            <span style="font-size:11px;color:#9CA3AF;font-weight:600;margin-left:6px;">
              (${_boutiques.length} boutique${_boutiques.length > 1 ? 's' : ''})
            </span>
          </div>
          <button onclick="document.getElementById('boutique-modal')?.remove()"
            style="background:none;border:none;font-size:20px;cursor:pointer;color:#9CA3AF;padding:4px;">✕</button>
        </div>

        <!-- Liste boutiques -->
        <div id="boutique-list" style="padding:12px 16px;">
          ${_boutiques.map(b => `
            <div onclick="window._switchBoutique(${b.id})"
              style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;
                     cursor:pointer;margin-bottom:8px;
                     border:2px solid ${b.id === _activeBoutique?.id ? '#7C3AED' : '#F3F4F6'};
                     background:${b.id === _activeBoutique?.id ? '#F5F3FF' : '#fff'};
                     transition:all .15s;">
              <div style="font-size:28px;">${b.emoji || '🏪'}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:800;font-size:14px;color:${b.id === _activeBoutique?.id ? '#7C3AED' : '#111'};
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${b.name}
                  ${b.is_primary ? '<span style="font-size:10px;background:#EDE9FE;color:#7C3AED;padding:2px 6px;border-radius:99px;margin-left:6px;font-weight:700;">Principale</span>' : ''}
                </div>
                <div style="font-size:11px;color:#9CA3AF;margin-top:2px;">
                  ${b.nb_produits || 0} produits · ${b.nb_ventes || 0} ventes · ${b.nb_membres || 0} membres
                </div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                ${b.id === _activeBoutique?.id ? '<span style="color:#7C3AED;font-size:18px;">✓</span>' : ''}
                <button onclick="event.stopPropagation(); window._openBoutiqueMembers(${b.id}, '${b.name.replace(/'/g, "\\'")}', '${b.emoji || '🏪'}')"
                  style="background:#F3F4F6;border:none;border-radius:8px;padding:4px 8px;
                         font-size:11px;cursor:pointer;color:#374151;font-weight:600;">
                  👥 Équipe
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Ajouter boutique -->
        ${canAdd ? `
          <div style="padding:0 16px 16px;">
            <button onclick="window._openNewBoutiqueForm()"
              style="width:100%;padding:13px;background:linear-gradient(135deg,#7C3AED,#EC4899);
                     color:#fff;border:none;border-radius:14px;font-family:'Sora',sans-serif;
                     font-size:14px;font-weight:800;cursor:pointer;">
              ➕ Nouvelle boutique
            </button>
          </div>
        ` : ''}
      </div>
    `;

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  // ══════════════════════════════════════
  // GESTION ÉQUIPE PAR BOUTIQUE
  // ══════════════════════════════════════
  window._openBoutiqueMembers = async (boutiqueId, boutiqueName, boutiqueEmoji) => {
    document.getElementById('boutique-modal')?.remove();

    const loadingEl = document.createElement('div');
    loadingEl.id = 'members-modal';
    loadingEl.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1300;
      display:flex;align-items:flex-end;justify-content:center;
    `;
    loadingEl.innerHTML = `
      <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:480px;
                  padding:24px;max-height:85vh;overflow-y:auto;">
        <div style="text-align:center;padding:40px;color:#9CA3AF;">Chargement…</div>
      </div>
    `;
    document.body.appendChild(loadingEl);

    try {
      const res = await auth(`${API()}/boutiques/${boutiqueId}/members`);
      const members = res?.ok ? await res.json() : [];

      loadingEl.querySelector('div > div').innerHTML = `
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:16px;color:#111;">
              ${boutiqueEmoji} ${boutiqueName}
            </div>
            <div style="font-size:12px;color:#9CA3AF;">Gestion de l'équipe</div>
          </div>
          <button onclick="document.getElementById('members-modal')?.remove()"
            style="background:none;border:none;font-size:20px;cursor:pointer;color:#9CA3AF;">✕</button>
        </div>

        <!-- Liste membres -->
        <div style="margin-bottom:16px;">
          ${members.length === 0
            ? '<div style="text-align:center;padding:24px;color:#9CA3AF;font-size:13px;">Aucun membre dans cette boutique</div>'
            : members.map(m => `
                <div style="display:flex;align-items:center;gap:10px;padding:10px;
                            border-radius:12px;border:1px solid #F3F4F6;margin-bottom:8px;">
                  <div style="width:36px;height:36px;border-radius:50%;
                              background:${m.status === 'accepted' ? '#EDE9FE' : '#FEF3C7'};
                              display:flex;align-items:center;justify-content:center;font-size:16px;">
                    ${m.status === 'accepted' ? '✅' : '⏳'}
                  </div>
                  <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;font-size:13px;color:#111;
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      ${m.email}
                    </div>
                    <div style="font-size:11px;color:#9CA3AF;">
                      ${m.role === 'gerant' ? '👑 Gérant' : '👤 Employé'} ·
                      ${m.status === 'accepted' ? 'Actif' : 'En attente'}
                    </div>
                  </div>
                  <button onclick="window._removeMember(${m.id}, '${m.email.replace(/'/g, "\\'")}')"
                    style="background:#FEF2F2;border:none;border-radius:8px;padding:6px 10px;
                           font-size:11px;cursor:pointer;color:#EF4444;font-weight:600;">
                    Retirer
                  </button>
                </div>
              `).join('')
          }
        </div>

        <!-- Inviter -->
        <button onclick="window._openInviteForm(${boutiqueId}, '${boutiqueName.replace(/'/g, "\\'")}', '${boutiqueEmoji}')"
          style="width:100%;padding:12px;background:linear-gradient(135deg,#7C3AED,#EC4899);
                 color:#fff;border:none;border-radius:14px;font-family:'Sora',sans-serif;
                 font-size:13px;font-weight:800;cursor:pointer;">
          ➕ Inviter un employé
        </button>
      `;
    } catch (err) {
      console.warn('_openBoutiqueMembers:', err.message);
    }

    loadingEl.addEventListener('click', e => { if (e.target === loadingEl) loadingEl.remove(); });
  };

  window._openInviteForm = (boutiqueId, boutiqueName, boutiqueEmoji) => {
    document.getElementById('members-modal')?.remove();

    const form = document.createElement('div');
    form.id = 'invite-form-modal';
    form.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1400;
      display:flex;align-items:center;justify-content:center;padding:20px;
    `;
    form.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:24px;width:100%;max-width:360px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:22px;">${boutiqueEmoji}</span>
          <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:15px;">${boutiqueName}</div>
        </div>
        <div style="font-size:12px;color:#9CA3AF;margin-bottom:20px;">Inviter un membre dans cette boutique</div>

        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Email *</label>
          <input id="inv-email" type="email" placeholder="employe@email.com"
            style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:14px;outline:none;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:16px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Rôle</label>
          <select id="inv-role"
            style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:14px;outline:none;">
            <option value="employe">👤 Employé</option>
            <option value="gerant">👑 Gérant</option>
          </select>
        </div>

        <button onclick="window._sendInvite(${boutiqueId})"
          style="width:100%;padding:13px;background:linear-gradient(135deg,#7C3AED,#EC4899);
                 color:#fff;border:none;border-radius:14px;font-family:'Sora',sans-serif;
                 font-size:14px;font-weight:800;cursor:pointer;margin-bottom:8px;">
          Envoyer l'invitation
        </button>
        <button onclick="document.getElementById('invite-form-modal')?.remove()"
          style="width:100%;padding:10px;background:none;border:none;color:#9CA3AF;cursor:pointer;font-size:13px;">
          Annuler
        </button>
      </div>
    `;
    document.body.appendChild(form);
    document.getElementById('inv-email')?.focus();
  };

  window._sendInvite = async (boutiqueId) => {
    const email = document.getElementById('inv-email')?.value.trim();
    const role  = document.getElementById('inv-role')?.value || 'employe';

    if (!email) { window.showNotification?.('❌ Email requis', 'error'); return; }

    try {
      const res = await auth(`${API()}/members/invite`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        // ✅ On passe boutique_id (boutiques.id) pour l'isolation
        body:    JSON.stringify({ email, role, boutique_id: boutiqueId }),
      });
      const data = await res.json();

      if (!res.ok) {
        window.showNotification?.('❌ ' + (data.error || data.message || 'Erreur'), 'error');
        return;
      }

      document.getElementById('invite-form-modal')?.remove();

      // Afficher le lien d'invitation
      if (data.invite_link) {
        _showInviteLink(data.invite_link, email);
      } else {
        window.showNotification?.(`✅ Invitation envoyée à ${email}`, 'success');
      }
    } catch (err) {
      window.showNotification?.('❌ Erreur réseau', 'error');
    }
  };

  // ✅ _showInviteLink — sans onclick inline (le > de () => cassait la balise)
  function _showInviteLink(link, email) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';

    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:20px;padding:24px;width:100%;max-width:360px;box-sizing:border-box;';

    const icon = document.createElement('div');
    icon.style.cssText = 'text-align:center;font-size:36px;margin-bottom:8px;';
    icon.textContent = '✅';
    card.appendChild(icon);

    const h = document.createElement('div');
    h.style.cssText = "font-family:'Sora',sans-serif;font-weight:800;font-size:16px;text-align:center;margin-bottom:4px;color:#111;";
    h.textContent = 'Invitation créée !';
    card.appendChild(h);

    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:12px;color:#9CA3AF;text-align:center;margin-bottom:16px;';
    sub.textContent = 'Partagez ce lien avec ' + (email || '') + ' · valide 72h';
    card.appendChild(sub);

    const linkBox = document.createElement('div');
    linkBox.style.cssText = 'background:#F5F3FF;border-radius:12px;padding:12px;margin-bottom:16px;';
    const linkTxt = document.createElement('div');
    linkTxt.style.cssText = 'font-size:11px;color:#7C3AED;word-break:break-all;line-height:1.6;font-family:monospace;';
    linkTxt.textContent = link;
    linkBox.appendChild(linkTxt);
    card.appendChild(linkBox);

    const copyBtn = document.createElement('button');
    copyBtn.style.cssText = "width:100%;padding:13px;background:#7C3AED;color:#fff;border:none;border-radius:14px;font-family:'Sora',sans-serif;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:8px;display:block;box-sizing:border-box;";
    copyBtn.textContent = '📋 Copier le lien';
    copyBtn.addEventListener('click', function() {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(link).then(function() {
          copyBtn.textContent = '✅ Copié !';
          setTimeout(function() { copyBtn.textContent = '📋 Copier le lien'; }, 2000);
          window.showNotification?.('📋 Lien copié !', 'success');
        });
      } else {
        const inp = document.createElement('input');
        inp.value = link; inp.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(inp); inp.select();
        try { document.execCommand('copy'); } catch(_) {}
        inp.remove();
        copyBtn.textContent = '✅ Copié !';
        setTimeout(function() { copyBtn.textContent = '📋 Copier le lien'; }, 2000);
      }
    });
    card.appendChild(copyBtn);

    const waBtn = document.createElement('a');
    waBtn.href = 'https://wa.me/?text=' + encodeURIComponent('Rejoignez ma boutique sur Sama Commerce :
' + link);
    waBtn.target = '_blank'; waBtn.rel = 'noopener noreferrer';
    waBtn.style.cssText = "display:block;width:100%;padding:13px;box-sizing:border-box;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border-radius:14px;font-family:'Sora',sans-serif;font-size:14px;font-weight:800;text-align:center;text-decoration:none;margin-bottom:8px;";
    waBtn.textContent = '💬 Envoyer via WhatsApp';
    card.appendChild(waBtn);

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'width:100%;padding:11px;background:#F3F4F6;color:#6B7280;border:none;border-radius:14px;font-size:13px;cursor:pointer;box-sizing:border-box;';
    closeBtn.textContent = 'Fermer';
    closeBtn.addEventListener('click', function() { overlay.remove(); });
    card.appendChild(closeBtn);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  }
  window._removeMember = async (memberId, email) => {
    if (!confirm(`Retirer ${email} de cette boutique ?`)) return;
    try {
      const res = await auth(`${API()}/members/${memberId}`, { method: 'DELETE' });
      if (res?.ok) {
        window.showNotification?.(`✅ ${email} retiré`, 'success');
        document.getElementById('members-modal')?.remove();
      } else {
        window.showNotification?.('❌ Erreur lors du retrait', 'error');
      }
    } catch (err) {
      window.showNotification?.('❌ Erreur réseau', 'error');
    }
  };

  // ══════════════════════════════════════
  // SWITCH DE BOUTIQUE (propriétaire)
  // ══════════════════════════════════════
  window._switchBoutique = async (boutiqueId) => {
    document.getElementById('boutique-modal')?.remove();
    const boutique = _boutiques.find(b => b.id === boutiqueId);
    if (!boutique) return;

    setActiveBoutique(boutique);
    window.showNotification?.(`🏪 ${boutique.name} sélectionnée`, 'success');

    // Recharger les données
    await window.syncFromServer?.();
    window.afficherProduits?.();
    window.afficherCategories?.();
    window.updateStats?.();
  };

  // ══════════════════════════════════════
  // FORMULAIRE NOUVELLE BOUTIQUE
  // ══════════════════════════════════════
  window._openNewBoutiqueForm = () => {
    document.getElementById('boutique-modal')?.remove();

    const form = document.createElement('div');
    form.id = 'new-boutique-form';
    form.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1300;
      display:flex;align-items:center;justify-content:center;padding:20px;
    `;
    form.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:24px;width:100%;max-width:360px;">
        <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:16px;margin-bottom:16px;">➕ Nouvelle boutique</div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Nom *</label>
          <input id="nb-name" type="text" placeholder="Ex: Boutique Centre-Ville"
            style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:14px;outline:none;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Emoji</label>
          <input id="nb-emoji" type="text" placeholder="🏪" maxlength="2"
            style="width:80px;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:18px;text-align:center;outline:none;">
        </div>
        <div style="margin-bottom:16px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Téléphone</label>
          <input id="nb-phone" type="tel" placeholder="+221 77 000 00 00"
            style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:14px;outline:none;box-sizing:border-box;">
        </div>
        <button onclick="window._createBoutique()"
          style="width:100%;padding:13px;background:linear-gradient(135deg,#7C3AED,#EC4899);
                 color:#fff;border:none;border-radius:14px;font-family:'Sora',sans-serif;
                 font-size:14px;font-weight:800;cursor:pointer;margin-bottom:8px;">
          Créer la boutique
        </button>
        <button onclick="document.getElementById('new-boutique-form')?.remove()"
          style="width:100%;padding:10px;background:none;border:none;color:#9CA3AF;cursor:pointer;font-size:13px;">
          Annuler
        </button>
      </div>
    `;
    document.body.appendChild(form);
    document.getElementById('nb-name')?.focus();
  };

  window._createBoutique = async () => {
    const name  = document.getElementById('nb-name')?.value.trim();
    const emoji = document.getElementById('nb-emoji')?.value.trim() || '🏪';
    const phone = document.getElementById('nb-phone')?.value.trim();

    if (!name) { window.showNotification?.('❌ Le nom est requis', 'error'); return; }

    try {
      const res = await auth(`${API()}/boutiques`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, emoji, phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        window.showNotification?.('❌ ' + (data.error || data.message || 'Erreur'), 'error');
        return;
      }

      document.getElementById('new-boutique-form')?.remove();
      await loadBoutiques();
      window._switchBoutique(data.id);
      window.showNotification?.(`✅ Boutique "${name}" créée !`, 'success');
    } catch (err) {
      window.showNotification?.('❌ Erreur réseau', 'error');
    }
  };

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  async function init() {
    if (!window.authfetch) { setTimeout(init, 400); return; }

    patchAuthfetch();

    const checkPlan = async () => {
      const state = window._subscriptionState;
      if (!state) { setTimeout(checkPlan, 500); return; }

      // Détecter si l'utilisateur est un employé
      const role = localStorage.getItem('userRole');

      // Vérifier d'abord si employé (appartient à une boutique d'un autre user)
      try {
        const empRes = await auth(`${API()}/members/my-boutique`);
        if (empRes?.ok) {
          const empData = await empRes.json();
          if (empData?.boutique_id) {
            // C'est un employé → badge fixe
            _employeeBoutique = empData;
            _isEmployee = true;
            setActiveBoutique({
              id:    empData.boutique_id,
              name:  empData.boutique_name,
              emoji: empData.boutique_emoji || '🏪',
            });
            injectEmployeeBadge(empData);
            return;
          }
        }
      } catch (_) {}

      // C'est un propriétaire Enterprise → switcher
      if (state.plan === 'Enterprise' && state.isPaid && !state.isExpired) {
        await loadBoutiques();
        injectSwitcher();
      }
    };

    checkPlan();
  }

  window.boutiqueSwitcher = { reload: loadBoutiques };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
