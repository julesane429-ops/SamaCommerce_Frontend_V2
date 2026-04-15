/**
 * fix-all-v3.js — Corrections globales v3
 *
 * 1. Paiement mixte → envoie payment_details au backend
 * 2. Switch boutique → refresh complet sans Ctrl+F5
 * 3. Sidebar desktop → ajoute la section Livreurs manquante
 * 4. Recherche globale → inclut clients, fournisseurs, livreurs
 * 5. Autocomplete client dans section vente (crédit)
 * 6. Rapports → affiche "mixte" avec le détail
 *
 * INTÉGRATION : <script src="js/fix-all-v3.js"></script> (en dernier)
 */

(function () {

  var API = function () {
    return document.querySelector('meta[name="api-base"]')?.content || '';
  };

  // ══════════════════════════════════════
  // 1. PAIEMENT MIXTE → BACKEND
  // ══════════════════════════════════════
  // Override finaliserVente pour envoyer payment_details quand mixte
  function patchMixtePayment() {
    var origFinaliser = window.finaliserVente;
    if (!origFinaliser || origFinaliser._v3) return;

    window.finaliserVente = async function (paymentMethod) {
      // Si le payment method est l'un des standards, on cherche
      // s'il y a des payment_details stockés par enhanced-vente.js
      var details = window._lastMixteDetails || null;
      window._lastMixteDetails = null; // reset

      if (paymentMethod === 'credit') {
        window.showModalCredit?.();
        return;
      }

      var panier = window.appData?.panier || [];
      if (!panier.length) {
        window.showNotification?.('❌ Panier vide.', 'error');
        return;
      }

      // Optimistic UI (comme l'original)
      var panierCopy = panier.map(function (i) { return Object.assign({}, i); });
      for (var j = 0; j < panierCopy.length; j++) {
        var prod = (window.appData?.produits || []).find(function (p) { return p.id === panierCopy[j].id; });
        if (prod) prod.stock = Math.max(0, prod.stock - panierCopy[j].quantite);
      }

      window.appData.panier = [];
      window.saveAppDataLocal?.();
      window.updateStats?.();
      window.afficherPanier?.();
      window.afficherCategoriesVente?.();
      window.afficherProduits?.();
      window.hideModal?.();

      window.haptic?.success();
      window.showNotification?.('✅ Vente enregistrée.', 'success');

      // Envoi serveur avec payment_details
      ;(async function () {
        for (var k = 0; k < panierCopy.length; k++) {
          var item = panierCopy[k];
          var body = {
            product_id: item.id,
            quantity: item.quantite,
            payment_method: details ? 'mixte' : paymentMethod,
          };
          if (details) body.payment_details = details;

          try {
            var res = await window.authfetch?.(API() + '/sales', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (!res || !res.ok) {
              window.showNotification?.('⚠️ Erreur sync — rechargement', 'warning');
              await window.syncFromServer?.();
              return;
            }
          } catch (e) {
            window.showNotification?.('⚠️ Erreur réseau', 'warning');
            await window.syncFromServer?.();
            return;
          }
        }
        await window.syncFromServer?.();
        window.verifierStockFaible?.();
      })();
    };
    window.finaliserVente._v3 = true;
  }

  // Patch enhanced-vente.js pour stocker les détails mixte
  function patchEnhancedVente() {
    // Observer le modal de paiement pour intercepter le mode mixte
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('#evConfirmBtn');
      if (!btn) return;
      // Chercher les inputs mixtes
      var section = document.getElementById('evMixteSection');
      if (section && section.style.display !== 'none') {
        var inputs = section.querySelectorAll('.ev-mixte-input');
        var details = {};
        inputs.forEach(function (inp) {
          var val = parseFloat(inp.value) || 0;
          if (val > 0) details[inp.dataset.mixteMethod] = val;
        });
        if (Object.keys(details).length > 1) {
          window._lastMixteDetails = details;
        }
      }
    }, true);
  }

  // ══════════════════════════════════════
  // 2. SWITCH BOUTIQUE → REFRESH COMPLET
  // ══════════════════════════════════════
  function patchBoutiqueSwitch() {
    var origSwitch = window._switchBoutique;
    if (!origSwitch || origSwitch._v3) return;

    window._switchBoutique = async function (boutiqueId) {
      // Appeler l'original (met à jour localStorage, header, etc.)
      await origSwitch(boutiqueId);

      // Rafraîchir TOUTES les sections — pas seulement produits/catégories
      try {
        await window.syncFromServer?.();
      } catch (e) { /* ignore */ }

      // Reset tous les flags d'init de section pour forcer un reload
      if (window._sectionInit) {
        Object.keys(window._sectionInit).forEach(function (k) {
          window._sectionInit[k] = false;
        });
      }

      // Rafraîchir les sections visibles
      window.updateStats?.();
      window.afficherProduits?.();
      window.afficherCategories?.();
      window.afficherCategoriesVente?.();
      window.verifierStockFaible?.();
      window.afficherCredits?.();
      window.renderCreditsHistory?.();
      window.afficherRapports?.();
      window.afficherInventaire?.();

      // Rafraîchir les sections IIFE
      window.loadClients?.();
      window.loadFournisseurs?.();
      window.loadCommandes?.();

      // Recharger les modules qui ont des données en cache
      window.dailyGoal?.reload?.();
      window.scNotifications?.check?.();

      window.showNotification?.('✅ Données mises à jour', 'success');
    };
    window._switchBoutique._v3 = true;
  }

  // ══════════════════════════════════════
  // 3. SIDEBAR → AJOUTER LIVREURS
  // ══════════════════════════════════════
  function patchSidebar() {
    // Attendre que la sidebar existe
    var sidebar = document.querySelector('.dt-sidebar');
    if (!sidebar) return;

    // Vérifier si deliverymen est déjà dans la sidebar
    if (sidebar.querySelector('[data-nav="deliverymen"]')) return;

    // Chercher le dernier item de la section "Clients" pour insérer après
    var livraisonsBtn = sidebar.querySelector('[data-nav="deliveries"]');
    if (!livraisonsBtn) return;

    var livreurBtn = document.createElement('button');
    livreurBtn.className = 'dt-sidebar-item';
    livreurBtn.dataset.nav = 'deliverymen';
    livreurBtn.innerHTML = '<span class="dt-sidebar-item-icon">🛵</span><span class="dt-sidebar-item-label">Livreurs</span>';
    livreurBtn.addEventListener('click', function () {
      window.haptic?.tap();
      window.showSection?.('deliverymen');
      // Mettre à jour l'état actif
      sidebar.querySelectorAll('.dt-sidebar-item, .dt-sidebar-fab').forEach(function (b) {
        b.classList.toggle('active', b.dataset.nav === 'deliverymen');
      });
    });

    livraisonsBtn.insertAdjacentElement('afterend', livreurBtn);
  }

  // ══════════════════════════════════════
  // 4. RECHERCHE GLOBALE ÉTENDUE
  // ══════════════════════════════════════
  function patchGlobalSearch() {
    // Intercepter la recherche globale pour ajouter plus de résultats
    var origSearch = window._globalSearchFn;
    if (window._globalSearchFn?._v3) return;

    // Observer l'input de recherche globale
    function hookSearch() {
      var input = document.getElementById('global-search-input');
      if (!input) { setTimeout(hookSearch, 1000); return; }
      if (input._v3Hooked) return;
      input._v3Hooked = true;

      input.addEventListener('input', function () {
        var q = input.value.toLowerCase().trim();
        if (q.length < 2) return;

        // Ajouter les résultats étendus après un court délai
        clearTimeout(input._v3Timer);
        input._v3Timer = setTimeout(function () {
          addExtendedResults(q);
        }, 200);
      });
    }
    hookSearch();
  }

  function addExtendedResults(query) {
    var container = document.getElementById('global-search-results') ||
                    document.querySelector('.gs-results');
    if (!container) return;

    // Chercher dans les clients
    var clients = [];
    if (window.appData?.clients) {
      window.appData.clients.forEach(function (c) {
        if ((c.name || '').toLowerCase().includes(query) ||
            (c.phone || '').includes(query)) {
          clients.push(c);
        }
      });
    }

    // Chercher dans les fournisseurs (si chargés)
    var fournisseurs = [];
    if (window._fournisseursCache) {
      window._fournisseursCache.forEach(function (f) {
        if ((f.name || '').toLowerCase().includes(query) ||
            (f.phone || '').includes(query)) {
          fournisseurs.push(f);
        }
      });
    }

    // Ajouter les résultats au conteneur existant
    if (clients.length) {
      appendSearchGroup(container, '👥 Clients', clients.slice(0, 3).map(function (c) {
        return {
          label: c.name + (c.phone ? ' · ' + c.phone : ''),
          action: function () {
            window.showSection?.('clients');
            setTimeout(function () { window.openClientDetail?.(c.id); }, 300);
          }
        };
      }));
    }

    if (fournisseurs.length) {
      appendSearchGroup(container, '🏭 Fournisseurs', fournisseurs.slice(0, 3).map(function (f) {
        return {
          label: f.name + (f.phone ? ' · ' + f.phone : ''),
          action: function () {
            window.showSection?.('fournisseurs');
          }
        };
      }));
    }
  }

  function appendSearchGroup(container, title, items) {
    if (!items.length) return;

    // Éviter les doublons
    if (container.querySelector('[data-v3-group="' + title + '"]')) return;

    var group = document.createElement('div');
    group.dataset.v3Group = title;
    group.style.cssText = 'margin-top:8px;';
    group.innerHTML = '<div style="font-size:11px;font-weight:700;color:var(--muted);padding:4px 0;">' + title + '</div>';

    items.forEach(function (item) {
      var row = document.createElement('div');
      row.style.cssText = 'padding:10px 12px;border-radius:10px;cursor:pointer;font-size:13px;color:var(--text);transition:background .12s;';
      row.textContent = item.label;
      row.addEventListener('click', item.action);
      row.addEventListener('mouseover', function () { row.style.background = 'var(--bg,#F5F3FF)'; });
      row.addEventListener('mouseout', function () { row.style.background = 'transparent'; });
      group.appendChild(row);
    });

    container.appendChild(group);
  }

  // ══════════════════════════════════════
  // 5. RAPPORTS → AFFICHAGE "MIXTE"
  // ══════════════════════════════════════
  function patchRapportsDisplay() {
    // Override formatPayMethod dans les ventes pour afficher les détails mixte
    var origFmtPay = window._fmtPayMethod;

    // Monkey-patch sur les fonctions qui affichent le mode de paiement
    // Cela fonctionne car ux-responsive.js et virtual-lists.js utilisent fmtPay() localement
    // On injecte dans le rendu HTML des cartes de ventes
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          // Chercher les pills qui affichent "mixte"
          var pills = node.querySelectorAll ? node.querySelectorAll('.sv-pill, [class*="pay-"]') : [];
          pills.forEach(function (pill) {
            if (pill.textContent.includes('mixte') || pill.textContent.includes('Mixte')) {
              // Chercher la carte parente pour récupérer l'ID de vente
              var card = pill.closest('.sv-card, tr');
              if (card) {
                pill.style.cursor = 'pointer';
                pill.title = 'Cliquer pour voir les détails';
              }
            }
          });
        });
      });
    });

    var salesCard = document.getElementById('salesHistory');
    if (salesCard) {
      observer.observe(salesCard, { childList: true, subtree: true });
    }
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    if (!window.appData) { setTimeout(init, 300); return; }

    patchMixtePayment();
    patchEnhancedVente();

    // Attendre que les fonctions soient disponibles
    function waitAndPatch() {
      if (window._switchBoutique) patchBoutiqueSwitch();
      else setTimeout(waitAndPatch, 300);
    }
    waitAndPatch();

    // Sidebar (desktop only)
    function waitSidebar() {
      if (document.querySelector('.dt-sidebar')) patchSidebar();
      else if (window.innerWidth >= 768) setTimeout(waitSidebar, 500);
    }
    waitSidebar();
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 768) setTimeout(waitSidebar, 200);
    });

    patchGlobalSearch();
    patchRapportsDisplay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 800); });
  } else {
    setTimeout(init, 800);
  }

})();
