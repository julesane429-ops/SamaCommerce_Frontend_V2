/**
 * inapp-notifications.js — Cloche de notifications in-app
 *
 * Affiche dans le header une cloche avec badge rouge.
 * Notifications gérées :
 *   - Crédits en retard (échéance dépassée, non soldés)
 *   - Stock faible (< seuil configuré)
 *   - Abonnement expirant (≤ 7 jours) ou expiré
 *   - Nouvelles ventes sur autre appareil (via realtime-sync)
 *
 * INTÉGRATION : <script src="js/inapp-notifications.js"></script>
 *   (doit être après subscription-guard.js et api.js)
 */

(function () {

  const API    = () => document.querySelector('meta[name="api-base"]')?.content
                    || 'https://samacommerce-backend-v2.onrender.com';
  const auth   = (url, o={}) => window.authfetch?.(url, o);
  const notify = (m, t) => window.showNotification?.(m, t);

  let _notifs   = [];
  let _unread   = 0;
  let _panelOpen = false;

  // ══════════════════════════════════════
  // COLLECTE DES NOTIFICATIONS
  // ══════════════════════════════════════
  async function collectNotifications() {
    const items = [];
    const now   = new Date();
    const data  = window.appData;

    if (!data) return items;

    // ── 1. Crédits en retard ──
    const credits = (data.credits || data.ventes?.filter(v => {
      const pm = (v.payment_method || '').toLowerCase().trim();
      return pm === 'credit' || pm === 'crédit';
    }) || []).filter(c => !c.paid);

    credits.forEach(c => {
      if (!c.due_date) return;
      const due      = new Date(c.due_date);
      const daysLate = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
      if (daysLate > 0) {
        items.push({
          id:       `credit-${c.id}`,
          type:     'credit',
          icon:     '💳',
          title:    'Crédit en retard',
          body:     `${c.client_name || 'Client'} — ${(c.total || 0).toLocaleString('fr-FR')} F (${daysLate}j de retard)`,
          priority: daysLate > 7 ? 'high' : 'medium',
          ts:       due.getTime(),
          action:   () => window.navTo?.('credits'),
        });
      }
    });

    // ── 2. Stock faible ──
    const LOW_STOCK = 3;
    (data.produits || []).forEach(p => {
      const stock = parseInt(p.stock) || 0;
      if (stock > 0 && stock <= LOW_STOCK) {
        items.push({
          id:       `stock-${p.id}`,
          type:     'stock',
          icon:     '📦',
          title:    'Stock faible',
          body:     `${p.name} — ${stock} unité${stock > 1 ? 's' : ''} restante${stock > 1 ? 's' : ''}`,
          priority: stock <= 1 ? 'high' : 'medium',
          ts:       Date.now(),
          action:   () => window.navTo?.('stock'),
        });
      }
    });

    // ── 3. Abonnement ──
    const state = window._subscriptionState;
    if (state) {
      if (state.isExpired) {
        items.push({
          id:       'sub-expired',
          type:     'subscription',
          icon:     '❌',
          title:    'Abonnement expiré',
          body:     'Renouvelez pour débloquer toutes les fonctionnalités.',
          priority: 'high',
          ts:       Date.now(),
          action:   () => window.showModalById?.('premiumModal'),
        });
      } else if (state.isPaid && state.daysLeft !== null && state.daysLeft <= 7) {
        items.push({
          id:       'sub-expiring',
          type:     'subscription',
          icon:     '⏳',
          title:    `Abonnement expire dans ${state.daysLeft}j`,
          body:     'Renouvelez maintenant pour éviter toute interruption.',
          priority: state.daysLeft <= 3 ? 'high' : 'medium',
          ts:       Date.now(),
          action:   () => window.showModalById?.('premiumModal'),
        });
      }
    }

    // Trier par priorité puis date
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => (priorityOrder[a.priority] - priorityOrder[b.priority]) || (b.ts - a.ts));

    return items;
  }

  // ══════════════════════════════════════
  // RENDU DU PANNEAU
  // ══════════════════════════════════════
  function renderPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;

    if (!_notifs.length) {
      panel.innerHTML = `
        <div style="text-align:center;padding:28px 16px;color:#9CA3AF;">
          <div style="font-size:36px;margin-bottom:10px;">✅</div>
          <div style="font-size:13px;font-weight:600;">Tout est à jour !</div>
          <div style="font-size:12px;margin-top:4px;">Aucune notification en attente.</div>
        </div>`;
      return;
    }

    panel.innerHTML = _notifs.map(n => {
      const colors = {
        credit:       { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' },
        stock:        { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
        subscription: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF' },
      };
      const c = colors[n.type] || { bg: '#F9FAFB', border: '#E5E7EB', text: '#374151' };
      return `
        <div onclick="window._notifAction('${n.id}')"
          style="padding:12px 14px;border-bottom:1px solid #F3F4F6;cursor:pointer;display:flex;gap:10px;align-items:flex-start;
                 ${n.priority==='high' ? `background:${c.bg};` : ''}
                 transition:background .12s;"
          onmouseover="this.style.background='#F9FAFB'" onmouseout="this.style.background='${n.priority==='high'?c.bg:''}'">
          <div style="font-size:20px;flex-shrink:0;margin-top:1px;">${n.icon}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:13px;color:${c.text};">${n.title}</div>
            <div style="font-size:12px;color:#6B7280;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${n.body}</div>
          </div>
          ${n.priority==='high' ? `<div style="width:8px;height:8px;background:#EF4444;border-radius:50%;flex-shrink:0;margin-top:5px;"></div>` : ''}
        </div>`;
    }).join('');
  }

  // ══════════════════════════════════════
  // MISE À JOUR DU BADGE
  // ══════════════════════════════════════
  function updateBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const high = _notifs.filter(n => n.priority === 'high').length;
    const count = _notifs.length;
    if (count === 0) {
      badge.style.display = 'none';
    } else {
      badge.style.display = 'flex';
      badge.textContent   = count > 9 ? '9+' : String(count);
      badge.style.background = high > 0 ? '#EF4444' : '#F59E0B';
    }
  }

  // ══════════════════════════════════════
  // INJECTION DE LA CLOCHE DANS LE HEADER
  // ══════════════════════════════════════
  function injectBell() {
    if (document.getElementById('notif-bell')) return;

    // Trouver le header
    const headerInner = document.querySelector('.header-inner, .top-header, header');
    if (!headerInner) { setTimeout(injectBell, 500); return; }

    // Cloche
    const bell = document.createElement('div');
    bell.id = 'notif-bell';
    bell.style.cssText = `
      position: relative; cursor: pointer;
      width: 38px; height: 38px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 11px; background: rgba(255,255,255,.15);
      flex-shrink: 0;
      transition: background .15s;
    `;
    bell.innerHTML = `
      <span style="font-size:19px;">🔔</span>
      <span id="notif-badge" style="
        display:none; position:absolute; top:-4px; right:-4px;
        background:#EF4444; color:#fff;
        width:18px; height:18px; border-radius:50%;
        font-size:10px; font-weight:800;
        align-items:center; justify-content:center;
        border: 2px solid #fff;
      ">0</span>`;

    bell.addEventListener('click', togglePanel);
    bell.addEventListener('mouseover', () => bell.style.background = 'rgba(255,255,255,.25)');
    bell.addEventListener('mouseout',  () => bell.style.background = 'rgba(255,255,255,.15)');

    // Injecter avant le dernier élément du header
    headerInner.appendChild(bell);

    // Panneau
    const panel = document.createElement('div');
    panel.id = 'notif-panel';
    panel.style.cssText = `
      display: none;
      position: fixed; top: 60px; right: 12px;
      width: 300px; max-height: 420px;
      background: #fff;
      border-radius: 18px;
      box-shadow: 0 8px 32px rgba(0,0,0,.18);
      z-index: 1100;
      overflow: hidden;
      border: 1px solid #E5E7EB;
    `;

    const panelHeader = document.createElement('div');
    panelHeader.style.cssText = `
      padding: 14px 16px;
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid #F3F4F6;
      background: linear-gradient(135deg, #5B21B6, #7C3AED);
    `;
    panelHeader.innerHTML = `
      <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:14px;color:#fff;">🔔 Notifications</div>
      <button onclick="window._closeNotifPanel()" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:8px;padding:3px 8px;cursor:pointer;font-size:12px;">✕</button>
    `;

    const panelBody = document.createElement('div');
    panelBody.id = 'notif-panel';  // reuse id for renderPanel
    panelBody.style.cssText = 'overflow-y:auto;max-height:360px;';

    // Rebuild panel structure
    panel.id = 'notif-panel-wrapper';
    panel.appendChild(panelHeader);
    panel.appendChild(panelBody);
    document.body.appendChild(panel);

    // Patch renderPanel to use panelBody
    const origRender = renderPanel;
    window._renderNotifPanel = () => {
      const pb = document.getElementById('notif-panel');
      if (!pb) return;
      if (!_notifs.length) {
        pb.innerHTML = `<div style="text-align:center;padding:28px 16px;color:#9CA3AF;"><div style="font-size:36px;margin-bottom:10px;">✅</div><div style="font-size:13px;font-weight:600;">Tout est à jour !</div></div>`;
        return;
      }
      const colors = {
        credit:       { bg:'#FEF2F2', text:'#991B1B' },
        stock:        { bg:'#FFFBEB', text:'#92400E' },
        subscription: { bg:'#EFF6FF', text:'#1E40AF' },
      };
      pb.innerHTML = _notifs.map(n => {
        const c = colors[n.type] || { bg:'', text:'#374151' };
        return `<div onclick="window._notifAction('${n.id}')"
          style="padding:12px 14px;border-bottom:1px solid #F3F4F6;cursor:pointer;display:flex;gap:10px;align-items:flex-start;${n.priority==='high'?`background:${c.bg};`:''}">
          <div style="font-size:20px;flex-shrink:0;">${n.icon}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:13px;color:${c.text};">${n.title}</div>
            <div style="font-size:12px;color:#6B7280;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${n.body}</div>
          </div>
          ${n.priority==='high'?`<div style="width:8px;height:8px;background:#EF4444;border-radius:50%;flex-shrink:0;margin-top:5px;"></div>`:''}
        </div>`;
      }).join('');
    };

    // Close on outside click
    document.addEventListener('click', e => {
      if (_panelOpen && !panel.contains(e.target) && e.target !== bell && !bell.contains(e.target)) {
        closePanel();
      }
    });
  }

  function togglePanel() {
    _panelOpen ? closePanel() : openPanel();
  }

  function openPanel() {
    _panelOpen = true;
    const wrapper = document.getElementById('notif-panel-wrapper');
    if (wrapper) wrapper.style.display = 'block';
    window._renderNotifPanel?.();
    // Mark as read
    _unread = 0;
  }

  function closePanel() {
    _panelOpen = false;
    const wrapper = document.getElementById('notif-panel-wrapper');
    if (wrapper) wrapper.style.display = 'none';
  }

  window._closeNotifPanel = closePanel;

  window._notifAction = (id) => {
    const n = _notifs.find(x => x.id === id);
    if (n?.action) {
      closePanel();
      n.action();
    }
  };

  // ══════════════════════════════════════
  // RAFRAÎCHISSEMENT
  // ══════════════════════════════════════
  async function refresh() {
    _notifs  = await collectNotifications();
    _unread  = _notifs.length;
    updateBadge();
    if (_panelOpen) window._renderNotifPanel?.();
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    if (!window.authfetch) { setTimeout(init, 400); return; }
    injectBell();

    // Premier refresh après chargement des données
    setTimeout(refresh, 2000);

    // Rafraîchir après chaque sync serveur
    const origSync = window.syncFromServer;
    if (typeof origSync === 'function' && !origSync._notifPatched) {
      window.syncFromServer = async function (...args) {
        const result = await origSync.apply(this, args);
        setTimeout(refresh, 300); // petit délai pour laisser appData se mettre à jour
        return result;
      };
      window.syncFromServer._notifPatched = true;
    }

    // Écouter les changements d'état d'abonnement
    const origGuardReload = window.subscriptionGuard?.reload;
    if (typeof origGuardReload === 'function') {
      window.subscriptionGuard.reload = async () => {
        await origGuardReload();
        await refresh();
      };
    }
  }

  // API publique
  window.inappNotifications = { refresh };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
