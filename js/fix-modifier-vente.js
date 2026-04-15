/**
 * fix-modifier-vente.js — Remplace les prompt() natifs
 *
 * Le modal #modalModifierVente et son handler dans app.js existent déjà.
 * Ce script redirige modifierVente(id) vers ce modal
 * au lieu d'utiliser prompt().
 *
 * Ajoute aussi un résumé contextuel (produit, montant, date)
 * en haut du modal pour que le commerçant sache quelle vente il modifie.
 *
 * INTÉGRATION : <script src="js/fix-modifier-vente.js"></script>
 */

(function () {

  var _ready = false;

  function init() {
    if (_ready) return;
    if (!window.modifierVente || !window.appData) {
      setTimeout(init, 300);
      return;
    }
    _ready = true;
    override();
  }

  function override() {
    window.modifierVente = function (id) {
      var vente = null;
      var ventes = window.appData?.ventes || [];

      for (var i = 0; i < ventes.length; i++) {
        if (Number(ventes[i].id) === Number(id)) {
          vente = ventes[i];
          break;
        }
      }

      if (!vente) {
        window.showNotification?.('❌ Vente introuvable', 'error');
        return;
      }

      window.haptic?.tap();

      var venteIdInput = document.getElementById('venteId');
      var qtyInput     = document.getElementById('venteQuantite');
      var payInput     = document.getElementById('ventePaiement');
      var modal        = document.getElementById('modalModifierVente');

      if (!modal || !venteIdInput || !qtyInput || !payInput) {
        console.warn('Modal #modalModifierVente introuvable');
        return;
      }

      // Remplir les champs
      venteIdInput.value = vente.id;
      qtyInput.value     = vente.quantity || 1;
      payInput.value     = (vente.payment_method || 'especes').toLowerCase();

      // Ajouter résumé contextuel
      enrichModal(modal, vente);

      // Afficher
      modal.classList.remove('hidden');
      modal.classList.add('flex');

      setTimeout(function () { qtyInput.focus(); qtyInput.select(); }, 250);
    };
  }

  function enrichModal(modal, vente) {
    var old = modal.querySelector('.fmv-summary');
    if (old) old.remove();

    var produit = (window.appData?.produits || []).find(function (p) {
      return Number(p.id) === Number(vente.product_id);
    });

    var name    = vente.product_name || (produit ? produit.name : 'Produit');
    var total   = Number(vente.total) || 0;
    var date    = vente.date || vente.created_at;
    var dateStr = date ? new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }) : '';

    var el = document.createElement('div');
    el.className = 'fmv-summary';
    el.style.cssText = 'background:var(--bg,#F5F3FF);border-radius:12px;padding:12px 14px;margin-bottom:14px;text-align:center;';
    el.innerHTML =
      '<div style="font-family:Sora,sans-serif;font-size:14px;font-weight:700;color:var(--text);">' + escHtml(name) + '</div>' +
      '<div style="font-size:18px;font-weight:800;color:var(--primary);margin-top:4px;">' + Math.round(total).toLocaleString('fr-FR') + ' F</div>' +
      (dateStr ? '<div style="font-size:11px;color:var(--muted);margin-top:2px;">' + dateStr + '</div>' : '');

    var title = modal.querySelector('.modal-title');
    if (title) title.insertAdjacentElement('afterend', el);
  }

  function escHtml(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }

})();

// ══════════════════════════════════════
// REMPLACEMENT GLOBAL de prompt() natif
// → modal input custom cohérent avec le design
// ══════════════════════════════════════
(function () {
  var _origPrompt = window.prompt;

  window.prompt = function (message, defaultValue) {
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,10,40,.5);backdrop-filter:blur(5px);z-index:250;display:flex;align-items:center;justify-content:center;padding:16px;';

      var box = document.createElement('div');
      box.className = 'modal-box';
      box.style.cssText = 'animation:mIn .24s cubic-bezier(.34,1.4,.64,1) both;';
      box.innerHTML =
        '<div class="modal-title" style="font-size:16px;">' + (message || 'Saisir une valeur') + '</div>' +
        '<input type="text" id="customPromptInput" value="' + (defaultValue || '') + '" ' +
        'style="width:100%;padding:12px 14px;border:2px solid rgba(124,58,237,.15);border-radius:12px;' +
        'font-family:Sora,sans-serif;font-size:15px;font-weight:600;color:var(--text);outline:none;' +
        'margin-bottom:14px;" autofocus>' +
        '<div class="modal-actions">' +
        '<button class="btn-cancel" id="customPromptCancel">Annuler</button>' +
        '<button class="btn-confirm" id="customPromptOk">Confirmer</button>' +
        '</div>';

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      var input = box.querySelector('#customPromptInput');
      setTimeout(function () { input.focus(); input.select(); }, 200);

      box.querySelector('#customPromptOk').addEventListener('click', function () {
        var val = input.value;
        overlay.remove();
        resolve(val || null);
      });

      box.querySelector('#customPromptCancel').addEventListener('click', function () {
        overlay.remove();
        resolve(null);
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { box.querySelector('#customPromptOk').click(); }
        if (e.key === 'Escape') { box.querySelector('#customPromptCancel').click(); }
      });
    });
  };
})();
