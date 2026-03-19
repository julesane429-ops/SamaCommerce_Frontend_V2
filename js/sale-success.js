/**
 * sale-success.js — Animation de succès après encaissement
 *
 * Affiche un overlay plein écran vert pendant 1.8s après chaque vente.
 * S'intègre en wrappant window.finaliserVente() APRÈS le chargement
 * du module app.js — aucune modification du JS existant requise.
 *
 * INTÉGRATION dans index.html, juste avant </body> :
 *   <script src="js/sale-success.js"></script>
 *   (après <script type="module" src="js/app.js"></script>)
 *
 * Méthodes de paiement reconnues :
 *   'especes' | 'wave' | 'orange' | 'credit'
 */

(function () {

  // ══════════════════════════════════════
  // CONFIG
  // ══════════════════════════════════════
  const DISPLAY_DURATION = 1800; // ms d'affichage

  const METHOD_LABELS = {
    especes: { icon: '💵', label: 'Espèces' },
    wave:    { icon: '📱', label: 'Wave' },
    orange:  { icon: '📞', label: 'Orange Money' },
    credit:  { icon: '📝', label: 'Crédit' },
  };

  // ══════════════════════════════════════
  // CRÉER L'OVERLAY (une seule fois)
  // ══════════════════════════════════════
  function buildOverlay() {
    if (document.getElementById('sale-success-overlay')) return;

    const el = document.createElement('div');
    el.id = 'sale-success-overlay';
    el.innerHTML = `
      <div class="ss-deco ss-deco-1"></div>
      <div class="ss-deco ss-deco-2"></div>

      <div class="ss-rings">
        <div class="ss-ring ss-ring-1"></div>
        <div class="ss-ring ss-ring-2"></div>
        <div class="ss-ring ss-ring-3"></div>
        <div class="ss-icon-wrap">
          <span class="ss-check">✓</span>
        </div>
      </div>

      <div class="ss-amount" id="ss-amount">0 F</div>
      <div class="ss-label">Vente enregistrée !</div>
      <div class="ss-method" id="ss-method">
        <span id="ss-method-icon">💵</span>
        <span id="ss-method-label">Espèces</span>
      </div>

      <div class="ss-timer-bar" id="ss-timer-bar"></div>
    `;

    document.body.appendChild(el);
  }

  // ══════════════════════════════════════
  // AFFICHER L'ANIMATION
  // ══════════════════════════════════════
  let hideTimer = null;

  function showSuccess(amount, paymentMethod) {
    buildOverlay();

    const overlay    = document.getElementById('sale-success-overlay');
    const amountEl   = document.getElementById('ss-amount');
    const iconEl     = document.getElementById('ss-method-icon');
    const labelEl    = document.getElementById('ss-method-label');
    const timerBar   = document.getElementById('ss-timer-bar');

    // Remplir les données
    const method = METHOD_LABELS[paymentMethod] || METHOD_LABELS.especes;
    amountEl.textContent = typeof amount === 'number'
      ? amount.toLocaleString('fr-FR') + ' F'
      : amount;
    iconEl.textContent  = method.icon;
    labelEl.textContent = method.label;

    // Réinitialiser la barre timer (en recrée une copie pour relancer l'animation CSS)
    const newBar = timerBar.cloneNode(true);
    timerBar.parentNode.replaceChild(newBar, timerBar);

    // Afficher
    overlay.classList.remove('hiding');
    overlay.classList.add('visible');

    // Vibration haptic sur mobile (si disponible)
    if (navigator.vibrate) {
      navigator.vibrate([60, 30, 60]);
    }

    // Masquer après la durée
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      overlay.classList.add('hiding');
      setTimeout(() => {
        overlay.classList.remove('visible', 'hiding');
      }, 320);
    }, DISPLAY_DURATION);
  }

  // ══════════════════════════════════════
  // LIRE LE MONTANT DU PANIER DEPUIS LE DOM
  // ══════════════════════════════════════
  function readTotalFromDOM() {
    const totalEl = document.getElementById('totalPanier');
    if (!totalEl) return 0;
    const raw = totalEl.textContent.replace(/\s/g, '').replace(/[^\d]/g, '');
    return parseInt(raw, 10) || 0;
  }

  // ══════════════════════════════════════
  // WRAPPER — intercepte finaliserVente()
  // ══════════════════════════════════════
  function installWrapper() {
    const originalFn = window.finaliserVente;

    if (typeof originalFn !== 'function') {
      // Le module n'est pas encore chargé — réessayer
      setTimeout(installWrapper, 150);
      return;
    }

    window.finaliserVente = async function (paymentMethod, ...args) {
      // Lire le montant AVANT la vente (le panier sera vidé après)
      const amount = readTotalFromDOM();

      // Appeler la fonction originale
      const result = await originalFn.call(this, paymentMethod, ...args);

      // Afficher l'animation uniquement si ce n'est pas un crédit
      // (le crédit a sa propre confirmation)
      if (paymentMethod !== 'credit') {
        showSuccess(amount, paymentMethod);
      }

      return result;
    };

    console.log('✅ sale-success: wrapper installé sur finaliserVente()');
  }

  // ══════════════════════════════════════
  // API PUBLIQUE (optionnelle)
  // ══════════════════════════════════════
  // Permet de tester l'animation manuellement depuis la console :
  // window.saleSuccess.show(15000, 'wave')
  window.saleSuccess = { show: showSuccess };

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  // On attend que les modules ES soient chargés (après window.load)
  window.addEventListener('load', () => {
    // Petit délai pour s'assurer que app.js a fini d'exposer finaliserVente
    setTimeout(installWrapper, 200);
  });

})();
