/**
 * fix-plan-access.js — Correction accès par plan
 *
 * BUG : planConfig.js expose window.hasFeature
 *        subscription-guard.js appelle window.planHasFeature (n'existe pas)
 *        → toutes les sections premium sont bloquées quel que soit le plan
 *
 * FIX : crée l'alias window.planHasFeature → window.hasFeature
 *        + expose l'état du plan pour les autres scripts
 *
 * IMPORTANT : charger APRÈS planConfig.js et AVANT subscription-guard.js
 *             Idéalement juste après planConfig.js dans index.html
 *
 * INTÉGRATION : <script src="js/fix-plan-access.js"></script>
 */

(function () {

  // ═══════════════════════════════════════
  // 1. ALIAS : planHasFeature → hasFeature
  // ═══════════════════════════════════════
  function createAlias() {
    if (typeof window.hasFeature === 'function' && !window.planHasFeature) {
      window.planHasFeature = window.hasFeature;
    }
  }

  // Créer immédiatement si hasFeature est déjà disponible
  createAlias();

  // Aussi re-vérifier au prochain tick (planConfig.js peut charger après)
  setTimeout(createAlias, 0);
  setTimeout(createAlias, 100);
  setTimeout(createAlias, 500);

  // ═══════════════════════════════════════
  // 2. EXPOSER LE PLAN SUR WINDOW
  //    pour que les autres scripts puissent le lire
  // ═══════════════════════════════════════
  function exposePlan() {
    // Quand subscription-guard charge le profil, il met _subscriptionState
    // On poll pour le détecter et exposer proprement
    var state = window._subscriptionState;
    if (state) {
      window._currentPlan = state.plan || 'Free';
      window._isPaidPlan  = state.isPaid || false;
      window._isExpired   = state.isExpired || false;
      return;
    }
    setTimeout(exposePlan, 1000);
  }
  setTimeout(exposePlan, 2000);

  // ═══════════════════════════════════════
  // 3. VÉRIFICATION DE COHÉRENCE
  //    Log un warning si le guard bloque à tort
  // ═══════════════════════════════════════
  if (typeof window.hasFeature === 'function') {
    // Test rapide : Enterprise doit avoir TOUTES les features
    var allFeatures = ['ventes','stock','categories','caisse','credits',
      'clients','fournisseurs','commandes','livraisons','rapports',
      'photos','export','whatsapp','team','finance','multi_boutique'];

    var blocked = allFeatures.filter(function (f) {
      return !window.hasFeature('Enterprise', f);
    });

    if (blocked.length > 0) {
      console.warn('[fix-plan-access] Enterprise bloqué sur:', blocked);
    }
  }

})();
