/**
 * enhanced-vente.js — Flux de vente amélioré
 *
 * Remplace le modal de paiement basique par une version complète :
 *   - Résumé du panier en haut (total, nb articles)
 *   - Sélection méthode avec grille visuelle
 *   - Calcul du rendu monnaie pour espèces
 *   - Montants rapides (arrondi supérieur)
 *   - Mode paiement mixte (ex: Wave + Espèces)
 *   - Bouton confirmer avec validation
 *
 * INTÉGRATION dans index.html :
 *   <link rel="stylesheet" href="css/enhanced-vente.css"> (dans <head>)
 *   <script src="js/enhanced-vente.js"></script> (avant </body>)
 */

(function () {

  // ══════════════════════════════════════
  // CONFIG
  // ══════════════════════════════════════
  var METHODS = [
    { id: 'especes', icon: '💵', name: 'Espèces',      showCash: true },
    { id: 'wave',    icon: '📱', name: 'Wave',          showCash: false },
    { id: 'orange',  icon: '📞', name: 'Orange Money',  showCash: false },
    { id: 'credit',  icon: '📝', name: 'Crédit',        showCash: false, isCredit: true },
  ];

  // Montants CFA courants pour le rendu monnaie
  var DENOMINATIONS = [100, 200, 500, 1000, 2000, 5000, 10000];

  var _selectedMethod = null;
  var _isMixte = false;
  var _overlayEl = null;
  var _modalEl = null;

  // ══════════════════════════════════════
  // UTILITAIRES
  // ══════════════════════════════════════
  function getTotal() {
    var panier = window.appData?.panier || [];
    var total = 0;
    panier.forEach(function (item) {
      total += (parseFloat(item.price) || 0) * (parseInt(item.quantite) || 0);
    });
    return total;
  }

  function getItemCount() {
    var panier = window.appData?.panier || [];
    var count = 0;
    panier.forEach(function (item) { count += (parseInt(item.quantite) || 0); });
    return count;
  }

  function fmt(n) {
    return Math.round(n).toLocaleString('fr-FR');
  }

  // Calculer les montants rapides (arrondis supérieurs par palier)
  function getQuickAmounts(total) {
    var amounts = [];
    // Montant exact
    amounts.push(total);
    // Arrondis supérieurs aux dénominations courantes
    DENOMINATIONS.forEach(function (d) {
      var rounded = Math.ceil(total / d) * d;
      if (rounded > total && amounts.indexOf(rounded) === -1) {
        amounts.push(rounded);
      }
    });
    // Trier et limiter
    amounts.sort(function (a, b) { return a - b; });
    return amounts.slice(0, 5);
  }

  // ══════════════════════════════════════
  // CONSTRUIRE LE MODAL
  // ══════════════════════════════════════
  function buildModal() {
    // Overlay
    _overlayEl = document.createElement('div');
    _overlayEl.id = 'ev-overlay';
    _overlayEl.style.cssText = 'position:fixed;inset:0;background:rgba(15,10,40,.5);backdrop-filter:blur(5px);z-index:200;display:none;align-items:center;justify-content:center;padding:12px;';
    _overlayEl.addEventListener('click', function (e) {
      if (e.target === _overlayEl) closeModal();
    });

    // Modal box
    _modalEl = document.createElement('div');
    _modalEl.className = 'modal-box ev-modal';
    _modalEl.style.cssText = 'animation:mIn .24s cubic-bezier(.34,1.4,.64,1) both;max-height:92dvh;overflow-y:auto;';

    _overlayEl.appendChild(_modalEl);
    document.body.appendChild(_overlayEl);
  }

  function renderModal() {
    var total = getTotal();
    var items = getItemCount();
    var panier = window.appData?.panier || [];

    if (!panier.length) {
      if (window.showNotification) window.showNotification('❌ Panier vide.', 'error');
      return;
    }

    // Résumé panier
    var html = '<div class="modal-title">💳 Encaisser</div>';
    html += '<div class="ev-summary">';
    html += '<div class="ev-summary-label">Total à encaisser</div>';
    html += '<div class="ev-summary-total">' + fmt(total) + ' F</div>';
    html += '<div class="ev-summary-detail">' + items + ' article' + (items > 1 ? 's' : '') + ' · ' + panier.length + ' produit' + (panier.length > 1 ? 's' : '') + '</div>';
    html += '</div>';

    // Méthodes de paiement
    html += '<div class="ev-methods" id="evMethods">';
    METHODS.forEach(function (m) {
      html += '<button class="ev-method-btn" data-method="' + m.id + '">';
      html += '<div class="ev-method-check">✓</div>';
      html += '<div class="ev-method-icon">' + m.icon + '</div>';
      html += '<div class="ev-method-name">' + m.name + '</div>';
      html += '</button>';
    });
    html += '</div>';

    // Toggle paiement mixte
    html += '<div class="ev-mixte-toggle" id="evMixteToggle">';
    html += '<div class="ev-mixte-switch" id="evMixteSwitch"></div>';
    html += '<span class="ev-mixte-label">Paiement mixte (ex: Wave + Espèces)</span>';
    html += '</div>';

    // Section mixte (masquée par défaut)
    html += '<div id="evMixteSection" style="display:none;"></div>';

    // Section rendu monnaie espèces
    html += '<div class="ev-cash-section" id="evCashSection">';
    html += '<div class="ev-cash-label">💵 Montant reçu du client</div>';
    html += '<div class="ev-cash-input-wrap">';
    html += '<input type="number" class="ev-cash-input" id="evCashInput" placeholder="0" inputmode="numeric">';
    html += '<span class="ev-cash-suffix">F CFA</span>';
    html += '</div>';
    html += '<div class="ev-quick-amounts" id="evQuickAmounts"></div>';
    html += '<div class="ev-change-display" id="evChangeDisplay">';
    html += '<div class="ev-change-label" id="evChangeLabel"></div>';
    html += '<div class="ev-change-amount" id="evChangeAmount"></div>';
    html += '</div>';
    html += '</div>';

    // Bouton confirmer
    html += '<button class="ev-confirm-btn" id="evConfirmBtn" disabled>💰 Sélectionnez un mode de paiement</button>';
    html += '<button class="ev-cancel-btn" onclick="">Annuler</button>';

    _modalEl.innerHTML = html;

    // ── Bindings ──
    bindMethods();
    bindMixteToggle();
    bindCashInput(total);
    bindConfirm(total);
    bindCancel();
    renderQuickAmounts(total);
  }

  // ══════════════════════════════════════
  // SÉLECTION MÉTHODE
  // ══════════════════════════════════════
  function bindMethods() {
    var btns = _modalEl.querySelectorAll('.ev-method-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (_isMixte) return; // En mode mixte, les méthodes ne sont pas sélectionnables via la grille
        window.haptic?.tap();
        selectMethod(btn.dataset.method);
      });
    });
  }

  function selectMethod(methodId) {
    _selectedMethod = methodId;

    // Highlight
    _modalEl.querySelectorAll('.ev-method-btn').forEach(function (btn) {
      btn.classList.toggle('selected', btn.dataset.method === methodId);
    });

    // Afficher/cacher section espèces
    var cashSection = document.getElementById('evCashSection');
    var method = METHODS.find(function (m) { return m.id === methodId; });

    if (method && method.showCash && !_isMixte) {
      cashSection.classList.add('visible');
      var input = document.getElementById('evCashInput');
      if (input) setTimeout(function () { input.focus(); }, 200);
    } else {
      cashSection.classList.remove('visible');
    }

    // Mettre à jour le bouton confirmer
    updateConfirmBtn();
  }

  function updateConfirmBtn() {
    var btn = document.getElementById('evConfirmBtn');
    if (!btn) return;

    if (_isMixte) {
      // Vérifier que le total mixte couvre le montant
      var remaining = getRemainingMixte();
      if (remaining <= 0) {
        btn.disabled = false;
        btn.textContent = '💰 Confirmer le paiement mixte';
      } else {
        btn.disabled = true;
        btn.textContent = '⚠️ Il reste ' + fmt(remaining) + ' F à répartir';
      }
    } else if (_selectedMethod) {
      btn.disabled = false;
      var method = METHODS.find(function (m) { return m.id === _selectedMethod; });
      btn.textContent = '💰 Encaisser en ' + (method ? method.name : '');
    } else {
      btn.disabled = true;
      btn.textContent = '💰 Sélectionnez un mode de paiement';
    }
  }

  // ══════════════════════════════════════
  // RENDU MONNAIE
  // ══════════════════════════════════════
  function bindCashInput(total) {
    var input = document.getElementById('evCashInput');
    if (!input) return;

    input.addEventListener('input', function () {
      var received = parseFloat(input.value) || 0;
      var change = received - total;
      var display = document.getElementById('evChangeDisplay');
      var label = document.getElementById('evChangeLabel');
      var amount = document.getElementById('evChangeAmount');

      if (!received || received === 0) {
        display.classList.remove('visible');
        return;
      }

      display.classList.add('visible');
      if (change >= 0) {
        display.className = 'ev-change-display visible positive';
        label.textContent = 'Monnaie à rendre';
        amount.textContent = fmt(change) + ' F';
      } else {
        display.className = 'ev-change-display visible negative';
        label.textContent = 'Il manque';
        amount.textContent = fmt(Math.abs(change)) + ' F';
      }
    });
  }

  function renderQuickAmounts(total) {
    var container = document.getElementById('evQuickAmounts');
    if (!container) return;

    var amounts = getQuickAmounts(total);
    container.innerHTML = '';

    amounts.forEach(function (a) {
      var btn = document.createElement('button');
      btn.className = 'ev-quick-btn';
      btn.textContent = fmt(a) + ' F';
      btn.addEventListener('click', function () {
        window.haptic?.tap();
        var input = document.getElementById('evCashInput');
        if (input) {
          input.value = a;
          input.dispatchEvent(new Event('input'));
        }
      });
      container.appendChild(btn);
    });
  }

  // ══════════════════════════════════════
  // PAIEMENT MIXTE
  // ══════════════════════════════════════
  function bindMixteToggle() {
    var toggle = document.getElementById('evMixteToggle');
    var sw = document.getElementById('evMixteSwitch');
    if (!toggle || !sw) return;

    toggle.addEventListener('click', function () {
      window.haptic?.tap();
      _isMixte = !_isMixte;
      sw.classList.toggle('on', _isMixte);

      // Deselect method
      _selectedMethod = null;
      _modalEl.querySelectorAll('.ev-method-btn').forEach(function (btn) {
        btn.classList.remove('selected');
      });

      // Afficher/cacher
      var section = document.getElementById('evMixteSection');
      var cashSection = document.getElementById('evCashSection');
      cashSection.classList.remove('visible');

      if (_isMixte) {
        section.style.display = 'block';
        renderMixteInputs();
      } else {
        section.style.display = 'none';
      }

      updateConfirmBtn();
    });
  }

  function renderMixteInputs() {
    var section = document.getElementById('evMixteSection');
    if (!section) return;

    var total = getTotal();
    var html = '';

    // Lignes pour chaque méthode (sauf crédit)
    METHODS.forEach(function (m) {
      if (m.isCredit) return;
      html += '<div class="ev-mixte-row">';
      html += '<div class="ev-mixte-method-icon">' + m.icon + '</div>';
      html += '<input type="number" class="ev-mixte-input" data-mixte-method="' + m.id + '" placeholder="0" inputmode="numeric">';
      html += '<span style="font-size:12px;font-weight:600;color:var(--muted);width:24px;">F</span>';
      html += '</div>';
    });

    html += '<div class="ev-mixte-remaining" id="evMixteRemaining">Reste à répartir : <strong>' + fmt(total) + ' F</strong></div>';

    section.innerHTML = html;

    // Bind inputs
    section.querySelectorAll('.ev-mixte-input').forEach(function (inp) {
      inp.addEventListener('input', function () {
        updateMixteRemaining();
        updateConfirmBtn();
      });
    });
  }

  function getMixteAmounts() {
    var amounts = {};
    var section = document.getElementById('evMixteSection');
    if (!section) return amounts;

    section.querySelectorAll('.ev-mixte-input').forEach(function (inp) {
      var val = parseFloat(inp.value) || 0;
      if (val > 0) {
        amounts[inp.dataset.mixteMethod] = val;
      }
    });
    return amounts;
  }

  function getRemainingMixte() {
    var total = getTotal();
    var amounts = getMixteAmounts();
    var paid = 0;
    Object.keys(amounts).forEach(function (k) { paid += amounts[k]; });
    return total - paid;
  }

  function updateMixteRemaining() {
    var el = document.getElementById('evMixteRemaining');
    if (!el) return;
    var remaining = getRemainingMixte();
    if (remaining <= 0) {
      el.className = 'ev-mixte-remaining ok';
      el.innerHTML = 'Total couvert <strong>✓</strong>';
    } else {
      el.className = 'ev-mixte-remaining';
      el.innerHTML = 'Reste à répartir : <strong>' + fmt(remaining) + ' F</strong>';
    }
  }

  // ══════════════════════════════════════
  // CONFIRMATION
  // ══════════════════════════════════════
  function bindConfirm(total) {
    var btn = document.getElementById('evConfirmBtn');
    if (!btn) return;

    btn.addEventListener('click', function () {
      if (btn.disabled) return;

      if (_isMixte) {
        // Paiement mixte → enregistrer comme la méthode majoritaire
        var amounts = getMixteAmounts();
        var maxMethod = 'especes';
        var maxAmount = 0;
        Object.keys(amounts).forEach(function (k) {
          if (amounts[k] > maxAmount) {
            maxAmount = amounts[k];
            maxMethod = k;
          }
        });

        // On enregistre avec la méthode principale + note dans la notification
        closeModal();
        window.finaliserVente?.(maxMethod);

        // Note informative
        var parts = [];
        Object.keys(amounts).forEach(function (k) {
          var m = METHODS.find(function (me) { return me.id === k; });
          if (m) parts.push(m.name + ' ' + fmt(amounts[k]) + ' F');
        });
        setTimeout(function () {
          if (window.showNotification) {
            window.showNotification('💳 Paiement mixte : ' + parts.join(' + '), 'info');
          }
        }, 2200);

      } else if (_selectedMethod) {
        if (_selectedMethod === 'credit') {
          closeModal();
          window.showModalCredit?.();
        } else {
          closeModal();
          window.finaliserVente?.(_selectedMethod);
        }
      }
    });
  }

  function bindCancel() {
    var btn = _modalEl.querySelector('.ev-cancel-btn');
    if (btn) btn.addEventListener('click', closeModal);
  }

  // ══════════════════════════════════════
  // OUVERTURE / FERMETURE
  // ══════════════════════════════════════
  function openModal() {
    if (!_overlayEl) buildModal();
    _selectedMethod = null;
    _isMixte = false;
    renderModal();
    _overlayEl.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (_overlayEl) _overlayEl.style.display = 'none';
    document.body.style.overflow = '';
  }

  // ══════════════════════════════════════
  // INTERCEPTER showModal('paiement')
  // ══════════════════════════════════════
  function hookShowModal() {
    var orig = window.showModal;
    if (!orig) {
      setTimeout(hookShowModal, 200);
      return;
    }
    if (orig._evHooked) return;

    var hooked = function (type) {
      if (type === 'paiement') {
        openModal();
        return;
      }
      orig(type);
    };
    hooked._evHooked = true;
    window.showModal = hooked;
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    buildModal();
    hookShowModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 400); });
  } else {
    setTimeout(init, 400);
  }

})();
