/**
 * splash.js — Gestion du splash screen
 *
 * Ce script s'exécute en inline (non-module) dans <head>
 * pour éviter tout flash de contenu non stylisé.
 *
 * Il injecte le splash dans le DOM immédiatement,
 * puis le masque une fois que l'app est prête.
 *
 * Usage dans index.html :
 *   <script src="js/splash.js"></script>   ← dans <head>, avant </head>
 *
 * La fonction window.hideSplash() est appelée
 * depuis app.js après la première sync serveur.
 */

(function () {
  // ── Créer et injecter le splash immédiatement ──
  const splash = document.createElement('div');
  splash.id = 'splash-screen';
  splash.innerHTML = `
    <div class="splash-circle-1"></div>
    <div class="splash-circle-2"></div>
    <div class="splash-logo-wrap">
      <img src="/pwa/icons/icon-512.png" alt="Sama Commerce"
           onerror="this.parentElement.innerHTML='<span style=\\'font-size:52px;line-height:96px;text-align:center;display:block;\\'>🛍️</span>'">
    </div>
    <div class="splash-name">Sama Commerce</div>
    <div class="splash-tagline">Gérez votre boutique simplement</div>
    <div class="splash-bar-wrap">
      <div class="splash-bar"></div>
    </div>
    <div class="splash-loading-text">Chargement…</div>
  `;

  // Injecter au tout début du body (ou créer le body si pas encore prêt)
  if (document.body) {
    document.body.prepend(splash);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.prepend(splash);
    });
  }

  // ── Durée minimale d'affichage (ms) ──
  const MIN_DISPLAY = 1800;
  const startTime = Date.now();

  let appReady = false;
  let minReached = false;

  function tryHide() {
    if (!appReady || !minReached) return;
    splash.classList.add('splash-out');
    // Nettoyer après la transition CSS
    setTimeout(() => splash.remove(), 500);
  }

  // Timer minimum pour que l'animation soit vue
  setTimeout(() => {
    minReached = true;
    tryHide();
  }, MIN_DISPLAY);

  // ── API publique ──
  // Appeler window.hideSplash() depuis app.js quand les données sont prêtes
  window.hideSplash = function () {
    appReady = true;
    tryHide();
  };

  // Sécurité : masquer après 5s même si l'app ne répond pas
  setTimeout(() => {
    appReady = true;
    minReached = true;
    tryHide();
  }, 5000);
})();
