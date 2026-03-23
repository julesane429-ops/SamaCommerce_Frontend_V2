/**
 * header-redesign.js — Réorganisation complète du header
 *
 * Transforme le header de 7 éléments empilés en chaos
 * en 3 zones propres :
 *   GAUCHE  → bouton retour (←)
 *   CENTRE  → nom boutique + selector + ventes du jour
 *   DROITE  → sync (discret) + cloche + recherche
 *
 * Requiert : css/header-redesign.css
 *
 * Intégration dans index.html (dernier script avant </body>) :
 *   <script src="js/header-redesign.js"></script>
 */

(function () {

  // IDs de tous les éléments injectés dynamiquement
  const EXPECTED_IDS = ['notif-bell', 'global-search-btn'];

  let _done = false;

  // ══════════════════════════════════════
  // ATTENDRE QUE TOUS LES ÉLÉMENTS SOIENT PRÉSENTS
  // ══════════════════════════════════════
  function waitAndReorganize() {
    if (_done) return;

    const allPresent = EXPECTED_IDS.every(id => document.getElementById(id));
    if (!allPresent) {
      setTimeout(waitAndReorganize, 250);
      return;
    }

    reorganize();
  }

  // ══════════════════════════════════════
  // RÉORGANISATION PRINCIPALE
  // ══════════════════════════════════════
  function reorganize() {
    if (_done) return;

    const headerInner = document.querySelector('.header-inner');
    if (!headerInner) return;

    // Récupérer tous les éléments existants
    const backBtn          = document.getElementById('backBtn');
    const boutiqueSwitcher = document.getElementById('boutique-switcher');
    const employeeBadge    = document.getElementById('boutique-employee-badge');
    const headerCenter     = headerInner.querySelector('.header-center');
    const appHeader        = document.getElementById('appHeader');
    const headerSub        = headerInner.querySelector('.header-sub');
    const notifBell        = document.getElementById('notif-bell');
    const searchBtn        = document.getElementById('global-search-btn');
    const syncBtn          = document.getElementById('rt-sync-btn');
    const headerIcon       = headerInner.querySelector('.header-icon');

    // ── Supprimer 💰 (inutile) ──
    headerIcon?.remove();

    // ── Créer les 3 zones ──
    const leftZone   = document.createElement('div');
    const centerZone = document.createElement('div');
    const rightZone  = document.createElement('div');

    leftZone.className   = 'hd-left';
    centerZone.className = 'hd-center';
    rightZone.className  = 'hd-right';

    // ── ZONE GAUCHE : bouton retour ──
    if (backBtn) leftZone.appendChild(backBtn);

    // ── ZONE CENTRE : nom app + boutique indicator ──
    if (appHeader && headerSub) {
      // Recréer le header-center proprement
      const newCenter = document.createElement('div');
      newCenter.className = 'header-center';
      newCenter.appendChild(appHeader);
      newCenter.appendChild(headerSub);
      centerZone.appendChild(newCenter);
    } else if (headerCenter) {
      centerZone.appendChild(headerCenter);
    }

    // Boutique-switcher ou employee-badge — sous le nom
    const boutiqueEl = boutiqueSwitcher || employeeBadge;
    if (boutiqueEl) centerZone.appendChild(boutiqueEl);

    // ── ZONE DROITE : icônes actions ──
    // Sync en premier (moins important, donc à gauche des icônes right)
    if (syncBtn) {
      // Rendre le sync plus discret
      syncBtn.style.fontSize = '14px';
      syncBtn.title = 'Synchroniser';
      rightZone.appendChild(syncBtn);
    }
    if (notifBell) rightZone.appendChild(notifBell);
    if (searchBtn) rightZone.appendChild(searchBtn);

    // ── Reconstruire le header-inner ──
    headerInner.innerHTML = '';
    headerInner.appendChild(leftZone);
    headerInner.appendChild(centerZone);
    headerInner.appendChild(rightZone);

    _done = true;

    // ══════════════════════════════════════════════════════
    // PATCH CRITIQUE : intercepter insertBefore / appendChild
    // sur headerInner pour les scripts qui injectent APRÈS
    // la réorganisation (realtime-sync.js, etc.)
    //
    // Ces scripts font : headerInner.insertBefore(btn, searchBtn)
    // Mais searchBtn est maintenant dans .hd-right, pas dans
    // headerInner directement → NotFoundError.
    // On route tout vers rightZone.
    // ══════════════════════════════════════════════════════
    const _origInsertBefore = headerInner.insertBefore.bind(headerInner);
    const _origAppendChild  = headerInner.appendChild.bind(headerInner);
    const ZONE_CLASSES = ['hd-left', 'hd-center', 'hd-right'];

    headerInner.insertBefore = function (newNode, refNode) {
      // Si le nœud de référence n'est PAS un enfant direct → route vers rightZone
      if (refNode && refNode.parentNode !== headerInner) {
        return rightZone.insertBefore(newNode, null);
      }
      // Si le nouveau nœud n'est pas une zone → route vers rightZone
      if (newNode instanceof Element && !ZONE_CLASSES.includes(newNode.className)) {
        return rightZone.appendChild(newNode);
      }
      return _origInsertBefore(newNode, refNode);
    };

    headerInner.appendChild = function (newNode) {
      // Toute injection hors-zones → rightZone
      if (newNode instanceof Element && !ZONE_CLASSES.includes(newNode.className)) {
        return rightZone.appendChild(newNode);
      }
      return _origAppendChild(newNode);
    };

    // ── Observer les futurs éléments injectés ──
    observeFutureInjections(centerZone, rightZone);
  }

  // ══════════════════════════════════════
  // OBSERVER LES INJECTIONS FUTURES
  // (boutique-switcher peut arriver en retard selon le plan)
  // ══════════════════════════════════════
  function observeFutureInjections(centerZone, rightZone) {
    const headerInner = document.querySelector('.header-inner');
    if (!headerInner) return;

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;

          const id = node.id;

          // Boutique-switcher/badge → déplacer dans center
          if (id === 'boutique-switcher' || id === 'boutique-employee-badge') {
            if (node.parentNode !== centerZone) {
              node.remove();
              centerZone.appendChild(node);
            }
          }

          // Badge de confirmation boutique → laisser dans body
          if (id === 'boutique-active-badge') continue;

          // Notif-bell → dans right zone
          if (id === 'notif-bell' && node.parentNode !== rightZone) {
            node.remove();
            rightZone.prepend(node); // bell avant search
          }

          // Search → dans right zone
          if (id === 'global-search-btn' && node.parentNode !== rightZone) {
            node.remove();
            rightZone.appendChild(node);
          }

          // Sync → dans right zone
          if (id === 'rt-sync-btn' && node.parentNode !== rightZone) {
            node.remove();
            rightZone.prepend(node);
          }

          // Autres boutons injectés dans header-inner → droite
          if (
            node.parentNode === headerInner &&
            !['hd-left','hd-center','hd-right'].includes(node.className) &&
            id !== 'boutique-active-badge'
          ) {
            node.remove();
            rightZone.appendChild(node);
          }
        }
      }
    });

    obs.observe(headerInner, { childList: true });
    obs.observe(document.body, { childList: true, subtree: false }); // pour boutique-active-badge

    // Observer aussi le boutique-switcher inject dans header
    const obsBody = new MutationObserver(() => {
      const sw = document.getElementById('boutique-switcher');
      const em = document.getElementById('boutique-employee-badge');
      const el = sw || em;
      if (el && el.parentNode !== centerZone && el.parentNode !== document.body) {
        el.remove();
        centerZone.appendChild(el);
      }
    });
    obsBody.observe(document.body, { childList: true, subtree: true });
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndReorganize);
  } else {
    waitAndReorganize();
  }

  // Fallback : réorganiser après 3s quoi qu'il arrive
  setTimeout(() => {
    if (!_done) reorganize();
  }, 3000);

})();
