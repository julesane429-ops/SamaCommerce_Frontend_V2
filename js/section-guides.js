/**
 * section-guides.js v2 — Guides d'utilisation
 *
 * 1. PLUS SHEET : tooltip bulle sur chaque bouton au tap/hover
 *    — Tap sur un bouton → bulle descriptive apparaît 2s
 *    — Icône ℹ️ en haut du sheet pour activer/désactiver les tooltips
 *
 * 2. SECTIONS : bouton ❓ fixe en haut à droite de chaque section
 *    — Ouvre un modal guide avec les étapes clés
 *    — Toujours visible, jamais intrusif
 *
 * Aucun localStorage requis — purement on-demand.
 * window.resetAllGuides() : no-op (rien à reset)
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/section-guides.js"></script>
 */

(function () {

  // ══════════════════════════════════════════════════════════
  // DONNÉES DES GUIDES
  // ══════════════════════════════════════════════════════════

  // Descriptions pour les tooltips du Plus Sheet
  const PLUS_TOOLTIPS = {
    categories:     { icon:'🏷️', tip:'Créez et organisez vos catégories de produits (habits, cosmétiques, chaussures…)' },
    inventaire:     { icon:'📋', tip:'Vue détaillée de vos marges, bénéfices et mouvements de stock' },
    credits:        { icon:'📝', tip:'Suivez les dettes de vos clients et marquez les remboursements' },
    clients:        { icon:'👥', tip:'Votre carnet clients avec historique d\'achats et crédits intégrés' },
    customerOrders: { icon:'📦', tip:'Commandes passées par vos clients à livrer chez eux' },
    deliveries:     { icon:'🚚', tip:'Suivi des livraisons en cours — assignez un livreur et tracez la livraison' },
    deliverymen:    { icon:'🛵', tip:'Vos coursiers : contacts, zones, tarifs et historique de livraisons' },
    fournisseurs:   { icon:'🏭', tip:'Contacts fournisseurs + envoi de demandes de réappro WhatsApp en un clic' },
    commandes:      { icon:'📋', tip:'Commandes de réapprovisionnement — "Marquer reçue" met à jour le stock auto' },
    calendrier:     { icon:'📅', tip:'Vue calendrier de tous vos crédits, commandes et livraisons à venir' },
    profil:         { icon:'👤', tip:'Boutique, mot de passe, PIN, thème couleur, équipe et langue' },
  };

  // Guides par section (étapes)
  const SECTION_GUIDES = {
    vente: {
      icon: '💳', title: 'Comment vendre ?',
      steps: [
        { icon:'👇', text:'Appuyez sur un produit pour l\'ajouter au panier' },
        { icon:'🔢', text:'Utilisez + / − dans le panier pour ajuster la quantité' },
        { icon:'👤', text:'Associez un client (optionnel) pour alimenter son historique automatiquement' },
        { icon:'💰', text:'Appuyez sur ENCAISSER et choisissez le mode de paiement (espèces, Wave, Orange, Crédit)' },
        { icon:'📱', text:'Partagez le reçu WhatsApp après la vente' },
      ],
    },
    stock: {
      icon: '📦', title: 'Gérer votre stock',
      steps: [
        { icon:'➕', text:'Appuyez sur "+ Ajouter" pour créer un nouveau produit avec prix d\'achat et de vente' },
        { icon:'✏️', text:'Appuyez sur une carte pour modifier un produit ou ajuster son stock directement' },
        { icon:'📷', text:'Ajoutez une photo produit en appuyant sur le bouton 📷 de la carte' },
        { icon:'⚠️', text:'Les produits en rouge ont un stock ≤ 5 — contactez votre fournisseur !' },
        { icon:'🔍', text:'Filtrez par catégorie avec les boutons en haut de la liste' },
      ],
    },
    categories: {
      icon: '🏷️', title: 'Catégories de produits',
      steps: [
        { icon:'➕', text:'Créez une catégorie avec un nom et un emoji représentatif' },
        { icon:'📦', text:'Chaque produit appartient à une catégorie — organisez par type (habits, food, cosmétiques…)' },
        { icon:'🔍', text:'Les catégories apparaissent comme filtres dans Stock et dans l\'écran de vente' },
      ],
    },
    rapports: {
      icon: '📈', title: 'Vos chiffres',
      steps: [
        { icon:'📅', text:'Filtrez par jour, semaine, mois ou tout pour explorer vos données' },
        { icon:'💹', text:'Bouton "Analyse" → tableau de bord financier : marges, break-even, top produits' },
        { icon:'📊', text:'Bouton vert "Export Excel" → fichier complet avec 6 onglets (ventes, clients, stock…)' },
        { icon:'📄', text:'Bouton PDF → rapport financier imprimable avec graphiques' },
        { icon:'↩️', text:'Enregistrez un retour produit depuis l\'historique des ventes (bouton ↩️)' },
      ],
    },
    inventaire: {
      icon: '📋', title: 'Inventaire & marges',
      steps: [
        { icon:'💰', text:'Bénéfice = (prix vente − prix achat) × quantité vendue' },
        { icon:'📊', text:'Marge % = bénéfice ÷ prix achat — visez au moins 30% pour être rentable' },
        { icon:'🔍', text:'Filtrez "Stock faible" pour identifier les produits urgents à réapprovisionner' },
        { icon:'📄', text:'Export PDF de l\'inventaire complet avec graphiques camembert' },
      ],
    },
    credits: {
      icon: '📝', title: 'Gérer les crédits',
      steps: [
        { icon:'📝', text:'Créez un crédit depuis "Vendre" en choisissant le mode Crédit — nom + téléphone requis' },
        { icon:'💰', text:'Marquez un crédit remboursé en appuyant sur le bouton vert de la ligne' },
        { icon:'📅', text:'L\'échéance apparaît dans le Calendrier — les crédits en retard s\'affichent en rouge' },
        { icon:'💬', text:'Rappels WhatsApp automatiques envoyés 2 jours avant chaque échéance' },
      ],
    },
    clients: {
      icon: '👥', title: 'Gérer vos clients',
      steps: [
        { icon:'➕', text:'Ajoutez un client une fois — son historique d\'achats se construit automatiquement' },
        { icon:'🏆', text:'Badge VIP si CA > 100 000 F · Fidèle > 50 000 F · Régulier sinon' },
        { icon:'💳', text:'Les crédits impayés s\'affichent en rouge sur la carte du client' },
        { icon:'📄', text:'Générez un PDF de la fiche client depuis la fiche détail (bouton PDF)' },
        { icon:'💬', text:'Contactez le client via WhatsApp ou téléphone directement depuis sa carte' },
      ],
    },
    fournisseurs: {
      icon: '🏭', title: 'Vos fournisseurs',
      steps: [
        { icon:'➕', text:'Ajoutez vos fournisseurs avec leurs contacts (téléphone, email, adresse)' },
        { icon:'📦', text:'"Commander" → message WhatsApp de réappro pré-rempli avec les produits en stock faible' },
        { icon:'⚠️', text:'Les produits liés à ce fournisseur avec stock ≤ 5 sont détectés automatiquement' },
        { icon:'📜', text:'L\'historique de toutes vos commandes passées est visible dans la fiche détail' },
      ],
    },
    commandes: {
      icon: '📋', title: 'Réappro fournisseurs',
      steps: [
        { icon:'➕', text:'Créez une commande de réappro depuis ici ou depuis le bouton "Commander" d\'un fournisseur' },
        { icon:'✅', text:'"Marquer reçue" → le stock de chaque produit commandé est incrémenté automatiquement' },
        { icon:'📅', text:'Renseignez la date prévue pour voir les retards dans le Calendrier des échéances' },
        { icon:'🏭', text:'Associez toujours un fournisseur pour un meilleur suivi et historique' },
      ],
    },
    livraisons: {
      icon: '📥', title: 'Réceptions de stock',
      steps: [
        { icon:'📦', text:'Une réception est créée quand vous attendez un colis de votre fournisseur' },
        { icon:'✅', text:'Marquez "Livrée" quand vous recevez le colis — le stock est déjà mis à jour via la commande' },
        { icon:'📝', text:'Ajoutez une note de suivi (numéro de tracking, transporteur)' },
      ],
    },
    customerOrders: {
      icon: '📦', title: 'Commandes clients',
      steps: [
        { icon:'➕', text:'Créez une commande quand un client commande des articles à recevoir chez lui' },
        { icon:'✅', text:'Confirmez → une livraison est créée automatiquement, le stock est réservé' },
        { icon:'💳', text:'Choisissez "Payé d\'avance" ou "À encaisser à la livraison" selon le client' },
        { icon:'📍', text:'Renseignez l\'adresse de livraison et la date souhaitée' },
        { icon:'💬', text:'Contactez le client directement depuis la fiche commande' },
      ],
    },
    deliveries: {
      icon: '🚚', title: 'Livraisons clients',
      steps: [
        { icon:'🛵', text:'Assignez un livreur disponible à chaque livraison créée' },
        { icon:'🚛', text:'Marquez "En route" quand le livreur quitte la boutique' },
        { icon:'✅', text:'"Livrée" → stock débité + vente enregistrée automatiquement si paiement à la livraison' },
        { icon:'⚠️', text:'Signalez un problème avec une note de suivi visible de tous' },
        { icon:'📞', text:'Appelez le livreur ou le client directement depuis la fiche livraison' },
      ],
    },
    deliverymen: {
      icon: '🛵', title: 'Vos livreurs',
      steps: [
        { icon:'➕', text:'Ajoutez vos coursiers avec leur zone de livraison et tarif par course' },
        { icon:'🟢', text:'Mettez à jour le statut en temps réel : Disponible / En course / Injoignable' },
        { icon:'📊', text:'Consultez l\'historique et les gains totaux de chaque livreur' },
        { icon:'📞', text:'Appelez ou WhatsApp directement depuis la carte ou la fiche livreur' },
      ],
    },
    calendrier: {
      icon: '📅', title: 'Calendrier des échéances',
      steps: [
        { icon:'🔴', text:'Points rouges = crédits clients à rembourser ce jour' },
        { icon:'🟡', text:'Points jaunes = commandes fournisseurs attendues' },
        { icon:'🔵', text:'Points bleus = livraisons clients prévues' },
        { icon:'👆', text:'Appuyez sur un jour pour voir toutes les échéances et agir directement' },
        { icon:'◀▶', text:'Naviguez entre les mois avec les flèches ou appuyez "Aujourd\'hui"' },
      ],
    },
    profil: {
      icon: '👤', title: 'Votre profil & paramètres',
      steps: [
        { icon:'🏪', text:'Modifiez le nom de votre boutique — il apparaît dans tous vos reçus WhatsApp' },
        { icon:'🔐', text:'Activez le PIN de sécurité pour verrouiller l\'app (section Sécurité PIN)' },
        { icon:'🎨', text:'Changez la couleur de l\'application — 6 thèmes disponibles' },
        { icon:'👥', text:'Invitez jusqu\'à 3 employés depuis "Mon équipe" avec permissions personnalisées' },
        { icon:'🌐', text:'Basculez entre Français et Wolof depuis la section Langue' },
      ],
    },
  };

  // ══════════════════════════════════════════════════════════
  // 1. PLUS SHEET — TOOLTIPS
  // ══════════════════════════════════════════════════════════

  let tooltipsEnabled = false;
  let activeTooltip   = null;

  function removeActiveTooltip() {
    if (activeTooltip) { activeTooltip.remove(); activeTooltip = null; }
  }

  function showTooltip(btn, data) {
    removeActiveTooltip();

    const rect = btn.getBoundingClientRect();
    const tip  = document.createElement('div');
    tip.className = 'sg-tooltip';
    tip.style.cssText = `
      position:fixed;
      left:${rect.left}px;
      top:${rect.bottom + 8}px;
      width:${Math.min(rect.width + 40, window.innerWidth - rect.left - 12)}px;
      background:linear-gradient(135deg,#1E1B4B,#312E81);
      color:#fff;
      border-radius:14px;
      padding:12px 14px;
      font-size:12px;
      line-height:1.5;
      z-index:9999;
      box-shadow:0 8px 24px rgba(0,0,0,.35);
      pointer-events:none;
      animation:sgTooltipIn .2s cubic-bezier(.34,1.3,.64,1) both;
    `;
    tip.innerHTML = `
      <style>
        @keyframes sgTooltipIn {
          from { opacity:0; transform:translateY(-6px) scale(.95); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
      </style>
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <span style="font-size:18px;flex-shrink:0;line-height:1.2;">${data.icon}</span>
        <span>${data.tip}</span>
      </div>
    `;

    document.body.appendChild(tip);
    activeTooltip = tip;

    // Ajuster si déborde en bas
    const tipRect = tip.getBoundingClientRect();
    if (tipRect.bottom > window.innerHeight - 10) {
      tip.style.top = `${rect.top - tipRect.height - 8}px`;
    }

    // Auto-remove après 3s
    setTimeout(removeActiveTooltip, 3000);
  }

  function injectTooltipsOnSheet() {
    const sheet = document.querySelector('#plusSheet .sheet-item, #plusSheet [onclick]');
    const plusInner = document.querySelector('#plusSheet > div > div:last-child');
    if (!plusInner) return;

    // Trouver tous les boutons sheet-item
    plusInner.querySelectorAll('.sheet-item, button[onclick]').forEach(btn => {
      if (btn._sgTooltipBound) return;
      btn._sgTooltipBound = true;

      // Détecter quelle section ce bouton ouvre
      const onclick = btn.getAttribute('onclick') || '';
      const match   = onclick.match(/navTo\(['"](\w+)['"]\)/);
      const section = match?.[1];
      const data    = section ? PLUS_TOOLTIPS[section] : null;

      if (!data) return;

      btn.addEventListener('click', (e) => {
        if (!tooltipsEnabled) return;
        e.stopPropagation();
        e.preventDefault();
        showTooltip(btn, data);
      });

      // Sur desktop : hover
      btn.addEventListener('mouseenter', () => {
        if (!tooltipsEnabled) return;
        showTooltip(btn, data);
      });
      btn.addEventListener('mouseleave', removeActiveTooltip);
    });
  }

  function injectTooltipToggle() {
    const plusInner = document.querySelector('#plusSheet > div > div:last-child');
    if (!plusInner || plusInner.querySelector('#sg-tooltip-toggle')) return;

    const bar = document.createElement('div');
    bar.style.cssText = `
      display:flex;align-items:center;justify-content:space-between;
      padding:8px 4px 14px;
      border-bottom:1px solid #F3F4F6;
      margin-bottom:4px;
    `;
    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:7px;">
        <span style="font-size:14px;">💡</span>
        <span style="font-family:'Sora',sans-serif;font-size:12px;font-weight:700;color:var(--muted);">
          Afficher les descriptions
        </span>
      </div>
      <button id="sg-tooltip-toggle" style="
        width:44px;height:24px;border-radius:12px;border:none;cursor:pointer;
        background:#E5E7EB;position:relative;transition:background .2s;
        flex-shrink:0;
      ">
        <span id="sg-tooltip-thumb" style="
          position:absolute;top:2px;left:2px;
          width:20px;height:20px;border-radius:50%;
          background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2);
          transition:left .2s;
        "></span>
      </button>
    `;

    const header = plusInner.querySelector('div'); // titre "✨ Plus"
    if (header) plusInner.insertBefore(bar, header.nextSibling);
    else plusInner.prepend(bar);

    const toggle = bar.querySelector('#sg-tooltip-toggle');
    const thumb  = bar.querySelector('#sg-tooltip-thumb');

    function updateToggle() {
      toggle.style.background = tooltipsEnabled ? 'var(--primary)' : '#E5E7EB';
      thumb.style.left        = tooltipsEnabled ? '22px' : '2px';
    }

    toggle.addEventListener('click', () => {
      tooltipsEnabled = !tooltipsEnabled;
      updateToggle();
      if (!tooltipsEnabled) removeActiveTooltip();
      else window.showNotification?.('💡 Appuyez sur un élément pour voir sa description', 'info');
    });

    updateToggle();
  }

  function hookPlusSheet() {
    const orig = window.openPlusSheet;
    if (typeof orig !== 'function' || orig._sgHooked) return;
    window.openPlusSheet = function (...args) {
      const r = orig.apply(this, args);
      setTimeout(() => {
        injectTooltipToggle();
        injectTooltipsOnSheet();
      }, 150);
      return r;
    };
    window.openPlusSheet._sgHooked = true;
  }

  // Fermer tooltip quand on clique ailleurs
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#plusSheet')) removeActiveTooltip();
  });

  // ══════════════════════════════════════════════════════════
  // 2. GUIDES PAR SECTION — Bouton ❓ permanent
  // ══════════════════════════════════════════════════════════

  function openSectionGuide(sectionKey) {
    const guide = SECTION_GUIDES[sectionKey];
    if (!guide) return;

    document.getElementById('sg-modal-' + sectionKey)?.remove();

    const bd = document.createElement('div');
    bd.id = 'sg-modal-' + sectionKey;
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet" style="max-height:80dvh;">
        <div class="module-sheet-pill"></div>

        <!-- En-tête -->
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:36px;margin-bottom:8px;">${guide.icon}</div>
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:var(--text);">
            ${guide.title}
          </div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px;">
            ${guide.steps.length} étape${guide.steps.length > 1 ? 's' : ''}
          </div>
        </div>

        <!-- Étapes -->
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
          ${guide.steps.map((step, i) => `
            <div style="
              display:flex;align-items:flex-start;gap:12px;
              background:${i % 2 === 0 ? '#F9FAFB' : 'var(--surface)'};
              border-radius:14px;padding:12px 14px;
              border:1.5px solid #F3F4F6;
            ">
              <div style="
                width:38px;height:38px;border-radius:12px;
                background:linear-gradient(135deg,#EDE9FE,#FCE7F3);
                display:flex;align-items:center;justify-content:center;
                font-size:18px;flex-shrink:0;
              ">${step.icon}</div>
              <div style="flex:1;padding-top:2px;">
                <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:2px;text-transform:uppercase;letter-spacing:.4px;">
                  Étape ${i + 1}
                </div>
                <div style="font-size:13px;color:var(--text);line-height:1.5;">
                  ${step.text}
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <button style="
          width:100%;padding:13px;
          background:linear-gradient(135deg,var(--primary),var(--accent));
          color:#fff;border:none;border-radius:14px;
          font-family:'Sora',sans-serif;font-size:14px;font-weight:700;
          cursor:pointer;box-shadow:0 4px 14px rgba(124,58,237,.25);
        " id="sg-modal-close">✅ J'ai compris !</button>
      </div>
    `;

    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
    bd.querySelector('#sg-modal-close').addEventListener('click', () => bd.remove());
  }

  function injectHelpButton(sectionKey) {
    const section = document.getElementById(sectionKey + 'Section');
    if (!section) return;
    if (section.querySelector('.sg-help-btn')) return;

    const guide = SECTION_GUIDES[sectionKey];
    if (!guide) return;

    const header = section.querySelector('.page-header');
    if (!header) return;

    const btn = document.createElement('button');
    btn.className = 'sg-help-btn';
    btn.setAttribute('aria-label', `Guide — ${guide.title}`);
    btn.style.cssText = `
      background:rgba(124,58,237,.1);
      color:#7C3AED;
      border:none;
      width:34px;height:34px;
      border-radius:10px;
      font-size:15px;
      cursor:pointer;
      flex-shrink:0;
      display:flex;align-items:center;justify-content:center;
      transition:background .15s, transform .1s;
      -webkit-tap-highlight-color:transparent;
    `;
    btn.textContent = '❓';
    btn.title       = 'Guide : ' + guide.title;

    btn.addEventListener('click',      () => openSectionGuide(sectionKey));
    btn.addEventListener('mousedown',  () => { btn.style.transform = 'scale(.9)'; });
    btn.addEventListener('mouseup',    () => { btn.style.transform = 'scale(1)'; });
    btn.addEventListener('mouseover',  () => { btn.style.background = 'rgba(124,58,237,.2)'; });
    btn.addEventListener('mouseout',   () => { btn.style.background = 'rgba(124,58,237,.1)'; btn.style.transform = 'scale(1)'; });

    header.appendChild(btn);
  }

  function injectAllHelpButtons() {
    Object.keys(SECTION_GUIDES).forEach(injectHelpButton);
  }

  // ══════════════════════════════════════════════════════════
  // 3. HOOK showSection pour injecter les boutons à la volée
  // ══════════════════════════════════════════════════════════
  function hookShowSection() {
    const orig = window.showSection;
    if (typeof orig !== 'function' || orig._sgHooked) return;
    window.showSection = function (section, ...args) {
      const r = orig.call(this, section, ...args);
      // Injecter le bouton ❓ si pas encore fait
      setTimeout(() => injectHelpButton(section), 200);
      return r;
    };
    window.showSection._sgHooked = true;
  }

  // Injecter aussi sur pageChange (modules autonomes)
  window.addEventListener('pageChange', e => {
    setTimeout(() => injectHelpButton(e.detail?.key), 300);
  });

  // ══════════════════════════════════════════════════════════
  // API PUBLIQUE
  // ══════════════════════════════════════════════════════════
  window.resetAllGuides    = () => {}; // rien à reset, guides toujours disponibles
  window.openSectionGuide  = openSectionGuide;

  // ══════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════
  function init() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        hookPlusSheet();
        hookShowSection();
        injectAllHelpButtons();
      }, 2000);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
