/**
 * fix-credit-sale.js — Correction DÉFINITIVE de la vente à crédit
 *
 * BUG RÉEL IDENTIFIÉ :
 *   #modalCredit est à l'intérieur de #modalOverlay (conteneur noir).
 *   showModalCredit() ne fait QUE remove('hidden') sur modalCredit,
 *   mais modalOverlay reste hidden → modal invisible.
 *   En plus enhanced-vente intercepte showModal('paiement') donc
 *   modalOverlay n'est jamais rendu visible.
 *
 * COMPORTEMENT ATTENDU :
 *   - Si un client est SÉLECTIONNÉ (widget cv-client-input)
 *     → enregistrer le crédit directement SANS modal
 *     → utiliser nom + téléphone du client, échéance = +30 jours
 *   - Si AUCUN client sélectionné
 *     → ouvrir modalCredit pour saisir nom + téléphone + échéance
 *
 * INTÉGRATION : <script src="js/fix-credit-sale.js"></script>
 *   (remplace toute logique crédit précédente)
 */

(function () {

  var API = function () {
    return document.querySelector('meta[name="api-base"]')?.content ||
           'https://samacommerce-backend-v2.onrender.com';
  };

  // ══════════════════════════════════════════════════════════
  // 1. INTERCEPTER LE BOUTON CRÉDIT D'ENHANCED-VENTE
  //    Au clic, court-circuiter le flow "sélectionner puis confirmer"
  // ══════════════════════════════════════════════════════════
  function interceptCreditButton() {
    document.addEventListener('click', function (e) {
      // Cible 1 : bouton "Crédit" dans enhanced-vente
      var evCreditBtn = e.target.closest('.ev-method-btn[data-method="credit"]');
      if (evCreditBtn) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Fermer le modal enhanced-vente
        closeEnhancedVente();

        // Petite pause pour que le modal se ferme proprement
        setTimeout(handleCreditSale, 150);
        return;
      }

      // Cible 2 : bouton "Crédit" dans l'ancien modalPaiement (fallback)
      var oldCreditBtn = e.target.closest('.pay-btn.pay-p');
      if (oldCreditBtn && oldCreditBtn.textContent.trim().includes('Crédit')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Fermer tous les modaux
        hideAllModals();

        setTimeout(handleCreditSale, 150);
        return;
      }
    }, true); // capture phase : on intercepte avant tous les autres handlers
  }

  function closeEnhancedVente() {
    var overlay = document.getElementById('ev-overlay') ||
                  document.querySelector('#ev-overlay, .ev-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  function hideAllModals() {
    var mp = document.getElementById('modalPaiement');
    var mc = document.getElementById('modalCredit');
    var overlay = document.getElementById('modalOverlay');
    if (mp) mp.classList.add('hidden');
    if (mc) mc.classList.add('hidden');
    if (overlay) overlay.classList.add('hidden');
  }

  // ══════════════════════════════════════════════════════════
  // 2. LOGIQUE PRINCIPALE : client sélectionné ou pas ?
  // ══════════════════════════════════════════════════════════
  function handleCreditSale() {
    var client = window.clientVente?.getSelected?.();

    if (client && client.name) {
      // ✅ CLIENT SÉLECTIONNÉ → crédit direct sans modal
      processDirectCredit(client);
    } else {
      // ❌ PAS DE CLIENT → ouvrir le modal pour saisir les infos
      openCreditModalFixed();
    }
  }

  // ── 2A. CRÉDIT DIRECT (client déjà sélectionné) ──
  async function processDirectCredit(client) {
    var panier = window.appData?.panier || [];
    if (!panier.length) {
      window.showNotification?.('❌ Panier vide', 'error');
      return;
    }

    // Échéance par défaut : +30 jours
    var due = new Date();
    due.setDate(due.getDate() + 30);
    var dueDate = due.toISOString().split('T')[0];

    // Pré-remplir les champs cachés pour que finaliserVenteCredit fonctionne
    // (finaliserVenteCredit lit ces champs directement depuis le DOM)
    ensureCreditFields();
    document.getElementById('creditClientName').value = client.name;
    document.getElementById('creditClientPhone').value = client.phone || '';
    document.getElementById('creditDueDate').value = dueDate;

    // Appeler la fonction existante de vente à crédit
    if (typeof window.finaliserVenteCredit === 'function') {
      try {
        await window.finaliserVenteCredit();
        window.showNotification?.('✅ Crédit enregistré pour ' + client.name, 'success');
      } catch (e) {
        console.error('Erreur vente crédit:', e);
        window.showNotification?.('❌ Erreur lors de la vente à crédit', 'error');
      }
    } else {
      // Fallback : envoyer directement au backend
      await sendCreditToBackend(panier, {
        client_name: client.name,
        client_phone: client.phone || '',
        client_id: client.id,
        due_date: dueDate,
      });
    }
  }

  // ── 2B. MODAL CRÉDIT (pas de client) — avec correction de l'affichage ──
  function openCreditModalFixed() {
    var overlay = document.getElementById('modalOverlay');
    var modalP = document.getElementById('modalPaiement');
    var modalC = document.getElementById('modalCredit');

    if (!overlay || !modalC) {
      window.showNotification?.('❌ Modal crédit introuvable', 'error');
      return;
    }

    // FIX CRITIQUE : rendre l'overlay visible
    overlay.classList.remove('hidden');

    // Cacher modalPaiement, afficher modalCredit
    if (modalP) modalP.classList.add('hidden');
    modalC.classList.remove('hidden');

    // Cacher tous les autres modals qui pourraient être visibles
    document.querySelectorAll('#modalOverlay .modal-box').forEach(function (m) {
      if (m.id !== 'modalCredit') m.classList.add('hidden');
    });

    // Réinitialiser et pré-remplir la date
    var dateInput = document.getElementById('creditDueDate');
    if (dateInput) {
      var today = new Date();
      var due = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      dateInput.value = due.toISOString().split('T')[0];
      dateInput.min = today.toISOString().split('T')[0];
    }

    // Focus sur le nom
    var nameInput = document.getElementById('creditClientName');
    if (nameInput) {
      nameInput.value = '';
      setTimeout(function () { nameInput.focus(); }, 200);
    }

    var phoneInput = document.getElementById('creditClientPhone');
    if (phoneInput) phoneInput.value = '';
  }

  // ══════════════════════════════════════════════════════════
  // 3. VÉRIFIER QUE LES CHAMPS DU MODAL CRÉDIT EXISTENT
  // ══════════════════════════════════════════════════════════
  function ensureCreditFields() {
    // S'assurer que les inputs nécessaires pour finaliserVenteCredit existent
    var required = ['creditClientName', 'creditClientPhone', 'creditDueDate'];
    var missing = required.filter(function (id) { return !document.getElementById(id); });
    if (missing.length) {
      console.warn('Champs crédit manquants:', missing);
    }
  }

  // ══════════════════════════════════════════════════════════
  // 4. FALLBACK : ENVOI DIRECT AU BACKEND
  // ══════════════════════════════════════════════════════════
  async function sendCreditToBackend(panier, clientInfo) {
    var appData = window.appData;
    if (!appData) return;

    // Optimistic UI
    var panierCopy = panier.map(function (i) { return Object.assign({}, i); });
    panierCopy.forEach(function (item) {
      var prod = appData.produits.find(function (p) { return p.id === item.id; });
      if (prod) prod.stock = Math.max(0, prod.stock - item.quantite);
    });

    appData.panier = [];
    window.saveAppDataLocal?.();
    window.updateStats?.();
    window.afficherPanier?.();
    window.afficherCategoriesVente?.();
    window.afficherProduits?.();

    window.haptic?.success();
    window.showNotification?.('✅ Crédit enregistré', 'success');

    // Envoyer au backend
    for (var i = 0; i < panierCopy.length; i++) {
      var item = panierCopy[i];
      try {
        await window.authfetch?.(API() + '/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: item.id,
            quantity: item.quantite,
            payment_method: 'credit',
            client_name: clientInfo.client_name,
            client_phone: clientInfo.client_phone,
            client_id: clientInfo.client_id,
            due_date: clientInfo.due_date,
            paid: false,
          }),
        });
      } catch (e) {
        console.error('Erreur envoi crédit:', e);
      }
    }

    // Sync pour rafraîchir
    await window.syncFromServer?.();
    window.afficherCredits?.();
    window.refreshClientsData?.();

    // Clear le widget client
    window._cvClearClient?.();
  }

  // ══════════════════════════════════════════════════════════
  // 5. WRAPPER finaliserVenteCredit POUR AUSSI REFRESH CLIENTS
  // ══════════════════════════════════════════════════════════
  function wrapFinaliserVenteCredit() {
    function tryWrap() {
      var orig = window.finaliserVenteCredit;
      if (!orig || orig._fcsWrapped) return;

      window.finaliserVenteCredit = async function () {
        var client = window.clientVente?.getSelected?.();

        var result;
        try {
          result = await orig.apply(this, arguments);
        } catch (e) {
          throw e;
        }

        // Refresh après vente
        setTimeout(function () {
          window.refreshClientsData?.();
          window.afficherCredits?.();
          window.syncFromServer?.();
        }, 1500);

        return result;
      };
      window.finaliserVenteCredit._fcsWrapped = true;
    }
    tryWrap();
    setTimeout(tryWrap, 1500);
    setTimeout(tryWrap, 3000);
  }

  // ══════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════
  function init() {
    interceptCreditButton();
    wrapFinaliserVenteCredit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 700); });
  } else {
    setTimeout(init, 700);
  }

})();
