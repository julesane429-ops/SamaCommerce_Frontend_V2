/**
 * theme.js — Thème personnalisable
 * 6 palettes : Violet (défaut), Bleu, Vert, Rouge, Orange, Rose
 *
 * INTÉGRATION dans index.html :
 *   Dans <head> (avant index.css) :
 *     <link rel="stylesheet" href="css/theme.css">
 *   Avant </body> :
 *     <script src="js/theme.js"></script>
 */

(function () {

  const THEME_KEY = 'sc_theme';

  const THEMES = {
    violet: {
      label: 'Violet',  emoji: '💜',
      primary:      '#7C3AED',
      primaryDark:  '#5B21B6',
      primaryLight: '#A78BFA',
      accent:       '#EC4899',
    },
    bleu: {
      label: 'Bleu',    emoji: '💙',
      primary:      '#2563EB',
      primaryDark:  '#1D4ED8',
      primaryLight: '#60A5FA',
      accent:       '#06B6D4',
    },
    vert: {
      label: 'Vert',    emoji: '💚',
      primary:      '#059669',
      primaryDark:  '#047857',
      primaryLight: '#34D399',
      accent:       '#10B981',
    },
    rouge: {
      label: 'Rouge',   emoji: '❤️',
      primary:      '#DC2626',
      primaryDark:  '#B91C1C',
      primaryLight: '#F87171',
      accent:       '#F97316',
    },
    orange: {
      label: 'Orange',  emoji: '🧡',
      primary:      '#D97706',
      primaryDark:  '#B45309',
      primaryLight: '#FCD34D',
      accent:       '#F59E0B',
    },
    rose: {
      label: 'Rose',    emoji: '🩷',
      primary:      '#DB2777',
      primaryDark:  '#BE185D',
      primaryLight: '#F472B6',
      accent:       '#A855F7',
    },
  };

  // ══════════════════════════════════════
  // APPLIQUER UN THÈME
  // ══════════════════════════════════════
  function applyTheme(name, animate = false) {
    const theme = THEMES[name] || THEMES.violet;
    const root  = document.documentElement;

    if (animate) {
      root.style.transition = '--primary .3s ease';
      setTimeout(() => root.style.transition = '', 400);
    }

    root.style.setProperty('--primary',       theme.primary);
    root.style.setProperty('--primary-dark',  theme.primaryDark);
    root.style.setProperty('--primary-light', theme.primaryLight);
    root.style.setProperty('--accent',        theme.accent);

    // Mettre à jour la meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme.primary;

    localStorage.setItem(THEME_KEY, name);
    document.documentElement.dataset.theme = name;
  }

  // ══════════════════════════════════════
  // MODAL DE SÉLECTION
  // ══════════════════════════════════════
  function openThemePicker() {
    document.getElementById('theme-picker-modal')?.remove();

    const current = localStorage.getItem(THEME_KEY) || 'violet';
    const modal   = document.createElement('div');
    modal.id = 'theme-picker-modal';
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(10,7,30,.6);
      backdrop-filter:blur(5px);z-index:600;
      display:flex;flex-direction:column;justify-content:flex-end;align-items:center;
      padding-bottom:calc(var(--nav-h,68px)+var(--safe-b,0px));
    `;

    modal.innerHTML = `
      <div style="
        background:var(--surface,#fff);border-radius:24px 24px 0 0;
        padding:10px 20px 28px;width:100%;max-width:480px;
        animation:moduleSheetUp .3s cubic-bezier(.34,1.3,.64,1) both;
      ">
        <div style="width:36px;height:4px;background:#E5E7EB;border-radius:2px;margin:0 auto 16px;"></div>
        <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:var(--text);text-align:center;margin-bottom:20px;">
          🎨 Couleur de l'application
        </div>

        <!-- Grille des thèmes -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
          ${Object.entries(THEMES).map(([key, t]) => `
            <button data-theme="${key}" style="
              border:3px solid ${key===current?t.primary:'#E5E7EB'};
              border-radius:18px; padding:16px 8px;
              background:${key===current?t.primary+'15':'var(--surface)'};
              cursor:pointer; transition:all .2s;
              display:flex;flex-direction:column;align-items:center;gap:6px;
            " onclick="window._pickTheme('${key}')">
              <!-- Preview mini -->
              <div style="
                width:44px;height:44px;border-radius:12px;
                background:linear-gradient(135deg,${t.primary},${t.accent});
                display:flex;align-items:center;justify-content:center;
                font-size:22px;
              ">${t.emoji}</div>
              <div style="
                font-family:'Sora',sans-serif;
                font-size:12px;font-weight:800;
                color:${key===current?t.primary:'var(--text)'};
              ">${t.label}</div>
              ${key===current ? `<div style="font-size:9px;font-weight:800;color:${t.primary};text-transform:uppercase;letter-spacing:.4px;">Actuel</div>` : ''}
            </button>
          `).join('')}
        </div>

        <!-- Aperçu live -->
        <div id="theme-preview" style="
          background:var(--primary);
          border-radius:14px;padding:14px 18px;
          display:flex;align-items:center;gap:12px;
          margin-bottom:16px;
          transition:background .3s;
        ">
          <div style="font-size:24px;">🏪</div>
          <div>
            <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:#fff;">Aperçu du thème</div>
            <div style="font-size:12px;color:rgba(255,255,255,.7);">Votre application avec cette couleur</div>
          </div>
          <div style="margin-left:auto;background:rgba(255,255,255,.2);color:#fff;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;">Actif</div>
        </div>

        <button onclick="document.getElementById('theme-picker-modal').remove()" style="
          width:100%;padding:13px;background:#F9FAFB;color:#6B7280;
          border:none;border-radius:14px;font-family:'Sora',sans-serif;
          font-size:14px;font-weight:600;cursor:pointer;
        ">Fermer</button>
      </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });

    window._pickTheme = (key) => {
      applyTheme(key, true);
      // Mettre à jour la sélection visuelle
      modal.querySelectorAll('[data-theme]').forEach(btn => {
        const t   = THEMES[btn.dataset.theme];
        const sel = btn.dataset.theme === key;
        btn.style.borderColor  = sel ? t.primary : '#E5E7EB';
        btn.style.background   = sel ? t.primary+'15' : 'var(--surface)';
        btn.querySelectorAll('div')[1].style.color = sel ? t.primary : 'var(--text)';
      });
      // Aperçu
      const preview = modal.querySelector('#theme-preview');
      if (preview) preview.style.background = THEMES[key].primary;
      window.showNotification?.(`${THEMES[key].emoji} Thème ${THEMES[key].label} appliqué`, 'success');
    };
  }

  // ══════════════════════════════════════
  // INJECTION DANS LE PROFIL
  // ══════════════════════════════════════
  function injectThemeInProfile() {
    const obs = new MutationObserver(() => {
      const content = document.getElementById('profilContent');
      if(!content || content.querySelector('#theme-section')) return;
      if(!content.querySelector('#profil-save-info')) return;

      const current = localStorage.getItem(THEME_KEY) || 'violet';
      const t = THEMES[current];

      const section = document.createElement('div');
      section.id = 'theme-section';
      section.style.cssText = 'background:var(--surface);border-radius:20px;padding:18px;margin-bottom:14px;box-shadow:0 2px 14px rgba(0,0,0,.06);';
      section.innerHTML = `
        <div style="font-family:'Sora',sans-serif;font-size:15px;font-weight:800;color:var(--text);margin-bottom:14px;">🎨 Apparence</div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,${t.primary},${t.accent});display:flex;align-items:center;justify-content:center;font-size:18px;">${t.emoji}</div>
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text);">Couleur : ${t.label}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px;">6 palettes disponibles</div>
            </div>
          </div>
          <button onclick="window.openThemePicker()" style="
            padding:8px 16px;border:none;border-radius:11px;
            background:var(--primary);color:#fff;
            font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;
          ">Changer</button>
        </div>
      `;

      const logoutBtn = Array.from(content.querySelectorAll('button')).find(b => b.textContent.includes('Déconnecter'));
      if(logoutBtn) logoutBtn.parentNode.insertBefore(section, logoutBtn);
      else content.appendChild(section);
    });

    const content = document.getElementById('profilContent');
    if(content) obs.observe(content, { childList:true });
  }

  // ══════════════════════════════════════
  // BOUTON RAPIDE DANS LE PLUS SHEET
  // ══════════════════════════════════════
  function injectThemeSheetItem() {
    const sheet = document.querySelector('#plusSheet .sheet-body, #plusSheet > div > div:last-child');
    if (!sheet || sheet.querySelector('#theme-sheet-item')) return;

    // Chercher après le bouton Mon Profil
    const profilBtn = Array.from(document.querySelectorAll('#plusSheet .sheet-item')).find(b => b.textContent.includes('Mon Profil') || b.textContent.includes('Profil'));
    if (!profilBtn) return;

    const item = document.createElement('button');
    item.id = 'theme-sheet-item';
    item.className = 'sheet-item';
    item.onclick = () => { window.closePlusSheet?.(); window.openThemePicker(); };
    const current = localStorage.getItem(THEME_KEY) || 'violet';
    const t = THEMES[current];
    item.innerHTML = `
      <div class="sheet-icon" style="background:linear-gradient(135deg,${t.primary}22,${t.accent}22);">${t.emoji}</div>
      <div><h3>Thème couleur</h3><p>${t.label} · 6 palettes</p></div>
      <span class="sheet-chevron">›</span>
    `;

    profilBtn.parentNode.insertBefore(item, profilBtn.nextSibling);
  }

  // ══════════════════════════════════════
  // API PUBLIQUE
  // ══════════════════════════════════════
  window.openThemePicker = openThemePicker;
  window.applyTheme      = applyTheme;
  window.THEMES          = THEMES;

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    // Appliquer le thème sauvegardé IMMÉDIATEMENT (avant paint)
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && saved !== 'violet') applyTheme(saved, false);

    injectThemeInProfile();
    injectThemeSheetItem();

    window.addEventListener('pageChange', e => {
      if(e.detail?.key==='profil') setTimeout(() => { injectThemeInProfile(); }, 500);
    });

    // Re-injecter le bouton Plus sheet quand il s'ouvre
    document.getElementById('nav-plus')?.addEventListener('click', () => {
      setTimeout(injectThemeSheetItem, 100);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
