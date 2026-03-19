/**
 * rapports-plus.js — Extension de la section Chiffres
 *
 * Ajoute dans #rapportsSection 3 nouveaux blocs :
 *
 *  1. 💡 Tableau de bord financier
 *     CA encaissé vs Dépenses fournisseurs → Marge réelle
 *
 *  2. 📦 Commandes en attente (capital immobilisé)
 *     Total des commandes non reçues
 *
 *  3. 👥 Top clients par CA
 *     Classement des clients par montant d'achats
 *
 * S'auto-met à jour quand afficherRapports() est appelé
 * (observer sur #recettesTout qui change à chaque refresh).
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/rapports-plus.js"></script>
 */

(function () {

  const API    = () => document.querySelector('meta[name="api-base"]')?.content
                 || 'https://samacommerce-backend-v2.onrender.com';
  const fetch_ = (url, opts = {}) => window.authfetch?.(url, opts);

  // Cache local
  let commandesCache  = null;
  let clientsCache    = null;
  let lastFetch       = 0;
  const CACHE_TTL     = 30000; // 30s

  // ════════════════════════════════════════
  // FETCH DONNÉES EXTERNES
  // ════════════════════════════════════════
  async function fetchExternal() {
    const now = Date.now();
    if (now - lastFetch < CACHE_TTL && commandesCache !== null) return;
    lastFetch = now;

    try {
      const [resCmd, resCli] = await Promise.all([
        fetch_(`${API()}/commandes`),
        fetch_(`${API()}/clients`),
      ]);
      if (resCmd?.ok) commandesCache = await resCmd.json();
      if (resCli?.ok) clientsCache   = await resCli.json();
    } catch { /* silencieux — pas de données fournisseurs encore */ }
  }

  // ════════════════════════════════════════
  // INJECTION DU CONTENEUR
  // ════════════════════════════════════════
  function ensureContainer() {
    if (document.getElementById('rapports-plus-container')) return;

    const rapportsSection = document.getElementById('rapportsSection');
    if (!rapportsSection) return;

    const container = document.createElement('div');
    container.id = 'rapports-plus-container';

    // Insérer après le bloc #creditsStats (fin de la section)
    const creditsStats = document.getElementById('creditsStats');
    if (creditsStats && creditsStats.parentNode === rapportsSection.querySelector('.scroll-content')
        || creditsStats?.closest('#rapportsSection')) {
      creditsStats.parentNode.insertBefore(container, creditsStats.nextSibling);
    } else {
      rapportsSection.appendChild(container);
    }
  }

  // ════════════════════════════════════════
  // BLOC 1 — TABLEAU DE BORD FINANCIER
  // CA vs Dépenses fournisseurs → Marge réelle
  // ════════════════════════════════════════
  function renderFinancialDashboard() {
    const el = document.getElementById('rp-financial');
    if (!el) return;

    const ventes   = window.appData?.ventes || [];
    const produits = window.appData?.produits || [];

    // CA total encaissé (ventes payées)
    const caTotal = ventes
      .filter(v => v.paid)
      .reduce((s, v) => s + (v.total || 0), 0);

    // Coût d'achat total des articles vendus
    const coutAchat = ventes
      .filter(v => v.paid)
      .reduce((s, v) => {
        const prod = produits.find(p => String(p.id) === String(v.product_id));
        const achat = prod?.priceAchat || prod?.price_achat || 0;
        return s + achat * (v.quantity || 0);
      }, 0);

    // Dépenses fournisseurs (commandes reçues)
    const depensesFourn = (commandesCache || [])
      .filter(c => c.status === 'recue')
      .reduce((s, c) => s + Number(c.total || 0), 0);

    // Marge brute = CA - coût achat
    const margeBrute  = caTotal - coutAchat;
    const margePct    = caTotal > 0 ? ((margeBrute / caTotal) * 100).toFixed(1) : 0;

    // Commandes en attente = capital immobilisé
    const capitalImmob = (commandesCache || [])
      .filter(c => c.status === 'en_attente' || c.status === 'confirmee')
      .reduce((s, c) => s + Number(c.total || 0), 0);

    const marginColor = margePct >= 30 ? 'var(--green)' : margePct >= 15 ? 'var(--orange)' : 'var(--red)';
    const marginBg    = margePct >= 30 ? '#ECFDF5'       : margePct >= 15 ? '#FFFBEB'       : '#FEF2F2';

    el.innerHTML = `
      <!-- Marge réelle -->
      <div style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:9px;
        margin-bottom:12px;
      ">
        <div style="background:#EFF6FF;border-radius:16px;padding:14px;text-align:center;">
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:var(--blue);line-height:1;margin-bottom:4px;">
            ${caTotal.toLocaleString('fr-FR')} F
          </div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);">💰 CA encaissé</div>
        </div>
        <div style="background:#FEF2F2;border-radius:16px;padding:14px;text-align:center;">
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:var(--red);line-height:1;margin-bottom:4px;">
            ${coutAchat.toLocaleString('fr-FR')} F
          </div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);">💸 Coût d'achat</div>
        </div>
      </div>

      <!-- Marge brute (pleine largeur) -->
      <div style="
        background:${marginBg};
        border-radius:16px;
        padding:16px;
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:12px;
        border:1.5px solid ${marginColor}40;
      ">
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;">
            📊 Marge brute
          </div>
          <div style="font-size:11px;color:var(--muted);">CA – coût d'achat</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:'Sora',sans-serif;font-size:22px;font-weight:800;color:${marginColor};">
            ${margeBrute.toLocaleString('fr-FR')} F
          </div>
          <div style="
            display:inline-block;
            background:${marginColor};
            color:#fff;
            padding:3px 10px;
            border-radius:999px;
            font-family:'Sora',sans-serif;
            font-size:12px;
            font-weight:800;
            margin-top:4px;
          ">
            ${margePct}%
          </div>
        </div>
      </div>

      <!-- Barre de progression marge -->
      <div style="background:#F3F4F6;border-radius:999px;height:8px;overflow:hidden;margin-bottom:6px;">
        <div style="
          height:100%;
          width:${Math.min(Number(margePct), 100)}%;
          background:${marginColor};
          border-radius:999px;
          transition:width .8s cubic-bezier(.34,1.2,.64,1);
        "></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);font-weight:600;margin-bottom:${capitalImmob > 0 ? '14px' : '0'};">
        <span>0%</span>
        <span style="color:var(--orange);">15% Acceptable</span>
        <span style="color:var(--green);">30% Bon</span>
      </div>

      <!-- Capital immobilisé (si des commandes en attente) -->
      ${capitalImmob > 0 ? `
        <div style="
          background:#FFFBEB;
          border:1.5px solid #F59E0B;
          border-radius:14px;
          padding:12px 16px;
          display:flex;
          justify-content:space-between;
          align-items:center;
        ">
          <div>
            <div style="font-size:13px;font-weight:700;color:#92400E;">⏳ Capital immobilisé</div>
            <div style="font-size:11px;color:#B45309;margin-top:2px;">Commandes en attente de réception</div>
          </div>
          <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:var(--orange);">
            ${capitalImmob.toLocaleString('fr-FR')} F
          </div>
        </div>
      ` : ''}
    `;
  }

  // ════════════════════════════════════════
  // BLOC 2 — COMMANDES EN ATTENTE
  // ════════════════════════════════════════
  function renderCommandesEnAttente() {
    const el = document.getElementById('rp-commandes');
    if (!el) return;

    const pending = (commandesCache || [])
      .filter(c => c.status === 'en_attente' || c.status === 'confirmee')
      .sort((a, b) => new Date(a.expected_date || a.created_at) - new Date(b.expected_date || b.created_at));

    if (!pending.length) {
      el.innerHTML = `
        <div style="text-align:center;padding:20px;color:var(--muted);">
          <div style="font-size:32px;margin-bottom:6px;">✅</div>
          <div style="font-size:13px;font-weight:600;">Aucune commande en attente</div>
        </div>
      `;
      return;
    }

    const total = pending.reduce((s, c) => s + Number(c.total || 0), 0);

    el.innerHTML = `
      <!-- Total -->
      <div style="
        background:linear-gradient(135deg,#EDE9FE,#FCE7F3);
        border-radius:14px;
        padding:12px 16px;
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:12px;
      ">
        <div style="font-size:13px;font-weight:700;color:var(--primary-dark,#5B21B6);">
          📦 ${pending.length} commande${pending.length > 1 ? 's' : ''} en attente
        </div>
        <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:var(--primary,#7C3AED);">
          ${total.toLocaleString('fr-FR')} F
        </div>
      </div>

      <!-- Liste -->
      ${pending.map(c => {
        const expected = c.expected_date
          ? new Date(c.expected_date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' })
          : null;
        const isLate = c.expected_date && new Date(c.expected_date) < new Date();
        const statusColors = {
          en_attente: { bg: '#FEF3C7', color: '#92400E', label: '⏳ En attente' },
          confirmee:  { bg: '#EFF6FF', color: '#1E40AF', label: '✅ Confirmée' },
        };
        const sc = statusColors[c.status] || statusColors.en_attente;

        return `
          <div style="
            background:var(--surface,#fff);
            border-radius:14px;
            padding:12px 14px;
            margin-bottom:8px;
            display:flex;
            align-items:center;
            gap:10px;
            box-shadow:0 1px 8px rgba(0,0,0,.05);
            ${isLate ? 'border-left:3px solid var(--red,#EF4444);' : ''}
          ">
            <div style="flex:1;min-width:0;">
              <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:var(--text,#1E1B4B);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${c.fournisseur_name || '— Sans fournisseur'}
              </div>
              <div style="font-size:11px;color:var(--muted,#6B7280);margin-top:2px;">
                ${expected
                  ? `🎯 Prévue le ${expected}${isLate ? ' <span style="color:var(--red,#EF4444);font-weight:700;">· En retard</span>' : ''}`
                  : 'Pas de date prévue'
                }
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:var(--primary,#7C3AED);">
                ${Number(c.total || 0).toLocaleString('fr-FR')} F
              </div>
              <div style="
                display:inline-block;
                background:${sc.bg};
                color:${sc.color};
                padding:2px 8px;
                border-radius:999px;
                font-size:10px;
                font-weight:700;
                margin-top:3px;
              ">${sc.label}</div>
            </div>
          </div>
        `;
      }).join('')}

      <!-- CTA -->
      <button
        onclick="window.navTo?.('commandes')"
        style="
          width:100%;
          margin-top:4px;
          padding:10px;
          background:var(--bg,#F5F3FF);
          border:1.5px solid rgba(124,58,237,.15);
          border-radius:12px;
          font-family:'Sora',sans-serif;
          font-size:13px;
          font-weight:700;
          color:var(--primary,#7C3AED);
          cursor:pointer;
        ">
        📦 Gérer les commandes →
      </button>
    `;
  }

  // ════════════════════════════════════════
  // BLOC 3 — TOP CLIENTS PAR CA
  // ════════════════════════════════════════
  function renderTopClients() {
    const el = document.getElementById('rp-top-clients');
    if (!el) return;

    const ventes = window.appData?.ventes || [];

    // Agréger par client_name
    const clientMap = {};
    ventes
      .filter(v => v.paid && v.client_name)
      .forEach(v => {
        const name = v.client_name.trim();
        if (!clientMap[name]) {
          clientMap[name] = { name, ca: 0, nbAchats: 0, phone: v.client_phone || '' };
        }
        clientMap[name].ca       += v.total || 0;
        clientMap[name].nbAchats += 1;
      });

    const top = Object.values(clientMap)
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 8);

    if (!top.length) {
      // Essayer depuis la base clients
      const fromBase = (clientsCache || [])
        .filter(c => Number(c.total_achats) > 0)
        .sort((a, b) => Number(b.total_achats) - Number(a.total_achats))
        .slice(0, 8);

      if (!fromBase.length) {
        el.innerHTML = `
          <div style="text-align:center;padding:20px;color:var(--muted,#6B7280);">
            <div style="font-size:32px;margin-bottom:6px;">👥</div>
            <div style="font-size:13px;font-weight:600;">Aucun achat client enregistré</div>
          </div>
        `;
        return;
      }

      // Afficher depuis la base
      renderTopClientsFromBase(el, fromBase);
      return;
    }

    const maxCA = top[0].ca;

    el.innerHTML = top.map((c, i) => {
      const pct      = maxCA > 0 ? (c.ca / maxCA) * 100 : 0;
      const initials = c.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const medals   = ['🥇', '🥈', '🥉'];
      const rankIcon = medals[i] || `${i + 1}.`;

      return `
        <div style="
          display:flex;
          align-items:center;
          gap:10px;
          padding:10px 0;
          border-bottom:1px solid #F3F4F6;
        ">
          <!-- Rang -->
          <div style="font-size:16px;width:24px;text-align:center;flex-shrink:0;">${rankIcon}</div>

          <!-- Avatar -->
          <div style="
            width:36px; height:36px;
            border-radius:11px;
            background:linear-gradient(135deg,#7C3AED,#EC4899);
            color:#fff;
            font-family:'Sora',sans-serif;
            font-size:13px;
            font-weight:700;
            display:flex;
            align-items:center;
            justify-content:center;
            flex-shrink:0;
          ">${initials}</div>

          <!-- Info -->
          <div style="flex:1;min-width:0;">
            <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:var(--text,#1E1B4B);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${c.name}
            </div>
            <!-- Barre relative -->
            <div style="background:#F3F4F6;border-radius:999px;height:4px;margin-top:5px;overflow:hidden;">
              <div style="
                height:100%;
                width:${pct}%;
                background:linear-gradient(90deg,#7C3AED,#EC4899);
                border-radius:999px;
                transition:width .6s ease;
              "></div>
            </div>
          </div>

          <!-- CA -->
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:var(--primary,#7C3AED);">
              ${c.ca.toLocaleString('fr-FR')} F
            </div>
            <div style="font-size:11px;color:var(--muted,#6B7280);">${c.nbAchats} achat${c.nbAchats > 1 ? 's' : ''}</div>
          </div>
        </div>
      `;
    }).join('');

    // CTA
    el.innerHTML += `
      <button
        onclick="window.navTo?.('clients')"
        style="
          width:100%;
          margin-top:8px;
          padding:10px;
          background:var(--bg,#F5F3FF);
          border:1.5px solid rgba(124,58,237,.15);
          border-radius:12px;
          font-family:'Sora',sans-serif;
          font-size:13px;
          font-weight:700;
          color:var(--primary,#7C3AED);
          cursor:pointer;
        ">
        👥 Voir tous les clients →
      </button>
    `;
  }

  function renderTopClientsFromBase(el, clients) {
    const maxCA = Number(clients[0].total_achats) || 1;
    el.innerHTML = clients.map((c, i) => {
      const pct      = (Number(c.total_achats) / maxCA) * 100;
      const initials = (c.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const medals   = ['🥇', '🥈', '🥉'];
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F3F4F6;">
          <div style="font-size:16px;width:24px;text-align:center;flex-shrink:0;">${medals[i] || (i + 1) + '.'}</div>
          <div style="width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,#7C3AED,#EC4899);color:#fff;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initials}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:var(--text,#1E1B4B);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.name}</div>
            <div style="background:#F3F4F6;border-radius:999px;height:4px;margin-top:5px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#7C3AED,#EC4899);border-radius:999px;"></div>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:var(--primary,#7C3AED);">${Number(c.total_achats).toLocaleString('fr-FR')} F</div>
            <div style="font-size:11px;color:var(--muted,#6B7280);">${c.nb_achats || 0} achat${c.nb_achats > 1 ? 's' : ''}</div>
          </div>
        </div>
      `;
    }).join('') + `
      <button onclick="window.navTo?.('clients')" style="width:100%;margin-top:8px;padding:10px;background:var(--bg,#F5F3FF);border:1.5px solid rgba(124,58,237,.15);border-radius:12px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:var(--primary,#7C3AED);cursor:pointer;">
        👥 Voir tous les clients →
      </button>
    `;
  }

  // ════════════════════════════════════════
  // INJECTION DES 3 BLOCS
  // ════════════════════════════════════════
  function injectBlocks() {
    const container = document.getElementById('rapports-plus-container');
    if (!container) return;
    if (container._injected) return;
    container._injected = true;

    container.innerHTML = `
      <!-- Bloc 1 : Tableau de bord financier -->
      <div class="card" style="margin-top:0;">
        <div class="card-title">💡 Rentabilité</div>
        <div id="rp-financial"></div>
      </div>

      <!-- Bloc 2 : Commandes en attente -->
      <div class="card">
        <div class="card-title">📦 Commandes en attente</div>
        <div id="rp-commandes"></div>
      </div>

      <!-- Bloc 3 : Top clients -->
      <div class="card">
        <div class="card-title">🏆 Top clients</div>
        <div id="rp-top-clients"></div>
      </div>
    `;
  }

  // ════════════════════════════════════════
  // REFRESH COMPLET
  // ════════════════════════════════════════
  async function refresh() {
    ensureContainer();
    injectBlocks();
    await fetchExternal();
    renderFinancialDashboard();
    renderCommandesEnAttente();
    renderTopClients();
  }

  // ════════════════════════════════════════
  // OBSERVER afficherRapports() via DOM
  // Déclenché quand #recettesTout change
  // ════════════════════════════════════════
  function watchRapports() {
    const el = document.getElementById('recettesTout');
    if (!el) return;

    let lastText = '';
    const observer = new MutationObserver(() => {
      const t = el.textContent;
      if (t === lastText) return;
      lastText = t;

      // Seulement si la section Chiffres est visible
      const section = document.getElementById('rapportsSection');
      if (!section || section.classList.contains('hidden')) return;

      // Délai pour laisser rapports.js finir
      setTimeout(refresh, 400);
    });

    observer.observe(el, { characterData: true, childList: true, subtree: true });
  }

  // Rafraîchir aussi à chaque navigation vers Chiffres
  function watchPageChange() {
    window.addEventListener('pageChange', e => {
      if (e.detail?.key === 'rapports' || e.detail?.section === 'rapportsSection') {
        setTimeout(refresh, 500);
      }
    });

    // Compat showSection
    const origShow = window.showSection;
    if (typeof origShow === 'function') {
      window.showSection = function (section) {
        origShow(section);
        if (section === 'rapports') setTimeout(refresh, 500);
      };
    }
  }

  // ════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════
  function init() {
    watchRapports();
    watchPageChange();

    // Premier rendu si la section est déjà visible
    const section = document.getElementById('rapportsSection');
    if (section && !section.classList.contains('hidden')) {
      setTimeout(refresh, 800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
