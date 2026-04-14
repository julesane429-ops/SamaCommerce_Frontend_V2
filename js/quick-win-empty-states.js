/**
 * quick-win-empty-states.js — Empty states actionnables
 *
 * Remplace les empty states passifs par des versions avec CTA :
 *   - Catégories vides → "Créer ma première catégorie"
 *   - Produits vides → "Ajouter un produit"
 *   - Historique ventes vide → "Faire une vente"
 *   - Crédits vides → explications + CTA
 *   - Clients vides → CTA ajout
 *
 * Utilise un MutationObserver pour intercepter les empty states
 * générés par le code existant et les enrichir.
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/quick-win-empty-states.js"></script>
 */

(function () {

  // ══════════════════════════════════════
  // CONFIG : mapping des empty states
  // ══════════════════════════════════════
  var EMPTY_CONFIGS = {
    listeCategories: {
      icon: '🏷️',
      title: 'Aucune catégorie',
      sub: 'Les catégories organisent vos produits par type (Boissons, Alimentaire, etc.)',
      cta: '+ Créer ma première catégorie',
      ctaStyle: 'primary',
      action: function () {
        window.showModal?.('ajoutCategorie');
      }
    },
    listeProduits: {
      icon: '📦',
      title: 'Aucun produit en stock',
      sub: 'Ajoutez vos produits avec leur prix d\'achat et de vente pour commencer',
      cta: '+ Ajouter un produit',
      ctaStyle: 'primary',
      action: function () {
        window.handleAddProductClick?.() || window.showModal?.('ajoutProduit');
      }
    },
    salesHistoryBody: {
      icon: '📜',
      title: 'Aucune vente enregistrée',
      sub: 'Vos ventes apparaîtront ici avec les détails de chaque transaction',
      cta: '💳 Faire une vente',
      ctaStyle: 'primary',
      action: function () {
        window.showSection?.('vente');
      },
      isTable: true
    },
    creditsHistory: {
      icon: '📝',
      title: 'Aucun crédit en cours',
      sub: 'Quand un client achète à crédit, ses dettes apparaîtront ici',
      cta: '💳 Vendre à crédit',
      ctaStyle: 'secondary',
      action: function () {
        window.showSection?.('vente');
      }
    },
    clientsList: {
      icon: '👥',
      title: 'Aucun client enregistré',
      sub: 'Ajoutez vos clients pour suivre leurs achats et crédits',
      cta: '+ Ajouter un client',
      ctaStyle: 'primary',
      action: function () {
        window.showModal?.('ajoutClient');
      }
    },
    inventaireTable: {
      icon: '📋',
      title: 'Inventaire vide',
      sub: 'Ajoutez des produits dans votre stock pour voir vos bénéfices ici',
      cta: '📦 Gérer le stock',
      ctaStyle: 'secondary',
      action: function () {
        window.showSection?.('stock');
      }
    }
  };

  // ══════════════════════════════════════
  // REMPLACEMENT DES EMPTY STATES
  // ══════════════════════════════════════
  function replaceEmptyState(container, config) {
    if (!container) return;

    // Vérifier si c'est vraiment un empty state
    var content = container.innerHTML.trim();
    var isEmpty =
      content.includes('Aucun') ||
      content.includes('aucun') ||
      content.includes('vide') ||
      content.includes('empty-state') ||
      (content.includes('text-gray-500') && content.includes('text-center'));

    if (!isEmpty) return;

    // Construire le nouvel empty state
    if (config.isTable) {
      // Pour les tableaux, on insère dans un <tr><td colspan>
      container.innerHTML =
        '<tr><td colspan="6" style="padding:0;border:none;">' +
        buildEmptyHtml(config) +
        '</td></tr>';
    } else {
      container.innerHTML = buildEmptyHtml(config);
    }

    // Attacher l'événement CTA
    var cta = container.querySelector('.qw-empty-cta');
    if (cta && config.action) {
      cta.addEventListener('click', function () {
        window.haptic?.tap();
        config.action();
      });
    }
  }

  function buildEmptyHtml(config) {
    var ctaClass = config.ctaStyle === 'primary' ? 'qw-empty-cta-primary' : 'qw-empty-cta-secondary';
    return (
      '<div class="qw-empty">' +
        '<div class="qw-empty-icon">' + config.icon + '</div>' +
        '<div class="qw-empty-title">' + config.title + '</div>' +
        '<div class="qw-empty-sub">' + config.sub + '</div>' +
        '<button class="qw-empty-cta ' + ctaClass + '">' + config.cta + '</button>' +
      '</div>'
    );
  }

  // ══════════════════════════════════════
  // OBSERVER : intercepter les mises à jour DOM
  // ══════════════════════════════════════
  function startObserving() {
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type !== 'childList' || !mutation.addedNodes.length) return;

        var target = mutation.target;
        if (!target || !target.id) return;

        var config = EMPTY_CONFIGS[target.id];
        if (config) {
          // Petit délai pour laisser le DOM se stabiliser
          requestAnimationFrame(function () {
            replaceEmptyState(target, config);
          });
        }
      });
    });

    // Observer les conteneurs connus
    Object.keys(EMPTY_CONFIGS).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        observer.observe(el, { childList: true });
        // Vérifier l'état initial
        replaceEmptyState(el, EMPTY_CONFIGS[id]);
      }
    });

    // Observer aussi les conteneurs qui n'existent pas encore (lazy loaded)
    var body = document.querySelector('.scroll-content') || document.body;
    var bodyObserver = new MutationObserver(function () {
      Object.keys(EMPTY_CONFIGS).forEach(function (id) {
        var el = document.getElementById(id);
        if (el && !el._qwObserved) {
          el._qwObserved = true;
          observer.observe(el, { childList: true });
          replaceEmptyState(el, EMPTY_CONFIGS[id]);
        }
      });
    });
    bodyObserver.observe(body, { childList: true, subtree: true });
  }

  // ══════════════════════════════════════
  // REMPLACEMENT DE alert() POUR STOCK INSUFFISANT
  // ══════════════════════════════════════
  // Remplacer les alert('❌ Stock insuffisant!') par des notifications
  var _origAlert = window.alert;
  window.alert = function (msg) {
    if (typeof msg === 'string' && msg.includes('Stock insuffisant')) {
      window.haptic?.error();
      if (typeof window.showNotification === 'function') {
        window.showNotification('⚠️ Stock insuffisant pour cette quantité', 'warning');
      } else {
        _origAlert.call(window, msg);
      }
      return;
    }
    _origAlert.call(window, msg);
  };

  // ══════════════════════════════════════
  // DÉMARRAGE
  // ══════════════════════════════════════
  function init() {
    startObserving();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
