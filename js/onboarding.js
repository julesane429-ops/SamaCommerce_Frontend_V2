/**
 * onboarding.js — Onboarding interactif redessiné
 *
 * Remplace le guide texte existant par un vrai onboarding :
 *   - 5 étapes avec illustrations SVG
 *   - Navigation swipe + boutons
 *   - Barre de progression animée
 *   - Confettis à la fin
 *   - Cache le #userGuide existant après complétion
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/onboarding.js"></script>
 */

(function () {

  const KEY = 'sc_onboarding_v2_done';

  // ══════════════════════════════════════
  // ÉTAPES
  // ══════════════════════════════════════
  const STEPS = [
    {
      icon: '🏪',
      color: ['#7C3AED', '#EC4899'],
      title: 'Bienvenue sur\nSama Commerce !',
      desc: 'Votre boutique intelligente. Gérez vos ventes, votre stock et vos clients depuis votre téléphone.',
      cta: 'Commencer →',
      svg: `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg">
        <!-- Boutique -->
        <rect x="40" y="50" width="120" height="70" rx="8" fill="#EDE9FE" stroke="#7C3AED" stroke-width="2"/>
        <rect x="40" y="50" width="120" height="20" rx="8" fill="#7C3AED"/>
        <text x="100" y="65" text-anchor="middle" fill="white" font-size="11" font-weight="bold">🏪 MA BOUTIQUE</text>
        <!-- Porte -->
        <rect x="82" y="90" width="36" height="30" rx="4" fill="#C4B5FD" stroke="#7C3AED" stroke-width="1.5"/>
        <circle cx="113" cy="107" r="2.5" fill="#7C3AED"/>
        <!-- Fenêtres -->
        <rect x="50" y="78" width="20" height="16" rx="3" fill="#A78BFA"/>
        <rect x="130" y="78" width="20" height="16" rx="3" fill="#A78BFA"/>
        <!-- Sol -->
        <line x1="20" y1="120" x2="180" y2="120" stroke="#E5E7EB" stroke-width="2"/>
        <!-- Étoiles déco -->
        <text x="25" y="45" font-size="14">✨</text>
        <text x="160" y="45" font-size="14">⭐</text>
        <text x="155" y="30" font-size="10">💫</text>
      </svg>`,
    },
    {
      icon: '💳',
      color: ['#10B981', '#059669'],
      title: 'Vendez en\n3 secondes',
      desc: 'Appuyez sur 💳 Vendre, choisissez vos produits, encaissez en espèces, Wave ou Orange Money.',
      cta: 'Suivant →',
      svg: `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg">
        <!-- Téléphone -->
        <rect x="65" y="15" width="70" height="110" rx="12" fill="#1E1B2E" stroke="#374151" stroke-width="2"/>
        <rect x="70" y="25" width="60" height="88" rx="6" fill="#EDE9FE"/>
        <!-- Bouton vendre -->
        <rect x="75" y="85" width="50" height="20" rx="10" fill="#10B981"/>
        <text x="100" y="98" text-anchor="middle" fill="white" font-size="9" font-weight="bold">💳 VENDRE</text>
        <!-- Produits liste -->
        <rect x="75" y="33" width="50" height="10" rx="3" fill="#A78BFA" opacity=".6"/>
        <rect x="75" y="47" width="50" height="10" rx="3" fill="#A78BFA" opacity=".4"/>
        <rect x="75" y="61" width="50" height="10" rx="3" fill="#A78BFA" opacity=".3"/>
        <!-- Pièces de monnaie -->
        <circle cx="30" cy="70" r="16" fill="#FEF9C3" stroke="#F59E0B" stroke-width="2"/>
        <text x="30" y="75" text-anchor="middle" font-size="14">💰</text>
        <circle cx="170" cy="60" r="12" fill="#ECFDF5" stroke="#10B981" stroke-width="2"/>
        <text x="170" y="65" text-anchor="middle" font-size="10">📱</text>
      </svg>`,
    },
    {
      icon: '📦',
      color: ['#3B82F6', '#1D4ED8'],
      title: 'Gérez votre\nstock facilement',
      desc: 'Ajoutez vos produits avec prix d\'achat et de vente. Recevez des alertes quand le stock est faible.',
      cta: 'Suivant →',
      svg: `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg">
        <!-- Étagère -->
        <rect x="20" y="95" width="160" height="8" rx="4" fill="#E5E7EB"/>
        <rect x="20" y="60" width="160" height="6" rx="3" fill="#E5E7EB"/>
        <!-- Boîtes -->
        <rect x="30" y="66" width="28" height="29" rx="4" fill="#BFDBFE" stroke="#3B82F6" stroke-width="1.5"/>
        <text x="44" y="85" text-anchor="middle" font-size="14">📦</text>
        <rect x="68" y="66" width="28" height="29" rx="4" fill="#BFDBFE" stroke="#3B82F6" stroke-width="1.5"/>
        <text x="82" y="85" text-anchor="middle" font-size="14">👕</text>
        <rect x="106" y="66" width="28" height="29" rx="4" fill="#BFDBFE" stroke="#3B82F6" stroke-width="1.5"/>
        <text x="120" y="85" text-anchor="middle" font-size="14">💄</text>
        <rect x="144" y="66" width="28" height="29" rx="4" fill="#FEE2E2" stroke="#EF4444" stroke-width="1.5"/>
        <text x="158" y="85" text-anchor="middle" font-size="12">⚠️</text>
        <!-- Alerte stock -->
        <rect x="125" y="25" width="65" height="26" rx="8" fill="#FEF3C7" stroke="#F59E0B" stroke-width="1.5"/>
        <text x="157" y="33" text-anchor="middle" font-size="8" fill="#92400E" font-weight="bold">Stock faible !</text>
        <text x="157" y="44" text-anchor="middle" font-size="8" fill="#D97706">Chaussures : 1</text>
        <!-- Flèche -->
        <line x1="148" y1="51" x2="155" y2="64" stroke="#F59E0B" stroke-width="1.5" marker-end="url(#arr)"/>
      </svg>`,
    },
    {
      icon: '📈',
      color: ['#F59E0B', '#D97706'],
      title: 'Suivez vos\nbénéfices',
      desc: 'La section Chiffres affiche votre CA, vos marges, vos meilleurs produits et l\'évolution de vos ventes.',
      cta: 'Suivant →',
      svg: `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg">
        <!-- Fond carte -->
        <rect x="20" y="20" width="160" height="100" rx="12" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1.5"/>
        <!-- Titre -->
        <text x="100" y="38" text-anchor="middle" font-size="11" font-weight="bold" fill="#92400E">📈 MES CHIFFRES</text>
        <!-- Graphique barres -->
        <rect x="35" y="90" width="16" height="30" rx="3" fill="#FCD34D"/>
        <rect x="57" y="75" width="16" height="45" rx="3" fill="#FBBF24"/>
        <rect x="79" y="60" width="16" height="60" rx="3" fill="#F59E0B"/>
        <rect x="101" y="50" width="16" height="70" rx="3" fill="#D97706"/>
        <rect x="123" y="40" width="16" height="80" rx="3" fill="#B45309"/>
        <rect x="145" y="30" width="16" height="90" rx="3" fill="#92400E"/>
        <!-- Ligne tendance -->
        <polyline points="43,85 65,70 87,55 109,45 131,35 153,25"
          fill="none" stroke="#EF4444" stroke-width="2" stroke-dasharray="4,2"/>
        <!-- Axe X -->
        <line x1="30" y1="120" x2="170" y2="120" stroke="#E5E7EB" stroke-width="1.5"/>
        <!-- CA badge -->
        <rect x="55" y="22" width="90" height="0" fill="none"/>
      </svg>`,
    },
    {
      icon: '🚀',
      color: ['#EC4899', '#BE185D'],
      title: 'Vous êtes prêt !',
      desc: 'Ajoutez vos premières catégories, puis vos produits. Votre première vente est à portée de main !',
      cta: '🚀 Démarrer maintenant !',
      confetti: true,
      svg: `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg">
        <!-- Fusée -->
        <g transform="translate(75,10) rotate(-15)">
          <ellipse cx="25" cy="50" rx="16" ry="40" fill="#EC4899"/>
          <polygon points="25,5 9,30 41,30" fill="#BE185D"/>
          <rect x="12" y="75" width="8" height="18" rx="3" fill="#FCA5A5" transform="rotate(10,16,84)"/>
          <rect x="30" y="75" width="8" height="18" rx="3" fill="#FCA5A5" transform="rotate(-10,34,84)"/>
          <circle cx="25" cy="48" r="9" fill="white" opacity=".9"/>
          <circle cx="25" cy="48" r="5" fill="#7C3AED"/>
          <!-- Flamme -->
          <ellipse cx="25" cy="98" rx="8" ry="14" fill="#FCD34D" opacity=".8"/>
          <ellipse cx="25" cy="100" rx="5" ry="10" fill="#F97316" opacity=".9"/>
        </g>
        <!-- Étoiles -->
        <text x="20" y="40" font-size="16">⭐</text>
        <text x="155" y="35" font-size="14">✨</text>
        <text x="25" y="110" font-size="12">🌟</text>
        <text x="160" y="105" font-size="16">💫</text>
        <text x="145" y="75" font-size="12">⭐</text>
        <!-- Confettis déco -->
        <rect x="30" y="55" width="8" height="8" rx="2" fill="#7C3AED" transform="rotate(25,34,59)"/>
        <rect x="155" y="50" width="8" height="8" rx="2" fill="#10B981" transform="rotate(-20,159,54)"/>
        <rect x="165" y="80" width="6" height="6" rx="1" fill="#F59E0B" transform="rotate(40,168,83)"/>
        <rect x="15" y="80" width="6" height="6" rx="1" fill="#EC4899" transform="rotate(-30,18,83)"/>
      </svg>`,
    },
  ];

  // ══════════════════════════════════════
  // CONFETTIS
  // ══════════════════════════════════════
  const CONFETTI_COLORS = ['#7C3AED','#EC4899','#10B981','#F59E0B','#3B82F6','#F472B6'];

  function fireConfetti() {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10000;overflow:hidden;';
    document.body.appendChild(container);

    for (let i = 0; i < 60; i++) {
      const p = document.createElement('div');
      const size = 6 + Math.random() * 8;
      p.style.cssText = `
        position:absolute;
        width:${size}px; height:${size}px;
        background:${CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]};
        border-radius:${Math.random() > .5 ? '50%' : '2px'};
        left:${Math.random() * 100}%;
        top:-10px;
        animation: confettiFall ${1 + Math.random() * 1.5}s ease-in ${Math.random() * .8}s forwards;
        transform: rotate(${Math.random() * 360}deg);
      `;
      container.appendChild(p);
    }

    // Injecter l'animation si pas déjà là
    if (!document.getElementById('confetti-style')) {
      const s = document.createElement('style');
      s.id = 'confetti-style';
      s.textContent = `
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity:1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity:0; }
        }
      `;
      document.head.appendChild(s);
    }

    setTimeout(() => container.remove(), 3000);
  }

  // ══════════════════════════════════════
  // RENDU ONBOARDING
  // ══════════════════════════════════════
  let currentStep = 0;
  let overlay     = null;
  let startX      = 0;

  function show() {
    if (document.getElementById('onboarding-v2')) return;

    overlay = document.createElement('div');
    overlay.id = 'onboarding-v2';
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:9000;
      background:rgba(10,7,30,.9);
      backdrop-filter:blur(8px);
      display:flex; flex-direction:column;
      align-items:center; justify-content:flex-end;
      padding:0 0 calc(var(--safe-b,0px) + 16px);
      animation:onbFadeIn .3s ease both;
    `;

    overlay.innerHTML = `
      <style>
        @keyframes onbFadeIn    { from{opacity:0}            to{opacity:1} }
        @keyframes onbSlideUp   { from{transform:translateY(40px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes onbSlideLeft { from{transform:translateX(60px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes onbSlideRight{ from{transform:translateX(-60px);opacity:0} to{transform:translateX(0);opacity:1} }
      </style>

      <!-- Card principale -->
      <div id="onb-card" style="
        background:var(--surface,#fff);
        border-radius:28px 28px 20px 20px;
        width:100%; max-width:480px;
        padding:28px 24px 24px;
        animation:onbSlideUp .4s cubic-bezier(.34,1.3,.64,1) both;
      ">
        <!-- Barre de progression -->
        <div style="display:flex;gap:6px;margin-bottom:22px;">
          ${STEPS.map((_,i) => `
            <div id="onb-prog-${i}" style="
              height:4px; flex:1; border-radius:2px;
              background:${i===0?'var(--primary,#7C3AED)':'#E5E7EB'};
              transition:background .3s ease;
            "></div>
          `).join('')}
        </div>

        <!-- Illustration SVG -->
        <div id="onb-svg-wrap" style="
          width:100%; height:160px;
          display:flex; align-items:center; justify-content:center;
          margin-bottom:20px;
        "></div>

        <!-- Texte -->
        <div id="onb-text-wrap" style="text-align:center;margin-bottom:24px;">
          <div id="onb-title" style="
            font-family:'Sora',sans-serif;
            font-size:22px; font-weight:800; line-height:1.25;
            color:var(--text,#1E1B4B); margin-bottom:10px;
          "></div>
          <div id="onb-desc" style="
            font-size:14px; line-height:1.6;
            color:var(--muted,#6B7280); font-weight:500;
          "></div>
        </div>

        <!-- Bouton CTA -->
        <button id="onb-cta" style="
          width:100%; padding:15px;
          border:none; border-radius:16px;
          font-family:'Sora',sans-serif;
          font-size:15px; font-weight:800;
          cursor:pointer; letter-spacing:-.2px;
          transition:transform .12s;
        "></button>

        <!-- Passer -->
        <button id="onb-skip" style="
          width:100%; padding:10px;
          background:none; border:none;
          font-size:13px; color:var(--muted,#9CA3AF);
          cursor:pointer; margin-top:6px;
          font-family:'DM Sans',sans-serif;
        ">Passer l'introduction</button>
      </div>
    `;

    document.body.appendChild(overlay);
    renderStep(0);

    // Swipe
    const card = overlay.querySelector('#onb-card');
    card.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, {passive:true});
    card.addEventListener('touchend',   e => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) dx < 0 ? nextStep() : prevStep();
    });

    overlay.querySelector('#onb-cta').addEventListener('click',  nextStep);
    overlay.querySelector('#onb-skip').addEventListener('click', finish);
  }

  function renderStep(idx, direction = 'right') {
    const step  = STEPS[idx];
    const card  = overlay.querySelector('#onb-card');
    if (!card) return;

    // Mettre à jour la barre de progression
    STEPS.forEach((_,i) => {
      const bar = overlay.querySelector(`#onb-prog-${i}`);
      if (bar) bar.style.background = i <= idx ? 'var(--primary,#7C3AED)' : '#E5E7EB';
    });

    // Dégradé du bouton selon l'étape
    const [c1, c2] = step.color;
    const cta = overlay.querySelector('#onb-cta');
    cta.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
    cta.style.color       = '#fff';
    cta.style.boxShadow   = `0 6px 20px ${c1}55`;
    cta.textContent = step.cta;

    // Animation direction
    const animClass = direction === 'right' ? 'onbSlideLeft' : 'onbSlideRight';

    const wrap = overlay.querySelector('#onb-svg-wrap');
    const textWrap = overlay.querySelector('#onb-text-wrap');

    // SVG
    wrap.style.animation = 'none';
    wrap.innerHTML = step.svg;
    void wrap.offsetWidth;
    wrap.style.animation = `${animClass} .35s cubic-bezier(.34,1.2,.64,1) both`;

    // Titre
    const title = overlay.querySelector('#onb-title');
    title.innerHTML = step.title.replace('\n', '<br>');
    title.style.animation = 'none';
    void title.offsetWidth;
    title.style.animation = `${animClass} .35s cubic-bezier(.34,1.2,.64,1) .05s both`;

    // Description
    const desc = overlay.querySelector('#onb-desc');
    desc.textContent = step.desc;
    desc.style.animation = 'none';
    void desc.offsetWidth;
    desc.style.animation = `${animClass} .35s cubic-bezier(.34,1.2,.64,1) .1s both`;

    // Cacher "Passer" sur la dernière étape
    overlay.querySelector('#onb-skip').style.display = idx === STEPS.length - 1 ? 'none' : 'block';
  }

  function nextStep() {
    if (currentStep < STEPS.length - 1) {
      currentStep++;
      renderStep(currentStep, 'right');
      if (STEPS[currentStep].confetti) setTimeout(fireConfetti, 200);
    } else {
      finish();
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
      renderStep(currentStep, 'left');
    }
  }

  function finish() {
    localStorage.setItem(KEY, 'true');
    const guide = document.getElementById('userGuide');
    if (guide) { guide.style.display = 'none'; }
    if (overlay) {
      overlay.style.animation = 'onbFadeIn .25s ease reverse both';
      setTimeout(() => { overlay?.remove(); overlay = null; }, 250);
    }

    // Proposer de charger des données de démo
    setTimeout(() => {
      const hasProduits = (window.appData?.produits?.length || 0) > 0;
      if (!hasProduits) {
        showDemoOfferBanner();
      } else {
        window.showNotification?.('🚀 Bienvenue ! Tout est prêt.', 'success');
      }
    }, 500);
  }

  // ══════════════════════════════════════
  // BANNIÈRE OFFRE DONNÉES DÉMO
  // ══════════════════════════════════════
  function showDemoOfferBanner() {
    if (document.getElementById('demo-offer-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'demo-offer-banner';
    banner.style.cssText = `
      position: fixed; bottom: calc(var(--nav-h, 68px) + 12px);
      left: 12px; right: 12px;
      background: linear-gradient(135deg, #5B21B6, #7C3AED);
      border-radius: 18px; padding: 16px;
      box-shadow: 0 8px 32px rgba(124,58,237,.35);
      z-index: 950; animation: slideUp .35s cubic-bezier(.34,1.2,.64,1) both;
    `;
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="font-size:32px;flex-shrink:0;">🎁</div>
        <div style="flex:1;">
          <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:14px;color:#fff;margin-bottom:3px;">
            Démarrer avec des données d'exemple ?
          </div>
          <div style="font-size:12px;color:rgba(255,255,255,.8);line-height:1.4;">
            Ajout de 3 produits et 2 catégories pour découvrir l'app.
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button id="demo-yes-btn" style="flex:1;padding:10px;background:#fff;color:#7C3AED;border:none;border-radius:12px;font-family:'Sora',sans-serif;font-weight:800;font-size:13px;cursor:pointer;">
          ✅ Oui, ajouter
        </button>
        <button id="demo-no-btn" style="flex:1;padding:10px;background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:12px;font-family:'Sora',sans-serif;font-weight:700;font-size:13px;cursor:pointer;">
          Non merci
        </button>
      </div>`;

    document.body.appendChild(banner);

    document.getElementById('demo-yes-btn').onclick = async () => {
      banner.remove();
      await loadDemoData();
    };
    document.getElementById('demo-no-btn').onclick = () => {
      banner.remove();
      window.showNotification?.('🚀 C\'est parti ! Commencez par ajouter vos produits.', 'success');
    };

    // Auto-masquer après 15s
    setTimeout(() => banner?.remove(), 15000);
  }

  // ══════════════════════════════════════
  // DONNÉES DE DÉMONSTRATION
  // ══════════════════════════════════════
  async function loadDemoData() {
    const API = document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
    const auth = window.authfetch;
    if (!auth) return;

    window.showNotification?.('⏳ Ajout des données d\'exemple…', 'info');

    try {
      // 1. Créer 2 catégories
      const cats = [
        { name: 'Vêtements',   emoji: '👕', couleur: 'category-habits' },
        { name: 'Accessoires', emoji: '💍', couleur: 'category-accessoires' },
      ];
      const createdCats = [];
      for (const cat of cats) {
        const r = await auth(`${API}/categories`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cat)
        });
        if (r?.ok) createdCats.push(await r.json());
      }

      const catId1 = createdCats[0]?.id || 1;
      const catId2 = createdCats[1]?.id || 2;

      // 2. Créer 3 produits
      const products = [
        { name: 'T-shirt blanc',    category_id: catId1, price: 3500, price_achat: 1500, stock: 20 },
        { name: 'Jean slim',        category_id: catId1, price: 12000, price_achat: 7000, stock: 8 },
        { name: 'Ceinture cuir',    category_id: catId2, price: 4500, price_achat: 2000, stock: 15 },
      ];
      for (const prod of products) {
        await auth(`${API}/products`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prod)
        });
      }

      // 3. Recharger les données
      await window.syncFromServer?.();
      window.afficherProduits?.();
      window.afficherCategories?.();
      window.afficherCategoriesVente?.();

      window.showNotification?.('✅ Données d\'exemple ajoutées ! Explorez l\'app.', 'success');

    } catch (err) {
      console.warn('loadDemoData:', err.message);
      window.showNotification?.('❌ Impossible d\'ajouter les données. Réessayez.', 'error');
    }
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    if (localStorage.getItem(KEY)) {
      // Onboarding déjà vu → cacher le guide texte directement
      const guide = document.getElementById('userGuide');
      if (guide) guide.style.display = 'none';
      return;
    }

    // Attendre que l'app soit chargée
    setTimeout(show, 1500);
  }

  // Réinitialiser depuis console
  window.resetOnboarding = () => {
    localStorage.removeItem(KEY);
    const guide = document.getElementById('userGuide');
    if (guide) guide.style.display = '';
    show();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
