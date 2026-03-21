/**
 * customerOrders.js — Commandes clients
 * Flux : Reçue → Confirmée → En livraison → Livrée
 */
(function () {
  const API    = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth   = (url, o={}) => window.authfetch(url, o);
  const notify = (m,t) => window.showNotification?.(m,t);
  const ok_    = r => { if(!r.ok) throw new Error(r.status); return r.json(); };

  let orders = [], clients = [], filterStatus = 'tous';

  const STATUS = {
    tous:        { label:'Toutes',       icon:'📋', color:'var(--primary)' },
    recue:       { label:'Reçue',        icon:'📥', color:'#F59E0B' },
    confirmee:   { label:'Confirmée',    icon:'✅', color:'#3B82F6' },
    en_livraison:{ label:'En livraison', icon:'🚚', color:'#8B5CF6' },
    livree:      { label:'Livrée',       icon:'🎉', color:'#10B981' },
    annulee:     { label:'Annulée',      icon:'❌', color:'#EF4444' },
  };

  // ══ LOAD ══
  async function loadOrders() {
    renderSkeleton('customerOrdersList', 3);
    try {
      [orders, clients] = await Promise.all([
        auth(`${API()}/customer-orders`).then(ok_),
        auth(`${API()}/clients`).then(ok_).catch(()=>[]),
      ]);
      renderStats(); renderChips(); renderList();
    } catch { notify('Erreur chargement commandes','error'); }
  }

  // ══ STATS ══
  function renderStats() {
    const el = document.getElementById('customerOrdersStats');
    if (!el) return;
    const enCours  = orders.filter(o=>['recue','confirmee','en_livraison'].includes(o.status)).length;
    const livrees  = orders.filter(o=>o.status==='livree').length;
    const caTotal  = orders.filter(o=>o.status==='livree').reduce((s,o)=>s+(+o.total||0),0);
    const aEncaisser = orders.filter(o=>o.status==='livree'&&o.payment_status==='a_encaisser').reduce((s,o)=>s+(+o.total||0),0);

    el.innerHTML = `
      <div class="module-stats">
        <div class="module-stat-tile" style="background:#FEF3C7;">
          <div class="msv" style="color:#D97706;">${enCours}</div>
          <div class="msl">⏳ En cours</div>
        </div>
        <div class="module-stat-tile" style="background:#ECFDF5;">
          <div class="msv" style="color:#10B981;">${livrees}</div>
          <div class="msl">✅ Livrées</div>
        </div>
        <div class="module-stat-tile" style="background:#EDE9FE;">
          <div class="msv" style="color:#7C3AED;font-size:15px;">${caTotal.toLocaleString('fr-FR')} F</div>
          <div class="msl">💰 CA livré</div>
        </div>
        <div class="module-stat-tile" style="background:${aEncaisser>0?'#FEF2F2':'#F0FDF4'};">
          <div class="msv" style="color:${aEncaisser>0?'#EF4444':'#10B981'};font-size:15px;">${aEncaisser.toLocaleString('fr-FR')} F</div>
          <div class="msl">💳 À encaisser</div>
        </div>
      </div>`;
  }

  // ══ CHIPS ══
  function renderChips() {
    const el = document.getElementById('customerOrdersChips');
    if (!el) return;
    el.className = 'module-chips';
    el.innerHTML = Object.entries(STATUS).map(([k,v])=>
      `<button class="mod-chip ${filterStatus===k?'active':''}" data-s="${k}">${v.icon} ${v.label}</button>`
    ).join('');
    el.querySelectorAll('.mod-chip').forEach(b=>{
      b.addEventListener('click',()=>{
        filterStatus=b.dataset.s;
        el.querySelectorAll('.mod-chip').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        renderList();
      });
    });
  }

  // ══ LISTE ══
  function renderList() {
    const el = document.getElementById('customerOrdersList');
    if (!el) return;
    const list = filterStatus==='tous' ? orders : orders.filter(o=>o.status===filterStatus);

    if (!list.length) {
      el.innerHTML = `<div class="module-empty">
        <div class="module-empty-icon">📦</div>
        <div class="module-empty-text">${filterStatus!=='tous'?'Aucune commande ici':'Aucune commande client encore'}</div>
        ${filterStatus==='tous'?`<button class="btn-primary" onclick="window.openCustomerOrderForm()">➕ Nouvelle commande</button>`:''}
      </div>`; return;
    }

    el.innerHTML = '';
    list.forEach(o => {
      const s       = STATUS[o.status]||STATUS.recue;
      const dateStr = new Date(o.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
      const isPaid  = o.payment_status==='paye';

      const card = document.createElement('div');
      card.className = `commande-card status-${o.status}`;
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <div>
            <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:var(--text);">
              👤 ${o.client_name||'Client anonyme'}
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">
              📅 ${dateStr}${o.delivery_date?' · 🎯 '+new Date(o.delivery_date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}):''}
            </div>
            ${o.delivery_address?`<div style="font-size:11px;color:var(--muted);">📍 ${o.delivery_address}</div>`:''}
          </div>
          <span class="status-badge badge-${o.status}">${s.icon} ${s.label}</span>
        </div>

        <!-- Timeline 5 étapes -->
        <div style="display:flex;align-items:center;margin:10px 0 6px;">
          ${['recue','confirmee','en_livraison','livree'].map((step,i)=>{
            const idx  = ['recue','confirmee','en_livraison','livree','annulee'].indexOf(o.status);
            const sIdx = i;
            const state = o.status==='annulee'&&i===0 ? 'error'
                        : sIdx < idx ? 'done'
                        : sIdx === idx ? 'active'
                        : 'pending';
            const icons = ['📥','✅','🚚','🎉'];
            return `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;position:relative;">
                ${i<3?`<div style="position:absolute;top:12px;left:50%;right:-50%;height:2px;background:${state==='done'?'#10B981':'#E5E7EB'};z-index:0;"></div>`:''}
                <div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;z-index:1;position:relative;
                  background:${state==='done'?'#ECFDF5':state==='active'?'#EDE9FE':state==='error'?'#FEF2F2':'#F9FAFB'};
                  border:2px solid ${state==='done'?'#10B981':state==='active'?'#7C3AED':state==='error'?'#EF4444':'#E5E7EB'};
                  ${state==='active'?'animation:tdPulse 1.5s infinite;':''}">
                  ${icons[i]}
                </div>
              </div>`;
          }).join('')}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #F3F4F6;padding-top:8px;margin-top:6px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:12px;color:var(--muted);">📦 ${o.nb_items||0} article${(o.nb_items||0)>1?'s':''}</span>
            <span style="font-size:10px;padding:2px 7px;border-radius:999px;font-weight:700;
              background:${isPaid?'#ECFDF5':'#FEF3C7'};color:${isPaid?'#065F46':'#92400E'};">
              ${isPaid?'✅ Payé':'⏳ À encaisser'}
            </span>
          </div>
          <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:var(--primary);">
            ${(+o.total||0).toLocaleString('fr-FR')} F
          </div>
        </div>
      `;
      card.addEventListener('click', ()=>openOrderDetail(o.id));
      el.appendChild(card);
    });
  }

  // ══ DÉTAIL ══
  async function openOrderDetail(id) {
    let order = {};
    try { order = await auth(`${API()}/customer-orders/${id}`).then(ok_); } catch { return; }

    const s    = STATUS[order.status]||STATUS.recue;
    const bd   = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div style="text-align:center;margin-bottom:16px;">
          <div style="font-size:32px;">${s.icon}</div>
          <div style="font-family:'Sora',sans-serif;font-size:17px;font-weight:800;color:var(--text);">Commande #${order.id}</div>
          <span class="status-badge badge-${order.status}" style="margin-top:6px;display:inline-flex;">${s.icon} ${s.label}</span>
        </div>

        <!-- Infos -->
        <div class="detail-panel">
          <div class="detail-row"><span class="detail-icon">👤</span><span class="detail-label">Client</span><span class="detail-val">${order.client_name||'Anonyme'}${order.client_phone?` · ${order.client_phone}`:''}</span></div>
          ${order.delivery_address?`<div class="detail-row"><span class="detail-icon">📍</span><span class="detail-label">Adresse</span><span class="detail-val">${order.delivery_address}</span></div>`:''}
          ${order.delivery_date?`<div class="detail-row"><span class="detail-icon">🎯</span><span class="detail-label">Date souhaitée</span><span class="detail-val">${new Date(order.delivery_date).toLocaleDateString('fr-FR')}</span></div>`:''}
          <div class="detail-row"><span class="detail-icon">💳</span><span class="detail-label">Paiement</span><span class="detail-val">${order.payment_status==='paye'?'✅ Payé':'⏳ À encaisser à la livraison'}</span></div>
          ${order.notes?`<div class="detail-row"><span class="detail-icon">📝</span><span class="detail-label">Notes</span><span class="detail-val">${order.notes}</span></div>`:''}
        </div>

        <!-- Articles -->
        <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:var(--text);margin-bottom:8px;">🛒 Articles</div>
        <div class="cmd-items-list">
          ${(order.items||[]).map(it=>`
            <div class="cmd-item-row">
              ${it.image_url?`<img src="${it.image_url}" style="width:36px;height:36px;border-radius:8px;object-fit:cover;flex-shrink:0;">`:'<div style="width:36px;height:36px;border-radius:8px;background:#EDE9FE;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">📦</div>'}
              <div class="cmd-item-name">${it.product_name}</div>
              <div class="cmd-item-qty">× ${it.quantity}</div>
              <div class="cmd-item-prix">${(it.prix_unitaire*it.quantity).toLocaleString('fr-FR')} F</div>
            </div>`).join('')}
        </div>
        <div style="text-align:right;font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:var(--primary);margin:10px 0;">
          Total : ${(+order.total||0).toLocaleString('fr-FR')} F
        </div>

        <!-- Livraison liée -->
        ${order.delivery?`
          <div style="background:#EDE9FE;border-radius:14px;padding:12px;margin-bottom:14px;">
            <div style="font-family:'Sora',sans-serif;font-size:12px;font-weight:800;color:#7C3AED;margin-bottom:6px;">🚚 Livraison en cours</div>
            <div style="font-size:12px;color:#6B7280;">Statut : ${order.delivery.status||'—'} ${order.delivery.deliveryman_name?`· ${order.delivery.deliveryman_name}`:''}</div>
            ${order.delivery.tracking_note?`<div style="font-size:11px;color:#6B7280;margin-top:4px;font-style:italic;">${order.delivery.tracking_note}</div>`:''}
          </div>
        `:''}

        <!-- Actions -->
        <div class="action-row" id="order-detail-actions"></div>
        <button class="btn-cancel" style="width:100%;margin-top:10px;" id="ord-close">Fermer</button>
      </div>`;

    document.body.appendChild(bd);
    bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
    bd.querySelector('#ord-close').addEventListener('click',()=>bd.remove());

    const actEl = bd.querySelector('#order-detail-actions');

    if (order.status==='recue') {
      actEl.innerHTML = `
        <button class="btn-mod btn-mod-primary" id="oa-confirm">✅ Confirmer la commande</button>
        <button class="btn-mod btn-mod-danger"  id="oa-cancel">❌ Annuler</button>`;
      actEl.querySelector('#oa-confirm').addEventListener('click',async()=>{
        await auth(`${API()}/customer-orders/${id}/confirm`,{method:'PATCH'}).then(ok_);
        notify('✅ Commande confirmée — livraison créée automatiquement','success');
        bd.remove(); loadOrders();
      });
      actEl.querySelector('#oa-cancel').addEventListener('click',async()=>{
        if(!await window.customConfirm?.('Annuler cette commande ?')) return;
        await auth(`${API()}/customer-orders/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'annulee'})}).then(ok_);
        notify('Commande annulée','info'); bd.remove(); loadOrders();
      });
    } else if (order.client_phone) {
      // Bouton contact WhatsApp
      actEl.innerHTML = `<a href="https://wa.me/${(order.client_phone).replace(/\s+/g,'')}" target="_blank"
        class="btn-mod btn-mod-green" style="text-decoration:none;">💬 Contacter le client</a>`;
    }
  }

  // ══ FORMULAIRE ══
  function openCustomerOrderForm() {
    const products = window.appData?.produits||[];
    const bd = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">📦 Nouvelle commande client</div>

        <div class="form-group">
          <label>👤 Client</label>
          <input id="co-client-search" type="text" placeholder="Rechercher un client ou saisir un nom…" autocomplete="off">
          <div id="co-client-dropdown" style="display:none;background:var(--surface);border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.12);margin-top:4px;max-height:150px;overflow-y:auto;"></div>
          <input id="co-client-id" type="hidden">
        </div>
        <div class="form-group">
          <label>📍 Adresse de livraison</label>
          <input id="co-address" type="text" placeholder="Ex: Quartier HLM, Dakar">
        </div>
        <div class="form-group">
          <label>🎯 Date de livraison souhaitée</label>
          <input id="co-date" type="date">
        </div>
        <div class="form-group">
          <label>💳 Paiement</label>
          <select id="co-payment">
            <option value="a_encaisser">⏳ À encaisser à la livraison</option>
            <option value="paye">✅ Déjà payé</option>
          </select>
        </div>
        <div id="co-payment-method-wrap" style="display:none;" class="form-group">
          <label>Mode de paiement</label>
          <select id="co-payment-method">
            <option value="especes">💵 Espèces</option>
            <option value="wave">📱 Wave</option>
            <option value="orange">📞 Orange Money</option>
          </select>
        </div>

        <div class="form-group">
          <label>🛒 Articles commandés</label>
          <div class="product-picker" id="co-products">
            ${products.map(p=>`
              <button type="button" class="product-pick-btn" data-id="${p.id}" data-price="${p.price}" data-name="${p.name}" data-stock="${p.stock-(p.stock_reserved||0)}">
                <div class="ppn">${p.name.length>15?p.name.slice(0,14)+'…':p.name}</div>
                <div class="ppp">${(p.price||0).toLocaleString('fr-FR')} F</div>
                <div style="font-size:9px;color:var(--muted);">Dispo: ${p.stock-(p.stock_reserved||0)}</div>
              </button>`).join('')}
          </div>
        </div>
        <div id="co-selected-wrap"></div>

        <div class="form-group">
          <label>📝 Notes</label>
          <textarea id="co-notes" style="height:60px;resize:none;" placeholder="Instructions particulières…"></textarea>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" id="co-cancel">Annuler</button>
          <button class="btn-confirm" id="co-save">Créer la commande</button>
        </div>
      </div>`;

    document.body.appendChild(bd);
    bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
    bd.querySelector('#co-cancel').addEventListener('click',()=>bd.remove());

    // Afficher/cacher mode paiement
    bd.querySelector('#co-payment').addEventListener('change',function(){
      bd.querySelector('#co-payment-method-wrap').style.display = this.value==='paye'?'':'none';
    });

    // Autocomplétion client
    const search = bd.querySelector('#co-client-search');
    const dropdown = bd.querySelector('#co-client-dropdown');
    search.addEventListener('input', ()=>{
      const q = search.value.trim().toLowerCase();
      if (!q) { dropdown.style.display='none'; return; }
      const found = clients.filter(c=>(c.name||'').toLowerCase().includes(q)||(c.phone||'').includes(q)).slice(0,5);
      if (!found.length) { dropdown.style.display='none'; return; }
      dropdown.style.display='block';
      dropdown.innerHTML = found.map(c=>`
        <div style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #F3F4F6;font-size:13px;" data-id="${c.id}" data-name="${c.name}" data-phone="${c.phone||''}">
          <strong>${c.name}</strong>${c.phone?` · ${c.phone}`:''}
        </div>`).join('');
      dropdown.querySelectorAll('[data-id]').forEach(el=>{
        el.addEventListener('click',()=>{
          bd.querySelector('#co-client-id').value = el.dataset.id;
          search.value = el.dataset.name;
          dropdown.style.display='none';
        });
      });
    });

    // Sélection produits
    const selected = {};
    bd.querySelectorAll('.product-pick-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const id=btn.dataset.id, price=+btn.dataset.price, name=btn.dataset.name, stock=+btn.dataset.stock;
        if (selected[id]) { delete selected[id]; btn.classList.remove('selected'); }
        else if (stock > 0) { selected[id]={product_id:id,quantity:1,prix_unitaire:price,name,stock}; btn.classList.add('selected'); }
        else { notify(`Stock insuffisant pour ${name}`,'warning'); return; }
        renderSelected();
      });
    });

    function renderSelected() {
      const wrap = bd.querySelector('#co-selected-wrap');
      const entries = Object.entries(selected);
      if (!entries.length) { wrap.innerHTML=''; return; }
      const total = entries.reduce((s,[,i])=>s+i.quantity*i.prix_unitaire,0);
      window._coSelected = selected;
      wrap.innerHTML = `
        <div class="cmd-items-list">
          ${entries.map(([id,it])=>`
            <div class="cmd-item-row">
              <div class="cmd-item-name">${it.name}</div>
              <input type="number" min="1" max="${it.stock}" value="${it.quantity}"
                style="width:52px;padding:4px 6px;border:1.5px solid #E5E7EB;border-radius:8px;font-size:13px;text-align:center;background:var(--surface);"
                onchange="if(window._coSelected&&window._coSelected['${id}']){window._coSelected['${id}'].quantity=Math.min(${it.stock},Math.max(1,parseInt(this.value)||1));}">
              <div class="cmd-item-prix">${(it.quantity*it.prix_unitaire).toLocaleString('fr-FR')} F</div>
            </div>`).join('')}
        </div>
        <div style="text-align:right;font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:var(--primary);margin-top:8px;">
          Total : ${total.toLocaleString('fr-FR')} F
        </div>`;
    }

    bd.querySelector('#co-save').addEventListener('click',async()=>{
      const items = Object.values(window._coSelected||{});
      if (!items.length) { notify('Sélectionnez au moins un article','warning'); return; }
      const clientId = bd.querySelector('#co-client-id').value||null;
      const paymentStatus = bd.querySelector('#co-payment').value;
      const body = {
        client_id:       clientId ? parseInt(clientId) : null,
        delivery_address: bd.querySelector('#co-address').value.trim()||null,
        delivery_date:    bd.querySelector('#co-date').value||null,
        payment_status:   paymentStatus,
        payment_method:   paymentStatus==='paye' ? bd.querySelector('#co-payment-method').value : null,
        notes:            bd.querySelector('#co-notes').value.trim()||null,
        items: items.map(i=>({product_id:parseInt(i.product_id),quantity:i.quantity})),
      };
      try {
        await auth(`${API()}/customer-orders`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(ok_);
        notify('✅ Commande créée','success'); bd.remove(); loadOrders();
        delete window._coSelected;
      } catch(err) { notify(err.message==='400'?'Stock insuffisant':'Erreur création','error'); }
    });
  }

  function renderSkeleton(id,n){
    const el=document.getElementById(id); if(!el)return;
    el.innerHTML=Array(n).fill(`<div style="background:var(--surface);border-radius:20px;padding:16px;margin-bottom:12px;box-shadow:0 2px 16px rgba(0,0,0,.07);border-left:4px solid #E5E7EB;"><div style="display:flex;justify-content:space-between;margin-bottom:10px;"><div style="height:14px;background:#F3F4F6;border-radius:7px;width:45%;"></div><div style="height:20px;background:#F3F4F6;border-radius:999px;width:20%;"></div></div><div style="display:flex;justify-content:space-around;margin:12px 0;"><div style="width:24px;height:24px;background:#F3F4F6;border-radius:50%;"></div><div style="width:24px;height:24px;background:#F3F4F6;border-radius:50%;"></div><div style="width:24px;height:24px;background:#F3F4F6;border-radius:50%;"></div><div style="width:24px;height:24px;background:#F3F4F6;border-radius:50%;"></div></div></div>`).join('');
  }

  function initCustomerOrdersSection() {
    const sec=document.getElementById('customerOrdersSection');
    if(!sec||sec._init)return; sec._init=true;
    document.getElementById('customerOrdersAddBtn')?.addEventListener('click',()=>openCustomerOrderForm());
    loadOrders();
  }

  window.openCustomerOrderForm       = openCustomerOrderForm;
  window.loadCustomerOrders          = loadOrders;
  window.initCustomerOrdersSection   = initCustomerOrdersSection;
  window.addEventListener('pageChange',e=>{if(e.detail?.key==='customerOrders')initCustomerOrdersSection();});
})();
