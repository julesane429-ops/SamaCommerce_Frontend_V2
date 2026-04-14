/**
 * fix-modifier-vente.js — Remplace prompt() par le modal existant
 *
 * Le modal #modalModifierVente et le form handler existent déjà dans
 * app.js — mais modifierVente() les ignore et utilise prompt().
 * 
 * Ce script :
 *   1. Override window.modifierVente pour utiliser ouvrirModal()
 *   2. Améliore le modal existant (meilleur style, infos produit)
 *   3. Remplace aussi le prompt() dans deliveries.js
 *
 * INTÉGRATION : <script src="js/fix-modifier-vente.js"></script>
 */

(function () {

  // ══════════════════════════════════════
  // OVERRIDE modifierVente
  // ══════════════════════════════════════
  function hookModifierVente() {
    // Attendre que appData et ouvrirModal soient dispo
    if (!window.appData || !window.ouvrirModal) {
      setTimeout(hookModifierVente, 300);
      return;
    }

    window.modifierVente = function (id) {
      var vente = null;
      var ventes = window.appData.ventes || [];
      for (var i = 0; i < ventes.length; i++) {
        if (Number(ventes[i].id) === Number(id)) {
          vente = ventes[i];
          break;
        }
      }

      if (!vente) {
        if (window.showNotification) {
          window.showNotification('❌ Vente introuvable', 'error');
        }
        return;
      }

      // Enrichir le modal avec les infos du produit
      enrichModal(vente);

      // Ouvrir avec la fonction existante
      window.ouvrirModal(vente);

      // S'assurer que le modal est visible dans l'overlay
      showEditOverlay();
    };
  }

  // ══════════════════════════════════════
  // ENRICHIR LE MODAL
  // ══════════════════════════════════════
  function enrichModal(vente) {
    var modal = document.getElementById('modalModifierVente');
    if (!modal) return;

    // Trouver le produit
    var produits = window.appData?.produits || [];
    var produit = null;
    for (var i = 0; i < produits.length; i++) {
      if (Number(produits[i].id) === Number(vente.product_id)) {
        produit = produits[i];
        break;
      }
    }

    // Injecter ou mettre à jour le résumé en haut du modal
    var summaryId = 'fmv-summary';
    var summary = document.getElementById(summaryId);
    if (!summary) {
      summary = document.createElement('div');
      summary.id = summaryId;
      summary.style.cssText = 'background:var(--bg,#F5F3FF);border-radius:12px;padding:12px 14px;margin-bottom:14px;text-align:center;';
      // Insérer après le titre
      var title = modal.querySelector('.modal-title');
      if (title) {
        title.insertAdjacentElement('afterend', summary);
      }
    }

    var prodName = vente.product_name || (produit ? produit.name : 'Produit inconnu');
    var montant = Number(vente.total) || 0;
    var date = new Date(vente.date || vente.created_at);
    var dateStr = isNaN(date.getTime()) ? '' : date.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });

    summary.innerHTML =
      '<div style="font-family:\'Sora\',sans-serif;font-size:15px;font-weight:800;color:var(--text);">' + escapeHtml(prodName) + '</div>' +
      '<div style="font-size:12px;color:var(--muted);margin-top:3px;">' +
        montant.toLocaleString('fr-FR') + ' F · ' + dateStr +
      '</div>';

    // Ajuster le stock max sur l'input quantité
    var qtyInput = document.getElementById('venteQuantite');
    if (qtyInput && produit) {
      // Max = stock actuel + quantité de cette vente (puisqu'on modifie)
      var maxQty = (produit.stock || 0) + (vente.quantity || 0);
      qtyInput.setAttribute('max', maxQty);
      qtyInput.setAttribute('min', '1');
      qtyInput.setAttribute('placeholder', 'Max: ' + maxQty);
    }
  }

  // ══════════════════════════════════════
  // OVERLAY POUR LE MODAL
  // ══════════════════════════════════════
  // Le modal existant n'a pas d'overlay — on en ajoute un
  function showEditOverlay() {
    var modal = document.getElementById('modalModifierVente');
    if (!modal) return;

    // Vérifier si un overlay existe déjà
    var overlayId = 'fmv-overlay';
    var overlay = document.getElementById(overlayId);

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = overlayId;
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,10,40,.5);backdrop-filter:blur(5px);z-index:199;display:flex;align-items:center;justify-content:center;padding:12px;';

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          closeEditOverlay();
        }
      });

      document.body.appendChild(overlay);
    }

    // Déplacer le modal dans l'overlay
    overlay.style.display = 'flex';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.style.zIndex = '200';
    modal.style.position = 'relative';

    if (modal.parentNode !== overlay) {
      overlay.appendChild(modal);
    }

    document.body.style.overflow = 'hidden';
  }

  function closeEditOverlay() {
    var overlay = document.getElementById('fmv-overlay');
    var modal = document.getElementById('modalModifierVente');

    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    if (overlay) {
      overlay.style.display = 'none';
    }
    document.body.style.overflow = '';
  }

  // Hook fermerModal pour aussi fermer l'overlay
  function hookFermerModal() {
    var orig = window.fermerModal;
    if (!orig) {
      setTimeout(hookFermerModal, 300);
      return;
    }
    if (orig._fmvHooked) return;

    var hooked = function () {
      orig();
      closeEditOverlay();
    };
    hooked._fmvHooked = true;
    window.fermerModal = hooked;
  }

  // ══════════════════════════════════════
  // UTILITAIRES
  // ══════════════════════════════════════
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    hookModifierVente();
    hookFermerModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }

})();
