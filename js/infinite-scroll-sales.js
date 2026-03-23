/**
 * infinite-scroll-sales.js — Infinite scroll sur l'historique des ventes
 *
 * Patche window.renderSalesHistory pour n'afficher que 30 ventes à la fois.
 * Quand l'utilisateur scrolle jusqu'en bas :
 *   1. Charge les 30 ventes suivantes depuis appData.ventes (cache local)
 *   2. Si toutes les ventes locales sont affichées, fetch le serveur
 *      via /sales?cursor=<last_id> (API cursor-based déjà en place)
 *
 * Intégration dans index.html (après app.js) :
 *   <script src="js/infinite-scroll-sales.js"></script>
 */

(function () {
  const PAGE_SIZE = 30;

  // ── État interne ──
  let _allVentes    = [];   // toutes les ventes connues (local + server)
  let _page         = 1;   // page courante
  let _loading      = false;
  let _hasMore      = false;
  let _serverCursor = null; // id de la dernière vente locale → cursor pour le serveur
  let _observer     = null;

  // ── Render une tranche de ventes ──
  function renderSlice(ventes, clear) {
    const tbody = document.getElementById('salesHistoryBody');
    if (!tbody) return;

    if (clear) {
      tbody.innerHTML = '';
      // Retirer l'ancien sentinel si présent
      document.getElementById('sc-scroll-sentinel')?.remove();
    }

    if (!ventes.length && clear) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-gray-500 p-4">Aucune vente</td>
        </tr>`;
      return;
    }

    const produits = window.appData?.produits || [];

    for (const v of ventes) {
      if (v._optimistic) continue; // ignorer les ventes optimistic en cours d'envoi
      const prod    = produits.find(p => Number(p.id) === Number(v.product_id));
      const montant = Number.isFinite(Number(v.total)) ? Number(v.total) : 0;
      const nom     = v.product_name || prod?.name || 'Inconnu';
      const date    = new Date(v.date || v.created_at);
      const dateStr = isNaN(date) ? '—' : date.toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });

      const tr = document.createElement('tr');
      tr.dataset.saleId = v.id;
      tr.innerHTML = `
        <td class="p-2 border text-xs">${dateStr}</td>
        <td class="p-2 border">${nom}</td>
        <td class="p-2 border text-center">${v.quantity ?? 0}</td>
        <td class="p-2 border text-right">${montant.toLocaleString('fr-FR')} F</td>
        <td class="p-2 border text-center">${v.payment_method || ''}</td>
        <td class="p-2 border text-center">
          <button class="bg-yellow-500 text-white px-2 py-1 rounded text-xs mr-1"
                  onclick="window.haptic?.tap();modifierVente(${v.id})">✏️</button>
          <button class="bg-red-500 text-white px-2 py-1 rounded text-xs"
                  onclick="window.haptic?.delete();annulerVente(${v.id})">🗑️</button>
        </td>`;
      tbody.appendChild(tr);
    }
  }

  // ── Sentinel d'observation ──
  function injectSentinel() {
    document.getElementById('sc-scroll-sentinel')?.remove();
    if (_observer) { _observer.disconnect(); _observer = null; }
    if (!_hasMore) return;

    const tbody = document.getElementById('salesHistoryBody');
    if (!tbody) return;

    const row = document.createElement('tr');
    row.id = 'sc-scroll-sentinel';
    row.innerHTML = `
      <td colspan="6" style="text-align:center;padding:14px 0;color:#9CA3AF;
                              font-size:12px;font-family:'Sora',sans-serif;">
        <span id="sc-sentinel-label">↓ Voir plus de ventes</span>
      </td>`;
    tbody.appendChild(row);

    _observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !_loading) loadMore();
    }, { rootMargin: '80px' });
    _observer.observe(row);
  }

  // ── Charger la tranche suivante ──
  async function loadMore() {
    if (_loading || !_hasMore) return;
    _loading = true;

    const label = document.getElementById('sc-sentinel-label');
    if (label) label.textContent = '⌛ Chargement…';

    const start = (_page - 1) * PAGE_SIZE;
    const slice = _allVentes.slice(start, start + PAGE_SIZE);

    if (slice.length > 0) {
      renderSlice(slice, false);
      _page++;
      // S'il reste des ventes locales, continuer
      const nextSliceExists = _allVentes.slice(_page * PAGE_SIZE - PAGE_SIZE, _page * PAGE_SIZE).length > 0;
      _hasMore = nextSliceExists || !!_serverCursor;
    } else if (_serverCursor) {
      // Plus de ventes locales → fetch serveur
      await fetchServer();
    } else {
      _hasMore = false;
    }

    _loading = false;

    // Mettre à jour le sentinel
    if (_hasMore) {
      injectSentinel();
    } else {
      document.getElementById('sc-scroll-sentinel')?.remove();
    }
  }

  // ── Fetch serveur avec cursor ──
  async function fetchServer() {
    if (!window.authfetch || !_serverCursor) return;
    const API = document.querySelector('meta[name="api-base"]')?.content
              || 'https://samacommerce-backend-v2.onrender.com';

    try {
      const res = await window.authfetch(`${API}/sales?limit=50&cursor=${_serverCursor}`);
      if (!res?.ok) { _serverCursor = null; return; }

      const newVentes = await res.json();
      if (!newVentes.length) { _serverCursor = null; _hasMore = false; return; }

      // Enrichir avec le nom produit depuis appData
      const produits = window.appData?.produits || [];
      for (const v of newVentes) {
        if (!v.product_name) {
          const p = produits.find(p => Number(p.id) === Number(v.product_id));
          if (p) v.product_name = p.name;
        }
      }

      _allVentes.push(...newVentes);
      // Cursor = id de la dernière vente reçue si on a eu 50 (sinon plus rien)
      _serverCursor = newVentes.length >= 50 ? newVentes[newVentes.length - 1].id : null;

      renderSlice(newVentes, false);
      _hasMore = !!_serverCursor;

    } catch (err) {
      console.warn('[infinite-scroll] fetchServer error:', err.message);
      _serverCursor = null;
    }
  }

  // ══════════════════════════════════════
  // PATCH window.renderSalesHistory
  // ══════════════════════════════════════
  function patch() {
    const orig = window.renderSalesHistory;
    if (!orig || orig._sc_patched) return;

    window.renderSalesHistory = function (ventes) {
      if (!Array.isArray(ventes)) { orig(ventes); return; }

      // Reset complet
      _allVentes    = ventes.filter(v => !v._optimistic);
      _page         = 1;
      _loading      = false;
      _hasMore      = false;
      _serverCursor = null;

      if (!_allVentes.length) {
        const tbody = document.getElementById('salesHistoryBody');
        if (tbody) tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center text-gray-500 p-4">Aucune vente</td>
          </tr>`;
        return;
      }

      // Première page
      const firstPage = _allVentes.slice(0, PAGE_SIZE);
      renderSlice(firstPage, true);
      _page = 2;

      // Cursor serveur : si on a 200 ventes (le max du syncFromServer),
      // il y en a peut-être plus sur le serveur
      if (_allVentes.length >= 200) {
        _serverCursor = _allVentes[_allVentes.length - 1]?.id || null;
      }

      _hasMore = _allVentes.length > PAGE_SIZE || !!_serverCursor;

      if (_hasMore) injectSentinel();
    };

    window.renderSalesHistory._sc_patched = true;

    // Patch tryRenderSalesHistory aussi
    const origTry = window.tryRenderSalesHistory;
    if (origTry && !origTry._sc_patched) {
      window.tryRenderSalesHistory = function (ventesFiltrees) {
        if (!window.appData?.ventes?.length || !window.appData?.produits?.length) {
          const tbody = document.getElementById('salesHistoryBody');
          if (tbody) tbody.innerHTML = `
            <tr>
              <td colspan="6" class="text-center text-gray-500 p-4">Chargement…</td>
            </tr>`;
          return;
        }
        window.renderSalesHistory(ventesFiltrees);
      };
      window.tryRenderSalesHistory._sc_patched = true;
    }
  }

  // ── Init — attendre que les fonctions soient disponibles ──
  function init() {
    if (window.renderSalesHistory && !window.renderSalesHistory._sc_patched) {
      patch();
    } else if (!window.renderSalesHistory) {
      setTimeout(init, 300);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Le module app.js est chargé async — attendre un tick
    setTimeout(init, 0);
  }

  // Re-patch si boutique change (renderSalesHistory pourrait être recréé)
  window.addEventListener('boutique:changed', () => {
    window.renderSalesHistory && (window.renderSalesHistory._sc_patched = false);
    window.tryRenderSalesHistory && (window.tryRenderSalesHistory._sc_patched = false);
    setTimeout(patch, 100);
  });

})();
