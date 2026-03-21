/**
 * deliveries.js — Livraisons vers clients + Module Livreurs
 */

// ════════════════════════════════════════════
// MODULE LIVRAISONS
// ════════════════════════════════════════════
(function () {
  const API    = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth   = (url,o={}) => window.authfetch(url,o);
  const notify = (m,t) => window.showNotification?.(m,t);
  const ok_    = r => { if(!r.ok) throw new Error(r.status); return r.json(); };

  let livraisons=[], filterStatus='tous';

  const STATUS = {
    tous:     { label:'Toutes',    icon:'🚚', color:'var(--primary)' },
    creee:    { label:'Créée',     icon:'📋', color:'#6B7280' },
    assignee: { label:'Assignée',  icon:'🛵', color:'#F59E0B' },
    en_route: { label:'En route',  icon:'🚛', color:'#3B82F6' },
    livree:   { label:'Livrée',    icon:'✅', color:'#10B981' },
    probleme: { label:'Problème',  icon:'⚠️', color:'#EF4444' },
  };

  const STEPS = ['creee','assignee','en_route','livree'];

  async function loadLivraisons() {
    renderSkeleton('deliveriesList',3);
    try {
      livraisons = await auth(`${API()}/deliveries`).then(ok_);
      renderStats(); renderChips(); renderList();
    } catch { notify('Erreur chargement livraisons','error'); }
  }

  function renderStats() {
    const el=document.getElementById('deliveriesStats'); if(!el)return;
    const enRoute = livraisons.filter(l=>l.status==='en_route').length;
    const livrees  = livraisons.filter(l=>l.status==='livree').length;
    const problemes= livraisons.filter(l=>l.status==='probleme').length;
    const sansLivreur = livraisons.filter(l=>l.status==='creee'&&!l.deliveryman_id).length;

    el.innerHTML = `
      <div class="module-stats">
        <div class="module-stat-tile" style="background:#EFF6FF;">
          <div class="msv" style="color:#3B82F6;">${enRoute}</div>
          <div class="msl">🚛 En route</div>
        </div>
        <div class="module-stat-tile" style="background:#ECFDF5;">
          <div class="msv" style="color:#10B981;">${livrees}</div>
          <div class="msl">✅ Livrées</div>
        </div>
        <div class="module-stat-tile" style="background:${sansLivreur>0?'#FEF3C7':'#F0FDF4'};">
          <div class="msv" style="color:${sansLivreur>0?'#D97706':'#10B981'};">${sansLivreur}</div>
          <div class="msl">⏳ Sans livreur</div>
        </div>
        <div class="module-stat-tile" style="background:${problemes>0?'#FEF2F2':'#F0FDF4'};">
          <div class="msv" style="color:${problemes>0?'#EF4444':'#10B981'};">${problemes}</div>
          <div class="msl">⚠️ Problèmes</div>
        </div>
      </div>`;
  }

  function renderChips() {
    const el=document.getElementById('deliveriesChips'); if(!el)return;
    el.className='module-chips';
    el.innerHTML=Object.entries(STATUS).map(([k,v])=>
      `<button class="mod-chip ${filterStatus===k?'active':''}" data-s="${k}">${v.icon} ${v.label}</button>`
    ).join('');
    el.querySelectorAll('.mod-chip').forEach(b=>{
      b.addEventListener('click',()=>{filterStatus=b.dataset.s;el.querySelectorAll('.mod-chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderList();});
    });
  }

  function renderList() {
    const el=document.getElementById('deliveriesList'); if(!el)return;
    const list=filterStatus==='tous'?livraisons:livraisons.filter(l=>l.status===filterStatus);

    if(!list.length){
      el.innerHTML=`<div class="module-empty"><div class="module-empty-icon">🚚</div><div class="module-empty-text">${filterStatus!=='tous'?'Aucune livraison ici':'Aucune livraison en cours'}</div></div>`;
      return;
    }

    el.innerHTML='';
    list.forEach(l=>{
      const s=STATUS[l.status]||STATUS.creee;
      const dateStr=new Date(l.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
      const isProblem=l.status==='probleme';

      const card=document.createElement('div');
      card.className='livraison-card';
      card.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <div>
            <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:var(--text);">
              👤 ${l.client_name||'Client'}
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">
              📅 ${dateStr}${l.delivery_address?` · 📍 ${l.delivery_address}`:''}
            </div>
            ${l.deliveryman_name?`<div style="font-size:11px;color:var(--muted);">🛵 ${l.deliveryman_name}</div>`:'<div style="font-size:11px;color:#F59E0B;font-weight:700;">⚠️ Aucun livreur assigné</div>'}
          </div>
          <span class="status-badge badge-${l.status}">${s.icon} ${s.label}</span>
        </div>

        <!-- Barre progression -->
        <div class="liv-progress">
          ${STEPS.map((step,i)=>{
            const curIdx=STEPS.indexOf(l.status);
            const state=isProblem&&step==='en_route'?'error':i<(isProblem?2:curIdx)?'done':i===(isProblem?2:curIdx)?'active':'pending';
            const icons={'creee':'📋','assignee':'🛵','en_route':'🚛','livree':'✅'};
            return `<div class="liv-step ${state}" style="position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">
              ${i<STEPS.length-1?`<div style="position:absolute;top:13px;left:50%;right:-50%;height:2px;background:${state==='done'?'#10B981':'#E5E7EB'};z-index:0;"></div>`:''}
              <div class="liv-dot">${icons[step]||'•'}</div>
              <div class="liv-label" style="font-size:9px;text-transform:uppercase;letter-spacing:.3px;">${step.replace('_',' ')}</div>
            </div>`;
          }).join('')}
        </div>

        ${l.tracking_note?`<div style="font-size:11px;color:var(--muted);margin-top:6px;font-style:italic;">📝 ${l.tracking_note}</div>`:''}
        <div style="text-align:right;font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:var(--primary);margin-top:6px;">
          ${(+l.order_total||0).toLocaleString('fr-FR')} F
          <span style="font-size:10px;padding:2px 7px;border-radius:6px;font-weight:700;margin-left:6px;
            background:${l.payment_status==='paye'?'#ECFDF5':'#FEF3C7'};
            color:${l.payment_status==='paye'?'#065F46':'#92400E'};">
            ${l.payment_status==='paye'?'✅ Payé':'⏳ À encaisser'}
          </span>
        </div>`;

      card.addEventListener('click',()=>openDeliveryDetail(l.id));
      el.appendChild(card);
    });
  }

  async function openDeliveryDetail(id) {
    let liv={};
    try { liv=await auth(`${API()}/deliveries/${id}`).then(ok_); } catch { return; }

    // Charger les livreurs disponibles
    let deliverymen=[];
    try { deliverymen=await auth(`${API()}/deliverymen`).then(ok_); } catch {}

    const available=deliverymen.filter(d=>d.status==='disponible'||d.id===liv.deliveryman_id);

    const bd=document.createElement('div');
    bd.className='module-sheet-backdrop';
    bd.innerHTML=`
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div style="text-align:center;margin-bottom:14px;">
          <div style="font-size:32px;">${STATUS[liv.status]?.icon||'🚚'}</div>
          <div style="font-family:'Sora',sans-serif;font-size:17px;font-weight:800;color:var(--text);">Livraison #${liv.id}</div>
          <span class="status-badge badge-${liv.status}" style="display:inline-flex;margin-top:6px;">${STATUS[liv.status]?.icon} ${STATUS[liv.status]?.label}</span>
        </div>

        <div class="detail-panel">
          <div class="detail-row"><span class="detail-icon">👤</span><span class="detail-label">Client</span><span class="detail-val">${liv.client_name||'—'}${liv.client_phone?` · ${liv.client_phone}`:''}</span></div>
          ${liv.delivery_address?`<div class="detail-row"><span class="detail-icon">📍</span><span class="detail-label">Adresse</span><span class="detail-val">${liv.delivery_address}</span></div>`:''}
          <div class="detail-row"><span class="detail-icon">💰</span><span class="detail-label">Montant</span><span class="detail-val">${(+liv.order_total||0).toLocaleString('fr-FR')} F · ${liv.payment_status==='paye'?'✅ Payé':'⏳ À encaisser'}</span></div>
        </div>

        <!-- Assigner livreur -->
        ${liv.status==='creee'||liv.status==='assignee'?`
          <div class="form-group">
            <label>🛵 Assigner un livreur</label>
            <select id="del-deliveryman">
              <option value="">— Choisir un livreur —</option>
              ${available.map(d=>`<option value="${d.id}" ${d.id===liv.deliveryman_id?'selected':''}>${d.name}${d.zone?' · '+d.zone:''} · ${d.status==='disponible'?'🟢 Disponible':'🟡 En course'}</option>`).join('')}
            </select>
          </div>
          <button id="del-assign-btn" class="btn-mod btn-mod-orange" style="width:100%;margin-bottom:12px;">🛵 Assigner ce livreur</button>
        `:''}

        <!-- Articles -->
        <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:var(--text);margin-bottom:8px;">🛒 Articles</div>
        <div class="cmd-items-list">
          ${(liv.items||[]).map(it=>`
            <div class="cmd-item-row">
              <div class="cmd-item-name">${it.product_name}</div>
              <div class="cmd-item-qty">× ${it.quantity}</div>
              <div class="cmd-item-prix">${(it.prix_unitaire*it.quantity).toLocaleString('fr-FR')} F</div>
            </div>`).join('')}
        </div>

        <!-- Note de suivi -->
        <div class="form-group" style="margin-top:12px;">
          <label>📝 Note de suivi</label>
          <input id="del-note" type="text" value="${liv.tracking_note||''}" placeholder="Ex: parti à 14h30, stuck trafic...">
        </div>
        <button id="del-save-note" class="btn-mod btn-mod-blue" style="width:100%;margin-bottom:10px;">💾 Enregistrer la note</button>

        <!-- Actions selon statut -->
        <div class="action-row" style="flex-wrap:wrap;gap:8px;margin-bottom:10px;">
          ${liv.status==='assignee'?`<button class="btn-mod btn-mod-primary" id="del-depart">🚛 Marquer en route</button>`:''}
          ${liv.status==='en_route'?`<button class="btn-mod btn-mod-green" id="del-livree">✅ Marquer comme livrée</button>`:''}
          ${['creee','assignee','en_route'].includes(liv.status)?`<button class="btn-mod btn-mod-danger" id="del-probleme">⚠️ Problème</button>`:''}
          ${liv.client_phone?`<a href="https://wa.me/${liv.client_phone.replace(/\s+/g,'')}" target="_blank" class="btn-mod btn-mod-green" style="text-decoration:none;">💬 Client</a>`:''}
          ${liv.deliveryman_phone?`<a href="tel:${liv.deliveryman_phone}" class="btn-mod btn-mod-blue" style="text-decoration:none;">📞 Livreur</a>`:''}
        </div>

        <button class="btn-cancel" style="width:100%;" id="del-close">Fermer</button>
      </div>`;

    document.body.appendChild(bd);
    bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
    bd.querySelector('#del-close').addEventListener('click',()=>bd.remove());

    bd.querySelector('#del-assign-btn')?.addEventListener('click',async()=>{
      const dmId=bd.querySelector('#del-deliveryman').value;
      if(!dmId){notify('Choisissez un livreur','warning');return;}
      await auth(`${API()}/deliveries/${id}/assign`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({deliveryman_id:parseInt(dmId)})}).then(ok_);
      notify('🛵 Livreur assigné','success'); bd.remove(); loadLivraisons();
    });

    bd.querySelector('#del-save-note')?.addEventListener('click',async()=>{
      const note=bd.querySelector('#del-note').value.trim();
      await auth(`${API()}/deliveries/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({tracking_note:note})}).then(ok_);
      notify('📝 Note enregistrée','success');
    });

    bd.querySelector('#del-depart')?.addEventListener('click',async()=>{
      await auth(`${API()}/deliveries/${id}/depart`,{method:'PATCH'}).then(ok_);
      notify('🚛 En route !','success'); bd.remove(); loadLivraisons();
    });

    bd.querySelector('#del-livree')?.addEventListener('click',async()=>{
      if(!await window.customConfirm?.('Confirmer la livraison ? Le stock sera débité et la vente enregistrée.'))return;
      await auth(`${API()}/deliveries/${id}/livree`,{method:'PATCH'}).then(ok_);
      notify('✅ Livraison confirmée !','success'); bd.remove(); loadLivraisons();
      await window.syncFromServer?.();
    });

    bd.querySelector('#del-probleme')?.addEventListener('click',async()=>{
      const note=prompt('Décrire le problème :');
      if(!note)return;
      await auth(`${API()}/deliveries/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'probleme',tracking_note:note})}).then(ok_);
      notify('⚠️ Problème signalé','warning'); bd.remove(); loadLivraisons();
    });
  }

  function renderSkeleton(id,n){const el=document.getElementById(id);if(!el)return;el.innerHTML=Array(n).fill('<div style="background:var(--surface);border-radius:20px;padding:16px;margin-bottom:12px;box-shadow:0 2px 16px rgba(0,0,0,.07);"><div style="display:flex;justify-content:space-between;margin-bottom:10px;"><div><div style="height:14px;background:#F3F4F6;border-radius:7px;width:120px;margin-bottom:6px;"></div><div style="height:11px;background:#F3F4F6;border-radius:6px;width:80px;"></div></div><div style="height:22px;background:#F3F4F6;border-radius:999px;width:80px;"></div></div><div style="display:flex;justify-content:space-around;align-items:center;margin:12px 0;"><div style="width:26px;height:26px;background:#F3F4F6;border-radius:50%;"></div><div style="flex:1;height:2px;background:#F3F4F6;margin:0 4px;"></div><div style="width:26px;height:26px;background:#F3F4F6;border-radius:50%;"></div><div style="flex:1;height:2px;background:#F3F4F6;margin:0 4px;"></div><div style="width:26px;height:26px;background:#F3F4F6;border-radius:50%;"></div><div style="flex:1;height:2px;background:#F3F4F6;margin:0 4px;"></div><div style="width:26px;height:26px;background:#F3F4F6;border-radius:50%;"></div></div></div>').join('');}

  function initDeliveriesSection(){const sec=document.getElementById('deliveriesSection');if(!sec||sec._init)return;sec._init=true;document.getElementById('deliveriesAddBtn')?.addEventListener('click',()=>notify('Les livraisons sont créées automatiquement à la confirmation d\'une commande','info'));loadLivraisons();}

  window.loadDeliveries=loadLivraisons;
  window.initDeliveriesSection=initDeliveriesSection;
  window.addEventListener('pageChange',e=>{if(e.detail?.key==='deliveries')initDeliveriesSection();});
})();

// ════════════════════════════════════════════
// MODULE LIVREURS
// ════════════════════════════════════════════
(function () {
  const API    = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth   = (url,o={}) => window.authfetch(url,o);
  const notify = (m,t) => window.showNotification?.(m,t);
  const ok_    = r => { if(!r.ok) throw new Error(r.status); return r.json(); };

  let deliverymen=[];

  const STATUS_DM = {
    disponible:  { label:'Disponible', color:'#10B981', bg:'#ECFDF5' },
    en_course:   { label:'En course',  color:'#F59E0B', bg:'#FEF3C7' },
    injoignable: { label:'Injoignable',color:'#EF4444', bg:'#FEF2F2' },
  };

  async function loadDeliverymen() {
    renderSkeleton('deliverymenList',3);
    try {
      deliverymen = await auth(`${API()}/deliverymen`).then(ok_);
      renderStats(); renderList();
    } catch { notify('Erreur chargement livreurs','error'); }
  }

  function renderStats() {
    const el=document.getElementById('deliverymenStats'); if(!el)return;
    const dispos=deliverymen.filter(d=>d.status==='disponible').length;
    const enCourse=deliverymen.filter(d=>d.status==='en_course').length;
    const nbLivrees=deliverymen.reduce((s,d)=>s+(d.nb_livrees||0),0);
    el.innerHTML=`
      <div class="module-stats">
        <div class="module-stat-tile" style="background:#ECFDF5;">
          <div class="msv" style="color:#10B981;">${dispos}</div><div class="msl">🟢 Disponibles</div>
        </div>
        <div class="module-stat-tile" style="background:#FEF3C7;">
          <div class="msv" style="color:#D97706;">${enCourse}</div><div class="msl">🛵 En course</div>
        </div>
        <div class="module-stat-tile" style="background:#EDE9FE;">
          <div class="msv" style="color:#7C3AED;">${deliverymen.length}</div><div class="msl">👥 Total</div>
        </div>
        <div class="module-stat-tile" style="background:#EFF6FF;">
          <div class="msv" style="color:#3B82F6;">${nbLivrees}</div><div class="msl">✅ Livrées</div>
        </div>
      </div>`;
  }

  function renderList() {
    const el=document.getElementById('deliverymenList'); if(!el)return;
    if(!deliverymen.length){
      el.innerHTML=`<div class="module-empty"><div class="module-empty-icon">🛵</div><div class="module-empty-text">Aucun livreur encore</div><button class="btn-primary" onclick="window.openDeliverymanForm()">➕ Ajouter un livreur</button></div>`;
      return;
    }
    el.innerHTML='';
    deliverymen.forEach(d=>{
      const s=STATUS_DM[d.status]||STATUS_DM.disponible;
      const ini=(d.name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
      const card=document.createElement('div');
      card.className='entity-card';
      card.innerHTML=`
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:52px;height:52px;border-radius:16px;background:linear-gradient(135deg,#F59E0B,#D97706);color:#fff;font-family:'Sora',sans-serif;font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${ini}</div>
          <div style="flex:1;min-width:0;">
            <div class="entity-name">${d.name}</div>
            <div class="entity-sub">
              ${d.phone?`📞 ${d.phone}`:''}${d.zone?` · 📍 ${d.zone}`:''}
              ${d.tarif_livraison?` · ${(+d.tarif_livraison).toLocaleString('fr-FR')} F/livraison`:''}
            </div>
            <div style="font-size:11px;margin-top:3px;">
              ✅ ${d.nb_livrees||0} livraisons
              ${d.en_cours?` · 🚛 ${d.en_cours} en cours`:''}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <span style="background:${s.bg};color:${s.color};font-size:10px;font-weight:800;padding:4px 9px;border-radius:8px;">${s.label}</span>
          </div>
        </div>
        <div class="entity-actions" style="margin-top:10px;">
          ${d.phone?`
            <button class="entity-btn eb-call" onclick="event.stopPropagation();window.open('tel:${d.phone}')">📞 Appeler</button>
            <button class="entity-btn eb-wa"   onclick="event.stopPropagation();window.open('https://wa.me/${(d.phone||'').replace(/\s+/g,'')}')">💬 WhatsApp</button>
          `:''}
          <button class="entity-btn eb-edit" onclick="event.stopPropagation();window.openDeliverymanForm(${d.id})">✏️ Modifier</button>
        </div>`;
      card.addEventListener('click',()=>openDeliverymanDetail(d.id));
      el.appendChild(card);
    });
  }

  async function openDeliverymanDetail(id) {
    const d=deliverymen.find(x=>x.id===id)||{};
    let livraisons=[];
    try { livraisons=await auth(`${API()}/deliverymen/${id}/livraisons`).then(ok_); } catch {}

    const s=STATUS_DM[d.status]||STATUS_DM.disponible;
    const ini=(d.name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const bd=document.createElement('div');
    bd.className='module-sheet-backdrop';
    bd.innerHTML=`
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="entity-hero">
          <div class="entity-hero-avatar" style="background:linear-gradient(135deg,#F59E0B,#D97706);">${ini}</div>
          <div class="entity-hero-name">${d.name}</div>
          <div class="entity-hero-sub">${d.phone||''} ${d.zone?`· ${d.zone}`:''}</div>
          <span style="background:${s.bg};color:${s.color};font-size:11px;font-weight:800;padding:4px 12px;border-radius:8px;display:inline-block;margin-top:6px;">${s.label}</span>
        </div>

        <div class="module-stats" style="margin-bottom:14px;">
          <div class="module-stat-tile" style="background:#ECFDF5;">
            <div class="msv" style="color:#10B981;">${d.nb_livrees||0}</div><div class="msl">✅ Livrées</div>
          </div>
          <div class="module-stat-tile" style="background:#EDE9FE;">
            <div class="msv" style="color:#7C3AED;">${(+(d.tarif_livraison||0)*(d.nb_livrees||0)).toLocaleString('fr-FR')} F</div><div class="msl">💰 Gains</div>
          </div>
        </div>

        <!-- Changer statut -->
        <div class="form-group">
          <label>Statut</label>
          <select id="dm-status">
            ${Object.entries(STATUS_DM).map(([k,v])=>`<option value="${k}" ${d.status===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </div>
        <button id="dm-save-status" class="btn-mod btn-mod-primary" style="width:100%;margin-bottom:12px;">💾 Mettre à jour le statut</button>

        <!-- Historique -->
        ${livraisons.length?`
          <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:var(--text);margin-bottom:8px;">📜 Dernières livraisons</div>
          <div class="history-list">
            ${livraisons.slice(0,5).map(l=>`
              <div class="history-item">
                <div>
                  <div class="history-item-name">${l.client_name||'—'}</div>
                  <div class="history-item-date">${new Date(l.created_at).toLocaleDateString('fr-FR')} · ${l.status}</div>
                </div>
                <div class="history-item-amount">${(+l.order_total||0).toLocaleString('fr-FR')} F</div>
              </div>`).join('')}
          </div>
        `:'<div style="text-align:center;color:var(--muted);padding:10px 0;font-size:13px;">Aucune livraison encore</div>'}

        <div class="action-row" style="margin-top:14px;">
          ${d.phone?`<a href="tel:${d.phone}" class="btn-mod btn-mod-blue" style="text-decoration:none;">📞 Appeler</a>`:''}
          ${d.phone?`<a href="https://wa.me/${(d.phone||'').replace(/\s+/g,'')}" target="_blank" class="btn-mod btn-mod-green" style="text-decoration:none;">💬 WhatsApp</a>`:''}
          <button class="btn-mod btn-mod-primary" id="dm-edit">✏️ Modifier</button>
          <button class="btn-mod btn-mod-danger"  id="dm-del">🗑️</button>
        </div>
        <button class="btn-cancel" style="width:100%;margin-top:10px;" id="dm-close">Fermer</button>
      </div>`;

    document.body.appendChild(bd);
    bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
    bd.querySelector('#dm-close').addEventListener('click',()=>bd.remove());
    bd.querySelector('#dm-edit').addEventListener('click',()=>{bd.remove();openDeliverymanForm(id);});
    bd.querySelector('#dm-save-status').addEventListener('click',async()=>{
      const status=bd.querySelector('#dm-status').value;
      await auth(`${API()}/deliverymen/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})}).then(ok_);
      notify('✅ Statut mis à jour','success'); bd.remove(); loadDeliverymen();
    });
    bd.querySelector('#dm-del').addEventListener('click',async()=>{
      if(!await window.customConfirm?.(`Supprimer ${d.name} ?`))return;
      await auth(`${API()}/deliverymen/${id}`,{method:'DELETE'}).then(ok_);
      notify('Livreur supprimé','success'); bd.remove(); loadDeliverymen();
    });
  }

  function openDeliverymanForm(idOrNull=null) {
    const existing=typeof idOrNull==='number'?deliverymen.find(d=>d.id===idOrNull):null;
    const bd=document.createElement('div');
    bd.className='module-sheet-backdrop';
    bd.innerHTML=`
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">${existing?'✏️ Modifier':'🛵 Nouveau livreur'}</div>
        <div class="form-group"><label>Nom *</label><input id="dmf-name" type="text" value="${existing?.name||''}" placeholder="Nom du livreur"></div>
        <div class="form-group"><label>Téléphone</label><input id="dmf-phone" type="tel" value="${existing?.phone||''}" placeholder="+221 XX XXX XX XX"></div>
        <div class="form-group"><label>Zone de livraison</label><input id="dmf-zone" type="text" value="${existing?.zone||''}" placeholder="Ex: Dakar Plateau, HLM..."></div>
        <div class="form-group"><label>Tarif par livraison (F)</label><input id="dmf-tarif" type="number" value="${existing?.tarif_livraison||0}" min="0"></div>
        <div class="form-group"><label>Notes</label><textarea id="dmf-notes" style="height:60px;resize:none;">${existing?.notes||''}</textarea></div>
        <div class="modal-actions">
          <button class="btn-cancel" id="dmf-cancel">Annuler</button>
          <button class="btn-confirm" id="dmf-save">${existing?'Mettre à jour':'Ajouter'}</button>
        </div>
      </div>`;
    document.body.appendChild(bd);
    bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
    bd.querySelector('#dmf-cancel').addEventListener('click',()=>bd.remove());
    bd.querySelector('#dmf-save').addEventListener('click',async()=>{
      const name=bd.querySelector('#dmf-name').value.trim();
      if(!name){notify('Le nom est requis','warning');return;}
      const body={name,phone:bd.querySelector('#dmf-phone').value.trim()||null,zone:bd.querySelector('#dmf-zone').value.trim()||null,tarif_livraison:+bd.querySelector('#dmf-tarif').value||0,notes:bd.querySelector('#dmf-notes').value.trim()||null};
      await auth(existing?`${API()}/deliverymen/${existing.id}`:`${API()}/deliverymen`,{method:existing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(ok_);
      notify(existing?'✅ Mis à jour':'✅ Livreur ajouté','success');
      bd.remove(); loadDeliverymen();
    });
  }

  function renderSkeleton(id,n){const el=document.getElementById(id);if(!el)return;el.innerHTML=Array(n).fill('<div style="background:var(--surface);border-radius:20px;padding:16px;margin-bottom:12px;box-shadow:0 2px 16px rgba(0,0,0,.07);"><div style="display:flex;gap:12px;"><div style="width:52px;height:52px;border-radius:16px;background:#F3F4F6;flex-shrink:0;"></div><div style="flex:1;"><div style="height:14px;background:#F3F4F6;border-radius:7px;width:50%;margin-bottom:8px;"></div><div style="height:11px;background:#F3F4F6;border-radius:6px;width:70%;"></div></div></div></div>').join('');}

  function initDeliverymenSection(){const sec=document.getElementById('deliverymenSection');if(!sec||sec._init)return;sec._init=true;document.getElementById('deliverymenAddBtn')?.addEventListener('click',()=>openDeliverymanForm());loadDeliverymen();}

  window.openDeliverymanForm=openDeliverymanForm;
  window.loadDeliverymen=loadDeliverymen;
  window.initDeliverymenSection=initDeliverymenSection;
  window.addEventListener('pageChange',e=>{if(e.detail?.key==='deliverymen')initDeliverymenSection();});
})();
