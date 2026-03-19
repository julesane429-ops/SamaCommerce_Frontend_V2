/**
 * dark-mode.js — Toggle mode sombre pour Sama Commerce
 *
 * - Ajoute/retire la classe .dark sur <html>
 * - Sauvegarde la préférence dans localStorage
 * - Respecte la préférence système (prefers-color-scheme)
 * - Injecte un bouton flottant ☀️/🌙 en bas à droite
 * - Transition douce via la classe .transitioning
 *
 * INTÉGRATION dans index.html, juste avant </body> :
 *   <script src="js/dark-mode.js"></script>
 */

(function () {

  const HTML      = document.documentElement;
  const STORAGE_KEY = 'sc_dark_mode';

  // ══════════════════════════════════════
  // LIRE LA PRÉFÉRENCE INITIALE
  // ══════════════════════════════════════
  function getPreference() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return saved === 'true';
    // Fallback : préférence système
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // ══════════════════════════════════════
  // APPLIQUER LE THÈME
  // ══════════════════════════════════════
  function applyTheme(dark, animate = false) {
    if (animate) {
      HTML.classList.add('transitioning');
      setTimeout(() => HTML.classList.remove('transitioning'), 300);
    }

    if (dark) {
      HTML.classList.add('dark');
    } else {
      HTML.classList.remove('dark');
    }

    // Mettre à jour l'icône du bouton
    const btn = document.getElementById('dark-toggle');
    if (btn) btn.textContent = dark ? '☀️' : '🌙';

    // Mettre à jour la meta theme-color pour la barre de statut mobile
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#13111F' : '#7C3AED';
  }

  // ══════════════════════════════════════
  // CRÉER LE BOUTON TOGGLE
  // ══════════════════════════════════════
  function buildButton() {
    if (document.getElementById('dark-toggle')) return;

    const btn = document.createElement('button');
    btn.id           = 'dark-toggle';
    btn.textContent  = HTML.classList.contains('dark') ? '☀️' : '🌙';
    btn.setAttribute('aria-label', 'Basculer le mode sombre');
    btn.title = 'Mode sombre';

    btn.addEventListener('click', () => {
      const isDark = HTML.classList.contains('dark');
      const next   = !isDark;
      localStorage.setItem(STORAGE_KEY, String(next));
      applyTheme(next, true);
    });

    document.body.appendChild(btn);
  }

  // ══════════════════════════════════════
  // ÉCOUTER LES CHANGEMENTS SYSTÈME
  // ══════════════════════════════════════
  function watchSystem() {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', e => {
      // Appliquer uniquement si pas de préférence manuelle sauvegardée
      if (localStorage.getItem(STORAGE_KEY) === null) {
        applyTheme(e.matches, true);
      }
    });
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════

  // Appliquer IMMÉDIATEMENT (avant DOMContentLoaded) pour éviter le flash blanc
  applyTheme(getPreference(), false);

  // Créer le bouton après le DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildButton);
  } else {
    buildButton();
  }

  watchSystem();

  // API publique
  window.darkMode = {
    toggle: () => {
      const next = !HTML.classList.contains('dark');
      localStorage.setItem(STORAGE_KEY, String(next));
      applyTheme(next, true);
    },
    isDark: () => HTML.classList.contains('dark'),
    set: (dark) => {
      localStorage.setItem(STORAGE_KEY, String(dark));
      applyTheme(dark, true);
    },
  };

})();
