/**
 * fix-searches.js — Correction définitive de TOUTES les recherches
 *
 * CAUSES RACINES identifiées :
 *
 *   A. appData.clients n'est JAMAIS peuplé par syncFromServer()
 *      → client-vente.js et global-search.js ne trouvent aucun client
 *
 *   B. showSection('vente') ne dispatch PAS pageChange
 *      → client-vente.js n'injecte jamais son widget sur mobile
 *
 *   C. inventaire.js cible '#listeCategories > div' (le wrapper grid)
 *      au lieu de '.cat-card' (les cartes individuelles)
 *
 *   D. global-search.js ne cherche que produits/clients/ventes/crédits
 *      → pas de fournisseurs ni de livreurs
 *
 * Ce script corrige les 4 causes en une seule fois.
 *
 * INTÉGRATION : <script src="js/fix-searches.js"></script>
 *   (charger APRÈS client-vente.js et global-search.js)
 */

(function () {

  var API = function () {
    return document.querySelector('meta[name="api-base"]')?.content ||
           'https://samacommerce-backend-v2.onrender.com';
  };

  // ══════════════════════════════════════════════════════════
  //  A. CHARGER LES CLIENTS DANS appData.clients
  //     syncFromServer ne les charge pas → on le fait nous-mêmes
  // ══════════════════════════════════════════════════════════
  async function loadClientsIntoAppData() {
    try {
      var res = await window.authfetch?.(API() + '/clients');
      if (!res || !res.ok) return;
      var data = await res.json();
      if (!Array.isArray(data)) return;

      // Stocker dans appData pour que TOUT le monde y ait accès
      if (window.appData) {
        window.appData.clients = data;
      }
      // Aussi exposer un cache global pour global-search.js
      window._clientsCache = data;
    } catch (e) {
      // Silencieux — pas de clients, pas grave
    }
  }

  // Charger au démarrage + après chaque sync
  function setupClientLoading() {
    // 1. Charger immédiatement
    loadClientsIntoAppData();

    // 2. Recharger après chaque syncFromServer (observer le header stats)
    var target = document.getElementById('chiffreAffaires');
    if (target) {
      new MutationObserver(function () {
        loadClientsIntoAppData();
      }).observe(target, { childList: true, characterData: true, subtree: true });
    }

    // 3. Recharger quand on change de boutique
    var origSwitch = window._switchBoutique;
    if (origSwitch && !origSwitch._srchPatched) {
      window._switchBoutique = async function () {
        await origSwitch.apply(this, arguments);
        await loadClientsIntoAppData();
      };
      window._switchBoutique._srchPatched = true;
    }
  }

  // ══════════════════════════════════════════════════════════
  //  B. DISPATCHER pageChange POUR 'vente'
  //     Permet à client-vente.js d'injecter son widget
  // ══════════════════════════════════════════════════════════
  function patchShowSectionForVente() {
    var origShow = window.showSection;
    if (!origShow || origShow._srchVente) return;

    window.showSection = function (section) {
      // Appeler l'original d'abord
      origShow.apply(this, arguments);

      // Si c'est la section vente, dispatcher pageChange + forcer l'injection
      if (section === 'vente') {
        // Dispatcher pageChange (client-vente.js écoute cet event)
        try {
          window.dispatchEvent(new CustomEvent('pageChange', {
            detail: { key: 'vente' }
          }));
        } catch (e) {}

        // Forcer l'injection du widget client après un court délai
        setTimeout(function () {
          // Si le widget n'est pas encore injecté, le créer manuellement
          if (!document.getElementById('cv-client-wrap')) {
            // client-vente.js expose injectClientWidget indirectement via pageChange
            // Le dispatch ci-dessus devrait suffire, mais en fallback :
            if (typeof window.clientVente !== 'undefined') {
              // Le module est chargé mais le widget pas injecté
              // Réessayer le dispatch
              window.dispatchEvent(new CustomEvent('pageChange', {
                detail: { key: 'vente' }
              }));
            }
          }
        }, 300);
      }
    };
    window.showSection._srchVente = true;
    // Conserver les flags des autres wrappers
    Object.keys(origShow).forEach(function (k) {
      if (k !== '_srchVente') window.showSection[k] = origShow[k];
    });
  }

  // ══════════════════════════════════════════════════════════
  //  C. CORRIGER LA RECHERCHE CATÉGORIES
  //     Le handler de inventaire.js cible '#listeCategories > div'
  //     (= la grille wrapper) au lieu de chaque '.cat-card'
  // ══════════════════════════════════════════════════════════
  function fixCategorySearch() {
    var input = document.getElementById('searchCategorie');
    if (!input) return;

    // Supprimer l'ancien handler en le remplaçant par un clone
    var newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('input', function () {
      var q = this.value.toLowerCase().trim();
      // Cibler les cartes individuelles, PAS le wrapper
      var cards = document.querySelectorAll('#listeCategories .cat-card');

      cards.forEach(function (card) {
        var name = card.querySelector('.cat-name');
        var text = name ? name.textContent.toLowerCase() : '';
        card.style.display = (!q || text.includes(q)) ? '' : 'none';
      });
    });
  }

  // Re-fixer après chaque re-rendu des catégories
  function watchCategoryRerender() {
    var container = document.getElementById('listeCategories');
    if (!container) return;

    new MutationObserver(function () {
      // Le input peut avoir été re-cloné, re-fixer
      fixCategorySearch();
    }).observe(container, { childList: true });
  }

  // ══════════════════════════════════════════════════════════
  //  D. ÉTENDRE LA RECHERCHE GLOBALE
  //     Ajouter fournisseurs et livreurs aux résultats
  // ══════════════════════════════════════════════════════════
  var _fournisseursCache = null;
  var _livreursCache = null;
  var _cacheTTL = 30000; // 30 secondes
  var _fournisseursTs = 0;
  var _livreursTs = 0;

  function patchGlobalSearch() {
    // Observer l'input de recherche globale
    // global-search.js crée le DOM dynamiquement, on doit attendre
    function tryHook() {
      var input = document.querySelector('#global-search-input, .gs-input, [placeholder*="Rechercher dans"]');
      if (!input) { setTimeout(tryHook, 1000); return; }
      if (input._srchExtended) return;
      input._srchExtended = true;

      // Intercepter APRÈS que global-search.js ait rendu ses résultats
      input.addEventListener('input', function () {
        var q = (input.value || '').trim();
        if (q.length < 2) return;

        // Attendre que global-search.js ait fini son rendu (il est synchrone)
        clearTimeout(input._srchTimer);
        input._srchTimer = setTimeout(function () {
          addExtendedResults(q.toLowerCase());
        }, 350); // Après le rendu de global-search.js
      });
    }
    tryHook();
  }

  function addExtendedResults(query) {
    var container = document.querySelector('.gs-results, #global-search-results, [class*="gs-results"]');
    if (!container) return;

    // Supprimer les anciens résultats étendus
    container.querySelectorAll('.srch-ext').forEach(function (el) { el.remove(); });

    var token = localStorage.getItem('authToken');
    if (!token) return;

    // Fournisseurs
    fetchCached('fournisseurs', function (items) {
      var matches = items.filter(function (f) {
        return (f.name || '').toLowerCase().includes(query) ||
               (f.phone || '').includes(query);
      }).slice(0, 3);
      if (matches.length) {
        injectSearchGroup(container, '🏭 Fournisseurs', matches, 'fournisseurs');
      }
    });

    // Livreurs
    fetchCached('deliverymen', function (items) {
      var matches = items.filter(function (d) {
        return (d.name || '').toLowerCase().includes(query) ||
               (d.phone || '').includes(query) ||
               (d.zone || '').toLowerCase().includes(query);
      }).slice(0, 3);
      if (matches.length) {
        injectSearchGroup(container, '🛵 Livreurs', matches, 'deliverymen');
      }
    });
  }

  function fetchCached(entity, callback) {
    var cache = entity === 'fournisseurs' ? _fournisseursCache : _livreursCache;
    var ts = entity === 'fournisseurs' ? _fournisseursTs : _livreursTs;

    if (cache && Date.now() - ts < _cacheTTL) {
      callback(cache);
      return;
    }

    var token = localStorage.getItem('authToken');
    fetch(API() + '/' + entity, {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function (res) { return res.ok ? res.json() : []; })
    .then(function (data) {
      var arr = Array.isArray(data) ? data : [];
      if (entity === 'fournisseurs') { _fournisseursCache = arr; _fournisseursTs = Date.now(); }
      else { _livreursCache = arr; _livreursTs = Date.now(); }
      callback(arr);
    })
    .catch(function () { callback([]); });
  }

  function injectSearchGroup(container, title, items, section) {
    var group = document.createElement('div');
    group.className = 'srch-ext';

    // Label du groupe
    var label = document.createElement('div');
    label.className = 'gs-section-label';
    label.textContent = title;
    group.appendChild(label);

    items.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'gs-item';

      var initial = (item.name || '?').charAt(0).toUpperCase();
      var colors = {
        fournisseurs: { bg: '#ECFDF5', icon: '🏭' },
        deliverymen:  { bg: '#FEF9C3', icon: '🛵' },
      };
      var style = colors[section] || { bg: '#EDE9FE', icon: '📋' };

      row.innerHTML =
        '<div class="gs-item-icon" style="background:' + style.bg + ';">' + style.icon + '</div>' +
        '<div class="gs-item-body">' +
          '<div class="gs-item-name">' + esc(item.name || '') + '</div>' +
          '<div class="gs-item-sub">' + esc(item.phone || item.zone || '') + '</div>' +
        '</div>';

      row.style.cursor = 'pointer';
      row.addEventListener('click', function () {
        // Fermer la recherche globale
        var overlay = document.querySelector('.gs-overlay, #gs-overlay');
        if (overlay) { overlay.style.display = 'none'; document.body.style.overflow = ''; }
        window.showSection?.(section);
      });

      group.appendChild(row);
    });

    container.appendChild(group);
  }

  // ══════════════════════════════════════════════════════════
  //  E. RECHERCHE CLIENTS DANS LA SECTION CLIENTS
  //     S'assurer que le handler est bien attaché
  // ══════════════════════════════════════════════════════════
  function fixClientsSearch() {
    var input = document.getElementById('clientsSearch');
    if (!input || input._srchFixed) return;
    input._srchFixed = true;

    input.addEventListener('input', function () {
      var q = input.value.toLowerCase().trim();
      var list = document.getElementById('clientsList');
      if (!list) return;

      list.querySelectorAll('.entity-card, [class*="card"]').forEach(function (card) {
        var text = (card.textContent || '').toLowerCase();
        card.style.display = (!q || text.includes(q)) ? '' : 'none';
      });
    });
  }

  // Observer l'apparition de la section clients
  function watchClientsSection() {
    window.addEventListener('pageChange', function (e) {
      if (e.detail?.key === 'clients') {
        setTimeout(fixClientsSearch, 300);
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  //  UTILS
  // ══════════════════════════════════════════════════════════
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // ══════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════
  function init() {
    if (!window.appData) { setTimeout(init, 300); return; }

    // A. Charger les clients
    setupClientLoading();

    // B. Dispatcher pageChange pour vente
    patchShowSectionForVente();

    // C. Fixer la recherche catégories
    fixCategorySearch();
    watchCategoryRerender();

    // D. Étendre la recherche globale
    patchGlobalSearch();

    // E. Fixer la recherche clients
    fixClientsSearch();
    watchClientsSection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 800); });
  } else {
    setTimeout(init, 800);
  }

})();
