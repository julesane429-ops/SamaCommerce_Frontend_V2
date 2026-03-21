/**
 * fournisseurs.js v2 — Cartes riches + Historique commandes + Alertes auto
 */
(function () {
  const API    = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth   = (url, o={}) => window.authfetch(url, o);
  const notify = (m, t) => window.showNotification?.(m, t);
  const ok_    = r => { if(!r.ok) throw new Error(r.status); return r.json(); };

  let fournisseurs = [], searchTerm = '', sortBy = 'total';

  function ini(name) {
    return (name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  }

  // ══ LOAD ══
  async function loadFournisseurs() {
    renderSkeleton('fournisseursList', 3);
    try {
      fournisseurs = await auth(`${API()}/fournisseurs`).then(ok_);
      autoAlerts();
      renderStats();
      renderList();
    } catch { notify('Erreur chargement fournisseurs','error'); }
  }

  // ══ ALERTES AUTO ══
  function autoAlerts() {
    const container = document.getElementById('fournisseursAutoAlerts');
    if (!container) return;
    container.innerHTML = '';

    // Alertes : fournisseurs avec commandes en retard
    // (on utilisera le cache local si dispo)
    const cmdsCache = window._commandesCache || [];
    const now = new Date();
    const retard = cmdsCache.filter(c => {
      if (!['en_attente','confirmee'].includes(c.status)) return false;
      if (!c.expected_date) return false;
      return new Date(c.expected_date) < now;
    });

    if (!retard.length) return;

    const notif = document.createElement('div');
    notif.className = 'auto-notif';
    notif.innerHTML = `
      <div class="auto-notif-icon">📦</div>
      <div class="auto-notif-text">
        <strong>${retard.length} commande${retard.length>1?'s':''}</strong> en retard de livraison
      </div>
      <button class="auto-notif-close" onclick="this.closest('.auto-notif').remove()">✕</button>
    `;
    container.appendChild(notif);
  }

  // ══ STATS ══
  function renderStats() {
    const el = document.getElementById('fournisseursStats');
    if (!el) return;
    const totalDep  = fournisseurs.reduce((s,f)=>s+ +f.total_commandes,0);
    const totalCmds = fournisseurs.reduce((s,f)=>s+ +f.nb_commandes,0);
    const moy       = fournisseurs.length ? Math.round(totalDep/fournisseurs.length) : 0;

    el.innerHTML = `
      <div class="module-stats">
        <div class="module-stat-tile" style="background:#EFF6FF;">
          <div class="msv" style="color:#3B82F6;">${fournisseurs.length}</div>
          <div class="msl">🏭 Fournisseurs</div>
        </div>
        <div class="module-stat-tile" style="background:#FEF9C3;">
          <div class="msv" style="color:#D97706;font-size:16px;">${totalDep.toLocaleString('fr-FR')} F</div>
          <div class="msl">💸 Total dépensé</div>
        </div>
        <div class="module-stat-tile" style="background:#EDE9FE;">
          <div class="msv" style="color:#7C3AED;">${totalCmds}</div>
          <div class="msl">📦 Commandes</div>
        </div>
        <div class="module-stat-tile" style="background:#ECFDF5;">
          <div class="msv" style="color:#10B981;font-size:16px;">${moy.toLocaleString('fr-FR')} F</div>
          <div class="msl">📊 Moy. commande</div>
        </div>
      </div>`;
  }

  // ══ LISTE CARTES ══
  function renderList() {
    const el = document.getElementById('fournisseursList');
    if (!el) return;

    let list = fournisseurs.filter(f =>
      !searchTerm ||
      (f.name||'').toLowerCase().includes(searchTerm) ||
      (f.phone||'').includes(searchTerm)
    );
    if (sortBy==='total')  list.sort((a,b)=>+b.total_commandes - +a.total_commandes);
    if (sortBy==='cmds')   list.sort((a,b)=>+b.nb_commandes - +a.nb_commandes);
    if (sortBy==='nom')    list.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    if (sortBy==='recent') list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));

    if (!list.length) {
      el.innerHTML = `<div class="module-empty">
        <div class="module-empty-icon">🏭</div>
        <div class="module-empty-text">${searchTerm?'Aucun résultat':'Aucun fournisseur encore'}</div>
        ${!searchTerm?'<button class="btn-primary" onclick="window.openFournisseurForm()">➕ Ajouter un fournisseur</button>':''}
      </div>`; return;
    }

    const maxTotal = Math.max(...list.map(f=>+f.total_commandes||0),1);
    el.innerHTML = '';

    list.forEach(f => {
      const total = +f.total_commandes || 0;
      const cmds  = +f.nb_commandes   || 0;
      const pct   = Math.round((total/maxTotal)*100);

      const card = document.createElement('div');
      card.className = 'entity-card';
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <div class="entity-avatar avatar-fournisseur">${ini(f.name)}</div>
          <div style="flex:1;min-width:0;">
            <div class="entity-name">${f.name}</div>
            <div class="entity-sub">
              ${f.phone?`📞 ${f.phone}`:''}${f.email?` · ✉️ ${f.email}`:''}${!f.phone&&!f.email?'Aucun contact':''}
            </div>
            ${f.address?`<div class="entity-sub">📍 ${f.address}</div>`:''}
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div class="entity-amount">${total.toLocaleString('fr-FR')} F</div>
            <div class="entity-count">${cmds} commande${cmds>1?'s':''}</div>
          </div>
        </div>

        <!-- Barre dépenses relative -->
        <div class="ca-bar-wrap"><div class="ca-bar blue" style="width:${pct}%"></div></div>

        <!-- Actions -->
        <div class="entity-actions">
          ${f.phone?`
            <button class="entity-btn eb-call" onclick="event.stopPropagation();window.open('tel:${f.phone}')">📞 Appel</button>
            <button class="entity-btn eb-wa"   onclick="event.stopPropagation();window.open('https://wa.me/${(f.phone||'').replace(/\s+/g,'')}')">💬 WhatsApp</button>
          `:''}
          <button class="entity-btn eb-order" onclick="event.stopPropagation();window._commanderFournisseur(${f.id})">📦 Commander</button>
          <button class="entity-btn eb-edit"  onclick="event.stopPropagation();window.openFournisseurForm(${f.id})">✏️</button>
        </div>
      `;

      card.addEventListener('click', ()=>openFournisseurDetail(f.id));
      el.appendChild(card);
    });
  }

  // ══ COMMANDER RAPIDE ══
  window._commanderFournisseur = async function(id) {
    const f = fournisseurs.find(x=>x.id===id);
    if (!f) return;

    // Ouvrir la modale de réappro WhatsApp
    openReapproModal(f);
  };

  // ══ MODALE RÉAPPRO WHATSAPP ══
  async function openReapproModal(f) {
    const bd = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">📦 Commander à ${f.name}</div>
        <div style="text-align:center;padding:20px 0;color:var(--muted);">
          <div style="font-size:32px;margin-bottom:8px;">⏳</div>
          <div style="font-size:13px;">Préparation du message…</div>
        </div>
      </div>`;
    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if(e.target===bd) bd.remove(); });

    try {
      // Appeler l'API pour obtenir le message pré-formaté avec produits faibles
      const today = new Date().toLocaleDateString('fr-FR');
      const data  = await auth(`${API()}/fournisseurs/${f.id}/reappro-message?date=${encodeURIComponent(today)}`).then(ok_);

      const sheet = bd.querySelector('.module-sheet');
      sheet.innerHTML = `
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">📦 Réappro — ${f.name}</div>

        ${data.produits_faibles?.length ? `
          <div style="background:#FEF3C7;border-radius:14px;padding:12px;margin-bottom:14px;border:1.5px solid #F59E0B;">
            <div style="font-family:'Sora',sans-serif;font-size:12px;font-weight:800;color:#92400E;margin-bottom:8px;">
              ⚠️ ${data.produits_faibles.length} produit${data.produits_faibles.length>1?'s':''} en stock faible détecté${data.produits_faibles.length>1?'s':''}
            </div>
            ${data.produits_faibles.map(p=>`
              <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;">
                <span style="color:#78350F;">${p.name}</span>
                <span style="color:#D97706;font-weight:700;">Stock : ${p.stock}</span>
              </div>
            `).join('')}
          </div>
        ` : `
          <div style="background:#ECFDF5;border-radius:14px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#065F46;font-weight:600;">
            ✅ Aucun produit en rupture — vous pouvez saisir votre commande manuellement
          </div>
        `}

        <!-- Message éditable -->
        <div class="form-group">
          <label>📝 Message WhatsApp</label>
          <textarea id="reappro-msg" style="height:160px;font-size:12px;font-family:monospace;resize:none;">${data.message}</textarea>
        </div>

        <!-- Date souhaitée -->
        <div class="form-group">
          <label>📅 Date souhaitée</label>
          <input id="reappro-date" type="date" value="${new Date(Date.now()+2*864e5).toISOString().split('T')[0]}">
        </div>

        <div class="action-row" style="margin-bottom:12px;">
          <a id="reappro-wa-btn"
            href="${data.whatsapp_url}"
            target="_blank"
            style="
              flex:2;padding:13px;
              background:linear-gradient(135deg,#25D366,#128C7E);
              color:#fff;text-decoration:none;
              border-radius:14px;font-family:'Sora',sans-serif;
              font-size:14px;font-weight:700;
              display:flex;align-items:center;justify-content:center;gap:8px;
              box-shadow:0 3px 10px rgba(37,211,102,.3);
            ">
            💬 Envoyer sur WhatsApp
          </a>
          <button id="reappro-copy" class="btn-mod btn-mod-blue" style="flex:1;">📋 Copier</button>
        </div>
        <button class="btn-cancel" style="width:100%;" id="reappro-close">Fermer</button>
      `;

      // Mettre à jour le lien WhatsApp dynamiquement si le message change
      const msgTA  = sheet.querySelector('#reappro-msg');
      const dateIn = sheet.querySelector('#reappro-date');
      const waBtn  = sheet.querySelector('#reappro-wa-btn');

      function updateWaLink() {
        const msg   = msgTA.value;
        const phone = (f.phone||'').replace(/\s+/g,'');
        if (phone) waBtn.href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
      }
      msgTA?.addEventListener('input',  updateWaLink);
      dateIn?.addEventListener('change', () => {
        const d = dateIn.value ? new Date(dateIn.value).toLocaleDateString('fr-FR') : 'À confirmer';
        if (msgTA) msgTA.value = msgTA.value.replace(/Date souhaitée : .+/, `Date souhaitée : ${d}`);
        updateWaLink();
      });

      sheet.querySelector('#reappro-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(msgTA.value).then(() => {
          notify('📋 Message copié', 'success');
        });
      });
      sheet.querySelector('#reappro-close').addEventListener('click', () => bd.remove());

    } catch {
      notify('Erreur chargement réappro', 'error');
      bd.remove();
    }
  }

  // ══ FICHE DÉTAIL ══
  async function openFournisseurDetail(id) {
    let detail = fournisseurs.find(f=>f.id===id) || {};
    try { detail = await auth(`${API()}/fournisseurs/${id}`).then(ok_); } catch {}

    const commandes = detail.commandes || [];
    const enCours   = commandes.filter(c=>['en_attente','confirmee'].includes(c.status));
    const totalDep  = commandes.filter(c=>c.status==='recue').reduce((s,c)=>s+(+c.total||0),0);

    const bd = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>

        <div class="entity-hero">
          <div class="entity-hero-avatar avatar-fournisseur">${ini(detail.name)}</div>
          <div class="entity-hero-name">${detail.name}</div>
          <div class="entity-hero-sub">${detail.phone?`📞 ${detail.phone}`:''}${detail.email?` · ✉️ ${detail.email}`:''}</div>
        </div>

        <div class="module-stats">
          <div class="module-stat-tile" style="background:#EFF6FF;">
            <div class="msv" style="color:#3B82F6;font-size:16px;">${totalDep.toLocaleString('fr-FR')} F</div>
            <div class="msl">💸 Total acheté</div>
          </div>
          <div class="module-stat-tile" style="background:#EDE9FE;">
            <div class="msv" style="color:#7C3AED;">${commandes.length}</div>
            <div class="msl">📦 Commandes</div>
          </div>
        </div>

        <div class="detail-panel">
          ${detail.phone   ? `<div class="detail-row"><span class="detail-icon">📞</span><span class="detail-label">Téléphone</span><span class="detail-val">${detail.phone}</span></div>` : ''}
          ${detail.email   ? `<div class="detail-row"><span class="detail-icon">✉️</span><span class="detail-label">Email</span><span class="detail-val">${detail.email}</span></div>` : ''}
          ${detail.address ? `<div class="detail-row"><span class="detail-icon">📍</span><span class="detail-label">Adresse</span><span class="detail-val">${detail.address}</span></div>` : ''}
          ${detail.notes   ? `<div class="detail-row"><span class="detail-icon">📝</span><span class="detail-label">Notes</span><span class="detail-val">${detail.notes}</span></div>` : ''}
        </div>

        ${enCours.length ? `
          <div style="background:#FFFBEB;border-radius:14px;padding:12px;margin-bottom:14px;border:1.5px solid #F59E0B;">
            <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:#92400E;margin-bottom:8px;">
              ⏳ ${enCours.length} commande${enCours.length>1?'s':''} en cours
            </div>
            ${enCours.slice(0,3).map(c=>`
              <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid rgba(245,158,11,.2);">
                <span style="color:#78350F;">${c.expected_date?new Date(c.expected_date).toLocaleDateString('fr-FR'):'Sans date'}</span>
                <span style="font-weight:700;color:#D97706;">${(+c.total||0).toLocaleString('fr-FR')} F</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${commandes.length ? `
          <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:var(--text);margin-bottom:10px;">📜 Historique commandes</div>
          <div class="history-list">
            ${commandes.slice(0,6).map(c=>`
              <div class="history-item">
                <div>
                  <div class="history-item-name">${c.nb_items||0} article${c.nb_items>1?'s':''}</div>
                  <div class="history-item-date">${new Date(c.created_at).toLocaleDateString('fr-FR')} · <span class="status-badge badge-${c.status}" style="font-size:10px;padding:1px 6px;">${c.status}</span></div>
                </div>
                <div class="history-item-amount">${(+c.total||0).toLocaleString('fr-FR')} F</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="action-row" style="margin-top:16px;">
          <button class="btn-mod btn-mod-orange" id="fd-cmd">📦 Commander</button>
          ${detail.phone?`<button class="btn-mod btn-mod-blue" onclick="window.open('tel:${detail.phone}')">📞 Appel</button>`:''}
          <button class="btn-mod btn-mod-primary" id="fd-edit">✏️ Modifier</button>
          <button class="btn-mod btn-mod-danger"  id="fd-del">🗑️</button>
        </div>
        <button class="btn-cancel" style="width:100%;margin-top:10px;" id="fd-close">Fermer</button>
      </div>`;

    document.body.appendChild(bd);
    bd.addEventListener('click', e=>{if(e.target===bd)bd.remove();});
    bd.querySelector('#fd-close').addEventListener('click',()=>bd.remove());
    bd.querySelector('#fd-edit').addEventListener('click',()=>{bd.remove();openFournisseurForm(id);});
    bd.querySelector('#fd-cmd').addEventListener('click',()=>{bd.remove();window._commanderFournisseur(id);});
    bd.querySelector('#fd-del').addEventListener('click', async()=>{
      if(!await window.customConfirm?.(`Supprimer "${detail.name}" ?`))return;
      try {
        await auth(`${API()}/fournisseurs/${id}`,{method:'DELETE'}).then(ok_);
        notify('Fournisseur supprimé','success'); bd.remove(); loadFournisseurs();
      } catch { notify('Erreur suppression','error'); }
    });
  }

  // ══ FORMULAIRE ══
  async function openFournisseurForm(idOrObj=null) {
    let existing = null;
    if (typeof idOrObj === 'number') existing = fournisseurs.find(f=>f.id===idOrObj);
    else if (typeof idOrObj === 'object') existing = idOrObj;

    const bd = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">${existing?'✏️ Modifier fournisseur':'🏭 Nouveau fournisseur'}</div>
        <div class="form-group"><label>Nom *</label><input id="ff-name" type="text" value="${existing?.name||''}" placeholder="Nom du fournisseur"></div>
        <div class="form-group"><label>Téléphone</label><input id="ff-phone" type="tel" value="${existing?.phone||''}" placeholder="+221 XX XXX XX XX"></div>
        <div class="form-group"><label>Email</label><input id="ff-email" type="email" value="${existing?.email||''}" placeholder="email@exemple.com"></div>
        <div class="form-group"><label>Adresse / Ville</label><input id="ff-address" type="text" value="${existing?.address||''}" placeholder="Adresse"></div>
        <div class="form-group"><label>Notes</label><textarea id="ff-notes" style="height:70px;resize:none;">${existing?.notes||''}</textarea></div>
        <div class="modal-actions">
          <button class="btn-cancel" id="ff-cancel">Annuler</button>
          <button class="btn-confirm" id="ff-save">${existing?'Mettre à jour':'Ajouter'}</button>
        </div>
      </div>`;

    document.body.appendChild(bd);
    bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
    bd.querySelector('#ff-cancel').addEventListener('click',()=>bd.remove());
    bd.querySelector('#ff-save').addEventListener('click', async()=>{
      const name = bd.querySelector('#ff-name').value.trim();
      if (!name){notify('Le nom est requis','warning');return;}
      const body = {
        name,
        phone:   bd.querySelector('#ff-phone').value.trim()||null,
        email:   bd.querySelector('#ff-email').value.trim()||null,
        address: bd.querySelector('#ff-address').value.trim()||null,
        notes:   bd.querySelector('#ff-notes').value.trim()||null,
      };
      try {
        await auth(existing?`${API()}/fournisseurs/${existing.id}`:`${API()}/fournisseurs`,{
          method:existing?'PATCH':'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(body),
        }).then(ok_);
        notify(existing?'✅ Fournisseur mis à jour':'✅ Fournisseur ajouté','success');
        bd.remove(); loadFournisseurs();
      } catch{notify('Erreur sauvegarde','error');}
    });
  }

  function renderSkeleton(id,n) {
    const el=document.getElementById(id); if(!el)return;
    el.innerHTML=Array(n).fill(`<div style="background:var(--surface);border-radius:20px;padding:16px;margin-bottom:12px;box-shadow:0 2px 16px rgba(0,0,0,.07);"><div style="display:flex;gap:12px;"><div style="width:52px;height:52px;border-radius:16px;background:#F3F4F6;flex-shrink:0;"></div><div style="flex:1;"><div style="height:14px;background:#F3F4F6;border-radius:7px;margin-bottom:8px;width:55%;"></div><div style="height:11px;background:#F3F4F6;border-radius:6px;width:35%;"></div></div></div><div style="height:5px;background:#F3F4F6;border-radius:999px;margin:10px 0;"></div><div style="display:flex;gap:6px;"><div style="flex:1;height:32px;background:#F3F4F6;border-radius:10px;"></div><div style="flex:1;height:32px;background:#F3F4F6;border-radius:10px;"></div></div></div>`).join('');
  }

  function renderSortChips() {
    const el=document.getElementById('fournisseursSortChips'); if(!el)return;
    const opts=[{key:'total',label:'💸 Par dépenses'},{key:'cmds',label:'📦 Par commandes'},{key:'nom',label:'🔤 Par nom'},{key:'recent',label:'🕒 Récents'}];
    el.innerHTML=opts.map(o=>`<button class="mod-chip ${sortBy===o.key?'active':''}" data-sort="${o.key}">${o.label}</button>`).join('');
    el.querySelectorAll('.mod-chip').forEach(btn=>{
      btn.addEventListener('click',()=>{sortBy=btn.dataset.sort;el.querySelectorAll('.mod-chip').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderList();});
    });
  }

  function initFournisseursSection() {
    const sec=document.getElementById('fournisseursSection');
    if(!sec||sec._init)return; sec._init=true;
    renderSortChips();
    const si=document.getElementById('fournisseursSearch');
    if(si) si.addEventListener('input',()=>{searchTerm=si.value.trim().toLowerCase();renderList();});
    document.getElementById('fournisseursAddBtn')?.addEventListener('click',()=>openFournisseurForm());
    loadFournisseurs();
  }

  window.openFournisseurForm     = openFournisseurForm;
  window.loadFournisseurs        = loadFournisseurs;
  window.initFournisseursSection = initFournisseursSection;

  window.addEventListener('pageChange', e=>{if(e.detail?.key==='fournisseurs')initFournisseursSection();});
})();
