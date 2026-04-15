/**
 * fix-categories.js — Catégories améliorées
 *
 * 1. Recherche live qui filtre les cartes en temps réel
 * 2. Bouton ✏️ sur chaque carte pour modifier nom, emoji, couleur
 * 3. Modal d'édition avec preview en direct
 * 4. Synchronisation avec le backend PATCH /categories/:id
 *
 * INTÉGRATION : <script src="js/fix-categories.js"></script>
 */

(function () {

  var API = function () {
    return document.querySelector('meta[name="api-base"]')?.content || '';
  };

  var COLORS = [
    { id: 'cat-default',    label: 'Violet',  bg: 'linear-gradient(135deg,#7C3AED,#EC4899)' },
    { id: 'category-habits',label: 'Bleu',    bg: 'linear-gradient(135deg,#3B82F6,#06B6D4)' },
    { id: 'cat-green',      label: 'Vert',    bg: 'linear-gradient(135deg,#10B981,#059669)' },
    { id: 'cat-orange',     label: 'Orange',  bg: 'linear-gradient(135deg,#F59E0B,#D97706)' },
    { id: 'cat-red',        label: 'Rouge',   bg: 'linear-gradient(135deg,#EF4444,#DC2626)' },
    { id: 'cat-pink',       label: 'Rose',    bg: 'linear-gradient(135deg,#EC4899,#DB2777)' },
    { id: 'cat-teal',       label: 'Cyan',    bg: 'linear-gradient(135deg,#14B8A6,#0D9488)' },
    { id: 'cat-dark',       label: 'Sombre',  bg: 'linear-gradient(135deg,#374151,#111827)' },
  ];

  // ══════════════════════════════════════
  // 1. RECHERCHE LIVE
  // ══════════════════════════════════════
  function setupSearch() {
    var input = document.getElementById('searchCategorie');
    if (!input || input._fcSetup) return;
    input._fcSetup = true;

    input.addEventListener('input', function () {
      var q = this.value.toLowerCase().trim();
      var grid = document.querySelector('#listeCategories .categories-grid');
      if (!grid) return;

      grid.querySelectorAll('.cat-card').forEach(function (card) {
        var name = (card.querySelector('.cat-name')?.textContent || '').toLowerCase();
        card.style.display = (!q || name.includes(q)) ? '' : 'none';
      });

      // Compteur de résultats
      var visible = grid.querySelectorAll('.cat-card:not([style*="display: none"])').length;
      var total = grid.querySelectorAll('.cat-card').length;
      var counter = document.getElementById('fcSearchCounter');
      if (!counter) {
        counter = document.createElement('div');
        counter.id = 'fcSearchCounter';
        counter.style.cssText = 'font-size:11px;color:var(--muted);text-align:center;padding:4px 0;';
        input.insertAdjacentElement('afterend', counter);
      }
      counter.textContent = q ? visible + ' / ' + total + ' catégorie' + (total > 1 ? 's' : '') : '';
    });
  }

  // ══════════════════════════════════════
  // 2. BOUTON ÉDITER SUR CHAQUE CARTE
  // ══════════════════════════════════════
  function injectEditButtons() {
    var grid = document.querySelector('#listeCategories .categories-grid');
    if (!grid) return;

    grid.querySelectorAll('.cat-card').forEach(function (card) {
      if (card.querySelector('.fc-edit-btn')) return;

      // Trouver l'ID de la catégorie
      var catName = card.querySelector('.cat-name')?.textContent;
      var cats = window.appData?.categories || [];
      var cat = cats.find(function (c) { return c.name === catName; });
      if (!cat) return;

      var btn = document.createElement('button');
      btn.className = 'fc-edit-btn';
      btn.innerHTML = '✏️';
      btn.title = 'Modifier';
      btn.style.cssText = 'position:absolute;top:10px;right:42px;background:rgba(255,255,255,.2);border:none;border-radius:10px;padding:4px 8px;font-size:14px;cursor:pointer;color:#fff;transition:background .15s;';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.haptic?.tap();
        openEditModal(cat);
      });
      btn.addEventListener('mousedown', function () { btn.style.background = 'rgba(255,255,255,.4)'; });
      btn.addEventListener('mouseup', function () { btn.style.background = 'rgba(255,255,255,.2)'; });
      card.appendChild(btn);
    });
  }

  // ══════════════════════════════════════
  // 3. MODAL D'ÉDITION
  // ══════════════════════════════════════
  function openEditModal(cat) {
    // Supprimer une modal existante
    var old = document.getElementById('fcEditOverlay');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'fcEditOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,10,40,.5);backdrop-filter:blur(5px);z-index:250;display:flex;align-items:center;justify-content:center;padding:16px;';

    var modal = document.createElement('div');
    modal.className = 'modal-box';
    modal.style.cssText = 'animation:mIn .24s cubic-bezier(.34,1.4,.64,1) both;max-width:380px;';

    var colorsHtml = COLORS.map(function (c) {
      var selected = (cat.couleur || 'cat-default') === c.id;
      return '<div class="fc-color-opt' + (selected ? ' selected' : '') + '" data-color="' + c.id + '" ' +
        'style="width:32px;height:32px;border-radius:10px;background:' + c.bg + ';cursor:pointer;' +
        'border:2px solid ' + (selected ? '#fff' : 'transparent') + ';' +
        'box-shadow:' + (selected ? '0 0 0 2px #7C3AED' : 'none') + ';transition:all .12s;" ' +
        'title="' + c.label + '"></div>';
    }).join('');

    modal.innerHTML =
      '<div class="modal-title">✏️ Modifier la catégorie</div>' +
      '<div style="text-align:center;margin-bottom:14px;">' +
        '<div id="fcPreviewCard" class="cat-card ' + (cat.couleur || 'cat-default') + '" ' +
        'style="display:inline-block;min-width:140px;min-height:auto;padding:14px 18px;text-align:center;cursor:default;">' +
          '<div class="cat-emoji" id="fcPreviewEmoji">' + (cat.emoji || '📦') + '</div>' +
          '<div class="cat-name" id="fcPreviewName">' + esc(cat.name) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="form-group"><label>Nom</label>' +
        '<input type="text" id="fcEditName" value="' + esc(cat.name) + '" placeholder="Nom de la catégorie">' +
      '</div>' +
      '<div class="form-group"><label>Emoji</label>' +
        '<input type="text" id="fcEditEmoji" value="' + (cat.emoji || '🏷️') + '" maxlength="2" ' +
        'style="width:80px;font-size:24px;text-align:center;">' +
      '</div>' +
      '<div class="form-group"><label>Couleur</label>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;" id="fcColorGrid">' + colorsHtml + '</div>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn-cancel" id="fcEditCancel">Annuler</button>' +
        '<button class="btn-confirm" id="fcEditSave">Enregistrer</button>' +
      '</div>';

    overlay.appendChild(modal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    var selectedColor = cat.couleur || 'cat-default';

    // Live preview
    var nameInput = document.getElementById('fcEditName');
    var emojiInput = document.getElementById('fcEditEmoji');
    nameInput.addEventListener('input', function () {
      document.getElementById('fcPreviewName').textContent = nameInput.value || cat.name;
    });
    emojiInput.addEventListener('input', function () {
      document.getElementById('fcPreviewEmoji').textContent = emojiInput.value || cat.emoji;
    });

    // Color selection
    document.getElementById('fcColorGrid').addEventListener('click', function (e) {
      var opt = e.target.closest('.fc-color-opt');
      if (!opt) return;
      selectedColor = opt.dataset.color;
      document.querySelectorAll('.fc-color-opt').forEach(function (o) {
        o.style.border = '2px solid transparent';
        o.style.boxShadow = 'none';
      });
      opt.style.border = '2px solid #fff';
      opt.style.boxShadow = '0 0 0 2px #7C3AED';
      var preview = document.getElementById('fcPreviewCard');
      COLORS.forEach(function (c) { preview.classList.remove(c.id); });
      preview.classList.add(selectedColor);
    });

    // Cancel
    document.getElementById('fcEditCancel').addEventListener('click', function () { overlay.remove(); });

    // Save
    document.getElementById('fcEditSave').addEventListener('click', async function () {
      var newName = nameInput.value.trim();
      var newEmoji = emojiInput.value.trim() || cat.emoji;
      if (!newName) {
        window.showNotification?.('❌ Le nom est requis', 'error');
        return;
      }

      try {
        var res = await window.authfetch?.(API() + '/categories/' + cat.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName, emoji: newEmoji, couleur: selectedColor }),
        });

        if (!res || !res.ok) {
          var err = await res?.json?.().catch(function () { return {}; });
          window.showNotification?.('❌ ' + (err.error || 'Erreur'), 'error');
          return;
        }

        // Mettre à jour localement
        var local = (window.appData?.categories || []).find(function (c) { return c.id === cat.id; });
        if (local) {
          local.name = newName;
          local.emoji = newEmoji;
          local.couleur = selectedColor;
        }
        window.saveAppDataLocal?.();
        window.afficherCategories?.();
        window.afficherCategoriesVente?.();
        window.afficherFiltresCategories?.();

        window.haptic?.success();
        window.showNotification?.('✅ Catégorie modifiée', 'success');
        overlay.remove();

        // Re-injecter les boutons d'édition
        setTimeout(injectEditButtons, 200);
      } catch (e) {
        window.showNotification?.('❌ Erreur réseau', 'error');
      }
    });

    nameInput.focus();
    nameInput.select();
  }

  // ══════════════════════════════════════
  // OBSERVER pour injecter les boutons après chaque render
  // ══════════════════════════════════════
  function startObserver() {
    var target = document.getElementById('listeCategories');
    if (!target) { setTimeout(startObserver, 500); return; }

    new MutationObserver(function () {
      requestAnimationFrame(injectEditButtons);
    }).observe(target, { childList: true, subtree: true });

    injectEditButtons();
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function init() {
    if (!window.appData) { setTimeout(init, 300); return; }
    setupSearch();
    startObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 600); });
  } else {
    setTimeout(init, 600);
  }
})();
