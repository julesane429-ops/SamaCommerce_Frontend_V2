/**
 * commandes.js v2 — Timeline visuelle + Gestion auto stock + Statuts
 */
(function () {
  const API    = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth   = (url, o={}) => window.authfetch(url, o);
  const notify = (m, t) => window.showNotification?.(m, t);
  const ok_    = r => { if(!r.ok) throw new Error(r.status); return r.json(); };

  let commandes    = [];
  let fournisseurs = [];
  let filterStatus = 'tous';

  const STATUS = {
    tous:       { label:'Toutes',      icon:'📋', color:'var(--primary)' },
    en_attente: { label:'En attente',  icon:'⏳', color:'#F59E0B' },
    confirmee:  { label:'Confirmées',  icon:'✅', color:'#3B82F6' },
    recue:      { label:'Reçues',      icon:'📥', color:'#10B981' },
    annulee:    { label:'Annulées',    icon:'❌', color:'#EF4444' },
  };

  // ══ TIMELINE STEPS ══
  function buildTimeline(cmd) {
    const steps = [
      { key:'created',    label:'Créée',     icon:'📝', date: cmd.created_at },
      { key:'confirmee',  label:'Confirmée', icon:'✅', date: cmd.status==='confirmee'||cmd.status==='recue' ? cmd.updated_at : null },
      { key:'recue',      label:'Reçue',     icon:'📥', date: cmd.status==='recue' ? cmd.updated_at : null },
    ];

    const current = cmd.status;
    const order   = ['created','confirmee','recue'];
    const curIdx  = order.indexOf(current==='annulee'?'created':current);

    return steps.map((s, i) => {
      let state = 'pending';
      if (i < curIdx+1 && current !== 'annulee') state = i < curIdx ? 'done' : 'active';
      if (current === 'annulee') state = i===0 ? 'error' : 'pending';
      return { ...s, state };
    });
  }

  // ══ LOAD ══
  async function loadCommandes() {
    renderSkeleton('commandesList', 3);
    try {
      const [rc, rf] = await Promise.all([
        auth(`${API()}/commandes`).then(ok_),
        auth(`${API()}/fournisseurs`).then(ok_),
      ]);
      commandes    = rc;
      fournisseurs = rf;
      window._commandesCache = commandes; // cache pour fournisseurs.js
      autoAlerts();
      renderStats();
      renderChips();
      renderList();
    } catch { notify('Erreur chargement commandes','error'); }
  }

  // ══ ALERTES AUTO ══
  function autoAlerts() {
    const container = document.getElementById('commandesAutoAlerts');
    if (!container) return;
    container.innerHTML = '';

    const now = new Date();
    const retard = commandes.filter(c => {
      if (!['en_attente','confirmee'].includes(c.status)) return false;
      return c.expected_date && new Date(c.expected_date) < now;
    });

    const enAttente = commandes.filter(c => c.status === 'en_attente');

    if (retard.length) {
      const n = document.createElement('div');
      n.className = 'auto-notif';
      n.innerHTML = `
        <div class="auto-notif-icon">🚨</div>
        <div class="auto-notif-text"><strong>${retard.length} commande${retard.length>1?'s':''}</strong> en retard — à relancer</div>
        <button class="auto-notif-close" onclick="this.closest('.auto-notif').remove()">✕</button>`;
      container.appendChild(n);
    }

    if (!retard.length && enAttente.length > 0) {
      const total = enAttente.reduce((s,c)=>s+(+c.total||0),0);
      const n = document.createElement('div');
      n.className = 'auto-notif';
      n.innerHTML = `
        <div class="auto-notif-icon">⏳</div>
        <div class="auto-notif-text">${enAttente.length} commande${enAttente.length>1?'s':''} en attente — <strong>${total.toLocaleString('fr-FR')} F</strong> à recevoir</div>
        <button class="auto-notif-close" onclick="this.closest('.auto-notif').remove()">✕</button>`;
      container.appendChild(n);
    }
  }

  // ══ STATS ══
  function renderStats() {
    const el = document.getElementById('commandesStats');
    if (!el) return;
    const total    = commandes.length;
    const enAtt    = commandes.filter(c=>c.status==='en_attente').length;
    const recues   = commandes.filter(c=>c.status==='recue').length;
    const valTotal = commandes.reduce((s,c)=>s+(+c.total||0),0);

    el.innerHTML = `
      <div class="module-stats">
        <div class="module-stat-tile" style="background:#EDE9FE;">
          <div class="msv" style="color:#7C3AED;">${total}</div>
          <div class="msl">📋 Total</div>
        </div>
        <div class="module-stat-tile" style="background:#FEF3C7;">
          <div class="msv" style="color:#D97706;">${enAtt}</div>
          <div class="msl">⏳ En attente</div>
        </div>
        <div class="module-stat-tile" style="background:#ECFDF5;">
          <div class="msv" style="color:#10B981;">${recues}</div>
          <div class="msl">📥 Reçues</div>
        </div>
        <div class="module-stat-tile" style="background:#EFF6FF;">
          <div class="msv" style="color:#3B82F6;font-size:15px;">${valTotal.toLocaleString('fr-FR')} F</div>
          <div class="msl">💸 Valeur</div>
        </div>
      </div>`;
  }

  // ══ CHIPS FILTRE ══
  function renderChips() {
    const el = document.getElementById('commandesStatusChips');
    if (!el) return;
    el.className = 'module-chips';
    el.innerHTML = Object.entries(STATUS).map(([k,v])=>`
      <button class="mod-chip ${filterStatus===k?'active':''}" data-status="${k}">${v.icon} ${v.label}</button>
    `).join('');
    el.querySelectorAll('.mod-chip').forEach(btn=>{
      btn.addEventListener('click',()=>{
        filterStatus=btn.dataset.status;
        el.querySelectorAll('.mod-chip').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        renderList();
      });
    });
  }

  // ══ LISTE CARTES ══
  function renderList() {
    const el = document.getElementById('commandesList');
    if (!el) return;

    const list = filterStatus==='tous' ? commandes : commandes.filter(c=>c.status===filterStatus);
    if (!list.length) {
      el.innerHTML = `<div class="module-empty">
        <div class="module-empty-icon">📦</div>
        <div class="module-empty-text">${filterStatus!=='tous'?'Aucune commande dans ce statut':'Aucune commande encore'}</div>
        ${filterStatus==='tous'?'<button class="btn-primary" onclick="window.openCommandeForm()">➕ Créer une commande</button>':''}
      </div>`; return;
    }

    el.innerHTML = '';
    const now = new Date();

    list.forEach(c => {
      const dateStr   = new Date(c.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'});
      const expected  = c.expected_date ? new Date(c.expected_date) : null;
      const isLate    = expected && expected < now && !['recue','annulee'].includes(c.status);
      const expStr    = expected ? expected.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}) : null;
      const steps     = buildTimeline(c);

      const card = document.createElement('div');
      card.className = `commande-card status-${c.status}`;
      card.innerHTML = `
        <!-- En-tête -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div>
            <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:var(--text);">
              🏭 ${c.fournisseur_name||'— Sans fournisseur'}
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">📅 ${dateStr}</div>
          </div>
          <span class="status-badge badge-${c.status}">${STATUS[c.status]?.icon||''} ${STATUS[c.status]?.label||c.status}</span>
        </div>

        ${isLate ? `<div style="background:#FEF2F2;border-radius:8px;padding:5px 10px;margin-bottom:8px;font-size:11px;font-weight:700;color:#DC2626;">🚨 En retard · Prévue le ${expStr}</div>` :
          expStr ? `<div style="font-size:11px;color:var(--muted);margin-bottom:8px;">🎯 Prévue le ${expStr}</div>` : ''}

        <!-- Timeline visuelle -->
        <div style="display:flex;align-items:center;gap:0;margin:10px 0 4px;">
          ${steps.map((s,i)=>`
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;position:relative;">
              ${i<steps.length-1?`<div style="position:absolute;top:13px;left:50%;right:-50%;height:2px;background:${s.state==='done'?'#10B981':'#E5E7EB'};z-index:0;"></div>`:''}
              <div style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;z-index:1;position:relative;
                background:${s.state==='done'?'#ECFDF5':s.state==='active'?'#EDE9FE':s.state==='error'?'#FEF2F2':'#F9FAFB'};
                border:2px solid ${s.state==='done'?'#10B981':s.state==='active'?'#7C3AED':s.state==='error'?'#EF4444':'#E5E7EB'};
                ${s.state==='active'?'animation:tdPulse 1.5s infinite;':''}">
                ${s.icon}
              </div>
              <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;text-align:center;color:${s.state==='done'?'#10B981':s.state==='active'?'#7C3AED':s.state==='error'?'#EF4444':'#9CA3AF'};">
                ${s.label}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Pied -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid #F3F4F6;">
          <div style="font-size:12px;color:var(--muted);">📦 ${c.nb_items||0} article${c.nb_items>1?'s':''}</div>
          <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:var(--primary);">${(+c.total||0).toLocaleString('fr-FR')} F</div>
        </div>
      `;

      card.addEventListener('click', ()=>openCommandeDetail(c.id));
      el.appendChild(card);
    });
  }

  // ══ DÉTAIL + TIMELINE COMPLÈTE ══
  async function openCommandeDetail(id) {
    let cmd = commandes.find(c=>c.id===id)||{};
    try { cmd = await auth(`${API()}/commandes/${id}`).then(ok_); } catch {}

    const steps     = buildTimeline(cmd);
    const isLate    = cmd.expected_date && new Date(cmd.expected_date)<new Date() && !['recue','annulee'].includes(cmd.status);
    const dateStr   = new Date(cmd.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});

    const bd = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">📦 Commande #${cmd.id}</div>

        <!-- Statut -->
        <div style="text-align:center;margin-bottom:16px;">
          <span class="status-badge badge-${cmd.status}" style="font-size:14px;padding:8px 18px;">
            ${STATUS[cmd.status]?.icon||''} ${STATUS[cmd.status]?.label||cmd.status}
          </span>
          ${isLate?'<div style="margin-top:6px;font-size:12px;font-weight:700;color:#DC2626;">🚨 En retard</div>':''}
        </div>

        <!-- Infos -->
        <div class="detail-panel">
          <div class="detail-row"><span class="detail-icon">🏭</span><span class="detail-label">Fournisseur</span><span class="detail-val">${cmd.fournisseur_name||'—'}</span></div>
          <div class="detail-row"><span class="detail-icon">📅</span><span class="detail-label">Créée le</span><span class="detail-val">${dateStr}</span></div>
          ${cmd.expected_date?`<div class="detail-row"><span class="detail-icon">🎯</span><span class="detail-label">Prévue le</span><span class="detail-val" style="${isLate?'color:#EF4444;font-weight:800;':''}">${new Date(cmd.expected_date).toLocaleDateString('fr-FR')}</span></div>`:''}
          ${cmd.notes?`<div class="detail-row"><span class="detail-icon">📝</span><span class="detail-label">Notes</span><span class="detail-val">${cmd.notes}</span></div>`:''}
        </div>

        <!-- Timeline verticale détaillée -->
        <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:var(--text);margin-bottom:8px;">📍 Suivi de la commande</div>
        <div class="timeline">
          ${steps.map(s=>`
            <div class="timeline-step">
              <div class="timeline-dot ${s.state}">${s.icon}</div>
              <div class="timeline-content">
                <div class="timeline-label ${s.state==='pending'?'pending':''}">${s.label}</div>
                ${s.date?`<div class="timeline-date">${new Date(s.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</div>`:'<div class="timeline-date" style="font-style:italic;">En attente...</div>'}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Articles -->
        <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:var(--text);margin-bottom:8px;">🛒 Articles</div>
        <div class="cmd-items-list">
          ${(cmd.items||[]).map(it=>`
            <div class="cmd-item-row">
              <div class="cmd-item-name">${it.product_name||'—'}</div>
              <div class="cmd-item-qty">× ${it.quantity}</div>
              <div class="cmd-item-prix">${(it.quantity*it.prix_unitaire).toLocaleString('fr-FR')} F</div>
            </div>
          `).join('')}
        </div>
        <div style="text-align:right;font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:var(--primary);margin:10px 0;">
          Total : ${(+cmd.total||0).toLocaleString('fr-FR')} F
        </div>

        <!-- Actions dynamiques -->
        <div class="action-row" id="cmd-detail-actions"></div>
        <button class="btn-cancel" style="width:100%;margin-top:10px;" id="cmd-detail-close">Fermer</button>
      </div>`;

    document.body.appendChild(bd);
    bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
    bd.querySelector('#cmd-detail-close').addEventListener('click',()=>bd.remove());

    const actEl = bd.querySelector('#cmd-detail-actions');

    if (cmd.status === 'en_attente') {
      actEl.innerHTML = `
        <button class="btn-mod btn-mod-blue" id="ca-confirm">✅ Confirmer</button>
        <button class="btn-mod btn-mod-danger" id="ca-annuler">❌ Annuler</button>`;
      actEl.querySelector('#ca-confirm').addEventListener('click',()=>changeStatus(cmd.id,'confirmee',bd));
      actEl.querySelector('#ca-annuler').addEventListener('click',()=>changeStatus(cmd.id,'annulee',bd));
    } else if (cmd.status === 'confirmee') {
      actEl.innerHTML = `
        <button class="btn-mod btn-mod-green" id="ca-receive">📥 Marquer reçue <span class="auto-tag">AUTO STOCK</span></button>
        <button class="btn-mod btn-mod-danger" id="ca-annuler2">❌ Annuler</button>`;
      actEl.querySelector('#ca-receive').addEventListener('click',()=>recevoir(cmd.id,bd));
      actEl.querySelector('#ca-annuler2').addEventListener('click',()=>changeStatus(cmd.id,'annulee',bd));
    }
  }

  async function changeStatus(id, status, bd) {
    try {
      await auth(`${API()}/commandes/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})}).then(ok_);
      notify(`✅ ${STATUS[status]?.label||status}`,'success');
      bd.remove(); loadCommandes();
    } catch { notify('Erreur mise à jour','error'); }
  }

  async function recevoir(id, bd) {
    const ok = await window.customConfirm?.('Marquer comme reçue ? Le stock sera mis à jour automatiquement.');
    if (!ok) return;
    try {
      const data = await auth(`${API()}/commandes/${id}/recevoir`,{method:'PATCH'}).then(ok_);
      notify(`📥 ${data.message||'Stock mis à jour'}`, 'success');

      // Auto-livraison + resync stock
      window.onCommandeRecue?.(id);
      await window.syncFromServer?.();
      bd.remove(); loadCommandes();
    } catch { notify('Erreur réception','error'); }
  }

  // ══ FORMULAIRE NOUVELLE COMMANDE ══
  function openCommandeForm(preselectedFournisseur=null) {
    const products = window.appData?.produits || [];
    const bd = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">📦 Nouvelle commande</div>

        <div class="form-group">
          <label>Fournisseur</label>
          <select id="cmd-fournisseur">
            <option value="">— Sans fournisseur —</option>
            ${fournisseurs.map(f=>`<option value="${f.id}" ${preselectedFournisseur?.id===f.id?'selected':''}>${f.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Date de livraison prévue</label>
          <input id="cmd-date" type="date">
        </div>

        <div class="form-group">
          <label>Produits à commander</label>
          <div class="product-picker" id="cmd-products">
            ${products.map(p=>`
              <button type="button" class="product-pick-btn" data-id="${p.id}" data-price="${p.priceAchat||0}" data-name="${p.name}">
                <div class="ppn">${p.name.length>16?p.name.slice(0,15)+'…':p.name}</div>
                <div class="ppp">${(p.priceAchat||0).toLocaleString('fr-FR')} F</div>
              </button>
            `).join('')}
          </div>
        </div>

        <div id="cmd-selected-wrap"></div>

        <div class="form-group">
          <label>Notes</label>
          <textarea id="cmd-notes" style="height:60px;resize:none;" placeholder="Notes optionnelles"></textarea>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" id="cmd-cancel">Annuler</button>
          <button class="btn-confirm" id="cmd-save">Créer la commande</button>
        </div>
      </div>`;

    document.body.appendChild(bd);
    const selectedItems = {};

    bd.querySelectorAll('.product-pick-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const id=btn.dataset.id, price=+btn.dataset.price, name=btn.dataset.name;
        if(selectedItems[id]){ delete selectedItems[id]; btn.classList.remove('selected'); }
        else { selectedItems[id]={product_id:id,quantity:1,prix_unitaire:price,name}; btn.classList.add('selected'); }
        renderSelected();
      });
    });

    function renderSelected() {
      const wrap = bd.querySelector('#cmd-selected-wrap');
      const entries = Object.entries(selectedItems);
      if (!entries.length){ wrap.innerHTML=''; return; }
      const total = entries.reduce((s,[,it])=>s+it.quantity*it.prix_unitaire,0);
      wrap.innerHTML = `
        <div class="cmd-items-list">
          ${entries.map(([id,it])=>`
            <div class="cmd-item-row">
              <div class="cmd-item-name">${it.name}</div>
              <input type="number" min="1" value="${it.quantity}" style="width:52px;padding:4px 6px;border:1.5px solid #E5E7EB;border-radius:8px;font-size:13px;text-align:center;background:var(--surface);"
                onchange="(function(v){if(window._cmdSel&&window._cmdSel['${id}'])window._cmdSel['${id}'].quantity=Math.max(1,parseInt(v)||1);document.getElementById('cmd-total-line').textContent=Object.values(window._cmdSel).reduce((s,i)=>s+i.quantity*i.prix_unitaire,0).toLocaleString('fr-FR')+' F';})(this.value)">
              <div class="cmd-item-prix">${(it.quantity*it.prix_unitaire).toLocaleString('fr-FR')} F</div>
            </div>
          `).join('')}
        </div>
        <div style="text-align:right;font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:var(--primary);margin-top:8px;">
          Total : <span id="cmd-total-line">${total.toLocaleString('fr-FR')} F</span>
        </div>`;
      window._cmdSel = selectedItems;
    }

    bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
    bd.querySelector('#cmd-cancel').addEventListener('click',()=>bd.remove());
    bd.querySelector('#cmd-save').addEventListener('click', async()=>{
      const items = Object.values(selectedItems);
      if (!items.length){ notify('Sélectionnez au moins un produit','warning'); return; }
      const body = {
        fournisseur_id: bd.querySelector('#cmd-fournisseur').value||null,
        expected_date:  bd.querySelector('#cmd-date').value||null,
        notes:          bd.querySelector('#cmd-notes').value.trim()||null,
        items,
      };
      try {
        await auth(`${API()}/commandes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(ok_);
        notify('✅ Commande créée','success'); bd.remove(); loadCommandes();
      } catch{ notify('Erreur création','error'); }
    });
  }

  function renderSkeleton(id,n){
    const el=document.getElementById(id); if(!el)return;
    el.innerHTML=Array(n).fill(`<div style="background:var(--surface);border-radius:20px;padding:16px;margin-bottom:12px;box-shadow:0 2px 16px rgba(0,0,0,.07);border-left:4px solid #E5E7EB;"><div style="display:flex;justify-content:space-between;margin-bottom:10px;"><div style="height:14px;background:#F3F4F6;border-radius:7px;width:45%;"></div><div style="height:20px;background:#F3F4F6;border-radius:999px;width:20%;"></div></div><div style="display:flex;justify-content:space-around;margin:12px 0;"><div style="width:28px;height:28px;background:#F3F4F6;border-radius:50%;"></div><div style="width:28px;height:28px;background:#F3F4F6;border-radius:50%;"></div><div style="width:28px;height:28px;background:#F3F4F6;border-radius:50%;"></div></div><div style="display:flex;justify-content:space-between;border-top:1px solid #F3F4F6;padding-top:10px;"><div style="height:12px;background:#F3F4F6;border-radius:6px;width:30%;"></div><div style="height:16px;background:#F3F4F6;border-radius:7px;width:25%;"></div></div></div>`).join('');
  }

  function initCommandesSection() {
    const sec=document.getElementById('commandesSection');
    if(!sec||sec._init)return; sec._init=true;
    document.getElementById('commandesAddBtn')?.addEventListener('click',()=>openCommandeForm());
    loadCommandes();
  }

  window.openCommandeForm     = openCommandeForm;
  window.loadCommandes        = loadCommandes;
  window.initCommandesSection = initCommandesSection;

  window.addEventListener('pageChange',e=>{if(e.detail?.key==='commandes')initCommandesSection();});
})();
