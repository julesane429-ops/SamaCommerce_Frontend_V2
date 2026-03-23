/**
 * boutique-theme.js — Thème couleur par boutique
 *
 * Chaque boutique secondaire peut avoir sa propre couleur d'accent.
 * Quand l'owner switch entre boutiques, la couleur de l'app change automatiquement.
 * Le thème est sauvegardé par boutique dans localStorage.
 *
 * Requiert : theme.js (déjà chargé, expose window.applyTheme + window.THEMES)
 *
 * Intégration dans index.html (après theme.js et boutique-switcher.js) :
 *   <script src="js/boutique-theme.js"></script>
 */

(function () {

  const KEY_PREFIX = 'sc_boutique_theme_';

  // ── Sauvegarder/charger le thème d'une boutique ──
  function saveBoutiqueTheme(boutiqueId, themeName) {
    if (!boutiqueId) return;
    localStorage.setItem(KEY_PREFIX + boutiqueId, themeName);
  }

  function loadBoutiqueTheme(boutiqueId) {
    if (!boutiqueId) return null;
    return localStorage.getItem(KEY_PREFIX + boutiqueId) || null;
  }

  // ── Appliquer le thème d'une boutique ──
  function applyBoutiqueTheme(boutique) {
    if (!boutique || !window.applyTheme) return;

    if (boutique.is_primary) {
      // Boutique principale → thème global de l'app (sc_theme)
      const globalTheme = localStorage.getItem('sc_theme') || 'violet';
      window.applyTheme(globalTheme, true);
      return;
    }

    const savedTheme = loadBoutiqueTheme(boutique.id);
    if (savedTheme) {
      window.applyTheme(savedTheme, true);
    } else {
      // Pas de thème défini → violet par défaut
      window.applyTheme('violet', true);
    }
  }

  // ══════════════════════════════════════
  // MINI PICKER DE THÈME PAR BOUTIQUE
  // Injecté dans la modal boutique-switcher
  // ══════════════════════════════════════
  function openBoutiqueThemePicker(boutique) {
    if (!window.THEMES) return;

    document.getElementById('boutique-theme-picker')?.remove();

    const currentTheme = loadBoutiqueTheme(boutique.id) || 'violet';

    const modal = document.createElement('div');
    modal.id = 'boutique-theme-picker';
    modal.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:1400;
      display:flex; align-items:flex-end; justify-content:center;
    `;

    modal.innerHTML = `
      <div style="
        background:#fff; border-radius:20px 20px 0 0; width:100%; max-width:480px;
        padding:20px 20px calc(20px + env(safe-area-inset-bottom));
      ">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
          <span style="font-size:24px;">${boutique.emoji || '🏪'}</span>
          <div>
            <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:15px;">${boutique.name}</div>
            <div style="font-size:12px;color:#9CA3AF;">Choisir la couleur de cette boutique</div>
          </div>
          <button onclick="document.getElementById('boutique-theme-picker')?.remove()"
            style="margin-left:auto;background:none;border:none;font-size:18px;cursor:pointer;color:#9CA3AF;">✕</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
          ${Object.entries(window.THEMES).map(([key, t]) => `
            <button data-key="${key}" onclick="window._pickBoutiqueTheme('${boutique.id}','${key}')"
              style="
                border:3px solid ${key === currentTheme ? t.primary : '#E5E7EB'};
                background:${key === currentTheme ? t.primary + '15' : '#fff'};
                border-radius:16px; padding:14px 8px; cursor:pointer;
                display:flex; flex-direction:column; align-items:center; gap:6px;
                transition:all .2s;
              ">
              <div style="
                width:40px; height:40px; border-radius:12px;
                background:linear-gradient(135deg,${t.primary},${t.accent});
                display:flex; align-items:center; justify-content:center; font-size:20px;
              ">${t.emoji}</div>
              <div style="
                font-family:'Sora',sans-serif; font-size:11px; font-weight:800;
                color:${key === currentTheme ? t.primary : 'var(--text)'};
              ">${t.label}</div>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    window._pickBoutiqueTheme = (boutiqueId, themeName) => {
      saveBoutiqueTheme(boutiqueId, themeName);
      window.applyTheme(themeName, true);
      window.haptic?.success();
      window.showNotification?.(`${window.THEMES[themeName].emoji} Couleur appliquée`, 'success');
      document.getElementById('boutique-theme-picker')?.remove();

      // Mettre à jour les boutons de sélection
      modal.querySelectorAll('[data-key]').forEach(btn => {
        const t   = window.THEMES[btn.dataset.key];
        const sel = btn.dataset.key === themeName;
        btn.style.borderColor = sel ? t.primary : '#E5E7EB';
        btn.style.background  = sel ? t.primary + '15' : '#fff';
      });
    };
  }

  // ══════════════════════════════════════
  // INJECTION DU BOUTON 🎨 DANS LA MODALE BOUTIQUE
  // ══════════════════════════════════════
  function patchBoutiqueSwitcherModal() {
    // Observer l'apparition de la modal boutique-modal
    const observer = new MutationObserver(() => {
      const modal = document.getElementById('boutique-modal');
      if (!modal || modal._themePatched) return;
      modal._themePatched = true;

      // Ajouter un bouton palette sur chaque carte de boutique secondaire
      const boutiquesDiv = modal.querySelector('#boutique-list, div[style*="padding:12px 16px"]');
      if (!boutiquesDiv) return;

      // Observer les cartes de boutique déjà présentes
      boutiquesDiv.querySelectorAll('[onclick]').forEach(card => {
        const onclickStr = card.getAttribute('onclick') || '';
        const match = onclickStr.match(/_switchBoutique\((\d+)\)/);
        if (!match) return;
        const boutiqueId = parseInt(match[1]);

        // Trouver le nom et l'emoji depuis le DOM
        const nameEl  = card.querySelector('[style*="font-weight:800"]');
        const emojiEl = card.querySelector('[style*="font-size:28px"]');
        const name    = nameEl?.textContent?.trim().split('\n')[0]?.trim() || '';
        const emoji   = emojiEl?.textContent?.trim() || '🏪';

        // Récupérer la boutique depuis le switcher
        const boutiques = window.boutiqueSwitcher?._boutiques || [];
        const boutique  = { id: boutiqueId, name, emoji };

        // Chercher si c'est une boutique secondaire (pas principale)
        const btnContainer = card.querySelector('[style*="flex-direction:column"]');
        if (btnContainer && !card.querySelector('.bq-theme-btn')) {
          const themeBtn = document.createElement('button');
          themeBtn.className = 'bq-theme-btn';

          const savedTheme = loadBoutiqueTheme(boutiqueId);
          const themeColor = savedTheme && window.THEMES?.[savedTheme]
            ? window.THEMES[savedTheme].primary
            : 'var(--muted, #9CA3AF)';

          themeBtn.style.cssText = `
            background:#F3F4F6; border:none; border-radius:8px;
            padding:4px 8px; font-size:11px; cursor:pointer;
            color:${themeColor}; font-weight:600; margin-top:4px;
          `;
          themeBtn.textContent = '🎨';
          themeBtn.title = 'Changer la couleur';
          themeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.haptic?.tap();
            openBoutiqueThemePicker(boutique);
          });
          btnContainer.appendChild(themeBtn);
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: false });
  }

  // ══════════════════════════════════════
  // ÉCOUTER LE SWITCH DE BOUTIQUE
  // ══════════════════════════════════════
  window.addEventListener('boutique:changed', (e) => {
    const boutique = e.detail;
    if (boutique) applyBoutiqueTheme(boutique);
  });

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    // Appliquer le thème de la boutique active au démarrage
    const savedBoutiqueId = localStorage.getItem('sc_active_boutique');
    const isPrimary = localStorage.getItem('sc_active_boutique_is_primary') === '1';

    if (savedBoutiqueId && !isPrimary) {
      const theme = loadBoutiqueTheme(parseInt(savedBoutiqueId));
      if (theme && window.applyTheme) window.applyTheme(theme, false);
    }

    // Patcher la modal boutique pour ajouter les boutons 🎨
    patchBoutiqueSwitcherModal();
  }

  window.openBoutiqueThemePicker = openBoutiqueThemePicker;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
