/**
 * livraisons.js v2 — Barre de progression visuelle + Tracking + Gestion auto
 */
(function () {
  const API    = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth   = (url, o={}) => window.authfetch(url, o);
  const notify = (m, t) => window.showNotification?.(m, t);
  const ok_    = r => { if(!r.ok) throw new Error(r.status); return r.json(); };

  let livraisons   = [];
  let filterStatus = 'tous';

  const STATUS = {
    tous:       { label:'Toutes',      icon:'🚚', color:'var(--primary)' },
    en_attente: { label:'En attente',  icon:'⏳', color:'#F59E0B' },
    en_transit: { label:'En transit',  icon:'🚛', color:'#3B82F6' },
    livree:     { label:'Livrées',     icon:'✅', color:'#10B981' },
    probleme:   { label:'Problème',    icon:'⚠️', color:'#EF4444' },
  };

  // Ordre des étapes de progression
  const STEPS_ORDER = ['en_attente', 'en_transit', 'livree'];
  const STEPS_INFO  = {
    en_attente: { label:'En attente', icon:'⏳' },
    en_transit: { label:'En transit', icon:'🚛' },
    livree:     { label:'Livrée',     icon:'✅' },
  };

  function getStepState(stepKey, currentStatus) {
    if (currentStatus === 'probleme') {
      return stepKey === 'en_transit' ? 'error' : 'done';
    }
    const curIdx  = STEPS_ORDER.indexOf(currentStatus);
    const stepIdx = STEPS_ORDER.indexOf(stepKey);
    if (stepIdx < curIdx)  return 'done';
    if (stepIdx === curIdx) return 'active';
    return 'pending';
  }

  // ══ LOAD ══
  async function loadLivraisons() {
    renderSkeleton('livraisonsList', 3);
    try {
      livraisons = await auth(`${API()}/livraisons`).then(ok_);
      autoAlerts();
      renderStats();
      renderChips();
      renderList();
    } catch { notify('Erreur chargement livraisons','error'); }
  }

  // ══ ALERTES AUTO ══
  function autoAlerts() {
    const container = document.getElementById('livraisonsAutoAlerts');
    if (!container) return;
    container.innerHTML = '';

    const now     = new Date();
    const retard  = livraisons.filter(l => {
      if (l.status !== 'en_transit') return false;
      const jours = (now - new Date(l.created_at)) / (1000*60*60*24);
      return jours > 3;
    });
    const probleme = livraisons.filter(l => l.status === 'probleme');

    if (probleme.length) {
      const n = document.createElement('div');
      n.className = 'auto-notif';
      n.style.background = 'linear-gradient(135deg,#FEE2E2,#FEF3C7)';
      n.style.borderColor = 'rgba(239,68,68,.2)';
      n.innerHTML = `
        <div class="auto-notif-icon">⚠️</div>
        <div class="auto-notif-text" style="color:#991B1B;"><strong>${probleme.length} livraison${probleme.length>1?'s':''}</strong> avec problème — action requise</div>
        <button class="auto-notif-close" onclick="this.closest('.auto-notif').remove()">✕</button>`;
      container.appendChild(n);
    }

    if (retard.length) {
      const n = document.createElement('div');
      n.className = 'auto-notif';
      n.innerHTML = `
        <div class="auto-notif-icon">🕐</div>
        <div class="auto-notif-text"><strong>${retard.length} livraison${retard.length>1?'s':''}</strong> en transit depuis plus de 3 jours</div>
        <button class="auto-notif-close" onclick="this.closest('.auto-notif').remove()">✕</button>`;
      container.appendChild(n);
    }
  }

  // ══ STATS ══
  function renderStats() {
    const el = document.getElementById('livraisonsStats');
    if (!el) return;
    const now      = new Date();
    const enTransit = livraisons.filter(l=>l.status==='en_transit').length;
    const livrees   = livraisons.filter(l=>l.status==='livree').length;
    const problemes = livraisons.filter(l=>l.status==='probleme').length;
    const retard    = livraisons.filter(l=>l.status==='en_transit'&&(now-new Date(l.created_at))/(1000*60*60*24)>3).length;

    el.innerHTML = `
      <div class="module-stats">
        <div class="module-stat-tile" style="background:#EFF6FF;">
          <div class="msv" style="color:#3B82F6;">${enTransit}</div>
          <div class="msl">🚛 En transit</div>
        </div>
        <div class="module-stat-tile" style="background:#ECFDF5;">
          <div class="msv" style="color:#10B981;">${livrees}</div>
          <div class="msl">✅ Livrées</div>
        </div>
        <div class="module-stat-tile" style="background:${retard>0?'#FEF3C7':'#F0FDF4'};">
          <div class="msv" style="color:${retard>0?'#D97706':'#10B981'};">${retard}</div>
          <div class="msl">⏰ En retard</div>
        </div>
        <div class="module-stat-tile" style="background:${problemes>0?'#FEF2F2':'#F0FDF4'};">
          <div class="msv" style="color:${problemes>0?'#EF4444':'#10B981'};">${problemes}</div>
          <div class="msl">⚠️ Problèmes</div>
        </div>
      </div>`;
  }

  // ══ CHIPS ══
  function renderChips() {
    const el = document.getElementById('livraisonsStatusChips');
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
    const el = document.getElementById('livraisonsList');
    if (!el) return;

    const now  = new Date();
    const list = filterStatus==='tous' ? livraisons : livraisons.filter(l=>l.status===filterStatus);

    if (!list.length) {
      el.innerHTML = `<div class="module-empty">
        <div class="module-empty-icon">🚚</div>
        <div class="module-empty-text">${filterStatus!=='tous'?'Aucune livraison dans ce statut':'Aucune livraison encore'}</div>
        ${filterStatus==='tous'?'<button class="btn-primary" onclick="window.openLivraisonForm()">➕ Créer une livraison</button>':''}
      </div>`; return;
    }

    el.innerHTML = '';
    list.forEach(l => {
      const dateStr  = new Date(l.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
      const jours    = Math.floor((now - new Date(l.created_at)) / (1000*60*60*24));
      const isLate   = l.status==='en_transit' && jours>3;
      const delivStr = l.delivered_at ? new Date(l.delivered_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : null;

      const card = document.createElement('div');
      card.className = 'livraison-card';

      // Barre de progression
      const progHtml = STEPS_ORDER.map((stepKey, i) => {
        const state = l.status==='probleme' && stepKey==='en_transit' ? 'error' : getStepState(stepKey, l.status==='probleme'?'en_transit':l.status);
        const isLast = i === STEPS_ORDER.length - 1;
        return `
          <div class="liv-step ${state}" style="position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">
            ${!isLast ? `<div style="position:absolute;top:13px;left:50%;right:-50%;height:2px;background:${state==='done'?'#10B981':'#E5E7EB'};z-index:0;"></div>` : ''}
            <div class="liv-dot">${STEPS_INFO[stepKey].icon}</div>
            <div class="liv-label">${STEPS_INFO[stepKey].label}</div>
          </div>`;
      }).join('');

      card.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div>
            <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:var(--text);">
              ${l.fournisseur_name||`Livraison #${l.id}`}
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">
              📅 ${dateStr}
              ${delivStr ? ` · ✅ Livrée le ${delivStr}` : ''}
              ${isLate ? ` · <span style="color:#EF4444;font-weight:700;">⏰ ${jours}j en transit</span>` : ''}
            </div>
          </div>
          <span class="status-badge badge-${l.status}">${STATUS[l.status]?.icon||''} ${STATUS[l.status]?.label||l.status}</span>
        </div>

        <!-- Barre progression -->
        <div class="liv-progress" style="display:flex;align-items:center;">${progHtml}</div>

        ${l.tracking_note ? `<div style="font-size:12px;color:var(--muted);margin-top:8px;font-style:italic;">📝 ${l.tracking_note}</div>` : ''}
        ${l.commande_total ? `<div style="text-align:right;font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:var(--primary);margin-top:8px;">${(+l.commande_total).toLocaleString('fr-FR')} F</div>` : ''}
      `;

      card.addEventListener('click', ()=>openLivraisonDetail(l.id));
      el.appendChild(card);
    });
  }

  // ══ DÉTAIL + TIMELINE VERTICALE ══
  async function openLivraisonDetail(id) {
    let liv = livraisons.find(l=>l.id===id)||{};
    try { liv = await auth(`${API()}/livraisons/${id}`).then(ok_); } catch {}

    const now    = new Date();
    const jours  = Math.floor((now-new Date(liv.created_at))/(1000*60*60*24));
    const isLate = liv.status==='en_transit' && jours>3;

    // Steps timeline verticale enrichie
    const timelineSteps = [
      { label:'Livraison créée',   icon:'📝', state:'done', date:liv.created_at, note:'' },
      { label:'En transit',        icon:'🚛', state:getStepState('en_transit', liv.status==='probleme'?'en_transit':liv.status), date:null, note:liv.tracking_note||'' },
      { label:'Livrée',            icon:'✅', state:getStepState('livree', liv.status), date:liv.delivered_at, note:'' },
    ];
    if (liv.status==='probleme') {
      timelineSteps.splice(2,0,{label:'Problème signalé',icon:'⚠️',state:'error',date:null,note:'Action requise'});
    }

    const bd = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>

        <!-- Hero -->
        <div style="text-align:center;margin-bottom:16px;">
          <div style="font-size:44px;margin-bottom:6px;">${STATUS[liv.status]?.icon||'🚚'}</div>
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:var(--text);">Livraison #${liv.id}</div>
          <span class="status-badge badge-${liv.status}" style="margin-top:6px;display:inline-flex;font-size:13px;padding:6px 14px;">
            ${STATUS[liv.status]?.icon} ${STATUS[liv.status]?.label}
          </span>
          ${isLate?`<div style="margin-top:6px;font-size:12px;font-weight:700;color:#DC2626;">⏰ En transit depuis ${jours} jours</div>`:''}
        </div>

        <!-- Infos -->
        <div class="detail-panel">
          <div class="detail-row"><span class="detail-icon">📅</span><span class="detail-label">Créée le</span><span class="detail-val">${new Date(liv.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}</span></div>
          ${liv.fournisseur_name?`<div class="detail-row"><span class="detail-icon">🏭</span><span class="detail-label">Fournisseur</span><span class="detail-val">${liv.fournisseur_name}</span></div>`:''}
          ${liv.commande_total?`<div class="detail-row"><span class="detail-icon">💰</span><span class="detail-label">Montant</span><span class="detail-val">${(+liv.commande_total).toLocaleString('fr-FR')} F</span></div>`:''}
          ${liv.tracking_note?`<div class="detail-row"><span class="detail-icon">📝</span><span class="detail-label">Suivi</span><span class="detail-val">${liv.tracking_note}</span></div>`:''}
          ${liv.delivered_at?`<div class="detail-row"><span class="detail-icon">✅</span><span class="detail-label">Livrée le</span><span class="detail-val">${new Date(liv.delivered_at).toLocaleDateString('fr-FR')}</span></div>`:''}
        </div>

        <!-- Timeline verticale -->
        <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:var(--text);margin-bottom:8px;">📍 Suivi de la livraison</div>
        <div class="timeline">
          ${timelineSteps.map(s=>`
            <div class="timeline-step">
              <div class="timeline-dot ${s.state}">${s.icon}</div>
              <div class="timeline-content">
                <div class="timeline-label ${s.state==='pending'?'pending':''}">${s.label}</div>
                ${s.date?`<div class="timeline-date">${new Date(s.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</div>`:'<div class="timeline-date" style="font-style:italic;">En attente...</div>'}
                ${s.note?`<div class="timeline-note">${s.note}</div>`:''}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Articles de la commande liée -->
        ${(liv.items||[]).length?`
          <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:var(--text);margin-bottom:8px;">📦 Articles</div>
          <div class="cmd-items-list">
            ${liv.items.map(it=>`
              <div class="cmd-item-row">
                <div class="cmd-item-name">${it.product_name||'—'}</div>
                <div class="cmd-item-qty">× ${it.quantity}</div>
                <div class="cmd-item-prix">${(it.quantity*it.prix_unitaire).toLocaleString('fr-FR')} F</div>
              </div>
            `).join('')}
          </div>
        `:''}

        <!-- Transitions de statut -->
        <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:var(--text);margin:14px 0 8px;">🔄 Mettre à jour le statut</div>
        <div class="action-row" style="flex-wrap:wrap;">
          ${Object.entries(STATUS).filter(([k])=>k!=='tous'&&k!==liv.status).map(([k,v])=>`
            <button class="btn-mod btn-mod-blue status-change-btn" data-status="${k}">${v.icon} ${v.label}</button>
          `).join('')}
        </div>

        <!-- Note de tracking -->
        <div class="form-group" style="margin-top:12px;">
          <label>Mettre à jour la note de suivi</label>
          <input type="text" id="ld-tracking" value="${liv.tracking_note||''}" placeholder="Ex: DHL — n° suivi : 12345">
        </div>
        <button class="btn-mod btn-mod-primary" id="ld-save-note" style="width:100%;margin-bottom:10px;">💾 Enregistrer la note</button>

        <button class="btn-cancel" style="width:100%;" id="ld-close">Fermer</button>
      </div>`;

    document.body.appendChild(bd);
    bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
    bd.querySelector('#ld-close').addEventListener('click',()=>bd.remove());

    // Changer statut
    bd.querySelectorAll('.status-change-btn').forEach(btn=>{
      btn.addEventListener('click', async()=>{
        const newStatus = btn.dataset.status;
        const body = {status:newStatus};
        if (newStatus==='livree') body.delivered_at = new Date().toISOString();
        try {
          await auth(`${API()}/livraisons/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(ok_);
          notify(`✅ Livraison : ${STATUS[newStatus]?.label}`,'success');
          bd.remove(); loadLivraisons();
        } catch { notify('Erreur mise à jour','error'); }
      });
    });

    // Sauvegarder note
    bd.querySelector('#ld-save-note').addEventListener('click', async()=>{
      const note = bd.querySelector('#ld-tracking').value.trim();
      try {
        await auth(`${API()}/livraisons/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({tracking_note:note})}).then(ok_);
        notify('📝 Note mise à jour','success');
        // Mettre à jour dans le cache local
        const idx = livraisons.findIndex(l=>l.id===id);
        if (idx>=0) livraisons[idx].tracking_note = note;
        renderList();
      } catch { notify('Erreur','error'); }
    });
  }

  // ══ FORMULAIRE NOUVELLE LIVRAISON ══
  async function openLivraisonForm(preselectedCommande=null) {
    let cmdOptions = [];
    try {
      const all = await auth(`${API()}/commandes`).then(ok_);
      cmdOptions = all.filter(c=>['en_attente','confirmee'].includes(c.status));
    } catch {}

    const bd = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">🚚 Nouvelle livraison</div>
        <div class="form-group">
          <label>Commande liée (optionnel)</label>
          <select id="lf-commande">
            <option value="">— Livraison sans commande —</option>
            ${cmdOptions.map(c=>`
              <option value="${c.id}" ${preselectedCommande?.id===c.id?'selected':''}>
                #${c.id} — ${c.fournisseur_name||'Sans fournisseur'} — ${(+c.total||0).toLocaleString('fr-FR')} F
              </option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Note de suivi / Transporteur</label>
          <textarea id="lf-note" style="height:70px;resize:none;" placeholder="Ex: DHL — n° suivi : 123456..."></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" id="lf-cancel">Annuler</button>
          <button class="btn-confirm" id="lf-save">Créer la livraison</button>
        </div>
      </div>`;

    document.body.appendChild(bd);
    bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
    bd.querySelector('#lf-cancel').addEventListener('click',()=>bd.remove());
    bd.querySelector('#lf-save').addEventListener('click', async()=>{
      const body = {
        commande_id:   bd.querySelector('#lf-commande').value||null,
        tracking_note: bd.querySelector('#lf-note').value.trim()||null,
      };
      try {
        await auth(`${API()}/livraisons`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(ok_);
        notify('✅ Livraison créée','success'); bd.remove(); loadLivraisons();
      } catch { notify('Erreur création','error'); }
    });
  }

  function renderSkeleton(id,n){
    const el=document.getElementById(id); if(!el)return;
    el.innerHTML=Array(n).fill(`<div style="background:var(--surface);border-radius:20px;padding:16px;margin-bottom:12px;box-shadow:0 2px 16px rgba(0,0,0,.07);"><div style="display:flex;justify-content:space-between;margin-bottom:10px;"><div><div style="height:14px;background:#F3F4F6;border-radius:7px;width:140px;margin-bottom:6px;"></div><div style="height:11px;background:#F3F4F6;border-radius:6px;width:90px;"></div></div><div style="height:22px;background:#F3F4F6;border-radius:999px;width:80px;"></div></div><div style="display:flex;justify-content:space-around;align-items:center;margin:12px 0;"><div style="width:28px;height:28px;background:#F3F4F6;border-radius:50%;"></div><div style="flex:1;height:2px;background:#F3F4F6;margin:0 4px;"></div><div style="width:28px;height:28px;background:#F3F4F6;border-radius:50%;"></div><div style="flex:1;height:2px;background:#F3F4F6;margin:0 4px;"></div><div style="width:28px;height:28px;background:#F3F4F6;border-radius:50%;"></div></div></div>`).join('');
  }

  function initLivraisonsSection() {
    const sec=document.getElementById('livraisonsSection');
    if(!sec||sec._init)return; sec._init=true;
    document.getElementById('livraisonsAddBtn')?.addEventListener('click',()=>openLivraisonForm());
    loadLivraisons();
  }

  window.openLivraisonForm     = openLivraisonForm;
  window.loadLivraisons        = loadLivraisons;
  window.initLivraisonsSection = initLivraisonsSection;

  window.addEventListener('pageChange',e=>{if(e.detail?.key==='livraisons')initLivraisonsSection();});
})();
