/**
 * ux-polish.js — Validation, PWA banner, micro-interactions (#3, #9, #12)
 *
 * #3 — Validation formulaires en temps réel :
 *      Valide les inputs des modals (produit, catégorie, crédit).
 *      Bordure rouge + message inline + bouton désactivé si invalide.
 *
 * #9 — Bannière PWA attractive :
 *      Remplace le bouton "Installer" caché par une bannière
 *      slide-up élégante. Apparaît après 3 visites.
 *
 * #12 — Micro-interactions :
 *      Ripple effect Material-style sur les boutons.
 *      Flash vert quand un produit est ajouté au panier.
 *
 * INTÉGRATION : <script src="js/ux-polish.js"></script>
 */

(function () {

  // ══════════════════════════════════════
  // #3 — VALIDATION FORMULAIRES
  // ══════════════════════════════════════
  var RULES = {
    newProdName:     { msg: 'Le nom du produit est requis', test: function (v) { return v.trim().length > 0; } },
    newProdPrice:    { msg: 'Le prix doit être supérieur à 0', test: function (v) { return parseFloat(v) > 0; } },
    newProdStock:    { msg: 'Le stock doit être 0 ou plus', test: function (v) { return v === '' || parseInt(v) >= 0; } },
    newProdPriceA:   { msg: 'Le prix d\'achat doit être ≥ 0', test: function (v) { return v === '' || parseFloat(v) >= 0; } },
    editProdName:    { msg: 'Le nom est requis', test: function (v) { return v.trim().length > 0; } },
    editProdPrice:   { msg: 'Le prix doit être > 0', test: function (v) { return parseFloat(v) > 0; } },
    editProdStock:   { msg: 'Stock ≥ 0', test: function (v) { return v === '' || parseInt(v) >= 0; } },
    newCatName:      { msg: 'Le nom de la catégorie est requis', test: function (v) { return v.trim().length > 0; } },
    creditClientName:  { msg: 'Le nom du client est requis', test: function (v) { return v.trim().length > 0; } },
    creditClientPhone: { msg: 'Numéro de téléphone requis', test: function (v) { return v.trim().length >= 5; } },
    creditDueDate:     { msg: 'Date d\'échéance requise', test: function (v) { return v.length > 0; } },
    venteQuantite:     { msg: 'Quantité > 0', test: function (v) { return parseInt(v) > 0; } },
  };

  function setupValidation() {
    Object.keys(RULES).forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      if (input._uxfSetup) return;
      input._uxfSetup = true;

      var rule = RULES[id];

      // Créer le message d'erreur
      var errEl = document.createElement('div');
      errEl.className = 'uxf-error-msg';
      errEl.textContent = rule.msg;
      input.parentNode.appendChild(errEl);

      // Valider au blur et à l'input
      function validate() {
        var valid = rule.test(input.value);
        input.classList.toggle('uxf-error', !valid);
        input.classList.toggle('uxf-valid', valid && input.value.length > 0);
        errEl.classList.toggle('visible', !valid && input.value.length > 0);
        updateSubmitButton(input);
        return valid;
      }

      input.addEventListener('input', validate);
      input.addEventListener('blur', validate);
    });
  }

  function updateSubmitButton(input) {
    // Trouver le modal parent
    var modal = input.closest('.modal-box') || input.closest('form');
    if (!modal) return;

    var btn = modal.querySelector('.btn-confirm') || modal.querySelector('[type="submit"]');
    if (!btn) return;

    // Vérifier tous les inputs du modal
    var allValid = true;
    modal.querySelectorAll('input[id]').forEach(function (inp) {
      var rule = RULES[inp.id];
      if (rule && inp.value.length > 0 && !rule.test(inp.value)) {
        allValid = false;
      }
    });

    btn.disabled = !allValid;
  }

  // Observer pour les modals qui apparaissent dynamiquement
  function watchModals() {
    var observer = new MutationObserver(function () {
      setupValidation();
    });
    var overlay = document.getElementById('modalOverlay');
    if (overlay) observer.observe(overlay, { childList: true, subtree: true, attributes: true });
    // Aussi surveiller les modals standalone
    document.querySelectorAll('.modal-box').forEach(function (m) {
      observer.observe(m, { childList: true, subtree: true, attributes: true });
    });
    setupValidation();
  }

  // ══════════════════════════════════════
  // #9 — BANNIÈRE PWA
  // ══════════════════════════════════════
  var PWA_VISIT_KEY = 'sc_pwa_visits';
  var PWA_DISMISSED_KEY = 'sc_pwa_dismissed';

  function setupPWABanner() {
    // Ne pas afficher si déjà installé ou déjà fermé
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (localStorage.getItem(PWA_DISMISSED_KEY) === 'true') return;

    // Compter les visites
    var visits = parseInt(localStorage.getItem(PWA_VISIT_KEY) || '0') + 1;
    localStorage.setItem(PWA_VISIT_KEY, String(visits));

    // Apparaître après 3 visites
    if (visits < 3) return;

    // Capturer le beforeinstallprompt
    var deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;

      // Cacher l'ancien bouton
      var oldBtn = document.getElementById('installBtn');
      if (oldBtn) oldBtn.style.display = 'none';

      // Afficher la bannière après un délai
      setTimeout(showBanner, 2000);
    });

    function showBanner() {
      if (document.querySelector('.uxp-banner')) return;

      var banner = document.createElement('div');
      banner.className = 'uxp-banner show';
      banner.innerHTML =
        '<button class="uxp-banner-close" aria-label="Fermer">&times;</button>' +
        '<div class="uxp-banner-icon">📲</div>' +
        '<div class="uxp-banner-text">' +
          '<div class="uxp-banner-title">Installer Sama Commerce</div>' +
          '<div class="uxp-banner-sub">Accédez à votre boutique depuis l\'écran d\'accueil</div>' +
        '</div>' +
        '<button class="uxp-banner-btn" id="uxpInstall">Installer</button>';

      document.body.appendChild(banner);

      banner.querySelector('#uxpInstall').addEventListener('click', function () {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(function () {
            deferredPrompt = null;
            banner.remove();
          });
        }
      });

      banner.querySelector('.uxp-banner-close').addEventListener('click', function () {
        localStorage.setItem(PWA_DISMISSED_KEY, 'true');
        banner.classList.remove('show');
        setTimeout(function () { banner.remove(); }, 300);
      });
    }
  }

  // ══════════════════════════════════════
  // #12 — RIPPLE EFFECT
  // ══════════════════════════════════════
  function setupRipple() {
    // Ajouter le ripple sur les boutons existants
    var selectors = [
      '.action-btn', '.btn-encaisser', '.btn-primary', '.btn-confirm',
      '.pay-btn', '.nav-btn', '.nav-fab', '.sheet-item', '.ep-item',
      '.ep-fav-chip', '.ev-method-btn', '.ev-confirm-btn',
      '.filtre-btn', '.uxv-chip'
    ];

    document.addEventListener('pointerdown', function (e) {
      var target = e.target.closest(selectors.join(','));
      if (!target) return;

      // Créer l'onde
      var rect = target.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var size = Math.max(rect.width, rect.height) * 2;

      var wave = document.createElement('span');
      wave.className = 'ux-ripple-wave';
      wave.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + (x - size / 2) + 'px;top:' + (y - size / 2) + 'px;';

      // S'assurer que le parent a overflow hidden + position relative
      if (!target.classList.contains('ux-ripple')) {
        target.style.position = target.style.position || 'relative';
        target.style.overflow = 'hidden';
      }

      target.appendChild(wave);
      setTimeout(function () { wave.remove(); }, 500);
    }, { passive: true });
  }

  // ══════════════════════════════════════
  // #12 — FLASH AJOUT PANIER
  // ══════════════════════════════════════
  function setupCartFlash() {
    var origAjouter = window.ajouterAuPanier;
    if (!origAjouter || origAjouter._uxPolished) return;

    window.ajouterAuPanier = function (produit) {
      origAjouter(produit);

      // Flash sur la carte panier
      var panierCard = document.querySelector('#venteSection .card');
      if (panierCard) {
        panierCard.classList.add('ux-flash');
        setTimeout(function () { panierCard.classList.remove('ux-flash'); }, 400);
      }

      // Bounce sur le badge nav-fab
      var badge = document.querySelector('.qw-cart-badge');
      if (badge) {
        badge.classList.remove('ux-bounce');
        void badge.offsetWidth;
        badge.classList.add('ux-bounce');
      }
    };
    window.ajouterAuPanier._uxPolished = true;
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    watchModals();
    setupPWABanner();
    setupRipple();

    // Attendre que ajouterAuPanier soit dispo
    function waitCart() {
      if (window.ajouterAuPanier) { setupCartFlash(); }
      else { setTimeout(waitCart, 300); }
    }
    waitCart();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }

})();
