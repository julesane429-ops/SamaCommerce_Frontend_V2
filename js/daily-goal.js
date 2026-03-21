/**
 * daily-goal.js — Widget "Objectif du jour"
 *
 * Injecte une carte sur l'écran d'accueil (#menuSection)
 * montrant la progression des ventes du jour vers un objectif
 * défini par l'utilisateur.
 *
 * - Objectif sauvegardé dans localStorage (par userId si dispo)
 * - Se met à jour automatiquement dès que #chiffreAffaires change
 *   (MutationObserver — aucun appel API supplémentaire)
 * - Animation confetti + message quand l'objectif est atteint
 * - Reset automatique chaque jour à minuit
 *
 * INTÉGRATION dans index.html, juste avant </body> :
 *   <script src="js/daily-goal.js"></script>
 */

(function () {

  // ══════════════════════════════════════
  // CONFIG
  // ══════════════════════════════════════
  const PRESETS    = [5000, 10000, 25000, 50000, 100000];
  const STORAGE_KEY = 'sc_daily_goal';

  // ══════════════════════════════════════
  // STORAGE (clé par userId pour multi-compte)
  // ══════════════════════════════════════
  function storageKey() {
    const uid = localStorage.getItem('userId') || 'default';
    return `${STORAGE_KEY}_${uid}`;
  }

  function loadGoal() {
    try {
      const raw = localStorage.getItem(storageKey());
      return raw ? parseInt(raw, 10) : null;
    } catch { return null; }
  }

  function saveGoal(amount) {
    try { localStorage.setItem(storageKey(), String(amount)); } catch {}
  }

  // ══════════════════════════════════════
  // LIRE LE CA DU JOUR DEPUIS LE DOM
  // ══════════════════════════════════════
  function readCurrentCA() {
    const el = document.getElementById('chiffreAffaires');
    if (!el) return 0;
    const raw = el.textContent.replace(/[\s\u00a0]/g, '').replace(/[^\d]/g, '');
    return parseInt(raw, 10) || 0;
  }

  // ══════════════════════════════════════
  // CONFETTI
  // ══════════════════════════════════════
  const CONFETTI_COLORS = ['#7C3AED','#EC4899','#10B981','#F59E0B','#3B82F6','#F472B6'];
  let confettiFired = false;

  function fireConfetti(card) {
    if (confettiFired) return;
    confettiFired = true;

    const wrap = document.createElement('div');
    wrap.className = 'dg-confetti-wrap';

    for (let i = 0; i < 18; i++) {
      const p = document.createElement('div');
      p.className = 'dg-confetti-piece';
      p.style.left            = `${Math.random() * 100}%`;
      p.style.background      = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      p.style.animationDelay  = `${Math.random() * .4}s`;
      p.style.animationDuration = `${.9 + Math.random() * .5}s`;
      p.style.width  = `${5 + Math.random() * 5}px`;
      p.style.height = p.style.width;
      wrap.appendChild(p);
    }

    card.appendChild(wrap);
    setTimeout(() => wrap.remove(), 2000);
  }

  // ══════════════════════════════════════
  // RENDU DE LA CARTE
  // ══════════════════════════════════════
  function renderCard(card, goal, current) {

    if (!goal) {
      // ── Pas d'objectif défini ──
      card.innerHTML = `
        <div class="dg-header">
          <div class="dg-title">🎯 Objectif du jour</div>
        </div>
        <div class="dg-empty">
          <div class="dg-empty-text">Définissez votre objectif de vente pour aujourd'hui</div>
          <button class="dg-set-btn" id="dg-open-modal">Définir un objectif</button>
        </div>
      `;
      document.getElementById('dg-open-modal')
        ?.addEventListener('click', openModal);
      return;
    }

    const pct      = Math.min(Math.round((current / goal) * 100), 100);
    const reached  = current >= goal;
    const remaining = Math.max(goal - current, 0);

    card.innerHTML = `
      <div class="dg-header">
        <div class="dg-title">🎯 Objectif du jour</div>
        <button class="dg-edit-btn" id="dg-edit-btn" title="Modifier l'objectif">✏️</button>
      </div>
      <div class="dg-amounts">
        <span class="dg-current ${reached ? 'reached' : ''}">${current.toLocaleString('fr-FR')} F</span>
        <span class="dg-separator">/</span>
        <span class="dg-target">${goal.toLocaleString('fr-FR')} F</span>
      </div>
      <div class="dg-bar-wrap">
        <div class="dg-bar ${reached ? 'reached' : ''}" style="width:${pct}%"></div>
      </div>
      <div class="dg-footer">
        <span class="dg-pct ${reached ? 'reached' : ''}">${pct}%</span>
        <span class="dg-remaining ${reached ? 'reached' : ''}">
          ${reached
            ? '🎉 Objectif atteint !'
            : `${remaining.toLocaleString('fr-FR')} F restants`}
        </span>
      </div>
    `;

    document.getElementById('dg-edit-btn')
      ?.addEventListener('click', openModal);

    // Confetti si objectif tout juste atteint
    if (reached) fireConfetti(card);
  }

  // ══════════════════════════════════════
  // MODAL DE SAISIE
  // ══════════════════════════════════════
  function openModal() {
    const goal = loadGoal();

    const backdrop = document.createElement('div');
    backdrop.id = 'dg-modal-backdrop';
    backdrop.innerHTML = `
      <div id="dg-modal">
        <div class="dg-modal-pill"></div>
        <div class="dg-modal-title">🎯 Objectif du jour</div>

        <div class="dg-presets" id="dg-presets">
          ${PRESETS.map(p => `
            <button class="dg-preset ${goal === p ? 'selected' : ''}"
                    data-value="${p}">
              ${p >= 1000 ? (p / 1000) + 'k' : p} F
            </button>
          `).join('')}
        </div>

        <div class="dg-input-wrap">
          <input type="number" id="dg-input"
                 placeholder="0"
                 value="${goal || ''}"
                 inputmode="numeric"
                 min="1">
          <span class="dg-input-suffix">F</span>
        </div>

        <div class="dg-modal-actions">
          <button class="dg-modal-cancel" id="dg-cancel">Annuler</button>
          <button class="dg-modal-save"   id="dg-save">💾 Enregistrer</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const input    = document.getElementById('dg-input');
    const presets  = document.getElementById('dg-presets');

    // Focus auto
    setTimeout(() => input?.focus(), 100);

    // Clic sur un preset → remplir l'input
    presets?.addEventListener('click', e => {
      const btn = e.target.closest('.dg-preset');
      if (!btn) return;
      const val = parseInt(btn.dataset.value, 10);
      input.value = val;
      presets.querySelectorAll('.dg-preset').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });

    // Saisie manuelle → désélectionner les presets
    input?.addEventListener('input', () => {
      presets?.querySelectorAll('.dg-preset').forEach(b => b.classList.remove('selected'));
    });

    // Annuler
    document.getElementById('dg-cancel')?.addEventListener('click', closeModal);
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) closeModal();
    });

    // Enregistrer
    document.getElementById('dg-save')?.addEventListener('click', () => {
      const val = parseInt(input?.value, 10);
      if (!val || val <= 0) {
        input?.focus();
        input && (input.style.borderColor = '#EF4444');
        setTimeout(() => input && (input.style.borderColor = ''), 800);
        return;
      }
      saveGoal(val);
      confettiFired = false; // Reset pour le nouvel objectif
      closeModal();
      updateCard();
    });
  }

  function closeModal() {
    document.getElementById('dg-modal-backdrop')?.remove();
  }

  // ══════════════════════════════════════
  // MISE À JOUR DE LA CARTE
  // ══════════════════════════════════════
  function updateCard() {
    const card = document.getElementById('daily-goal-card');
    if (!card) return;
    const goal    = loadGoal();
    const current = readCurrentCA();
    renderCard(card, goal, current);
  }

  // ══════════════════════════════════════
  // INJECTER LA CARTE DANS #menuSection
  // ══════════════════════════════════════
  function injectCard() {
    if (document.getElementById('daily-goal-card')) return;

    const card = document.createElement('div');
    card.id = 'daily-goal-card';

    // Insérer après #alertesStock (ou après .today-float si absente)
    const menuSection = document.getElementById('menuSection');
    if (!menuSection) return;

    const alertes = document.getElementById('alertesStock');
    const guide   = document.getElementById('userGuide');

    // Insérer après alertesStock, ou après userGuide
    const anchor = alertes || guide;
    if (anchor && anchor.parentNode === menuSection) {
      anchor.parentNode.insertBefore(card, anchor.nextSibling);
    } else {
      // Fallback : insérer en premier dans menuSection
      menuSection.prepend(card);
    }

    updateCard();
  }

  // ══════════════════════════════════════
  // OBSERVER #chiffreAffaires — singleton + debounce
  // ══════════════════════════════════════
  let _goalObserver   = null;
  let _goalDebounce   = null;

  function watchCA() {
    if (_goalObserver) return; // déjà actif, ne pas créer un deuxième
    const el = document.getElementById('chiffreAffaires');
    if (!el) return;

    let lastText = el.textContent;

    _goalObserver = new MutationObserver(() => {
      const newText = el.textContent;
      if (newText === lastText) return;
      lastText = newText;
      // Debounce — countup.js déclenche plusieurs mutations en rafale
      clearTimeout(_goalDebounce);
      _goalDebounce = setTimeout(updateCard, 800);
    });

    _goalObserver.observe(el, { characterData: true, childList: true, subtree: true });
  }

  // ══════════════════════════════════════
  // RESET AUTOMATIQUE À MINUIT
  // ══════════════════════════════════════
  function scheduleResetAtMidnight() {
    const now  = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const ms = next - now;
    setTimeout(() => {
      confettiFired = false;
      updateCard();
      scheduleResetAtMidnight();
    }, ms);
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    injectCard();
    watchCA();
    scheduleResetAtMidnight();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
