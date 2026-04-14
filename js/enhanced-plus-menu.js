/**
 * enhanced-plus-menu.js — Menu "Plus" repensé
 *
 * Remplace le bottom sheet "Plus" par une version améliorée :
 *   - Favoris épinglables (stockés en localStorage)
 *   - Sections groupées par catégorie (Gestion, Finance, Logistique, Compte)
 *   - Mode édition pour gérer les favoris
 *   - Accès rapide aux favoris via des chips en haut
 *
 * INTÉGRATION dans index.html :
 *   <link rel="stylesheet" href="css/enhanced-plus-menu.css"> (dans <head>)
 *   <script src="js/enhanced-plus-menu.js"></script> (avant </body>)
 */

(function () {

  // ══════════════════════════════════════
  // CONFIG : sections groupées
  // ══════════════════════════════════════
  var GROUPS = [
    {
      id: 'gestion',
      title: 'Gestion',
      items: [
        { section: 'categories',  icon: '🏷️', name: 'Catégories',       desc: 'Organiser vos produits',           bg: '#EDE9FE' },
        { section: 'inventaire',  icon: '📋', name: 'Inventaire',       desc: 'Suivre vos bénéfices',             bg: '#ECFDF5' },
        { section: 'fournisseurs',icon: '🏭', name: 'Fournisseurs',     desc: 'Contacts & réappro WhatsApp',      bg: '#ECFDF5' },
        { section: 'commandes',   icon: '📋', name: 'Réappro',          desc: 'Commandes de stock fournisseurs',  bg: '#F0FDF4' },
      ]
    },
    {
      id: 'finance',
      title: 'Finance',
      items: [
        { section: 'credits',     icon: '📝', name: 'Crédits',          desc: 'Gérer les dettes clients',         bg: '#F5F3FF' },
        { section: 'caisse',      icon: '🧾', name: 'Caisse',           desc: 'Clôture quotidienne & historique', bg: '#ECFDF5' },
        { section: 'calendrier',  icon: '📅', name: 'Échéances',        desc: 'Crédits · Commandes · Livraisons', bg: '#EFF6FF' },
      ]
    },
    {
      id: 'clients',
      title: 'Clients & Livraisons',
      items: [
        { section: 'clients',        icon: '👥', name: 'Clients',            desc: 'Gérer vos clients',                bg: '#EFF6FF' },
        { section: 'customerOrders',  icon: '📦', name: 'Commandes clients',  desc: 'Gérer les commandes à livrer',     bg: '#FEF3C7' },
        { section: 'deliveries',      icon: '🚚', name: 'Livraisons',         desc: 'Suivi des livraisons en cours',    bg: '#EFF6FF' },
        { section: 'deliverymen',     icon: '🛵', name: 'Livreurs',           desc: 'Gérer vos coursiers',              bg: '#FEF9C3' },
      ]
    },
    {
      id: 'compte',
      title: 'Mon compte',
      items: [
        { section: 'profil',     icon: '👤', name: 'Mon Profil',       desc: 'Boutique · Mot de passe · Plan',   bg: '#EDE9FE' },
      ]
    }
  ];

  var STORAGE_KEY = 'sc_plus_favorites';
  var _sheetEl = null;
  var _isEditing = false;

  // ══════════════════════════════════════
  // FAVORIS (localStorage)
  // ══════════════════════════════════════
  function getFavorites() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function saveFavorites(favs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
    } catch (e) { /* noop */ }
  }

  function toggleFavorite(section) {
    var favs = getFavorites();
    var idx = favs.indexOf(section);
    if (idx > -1) {
      favs.splice(idx, 1);
    } else {
      if (favs.length >= 4) {
        if (window.showNotification) {
          window.showNotification('⚠️ Maximum 4 favoris', 'warning');
        }
        return;
      }
      favs.push(section);
    }
    saveFavorites(favs);
    renderSheet();
  }

  function findItem(section) {
    for (var g = 0; g < GROUPS.length; g++) {
      for (var i = 0; i < GROUPS[g].items.length; i++) {
        if (GROUPS[g].items[i].section === section) return GROUPS[g].items[i];
      }
    }
    return null;
  }

  // ══════════════════════════════════════
  // CONSTRUIRE LE SHEET
  // ══════════════════════════════════════
  function buildSheet() {
    // Supprimer l'ancien sheet
    var oldSheet = document.getElementById('plusSheet');
    if (oldSheet) oldSheet.style.display = 'none';

    _sheetEl = document.createElement('div');
    _sheetEl.id = 'epSheet';
    _sheetEl.className = 'ep-sheet';
    document.body.appendChild(_sheetEl);
  }

  function renderSheet() {
    if (!_sheetEl) return;
    var favs = getFavorites();

    var html = '';

    // Backdrop
    html += '<div class="ep-backdrop" id="epBackdrop"></div>';

    // Panel
    html += '<div class="ep-panel">';
    html += '<div class="ep-handle"></div>';

    // Header
    html += '<div class="ep-header">';
    html += '<div class="ep-title">✨ Plus</div>';
    html += '<button class="ep-edit-btn" id="epEditBtn">' + (_isEditing ? '✓ Terminé' : '⭐ Modifier favoris') + '</button>';
    html += '</div>';

    // Favoris chips
    html += '<div class="ep-favs" id="epFavs">';
    if (favs.length) {
      favs.forEach(function (section) {
        var item = findItem(section);
        if (!item) return;
        html += '<button class="ep-fav-chip" data-nav="' + section + '">';
        html += '<span class="ep-fav-chip-icon">' + item.icon + '</span>';
        html += item.name;
        html += '</button>';
      });
    } else {
      html += '<div class="ep-favs-empty">Appuyez sur ⭐ pour ajouter des favoris</div>';
    }
    html += '</div>';

    // Groupes
    GROUPS.forEach(function (group) {
      html += '<div class="ep-group">';
      html += '<div class="ep-group-title">' + group.title + '</div>';
      group.items.forEach(function (item, idx) {
        var isFav = favs.indexOf(item.section) > -1;
        html += '<button class="ep-item" data-nav="' + item.section + '">';
        html += '<div class="ep-item-icon" style="background:' + item.bg + ';">' + item.icon + '</div>';
        html += '<div class="ep-item-text">';
        html += '<div class="ep-item-name">' + item.name + '</div>';
        html += '<div class="ep-item-desc">' + item.desc + '</div>';
        html += '</div>';
        html += '<button class="ep-fav-btn ' + (isFav ? 'is-fav' : '') + '" data-fav="' + item.section + '" aria-label="Favori">' + (isFav ? '⭐' : '☆') + '</button>';
        html += '<span class="ep-item-chevron">›</span>';
        html += '</button>';
        if (idx < group.items.length - 1) {
          html += '<div class="ep-separator"></div>';
        }
      });
      html += '</div>';
    });

    html += '</div>'; // fin panel

    _sheetEl.innerHTML = html;
    _sheetEl.classList.toggle('editing', _isEditing);

    // Bindings
    bindEvents();
  }

  // ══════════════════════════════════════
  // EVENTS
  // ══════════════════════════════════════
  function bindEvents() {
    // Backdrop → close
    var backdrop = document.getElementById('epBackdrop');
    if (backdrop) backdrop.addEventListener('click', closeSheet);

    // Edit button
    var editBtn = document.getElementById('epEditBtn');
    if (editBtn) {
      editBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.haptic?.tap();
        _isEditing = !_isEditing;
        renderSheet();
        if (_sheetEl.classList.contains('open')) {
          // Keep it open after re-render
          _sheetEl.classList.add('open');
        }
      });
    }

    // Fav chips → navigate
    _sheetEl.querySelectorAll('.ep-fav-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        window.haptic?.tap();
        closeSheet();
        window.showSection?.(chip.dataset.nav);
      });
    });

    // Items → navigate (si pas en mode édition)
    _sheetEl.querySelectorAll('.ep-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        // Ignorer si le clic est sur le bouton favori
        if (e.target.closest('.ep-fav-btn')) return;

        window.haptic?.tap();
        closeSheet();
        window.showSection?.(item.dataset.nav);
      });
    });

    // Fav buttons
    _sheetEl.querySelectorAll('.ep-fav-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.haptic?.tap();
        toggleFavorite(btn.dataset.fav);
      });
    });
  }

  // ══════════════════════════════════════
  // OUVERTURE / FERMETURE
  // ══════════════════════════════════════
  function openSheet() {
    if (!_sheetEl) buildSheet();
    _isEditing = false;
    renderSheet();
    _sheetEl.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    if (_sheetEl) _sheetEl.classList.remove('open');
    document.body.style.overflow = '';
    _isEditing = false;
  }

  // ══════════════════════════════════════
  // INTERCEPTER openPlusSheet / closePlusSheet
  // ══════════════════════════════════════
  function hookFunctions() {
    window.openPlusSheet = openSheet;
    window.closePlusSheet = closeSheet;
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    buildSheet();
    hookFunctions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 300); });
  } else {
    setTimeout(init, 300);
  }

})();
