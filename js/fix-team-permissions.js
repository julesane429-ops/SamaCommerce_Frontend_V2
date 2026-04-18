/**
 * fix-team-permissions.js — Permissions par lots
 *
 * Intercepte les modals d'invitation et d'édition de permissions
 * (créés par team.js dans un closure inaccessible) et remplace
 * les 10 toggles individuels par 7 lots groupés.
 *
 * Technique : MutationObserver sur document.body détecte l'ajout
 * des .module-sheet-backdrop et remplace le contenu #inv-perms-wrap
 * ou #ep-perms-wrap.
 *
 * INTÉGRATION : <script src="js/fix-team-permissions.js"></script>
 *   (charger APRÈS team.js)
 */

(function () {

  // ══════════════════════════════════════════════════════════
  // GROUPEMENTS PAR LOTS
  // ══════════════════════════════════════════════════════════
  var PERM_GROUPS = [
    {
      id: 'vente',
      icon: '💳',
      label: 'Vente',
      desc: 'Vendre, choisir un client, encaisser par tous les moyens',
      keys: ['vente'],
    },
    {
      id: 'stock',
      icon: '📦',
      label: 'Stock & catégories',
      desc: 'Produits, quantités, catégories',
      keys: ['stock', 'categories'],
    },
    {
      id: 'rapports',
      icon: '📈',
      label: 'Chiffres & caisse',
      desc: 'Rapports, inventaire, clôture de caisse, échéances',
      keys: ['rapports', 'caisse'],
    },
    {
      id: 'credits',
      icon: '📝',
      label: 'Crédits',
      desc: 'Crédits, remboursements, paiements partiels',
      keys: ['credits'],
    },
    {
      id: 'clients',
      icon: '👥',
      label: 'Clients',
      desc: 'Liste clients, fiches, historique d\'achats',
      keys: ['clients'],
    },
    {
      id: 'fournisseurs',
      icon: '🏭',
      label: 'Fournisseurs & réappro',
      desc: 'Fournisseurs, commandes de réapprovisionnement',
      keys: ['fournisseurs', 'commandes'],
    },
    {
      id: 'livraisons',
      icon: '🚚',
      label: 'Livraisons',
      desc: 'Commandes clients, livraisons, livreurs',
      keys: ['livraisons'],
    },
  ];

  // ══════════════════════════════════════════════════════════
  // CONSTRUIRE UN TOGGLE
  // ══════════════════════════════════════════════════════════
  function makeToggle(id, checked) {
    var label = document.createElement('label');
    label.style.cssText = 'position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;cursor:pointer;';

    var input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = !!checked;
    input.style.cssText = 'opacity:0;width:0;height:0;position:absolute;';

    var track = document.createElement('span');
    track.style.cssText = 'position:absolute;inset:0;border-radius:12px;background:' + (checked ? 'var(--primary,#7C3AED)' : '#E5E7EB') + ';transition:background .2s;';

    var dot = document.createElement('span');
    dot.style.cssText = 'position:absolute;left:' + (checked ? '22px' : '2px') + ';top:2px;width:20px;height:20px;background:#fff;border-radius:50%;transition:left .2s;box-shadow:0 1px 4px rgba(0,0,0,.2);';

    input.addEventListener('change', function () {
      track.style.background = input.checked ? 'var(--primary,#7C3AED)' : '#E5E7EB';
      dot.style.left = input.checked ? '22px' : '2px';
    });

    label.appendChild(input);
    label.appendChild(track);
    label.appendChild(dot);
    return label;
  }

  // ══════════════════════════════════════════════════════════
  // CONSTRUIRE LES LIGNES DE PERMISSIONS PAR LOTS
  // ══════════════════════════════════════════════════════════
  function buildGroupedPerms(container, prefix, existingPerms) {
    existingPerms = existingPerms || {};
    container.innerHTML = '';

    // Titre
    var title = document.createElement('div');
    title.style.cssText = 'font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px;';
    title.textContent = 'Accès autorisés';
    container.appendChild(title);

    var subtitle = document.createElement('div');
    subtitle.style.cssText = 'font-size:11px;color:var(--muted);margin-bottom:12px;';
    subtitle.textContent = 'L\'employé ne verra QUE les sections activées';
    container.appendChild(subtitle);

    PERM_GROUPS.forEach(function (group) {
      // Déterminer si le lot est actif
      var isOn = group.keys.every(function (k) { return !!existingPerms[k]; });

      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.05);';

      var icon = document.createElement('div');
      icon.style.cssText = 'width:36px;height:36px;border-radius:10px;background:#F5F3FF;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;';
      icon.textContent = group.icon;

      var text = document.createElement('div');
      text.style.cssText = 'flex:1;min-width:0;';
      text.innerHTML =
        '<div style="font-size:13px;font-weight:700;color:var(--text);">' + esc(group.label) + '</div>' +
        '<div style="font-size:11px;color:var(--muted);line-height:1.4;margin-top:1px;">' + esc(group.desc) + '</div>';

      row.appendChild(icon);
      row.appendChild(text);
      row.appendChild(makeToggle(prefix + group.id, isOn));

      container.appendChild(row);
    });
  }

  // ══════════════════════════════════════════════════════════
  // COLLECTER LES PERMISSIONS DEPUIS LES LOTS
  // ══════════════════════════════════════════════════════════
  function collectGroupedPerms(container, prefix) {
    var perms = {};
    PERM_GROUPS.forEach(function (group) {
      var toggle = container.querySelector('#' + prefix + group.id);
      var isOn = toggle ? toggle.checked : false;
      group.keys.forEach(function (key) { perms[key] = isOn; });
    });
    return perms;
  }

  // ══════════════════════════════════════════════════════════
  // LIRE LES PERMISSIONS EXISTANTES DEPUIS LES ANCIENS TOGGLES
  // ══════════════════════════════════════════════════════════
  function readOldToggles(container, prefix) {
    var perms = {};
    var keys = ['vente','stock','categories','rapports','caisse','credits','clients','fournisseurs','commandes','livraisons'];
    keys.forEach(function (k) {
      var toggle = container.querySelector('#' + prefix + k);
      if (toggle) perms[k] = toggle.checked;
    });
    return perms;
  }

  // ══════════════════════════════════════════════════════════
  // INTERCEPTER LES MODALS
  // ══════════════════════════════════════════════════════════
  function interceptModals() {
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (!node.classList?.contains('module-sheet-backdrop')) return;

          // Détecter le type de modal
          var title = node.querySelector('.module-sheet-title');
          if (!title) return;
          var text = title.textContent || '';

          if (text.includes('Inviter')) {
            // Modal d'invitation
            setTimeout(function () { replaceInvitePerms(node); }, 50);
          } else if (text.includes('Permissions')) {
            // Modal d'édition
            setTimeout(function () { replaceEditPerms(node); }, 50);
          }
        });
      });
    }).observe(document.body, { childList: true });
  }

  function replaceInvitePerms(modal) {
    var permsWrap = modal.querySelector('#inv-perms-wrap');
    if (!permsWrap) return;
    if (permsWrap.dataset.grouped) return; // déjà remplacé
    permsWrap.dataset.grouped = '1';

    // Lire l'état actuel des anciens toggles avant de les supprimer
    var currentPerms = readOldToggles(permsWrap, 'perm-');

    // Remplacer par les lots
    buildGroupedPerms(permsWrap, 'inv-grp-', currentPerms);

    // Intercepter le rôle "gérant" pour tout cocher
    var roleSelect = modal.querySelector('#inv-role');
    if (roleSelect) {
      roleSelect.addEventListener('change', function () {
        var isGerant = roleSelect.value === 'gerant';
        PERM_GROUPS.forEach(function (g) {
          var toggle = modal.querySelector('#inv-grp-' + g.id);
          if (toggle) {
            toggle.checked = isGerant;
            toggle.dispatchEvent(new Event('change'));
          }
        });
      });
    }

    // Intercepter le bouton "Envoyer" pour envoyer les bonnes permissions
    var sendBtn = modal.querySelector('#inv-send');
    if (sendBtn) {
      // Cloner le bouton pour supprimer les anciens handlers
      var newBtn = sendBtn.cloneNode(true);
      sendBtn.parentNode.replaceChild(newBtn, sendBtn);

      newBtn.addEventListener('click', async function () {
        var email = modal.querySelector('#inv-email').value.trim();
        var role = modal.querySelector('#inv-role').value;
        if (!email) { window.showNotification?.('Email requis', 'warning'); return; }

        var permissions = collectGroupedPerms(modal, 'inv-grp-');
        newBtn.disabled = true;
        newBtn.textContent = '⏳ Envoi…';

        try {
          var _invBid = localStorage.getItem('sc_active_boutique');
          var _invPrimary = localStorage.getItem('sc_active_boutique_is_primary') === '1' || !window._activeBoutiqueId;
          var _invBoutiqueId = (_invBid && !_invPrimary) ? parseInt(_invBid) : null;

          var res = await window.authfetch?.(API() + '/members/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, role: role, permissions: permissions, boutique_id: _invBoutiqueId }),
          });

          if (!res || !res.ok) {
            var err = await res?.json?.().catch(function () { return {}; });
            throw new Error(err.error || res.status);
          }

          var data = await res.json();
          window.showNotification?.('✅ Invitation envoyée à ' + email, 'success');
          modal.remove();

          // Réutiliser showInviteLink via un trick : team.js affiche le lien
          // si data.invite_link, mais on a déjà fermé la modal donc il ne le voit pas.
          // On reconstruit le lien ici
          if (data.invite_link) {
            showInviteLinkModal(data.invite_link, email);
          }

          window.teamModule?.load?.();
        } catch (err) {
          window.showNotification?.(
            String(err.message).includes('400') ? 'Email déjà invité ou quota atteint' : 'Erreur lors de l\'invitation',
            'error'
          );
          newBtn.disabled = false;
          newBtn.textContent = 'Envoyer l\'invitation';
        }
      });
    }
  }

  function replaceEditPerms(modal) {
    var permsWrap = modal.querySelector('#ep-perms-wrap');
    if (!permsWrap) return;
    if (permsWrap.dataset.grouped) return;
    permsWrap.dataset.grouped = '1';

    // Lire les permissions actuelles depuis les anciens toggles
    var currentPerms = readOldToggles(permsWrap, 'ep-');

    // Remplacer par les lots
    buildGroupedPerms(permsWrap, 'ep-grp-', currentPerms);

    // Intercepter le bouton "Enregistrer"
    var saveBtn = modal.querySelector('#ep-save');
    if (saveBtn) {
      var newBtn = saveBtn.cloneNode(true);
      saveBtn.parentNode.replaceChild(newBtn, saveBtn);

      newBtn.addEventListener('click', async function () {
        var permissions = collectGroupedPerms(modal, 'ep-grp-');
        newBtn.disabled = true;
        newBtn.textContent = '⏳ Sauvegarde…';

        // Récupérer l'ID du membre depuis le titre
        // Le titre est "⚙️ Permissions — NomMembre"
        // On doit trouver l'ID autrement... le modal original le passe en argument
        // On cherche dans les données de team.js
        var memberId = modal.dataset.memberId;

        if (!memberId) {
          // Fallback : chercher le membre par nom dans le titre
          var titleEl = modal.querySelector('.module-sheet-title');
          var titleText = titleEl ? titleEl.textContent : '';
          var memberName = titleText.replace('⚙️ Permissions — ', '').trim();

          // Chercher dans le DOM des cartes membres pour retrouver l'ID
          // via le bouton ⚙️ qui a ouvert ce modal
          window.showNotification?.('Erreur : ID membre introuvable', 'error');
          newBtn.disabled = false;
          newBtn.textContent = 'Enregistrer';
          return;
        }

        try {
          var res = await window.authfetch?.(API() + '/members/' + memberId, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permissions: permissions }),
          });

          if (!res || !res.ok) throw new Error('Erreur');

          window.showNotification?.('✅ Permissions mises à jour', 'success');
          window.haptic?.success();
          modal.remove();
          window.teamModule?.load?.();
        } catch (e) {
          window.showNotification?.('Erreur mise à jour permissions', 'error');
          newBtn.disabled = false;
          newBtn.textContent = 'Enregistrer';
        }
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // STOCKER L'ID DU MEMBRE SUR LE MODAL
  // ══════════════════════════════════════════════════════════
  // On intercepte les clics sur les boutons ⚙️ pour capturer le member ID
  function trackEditClicks() {
    document.addEventListener('click', function (e) {
      var editBtn = e.target.closest('button');
      if (!editBtn || editBtn.textContent.trim() !== '⚙️') return;

      // Le bouton est dans une carte membre qui contient l'email
      var card = editBtn.closest('[style*="border-radius:16px"]');
      if (!card) return;

      // Attendre que le modal apparaisse et y stocker l'ID
      setTimeout(function () {
        var modal = document.querySelector('.module-sheet-backdrop:last-child');
        if (modal) {
          // Chercher l'ID du membre via une requête aux données en cache
          var nameEl = card.querySelector('[style*="font-weight:700"][style*="font-size:13px"]');
          var memberName = nameEl ? nameEl.textContent.trim() : '';

          // Stocker le nom pour le retrouver
          modal.dataset.memberName = memberName;

          // Chercher l'ID via l'API (les membres sont chargés par team.js)
          findMemberIdByName(memberName, function (id) {
            if (id) modal.dataset.memberId = id;
          });
        }
      }, 100);
    }, true);
  }

  function findMemberIdByName(name, callback) {
    // Charger la liste des membres pour trouver l'ID
    var token = localStorage.getItem('authToken');
    if (!token) { callback(null); return; }

    fetch(API() + '/members', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (members) {
      var member = members.find(function (m) {
        return (m.company_name || m.email) === name ||
               (m.company_name || '').includes(name) ||
               (m.email || '').includes(name);
      });
      callback(member ? member.id : null);
    })
    .catch(function () { callback(null); });
  }

  // ══════════════════════════════════════════════════════════
  // MODAL LIEN D'INVITATION (copie simplifiée)
  // ══════════════════════════════════════════════════════════
  function showInviteLinkModal(link, email) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';

    var waText = encodeURIComponent('Vous êtes invité à rejoindre ma boutique sur Sama Commerce :\n' + link);

    overlay.innerHTML =
      '<div style="background:#fff;border-radius:20px;padding:24px;max-width:360px;width:100%;text-align:center;">' +
        '<div style="font-size:28px;margin-bottom:6px;">✅</div>' +
        '<div style="font-family:Sora,sans-serif;font-weight:800;font-size:15px;margin-bottom:4px;">Invitation créée !</div>' +
        '<div style="font-size:12px;color:#6B7280;margin-bottom:16px;">Partagez ce lien avec ' + esc(email) + ' (valide 72h)</div>' +
        '<div style="background:#F5F3FF;border-radius:12px;padding:12px;margin-bottom:14px;">' +
          '<div style="font-size:11px;color:#7C3AED;word-break:break-all;line-height:1.5;font-family:monospace;">' + esc(link) + '</div>' +
        '</div>' +
        '<button id="ftp-copy" style="width:100%;padding:13px;background:#7C3AED;color:#fff;border:none;border-radius:14px;font-family:Sora,sans-serif;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:8px;">📋 Copier le lien</button>' +
        '<a href="https://wa.me/?text=' + waText + '" target="_blank" rel="noopener" style="display:block;width:100%;padding:13px;box-sizing:border-box;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border-radius:14px;font-family:Sora,sans-serif;font-size:14px;font-weight:800;text-align:center;text-decoration:none;margin-bottom:8px;">💬 Envoyer via WhatsApp</a>' +
        '<button id="ftp-close" style="width:100%;padding:11px;background:#F3F4F6;color:#6B7280;border:none;border-radius:14px;font-size:13px;cursor:pointer;">Fermer</button>' +
      '</div>';

    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#ftp-close').addEventListener('click', function () { overlay.remove(); });
    overlay.querySelector('#ftp-copy').addEventListener('click', function () {
      navigator.clipboard.writeText(link).then(function () {
        overlay.querySelector('#ftp-copy').textContent = '✅ Copié !';
        window.showNotification?.('📋 Lien copié !', 'success');
      }).catch(function () {
        var inp = document.createElement('input');
        inp.value = link;
        document.body.appendChild(inp);
        inp.select();
        document.execCommand('copy');
        inp.remove();
        overlay.querySelector('#ftp-copy').textContent = '✅ Copié !';
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // UTILS
  // ══════════════════════════════════════════════════════════
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function API() {
    return document.querySelector('meta[name="api-base"]')?.content ||
           'https://samacommerce-backend-v2.onrender.com';
  }

  // ══════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════
  function init() {
    interceptModals();
    trackEditClicks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }

})();
