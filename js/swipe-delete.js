/**
 * swipe-delete.js — Swipe to delete pour Sama Commerce
 *
 * Permet de glisser vers la gauche sur :
 *   - Les cartes produit (#listeProduits)
 *   - Les lignes de crédit (#creditsHistoryBody)
 *
 * S'attache via MutationObserver : chaque fois que le JS existant
 * injecte de nouveaux éléments, le swipe est automatiquement activé.
 *
 * INTÉGRATION dans index.html, juste avant </body> :
 *   <script src="js/swipe-delete.js"></script>
 *
 * Aucune modification du JS existant requise.
 */

(function () {

  // ══════════════════════════════════════
  // CONFIG
  // ══════════════════════════════════════
  const OPEN_THRESHOLD  = 40;   // px pour considérer le swipe "ouvert"
  const CLOSE_THRESHOLD = 20;   // px de retour pour fermer
  const BACKDROP_WIDTH  = 90;   // px révélés (doit matcher le CSS)

  // ══════════════════════════════════════
  // UTILITAIRE : un seul swipe ouvert à la fois
  // ══════════════════════════════════════
  let currentOpen = null;

  function closeAll(except) {
    document.querySelectorAll('.swipe-wrapper.swipe-open').forEach(w => {
      if (w !== except) w.classList.remove('swipe-open');
    });
  }

  // ══════════════════════════════════════
  // ATTACHER LE SWIPE À UNE CARTE (div)
  // ══════════════════════════════════════
  function attachSwipeToCard(card, onDelete) {
    // Éviter le double attachement
    if (card.dataset.swipeAttached) return;
    card.dataset.swipeAttached = 'true';

    // Créer le wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'swipe-wrapper';

    // Créer le backdrop rouge
    const backdrop = document.createElement('div');
    backdrop.className = 'swipe-backdrop';
    backdrop.innerHTML = `
      <span class="swipe-backdrop-icon">🗑️</span>
      <span class="swipe-backdrop-label">Supprimer</span>
    `;

    // Envelopper la carte
    const content = document.createElement('div');
    content.className = 'swipe-content';
    card.parentNode.insertBefore(wrapper, card);
    content.appendChild(card);
    wrapper.appendChild(backdrop);
    wrapper.appendChild(content);

    // ── Gestion tactile ──
    let startX = 0, startY = 0;
    let isDragging = false;
    let isOpen = false;
    let startedOpen = false;

    content.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = false;
      startedOpen = isOpen;
    }, { passive: true });

    content.addEventListener('touchmove', (e) => {
      const dx = e.touches[0].clientX - startX;
      const dy = Math.abs(e.touches[0].clientY - startY);

      // Ignorer si scroll vertical
      if (!isDragging && dy > Math.abs(dx)) return;

      // Swipe gauche uniquement
      if (dx > 0 && !startedOpen) return;

      isDragging = true;

      let offset = 0;
      if (startedOpen) {
        offset = Math.max(-BACKDROP_WIDTH, Math.min(0, dx - BACKDROP_WIDTH));
      } else {
        offset = Math.max(-BACKDROP_WIDTH, Math.min(0, dx));
      }

      content.style.transition = 'none';
      content.style.transform = `translateX(${offset}px)`;
    }, { passive: true });

    content.addEventListener('touchend', (e) => {
      content.style.transition = '';
      const dx = e.changedTouches[0].clientX - startX;

      if (!isDragging) {
        // Simple tap → fermer si ouvert
        if (isOpen) {
          wrapper.classList.remove('swipe-open');
          isOpen = false;
        }
        return;
      }

      content.style.transform = '';

      if (startedOpen) {
        // Était ouvert : fermer si tiré vers droite
        if (dx > CLOSE_THRESHOLD) {
          wrapper.classList.remove('swipe-open');
          isOpen = false;
        } else {
          wrapper.classList.add('swipe-open');
          isOpen = true;
        }
      } else {
        // Était fermé : ouvrir si tiré vers gauche
        if (dx < -OPEN_THRESHOLD) {
          closeAll(wrapper);
          wrapper.classList.add('swipe-open');
          isOpen = true;
        } else {
          wrapper.classList.remove('swipe-open');
          isOpen = false;
        }
      }
    }, { passive: true });

    // Fermer si on clique ailleurs
    document.addEventListener('touchstart', (e) => {
      if (isOpen && !wrapper.contains(e.target)) {
        wrapper.classList.remove('swipe-open');
        isOpen = false;
      }
    }, { passive: true });

    // ── Clic sur le backdrop → supprimer ──
    backdrop.addEventListener('click', () => {
      wrapper.classList.add('swipe-removing');
      setTimeout(() => {
        onDelete();
        wrapper.remove();
      }, 350);
    });
  }

  // ══════════════════════════════════════
  // TROUVER LE BOUTON SUPPRIMER EXISTANT
  // Récupère l'action de suppression du bouton 🗑️ déjà dans la carte
  // ══════════════════════════════════════
  function getDeleteAction(card) {
    // Le JS existant attache les événements sur .btn-suppr
    const btn = card.querySelector('.btn-suppr');
    if (!btn) return null;
    return () => btn.click();
  }

  // ══════════════════════════════════════
  // OBSERVER #listeProduits
  // ══════════════════════════════════════
  function watchProduits() {
    const container = document.getElementById('listeProduits');
    if (!container) return;

    function processCards() {
      // Les cartes produit sont des div directs de #listeProduits
      // qui ne sont pas encore dans un .swipe-wrapper
      container.querySelectorAll(':scope > div:not([data-swipe-attached])').forEach(card => {
        const deleteAction = getDeleteAction(card);
        if (!deleteAction) return;
        attachSwipeToCard(card, deleteAction);
      });
    }

    // Process les cartes déjà présentes
    processCards();

    // Observer les nouvelles cartes
    const observer = new MutationObserver(processCards);
    observer.observe(container, { childList: true });
  }

  // ══════════════════════════════════════
  // OBSERVER #creditsHistoryBody
  // Lignes de tableau — swipe plus discret
  // ══════════════════════════════════════
  function watchCredits() {
    const tbody = document.getElementById('creditsHistoryBody');
    if (!tbody) return;

    function processRows() {
      tbody.querySelectorAll('tr:not([data-swipe-attached])').forEach(tr => {
        tr.dataset.swipeAttached = 'true';

        // Trouver le bouton Rembourser (pas supprimer, mais on peut swipe)
        // On cherche plutôt le bouton de remboursement
        const rembBtn = tr.querySelector('button');
        if (!rembBtn) return; // ligne déjà payée → pas de swipe

        let startX = 0, isOpen = false;

        tr.addEventListener('touchstart', (e) => {
          startX = e.touches[0].clientX;
        }, { passive: true });

        tr.addEventListener('touchend', (e) => {
          const dx = e.changedTouches[0].clientX - startX;

          if (dx < -40) {
            // Swipe gauche → mettre en évidence le bouton rembourser
            tr.style.transition = 'background .2s ease';
            tr.style.background = '#FEF3C7';
            tr.style.borderRadius = '12px';

            // Faire clignoter le bouton
            rembBtn.style.transform = 'scale(1.08)';
            rembBtn.style.boxShadow = '0 0 0 3px rgba(245,158,11,.3)';

            setTimeout(() => {
              tr.style.background = '';
              rembBtn.style.transform = '';
              rembBtn.style.boxShadow = '';
            }, 1200);
          }
        }, { passive: true });
      });
    }

    processRows();
    const observer = new MutationObserver(processRows);
    observer.observe(tbody, { childList: true });
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
