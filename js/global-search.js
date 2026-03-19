/**
 * global-search.js — Recherche globale unifiée
 *
 * Cherche simultanément dans :
 *   📦 Produits     (nom, catégorie)
 *   👥 Clients      (nom, téléphone, email)
 *   🧾 Ventes       (produit, montant, date)
 *   💳 Crédits      (client, produit, statut)
 *
 * Déclenchement :
 *   - Bouton 🔍 injecté dans le header
 *   - Raccourci : appui long (500ms) sur le header
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/global-search.js"></script>
 */

(function () {

  let overlay  = null;
  let debounce = null;

  // ══════════════════════════════════════
  // INJECTER LE BOUTON DANS LE HEADER
  // ══════════════════════════════════════
  function injectSearchBtn() {
    if (document.getElementById('global-search-btn')) return;

    const header = document.querySelector('.header-inner');
    if (!header) return;

    const btn = document.createElement('button');
    btn.id = 'global-search-btn';
    btn.setAttribute('aria-label', 'Recherche globale');
    btn.style.cssText = `
      background: rgba(255,255,255,.2);
      border: none;
      width: 38px; height: 38px;
      border-radius: 11px;
      color: #fff;
      font-size: 18px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(6px);
      flex-shrink: 0;
      transition: background .2s;
      -webkit-tap-highlight-color: transparent;
    `;
    btn.textContent = '🔍';
    btn.addEventListener('click', openSearch);
    btn.addEventListener('touchstart', () => btn.style.background = 'rgba(255,255,255,.35)', {passive:true});
    btn.addEventListener('touchend',   () => btn.style.background = 'rgba(255,255,255,.2)', {passive:true});

    // Insérer avant .header-icon (dernier enfant)
    const icon = header.querySelector('.header-icon');
    if (icon) header.insertBefore(btn, icon);
    else header.appendChild(btn);
  }

  // ══════════════════════════════════════
  // OUVRIR L'OVERLAY
  // ══════════════════════════════════════
  function openSearch() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'global-search-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 900;
      background: rgba(10,7,30,.65);
      backdrop-filter: blur(8px);
      display: flex; flex-direction: column;
      align-items: center;
      padding: 60px 16px 0;
      animation: gsIn .2s ease both;
    `;

    overlay.innerHTML = `
      <style>
        @keyframes gsIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes gsOut { from { opacity:1; } to { opacity:0; } }
        @keyframes gsItemIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

        #gs-input-wrap {
          width: 100%; max-width: 480px;
          position: relative; margin-bottom: 14px;
        }
        #gs-input {
          width: 100%;
          padding: 14px 48px 14px 50px;
          border: none;
          border-radius: 18px;
          font-family: 'Sora', sans-serif;
          font-size: 16px; font-weight: 600;
          background: #fff;
          color: #1E1B4B;
          outline: none;
          box-shadow: 0 8px 32px rgba(0,0,0,.25);
          -webkit-appearance: none;
        }
        .dark #gs-input { background: #1E1B2E; color: var(--text,#F1F0FF); }

        #gs-search-icon {
          position: absolute; left: 16px; top: 50%;
          transform: translateY(-50%);
          font-size: 20px; pointer-events: none;
        }
        #gs-clear-btn {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          background: #EDE9FE; border: none;
          width: 28px; height: 28px; border-radius: 8px;
          font-size: 13px; cursor: pointer; color: #7C3AED;
          display: none; align-items: center; justify-content: center;
        }
        #gs-clear-btn.visible { display: flex; }

        #gs-results {
          width: 100%; max-width: 480px;
          max-height: calc(100dvh - 160px);
          overflow-y: auto;
          display: flex; flex-direction: column; gap: 8px;
          padding-bottom: 20px;
        }

        .gs-section-label {
          font-size: 11px; font-weight: 800; text-transform: uppercase;
          letter-spacing: .5px; color: rgba(255,255,255,.6);
          padding: 2px 4px; margin-top: 4px;
        }

        .gs-item {
          background: var(--surface, #fff);
          border-radius: 16px;
          padding: 13px 14px;
          display: flex; align-items: center; gap: 12px;
          cursor: pointer;
          box-shadow: 0 2px 12px rgba(0,0,0,.12);
          animation: gsItemIn .25s ease both;
          transition: transform .12s;
          -webkit-tap-highlight-color: transparent;
        }
        .gs-item:active { transform: scale(.98); }

        .gs-item-icon {
          width: 42px; height: 42px; border-radius: 13px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; flex-shrink: 0;
        }
        .gs-item-body { flex: 1; min-width: 0; }
        .gs-item-name {
          font-family: 'Sora', sans-serif;
          font-size: 14px; font-weight: 700;
          color: var(--text, #1E1B4B);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .gs-item-sub {
          font-size: 12px; color: var(--muted, #6B7280);
          margin-top: 2px;
        }
        .gs-item-right {
          font-family: 'Sora', sans-serif;
          font-size: 13px; font-weight: 800;
          color: var(--primary, #7C3AED);
          flex-shrink: 0; text-align: right;
        }
        .gs-hl { background: rgba(124,58,237,.15); border-radius: 3px; padding: 0 2px; font-weight: 800; color: #7C3AED; }

        .gs-empty {
          text-align: center; padding: 30px 0;
          color: rgba(255,255,255,.6);
        }
        .gs-empty-icon { font-size: 40px; margin-bottom: 10px; }
        .gs-empty-text { font-size: 14px; font-weight: 600; }

        .gs-hint {
          text-align: center;
          color: rgba(255,255,255,.5);
          font-size: 13px; font-weight: 500;
          margin-top: 10px;
        }
        .gs-hint strong { color: rgba(255,255,255,.8); }
      </style>

      <div id="gs-input-wrap">
        <span id="gs-search-icon">🔍</span>
        <input id="gs-input" type="search"
               placeholder="Rechercher produit, client, vente…"
               autocomplete="off" autocorrect="off" spellcheck="false"
               autofocus>
        <button id="gs-clear-btn" aria-label="Effacer">✕</button>
      </div>

      <div id="gs-results">
        <div class="gs-hint">
          Tapez pour chercher dans <strong>tous</strong> vos données
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input   = overlay.querySelector('#gs-input');
    const clearBtn = overlay.querySelector('#gs-clear-btn');
    const results  = overlay.querySelector('#gs-results');

    // Focus auto
    setTimeout(() => input?.focus(), 50);

    // Fermer en cliquant sur le fond
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeSearch();
    });

    // Touche Echap
    document.addEventListener('keydown', onKeyDown);

    // Input
    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearBtn.classList.toggle('visible', q.length > 0);
      clearTimeout(debounce);
      if (!q) { results.innerHTML = '<div class="gs-hint">Tapez pour chercher dans <strong>tous</strong> vos données</div>'; return; }
      debounce = setTimeout(() => doSearch(q, results), 180);
    });

    // Effacer
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.remove('visible');
      results.innerHTML = '<div class="gs-hint">Tapez pour chercher dans <strong>tous</strong> vos données</div>';
      input.focus();
    });
  }

  // ══════════════════════════════════════
  // FERMER
  // ══════════════════════════════════════
  function closeSearch() {
    if (!overlay) return;
    overlay.style.animation = 'gsOut .18s ease both';
    setTimeout(() => { overlay?.remove(); overlay = null; }, 180);
    document.removeEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') closeSearch();
  }

  // ══════════════════════════════════════
  // HIGHLIGHT
  // ══════════════════════════════════════
  function hl(text, q) {
    if (!q || !text) return text || '';
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return String(text).replace(new RegExp(`(${esc})`, 'gi'),
      '<span class="gs-hl">$1</span>');
  }

  // ══════════════════════════════════════
  // RECHERCHE PRINCIPALE
  // ══════════════════════════════════════
  function doSearch(q, results) {
    const data = window.appData;
    if (!data) {
      results.innerHTML = '<div class="gs-hint">Données en cours de chargement…</div>';
      return;
    }

    const term    = q.toLowerCase();
    const groups  = [];
    let totalHits = 0;

    // ── 📦 Produits ──
    const produits = (data.produits || []).filter(p =>
      (p.name || '').toLowerCase().includes(term)
    );
    if (produits.length) {
      groups.push({ label: '📦 Produits', items: produits.slice(0,5).map(p => {
        const cat = data.categories?.find(c => c.id === p.category_id);
        return {
          icon:    cat?.emoji || '📦',
          iconBg:  '#EDE9FE',
          name:    hl(p.name, q),
          sub:     `${cat?.name || ''} · Stock : ${p.stock}`,
          right:   `${(p.price||0).toLocaleString('fr-FR')} F`,
          action:  () => { closeSearch(); window.showSection?.('stock'); },
        };
      })});
      totalHits += produits.length;
    }

    // ── 👥 Clients (depuis appData ou cache) ──
    const clientsRaw = data.clients || window._clientsCache || [];
    const clients = clientsRaw.filter(c =>
      (c.name  || '').toLowerCase().includes(term) ||
      (c.phone || '').includes(term) ||
      (c.email || '').toLowerCase().includes(term)
    );
    if (clients.length) {
      groups.push({ label: '👥 Clients', items: clients.slice(0,4).map(c => {
        const ini = (c.name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
        return {
          icon:    ini,
          iconBg:  'linear-gradient(135deg,#7C3AED,#EC4899)',
          iconColor: '#fff',
          iconFont: '14px',
          name:    hl(c.name, q),
          sub:     hl(c.phone || c.email || 'Aucun contact', q),
          right:   `${(+c.total_achats||0).toLocaleString('fr-FR')} F`,
          action:  () => { closeSearch(); window.showSection?.('clients'); setTimeout(()=>window.openClientDetail?.(c.id), 300); },
        };
      })});
      totalHits += clients.length;
    }

    // ── 🧾 Ventes ──
    const ventes = (data.ventes || []).filter(v => {
      const prod = data.produits?.find(p => p.id === v.product_id);
      return (prod?.name || v.product_name || '').toLowerCase().includes(term) ||
             (v.client_name || '').toLowerCase().includes(term) ||
             String(v.total || '').includes(term);
    });
    if (ventes.length) {
      groups.push({ label: '🧾 Ventes', items: ventes.slice(0,5).map(v => {
        const prod   = data.produits?.find(p => p.id === v.product_id);
        const dateStr = v.created_at ? new Date(v.created_at).toLocaleDateString('fr-FR', {day:'2-digit',month:'short'}) : '—';
        return {
          icon:   '🧾',
          iconBg: '#ECFDF5',
          name:   hl(prod?.name || v.product_name || '—', q),
          sub:    `${dateStr} · ${v.payment_method || '—'}${v.client_name ? ' · '+v.client_name : ''}`,
          right:  `${(v.total||0).toLocaleString('fr-FR')} F`,
          action: () => { closeSearch(); window.showSection?.('rapports'); },
        };
      })});
      totalHits += ventes.length;
    }

    // ── 💳 Crédits ──
    const credits = (data.credits || []).filter(c =>
      (c.client_name || '').toLowerCase().includes(term) ||
      (c.product_name || '').toLowerCase().includes(term)
    );
    if (credits.length) {
      groups.push({ label: '💳 Crédits', items: credits.slice(0,4).map(c => {
        const statut = c.paid ? '✅ Payé' : '⚠️ Impayé';
        return {
          icon:   c.paid ? '✅' : '⚠️',
          iconBg: c.paid ? '#ECFDF5' : '#FEF2F2',
          name:   hl(c.client_name || '—', q),
          sub:    `${c.product_name||'—'} · ${statut}`,
          right:  `${(c.total||0).toLocaleString('fr-FR')} F`,
          action: () => { closeSearch(); window.showSection?.('credits'); },
        };
      })});
      totalHits += credits.length;
    }

    // ── Pas de résultats ──
    if (!totalHits) {
      results.innerHTML = `
        <div class="gs-empty">
          <div class="gs-empty-icon">🔎</div>
          <div class="gs-empty-text">Aucun résultat pour « ${escHtml(q)} »</div>
        </div>`;
      return;
    }

    // ── Rendu ──
    results.innerHTML = '';
    groups.forEach((group, gi) => {
      const label = document.createElement('div');
      label.className = 'gs-section-label';
      label.textContent = group.label;
      results.appendChild(label);

      group.items.forEach((item, ii) => {
        const el = document.createElement('div');
        el.className = 'gs-item';
        el.style.animationDelay = `${(gi * 5 + ii) * 30}ms`;

        const isText = item.iconFont; // initiales texte
        el.innerHTML = `
          <div class="gs-item-icon" style="background:${item.iconBg};${item.iconColor?`color:${item.iconColor};`:''}${isText?`font-family:'Sora',sans-serif;font-weight:800;font-size:${item.iconFont};`:''}">${item.icon}</div>
          <div class="gs-item-body">
            <div class="gs-item-name">${item.name}</div>
            <div class="gs-item-sub">${item.sub}</div>
          </div>
          ${item.right ? `<div class="gs-item-right">${item.right}</div>` : ''}
        `;
        el.addEventListener('click', item.action);
        results.appendChild(el);
      });
    });

    // Compteur
    if (totalHits > 0) {
      const count = document.createElement('div');
      count.style.cssText = 'text-align:center;color:rgba(255,255,255,.5);font-size:12px;margin-top:6px;';
      count.textContent = `${totalHits} résultat${totalHits>1?'s':''} trouvé${totalHits>1?'s':''}`;
      results.appendChild(count);
    }
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ══════════════════════════════════════
  // EXPOSER ET INIT
  // ══════════════════════════════════════
  window.openGlobalSearch = openSearch;
  window.closeGlobalSearch = closeSearch;

  function init() {
    injectSearchBtn();
    // Appui long sur le header → ouvrir la recherche
    const header = document.querySelector('.top-header');
    if (header) {
      let pressTimer = null;
      header.addEventListener('touchstart', () => {
        pressTimer = setTimeout(openSearch, 500);
      }, {passive:true});
      header.addEventListener('touchend', () => clearTimeout(pressTimer), {passive:true});
      header.addEventListener('touchmove', () => clearTimeout(pressTimer), {passive:true});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
