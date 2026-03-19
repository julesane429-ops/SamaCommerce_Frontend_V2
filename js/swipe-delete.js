/**
 * swipe-delete.js v2 — Swipe to delete sans rewrapping DOM
 *
 * CORRECTIF v1 → v2 :
 * La v1 enveloppait chaque carte dans un nouveau div, ce qui cassait
 * les références des event listeners déjà attachés par ui.js (boutons
 * Éditer, Stock+/-, Supprimer), empêchant la page de fonctionner.
 *
 * v2 injecte le backdrop DANS la carte existante et applique
 * translateX directement sur elle — aucun rewrapping, aucune
 * rupture des listeners existants.
 *
 * INTÉGRATION dans index.html, juste avant </body> :
 *   <script src="js/swipe-delete.js"></script>
 */

(function () {

  const OPEN_THRESHOLD = 42;  // px de swipe gauche pour ouvrir
  const BACKDROP_W     = 88;  // doit correspondre au CSS

  // ── Un seul swipe ouvert à la fois ──
  function closeAllExcept(card) {
    document.querySelectorAll('.swipeable.swipe-open').forEach(c => {
      if (c !== card) c.classList.remove('swipe-open');
    });
  }

  // ══════════════════════════════════════
  // ATTACHER LE SWIPE SUR UNE CARTE
  // ══════════════════════════════════════
  function attachSwipe(card, onDelete) {
    if (card._swipeAttached) return;
    card._swipeAttached = true;

    // 1. Ajouter la classe de base
    card.classList.add('swipeable');

    // 2. Injecter le backdrop à l'intérieur
    const backdrop = document.createElement('div');
    backdrop.className = 'swipe-backdrop';
    backdrop.innerHTML = `
      <span class="swipe-backdrop-icon">🗑️</span>
      <span class="swipe-backdrop-label">Supprimer</span>
    `;
    card.appendChild(backdrop);

    // 3. Gestion tactile
    let startX = 0, startY = 0;
    let isDragging = false;
    let isOpen = false;
    let wasOpen = false;

    card.addEventListener('touchstart', e => {
      startX    = e.touches[0].clientX;
      startY    = e.touches[0].clientY;
      isDragging = false;
      wasOpen   = isOpen;
    }, { passive: true });

    card.addEventListener('touchmove', e => {
      const dx = e.touches[0].clientX - startX;
      const dy = Math.abs(e.touches[0].clientY - startY);

      // Scroll vertical → ignorer
      if (!isDragging && dy > Math.abs(dx) + 5) return;

      // Swipe vers la droite quand fermé → ignorer
      if (!isDragging && dx > 0 && !wasOpen) return;

      isDragging = true;

      // Calculer le déplacement avec résistance en bout de course
      let offset;
      if (wasOpen) {
        offset = Math.max(-BACKDROP_W, Math.min(0, dx - BACKDROP_W));
      } else {
        offset = Math.max(-BACKDROP_W * 1.1, Math.min(0, dx));
      }

      card.style.transition = 'none';
      card.style.transform  = `translateX(${offset}px)`;
    }, { passive: true });

    card.addEventListener('touchend', e => {
      card.style.transition = '';
      card.style.transform  = '';

      if (!isDragging) {
        // Simple tap : fermer si ouvert (mais ne pas déclencher les boutons enfants)
        if (isOpen) {
          card.classList.remove('swipe-open');
          isOpen = false;
        }
        return;
      }

      const dx = e.changedTouches[0].clientX - startX;

      if (wasOpen) {
        if (dx > 20) {
          card.classList.remove('swipe-open');
          isOpen = false;
        } else {
          card.classList.add('swipe-open');
          isOpen = true;
        }
      } else {
        if (dx < -OPEN_THRESHOLD) {
          closeAllExcept(card);
          card.classList.add('swipe-open');
          isOpen = true;
        } else {
          card.classList.remove('swipe-open');
          isOpen = false;
        }
      }
    }, { passive: true });

    // Fermer si on touche autre chose
    document.addEventListener('touchstart', e => {
      if (isOpen && !card.contains(e.target)) {
        card.classList.remove('swipe-open');
        isOpen = false;
      }
    }, { passive: true });

    // 4. Clic sur backdrop → animation + suppression
    backdrop.addEventListener('click', e => {
      e.stopPropagation();
      card.classList.add('swipe-removing');
      setTimeout(() => {
        onDelete();
      }, 320);
    });
  }

  // ══════════════════════════════════════
  // OBSERVER #listeProduits
  // ══════════════════════════════════════
  function watchProduits() {
    const container = document.getElementById('listeProduits');
    if (!container) return;

    function processCards() {
      container.querySelectorAll(':scope > div').forEach(card => {
        if (card._swipeAttached) return;

        // Trouver le bouton 🗑️ existant créé par ui.js
        const btnSuppr = card.querySelector('.btn-suppr');
        if (!btnSuppr) return;

        attachSwipe(card, () => btnSuppr.click());
      });
    }

    processCards();
    new MutationObserver(processCards).observe(container, { childList: true });
  }

  // ══════════════════════════════════════
  // OBSERVER #creditsHistoryBody
  // Swipe gauche = highlight du bouton Rembourser
  // ══════════════════════════════════════
  function watchCredits() {
    const tbody = document.getElementById('creditsHistoryBody');
    if (!tbody) return;

    function processRows() {
      tbody.querySelectorAll('tr').forEach(tr => {
        if (tr._swipeAttached) return;
        tr._swipeAttached = true;

        const btn = tr.querySelector('button');
        if (!btn) return; // ligne déjà remboursée

        let startX = 0;

        tr.addEventListener('touchstart', e => {
          startX = e.touches[0].clientX;
        }, { passive: true });

        tr.addEventListener('touchend', e => {
          const dx = e.changedTouches[0].clientX - startX;
          if (dx < -40) {
            // Flash jaune + zoom sur le bouton Rembourser
            tr.classList.add('swipe-credit-highlight');
            btn.style.transition = 'transform .15s ease, box-shadow .15s ease';
            btn.style.transform  = 'scale(1.1)';
            btn.style.boxShadow  = '0 0 0 3px rgba(245,158,11,.35)';
            setTimeout(() => {
              tr.classList.remove('swipe-credit-highlight');
              btn.style.transform  = '';
              btn.style.boxShadow  = '';
            }, 1200);
          }
        }, { passive: true });
      });
    }

    processRows();
    new MutationObserver(processRows).observe(tbody, { childList: true });
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    watchProduits();
    watchCredits();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
