/**
 * reappro.js — Alerte réapprovisionnement automatique
 *
 * Surveille les produits dont le stock tombe sous le seuil critique
 * et propose automatiquement de créer une commande fournisseur.
 *
 * Fonctionnement :
 *  1. Wrapper sur window.verifierStockFaible (appelé après chaque vente/sync)
 *  2. Détecte les produits en rupture (= 0) ou critiques (≤ 2)
 *  3. Affiche une bannière sur l'accueil + notification discrète
 *  4. Bouton "Commander" pré-sélectionne les produits dans openCommandeForm()
 *  5. Mémorise les alertes rejetées (1x/jour par produit)
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/reappro.js"></script>
 */

(function () {

  const STORAGE_KEY    = 'sc_reappro_dismissed'; // { productId: dateStr }
  const SEUIL_CRITIQUE = 2;   // ≤ 2 = critique
  const SEUIL_FAIBLE   = 5;   // ≤ 5 = faible (déjà géré par l'app)
  const CHECK_INTERVAL = 60 * 60 * 1000; // Re-alerter max 1x/heure

  let lastCheck = 0;
  let bannerVisible = false;

  // ══════════════════════════════════════
  // STOCKAGE DES ALERTES REJETÉES
  // ══════════════════════════════════════
  function getDismissed() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  }

  function dismissProduct(id) {
    const d = getDismissed();
    d[id] = new Date().toISOString().split('T')[0]; // date du jour
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  }

  function isDismissedToday(id) {
    const d   = getDismissed();
    const today = new Date().toISOString().split('T')[0];
    return d[String(id)] === today;
  }

  // ══════════════════════════════════════
  // ANALYSER LES PRODUITS CRITIQUES
  // ══════════════════════════════════════
  function getCriticalProducts() {
    const produits = window.appData?.produits || [];
    return produits.filter(p =>
      p.stock <= SEUIL_CRITIQUE && !isDismissedToday(p.id)
    ).sort((a, b) => a.stock - b.stock); // rupture en premier
  }

  // ══════════════════════════════════════
  // BANNIÈRE SUR L'ACCUEIL
  // ══════════════════════════════════════
  function showBanner(criticals) {
    if (bannerVisible) return;
    if (!criticals.length) return;

    // Attendre que menuSection soit visible
    const menu = document.getElementById('menuSection');
    if (!menu || menu.classList.contains('hidden')) return;

    bannerVisible = true;

    // Supprimer bannière existante
    document.getElementById('reappro-banner')?.remove();

    const rupture  = criticals.filter(p => p.stock === 0);
    const critique = criticals.filter(p => p.stock > 0 && p.stock <= SEUIL_CRITIQUE);

    const banner = document.createElement('div');
    banner.id = 'reappro-banner';
    banner.style.cssText = `
      background: linear-gradient(135deg, #FEF3C7, #FFFBEB);
      border: 1.5px solid #F59E0B;
      border-radius: 18px;
      padding: 14px 16px;
      margin-bottom: 12px;
      animation: reapproIn .35s cubic-bezier(.34,1.3,.64,1) both;
    `;

    banner.innerHTML = `
      <style>
        @keyframes reapproIn {
          from { opacity:0; transform:translateY(-10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .reappro-header {
          display:flex; align-items:center; justify-content:space-between;
          margin-bottom:10px;
        }
        .reappro-title {
          font-family:'Sora',sans-serif; font-size:14px; font-weight:800;
          color:#92400E; display:flex; align-items:center; gap:6px;
        }
        .reappro-list {
          display:flex; flex-direction:column; gap:6px; margin-bottom:12px;
        }
        .reappro-item {
          background:rgba(255,255,255,.65); border-radius:10px;
          padding:8px 12px;
          display:flex; align-items:center; justify-content:space-between;
        }
        .reappro-item-left { display:flex; align-items:center; gap:8px; }
        .reappro-item-name {
          font-size:13px; font-weight:700; color:#78350F;
        }
        .reappro-item-stock {
          font-size:11px; font-weight:700;
          padding:2px 8px; border-radius:6px;
        }
        .stock-rupture { background:#FEE2E2; color:#DC2626; }
        .stock-critique { background:#FEF3C7; color:#D97706; }
        .reappro-actions { display:flex; gap:8px; }
        .btn-reappro-cmd {
          flex:2; padding:11px;
          background:linear-gradient(135deg,#F59E0B,#D97706);
          color:#fff; border:none; border-radius:12px;
          font-family:'Sora',sans-serif; font-size:13px; font-weight:800;
          cursor:pointer; box-shadow:0 3px 10px rgba(245,158,11,.35);
          transition:transform .12s; display:flex; align-items:center;
          justify-content:center; gap:6px;
        }
        .btn-reappro-cmd:active { transform:scale(.97); }
        .btn-reappro-dismiss {
          flex:1; padding:11px;
          background:rgba(255,255,255,.6); color:#92400E;
          border:none; border-radius:12px;
          font-family:'Sora',sans-serif; font-size:12px; font-weight:700;
          cursor:pointer;
        }
        .reappro-close-btn {
          background:none; border:none; font-size:18px;
          color:#B45309; cursor:pointer; padding:0; line-height:1;
        }
      </style>

      <div class="reappro-header">
        <div class="reappro-title">
          ⚠️ Stock critique
          <span style="background:#F59E0B;color:#fff;font-size:10px;padding:2px 7px;border-radius:6px;">
            ${criticals.length} produit${criticals.length>1?'s':''}
          </span>
        </div>
        <button class="reappro-close-btn" id="reappro-close">✕</button>
      </div>

      <!-- Liste des produits critiques -->
      <div class="reappro-list">
        ${criticals.slice(0,4).map(p => {
          const cat  = window.appData?.categories?.find(c => c.id === p.category_id);
          const isRupture = p.stock === 0;
          return `
            <div class="reappro-item">
              <div class="reappro-item-left">
                <span style="font-size:18px;">${cat?.emoji || '📦'}</span>
                <div>
                  <div class="reappro-item-name">${p.name}</div>
                  <div style="font-size:11px;color:#92400E;">
                    Prix achat : ${(p.priceAchat||p.price_achat||0).toLocaleString('fr-FR')} F
                  </div>
                </div>
              </div>
              <span class="reappro-item-stock ${isRupture?'stock-rupture':'stock-critique'}">
                ${isRupture ? '⛔ Rupture' : `⚠️ ${p.stock} restant${p.stock>1?'s':''}`}
              </span>
            </div>
          `;
        }).join('')}
        ${criticals.length > 4 ? `
          <div style="text-align:center;font-size:12px;color:#92400E;font-weight:600;">
            + ${criticals.length - 4} autre${criticals.length-4>1?'s':''} produit${criticals.length-4>1?'s':''}
          </div>
        ` : ''}
      </div>

      <!-- Actions -->
      <div class="reappro-actions">
        <button class="btn-reappro-cmd" id="reappro-order-btn">
          📦 Commander maintenant
          <span style="background:rgba(255,255,255,.25);padding:2px 8px;border-radius:6px;font-size:10px;">
            AUTO
          </span>
        </button>
        <button class="btn-reappro-dismiss" id="reappro-dismiss-btn">
          Ignorer aujourd'hui
        </button>
      </div>
    `;

    // Insérer en haut du menuSection (après les actions rapides)
    const alertes = document.getElementById('alertesStock');
    if (alertes && alertes.parentNode) {
      alertes.parentNode.insertBefore(banner, alertes.nextSibling);
    } else {
      const menu = document.getElementById('menuSection');
      menu?.appendChild(banner);
    }

    // ── Commander ──
    banner.querySelector('#reappro-order-btn')?.addEventListener('click', () => {
      openCommandeFromReappro(criticals);
    });

    // ── Ignorer ──
    banner.querySelector('#reappro-dismiss-btn')?.addEventListener('click', () => {
      criticals.forEach(p => dismissProduct(p.id));
      closeBanner();
    });

    // ── Fermer ──
    banner.querySelector('#reappro-close')?.addEventListener('click', closeBanner);
  }

  function closeBanner() {
    const b = document.getElementById('reappro-banner');
    if (b) {
      b.style.animation = 'reapproIn .2s ease reverse both';
      setTimeout(() => { b.remove(); bannerVisible = false; }, 200);
    }
  }

  // ══════════════════════════════════════
  // OUVRIR COMMANDE PRÉ-REMPLIE
  // ══════════════════════════════════════
  function openCommandeFromReappro(criticals) {
    closeBanner();

    // Naviguer vers Commandes
    window.navTo?.('commandes');

    // Attendre que la section soit chargée puis ouvrir le formulaire
    setTimeout(() => {
      if (typeof window.openCommandeForm !== 'function') return;

      // Ouvrir le formulaire standard
      window.openCommandeForm();

      // Après ouverture, pré-sélectionner les produits critiques
      setTimeout(() => {
        criticals.forEach(p => {
          const btn = document.querySelector(`.product-pick-btn[data-id="${p.id}"]`);
          if (btn && !btn.classList.contains('selected')) {
            btn.click();

            // Calculer la quantité suggérée (10 - stock actuel pour atteindre 10)
            const suggested = Math.max(1, 10 - p.stock);
            // Mettre à jour la quantité dans selectedItems
            if (window._cmdSel?.[p.id]) {
              window._cmdSel[p.id].quantity = suggested;
            }
          }
        });

        // Re-render les items sélectionnés
        // (déclencher un input artificiel pour rafraîchir)
        const wrap = document.getElementById('cmd-selected-wrap');
        if (wrap && window._cmdSel) {
          // Reconstruire l'affichage
          const total = Object.values(window._cmdSel).reduce((s,i) => s + i.quantity * i.prix_unitaire, 0);
          const totalLine = document.getElementById('cmd-total-line');
          if (totalLine) totalLine.textContent = total.toLocaleString('fr-FR') + ' F';
        }

        // Notification de confirmation
        window.showNotification?.(`📦 ${criticals.length} produit${criticals.length>1?'s':''} pré-sélectionné${criticals.length>1?'s':''}`, 'success');
      }, 500);
    }, 400);
  }

  // ══════════════════════════════════════
  // NOTIFICATION DISCRÈTE (hors accueil)
  // ══════════════════════════════════════
  function showDiscreetNotif(criticals) {
    const rupture = criticals.filter(p => p.stock === 0).length;
    const msg = rupture > 0
      ? `⛔ ${rupture} produit${rupture>1?'s':''} en rupture · Penser à commander`
      : `⚠️ ${criticals.length} produit${criticals.length>1?'s':''} critique${criticals.length>1?'s':''}`;

    window.showNotification?.(msg, 'warning');
  }

  // ══════════════════════════════════════
  // HOOK SUR verifierStockFaible
  // ══════════════════════════════════════
  function hookVerifierStockFaible() {
    const orig = window.verifierStockFaible;
    if (typeof orig !== 'function') {
      setTimeout(hookVerifierStockFaible, 300);
      return;
    }

    window.verifierStockFaible = function (...args) {
      // Appel original d'abord
      const result = orig.apply(this, args);

      // Vérification des produits critiques avec debounce
      const now = Date.now();
      if (now - lastCheck < CHECK_INTERVAL) return result;

      const criticals = getCriticalProducts();
      if (!criticals.length) return result;

      lastCheck = now;

      // Section visible ?
      const menuVisible = !document.getElementById('menuSection')?.classList.contains('hidden');

      if (menuVisible) {
        // Sur l'accueil : bannière
        setTimeout(() => showBanner(criticals), 300);
      } else {
        // Ailleurs : notif discrète
        showDiscreetNotif(criticals);
      }

      return result;
    };
  }

  // ══════════════════════════════════════
  // OBSERVER navigation vers accueil
  // → afficher bannière si des produits critiques existent
  // ══════════════════════════════════════
  function watchNavigation() {
    window.addEventListener('pageChange', e => {
      if (e.detail?.key !== 'menu') return;
      if (bannerVisible) return;

      setTimeout(() => {
        const criticals = getCriticalProducts();
        if (criticals.length) showBanner(criticals);
      }, 400);
    });

    // Hook showSection pour compat utils.js
    const origShow = window.showSection;
    if (typeof origShow === 'function') {
      window.showSection = function (section, ...args) {
        origShow.call(this, section, ...args);
        if (section === 'menu') {
          setTimeout(() => {
            if (bannerVisible) return;
            const criticals = getCriticalProducts();
            if (criticals.length) showBanner(criticals);
          }, 400);
        }
      };
    }
  }

  // ══════════════════════════════════════
  // HOOK SUR modifierStock
  // Alerte immédiate quand le stock passe sous le seuil
  // ══════════════════════════════════════
  function hookModifierStock() {
    const orig = window.modifierStock;
    if (typeof orig !== 'function') {
      setTimeout(hookModifierStock, 300);
      return;
    }

    window.modifierStock = function (id, delta, ...args) {
      const result = orig.call(this, id, delta, ...args);

      // Vérifier après modification
      setTimeout(() => {
        const produit = window.appData?.produits?.find(p => p.id === id);
        if (!produit) return;

        if (produit.stock <= SEUIL_CRITIQUE && !isDismissedToday(id)) {
          // Reset lastCheck pour forcer l'alerte immédiate
          lastCheck = 0;
          window.verifierStockFaible?.();
        }
      }, 200);

      return result;
    };
  }

  // ══════════════════════════════════════
  // API PUBLIQUE
  // ══════════════════════════════════════
  window.reappro = {
    check:     () => { lastCheck = 0; const c = getCriticalProducts(); if (c.length) showBanner(c); return c; },
    dismiss:   (id) => dismissProduct(id),
    reset:     () => localStorage.removeItem(STORAGE_KEY),
    getCriticals: getCriticalProducts,
  };

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        hookVerifierStockFaible();
        hookModifierStock();
        watchNavigation();

        // Vérification initiale après chargement des données
        setTimeout(() => {
          const criticals = getCriticalProducts();
          if (criticals.length) {
            const menuVisible = !document.getElementById('menuSection')?.classList.contains('hidden');
            if (menuVisible) showBanner(criticals);
            else showDiscreetNotif(criticals);
          }
        }, 3000);
      }, 600);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
