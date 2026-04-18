/**
 * fix-team-permissions.js — Permissions par lots (v2)
 *
 * Intercepte les modals d'invitation et d'édition de permissions
 * et remplace les 10 toggles individuels par 7 lots groupés.
 *
 * ARCHITECTURE :
 *   - Pré-charge la liste des membres au démarrage (cache synchrone)
 *   - MutationObserver détecte l'ajout des modals de team.js
 *   - Remplace le contenu des permissions en temps réel
 *   - Le lookup de l'ID membre est SYNCHRONE (pas de timing issue)
 *
 * INTÉGRATION : <script src="js/fix-team-permissions.js"></script>
 */

(function () {

  function API() {
    return document.querySelector('meta[name="api-base"]')?.content ||
           'https://samacommerce-backend-v2.onrender.com';
  }

  // ══════════════════════════════════════════════════════════
  // CACHE MEMBRES (chargé au démarrage, synchrone ensuite)
  // ══════════════════════════════════════════════════════════
  var _membersCache = [];

  async function loadMembersCache() {
    try {
      var res = await window.authfetch?.(API() + '/members');
      if (res?.ok) _membersCache = await res.json();
    } catch (e) { /* silent */ }
  }

  function findMemberByName(name) {
    if (!name) return null;
    var clean = name.trim().toLowerCase();
    return _membersCache.find(function (m) {
      return (m.company_name || '').toLowerCase() === clean ||
             (m.email || '').toLowerCase() === clean ||
             (m.company_name || m.email || '').toLowerCase() === clean;
    }) || null;
  }

  // ══════════════════════════════════════════════════════════
  // GROUPEMENTS PAR LOTS
  // ══════════════════════════════════════════════════════════
  var PERM_GROUPS = [
    { id: 'vente',        icon: '💳', label: 'Vente',                desc: 'Vendre, choisir un client, encaisser',                    keys: ['vente'] },
    { id: 'stock',        icon: '📦', label: 'Stock & catégories',   desc: 'Produits, quantités, catégories',                         keys: ['stock', 'categories'] },
    { id: 'rapports',     icon: '📈', label: 'Chiffres & caisse',    desc: 'Rapports, inventaire, clôture de caisse, échéances',      keys: ['rapports', 'caisse'] },
    { id: 'credits',      icon: '📝', label: 'Crédits',              desc: 'Crédits, remboursements, paiements partiels',             keys: ['credits'] },
    { id: 'clients',      icon: '👥', label: 'Clients',              desc: 'Liste clients, fiches, historique',                       keys: ['clients'] },
    { id: 'fournisseurs', icon: '🏭', label: 'Fournisseurs & réappro',desc: 'Fournisseurs, commandes de réapprovisionnement',         keys: ['fournisseurs', 'commandes'] },
    { id: 'livraisons',   icon: '🚚', label: 'Livraisons',           desc: 'Commandes clients, livraisons, livreurs',                keys: ['livraisons'] },
  ];

  // ══════════════════════════════════════════════════════════
  // UI — TOGGLE
  // ══════════════════════════════════════════════════════════
  function makeToggle(id, checked) {
    var lbl = document.createElement('label');
    lbl.style.cssText = 'position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;cursor:pointer;';
    var inp = document.createElement('input');
    inp.type = 'checkbox'; inp.id = id; inp.checked = !!checked;
    inp.style.cssText = 'opacity:0;width:0;height:0;position:absolute;';
    var trk = document.createElement('span');
    trk.style.cssText = 'position:absolute;inset:0;border-radius:12px;background:' + (checked ? '#7C3AED' : '#E5E7EB') + ';transition:background .2s;';
    var dot = document.createElement('span');
    dot.style.cssText = 'position:absolute;left:' + (checked ? '22' : '2') + 'px;top:2px;width:20px;height:20px;background:#fff;border-radius:50%;transition:left .2s;box-shadow:0 1px 4px rgba(0,0,0,.2);';
    inp.addEventListener('change', function () {
      trk.style.background = inp.checked ? '#7C3AED' : '#E5E7EB';
      dot.style.left = inp.checked ? '22px' : '2px';
    });
    lbl.appendChild(inp); lbl.appendChild(trk); lbl.appendChild(dot);
    return lbl;
  }

  // ══════════════════════════════════════════════════════════
  // UI — LIGNES DE PERMISSIONS GROUPÉES
  // ══════════════════════════════════════════════════════════
  function buildGroupRows(container, prefix, perms) {
    perms = perms || {};
    container.innerHTML =
      '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px;">Accès autorisés</div>' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:12px;">L\'employé ne verra QUE les sections activées</div>';

    PERM_GROUPS.forEach(function (g) {
      var isOn = g.keys.every(function (k) { return !!perms[k]; });

      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.05);';
      row.innerHTML =
        '<div style="width:36px;height:36px;border-radius:10px;background:#F5F3FF;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">' + g.icon + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13px;font-weight:700;color:var(--text);">' + g.label + '</div>' +
          '<div style="font-size:11px;color:var(--muted);line-height:1.4;margin-top:1px;">' + g.desc + '</div>' +
        '</div>';
      row.appendChild(makeToggle(prefix + g.id, isOn));
      container.appendChild(row);
    });
  }

  function collectPerms(container, prefix) {
    var perms = {};
    PERM_GROUPS.forEach(function (g) {
      var t = container.querySelector('#' + prefix + g.id);
      var on = t ? t.checked : false;
      g.keys.forEach(function (k) { perms[k] = on; });
    });
    return perms;
  }

  function readOldPerms(container) {
    var perms = {};
    ['vente','stock','categories','rapports','caisse','credits','clients','fournisseurs','commandes','livraisons'].forEach(function (k) {
      var t = container.querySelector('#perm-' + k + ', #ep-' + k);
      if (t) perms[k] = t.checked;
    });
    return perms;
  }

  function setAllGroupToggles(container, prefix, state) {
    PERM_GROUPS.forEach(function (g) {
      var t = container.querySelector('#' + prefix + g.id);
      if (t) { t.checked = state; t.dispatchEvent(new Event('change')); }
    });
  }

  // ══════════════════════════════════════════════════════════
  // INTERCEPTER LES MODALS VIA MUTATIONOBSERVER
  // ══════════════════════════════════════════════════════════
  function watchModals() {
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (!node.classList?.contains('module-sheet-backdrop')) return;

          var title = node.querySelector('.module-sheet-title');
          if (!title) return;
          var txt = title.textContent || '';

          if (txt.includes('Inviter')) {
            setTimeout(function () { patchInviteModal(node); }, 30);
          } else if (txt.includes('Permissions')) {
            setTimeout(function () { patchEditModal(node, txt); }, 30);
          }
        });
      });
    }).observe(document.body, { childList: true });
  }

  // ══════════════════════════════════════════════════════════
  // PATCH MODAL INVITATION
  // ══════════════════════════════════════════════════════════
  function patchInviteModal(modal) {
    var wrap = modal.querySelector('#inv-perms-wrap');
    if (!wrap || wrap.dataset.g) return;
    wrap.dataset.g = '1';

    var oldPerms = readOldPerms(wrap);
    buildGroupRows(wrap, 'ig-', oldPerms);

    // Gérant = tout cocher
    var role = modal.querySelector('#inv-role');
    if (role) {
      role.addEventListener('change', function () {
        setAllGroupToggles(wrap, 'ig-', role.value === 'gerant');
      });
    }

    // Remplacer le bouton Envoyer
    var oldBtn = modal.querySelector('#inv-send');
    if (!oldBtn) return;
    var newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);

    newBtn.addEventListener('click', async function () {
      var email = modal.querySelector('#inv-email')?.value.trim();
      var roleVal = modal.querySelector('#inv-role')?.value || 'employe';
      if (!email) { window.showNotification?.('Email requis', 'warning'); return; }

      var permissions = collectPerms(wrap, 'ig-');
      newBtn.disabled = true; newBtn.textContent = '⏳ Envoi…';

      try {
        var bid = localStorage.getItem('sc_active_boutique');
        var isPrimary = localStorage.getItem('sc_active_boutique_is_primary') === '1' || !window._activeBoutiqueId;
        var boutiqueId = (bid && !isPrimary) ? parseInt(bid) : null;

        var res = await window.authfetch?.(API() + '/members/invite', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, role: roleVal, permissions: permissions, boutique_id: boutiqueId }),
        });
        if (!res?.ok) { var e = await res?.json?.().catch(function(){return {};}); throw new Error(e.error || res.status); }

        var data = await res.json();
        window.showNotification?.('✅ Invitation envoyée à ' + email, 'success');
        modal.remove();
        if (data.invite_link) showLinkModal(data.invite_link, email);
        window.teamModule?.load?.();
        loadMembersCache(); // refresh cache
      } catch (err) {
        window.showNotification?.(String(err.message).includes('400') ? 'Email déjà invité ou quota atteint' : 'Erreur', 'error');
        newBtn.disabled = false; newBtn.textContent = 'Envoyer l\'invitation';
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  // PATCH MODAL ÉDITION
  // ══════════════════════════════════════════════════════════
  function patchEditModal(modal, titleText) {
    var wrap = modal.querySelector('#ep-perms-wrap');
    if (!wrap || wrap.dataset.g) return;
    wrap.dataset.g = '1';

    // Extraire le nom du membre depuis le titre "⚙️ Permissions — NomMembre"
    var memberName = titleText.replace(/⚙️\s*Permissions\s*—\s*/, '').trim();

    // Lookup SYNCHRONE dans le cache
    var member = findMemberByName(memberName);

    if (!member) {
      // Fallback : recharger le cache et réessayer
      loadMembersCache().then(function () {
        member = findMemberByName(memberName);
        if (member) finishPatchEdit(modal, wrap, member);
        else console.warn('Membre introuvable dans le cache:', memberName);
      });
      // En attendant, on affiche quand même les lots
      var oldPerms = readOldPerms(wrap);
      buildGroupRows(wrap, 'eg-', oldPerms);
      return;
    }

    finishPatchEdit(modal, wrap, member);
  }

  function finishPatchEdit(modal, wrap, member) {
    // Construire les rows avec les permissions actuelles du membre
    var perms = member.permissions || {};
    if (typeof perms === 'string') { try { perms = JSON.parse(perms); } catch(e) { perms = {}; } }
    buildGroupRows(wrap, 'eg-', perms);

    // Remplacer le bouton Enregistrer
    var oldBtn = modal.querySelector('#ep-save');
    if (!oldBtn) return;
    var newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);

    newBtn.addEventListener('click', async function () {
      var permissions = collectPerms(wrap, 'eg-');
      newBtn.disabled = true; newBtn.textContent = '⏳ Sauvegarde…';

      try {
        var res = await window.authfetch?.(API() + '/members/' + member.id, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions: permissions }),
        });
        if (!res?.ok) throw new Error('Erreur');

        window.showNotification?.('✅ Permissions mises à jour', 'success');
        window.haptic?.success();
        modal.remove();
        window.teamModule?.load?.();
        loadMembersCache(); // refresh cache
      } catch (e) {
        window.showNotification?.('Erreur mise à jour permissions', 'error');
        newBtn.disabled = false; newBtn.textContent = 'Enregistrer';
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  // MODAL LIEN D'INVITATION
  // ══════════════════════════════════════════════════════════
  function showLinkModal(link, email) {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    var wa = encodeURIComponent('Vous êtes invité à rejoindre ma boutique sur Sama Commerce :\n' + link);
    ov.innerHTML =
      '<div style="background:#fff;border-radius:20px;padding:24px;max-width:360px;width:100%;text-align:center;">' +
        '<div style="font-size:28px;margin-bottom:6px;">✅</div>' +
        '<div style="font-family:Sora,sans-serif;font-weight:800;font-size:15px;margin-bottom:4px;">Invitation créée !</div>' +
        '<div style="font-size:12px;color:#6B7280;margin-bottom:16px;">Partagez avec ' + esc(email) + ' (valide 72h)</div>' +
        '<div style="background:#F5F3FF;border-radius:12px;padding:12px;margin-bottom:14px;">' +
          '<div style="font-size:11px;color:#7C3AED;word-break:break-all;line-height:1.5;font-family:monospace;">' + esc(link) + '</div>' +
        '</div>' +
        '<button id="ftp-c" style="width:100%;padding:13px;background:#7C3AED;color:#fff;border:none;border-radius:14px;font-family:Sora,sans-serif;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:8px;">📋 Copier le lien</button>' +
        '<a href="https://wa.me/?text=' + wa + '" target="_blank" rel="noopener" style="display:block;width:100%;padding:13px;box-sizing:border-box;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border-radius:14px;font-family:Sora,sans-serif;font-size:14px;font-weight:800;text-align:center;text-decoration:none;margin-bottom:8px;">💬 WhatsApp</a>' +
        '<button id="ftp-x" style="width:100%;padding:11px;background:#F3F4F6;color:#6B7280;border:none;border-radius:14px;font-size:13px;cursor:pointer;">Fermer</button>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    ov.querySelector('#ftp-x').addEventListener('click', function () { ov.remove(); });
    ov.querySelector('#ftp-c').addEventListener('click', function () {
      navigator.clipboard?.writeText(link).then(function () {
        ov.querySelector('#ftp-c').textContent = '✅ Copié !';
        window.showNotification?.('📋 Lien copié !', 'success');
      }).catch(function () {
        var i = document.createElement('input'); i.value = link;
        document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove();
        ov.querySelector('#ftp-c').textContent = '✅ Copié !';
      });
    });
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  // ══════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════
  function init() {
    loadMembersCache();
    watchModals();

    // Recharger le cache quand on navigue vers la section équipe
    window.addEventListener('pageChange', function (e) {
      if (e.detail?.key === 'team') loadMembersCache();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 800); });
  } else {
    setTimeout(init, 800);
  }

})();
