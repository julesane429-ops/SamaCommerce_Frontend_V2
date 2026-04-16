/**
 * fix-credit-close.js — Corriger la fermeture du modal crédit
 *
 * BUG : hideModalCredit() dans modal.js fait :
 *   modalCredit.classList.add('hidden')
 *   modalPaiement.classList.remove('hidden')  ← ré-affiche l'ancien modal !
 *
 * Comportement voulu : fermer TOUT (modal crédit + overlay) sans rouvrir
 * modalPaiement qui est l'ancien "💳 Mode de paiement" devenu obsolète
 * depuis que enhanced-vente.js le remplace.
 *
 * INTÉGRATION : <script src="js/fix-credit-close.js"></script>
 */

(function () {

  function closeEverything() {
    var mc = document.getElementById('modalCredit');
    var mp = document.getElementById('modalPaiement');
    var overlay = document.getElementById('modalOverlay');

    if (mc) mc.classList.add('hidden');
    if (mp) mp.classList.add('hidden');  // Cacher AUSSI modalPaiement
    if (overlay) overlay.classList.add('hidden');  // Fermer le fond noir

    // Réinitialiser les champs
    ['creditClientName', 'creditClientPhone', 'creditDueDate'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
  }

  function patchHideModalCredit() {
    // Remplacer window.hideModalCredit
    window.hideModalCredit = closeEverything;

    // Aussi intercepter le bouton "Annuler" du modal crédit
    // qui a onclick="hideModalCredit()" inline
    document.addEventListener('click', function (e) {
      var cancelBtn = e.target.closest('#modalCredit .btn-cancel');
      if (cancelBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeEverything();
      }
    }, true);
  }

  // Aussi s'assurer qu'après un enregistrement réussi
  // (finaliserVenteCredit), tout se ferme bien
  function patchFinalizerClosing() {
    function tryPatch() {
      var orig = window.finaliserVenteCredit;
      if (!orig || orig._fccClose) return;

      window.finaliserVenteCredit = async function () {
        var result = await orig.apply(this, arguments);
        // Après enregistrement, fermer TOUT
        setTimeout(closeEverything, 100);
        return result;
      };
      // Préserver les flags existants
      Object.keys(orig).forEach(function (k) {
        if (k !== '_fccClose') window.finaliserVenteCredit[k] = orig[k];
      });
      window.finaliserVenteCredit._fccClose = true;
    }
    tryPatch();
    setTimeout(tryPatch, 1500);
    setTimeout(tryPatch, 3000);
  }

  function init() {
    patchHideModalCredit();
    patchFinalizerClosing();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 600); });
  } else {
    setTimeout(init, 600);
  }

})();
