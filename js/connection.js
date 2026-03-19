/**
 * connection.js — Indicateur de connexion réseau
 *
 * Affiche un pill discret en haut de l'écran indiquant :
 *   🟢 En ligne   (vert,  s'affiche 2s puis disparaît)
 *   🟠 Sync…      (orange, pendant syncBanner actif)
 *   🔴 Hors ligne (rouge, persiste tant que offline)
 *
 * INTÉGRATION :
 *   Ajouter dans index.html, juste avant </body> :
 *   <script src="js/connection.js"></script>
 *
 * Aucune dépendance. Aucun import requis.
 * Fonctionne en parallèle du syncBanner existant.
 */

(function () {
  // ── Créer l'indicateur ──
  const pill = document.createElement('div');
  pill.id = 'conn-indicator';
  pill.style.cssText = `
    position: fixed;
    top: 14px;
    left: 50%;
    transform: translateX(-50%) translateY(-60px);
    z-index: 9990;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 16px;
    border-radius: 999px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    box-shadow: 0 4px 20px rgba(0,0,0,.2);
    transition: transform .35s cubic-bezier(.34,1.4,.64,1),
                opacity .3s ease,
                background .3s ease;
    pointer-events: none;
    white-space: nowrap;
    opacity: 0;
  `;
  document.body.appendChild(pill);

  const DOT = `<span style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.85);display:inline-block;flex-shrink:0;"></span>`;

  let hideTimer = null;

  function show(text, bg, autohide = false) {
    clearTimeout(hideTimer);
    pill.innerHTML = DOT + text;
    pill.style.background = bg;
    pill.style.opacity = '1';
    pill.style.transform = 'translateX(-50%) translateY(0)';

    if (autohide) {
      hideTimer = setTimeout(hide, 2200);
    }
  }

  function hide() {
    pill.style.opacity = '0';
    pill.style.transform = 'translateX(-50%) translateY(-60px)';
  }

  // ── États ──
  const STATES = {
    online:  { text: 'En ligne',        bg: 'linear-gradient(135deg,#10B981,#059669)', auto: true  },
    sync:    { text: 'Synchronisation…', bg: 'linear-gradient(135deg,#F59E0B,#D97706)', auto: false },
    offline: { text: 'Hors connexion',   bg: 'linear-gradient(135deg,#EF4444,#DC2626)', auto: false },
  };

  function setState(key) {
    const s = STATES[key];
    show(s.text, s.bg, s.auto);
  }

  // ── Écouter les événements réseau ──
  window.addEventListener('online', () => {
    setState('online');
  });

  window.addEventListener('offline', () => {
    setState('offline');
  });

  // ── Observer le syncBanner existant ──
  // Quand syncBanner est visible → montrer "Synchronisation…"
  const syncBanner = document.getElementById('syncBanner');
  if (syncBanner) {
    const observer = new MutationObserver(() => {
      const visible = syncBanner.style.display !== 'none' && syncBanner.style.display !== '';
      if (visible) {
        setState('sync');
      } else {
        // Sync terminée et on est en ligne
        if (navigator.onLine) {
          setState('online');
        }
      }
    });
    observer.observe(syncBanner, { attributes: true, attributeFilter: ['style'] });
  }

  // ── Vérifier l'état initial ──
  if (!navigator.onLine) {
    // Montrer hors ligne immédiatement au démarrage
    setTimeout(() => setState('offline'), 800);
  }

  // ── Exposer pour usage manuel depuis app.js si besoin ──
  window.connIndicator = { show: setState, hide };
})();
