/**
 * countup.js v2 — Animation des compteurs de statistiques
 *
 * CORRECTIF : le flag `_animating` empêche le MutationObserver
 * de se re-déclencher pendant que l'animation écrit dans le DOM,
 * ce qui causait une boucle infinie (nombres qui "vibrent").
 *
 * INTÉGRATION dans index.html, juste avant </body> :
 *   <script src="js/countup.js"></script>
 */

(function () {

  const TARGETS = [
    'chiffreAffaires', 'articlesVendus', 'stockTotal',
    'recettesJour', 'recettesSemaine', 'recettesMois', 'recettesTout',
    'caEncaisse', 'caEnAttente', 'creditsEnCours', 'tauxRecouvrement',
    'creditsTotalEncours', 'creditsTotalRembourses', 'creditsTotalImpaye',
    'totalPanier',
  ];

  const DURATION = 650; // ms
  const STEPS    = 36;  // frames (~60fps sur 650ms)

  // ── Extraire la valeur numérique ──
  function parseValue(str) {
    if (!str) return 0;
    const m = str.replace(/[\s\u00a0]/g, '').replace(',', '.').match(/-?[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
  }

  // ── Extraire le suffixe (" F", " %", etc.) ──
  function parseSuffix(str) {
    if (!str) return '';
    // Tout ce qui suit le dernier chiffre
    const m = str.match(/[\d\s\u00a0,.]+(.*)$/);
    return m ? m[1] : '';
  }

  // ── Formater un nombre ──
  function fmt(n, decimal) {
    if (decimal) return n.toFixed(1);
    return Math.round(n).toLocaleString('fr-FR').replace(/,/g, '\u00a0');
  }

  // ── Easing ──
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  // ── Animer from → to ──
  function animateTo(el, from, to, suffix, decimal) {
    if (Math.abs(to - from) < 1) return;

    // Annuler l'animation précédente
    if (el._cuTimer) { clearInterval(el._cuTimer); el._cuTimer = null; }

    let step = 0;
    el._animating = true; // bloquer l'observer

    el._cuTimer = setInterval(() => {
      step++;
      const val = from + (to - from) * easeOut(step / STEPS);
      el.textContent = fmt(val, decimal) + suffix;

      if (step >= STEPS) {
        clearInterval(el._cuTimer);
        el._cuTimer = null;
        el.textContent = fmt(to, decimal) + suffix;
        // Débloquer l'observer après un court délai
        // pour absorber le dernier changement qu'on vient d'écrire
        setTimeout(() => { el._animating = false; }, 100);
      }
    }, DURATION / STEPS);
  }

  // ── Attacher un observer sur un élément ──
  function watch(el) {
    let lastText = el.textContent.trim();
    el._animating = false;

    const observer = new MutationObserver(() => {
      // Si c'est notre propre animation qui modifie le DOM → ignorer
      if (el._animating) return;

      const newText = el.textContent.trim();
      if (newText === lastText) return; // pas de vrai changement

      const from    = parseValue(lastText);
      const to      = parseValue(newText);
      const suffix  = parseSuffix(newText);
      const decimal = newText.includes('.');

      // Mettre à jour lastText AVANT de lancer l'animation
      // (évite de comparer avec une valeur obsolète si l'observer refire)
      lastText = newText;

      animateTo(el, from, to, suffix, decimal);
    });

    observer.observe(el, { characterData: true, childList: true, subtree: true });
  }

  // ── Init ──
  function init() {
    TARGETS.forEach(id => {
      const el = document.getElementById(id);
      if (el) watch(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
