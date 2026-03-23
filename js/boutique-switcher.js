/**
 * boutique-switcher.js — v4
 *
 * Corrections :
 *  - Boutique principale → pas de X-Boutique-Id → cumul de toutes les boutiques
 *  - window.currentSection tracké en interceptant window.showSection
 *  - reloadAllSections : reset _sectionInit + showSection(currentSection)
 *    → déclenche pageChange pour clients/caisse/fournisseurs/etc.
 *  - Sync entre onglets via storage event
 */
(function () {
  const API  = () => document.querySelector('meta[name="api-base"]')?.content
                  || 'https://samacommerce-backend-v2.onrender.com';
  const auth = (url, o = {}) => window.authfetch?.(url, o);
  const KEY  = 'sc_active_boutique';

  let _boutiques      = [];
  let _activeBoutique = null;
  let _isEmployee     = false;
  let _currentSection = 'menu'; // ✅ tracké localement

  // ══════════════════════════════════════════════
  // TRACKER LA SECTION COURANTE
  // Patch window.showSection dès qu'il est disponible
  // ══════════════════════════════════════════════
  function patchShowSection() {
    const orig = window.showSection;
    if (!orig || orig._boutiqueTracked) return;
    window.showSection = function (section, ...args) {
      _currentSection = section || _currentSection;
      return orig(section, ...args);
    };
    window.showSection._boutiqueTracked = true;
    // Recopier les propriétés de l'original si besoin
  }

  // Réessayer jusqu'à ce que showSection soit disponible
  function waitAndPatchShowSection() {
    if (window.showSection) { patchShowSection(); return; }
    setTimeout(waitAndPatchShowSection, 200);
  }
  waitAndPatchShowSection();

  // ══════════════════════════════════════════════
  // ÉTAT ACTIF — STOCKAGE
  // ══════════════════════════════════════════════
  function setActiveBoutique(boutique) {
    _activeBoutique = boutique;

    if (boutique?.id) {
      localStorage.setItem(KEY, String(boutique.id));
      // ✅ Stocker is_primary pour que api.js sache s'il faut envoyer le header
      localStorage.setItem(KEY + '_is_primary', boutique.is_primary ? '1' : '0');

      // Boutique principale → pas de X-Boutique-Id (vue cumulative)
      // Boutique secondaire → X-Boutique-Id = boutique.id (vue isolée)
      window._activeBoutiqueId        = boutique.is_primary ? null : boutique.id;
      window._activeBoutiqueIsPrimary = boutique.is_primary || false;
    } else {
      localStorage.removeItem(KEY);
      localStorage.removeItem(KEY + '_is_primary');
      window._activeBoutiqueId        = null;
      window._activeBoutiqueIsPrimary = true;
    }

    updateHeaderDisplay();
    window.dispatchEvent(new CustomEvent('boutique:changed', { detail: boutique }));
  }

  function getActiveBoutiqueId() {
    return parseInt(localStorage.getItem(KEY) || '0') || null;
  }

  // ══════════════════════════════════════════════
  // RECHARGEMENT COMPLET — SANS REFRESH DE PAGE
  // ══════════════════════════════════════════════
  async function reloadAllSections() {
    const boutiqueName = _activeBoutique?.name || '';

    // Bannière de chargement
    const syncBanner = document.getElementById('syncBanner');
    if (syncBanner) {
      syncBanner.textContent = `🔄 ${boutiqueName || 'Chargement'}…`;
      syncBanner.style.display = 'block';
    }

    try {
      // ① Resync données (categories, produits, ventes, stats)
      //    authfetch envoie automatiquement le bon X-Boutique-Id
      await window.syncFromServer?.();

      // ② Reset le cache lazy-init pour que showSection réinitialise tout
      window._sectionInit = {};

      // ③ Rerender les sections de base (menu, vente, stock)
      window.updateStats?.();
      window.afficherProduits?.();
      window.afficherCategories?.();
      window.afficherCategoriesVente?.();
      window.verifierStockFaible?.();
      window.afficherCredits?.();

      // ④ Rerender la section courante + dispatch pageChange
      //    pageChange déclenche le rechargement dans :
      //    clients.js, caisse.js, fournisseurs.js, commandes.js,
      //    deliveries.js, customerOrders.js, livraisons.js, etc.
      window.showSection?.(_currentSection || 'menu');

      // ⑤ Widgets transversaux
      window.scNotifications?.check?.();
      window._loadAlerts?.();
      window.dailyGoal?.reload?.();

    } catch (err) {
      console.warn('reloadAllSections error:', err.message);
    } finally {
      if (syncBanner) syncBanner.style.display = 'none';
    }
  }

  // ══════════════════════════════════════════════
  // SWITCH DE BOUTIQUE
  // ══════════════════════════════════════════════
  window._switchBoutique = async (boutiqueId) => {
    document.getElementById('boutique-modal')?.remove();

    const boutique = _boutiques.find(b => b.id === boutiqueId);
    if (!boutique) return;

    // Pas de changement → ignorer
    if (boutique.id === _activeBoutique?.id) return;

    // ① Changer l'état immédiatement (authfetch lit localStorage)
    setActiveBoutique(boutique);

    // ② Notification
    const label = boutique.is_primary ? `🏪 ${boutique.name} (toutes boutiques)` : `🏪 ${boutique.name}`;
    window.showNotification?.(label, 'success');

    // ③ Recharger toutes les données + sections
    await reloadAllSections();
  };

  // ══════════════════════════════════════════════
  // AFFICHAGE HEADER
  // ══════════════════════════════════════════════
  function updateHeaderDisplay() {
    const nameEl  = document.getElementById('boutique-switcher-name');
    const emojiEl = document.getElementById('boutique-switcher-emoji');
    if (nameEl)  nameEl.textContent  = _activeBoutique?.name  || 'Boutique';
    if (emojiEl) emojiEl.textContent = _activeBoutique?.emoji || '🏪';

    // Badge flash de confirmation
    const badge = document.getElementById('boutique-active-badge');
    if (badge && _activeBoutique) {
      const suffix = _activeBoutique.is_primary ? ' · Toutes boutiques' : '';
      badge.textContent = `${_activeBoutique.emoji || '🏪'} ${_activeBoutique.name}${suffix}`;
      badge.style.opacity = '1';
      clearTimeout(badge._t);
      badge._t = setTimeout(() => { badge.style.opacity = '0'; }, 2500);
    }
  }

  // ══════════════════════════════════════════════
  // CHARGEMENT LISTE DES BOUTIQUES
  // ══════════════════════════════════════════════
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
      console.warn('loadBoutiques:', err.message);
    }
  }

  // ══════════════════════════════════════════════
  // INJECTION DU SWITCHER DANS LE HEADER
  // ══════════════════════════════════════════════
  function injectSwitcher() {
    if (document.getElementById('boutique-switcher')) return;

    const header = document.querySelector('.top-header, .header-inner, header');
    if (!header) return;

    // Badge confirmation (flash au switch)
    if (!document.getElementById('boutique-active-badge')) {
      const badge = document.createElement('div');
      badge.id = 'boutique-active-badge';
      badge.style.cssText = `
        position:fixed; top:60px; left:50%; transform:translateX(-50%);
        background:rgba(124,58,237,.95); color:#fff; padding:6px 16px;
        border-radius:99px; font-family:'Sora',sans-serif; font-size:12px;
        font-weight:700; z-index:9999; opacity:0; transition:opacity .3s;
        pointer-events:none; box-shadow:0 4px 12px rgba(124,58,237,.4);
        white-space:nowrap;
      `;
      document.body.appendChild(badge);
    }

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

  // ══════════════════════════════════════════════
  // BADGE EMPLOYÉ
  // ══════════════════════════════════════════════
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

  // ══════════════════════════════════════════════
  // MODAL DE SÉLECTION DES BOUTIQUES
  // ══════════════════════════════════════════════
  function openSwitcherModal() {
    document.getElementById('boutique-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'boutique-modal';
    modal.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,.5);
      z-index:1200; display:flex; align-items:flex-end; justify-content:center;
    `;

    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:480px;
                  padding:0 0 env(safe-area-inset-bottom); max-height:85vh;overflow-y:auto;
                  box-shadow:0 -8px 32px rgba(0,0,0,.18);">
        <div style="padding:16px 20px 12px;display:flex;align-items:center;
                    justify-content:space-between;border-bottom:1px solid #F3F4F6;position:sticky;top:0;background:#fff;z-index:1;">
          <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:16px;color:#111;">
            🏪 Mes Boutiques
            <span style="font-size:11px;color:#9CA3AF;font-weight:600;margin-left:6px;">(${_boutiques.length})</span>
          </div>
          <button onclick="document.getElementById('boutique-modal')?.remove()"
            style="background:none;border:none;font-size:20px;cursor:pointer;color:#9CA3AF;">✕</button>
        </div>

        <div style="padding:12px 16px;">
          ${_boutiques.map(b => `
            <div onclick="window._switchBoutique(${b.id})"
              style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;
                     cursor:pointer;margin-bottom:8px;
                     border:2px solid ${b.id === _activeBoutique?.id ? '#7C3AED' : '#F3F4F6'};
                     background:${b.id === _activeBoutique?.id ? '#F5F3FF' : '#fff'};
                     transition:all .15s;">
              <div style="font-size:28px;">${b.emoji || '🏪'}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:800;font-size:14px;
                            color:${b.id === _activeBoutique?.id ? '#7C3AED' : '#111'};
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${b.name}
                  ${b.is_primary
                    ? '<span style="font-size:10px;background:#EDE9FE;color:#7C3AED;padding:2px 6px;border-radius:99px;margin-left:4px;">Principale</span>'
                    : ''}
                </div>
                <div style="font-size:11px;color:#9CA3AF;margin-top:2px;">
                  ${b.is_primary
                    ? '📊 Cumul de toutes les boutiques'
                    : `${b.nb_produits || 0} produits · ${b.nb_ventes || 0} ventes · ${b.nb_membres || 0} membres`}
                </div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
                ${b.id === _activeBoutique?.id ? '<span style="color:#7C3AED;font-size:18px;">✓</span>' : ''}
                ${!b.is_primary ? `
                  <button onclick="event.stopPropagation();window._openBoutiqueMembers(${b.id},'${(b.name||'').replace(/'/g,"\\'")}','${b.emoji||'🏪'}')"
                    style="background:#F3F4F6;border:none;border-radius:8px;padding:4px 8px;
                           font-size:11px;cursor:pointer;color:#374151;font-weight:600;">
                    👥 Équipe
                  </button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        <div style="padding:0 16px 16px;">
          <button onclick="window._openNewBoutiqueForm()"
            style="width:100%;padding:13px;background:linear-gradient(135deg,#7C3AED,#EC4899);
                   color:#fff;border:none;border-radius:14px;font-family:'Sora',sans-serif;
                   font-size:14px;font-weight:800;cursor:pointer;">
            ➕ Nouvelle boutique
          </button>
        </div>
      </div>
    `;

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  // ══════════════════════════════════════════════
  // GESTION ÉQUIPE PAR BOUTIQUE
  // ══════════════════════════════════════════════
  window._openBoutiqueMembers = async (boutiqueId, boutiqueName, boutiqueEmoji) => {
    document.getElementById('boutique-modal')?.remove();

    const el = document.createElement('div');
    el.id = 'members-modal';
    el.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1300;
      display:flex;align-items:flex-end;justify-content:center;`;
    el.innerHTML = `<div style="background:#fff;border-radius:20px 20px 0 0;width:100%;
      max-width:480px;padding:24px;max-height:85vh;overflow-y:auto;">
      <div style="text-align:center;padding:40px;color:#9CA3AF;">Chargement…</div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });

    try {
      const res     = await auth(`${API()}/boutiques/${boutiqueId}/members`);
      const members = res?.ok ? await res.json() : [];

      el.querySelector('div > div').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:16px;">${boutiqueEmoji} ${boutiqueName}</div>
            <div style="font-size:12px;color:#9CA3AF;">Gestion de l'équipe</div>
          </div>
          <button onclick="document.getElementById('members-modal')?.remove()"
            style="background:none;border:none;font-size:20px;cursor:pointer;color:#9CA3AF;">✕</button>
        </div>
        <div style="margin-bottom:16px;">
          ${members.length === 0
            ? '<div style="text-align:center;padding:24px;color:#9CA3AF;font-size:13px;">Aucun membre</div>'
            : members.map(m => `
              <div style="display:flex;align-items:center;gap:10px;padding:10px;
                          border-radius:12px;border:1px solid #F3F4F6;margin-bottom:8px;">
                <div style="width:36px;height:36px;border-radius:50%;
                            background:${m.status==='accepted'?'#EDE9FE':'#FEF3C7'};
                            display:flex;align-items:center;justify-content:center;font-size:16px;">
                  ${m.status==='accepted'?'✅':'⏳'}
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.email}</div>
                  <div style="font-size:11px;color:#9CA3AF;">${m.role==='gerant'?'👑 Gérant':'👤 Employé'} · ${m.status==='accepted'?'Actif':'En attente'}</div>
                </div>
                <button onclick="window._removeMember(${m.id},'${m.email.replace(/'/g,"\\'")}')"
                  style="background:#FEF2F2;border:none;border-radius:8px;padding:6px 10px;font-size:11px;cursor:pointer;color:#EF4444;font-weight:600;">
                  Retirer
                </button>
              </div>`).join('')}
        </div>
        <button onclick="window._openInviteForm(${boutiqueId},'${boutiqueName.replace(/'/g,"\\'")}','${boutiqueEmoji}')"
          style="width:100%;padding:12px;background:linear-gradient(135deg,#7C3AED,#EC4899);
                 color:#fff;border:none;border-radius:14px;font-family:'Sora',sans-serif;
                 font-size:13px;font-weight:800;cursor:pointer;">
          ➕ Inviter un employé
        </button>`;
    } catch (_) {}
  };

  window._openInviteForm = (boutiqueId, boutiqueName, boutiqueEmoji) => {
    document.getElementById('members-modal')?.remove();
    const form = document.createElement('div');
    form.id = 'invite-form-modal';
    form.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1400;
      display:flex;align-items:center;justify-content:center;padding:20px;`;
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
      </div>`;
    document.body.appendChild(form);
    setTimeout(() => document.getElementById('inv-email')?.focus(), 100);
  };

  window._sendInvite = async (boutiqueId) => {
    const email = document.getElementById('inv-email')?.value.trim();
    const role  = document.getElementById('inv-role')?.value || 'employe';
    if (!email) { window.showNotification?.('❌ Email requis', 'error'); return; }
    try {
      const res  = await auth(`${API()}/members/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, boutique_id: boutiqueId }),
      });
      const data = await res.json();
      if (!res.ok) { window.showNotification?.('❌ ' + (data.error || data.message), 'error'); return; }
      document.getElementById('invite-form-modal')?.remove();
      _showInviteLink(data.invite_link, email);
    } catch (_) { window.showNotification?.('❌ Erreur réseau', 'error'); }
  };

  function _showInviteLink(link, email) {
    if (!link) { window.showNotification?.('✅ Invitation envoyée !', 'success'); return; }
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1500;
      display:flex;align-items:center;justify-content:center;padding:20px;`;
    el.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:24px;width:100%;max-width:360px;">
        <div style="font-size:32px;text-align:center;margin-bottom:8px;">✅</div>
        <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:15px;text-align:center;margin-bottom:4px;">Invitation créée !</div>
        <div style="font-size:12px;color:#9CA3AF;text-align:center;margin-bottom:16px;">Partagez ce lien avec ${email}</div>
        <div style="background:#F5F3FF;border-radius:10px;padding:10px;margin-bottom:16px;
                    font-size:11px;color:#7C3AED;word-break:break-all;line-height:1.5;">${link}</div>
        <button onclick="navigator.clipboard?.writeText(${JSON.stringify(link)}).then(()=>window.showNotification?.('✅ Lien copié !','success'))"
          style="width:100%;padding:12px;background:#7C3AED;color:#fff;border:none;
                 border-radius:14px;font-weight:800;cursor:pointer;margin-bottom:8px;font-size:14px;">
          📋 Copier le lien
        </button>
        <button onclick="this.closest('[style]').remove()"
          style="width:100%;padding:10px;background:none;border:none;color:#9CA3AF;cursor:pointer;font-size:13px;">
          Fermer
        </button>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });
  }

  window._removeMember = async (memberId, email) => {
    if (!confirm(`Retirer ${email} de cette boutique ?`)) return;
    const res = await auth(`${API()}/members/${memberId}`, { method: 'DELETE' });
    if (res?.ok) {
      window.showNotification?.(`✅ ${email} retiré`, 'success');
      document.getElementById('members-modal')?.remove();
    } else {
      window.showNotification?.('❌ Erreur lors du retrait', 'error');
    }
  };

  window._openNewBoutiqueForm = () => {
    document.getElementById('boutique-modal')?.remove();
    const form = document.createElement('div');
    form.id = 'new-boutique-form';
    form.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1300;
      display:flex;align-items:center;justify-content:center;padding:20px;`;
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
      </div>`;
    document.body.appendChild(form);
    setTimeout(() => document.getElementById('nb-name')?.focus(), 100);
  };

  window._createBoutique = async () => {
    const name  = document.getElementById('nb-name')?.value.trim();
    const emoji = document.getElementById('nb-emoji')?.value.trim() || '🏪';
    const phone = document.getElementById('nb-phone')?.value.trim();
    if (!name) { window.showNotification?.('❌ Le nom est requis', 'error'); return; }
    try {
      const res  = await auth(`${API()}/boutiques`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emoji, phone }),
      });
      const data = await res.json();
      if (!res.ok) { window.showNotification?.('❌ ' + (data.error || data.message), 'error'); return; }
      document.getElementById('new-boutique-form')?.remove();
      await loadBoutiques();
      window._switchBoutique(data.id);
    } catch (_) { window.showNotification?.('❌ Erreur réseau', 'error'); }
  };

  // ══════════════════════════════════════════════
  // SYNC ENTRE ONGLETS
  // ══════════════════════════════════════════════
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && e.newValue) {
      const newId   = parseInt(e.newValue);
      const current = parseInt(localStorage.getItem(KEY) || '0');
      if (newId && newId !== current) {
        const boutique = _boutiques.find(b => b.id === newId);
        if (boutique) window._switchBoutique(newId);
      }
    }
  });

  // ══════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════
  async function init() {
    if (!window.authfetch) { setTimeout(init, 400); return; }

    const checkPlan = async () => {
      const state = window._subscriptionState;
      if (!state) { setTimeout(checkPlan, 500); return; }

      // Vérifier si l'utilisateur est un employé
      try {
        const empRes = await auth(`${API()}/members/my-boutique`);
        if (empRes?.ok) {
          const empData = await empRes.json();
          if (empData?.boutique_id) {
            _isEmployee = true;
            setActiveBoutique({
              id:         empData.boutique_id,
              name:       empData.boutique_name,
              emoji:      empData.boutique_emoji || '🏪',
              is_primary: false,
            });
            injectEmployeeBadge(empData);
            return;
          }
        }
      } catch (_) {}

      // Propriétaire Enterprise → switcher
      if (state.plan === 'Enterprise' && state.isPaid && !state.isExpired) {
        await loadBoutiques();
        injectSwitcher();
      }
    };

    checkPlan();
  }

  window.boutiqueSwitcher = { reload: loadBoutiques, reloadAll: reloadAllSections };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
