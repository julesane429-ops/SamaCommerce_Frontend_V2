/**
 * countup.js — Animation des compteurs de statistiques
 *
 * Observe les éléments dont le contenu change (chiffres)
 * et anime le passage de l'ancienne valeur vers la nouvelle.
 *
 * Cible automatiquement les IDs suivants (déjà dans le HTML) :
 *   #chiffreAffaires, #articlesVendus, #stockTotal,
 *   #recettesJour, #recettesSemaine, #recettesMois, #recettesTout,
 *   #caEncaisse, #caEnAttente, #creditsEnCours,
 *   #creditsTotalEncours, #creditsTotalRembourses, #creditsTotalImpaye
 *
 * INTÉGRATION :
 *   Ajouter dans index.html, juste avant </body> :
 *   <script src="js/countup.js"></script>
 *
 * Aucune dépendance. Aucun import requis.
 */

(function () {

  // ── IDs à observer ──
  const TARGETS = [
    'chiffreAffaires',
    'articlesVendus',
    'stockTotal',
    'recettesJour',
    'recettesSemaine',
    'recettesMois',
    'recettesTout',
    'caEncaisse',
    'caEnAttente',
    'creditsEnCours',
    'tauxRecouvrement',
    'creditsTotalEncours',
    'creditsTotalRembourses',
    'creditsTotalImpaye',
    'totalPanier',
  ];

  const DURATION = 650; // ms
  const FPS      = 60;
  const STEP_MS  = 1000 / FPS;

  // ── Extraire la valeur numérique d'un string ──
  // "15 000 F" → 15000 | "87.5 %" → 87.5 | "0" → 0
  function parseValue(str) {
    if (!str) return 0;
    const cleaned = str.replace(/\s/g, '').replace(',', '.');
    const match = cleaned.match(/-?[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }

  // ── Conserver le suffixe d'un string ──
  // "15 000 F" → " F" | "87.5 %" → " %" | "42" → ""
  function parseSuffix(str) {
    if (!str) return '';
    const match = str.match(/[\d\s,.]+(.*)$/);
    return match ? match[1] : '';
  }

  // ── Formater un nombre avec espaces comme séparateur ──
  function formatNumber(n, isDecimal) {
    if (isDecimal) {
      return n.toFixed(1);
    }
    return Math.round(n).toLocaleString('fr-FR').replace(/,/g, ' ');
  }

  // ── Animer un élément de fromVal vers toVal ──
  function animateTo(el, fromVal, toVal, suffix, isDecimal) {
    // Ne pas animer si la différence est nulle ou trop petite
    if (Math.abs(toVal - fromVal) < 0.5) return;

    const steps    = Math.round(DURATION / STEP_MS);
    let   step     = 0;

    // Easing easeOutCubic
    function ease(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    const interval = setInterval(() => {
      step++;
      const progress = ease(step / steps);
      const current  = fromVal + (toVal - fromVal) * progress;
      el.textContent = formatNumber(current, isDecimal) + suffix;

      if (step >= steps) {
        clearInterval(interval);
        el.textContent = formatNumber(toVal, isDecimal) + suffix;
      }
    }, STEP_MS);

    // Stocker le timer pour pouvoir l'annuler si une nouvelle valeur arrive
    el._countupTimer = interval;
  }

  // ── Attacher un MutationObserver à chaque élément cible ──
  function watchElement(el) {
    // Valeur courante au moment du setup
    let lastText = el.textContent.trim();

    const observer = new MutationObserver(() => {
      const newText = el.textContent.trim();
      if (newText === lastText) return; // Pas de changement réel

      const fromVal  = parseValue(lastText);
      const toVal    = parseValue(newText);
      const suffix   = parseSuffix(newText);
      const isDecimal = newText.includes('.');

      lastText = newText;

      // Annuler l'animation précédente si elle tourne encore
      if (el._countupTimer) {
        clearInterval(el._countupTimer);
        el._countupTimer = null;
      }

      // Lancer l'animation
      animateTo(el, fromVal, toVal, suffix, isDecimal);
    });

    observer.observe(el, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  // ── Init : attacher les observers après le chargement du DOM ──
  function init() {
    TARGETS.forEach(id => {
      const el = document.getElementById(id);
      if (el) watchElement(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
