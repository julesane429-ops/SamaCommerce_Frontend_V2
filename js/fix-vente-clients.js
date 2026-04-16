/**
 * fix-vente-clients.js — Corrections finales
 *
 * 1. Bouton "Crédit" dans modal paiement enhanced-vente ne fait rien
 *    → Forcer l'appel showModalCredit() + fallback
 *
 * 2. Commandes clients : ajouter un sélecteur de client depuis la liste
 *    → Injecter un <select> dans openCustomerOrderForm
 *
 * 3. Infos client ne se mettent pas à jour après un achat/crédit
 *    → Recharger la liste clients après chaque vente/remboursement
 *
 * INTÉGRATION : <script src="js/fix-vente-clients.js"></script>
 */

(function () {

  var API = function () {
    return document.querySelector('meta[name="api-base"]')?.content ||
           'https://samacommerce-backend-v2.onrender.com';
  };

  // ══════════════════════════════════════════════════════════
  // 1. BOUTON CRÉDIT — forcer le fonctionnement
  // ══════════════════════════════════════════════════════════
  function fixCreditButton() {
    // Le modal enhanced-vente a un bouton "Crédit" avec data-method="credit"
    // Quand on clique, _selectedMethod devient 'credit' mais le bouton
    // Confirmer peut rester désactivé si le code ne suit pas correctement.
    // On intercepte le click sur tout bouton crédit.

    document.addEventListener('click', function (e) {
      // Enhanced-vente
      var btn = e.target.closest('.ev-method-btn[data-method="credit"]');
      if (btn) {
        // Laisser enhanced-vente gérer, mais déclencher un dblclick qui ouvre direct
        setTimeout(function () {
          var confirmBtn = document.getElementById('evConfirmBtn');
          if (confirmBtn && !confirmBtn.disabled) {
            // Le click normal fonctionnera
          } else if (confirmBtn) {
            // Activer le bouton confirm et permettre le clic
            confirmBtn.disabled = false;
            confirmBtn.textContent = '📝 Créer crédit';
            confirmBtn.onclick = function () {
              closeEnhancedVenteModal();
              setTimeout(function () { window.showModalCredit?.(); }, 100);
            };
          }
        }, 50);
      }

      // Ancien modal paiement (fallback)
      var oldCreditBtn = e.target.closest('.pay-btn.pay-p');
      if (oldCreditBtn && oldCreditBtn.textContent.includes('Crédit')) {
        // Le onclick existant appelle showModalCredit(), vérifier que la fonction existe
        setTimeout(function () {
          if (typeof window.showModalCredit === 'function') {
            // OK, déjà géré
          } else {
            // Fallback : ouvrir le modal manuellement
            var modalP = document.getElementById('modalPaiement');
            var modalC = document.getElementById('modalCredit');
            if (modalP) modalP.classList.add('hidden');
            if (modalC) modalC.classList.remove('hidden');
          }
        }, 50);
      }
    }, true);
  }

  function closeEnhancedVenteModal() {
    var overlay = document.querySelector('.ev-overlay, #evOverlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
  }

  // ══════════════════════════════════════════════════════════
  // 2. COMMANDES CLIENTS — sélecteur de client
  // ══════════════════════════════════════════════════════════
  function patchCustomerOrderForm() {
    // Observer l'ouverture du formulaire pour injecter le sélecteur
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;

          // Chercher un formulaire de commande client
          var form = node.matches?.('.module-sheet-backdrop') ? node : node.querySelector?.('.module-sheet-backdrop');
          if (!form) return;

          var title = form.querySelector('.module-sheet-title');
          if (!title) return;
          var titleText = title.textContent;
          if (!titleText.includes('commande') && !titleText.includes('Commande')) return;

          // Vérifier qu'il n'y a pas déjà notre sélecteur
          if (form.querySelector('#fvc-client-select')) return;

          // Chercher les champs client
          var clientNameInput = form.querySelector('#co-client-name, [id*="client-name"], [id*="clientName"]');
          if (!clientNameInput) return;

          injectClientSelector(form, clientNameInput);
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function injectClientSelector(form, nameInput) {
    var clients = window.appData?.clients || window._clientsCache || [];
    if (!clients.length) {
      // Charger depuis l'API
      loadClientsThenInject(form, nameInput);
      return;
    }

    renderClientSelector(form, nameInput, clients);
  }

  async function loadClientsThenInject(form, nameInput) {
    try {
      var res = await window.authfetch?.(API() + '/clients');
      if (!res?.ok) return;
      var clients = await res.json();
      if (window.appData) window.appData.clients = clients;
      window._clientsCache = clients;
      renderClientSelector(form, nameInput, clients);
    } catch (e) { /* silent */ }
  }

  function renderClientSelector(form, nameInput, clients) {
    // Créer un conteneur au-dessus du nameInput
    var wrap = document.createElement('div');
    wrap.className = 'form-group';
    wrap.innerHTML =
      '<label>Client existant (optionnel)</label>' +
      '<select id="fvc-client-select" style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:13px;background:var(--surface,#fff);color:var(--text);">' +
        '<option value="">— Sélectionner un client —</option>' +
        clients.map(function (c) {
          return '<option value="' + c.id + '" data-name="' + esc(c.name) +
            '" data-phone="' + esc(c.phone || '') + '" data-address="' + esc(c.address || '') +
            '">' + esc(c.name) + (c.phone ? ' · ' + esc(c.phone) : '') + '</option>';
        }).join('') +
      '</select>';

    // Insérer avant le champ nom
    var formGroup = nameInput.closest('.form-group');
    if (formGroup) {
      formGroup.insertAdjacentElement('beforebegin', wrap);
    }

    // Hook: au changement, pré-remplir les champs
    var select = wrap.querySelector('#fvc-client-select');
    select.addEventListener('change', function () {
      var opt = select.options[select.selectedIndex];
      if (!opt.value) return;

      var phoneInput = form.querySelector('#co-client-phone, [id*="client-phone"], [id*="clientPhone"]');
      var addressInput = form.querySelector('#co-delivery-address, [id*="address"], [id*="adresse"]');

      if (nameInput) nameInput.value = opt.dataset.name || '';
      if (phoneInput) phoneInput.value = opt.dataset.phone || '';
      if (addressInput && opt.dataset.address) addressInput.value = opt.dataset.address;

      // Stocker l'ID pour la soumission
      form.dataset.selectedClientId = opt.value;
    });

    // Hook aussi la soumission pour envoyer client_id
    var saveBtn = form.querySelector('#co-save, [id*="save"], .btn-confirm');
    if (saveBtn && !saveBtn._fvcHooked) {
      saveBtn._fvcHooked = true;
      var origHandler = saveBtn.onclick;

      // Patch le fetch pour injecter client_id
      var origFetch = window.fetch;
      var patched = false;

      saveBtn.addEventListener('click', function () {
        if (patched) return;
        patched = true;

        var clientId = form.dataset.selectedClientId;
        if (!clientId) { patched = false; return; }

        // Intercepter le prochain POST /customer-orders
        var origFetchLocal = window.fetch;
        window.fetch = function (url, opts) {
          if (opts && opts.method === 'POST' && String(url).includes('/customer-orders')) {
            try {
              var body = JSON.parse(opts.body || '{}');
              body.client_id = parseInt(clientId);
              opts.body = JSON.stringify(body);
            } catch (e) {}
            // Restaurer après 1 requête
            window.fetch = origFetchLocal;
            patched = false;
          }
          return origFetchLocal.apply(this, arguments);
        };

        // Safety : restaurer après 5s même si la requête n'a pas eu lieu
        setTimeout(function () {
          window.fetch = origFetchLocal;
          patched = false;
        }, 5000);
      }, true);
    }
  }

  // ══════════════════════════════════════════════════════════
  // 3. INFOS CLIENT — rafraîchissement auto après achat/crédit
  // ══════════════════════════════════════════════════════════
  function setupClientRefresh() {
    // Recharger les clients après chaque vente
    var origFinaliser = window.finaliserVente;
    if (origFinaliser && !origFinaliser._fvcRefresh) {
      window.finaliserVente = async function () {
        var result = await origFinaliser.apply(this, arguments);
        // Après la vente, recharger les clients (leurs total_achats changent)
        setTimeout(refreshClients, 1500);
        return result;
      };
      window.finaliserVente._fvcRefresh = true;
    }

    // Recharger aussi après un remboursement de crédit
    var origMarqRembourse = window.marquerRembourse;
    if (origMarqRembourse && !origMarqRembourse._fvcRefresh) {
      window.marquerRembourse = async function () {
        var result = await origMarqRembourse.apply(this, arguments);
        setTimeout(refreshClients, 1500);
        return result;
      };
      window.marquerRembourse._fvcRefresh = true;
    }

    var origConfirmer = window.confirmerRemboursement;
    if (origConfirmer && !origConfirmer._fvcRefresh) {
      window.confirmerRemboursement = async function () {
        var result = await origConfirmer.apply(this, arguments);
        setTimeout(refreshClients, 1500);
        return result;
      };
      window.confirmerRemboursement._fvcRefresh = true;
    }

    // Recharger après paiement partiel
    var origPartial = window.partialPayment || window.partialCredit;
    if (origPartial && !origPartial._fvcRefresh) {
      var wrapped = async function () {
        var result = await origPartial.apply(this, arguments);
        setTimeout(refreshClients, 1500);
        return result;
      };
      wrapped._fvcRefresh = true;
      if (window.partialPayment) window.partialPayment = wrapped;
      if (window.partialCredit) window.partialCredit = wrapped;
    }
  }

  async function refreshClients() {
    try {
      var res = await window.authfetch?.(API() + '/clients');
      if (!res?.ok) return;
      var clients = await res.json();
      if (window.appData) window.appData.clients = clients;
      window._clientsCache = clients;

      // Si on est sur la section clients, re-render
      var clientsSection = document.getElementById('clientsSection');
      if (clientsSection && !clientsSection.classList.contains('hidden')) {
        window.loadClients?.();
      }
    } catch (e) { /* silent */ }
  }

  // ══════════════════════════════════════════════════════════
  // UTILS
  // ══════════════════════════════════════════════════════════
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML.replace(/"/g, '&quot;');
  }

  // ══════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════
  function init() {
    fixCreditButton();
    patchCustomerOrderForm();

    // Attendre que les fonctions de vente soient disponibles
    function tryHook() {
      if (window.finaliserVente) {
        setupClientRefresh();
      } else {
        setTimeout(tryHook, 500);
      }
    }
    tryHook();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 900); });
  } else {
    setTimeout(init, 900);
  }

})();
