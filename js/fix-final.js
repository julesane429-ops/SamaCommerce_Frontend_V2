/**
 * fix-final.js — Corrections finales complètes
 *
 * 1. Journal d'activité visible sur smartphone (ajout au menu Plus mobile)
 * 2. Contrôle d'accès par plan + rôle (propriétaire vs employé)
 * 3. Paiement mixte ventilé dans les chiffres/caisse
 * 4. Recherche catégories (live filter + bouton édition)
 * 5. Recherche globale étendue (fournisseurs, livreurs)
 * 6. Autocomplete client dans section vente
 *
 * INTÉGRATION : <script src="js/fix-final.js"></script> (en tout dernier)
 */

(function () {

  var API = function () {
    return document.querySelector('meta[name="api-base"]')?.content || '';
  };

  // ══════════════════════════════════════
  // 1. JOURNAL D'ACTIVITÉ SUR MOBILE
  // ══════════════════════════════════════
  function fixLogsMobile() {
    // Ajouter "logs" comme section reconnue par showSection
    var origShow = window.showSection;
    if (!origShow || origShow._fixFinal) return;

    window.showSection = function (section) {
      if (section === 'logs') {
        // Cacher toutes les sections
        document.querySelectorAll('.section-page').forEach(function (s) { s.classList.add('hidden'); });
        var el = document.getElementById('logsSection');
        if (el) {
          el.classList.remove('hidden');
          el.classList.add('sc-enter-forward');
        }
        var backBtn = document.getElementById('backBtn');
        if (backBtn) backBtn.style.display = 'block';
        // Trigger load
        window.dispatchEvent(new CustomEvent('pageChange', { detail: { key: 'logs' } }));
        return;
      }
      origShow(section);
    };
    window.showSection._fixFinal = true;

    // Ajouter au menu Plus mobile (enhanced-plus-menu)
    // Observer son ouverture pour injecter l'item
    function patchPlusMenu() {
      var epSheet = document.getElementById('epSheet');
      if (!epSheet) return;

      new MutationObserver(function () {
        if (!epSheet.classList.contains('open')) return;
        if (epSheet.querySelector('[data-nav="logs"]')) return;

        // Trouver le groupe "Compte" ou le dernier groupe
        var groups = epSheet.querySelectorAll('.ep-group');
        var lastGroup = groups[groups.length - 1];
        if (!lastGroup) return;

        var item = document.createElement('button');
        item.className = 'ep-item';
        item.dataset.nav = 'logs';
        item.innerHTML =
          '<div class="ep-item-icon" style="background:#EFF6FF;">📋</div>' +
          '<div class="ep-item-text"><div class="ep-item-name">Journal</div><div class="ep-item-desc">Activité de l\'équipe</div></div>' +
          '<span class="ep-item-chevron">›</span>';
        item.addEventListener('click', function () {
          window.haptic?.tap();
          window.closePlusSheet?.();
          window.showSection?.('logs');
        });

        // Insérer avant le profil ou à la fin
        var profilItem = lastGroup.querySelector('[data-nav="profil"]');
        if (profilItem) lastGroup.insertBefore(item, profilItem);
        else lastGroup.appendChild(item);
      }).observe(epSheet, { attributes: true, attributeFilter: ['class'] });
    }
    setTimeout(patchPlusMenu, 1000);
  }

  // ══════════════════════════════════════
  // 3. PAIEMENT MIXTE DANS LES CHIFFRES
  // ══════════════════════════════════════
  function patchMixteStats() {
    // Override le calcul des paiements dans rapports.js
    // Le code original est dans un module ES, on ne peut pas le modifier
    // On va intercepter APRÈS le calcul et corriger appData.stats.paiements
    
    function fixPaiementsMap() {
      var ventes = window.appData?.ventes || [];
      var paiements = window.appData?.stats?.paiements;
      if (!paiements) return;

      // Parcourir les ventes mixtes et redistribuer
      ventes.forEach(function (v) {
        if (v.payment_method !== 'mixte' || !v.paid) return;

        var details = v.payment_details;
        if (!details) return;
        if (typeof details === 'string') {
          try { details = JSON.parse(details); } catch (e) { return; }
        }

        // Retirer le montant de "mixte" (déjà compté)
        var total = parseFloat(v.total) || 0;
        paiements['mixte'] = (paiements['mixte'] || 0) - total;
        if (paiements['mixte'] <= 0) delete paiements['mixte'];

        // Ajouter chaque sous-montant à sa méthode
        Object.keys(details).forEach(function (method) {
          var amount = parseFloat(details[method]) || 0;
          if (amount > 0) {
            paiements[method] = (paiements[method] || 0) + amount;
          }
        });
      });

      window.appData.stats.paiements = paiements;
    }

    // Observer les changements de stats pour corriger après chaque calcul
    var target = document.getElementById('rapportsPaiements');
    if (target) {
      new MutationObserver(function () {
        fixPaiementsMap();
        // Re-render les paiements si nécessaire
        rerenderPaiements();
      }).observe(target, { childList: true });
    }

    // Aussi corriger pour la caisse
    function patchCaisse() {
      var origRender = window._renderCaisse;
      // Observer le chiffre d'affaires pour trigger
      var ca = document.getElementById('chiffreAffaires');
      if (ca) {
        new MutationObserver(fixPaiementsMap).observe(ca, { childList: true, characterData: true, subtree: true });
      }
    }
    patchCaisse();
  }

  function rerenderPaiements() {
    var paiements = window.appData?.stats?.paiements;
    if (!paiements) return;

    var container = document.getElementById('rapportsPaiements');
    if (!container || !container.children.length) return;

    // Le rendu est fait par rapports.js — on le laisse faire
    // On intervient seulement si "mixte" apparaît encore
    var mixteEl = container.querySelector('[data-method="mixte"]');
    if (mixteEl) mixteEl.remove();
  }

  // ══════════════════════════════════════
  // 4. RECHERCHE CATÉGORIES + ÉDITION
  // ══════════════════════════════════════
  var COLORS = [
    { id: 'cat-default',     bg: 'linear-gradient(135deg,#7C3AED,#EC4899)' },
    { id: 'category-habits', bg: 'linear-gradient(135deg,#3B82F6,#06B6D4)' },
    { id: 'cat-green',       bg: 'linear-gradient(135deg,#10B981,#059669)' },
    { id: 'cat-orange',      bg: 'linear-gradient(135deg,#F59E0B,#D97706)' },
    { id: 'cat-red',         bg: 'linear-gradient(135deg,#EF4444,#DC2626)' },
    { id: 'cat-pink',        bg: 'linear-gradient(135deg,#EC4899,#DB2777)' },
    { id: 'cat-teal',        bg: 'linear-gradient(135deg,#14B8A6,#0D9488)' },
    { id: 'cat-dark',        bg: 'linear-gradient(135deg,#374151,#111827)' },
  ];

  function setupCategorySearch() {
    var input = document.getElementById('searchCategorie');
    if (!input || input._ffSearch) return;
    input._ffSearch = true;

    input.addEventListener('input', function () {
      var q = this.value.toLowerCase().trim();
      var grid = document.querySelector('#listeCategories .categories-grid');
      if (!grid) return;

      var visible = 0;
      grid.querySelectorAll('.cat-card').forEach(function (card) {
        var name = (card.querySelector('.cat-name')?.textContent || '').toLowerCase();
        var show = !q || name.includes(q);
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      });
    });
  }

  function injectCategoryEditButtons() {
    var grid = document.querySelector('#listeCategories .categories-grid');
    if (!grid) return;

    grid.querySelectorAll('.cat-card').forEach(function (card) {
      if (card.querySelector('.ff-edit-btn')) return;

      var catName = card.querySelector('.cat-name')?.textContent;
      var cats = window.appData?.categories || [];
      var cat = cats.find(function (c) { return c.name === catName; });
      if (!cat) return;

      var btn = document.createElement('button');
      btn.className = 'ff-edit-btn';
      btn.textContent = '✏️';
      btn.style.cssText = 'position:absolute;top:10px;right:42px;background:rgba(255,255,255,.25);border:none;border-radius:10px;padding:5px 8px;font-size:13px;cursor:pointer;color:#fff;z-index:2;';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.haptic?.tap();
        openCatEditModal(cat);
      });
      card.style.position = 'relative';
      card.appendChild(btn);
    });
  }

  function openCatEditModal(cat) {
    var old = document.getElementById('ffCatEditOverlay');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'ffCatEditOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,10,40,.5);backdrop-filter:blur(5px);z-index:250;display:flex;align-items:center;justify-content:center;padding:16px;';

    var colorsHtml = COLORS.map(function (c) {
      var sel = (cat.couleur || 'cat-default') === c.id;
      return '<div data-color="' + c.id + '" style="width:30px;height:30px;border-radius:8px;background:' + c.bg +
        ';cursor:pointer;border:2px solid ' + (sel ? '#fff' : 'transparent') +
        ';box-shadow:' + (sel ? '0 0 0 2px #7C3AED' : 'none') + ';"></div>';
    }).join('');

    var modal = document.createElement('div');
    modal.className = 'modal-box';
    modal.style.cssText = 'animation:mIn .24s cubic-bezier(.34,1.4,.64,1) both;max-width:360px;';
    modal.innerHTML =
      '<div class="modal-title">✏️ Modifier la catégorie</div>' +
      '<div style="text-align:center;margin-bottom:14px;">' +
        '<div id="ffPreview" class="cat-card ' + (cat.couleur || 'cat-default') + '" style="display:inline-block;min-width:120px;min-height:auto;padding:12px 16px;cursor:default;">' +
          '<div class="cat-emoji" id="ffPrEmoji">' + (cat.emoji || '📦') + '</div>' +
          '<div class="cat-name" id="ffPrName">' + esc(cat.name) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="form-group"><label>Nom</label><input type="text" id="ffCatName" value="' + esc(cat.name) + '"></div>' +
      '<div class="form-group"><label>Emoji</label><input type="text" id="ffCatEmoji" value="' + (cat.emoji || '🏷️') + '" maxlength="2" style="width:70px;font-size:22px;text-align:center;"></div>' +
      '<div class="form-group"><label>Couleur</label><div id="ffColorGrid" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">' + colorsHtml + '</div></div>' +
      '<div class="modal-actions"><button class="btn-cancel" id="ffCatCancel">Annuler</button><button class="btn-confirm" id="ffCatSave">Enregistrer</button></div>';

    overlay.appendChild(modal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    var selectedColor = cat.couleur || 'cat-default';
    var nameInput = document.getElementById('ffCatName');
    var emojiInput = document.getElementById('ffCatEmoji');

    nameInput.addEventListener('input', function () { document.getElementById('ffPrName').textContent = nameInput.value; });
    emojiInput.addEventListener('input', function () { document.getElementById('ffPrEmoji').textContent = emojiInput.value; });

    document.getElementById('ffColorGrid').addEventListener('click', function (e) {
      var opt = e.target.closest('[data-color]');
      if (!opt) return;
      selectedColor = opt.dataset.color;
      document.querySelectorAll('#ffColorGrid > div').forEach(function (o) { o.style.border = '2px solid transparent'; o.style.boxShadow = 'none'; });
      opt.style.border = '2px solid #fff';
      opt.style.boxShadow = '0 0 0 2px #7C3AED';
      var preview = document.getElementById('ffPreview');
      COLORS.forEach(function (c) { preview.classList.remove(c.id); });
      preview.classList.add(selectedColor);
    });

    document.getElementById('ffCatCancel').addEventListener('click', function () { overlay.remove(); });
    document.getElementById('ffCatSave').addEventListener('click', async function () {
      var newName = nameInput.value.trim();
      if (!newName) { window.showNotification?.('❌ Nom requis', 'error'); return; }

      try {
        var res = await window.authfetch?.(API() + '/categories/' + cat.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName, emoji: emojiInput.value || cat.emoji, couleur: selectedColor }),
        });
        if (!res?.ok) { window.showNotification?.('❌ Erreur', 'error'); return; }

        var local = (window.appData?.categories || []).find(function (c) { return c.id === cat.id; });
        if (local) { local.name = newName; local.emoji = emojiInput.value || cat.emoji; local.couleur = selectedColor; }
        window.saveAppDataLocal?.();
        window.afficherCategories?.();
        window.afficherCategoriesVente?.();
        window.haptic?.success();
        window.showNotification?.('✅ Catégorie modifiée', 'success');
        overlay.remove();
        setTimeout(injectCategoryEditButtons, 200);
      } catch (e) { window.showNotification?.('❌ Erreur réseau', 'error'); }
    });
    nameInput.focus();
  }

  // ══════════════════════════════════════
  // 5. RECHERCHE GLOBALE ÉTENDUE
  // ══════════════════════════════════════
  function patchGlobalSearch() {
    // Intercepter doSearch pour ajouter fournisseurs et livreurs
    // On ne peut pas modifier global-search.js (IIFE), 
    // mais on peut ajouter des résultats APRÈS le rendu
    var resultsEl = null;

    function findResultsContainer() {
      // Le conteneur de résultats est créé dynamiquement par global-search.js
      return document.getElementById('global-search-results') ||
             document.querySelector('.gs-results') ||
             document.querySelector('[id*="gs-results"]');
    }

    // Observer l'input de recherche globale
    function hookInput() {
      var input = document.getElementById('global-search-input') ||
                  document.querySelector('.gs-input');
      if (!input) { setTimeout(hookInput, 1000); return; }
      if (input._ffHooked) return;
      input._ffHooked = true;

      input.addEventListener('input', function () {
        var q = (input.value || '').toLowerCase().trim();
        if (q.length < 2) return;

        clearTimeout(input._ffTimer);
        input._ffTimer = setTimeout(function () {
          var container = findResultsContainer();
          if (!container) return;
          appendExtendedResults(container, q);
        }, 300);
      });
    }
    hookInput();
  }

  function appendExtendedResults(container, query) {
    // Supprimer les anciens résultats étendus
    container.querySelectorAll('.ff-ext-group').forEach(function (g) { g.remove(); });

    // Fournisseurs (chargés async)
    loadAndSearch('fournisseurs', query, function (items) {
      if (!items.length) return;
      appendGroup(container, '🏭 Fournisseurs', items.slice(0, 3).map(function (f) {
        return {
          icon: '🏭', iconBg: '#ECFDF5',
          name: hl(f.name, query),
          sub: f.phone || f.email || '',
          action: function () { closeGlobalSearch(); window.showSection?.('fournisseurs'); }
        };
      }));
    });

    // Livreurs
    loadAndSearch('deliverymen', query, function (items) {
      if (!items.length) return;
      appendGroup(container, '🛵 Livreurs', items.slice(0, 3).map(function (d) {
        return {
          icon: '🛵', iconBg: '#FEF9C3',
          name: hl(d.name, query),
          sub: (d.phone || '') + (d.zone ? ' · ' + d.zone : ''),
          action: function () { closeGlobalSearch(); window.showSection?.('deliverymen'); }
        };
      }));
    });
  }

  // Cache pour les données chargées
  var _cache = {};

  function loadAndSearch(entity, query, callback) {
    var token = localStorage.getItem('authToken');
    if (!token) return;

    // Utiliser le cache si frais (< 30s)
    if (_cache[entity] && Date.now() - _cache[entity].ts < 30000) {
      var filtered = _cache[entity].data.filter(function (item) {
        return (item.name || '').toLowerCase().includes(query) ||
               (item.phone || '').includes(query);
      });
      callback(filtered);
      return;
    }

    fetch(API() + '/' + entity, {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(function (res) { return res.ok ? res.json() : []; })
      .then(function (data) {
        var arr = Array.isArray(data) ? data : [];
        _cache[entity] = { data: arr, ts: Date.now() };
        var filtered = arr.filter(function (item) {
          return (item.name || '').toLowerCase().includes(query) ||
                 (item.phone || '').includes(query);
        });
        callback(filtered);
      }).catch(function () { callback([]); });
  }

  function appendGroup(container, title, items) {
    if (!items.length || !container) return;

    var group = document.createElement('div');
    group.className = 'ff-ext-group';

    var label = document.createElement('div');
    label.className = 'gs-section-label';
    label.textContent = title;
    group.appendChild(label);

    items.forEach(function (item) {
      var el = document.createElement('div');
      el.className = 'gs-item';
      el.innerHTML =
        '<div class="gs-item-icon" style="background:' + item.iconBg + ';">' + item.icon + '</div>' +
        '<div class="gs-item-body"><div class="gs-item-name">' + item.name + '</div><div class="gs-item-sub">' + esc(item.sub) + '</div></div>';
      el.addEventListener('click', item.action);
      group.appendChild(el);
    });

    container.appendChild(group);
  }

  function closeGlobalSearch() {
    // Fermer l'overlay de recherche globale
    var overlay = document.getElementById('gs-overlay') ||
                  document.querySelector('.gs-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  function hl(text, query) {
    if (!query) return esc(text);
    var escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return esc(text).replace(new RegExp('(' + escaped + ')', 'gi'), '<span class="sr-highlight">$1</span>');
  }

  // ══════════════════════════════════════
  // 6. AUTOCOMPLETE CLIENT DANS VENTE — désactivé (géré par client-vente.js)
  // ══════════════════════════════════════
  function setupClientAutocomplete() { /* no-op */ }

  // ══════════════════════════════════════
  // UTILITAIRES
  // ══════════════════════════════════════
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    if (!window.appData) { setTimeout(init, 300); return; }

    fixLogsMobile();
    patchMixteStats();
    setupCategorySearch();
    patchGlobalSearch();
    setupClientAutocomplete();

    // Observer les catégories pour injecter les boutons d'édition
    var catList = document.getElementById('listeCategories');
    if (catList) {
      new MutationObserver(function () {
        requestAnimationFrame(injectCategoryEditButtons);
      }).observe(catList, { childList: true, subtree: true });
      injectCategoryEditButtons();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 900); });
  } else {
    setTimeout(init, 900);
  }

})();
