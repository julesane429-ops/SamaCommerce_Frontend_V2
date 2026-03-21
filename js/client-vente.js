/**
 * client-vente.js — Autocomplétion client dans la section Vente
 *
 * 1. Injecte un champ "👤 Client (optionnel)" dans la section Vente
 * 2. Autocomplete sur appData.clients
 * 3. Patche finaliserVente() → passe client_id avec chaque article
 * 4. Patche finaliserVenteCredit() → pré-remplit nom/téléphone si client sélectionné
 * 5. Réinitialise la sélection après chaque vente
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/client-vente.js"></script>
 */
(function () {

  let _selectedClient = null; // { id, name, phone }

  // ══════════════════════════════════════
  // INJECTER LE WIDGET CLIENT
  // ══════════════════════════════════════
  function injectClientWidget() {
    if (document.getElementById('cv-client-wrap')) return;

    const totalBar = document.querySelector('.total-bar');
    if (!totalBar) return;

    const wrap = document.createElement('div');
    wrap.id = 'cv-client-wrap';
    wrap.style.cssText = `
      position: relative;
      margin-bottom: 10px;
    `;
    wrap.innerHTML = `
      <div style="
        display:flex;align-items:center;gap:10px;
        background:var(--surface);border-radius:16px;
        padding:10px 14px;box-shadow:0 2px 12px rgba(0,0,0,.06);
        border:1.5px solid #E5E7EB;
        transition:border-color .2s;
      " id="cv-client-box">
        <span style="font-size:18px;flex-shrink:0;">👤</span>
        <div style="flex:1;min-width:0;">
          <input id="cv-client-input" type="text" autocomplete="off"
            placeholder="Client (optionnel)"
            style="
              width:100%;border:none;outline:none;
              font-family:'Sora',sans-serif;font-size:13px;font-weight:600;
              color:var(--text);background:transparent;
            ">
        </div>
        <button id="cv-client-clear" style="
          display:none;background:none;border:none;
          font-size:16px;cursor:pointer;color:var(--muted);padding:0;
        ">✕</button>
      </div>

      <!-- Dropdown suggestions -->
      <div id="cv-client-dropdown" style="
        display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);
        background:var(--surface);border-radius:14px;
        box-shadow:0 8px 24px rgba(0,0,0,.12);
        z-index:300;overflow:hidden;border:1.5px solid #E5E7EB;
        max-height:200px;overflow-y:auto;
      "></div>
    `;

    // Insérer avant la total-bar
    totalBar.parentNode.insertBefore(wrap, totalBar);

    // Logique autocomplete
    const input    = wrap.querySelector('#cv-client-input');
    const dropdown = wrap.querySelector('#cv-client-dropdown');
    const clearBtn = wrap.querySelector('#cv-client-clear');
    const box      = wrap.querySelector('#cv-client-box');

    input.addEventListener('focus', () => {
      box.style.borderColor = 'var(--primary)';
      showSuggestions(input.value);
    });

    input.addEventListener('blur', () => {
      box.style.borderColor = '#E5E7EB';
      setTimeout(() => { dropdown.style.display = 'none'; }, 200);
    });

    input.addEventListener('input', () => {
      showSuggestions(input.value.trim());
      if (!input.value.trim()) {
        clearSelection();
      }
    });

    clearBtn.addEventListener('click', () => {
      clearSelection();
      input.focus();
    });

    function showSuggestions(query) {
      const clients = window.appData?.clients || [];
      const q = query.toLowerCase();
      const found = clients
        .filter(c => !q || (c.name||'').toLowerCase().includes(q) || (c.phone||'').includes(q))
        .slice(0, 6);

      if (!found.length) { dropdown.style.display = 'none'; return; }

      dropdown.style.display = 'block';
      dropdown.innerHTML = found.map(c => `
        <div data-id="${c.id}" data-name="${c.name}" data-phone="${c.phone||''}"
          style="
            padding:10px 14px;cursor:pointer;
            display:flex;align-items:center;gap:10px;
            border-bottom:1px solid #F3F4F6;
            transition:background .1s;
          "
          onmouseover="this.style.background='#F5F3FF'"
          onmouseout="this.style.background='transparent'">
          <div style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:800;flex-shrink:0;">
            ${(c.name||'?').slice(0,1).toUpperCase()}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.name}</div>
            ${c.phone ? `<div style="font-size:11px;color:var(--muted);">📞 ${c.phone}</div>` : ''}
          </div>
        </div>
      `).join('');

      dropdown.querySelectorAll('[data-id]').forEach(el => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectClient({
            id:    parseInt(el.dataset.id),
            name:  el.dataset.name,
            phone: el.dataset.phone,
          });
        });
      });
    }

    function selectClient(client) {
      _selectedClient = client;
      input.value    = client.name;
      clearBtn.style.display = 'block';
      box.style.borderColor  = '#10B981';
      box.style.background   = '#ECFDF5';
      input.style.color      = '#065F46';
      dropdown.style.display = 'none';

      // Pré-remplir les champs crédit
      const nameField  = document.getElementById('creditClientName');
      const phoneField = document.getElementById('creditClientPhone');
      if (nameField  && !nameField.value)  nameField.value  = client.name;
      if (phoneField && !phoneField.value) phoneField.value = client.phone || '';
    }

    function clearSelection() {
      _selectedClient         = null;
      input.value             = '';
      clearBtn.style.display  = 'none';
      box.style.borderColor   = '#E5E7EB';
      box.style.background    = 'var(--surface)';
      input.style.color       = 'var(--text)';
      dropdown.style.display  = 'none';
    }

    // Exposer pour reset depuis ventes.js
    window._cvClearClient = clearSelection;
  }

  // ══════════════════════════════════════
  // PATCH finaliserVente — ajouter client_id
  // ══════════════════════════════════════
  function patchFinaliserVente() {
    const orig = window.finaliserVente;
    if (typeof orig !== 'function' || orig._cvPatched) return;

    window.finaliserVente = async function (paymentMethod, ...args) {
      // Stocker le client sélectionné avant appel (l'original vide le panier)
      const clientId = _selectedClient?.id || null;
      const clientName  = _selectedClient?.name  || null;

      // Patch temporaire : injecter client_id dans postSaleServer
      const origPost = window.postSaleServer;
      if (typeof origPost === 'function' && clientId) {
        window.postSaleServer = async function(data, ...rest) {
          return origPost.call(this, { ...data, client_id: clientId, client_name: clientName }, ...rest);
        };
      }

      const result = await orig.call(this, paymentMethod, ...args);

      // Restaurer postSaleServer
      if (typeof origPost === 'function') window.postSaleServer = origPost;

      // Réinitialiser le widget
      window._cvClearClient?.();
      return result;
    };
    window.finaliserVente._cvPatched = true;
  }

  // ══════════════════════════════════════
  // PATCH finaliserVenteCredit — pré-remplir + ajouter client_id
  // ══════════════════════════════════════
  function patchFinaliserVenteCredit() {
    const orig = window.finaliserVenteCredit;
    if (typeof orig !== 'function' || orig._cvPatched) return;

    window.finaliserVenteCredit = async function (...args) {
      const clientId = _selectedClient?.id || null;

      // Injecter client_id dans postSaleServer si client sélectionné
      const origPost = window.postSaleServer;
      if (typeof origPost === 'function' && clientId) {
        window.postSaleServer = async function(data, ...rest) {
          return origPost.call(this, { ...data, client_id: clientId }, ...rest);
        };
      }

      const result = await orig.apply(this, args);

      if (typeof origPost === 'function') window.postSaleServer = origPost;

      window._cvClearClient?.();
      return result;
    };
    window.finaliserVenteCredit._cvPatched = true;
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    // Injecter le widget quand la section vente est visible
    window.addEventListener('pageChange', e => {
      if (e.detail?.key === 'vente') setTimeout(injectClientWidget, 100);
    });

    // Injecter aussi au chargement initial si on est sur vente
    window.addEventListener('load', () => {
      setTimeout(() => {
        injectClientWidget();
        patchFinaliserVente();
        patchFinaliserVenteCredit();

        // Patcher les hooks après que app.js ait exposé les fonctions
        const tryPatch = () => {
          if (window.finaliserVente && !window.finaliserVente._cvPatched) patchFinaliserVente();
          if (window.finaliserVenteCredit && !window.finaliserVenteCredit._cvPatched) patchFinaliserVenteCredit();
        };
        tryPatch();
        setTimeout(tryPatch, 1000);
        setTimeout(tryPatch, 3000);
      }, 1500);
    });
  }

  window.clientVente = { getSelected: () => _selectedClient, clear: () => window._cvClearClient?.() };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
