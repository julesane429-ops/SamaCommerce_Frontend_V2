/**
 * haptic.js — Retour haptique sur mobile
 *
 * Expose window.haptic avec des patterns adaptés à chaque action.
 * Utilise navigator.vibrate() — silencieux si non supporté.
 *
 * Intégration dans index.html (avant app.js) :
 *   <script src="js/haptic.js"></script>
 *
 * Usage :
 *   window.haptic.tap()      // clic léger — ajout panier, sélection
 *   window.haptic.success()  // vente enregistrée, sauvegarde OK
 *   window.haptic.error()    // erreur, stock insuffisant
 *   window.haptic.double()   // action double — suppression confirmée
 *   window.haptic.light()    // feedback discret
 *   window.haptic.medium()   // feedback intermédiaire
 *   window.haptic.heavy()    // feedback fort
 */

(function () {
  // Vérification support + bind pour éviter les erreurs
  const _vib = (typeof navigator.vibrate === 'function')
    ? (pattern) => { try { navigator.vibrate(pattern); } catch (_) {} }
    : () => {};

  window.haptic = {
    /** Tap léger — ajout au panier, sélection d'un produit */
    tap()     { _vib([10]); },

    /** Double tap — navigation, confirmation légère */
    double()  { _vib([12, 25, 12]); },

    /** Light — notifications discrètes */
    light()   { _vib([18]); },

    /** Medium — boutons d'action normaux */
    medium()  { _vib([35]); },

    /** Heavy — actions importantes */
    heavy()   { _vib([65]); },

    /** Success — vente enregistrée, sauvegarde OK ✅ */
    success() { _vib([10, 40, 80]); },

    /** Warning — stock faible, action à risque ⚠️ */
    warning() { _vib([30, 20, 30]); },

    /** Error — erreur, stock insuffisant, échec ❌ */
    error()   { _vib([80, 30, 80, 30, 120]); },

    /** Delete — suppression, annulation 🗑️ */
    delete()  { _vib([40, 20, 40]); },

    /** Cash — son de caisse, paiement espèces 💵 */
    cash()    { _vib([15, 10, 15, 10, 40]); },
  };
})();
