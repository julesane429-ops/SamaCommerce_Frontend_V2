/**
 * boutique-switcher.js — Sélecteur et indicateur de boutique
 *
 * Corrections apportées :
 *   ✅ Visible dès qu'il y a plusieurs boutiques (pas seulement Enterprise)
 *   ✅ Affiche "Illimité" pour Enterprise au lieu d'un nombre
 *   ✅ Indicateur de boutique active toujours visible dans le header
 *   ✅ Invite par boutique : expose window.getActiveBoutiqueId()
 *      pour que team.js puisse passer le bon boutique_id à l'invitation
 *   ✅ Sélecteur robuste : réessaie l'injection si le header n'est pas encore prêt
 */

(function () {

  const API   = () => document.querySelector('meta[name="api-base"]')?.content
                   || 'https://samacommerce-backend-v2.onrender.com';
  const auth  = (url, o = {}) => window.authfetch?.(url, o);
  const KEY   = 'sc_active_boutique';
  const PLAN_KEY = 'modeVente'; // clé localStorage du plan courant

  let _boutiques      = [];
  let _activeBoutique = null;

  // ══════════════════════════════════════
  // ÉTAT ACTIF
  // ══════════════════════════════════════
  function getActiveBoutiqueId() {
    return parseInt(localStorage.getItem(KEY) || '0') || null;
  }

  // Exposé globalement pour team.js (invitation par boutique)
  window.getActiveBoutiqueId = getActiveBoutiqueId;

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
  // PATCH authfetch — injecter X-Boutique-Id
  // ══════════════════════════════════════
  function patchAuthfetch() {
    const orig = window.authfetch;
    if (!orig || orig._boutiquePatch) return;

    window.authfetch = function (url, options = {}) {
      const boutiqueId = window._activeBoutiqueId;
      if (boutiqueId) {
        options = {
          ...options,
          headers: { ...(options.headers || {}), 'X-Boutique-Id': String(boutiqueId) },
        };
      }
      return orig(url, options);
    };
    window.authfetch._boutiquePatch = true;
  }

  // ══════════════════════════════════════
  // CHARGEMENT DES BOUTIQUES
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

      return _boutiques;
    } catch (err) {
      console.warn('boutique-switcher loadBoutiques:', err.message);
      return [];
    }
  }

  // ══════════════════════════════════════
  // INJECTION DANS LE HEADER
  // ══════════════════════════════════════
  // ✅ Toujours visible si l'utilisateur a au moins 1 boutique.
  //    Affiche un simple indicateur (non cliquable) si 1 boutique,
  //    un sélecteur complet si plusieurs boutiques.
  function injectSwitcher() {
    if (document.getElementById('boutique-indicator')) return;

    const header = document.querySelector('.top-header, .header-inner, header, #topbar, .navbar');
    if (!header) {
      // Header pas encore dans le DOM — réessayer
      setTimeout(injectSwitcher, 300);
      return;
    }

    const hasMultiple = _boutiques.length > 1;

    const indicator = document.createElement('button');
    indicator.id    = 'boutique-indicator';
    indicator.style.cssText = `
      display: flex; align-items: center; gap: 5px;
      background: rgba(255,255,255,.18); border: none; color: #fff;
      padding: 5px 10px; border-radius: 10px; font-size: 12px; font-weight: 700;
      max-width: 160px; overflow: hidden; white-space: nowrap;
      transition: background .15s; cursor: ${hasMultiple ? 'pointer' : 'default'};
      font-family: 'Sora', var(--font-body, sans-serif);
    `;
    indicator.innerHTML = `
      <span id="boutique-indicator-emoji">🏪</span>
      <span id="boutique-indicator-name" style="overflow:hidden;text-overflow:ellipsis;">Boutique</span>
      ${hasMultiple ? '<span style="opacity:.6;font-size:10px;">▼</span>' : ''}
    `;

    if (hasMultiple) {
      indicator.addEventListener('click', openSwitcherModal);
    }

    // Insérer en premier dans le header
    header.insertBefore(indicator, header.firstChild);
    updateHeaderDisplay();
  }

  function updateHeaderDisplay() {
    const nameEl  = document.getElementById('boutique-indicator-name');
    const emojiEl = document.getElementById('boutique-indicator-emoji');
    if (!nameEl || !_activeBoutique) return;
    nameEl.textContent  = _activeBoutique.name  || 'Boutique';
    emojiEl.textContent = _activeBoutique.emoji || '🏪';
  }

  // ══════════════════════════════════════
  // MODAL DE SÉLECTION
  // ══════════════════════════════════════
  function openSwitcherModal() {
    document.getElementById('boutique-modal')?.remove();

    const state     = window._subscriptionState;
    const plan      = state?.plan || localStorage.getItem('userPlan') || 'Free';
    const isEnterprise = plan === 'Enterprise';

    // ✅ Enterprise = illimité, autres plans = limité
    const limitLabel = isEnterprise
      ? 'Illimité'
      : String(_boutiques.length) + '/1';

    const canAdd = isEnterprise && (state?.isPaid && !state?.isExpired);

    const modal = document.createElement('div');
    modal.id = 'boutique-modal';
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,.5);
      z-index: 1200; display: flex; align-items: flex-end; justify-content: center;
    `;

    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:480px;
                  padding:0 0 env(safe-area-inset-bottom);max-height:80vh;overflow-y:auto;
                  box-shadow:0 -8px 32px rgba(0,0,0,.18);">
        <!-- Header modal -->
        <div style="padding:16px 20px 12px;display:flex;align-items:center;
                    justify-content:space-between;border-bottom:1px solid #F3F4F6;">
          <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:16px;color:#111;">
            🏪 Mes Boutiques
          </div>
          <button onclick="document.getElementById('boutique-modal')?.remove()"
            style="background:none;border:none;font-size:20px;cursor:pointer;color:#9CA3AF;padding:4px;">✕</button>
        </div>

        <!-- Liste boutiques -->
        <div id="boutique-list" style="padding:12px 16px;">
          ${_boutiques.map(b => `
            <div onclick="window._switchBoutique(${b.id})"
              style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;
                     cursor:pointer;margin-bottom:8px;transition:all .15s;
                     border:2px solid ${b.id === _activeBoutique?.id ? '#7C3AED' : '#F3F4F6'};
                     background:${b.id === _activeBoutique?.id ? '#F5F3FF' : '#fff'};">
              <div style="font-size:28px;">${b.emoji || '🏪'}</div>
              <div style="flex:1;">
                <div style="font-weight:800;font-size:14px;
                            color:${b.id === _activeBoutique?.id ? '#7C3AED' : '#111'};">
                  ${b.name}
                  ${b.is_primary
                    ? '<span style="font-size:10px;background:#EDE9FE;color:#7C3AED;padding:2px 6px;border-radius:99px;margin-left:6px;font-weight:700;">Principale</span>'
                    : ''}
                </div>
                <div style="font-size:11px;color:#9CA3AF;margin-top:2px;">
                  ${b.nb_produits || 0} produits · ${b.nb_ventes || 0} ventes
                  ${b.nb_membres ? ` · ${b.nb_membres} employé${b.nb_membres > 1 ? 's' : ''}` : ''}
                </div>
              </div>
              ${b.id === _activeBoutique?.id ? '<span style="color:#7C3AED;font-size:18px;">✓</span>' : ''}
            </div>
          `).join('')}
        </div>

        <!-- Bouton nouvelle boutique (Enterprise uniquement) -->
        ${canAdd ? `
          <div style="padding:0 16px 16px;">
            <button onclick="window._openNewBoutiqueForm()"
              style="width:100%;padding:13px;background:linear-gradient(135deg,#7C3AED,#EC4899);
                     color:#fff;border:none;border-radius:14px;font-family:'Sora',sans-serif;
                     font-size:14px;font-weight:800;cursor:pointer;">
              ➕ Nouvelle boutique
              <span style="font-size:11px;opacity:.8;margin-left:6px;">(${limitLabel})</span>
            </button>
          </div>
        ` : !isEnterprise ? `
          <div style="padding:0 16px 16px;">
            <div style="text-align:center;background:#FEF3C7;border-radius:12px;padding:12px;font-size:12px;color:#92400E;">
              🔒 La gestion multi-boutiques est réservée au plan Enterprise.
              <br><span style="font-weight:700;">Passez à Enterprise pour créer des boutiques supplémentaires.</span>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  // ══════════════════════════════════════
  // SWITCH DE BOUTIQUE
  // ══════════════════════════════════════
  window._switchBoutique = async (boutiqueId) => {
    document.getElementById('boutique-modal')?.remove();
    const boutique = _boutiques.find(b => b.id === boutiqueId);
    if (!boutique) return;

    setActiveBoutique(boutique);
    window.showNotification?.(`🏪 Boutique "${boutique.name}" sélectionnée`, 'success');

    // Recharger les données de cette boutique
    await window.syncFromServer?.();
    window.afficherProduits?.();
    window.afficherCategories?.();
    window.updateStats?.();
    window.afficherRapports?.();
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
        <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:16px;margin-bottom:16px;">
          ➕ Nouvelle boutique
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Nom *</label>
          <input id="nb-name" type="text" placeholder="Ex: Boutique Plateau"
            style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:14px;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Emoji</label>
          <input id="nb-emoji" type="text" placeholder="🏪" maxlength="2"
            style="width:80px;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:18px;text-align:center;">
        </div>
        <div style="margin-bottom:16px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Téléphone</label>
          <input id="nb-phone" type="tel" placeholder="+221 77 000 00 00"
            style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:14px;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Adresse</label>
          <input id="nb-address" type="text" placeholder="Ex: Rue 10, Dakar"
            style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:14px;box-sizing:border-box;">
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
  };

  window._createBoutique = async () => {
    const name    = document.getElementById('nb-name')?.value.trim();
    const emoji   = document.getElementById('nb-emoji')?.value.trim()   || '🏪';
    const phone   = document.getElementById('nb-phone')?.value.trim()   || null;
    const address = document.getElementById('nb-address')?.value.trim() || null;

    if (!name) { window.showNotification?.('❌ Le nom est requis', 'error'); return; }

    try {
      const res  = await auth(`${API()}/boutiques`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, emoji, phone, address }),
      });
      const data = await res.json();

      if (!res.ok) {
        window.showNotification?.('❌ ' + (data.error || 'Erreur'), 'error');
        return;
      }

      document.getElementById('new-boutique-form')?.remove();
      await loadBoutiques();

      // Mettre à jour l'indicateur (maintenant plusieurs boutiques)
      document.getElementById('boutique-indicator')?.remove();
      injectSwitcher();

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

    // Charger les boutiques dès que le token est disponible
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const boutiques = await loadBoutiques();

    // ✅ Toujours injecter l'indicateur si l'utilisateur a au moins une boutique
    if (boutiques && boutiques.length > 0) {
      // Attendre que le header soit dans le DOM
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        injectSwitcher();
      } else {
        document.addEventListener('DOMContentLoaded', injectSwitcher);
      }
    }

    // Réinjecter si le DOM change (SPA)
    window.addEventListener('boutique:changed', () => {
      updateHeaderDisplay();
    });
  }

  window.boutiqueSwitcher = { reload: loadBoutiques };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
