/**
 * boutique-switcher.js — Sélecteur de boutique multi-boutiques
 *
 * Injecte dans le header un sélecteur de boutique pour les
 * utilisateurs Enterprise. Permet de :
 *   - Voir toutes ses boutiques avec stats
 *   - Switcher d'une boutique à l'autre
 *   - Créer une nouvelle boutique (si limite non atteinte)
 *
 * Stocke la boutique active dans localStorage + envoie
 * l'en-tête X-Boutique-Id sur toutes les requêtes authfetch.
 */

(function () {

  const API   = () => document.querySelector('meta[name="api-base"]')?.content
                   || 'https://samacommerce-backend-v2.onrender.com';
  const auth  = (url, o={}) => window.authfetch?.(url, o);
  const KEY   = 'sc_active_boutique';

  let _boutiques  = [];
  let _activeBoutique = null;

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
    // Notifier authfetch d'ajouter l'en-tête
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
  // CHARGEMENT
  // ══════════════════════════════════════
  async function loadBoutiques() {
    try {
      const res = await auth(`${API()}/boutiques`);
      if (!res?.ok) return;
      _boutiques = await res.json();

      // Restaurer la boutique active
      const savedId = getActiveBoutiqueId();
      const saved   = _boutiques.find(b => b.id === savedId);
      const primary = _boutiques.find(b => b.is_primary);

      setActiveBoutique(saved || primary || _boutiques[0] || null);
    } catch (err) {
      console.warn('boutique-switcher loadBoutiques:', err.message);
    }
  }

  // ══════════════════════════════════════
  // INJECTION DANS LE HEADER
  // ══════════════════════════════════════
  function injectSwitcher() {
    if (document.getElementById('boutique-switcher')) return;

    // Seulement pour Enterprise
    const state = window._subscriptionState;
    if (!state || state.plan !== 'Enterprise') return;

    const header = document.querySelector('.top-header, .header-inner, header');
    if (!header) return;

    const switcher = document.createElement('button');
    switcher.id = 'boutique-switcher';
    switcher.style.cssText = `
      display: flex; align-items: center; gap: 6px;
      background: rgba(255,255,255,.15); border: none; color: #fff;
      padding: 6px 10px; border-radius: 10px; cursor: pointer;
      font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 700;
      max-width: 130px; overflow: hidden;
      transition: background .15s;
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
  // MODAL DE SÉLECTION
  // ══════════════════════════════════════
  function openSwitcherModal() {
    document.getElementById('boutique-modal')?.remove();

    const state = window._subscriptionState;
    const plan  = state?.plan || 'Free';
    const limit = window.PLANS?.[plan]?.boutiques_limit || 1;
    const canAdd = _boutiques.length < limit;

    const modal = document.createElement('div');
    modal.id = 'boutique-modal';
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,.5);
      z-index: 1200; display: flex; align-items: flex-end; justify-content: center;
      padding: 0;
    `;

    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:0 0 env(safe-area-inset-bottom);
                  max-height:80vh;overflow-y:auto;box-shadow:0 -8px 32px rgba(0,0,0,.18);">
        <!-- Header -->
        <div style="padding:16px 20px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #F3F4F6;">
          <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:16px;color:#111;">🏪 Mes Boutiques</div>
          <button onclick="document.getElementById('boutique-modal')?.remove()"
            style="background:none;border:none;font-size:20px;cursor:pointer;color:#9CA3AF;padding:4px;">✕</button>
        </div>

        <!-- Liste boutiques -->
        <div id="boutique-list" style="padding:12px 16px;">
          ${_boutiques.map(b => `
            <div onclick="window._switchBoutique(${b.id})"
              style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;cursor:pointer;margin-bottom:8px;
                     border:2px solid ${b.id === _activeBoutique?.id ? '#7C3AED' : '#F3F4F6'};
                     background:${b.id === _activeBoutique?.id ? '#F5F3FF' : '#fff'};
                     transition:all .15s;">
              <div style="font-size:28px;">${b.emoji || '🏪'}</div>
              <div style="flex:1;">
                <div style="font-weight:800;font-size:14px;color:${b.id === _activeBoutique?.id ? '#7C3AED' : '#111'};">
                  ${b.name}
                  ${b.is_primary ? '<span style="font-size:10px;background:#EDE9FE;color:#7C3AED;padding:2px 6px;border-radius:99px;margin-left:6px;font-weight:700;">Principale</span>' : ''}
                </div>
                <div style="font-size:11px;color:#9CA3AF;margin-top:2px;">
                  ${b.nb_produits || 0} produits · ${b.nb_ventes || 0} ventes
                </div>
              </div>
              ${b.id === _activeBoutique?.id ? '<span style="color:#7C3AED;font-size:18px;">✓</span>' : ''}
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
              ➕ Nouvelle boutique (${_boutiques.length}/${limit})
            </button>
          </div>
        ` : `
          <div style="padding:0 16px 16px;">
            <div style="text-align:center;font-size:12px;color:#9CA3AF;padding:8px;">
              Limite atteinte (${limit} boutiques pour votre plan Enterprise)
            </div>
          </div>
        `}
      </div>
    `;

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  // ══════════════════════════════════════
  // ACTIONS
  // ══════════════════════════════════════
  window._switchBoutique = async (boutiqueId) => {
    document.getElementById('boutique-modal')?.remove();
    const boutique = _boutiques.find(b => b.id === boutiqueId);
    if (!boutique) return;

    setActiveBoutique(boutique);

    // Recharger les données de la boutique sélectionnée
    window.showNotification?.(`🏪 Boutique "${boutique.name}" sélectionnée`, 'success');
    await window.syncFromServer?.();
    window.afficherProduits?.();
    window.afficherCategories?.();
    window.updateStats?.();
  };

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
            style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:14px;outline:none;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Emoji</label>
          <input id="nb-emoji" type="text" placeholder="🏪" maxlength="2"
            style="width:80px;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:18px;text-align:center;outline:none;">
        </div>
        <div style="margin-bottom:16px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Téléphone</label>
          <input id="nb-phone" type="tel" placeholder="+221 77 000 00 00"
            style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:14px;outline:none;">
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
    const name  = document.getElementById('nb-name')?.value.trim();
    const emoji = document.getElementById('nb-emoji')?.value.trim() || '🏪';
    const phone = document.getElementById('nb-phone')?.value.trim();

    if (!name) {
      window.showNotification?.('❌ Le nom est requis', 'error');
      return;
    }

    try {
      const res = await auth(`${API()}/boutiques`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, emoji, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        window.showNotification?.('❌ ' + (data.error || 'Erreur'), 'error');
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

    // Attendre que le plan soit chargé
    const checkPlan = () => {
      const state = window._subscriptionState;
      if (!state) { setTimeout(checkPlan, 500); return; }
      if (state.plan === 'Enterprise' && state.isPaid && !state.isExpired) {
        loadBoutiques().then(() => injectSwitcher());
      }
    };
    checkPlan();

    // Réinjecter si le plan change (après sync)
    window.addEventListener('boutique:changed', () => {
      // Recharger les données avec la nouvelle boutique active
    });
  }

  window.boutiqueSwitcher = { reload: loadBoutiques };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
