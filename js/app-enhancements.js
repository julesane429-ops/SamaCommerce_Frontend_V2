/**
 * app-enhancements.js — Améliorations groupées
 *
 * 1. 📱 Notification de bienvenue personnalisée au démarrage
 * 2. 📦 Alerte réappro automatique dans l'accueil
 * 3. 🔍 Recherche dans commandes clients + livraisons
 * 4. ⚡ Pagination "Voir plus" dans commandes + livraisons
 * 5. 🔒 Expiration de session gracieuse
 *
 * INTÉGRATION : <script src="js/app-enhancements.js"></script>
 */
(function () {

  const API  = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth = (url, o={}) => window.authfetch(url, o);

  // ══════════════════════════════════════
  // 1. NOTIFICATION DE BIENVENUE
  // ══════════════════════════════════════
  function showWelcomeNotification() {
    const TODAY_KEY = 'sc_welcome_' + new Date().toISOString().split('T')[0];
    if (localStorage.getItem(TODAY_KEY)) return;
    localStorage.setItem(TODAY_KEY, '1');

    const ventes   = window.appData?.ventes || [];
    const hier     = new Date(); hier.setDate(hier.getDate() - 1);
    const hierStr  = hier.toISOString().split('T')[0];
    const hierCA   = ventes
      .filter(v => { const d = new Date(v.created_at||v.date); return !isNaN(d) && d.toISOString().split('T')[0] === hierStr && v.paid; })
      .reduce((s,v) => s + (+v.total||0), 0);

    const boutique = document.getElementById('appHeader')?.textContent?.replace('🏪','').trim() || 'votre boutique';
    const hour     = new Date().getHours();
    const greet    = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

    const msg = hierCA > 0
      ? `${greet} 👋 Hier vous avez encaissé ${hierCA.toLocaleString('fr-FR')} F. Bonne journée !`
      : `${greet} 👋 Bienvenue sur ${boutique} ! Bonne journée !`;

    window.showNotification?.(msg, 'success');
  }

  // ══════════════════════════════════════
  // 2. ALERTE RÉAPPRO DANS L'ACCUEIL
  // ══════════════════════════════════════
  function showReapproAlert() {
    const produits = window.appData?.produits || [];
    const ruptures = produits.filter(p => (+p.stock - +(p.stock_reserved||0)) <= 0);
    const faibles  = produits.filter(p => {
      const dispo = +p.stock - +(p.stock_reserved||0);
      return dispo > 0 && dispo <= 3;
    });

    const container = document.getElementById('alertesStock');
    if (!container) return;
    if (!ruptures.length && !faibles.length) { container.style.display = 'none'; return; }

    // Bannière de réappro dans l'accueil (supplémentaire au bandeau stock faible)
    const existing = document.getElementById('reappro-home-alert');
    if (existing) existing.remove();

    const menuSection = document.getElementById('menuSection');
    if (!menuSection) return;

    const banner = document.createElement('div');
    banner.id = 'reappro-home-alert';
    banner.style.cssText = `
      background:linear-gradient(135deg,#FEF3C7,#FDE68A);
      border-radius:18px;padding:14px 16px;margin-bottom:14px;
      border:1.5px solid #F59E0B;
      animation:reapproIn .35s cubic-bezier(.34,1.3,.64,1) both;
    `;

    const total = ruptures.length + faibles.length;

    // Trouver les fournisseurs liés
    async function getReapproLink() {
      try {
        const fournisseurs = await auth(`${API()}/fournisseurs`).then(r => r.ok ? r.json() : []);
        const avecProduits = fournisseurs.filter(f => +f.nb_produits > 0);
        if (avecProduits.length > 0) {
          return `<button onclick="window.closePlusSheet?.();window.navTo?.('fournisseurs')" style="
            background:linear-gradient(135deg,#D97706,#F59E0B);color:#fff;
            border:none;padding:8px 14px;border-radius:10px;
            font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;
            box-shadow:0 2px 8px rgba(217,119,6,.3);
          ">🏭 Contacter fournisseur</button>`;
        }
      } catch {}
      return '';
    }

    banner.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
        <div style="flex:1;">
          <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:#92400E;margin-bottom:4px;">
            ⚠️ ${total} produit${total>1?'s':''} à réapprovisionner
          </div>
          ${ruptures.length ? `<div style="font-size:12px;color:#B45309;margin-bottom:2px;">⛔ Rupture : ${ruptures.slice(0,3).map(p=>p.name).join(', ')}${ruptures.length>3?'…':''}</div>` : ''}
          ${faibles.length  ? `<div style="font-size:12px;color:#D97706;">⚠️ Stock faible : ${faibles.slice(0,3).map(p=>p.name).join(', ')}${faibles.length>3?'…':''}</div>` : ''}
        </div>
        <button onclick="document.getElementById('reappro-home-alert').remove()" style="
          background:none;border:none;font-size:16px;color:#D97706;cursor:pointer;padding:0;flex-shrink:0;
        ">✕</button>
      </div>
      <div id="reappro-btn-wrap" style="margin-top:10px;"></div>
    `;

    // Insérer après le guide
    const guide = menuSection.querySelector('#userGuide');
    if (guide) guide.after(banner);
    else menuSection.insertBefore(banner, menuSection.firstChild.nextSibling);

    // Ajouter le bouton fournisseur de façon asynchrone
    getReapproLink().then(html => {
      const wrap = document.getElementById('reappro-btn-wrap');
      if (wrap && html) wrap.innerHTML = html;
    });
  }

  // ══════════════════════════════════════
  // 3. RECHERCHE COMMANDES + LIVRAISONS
  // ══════════════════════════════════════
  function injectSearchBars() {
    // Commandes clients
    injectSearchInSection('customerOrders', 'customerOrdersList', (row, q) => {
      const name = row.querySelector('.entity-name, [style*="font-weight:800"]')?.textContent?.toLowerCase() || '';
      const addr = row.textContent?.toLowerCase() || '';
      return name.includes(q) || addr.includes(q);
    });

    // Livraisons
    injectSearchInSection('deliveries', 'deliveriesList', (row, q) => {
      return row.textContent?.toLowerCase().includes(q);
    });
  }

  function injectSearchInSection(sectionKey, listId, matchFn) {
    const section = document.getElementById(sectionKey + 'Section');
    if (!section || section.querySelector('.sg-search-bar')) return;

    const header = section.querySelector('.page-header');
    if (!header) return;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;margin-bottom:12px;';
    wrap.innerHTML = `
      <span style="position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:15px;pointer-events:none;">🔍</span>
      <input type="search" class="search-bar sg-search-bar"
        style="padding-left:40px;margin:0;"
        placeholder="Rechercher…">
    `;
    header.after(wrap);

    const input = wrap.querySelector('input');
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      const list = document.getElementById(listId);
      if (!list) return;
      list.querySelectorAll('[class*="card"], .entity-card').forEach(card => {
        card.style.display = (!q || matchFn(card, q)) ? '' : 'none';
      });
    });
  }

  // ══════════════════════════════════════
  // 4. PAGINATION "Voir plus"
  // ══════════════════════════════════════
  const PAGE_SIZE = 10;
  const _pages    = {};

  function applyPagination(listId, sectionKey) {
    const list = document.getElementById(listId);
    if (!list) return;

    const obs = new MutationObserver(() => {
      const cards = Array.from(list.querySelectorAll('[class*="card"], .entity-card'))
        .filter(c => c.style.display !== 'none');

      // Supprimer l'ancien bouton "Voir plus"
      list.querySelector('.sg-load-more')?.remove();

      const page = _pages[listId] || 1;
      const shown = page * PAGE_SIZE;

      cards.forEach((c, i) => { c.style.display = i < shown ? '' : 'none'; });

      if (cards.length > shown) {
        const remaining = cards.length - shown;
        const btn = document.createElement('button');
        btn.className = 'sg-load-more';
        btn.style.cssText = `
          width:100%;padding:12px;margin-top:8px;margin-bottom:14px;
          background:#F3F4F6;color:var(--muted);
          border:none;border-radius:14px;
          font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:6px;
        `;
        btn.innerHTML = `⬇️ Voir ${Math.min(remaining, PAGE_SIZE)} de plus (${remaining} restants)`;
        btn.addEventListener('click', () => {
          _pages[listId] = page + 1;
          applyPagination(listId, sectionKey);
        });
        list.appendChild(btn);
      }
    });

    obs.observe(list, { childList: true });
  }

  // ══════════════════════════════════════
  // 5. EXPIRATION SESSION GRACIEUSE
  // ══════════════════════════════════════
  function setupGracefulExpiry() {
    // Intercepter les 401/403 non gérés par token-refresh.js
    const origFetch = window.fetch;
    if (!origFetch || origFetch._graceful) return;

    window.fetch = async function (...args) {
      const res = await origFetch.apply(this, args);

      if ((res.status === 401 || res.status === 403) && navigator.onLine) {
        const url = String(args[0] || '');
        // Uniquement pour les routes API (pas les assets)
        if (url.includes('/auth/') || url.includes('/sales') || url.includes('/products')) {
          const token = localStorage.getItem('authToken');
          if (!token) {
            showSessionExpiredBanner();
          }
        }
      }
      return res;
    };
    window.fetch._graceful = true;
  }

  function showSessionExpiredBanner() {
    if (document.getElementById('session-expired-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'session-expired-banner';
    banner.style.cssText = `
      position:fixed;top:0;left:0;right:0;z-index:9000;
      background:linear-gradient(135deg,#DC2626,#B91C1C);
      color:#fff;padding:12px 16px;
      display:flex;align-items:center;justify-content:space-between;
      font-family:'Sora',sans-serif;font-size:13px;font-weight:700;
      box-shadow:0 4px 20px rgba(0,0,0,.3);
      animation:pgSlide .3s ease both;
    `;
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;">⏰</span>
        <div>
          <div>Session expirée</div>
          <div style="font-size:11px;font-weight:500;opacity:.8;">Veuillez vous reconnecter pour continuer</div>
        </div>
      </div>
      <button onclick="window.location.replace('login/login.html?expired=1')" style="
        background:rgba(255,255,255,.2);border:none;color:#fff;
        padding:8px 14px;border-radius:10px;
        font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;
      ">Connexion →</button>
    `;
    document.body.prepend(banner);
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        showWelcomeNotification();
        showReapproAlert();
        setupGracefulExpiry();
      }, 3000);

      // Injecter recherche + pagination quand les sections s'ouvrent
      window.addEventListener('pageChange', e => {
        const key = e.detail?.key;
        if (key === 'customerOrders') {
          setTimeout(() => {
            injectSearchInSection('customerOrders', 'customerOrdersList', (c, q) => c.textContent?.toLowerCase().includes(q));
            applyPagination('customerOrdersList', 'customerOrders');
          }, 400);
        }
        if (key === 'deliveries') {
          setTimeout(() => {
            injectSearchInSection('deliveries', 'deliveriesList', (c, q) => c.textContent?.toLowerCase().includes(q));
            applyPagination('deliveriesList', 'deliveries');
          }, 400);
        }
        if (key === 'menu') {
          setTimeout(showReapproAlert, 500);
        }
      });
    });
  }

  window.showReapproAlert        = showReapproAlert;
  window.showSessionExpiredBanner = showSessionExpiredBanner;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
