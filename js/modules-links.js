/**
 * modules-links.js — Liaisons intelligentes entre modules
 *
 * 3 liaisons :
 *
 * 1. VENTE → CLIENTS
 *    - Dans la modal Vente à Crédit : autocomplete sur le nom du client
 *      depuis la liste Clients. Un clic pré-remplit nom + téléphone.
 *    - Après chaque vente (espèces/wave/orange) : si le client existe
 *      dans la base, l'associer silencieusement (via client_name match).
 *
 * 2. COMMANDE REÇUE → LIVRAISON AUTO
 *    - Quand `PATCH /commandes/:id/recevoir` réussit, créer automatiquement
 *      une livraison liée avec status "livree" et noted_at = maintenant.
 *    - Wrapper sur window.loadCommandes pour intercepter la réception.
 *
 * 3. FICHE CLIENT → CRÉDITS EN COURS
 *    - Injecter dans la fiche détail client un bloc "Crédits en cours"
 *      en filtrant appData.credits sur le nom du client.
 *
 * INTÉGRATION dans index.html, juste avant </body> :
 *   <script src="js/modules-links.js"></script>
 *   (après clients.js, fournisseurs.js, commandes.js, livraisons.js)
 */

(function () {

  const API    = () => document.querySelector('meta[name="api-base"]')?.content
                 || 'https://samacommerce-backend-v2.onrender.com';
  const fetch_ = (url, opts = {}) => window.authfetch(url, opts);

  // ════════════════════════════════════════════════════════════
  // LIAISON 1 — VENTE → CLIENTS
  // Autocomplete dans la modal crédit + pré-remplissage
  // ════════════════════════════════════════════════════════════

  /**
   * Charge les clients et injecte un autocomplete
   * dans la modal #modalCredit (creditClientName / creditClientPhone)
   */
  function installCreditAutocomplete() {
    const nameInput  = document.getElementById('creditClientName');
    const phoneInput = document.getElementById('creditClientPhone');
    if (!nameInput || !phoneInput) return;
    if (nameInput._autocompleteInstalled) return;
    nameInput._autocompleteInstalled = true;

    // Créer le dropdown suggestions
    const dropdown = document.createElement('div');
    dropdown.id = 'credit-client-dropdown';
    dropdown.style.cssText = `
      position: absolute;
      top: 100%; left: 0; right: 0;
      background: var(--surface, #fff);
      border: 1.5px solid rgba(124,58,237,.2);
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,.12);
      z-index: 600;
      max-height: 200px;
      overflow-y: auto;
      display: none;
    `;

    // Wrapper relatif sur l'input
    const wrap = nameInput.parentElement;
    if (wrap && getComputedStyle(wrap).position === 'static') {
      wrap.style.position = 'relative';
    }
    nameInput.parentElement.appendChild(dropdown);

    let clients = [];

    // Charger les clients au focus
    nameInput.addEventListener('focus', async () => {
      if (clients.length) return; // déjà chargés
      try {
        const res = await fetch_(`${API()}/clients`);
        if (res.ok) clients = await res.json();
      } catch { /* silencieux */ }
    });

    // Filtrer à chaque frappe
    nameInput.addEventListener('input', () => {
      const term = nameInput.value.trim().toLowerCase();
      if (!term || !clients.length) { dropdown.style.display = 'none'; return; }

      const matches = clients.filter(c =>
        (c.name || '').toLowerCase().includes(term) ||
        (c.phone || '').includes(term)
      ).slice(0, 6);

      if (!matches.length) { dropdown.style.display = 'none'; return; }

      dropdown.innerHTML = matches.map(c => `
        <div class="credit-client-option"
             data-name="${c.name}"
             data-phone="${c.phone || ''}"
             style="
               padding: 10px 14px;
               cursor: pointer;
               display: flex;
               align-items: center;
               gap: 10px;
               border-bottom: 1px solid #F3F4F6;
               font-family: 'DM Sans', sans-serif;
               font-size: 14px;
             ">
          <div style="
            width:34px; height:34px;
            border-radius:10px;
            background: linear-gradient(135deg, #7C3AED, #EC4899);
            color:#fff; font-weight:700; font-size:13px;
            display:flex; align-items:center; justify-content:center;
            flex-shrink:0;
          ">
            ${(c.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}
          </div>
          <div>
            <div style="font-weight:700;color:var(--text,#1E1B4B);">${c.name}</div>
            <div style="font-size:12px;color:var(--muted,#6B7280);">${c.phone || 'Aucun téléphone'}</div>
          </div>
        </div>
      `).join('');

      dropdown.style.display = 'block';

      // Clic sur une suggestion → pré-remplir
      dropdown.querySelectorAll('.credit-client-option').forEach(opt => {
        opt.addEventListener('mousedown', e => {
          e.preventDefault(); // éviter le blur de l'input
          nameInput.value  = opt.dataset.name;
          phoneInput.value = opt.dataset.phone;
          dropdown.style.display = 'none';

          // Feedback visuel
          nameInput.style.borderColor  = '#10B981';
          phoneInput.style.borderColor = '#10B981';
          setTimeout(() => {
            nameInput.style.borderColor  = '';
            phoneInput.style.borderColor = '';
          }, 1000);

          window.showNotification?.(`👤 Client "${opt.dataset.name}" sélectionné`, 'success');
        });
      });
    });

    // Fermer si clic ailleurs
    document.addEventListener('click', e => {
      if (!dropdown.contains(e.target) && e.target !== nameInput) {
        dropdown.style.display = 'none';
      }
    });
  }

  /**
   * Observer l'ouverture de #modalCredit pour installer l'autocomplete
   */
  function watchCreditModal() {
    const modal = document.getElementById('modalCredit');
    if (!modal) return;

    const observer = new MutationObserver(() => {
      if (!modal.classList.contains('hidden')) {
        // Modal vient de s'ouvrir
        setTimeout(installCreditAutocomplete, 50);
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });

    // Aussi installer si déjà visible au chargement
    if (!modal.classList.contains('hidden')) {
      installCreditAutocomplete();
    }
  }

  /**
   * Après une vente normale (espèces/wave/orange),
   * tenter de lier silencieusement au client existant
   * en cherchant un match dans l'historique des achats.
   * (informatif uniquement — pas de champ client sur les ventes normales)
   */
  function hookVenteForClientLink() {
    const orig = window.finaliserVente;
    if (typeof orig !== 'function') {
      setTimeout(hookVenteForClientLink, 200);
      return;
    }

    window.finaliserVente = async function (method, ...args) {
      const result = await orig.call(this, method, ...args);

      // Après la vente, rafraîchir silencieusement le badge crédits
      // et la liste clients si elle est visible
      if (window.loadClients && document.getElementById('clientsSection')
          && !document.getElementById('clientsSection').classList.contains('hidden')) {
        window.loadClients();
      }

      return result;
    };
  }


  // ════════════════════════════════════════════════════════════
  // LIAISON 2 — COMMANDE REÇUE → LIVRAISON AUTO
  // Après PATCH /commandes/:id/recevoir, créer une livraison "livree"
  // ════════════════════════════════════════════════════════════

  /**
   * Wrapper sur le bouton "Marquer reçue" dans la fiche commande.
   * On intercepte via un event délégué sur document plutôt que de
   * modifier commandes.js — on écoute le toast de succès de réception
   * via MutationObserver sur le toast-container.
   *
   * Approche plus propre : exposer un hook window.onCommandeRecue
   * que commandes.js peut appeler, et l'implémenter ici.
   */

  /**
   * Crée automatiquement une livraison liée après réception d'une commande
   */
  async function createLivraisonAuto(commandeId) {
    try {
      const res = await fetch_(`${API()}/livraisons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commande_id:   commandeId,
          tracking_note: 'Livraison créée automatiquement lors de la réception',
          status:        'livree',
        }),
      });

      if (res.ok) {
        window.showNotification?.('🚚 Livraison créée automatiquement', 'info');

        // Rafraîchir la section livraisons si elle est visible
        if (window.loadLivraisons &&
            !document.getElementById('livraisonsSection')?.classList.contains('hidden')) {
          window.loadLivraisons();
        }
      }
    } catch { /* silencieux */ }
  }

  // Hook global : commandes.js appellera window.onCommandeRecue(id) après réception
  window.onCommandeRecue = function (commandeId) {
    createLivraisonAuto(commandeId);
  };

  /**
   * Patcher la fonction recevoir() dans commandes.js.
   * Comme elle est locale au module, on utilise une autre approche :
   * on observe les toasts de succès qui contiennent "Stock mis à jour"
   * pour déclencher la création de livraison.
   *
   * Plus robuste : on intercepte fetch vers /commandes/:id/recevoir
   */
  function interceptReceiveCommand() {
    const origFetch = window.fetch;
    if (window._livraisonInterceptInstalled) return;
    window._livraisonInterceptInstalled = true;

    window.fetch = async function (...args) {
      const [url, opts] = args;
      const result = await origFetch.apply(this, args);

      // Détecter PATCH /commandes/:id/recevoir
      if (
        typeof url === 'string' &&
        url.includes('/commandes/') &&
        url.includes('/recevoir') &&
        opts?.method === 'PATCH'
      ) {
        // Cloner la réponse pour lire l'id sans consommer le stream
        try {
          const cloned = result.clone();
          const data   = await cloned.json();
          const cmdId  = data?.commande?.id;
          if (cmdId && result.ok) {
            // Délai pour laisser le toast de commandes.js s'afficher d'abord
            setTimeout(() => createLivraisonAuto(cmdId), 800);
          }
        } catch { /* silencieux */ }
      }

      return result;
    };
  }


  // ════════════════════════════════════════════════════════════
  // LIAISON 3 — FICHE CLIENT → CRÉDITS EN COURS
  // Injecter les crédits en cours dans la fiche détail client
  // ════════════════════════════════════════════════════════════

  /**
   * Enrichit openClientDetail() pour injecter un bloc crédits.
   * On observe l'injection de .module-sheet-backdrop dans le DOM
   * et on recherche si c'est une fiche client (présence du titre).
   */
  function injectClientCredits(backdrop, clientName) {
    const credits = (window.appData?.credits || []).filter(c => {
      const name = (c.client_name || '').trim().toLowerCase();
      return name === clientName.trim().toLowerCase() && !c.paid;
    });

    if (!credits.length) return; // Pas de crédits → on n'injecte rien

    const totalDu = credits.reduce((s, c) => s + (c.total || 0), 0);

    // Trouver le bouton Fermer pour insérer avant lui
    const closeBtn = backdrop.querySelector('button.btn-cancel');
    if (!closeBtn) return;

    const creditBlock = document.createElement('div');
    creditBlock.style.cssText = 'margin-bottom:12px;';
    creditBlock.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #FEE2E2, #FEF3C7);
        border-radius: 16px;
        padding: 14px 16px;
        border: 1.5px solid #F59E0B;
      ">
        <div style="
          font-family: 'Sora', sans-serif;
          font-size: 14px;
          font-weight: 800;
          color: #92400E;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          ⚠️ Crédits en cours — ${totalDu.toLocaleString('fr-FR')} F
        </div>
        ${credits.map(c => `
          <div style="
            background: rgba(255,255,255,.6);
            border-radius: 10px;
            padding: 8px 12px;
            margin-bottom: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 13px;
          ">
            <div>
              <div style="font-weight:700;color:#78350F;">
                ${c.product_name || '—'}
              </div>
              <div style="font-size:11px;color:#92400E;margin-top:2px;">
                Échéance : ${c.due_date
                  ? new Date(c.due_date).toLocaleDateString('fr-FR')
                  : 'Non définie'}
              </div>
            </div>
            <div style="
              font-family: 'Sora', sans-serif;
              font-size: 14px;
              font-weight: 800;
              color: #EF4444;
            ">
              ${(c.total || 0).toLocaleString('fr-FR')} F
            </div>
          </div>
        `).join('')}
        <button
          onclick="window.navTo?.('credits');this.closest('.module-sheet-backdrop')?.remove();"
          style="
            width:100%;
            margin-top:8px;
            padding:10px;
            background:#EF4444;
            color:#fff;
            border:none;
            border-radius:12px;
            font-family:'Sora',sans-serif;
            font-size:13px;
            font-weight:700;
            cursor:pointer;
          ">
          📝 Voir les crédits →
        </button>
      </div>
    `;

    closeBtn.parentElement.insertBefore(creditBlock, closeBtn);
  }

  /**
   * Observer les fiches client qui s'ouvrent dans le DOM
   */
  function watchClientSheets() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (!node.classList?.contains('module-sheet-backdrop')) return;

          // Vérifier si c'est une fiche client
          // (identifié par la présence d'un avatar violet/rose)
          const avatar = node.querySelector('.avatar-client');
          if (!avatar) return;

          // Récupérer le nom du client depuis le titre de la fiche
          const nameEl = node.querySelector(
            '.module-sheet > div[style*="text-align:center"] > div[style*="font-size:18px"]'
          );
          const clientName = nameEl?.textContent?.trim();
          if (!clientName) return;

          // Injecter après un court délai (laisser le DOM se stabiliser)
          setTimeout(() => injectClientCredits(node, clientName), 100);
        });
      });
    });

    observer.observe(document.body, { childList: true });
  }


  // ════════════════════════════════════════════════════════════
  // BONUS — BADGE LIVRAISONS EN RETARD sur la nav
  // ════════════════════════════════════════════════════════════

  /**
   * Ajoute une pastille orange sur ☰ Plus si des livraisons
   * sont en transit depuis plus de 3 jours
   */
  async function checkLateDeliveries() {
    try {
      const res = await fetch_(`${API()}/livraisons`);
      if (!res.ok) return;
      const livs = await res.json();

      const now  = new Date();
      const late = livs.filter(l => {
        if (l.status !== 'en_transit') return false;
        const created = new Date(l.created_at);
        const days    = (now - created) / (1000 * 60 * 60 * 24);
        return days > 3;
      });

      if (!late.length) return;

      // Ajouter badge orange sur nav-plus
      const navPlus = document.getElementById('nav-plus');
      if (!navPlus || document.getElementById('nav-livraison-badge')) return;

      const badge = document.createElement('span');
      badge.id = 'nav-livraison-badge';
      badge.style.cssText = `
        position: absolute;
        top: 2px; right: 2px;
        background: #F59E0B;
        color: #fff;
        font-family: 'Sora', sans-serif;
        font-size: 9px;
        font-weight: 800;
        min-width: 16px;
        height: 16px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
        border: 2px solid var(--surface, #fff);
        pointer-events: none;
        animation: badgePop .3s cubic-bezier(.34,1.56,.64,1) both;
      `;
      badge.textContent = late.length;
      navPlus.style.position = 'relative';
      navPlus.appendChild(badge);

      // Notification discrète
      window.showNotification?.(
        `🚛 ${late.length} livraison${late.length > 1 ? 's' : ''} en retard`,
        'warning'
      );
    } catch { /* silencieux */ }
  }


  // ════════════════════════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════════════════════════

  function init() {
    // 1. Autocomplete vente crédit
    watchCreditModal();

    // 2. Interception réception commande → livraison auto
    interceptReceiveCommand();

    // 3. Crédits dans la fiche client
    watchClientSheets();

    // 4. Badge livraisons en retard (après chargement)
    setTimeout(checkLateDeliveries, 3500);

    // Hook pour rafraîchir clients après vente
    window.addEventListener('load', () => {
      setTimeout(hookVenteForClientLink, 400);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
