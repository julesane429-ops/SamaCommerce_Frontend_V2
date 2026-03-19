/**
 * clients.js v2 — Cartes riches + Fidélité + Crédits + Historique + Alertes auto
 */
(function () {
  const API    = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth   = (url, o={}) => window.authfetch(url, o);
  const notify = (m, t) => window.showNotification?.(m, t);
  const ok_    = r => { if(!r.ok) throw new Error(r.status); return r.json(); };

  let clients = [], searchTerm = '', sortBy = 'ca';

  // ── Fidélité ──
  function loyaltyBadge(n) {
    if (n >= 20) return { label:'🏆 VIP',      color:'#7C3AED', bg:'#EDE9FE' };
    if (n >= 10) return { label:'⭐ Fidèle',   color:'#F59E0B', bg:'#FFFBEB' };
    if (n >= 5)  return { label:'👍 Régulier', color:'#3B82F6', bg:'#EFF6FF' };
    return null;
  }

  // ── Initiales ──
  function ini(name) {
    return (name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  }

  // ══ LOAD ══
  async function loadClients() {
    renderSkeleton('clientsList', 3);
    try {
      clients = await auth(`${API()}/clients`).then(ok_);
      autoAlerts();
      renderStats();
      renderList();
    } catch { notify('Erreur chargement clients', 'error'); }
  }

  // ══ ALERTES AUTOMATIQUES ══
  function autoAlerts() {
    const credits = window.appData?.credits || [];
    const withDebt = clients.filter(c => {
      const cr = credits.filter(x => !x.paid && (x.client_name||'').toLowerCase().trim() === (c.name||'').toLowerCase().trim());
      return cr.length > 0;
    });

    const container = document.getElementById('clientsAutoAlerts');
    if (!container) return;
    container.innerHTML = '';

    if (!withDebt.length) return;

    const total = withDebt.reduce((s,c) => {
      const cr = credits.filter(x => !x.paid && (x.client_name||'').toLowerCase().trim() === (c.name||'').toLowerCase().trim());
      return s + cr.reduce((a,x) => a + (x.total||0), 0);
    }, 0);

    const notif = document.createElement('div');
    notif.className = 'auto-notif';
    notif.innerHTML = `
      <div class="auto-notif-icon">⚠️</div>
      <div class="auto-notif-text">
        <strong>${withDebt.length} client${withDebt.length>1?'s':''}</strong> avec crédits impayés
        — <strong>${total.toLocaleString('fr-FR')} F</strong> à récupérer
      </div>
      <button class="auto-notif-close" onclick="this.closest('.auto-notif').remove()">✕</button>
    `;
    container.appendChild(notif);
  }

  // ══ STATS ══
  function renderStats() {
    const el = document.getElementById('clientsStats');
    if (!el) return;
    const totalCA  = clients.reduce((s,c) => s + +c.total_achats, 0);
    const panier   = clients.length ? Math.round(totalCA / clients.length) : 0;
    const credits  = window.appData?.credits || [];
    const nbCredit = [...new Set(
      credits.filter(x=>!x.paid).map(x=>(x.client_name||'').toLowerCase().trim())
    )].filter(Boolean).length;

    el.innerHTML = `
      <div class="module-stats">
        <div class="module-stat-tile" style="background:#EDE9FE;">
          <div class="msv" style="color:#7C3AED;">${clients.length}</div>
          <div class="msl">👥 Clients</div>
        </div>
        <div class="module-stat-tile" style="background:#ECFDF5;">
          <div class="msv" style="color:#10B981;font-size:16px;">${totalCA.toLocaleString('fr-FR')} F</div>
          <div class="msl">💰 CA total</div>
        </div>
        <div class="module-stat-tile" style="background:#EFF6FF;">
          <div class="msv" style="color:#3B82F6;font-size:16px;">${panier.toLocaleString('fr-FR')} F</div>
          <div class="msl">📊 Panier moyen</div>
        </div>
        <div class="module-stat-tile" style="background:${nbCredit>0?'#FEF2F2':'#F0FDF4'};">
          <div class="msv" style="color:${nbCredit>0?'#EF4444':'#10B981'};">${nbCredit}</div>
          <div class="msl">💳 Avec crédits</div>
        </div>
      </div>`;
  }

  // ══ LISTE CARTES ══
  function renderList() {
    const el = document.getElementById('clientsList');
    if (!el) return;

    let list = clients.filter(c =>
      !searchTerm ||
      (c.name||'').toLowerCase().includes(searchTerm) ||
      (c.phone||'').includes(searchTerm)
    );
    if (sortBy==='ca')     list.sort((a,b)=>+b.total_achats - +a.total_achats);
    if (sortBy==='achats') list.sort((a,b)=>+b.nb_achats - +a.nb_achats);
    if (sortBy==='nom')    list.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    if (sortBy==='recent') list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));

    if (!list.length) {
      el.innerHTML = `<div class="module-empty">
        <div class="module-empty-icon">👥</div>
        <div class="module-empty-text">${searchTerm?'Aucun résultat':'Aucun client encore'}</div>
        ${!searchTerm?'<button class="btn-primary" onclick="window.openClientForm()">➕ Ajouter le premier client</button>':''}
      </div>`; return;
    }

    const maxCA = Math.max(...list.map(c=>+c.total_achats||0), 1);
    const credits = window.appData?.credits || [];

    el.innerHTML = '';
    list.forEach(c => {
      const ca      = +c.total_achats || 0;
      const achats  = +c.nb_achats    || 0;
      const pct     = Math.round((ca / maxCA) * 100);
      const lb      = loyaltyBadge(achats);
      const cred    = credits.filter(x => !x.paid && (x.client_name||'').toLowerCase().trim() === (c.name||'').toLowerCase().trim());
      const totalDu = cred.reduce((s,x) => s+(x.total||0), 0);

      const card = document.createElement('div');
      card.className = `entity-card${cred.length?' has-credit':''}`;

      card.innerHTML = `
        <!-- Ligne principale -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <div class="entity-avatar avatar-client">${ini(c.name)}</div>
          <div style="flex:1;min-width:0;">
            <div class="entity-name">
              ${c.name}
              ${lb ? `<span class="loyalty-badge" style="background:${lb.bg};color:${lb.color};">${lb.label}</span>` : ''}
            </div>
            <div class="entity-sub">
              ${c.phone?`📞 ${c.phone}`:''}${c.email?` · ✉️ ${c.email}`:''}${!c.phone&&!c.email?'Aucun contact':''}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div class="entity-amount">${ca.toLocaleString('fr-FR')} F</div>
            <div class="entity-count">${achats} achat${achats>1?'s':''}</div>
          </div>
        </div>

        <!-- Barre CA -->
        <div class="ca-bar-wrap"><div class="ca-bar" style="width:${pct}%"></div></div>

        <!-- Alerte crédit -->
        ${cred.length ? `
          <div class="credit-alert-row">
            <div class="credit-alert-label">⚠️ ${cred.length} crédit${cred.length>1?'s':''} impayé${cred.length>1?'s':''}</div>
            <div class="credit-alert-amount">${totalDu.toLocaleString('fr-FR')} F</div>
          </div>` : ''}

        <!-- Actions rapides -->
        <div class="entity-actions">
          ${c.phone ? `
            <button class="entity-btn eb-call" onclick="event.stopPropagation();window.open('tel:${c.phone}')">📞 Appel</button>
            <button class="entity-btn eb-wa"   onclick="event.stopPropagation();window.open('https://wa.me/${(c.phone||'').replace(/\s+/g,'')}')">💬 WhatsApp</button>
          ` : ''}
          <button class="entity-btn eb-edit" onclick="event.stopPropagation();window.openClientForm(${encodeCard(c)})">✏️ Modifier</button>
        </div>
      `;

      card.addEventListener('click', () => openClientDetail(c.id));
      el.appendChild(card);
    });
  }

  function encodeCard(c) {
    return `'${JSON.stringify(c).replace(/'/g,"\\'").replace(/"/g,"'")}'`;
  }

  // ══ FICHE DÉTAIL ══
  async function openClientDetail(id) {
    let detail = clients.find(c=>c.id===id) || {};
    try { detail = await auth(`${API()}/clients/${id}`).then(ok_); } catch {}

    const credits  = window.appData?.credits || [];
    const cred     = credits.filter(x=>(x.client_name||'').toLowerCase().trim()===(detail.name||'').toLowerCase().trim());
    const nonPayes = cred.filter(x=>!x.paid);
    const totalDu  = nonPayes.reduce((s,x)=>s+(x.total||0),0);
    const achats   = detail.achats || [];
    const lb       = loyaltyBadge(+detail.nb_achats||0);

    const bd = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>

        <!-- Hero -->
        <div class="entity-hero">
          <div class="entity-hero-avatar avatar-client">${ini(detail.name)}</div>
          <div class="entity-hero-name">
            ${detail.name}
            ${lb?`<span class="loyalty-badge" style="background:${lb.bg};color:${lb.color};">${lb.label}</span>`:''}
          </div>
          <div class="entity-hero-sub">
            ${detail.phone?`📞 ${detail.phone} `:''}${detail.email?`· ✉️ ${detail.email}`:''}
          </div>
        </div>

        <!-- Stats -->
        <div class="module-stats">
          <div class="module-stat-tile" style="background:#EDE9FE;">
            <div class="msv" style="color:#7C3AED;">${(+detail.total_achats||0).toLocaleString('fr-FR')} F</div>
            <div class="msl">💰 CA total</div>
          </div>
          <div class="module-stat-tile" style="background:#EFF6FF;">
            <div class="msv" style="color:#3B82F6;">${detail.nb_achats||0}</div>
            <div class="msl">🧾 Achats</div>
          </div>
        </div>

        <!-- Infos -->
        <div class="detail-panel">
          ${detail.phone   ? `<div class="detail-row"><span class="detail-icon">📞</span><span class="detail-label">Téléphone</span><span class="detail-val">${detail.phone}</span></div>` : ''}
          ${detail.email   ? `<div class="detail-row"><span class="detail-icon">✉️</span><span class="detail-label">Email</span><span class="detail-val">${detail.email}</span></div>` : ''}
          ${detail.address ? `<div class="detail-row"><span class="detail-icon">📍</span><span class="detail-label">Adresse</span><span class="detail-val">${detail.address}</span></div>` : ''}
          ${detail.notes   ? `<div class="detail-row"><span class="detail-icon">📝</span><span class="detail-label">Notes</span><span class="detail-val">${detail.notes}</span></div>` : ''}
          <div class="detail-row"><span class="detail-icon">📅</span><span class="detail-label">Client depuis</span><span class="detail-val">${new Date(detail.created_at).toLocaleDateString('fr-FR')}</span></div>
        </div>

        <!-- Crédits impayés -->
        ${nonPayes.length ? `
          <div style="background:#FEF2F2;border-radius:16px;padding:14px;margin-bottom:14px;border:1.5px solid #FCA5A5;">
            <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:#991B1B;margin-bottom:10px;">
              ⚠️ Crédits impayés — ${totalDu.toLocaleString('fr-FR')} F
            </div>
            ${nonPayes.map(x=>`
              <div style="background:rgba(255,255,255,.6);border-radius:10px;padding:8px 12px;margin-bottom:6px;display:flex;justify-content:space-between;">
                <div>
                  <div style="font-size:12px;font-weight:700;color:#78350F;">${x.product_name||'—'}</div>
                  <div style="font-size:11px;color:#92400E;">Échéance : ${x.due_date?new Date(x.due_date).toLocaleDateString('fr-FR'):'—'}</div>
                </div>
                <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:#EF4444;">${(x.total||0).toLocaleString('fr-FR')} F</div>
              </div>
            `).join('')}
            <button onclick="window.navTo?.('credits');this.closest('.module-sheet-backdrop')?.remove();"
              style="width:100%;margin-top:8px;padding:10px;background:#EF4444;color:#fff;border:none;border-radius:12px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">
              📝 Gérer les crédits →
            </button>
          </div>
        ` : ''}

        <!-- Historique achats -->
        ${achats.length ? `
          <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:var(--text);margin-bottom:10px;">📜 Historique des achats</div>
          <div class="history-list">
            ${achats.slice(0,8).map(a=>`
              <div class="history-item">
                <div>
                  <div class="history-item-name">${a.product_name||'—'}</div>
                  <div class="history-item-date">${a.created_at?new Date(a.created_at).toLocaleDateString('fr-FR',''):'—'} · ${a.payment_method||'—'}</div>
                </div>
                <div class="history-item-amount">${(a.total||0).toLocaleString('fr-FR')} F</div>
              </div>
            `).join('')}
          </div>
        ` : '<div style="text-align:center;color:var(--muted);padding:10px 0;font-size:13px;">Aucun achat enregistré</div>'}

        <!-- Actions -->
        <div class="action-row" style="margin-top:16px;">
          ${detail.phone ? `
            <button class="btn-mod btn-mod-blue" onclick="window.open('tel:${detail.phone}')">📞 Appeler</button>
            <button class="btn-mod btn-mod-green" onclick="window.open('https://wa.me/${(detail.phone||'').replace(/\s+/g,'')}')">💬 WhatsApp</button>
          ` : ''}
          <button class="btn-mod btn-mod-primary" id="cd-edit">✏️ Modifier</button>
          <button class="btn-mod btn-mod-danger"  id="cd-del">🗑️</button>
        </div>
        <button class="btn-cancel" style="width:100%;margin-top:10px;" id="cd-close">Fermer</button>
      </div>`;

    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if(e.target===bd) bd.remove(); });
    bd.querySelector('#cd-close').addEventListener('click', ()=>bd.remove());
    bd.querySelector('#cd-edit').addEventListener('click', ()=>{ bd.remove(); openClientForm(detail); });
    bd.querySelector('#cd-del').addEventListener('click', async () => {
      if (!await window.customConfirm?.(`Supprimer "${detail.name}" ?`)) return;
      try {
        await auth(`${API()}/clients/${detail.id}`, {method:'DELETE'}).then(ok_);
        notify('Client supprimé','success'); bd.remove(); loadClients();
      } catch { notify('Erreur suppression','error'); }
    });
  }

  // ══ FORMULAIRE ══
  function openClientForm(existing=null) {
    // Si existing est une string JSON (depuis onclick inline), parser
    if (typeof existing === 'string') {
      try { existing = JSON.parse(existing.replace(/'/g,'"')); } catch { existing = null; }
    }

    const bd = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">${existing?'✏️ Modifier client':'👤 Nouveau client'}</div>
        <div class="form-group"><label>Nom *</label><input id="cf-name" type="text" value="${existing?.name||''}" placeholder="Nom complet"></div>
        <div class="form-group"><label>Téléphone</label><input id="cf-phone" type="tel" value="${existing?.phone||''}" placeholder="+221 XX XXX XX XX"></div>
        <div class="form-group"><label>Email</label><input id="cf-email" type="email" value="${existing?.email||''}" placeholder="email@exemple.com"></div>
        <div class="form-group"><label>Adresse</label><input id="cf-address" type="text" value="${existing?.address||''}" placeholder="Adresse"></div>
        <div class="form-group"><label>Notes</label><textarea id="cf-notes" style="height:70px;resize:none;">${existing?.notes||''}</textarea></div>
        <div class="modal-actions">
          <button class="btn-cancel" id="cf-cancel">Annuler</button>
          <button class="btn-confirm" id="cf-save">${existing?'Mettre à jour':'Ajouter'}</button>
        </div>
      </div>`;

    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if(e.target===bd) bd.remove(); });
    bd.querySelector('#cf-cancel').addEventListener('click', ()=>bd.remove());
    bd.querySelector('#cf-save').addEventListener('click', async () => {
      const name = bd.querySelector('#cf-name').value.trim();
      if (!name) { notify('Le nom est requis','warning'); return; }
      const body = {
        name,
        phone:   bd.querySelector('#cf-phone').value.trim()||null,
        email:   bd.querySelector('#cf-email').value.trim()||null,
        address: bd.querySelector('#cf-address').value.trim()||null,
        notes:   bd.querySelector('#cf-notes').value.trim()||null,
      };
      try {
        await auth(existing ? `${API()}/clients/${existing.id}` : `${API()}/clients`, {
          method: existing?'PATCH':'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(body),
        }).then(ok_);
        notify(existing?'✅ Client mis à jour':'✅ Client ajouté','success');
        bd.remove(); loadClients();
      } catch { notify('Erreur sauvegarde','error'); }
    });
  }

  // ══ SKELETON ══
  function renderSkeleton(id, n) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = Array(n).fill(`
      <div style="background:var(--surface);border-radius:20px;padding:16px;margin-bottom:12px;box-shadow:0 2px 16px rgba(0,0,0,.07);">
        <div style="display:flex;gap:12px;align-items:center;">
          <div style="width:52px;height:52px;border-radius:16px;background:#F3F4F6;"></div>
          <div style="flex:1;">
            <div style="height:14px;background:#F3F4F6;border-radius:7px;margin-bottom:8px;width:60%;"></div>
            <div style="height:11px;background:#F3F4F6;border-radius:6px;width:40%;"></div>
          </div>
          <div style="text-align:right;">
            <div style="height:15px;background:#F3F4F6;border-radius:7px;width:80px;"></div>
          </div>
        </div>
        <div style="height:5px;background:#F3F4F6;border-radius:999px;margin:10px 0;"></div>
        <div style="display:flex;gap:6px;">
          <div style="flex:1;height:32px;background:#F3F4F6;border-radius:10px;"></div>
          <div style="flex:1;height:32px;background:#F3F4F6;border-radius:10px;"></div>
        </div>
      </div>`).join('');
  }

  // ══ SORT CHIPS ══
  function renderSortChips() {
    const el = document.getElementById('clientsSortChips');
    if (!el) return;
    const opts = [
      {key:'ca',     label:'💰 Par CA'},
      {key:'achats', label:'🧾 Par achats'},
      {key:'nom',    label:'🔤 Par nom'},
      {key:'recent', label:'🕒 Récents'},
    ];
    el.innerHTML = opts.map(o=>`
      <button class="mod-chip ${sortBy===o.key?'active':''}" data-sort="${o.key}">${o.label}</button>
    `).join('');
    el.querySelectorAll('.mod-chip').forEach(btn=>{
      btn.addEventListener('click',()=>{
        sortBy = btn.dataset.sort;
        el.querySelectorAll('.mod-chip').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        renderList();
      });
    });
  }

  // ══ INIT ══
  function initClientsSection() {
    const sec = document.getElementById('clientsSection');
    if (!sec || sec._init) return;
    sec._init = true;

    renderSortChips();

    const si = document.getElementById('clientsSearch');
    if (si) si.addEventListener('input', ()=>{ searchTerm=si.value.trim().toLowerCase(); renderList(); });

    document.getElementById('clientsAddBtn')?.addEventListener('click', ()=>openClientForm());
    loadClients();
  }

  // ══ EXPORTS ══
  window.openClientForm      = openClientForm;
  window.openClientDetail    = openClientDetail;
  window.loadClients         = loadClients;
  window.initClientsSection  = initClientsSection;

  window.addEventListener('pageChange', e => {
    if (e.detail?.key === 'clients') initClientsSection();
  });

})();
