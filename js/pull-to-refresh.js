/**
 * pull-to-refresh.js — Geste pull-to-refresh pour Sama Commerce
 *
 * Écoute le scroll du conteneur .scroll-content.
 * Quand l'utilisateur tire vers le bas depuis le haut de la page,
 * déclenche syncFromServer() + toutes les fonctions d'affichage.
 *
 * INTÉGRATION dans index.html, juste avant </body> :
 *   <script src="js/pull-to-refresh.js"></script>
 *
 * Aucune modification du JS existant requise.
 */

(function () {

  // ══════════════════════════════════════
  // CONFIG
  // ══════════════════════════════════════
  const THRESHOLD    = 72;   // px de tirage nécessaire pour déclencher
  const MAX_PULL     = 100;  // px max avant résistance totale
  const RESISTANCE   = 0.45; // facteur de résistance (0 = libre, 1 = bloqué)
  const SUCCESS_DURATION = 2000; // ms d'affichage du bandeau de succès

  // ══════════════════════════════════════
  // DOM
  // ══════════════════════════════════════
  function buildUI() {
    // Indicateur rond (flèche + spinner)
    const indicator = document.createElement('div');
    indicator.id = 'ptr-indicator';
    indicator.className = 'ptr-pulling';
    indicator.innerHTML = `
      <span class="ptr-arrow">↓</span>
      <div class="ptr-spinner"></div>
    `;

    // Texte d'invite
    const hint = document.createElement('div');
    hint.id = 'ptr-hint';
    hint.textContent = 'Tirer pour rafraîchir';

    // Bandeau succès
    const success = document.createElement('div');
    success.id = 'ptr-success';
    success.textContent = '✅ Données mises à jour';

    // Insérer dans le scroll-content (position relative nécessaire)
    const scrollEl = document.querySelector('.scroll-content');
    if (!scrollEl) return null;
    scrollEl.style.position = 'relative';
    scrollEl.prepend(hint);
    scrollEl.prepend(indicator);
    document.body.appendChild(success);

    return { indicator, hint, success, scrollEl };
  }

  // ══════════════════════════════════════
  // LOGIQUE
  // ══════════════════════════════════════
  function init() {
    const ui = buildUI();
    if (!ui) return;

    const { indicator, hint, success, scrollEl } = ui;
    const arrow = indicator.querySelector('.ptr-arrow');

    let startY     = 0;
    let pulling    = false;
    let loading    = false;
    let currentPull = 0;

    // ── Touch start ──
    scrollEl.addEventListener('touchstart', (e) => {
      if (loading) return;
      if (scrollEl.scrollTop > 0) return; // Pas au sommet
      startY = e.touches[0].clientY;
      pulling = true;
    }, { passive: true });

    // ── Touch move ──
    scrollEl.addEventListener('touchmove', (e) => {
      if (!pulling || loading) return;
      if (scrollEl.scrollTop > 0) { pulling = false; return; }

      const delta = e.touches[0].clientY - startY;
      if (delta <= 0) return;

      // Résistance progressive
      currentPull = Math.min(delta * RESISTANCE, MAX_PULL);

      // Mettre à jour l'indicateur
      const ratio = Math.min(currentPull / THRESHOLD, 1);

      indicator.classList.add('ptr-visible');
      indicator.style.transform = `translateX(-50%) translateY(${8 + currentPull * 0.4}px)`;

      // Rotation de la flèche selon la progression
      const rotation = ratio * 180;
      arrow.style.transform = `rotate(${rotation}deg)`;
      arrow.style.color = ratio >= 1 ? '#7C3AED' : '#A78BFA';

      // Texte d'invite
      if (ratio >= 1) {
        hint.textContent = 'Relâcher pour rafraîchir';
        hint.style.color = '#7C3AED';
      } else {
        hint.textContent = 'Tirer pour rafraîchir';
        hint.style.color = 'rgba(124,58,237,.6)';
      }
      hint.classList.add('ptr-hint-visible');

    }, { passive: true });

    // ── Touch end ──
    scrollEl.addEventListener('touchend', async () => {
      if (!pulling || loading) return;
      pulling = false;

      const triggered = currentPull >= THRESHOLD;
      currentPull = 0;

      hint.classList.remove('ptr-hint-visible');

      if (!triggered) {
        // Pas assez de tirage → reset
        reset();
        return;
      }

      // ─ Déclencher le refresh ─
      loading = true;
      indicator.classList.remove('ptr-pulling');
      indicator.classList.add('ptr-loading');
      indicator.style.transform = `translateX(-50%) translateY(14px)`;

      try {
        await doRefresh();
        showSuccess();
      } catch (err) {
        console.warn('PTR refresh error:', err);
      } finally {
        loading = false;
        reset();
      }
    }, { passive: true });

    // ── Reset visuel ──
    function reset() {
      indicator.classList.remove('ptr-visible', 'ptr-loading');
      indicator.classList.add('ptr-pulling');
      indicator.style.transform = '';
      arrow.style.transform = '';
      arrow.style.color = '';
    }

    // ── Bandeau succès ──
    function showSuccess() {
      success.classList.add('ptr-success-visible');
      setTimeout(() => success.classList.remove('ptr-success-visible'), SUCCESS_DURATION);
    }

    // ── Appeler les fonctions de sync existantes ──
    async function doRefresh() {
      // syncFromServer est exposé sur window par index.js
      if (typeof window.syncFromServer === 'function') {
        await window.syncFromServer();
      }

      // Rafraîchir toutes les vues
      const fns = [
        'updateStats',
        'verifierStockFaible',
        'afficherCategoriesVente',
        'afficherProduits',
        'afficherCategories',
        'afficherRapports',
        'afficherInventaire',
        'afficherCredits',
        'renderCreditsHistory',
      ];

      fns.forEach(name => {
        if (typeof window[name] === 'function') {
          try { window[name](); } catch (e) { /* silencieux */ }
        }
      });
    }
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
