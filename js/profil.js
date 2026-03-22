(function () {
  const API    = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth   = (url, o={}) => window.authfetch(url, o);
  const notify = (m, t) => window.showNotification?.(m, t);
  const ok_    = r => { if(!r.ok) throw new Error(r.status); return r.json(); };
 
  let profile = null;
  let stats   = null;
 
  // ══════════════════════════════════════
  // LOAD
  // ══════════════════════════════════════
  async function loadProfile() {
    try {
      [profile, stats] = await Promise.all([
        auth(`${API()}/auth/me`).then(ok_),
        auth(`${API()}/auth/me/stats`).then(ok_),
      ]);
      render();
    } catch { notify('Erreur chargement profil', 'error'); }
  }
 
  // ══════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════
  function render() {
    const el = document.getElementById('profilContent');
    if (!el || !profile) return;

    const plan        = profile.plan || 'Free';
    const _planDefaults = {
      Free:       { label:'Gratuit',    emoji:'🆓', color:'#6B7280', bg:'#F9FAFB', border:'#E5E7EB', price:0,     products_limit:5 },
      Starter:    { label:'Starter',    emoji:'🌱', color:'#059669', bg:'#ECFDF5', border:'#6EE7B7', price:2500,  products_limit:30 },
      Pro:        { label:'Pro',        emoji:'⭐', color:'#7C3AED', bg:'#EDE9FE', border:'#C4B5FD', price:5000,  products_limit:null },
      Business:   { label:'Business',   emoji:'🏆', color:'#92400E', bg:'#FEF9C3', border:'#FCD34D', price:9000,  products_limit:null },
      Enterprise: { label:'Enterprise', emoji:'🚀', color:'#A78BFA', bg:'#1E1B2E', border:'#5B21B6', price:15000, products_limit:null },
    };
    const planCfg = window.getPlan?.(plan) || _planDefaults[plan] || _planDefaults.Free;
    const PAID_PLANS  = ['Starter', 'Pro', 'Business', 'Enterprise'];
    const isPaid      = PAID_PLANS.includes(plan) && profile.upgrade_status === 'validé';
    const isPremium   = isPaid; // alias pour compatibilité
    const expiration  = profile.expiration ? new Date(profile.expiration) : null;
    const expStr      = expiration ? expiration.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }) : null;
    const isExpired   = expiration && expiration < new Date();
    const daysLeft    = expiration ? Math.max(0, Math.ceil((expiration - new Date()) / (1000*60*60*24))) : null;
    const initials    = (profile.company_name || profile.username || '?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
 
    el.innerHTML = `
      <!-- ── Hero profil ── -->
      <div style="background:linear-gradient(135deg,#5B21B6,#7C3AED,#EC4899);border-radius:20px;padding:24px 20px;text-align:center;margin-bottom:16px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;background:rgba(255,255,255,.08);border-radius:50%;"></div>
        <div style="width:72px;height:72px;border-radius:22px;background:rgba(255,255,255,.2);color:#fff;font-family:'Sora',sans-serif;font-size:28px;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;backdrop-filter:blur(4px);">
          ${initials}
        </div>
        <div style="font-family:'Sora',sans-serif;font-size:20px;font-weight:800;color:#fff;margin-bottom:4px;">
          ${profile.company_name || profile.username}
        </div>
        <div style="font-size:13px;color:rgba(255,255,255,.8);">@${profile.username}</div>
        ${profile.phone ? `<div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:4px;">📞 ${profile.phone}</div>` : ''}
      </div>
 
      <!-- ── Badge plan ── -->
      <div style="background:${planCfg.bg};border:2px solid ${planCfg.border};border-radius:16px;padding:16px;margin-bottom:16px;display:flex;align-items:center;gap:14px;">
        <div style="font-size:32px;">${planCfg.emoji || '🆓'}</div>
        <div style="flex:1;">
          <div style="font-family:'Sora',sans-serif;font-size:15px;font-weight:800;color:${planCfg.color};">
            Plan ${planCfg.label}
            ${isPaid && planCfg.price ? ` <span style="font-size:11px;font-weight:500;color:#9CA3AF;">${planCfg.price.toLocaleString('fr-FR')} F/mois</span>` : ''}
          </div>
          ${isPaid && expStr ? `
            <div style="font-size:12px;color:${isExpired?'#EF4444':daysLeft<=7?'#F59E0B':'#6B7280'};margin-top:3px;font-weight:600;">
              ${isExpired ? '⚠️ Expiré' : `⏳ ${daysLeft} jours restants — expire le ${expStr}`}
            </div>
          ` : ''}
          ${!isPaid ? `<div style="font-size:12px;color:#6B7280;margin-top:3px;">Limité à ${planCfg.products_limit} produits</div>` : ''}
        </div>
        ${!isPaid ? `
          <button onclick="window.showModalById?.('premiumModal')"
            style="background:linear-gradient(135deg,#7C3AED,#EC4899);color:#fff;border:none;padding:8px 14px;border-radius:11px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">
            🚀 Upgrade
          </button>
        ` : ''}
      </div>
 
      <!-- ── Stats compte ── -->
      ${stats ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:16px;">
          <div style="background:#EDE9FE;border-radius:16px;padding:14px;text-align:center;">
            <div style="font-family:'Sora',sans-serif;font-size:22px;font-weight:800;color:#7C3AED;">${stats.nb_produits}</div>
            <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.4px;margin-top:4px;">📦 Produits${!isPaid?` / ${planCfg.products_limit}`:''}</div>
            ${!isPaid && planCfg.products_limit !== Infinity ? `<div style="height:4px;background:#E5E7EB;border-radius:999px;margin-top:6px;overflow:hidden;"><div style="height:100%;width:${Math.min((stats.nb_produits/planCfg.products_limit)*100,100)}%;background:${planCfg.color};border-radius:999px;"></div></div>` : ''}
          </div>
          <div style="background:#ECFDF5;border-radius:16px;padding:14px;text-align:center;">
            <div style="font-family:'Sora',sans-serif;font-size:22px;font-weight:800;color:#10B981;">${stats.nb_ventes}</div>
            <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.4px;margin-top:4px;">🧾 Ventes</div>
          </div>
          <div style="background:#EFF6FF;border-radius:16px;padding:14px;text-align:center;">
            <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:#3B82F6;">${(stats.ca_total||0).toLocaleString('fr-FR')} F</div>
            <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.4px;margin-top:4px;">💰 CA total</div>
          </div>
          <div style="background:${stats.credits_ouverts>0?'#FEF2F2':'#F0FDF4'};border-radius:16px;padding:14px;text-align:center;">
            <div style="font-family:'Sora',sans-serif;font-size:22px;font-weight:800;color:${stats.credits_ouverts>0?'#EF4444':'#10B981'};">${stats.credits_ouverts}</div>
            <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.4px;margin-top:4px;">💳 Crédits ouverts</div>
          </div>
        </div>
      ` : ''}
 
      <!-- ── Formulaire modification profil ── -->
      <div style="background:var(--surface);border-radius:20px;padding:18px;margin-bottom:14px;box-shadow:0 2px 14px rgba(0,0,0,.06);">
        <div style="font-family:'Sora',sans-serif;font-size:15px;font-weight:800;color:var(--text);margin-bottom:14px;">✏️ Modifier le profil</div>
 
        <div class="form-group">
          <label>🏪 Nom de boutique</label>
          <input id="profil-company" type="text" value="${profile.company_name||''}" placeholder="Nom de votre boutique">
        </div>
        <div class="form-group">
          <label>📞 Téléphone</label>
          <input id="profil-phone" type="tel" value="${profile.phone||''}" placeholder="+221 XX XXX XX XX">
        </div>
 
        <button id="profil-save-info" style="
          width:100%;padding:13px;
          background:linear-gradient(135deg,#7C3AED,#EC4899);
          color:#fff;border:none;border-radius:14px;
          font-family:'Sora',sans-serif;font-size:14px;font-weight:700;
          cursor:pointer;box-shadow:0 4px 12px rgba(124,58,237,.3);
          transition:transform .15s;margin-bottom:0;
        ">💾 Enregistrer les modifications</button>
      </div>
 
      <!-- ── Changer le mot de passe ── -->
      <div style="background:var(--surface);border-radius:20px;padding:18px;margin-bottom:14px;box-shadow:0 2px 14px rgba(0,0,0,.06);">
        <div style="font-family:'Sora',sans-serif;font-size:15px;font-weight:800;color:var(--text);margin-bottom:14px;">🔐 Changer le mot de passe</div>
 
        <div class="form-group">
          <label>Mot de passe actuel</label>
          <input id="profil-pwd-current" type="password" placeholder="••••••••">
        </div>
        <div class="form-group">
          <label>Nouveau mot de passe</label>
          <input id="profil-pwd-new" type="password" placeholder="Min. 6 caractères">
        </div>
        <div class="form-group">
          <label>Confirmer</label>
          <input id="profil-pwd-confirm" type="password" placeholder="Répéter le nouveau mot de passe">
        </div>
 
        <button id="profil-save-pwd" style="
          width:100%;padding:13px;
          background:#EDE9FE;color:#7C3AED;
          border:none;border-radius:14px;
          font-family:'Sora',sans-serif;font-size:14px;font-weight:700;
          cursor:pointer;transition:transform .15s;
        ">🔑 Changer le mot de passe</button>
      </div>
 
      <!-- ── Déconnexion ── -->
      <button onclick="logout()" style="
        width:100%;padding:13px;
        background:#FEF2F2;color:#DC2626;
        border:none;border-radius:14px;
        font-family:'Sora',sans-serif;font-size:14px;font-weight:700;
        cursor:pointer;margin-bottom:20px;
      ">🔓 Se déconnecter</button>
 
      <!-- Infos app -->
      <div style="text-align:center;font-size:11px;color:var(--muted);padding-bottom:8px;">
        Sama Commerce • Version 2.0
      </div>
    `;
 
    // ── Listeners ──
    document.getElementById('profil-save-info')?.addEventListener('click', saveInfo);
    document.getElementById('profil-save-pwd')?.addEventListener('click', savePassword);
  }
 
  // ══════════════════════════════════════
  // SAUVEGARDER LES INFOS
  // ══════════════════════════════════════
  async function saveInfo() {
    const btn        = document.getElementById('profil-save-info');
    const company    = document.getElementById('profil-company')?.value.trim();
    const phone      = document.getElementById('profil-phone')?.value.trim();
 
    if (!company) { notify('Le nom de boutique est requis', 'warning'); return; }
 
    btn.textContent = '⏳ Enregistrement…';
    btn.style.opacity = '.7';
 
    try {
      const res = await auth(`${API()}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: company, phone: phone || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      const data = await res.json();
      profile = { ...profile, ...data.user };
 
      // Mettre à jour l'en-tête de l'app
      const header = document.getElementById('appHeader');
      if (header) header.textContent = `🏪 ${company}`;
 
      notify('✅ Profil mis à jour', 'success');
      render(); // re-render avec les nouvelles données
    } catch (err) {
      notify(err.message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      if (btn) { btn.textContent = '💾 Enregistrer les modifications'; btn.style.opacity = '1'; }
    }
  }
 
  // ══════════════════════════════════════
  // CHANGER LE MOT DE PASSE
  // ══════════════════════════════════════
  async function savePassword() {
    const btn     = document.getElementById('profil-save-pwd');
    const current = document.getElementById('profil-pwd-current')?.value;
    const newPwd  = document.getElementById('profil-pwd-new')?.value;
    const confirm = document.getElementById('profil-pwd-confirm')?.value;
 
    if (!current || !newPwd || !confirm) { notify('Remplissez tous les champs', 'warning'); return; }
    if (newPwd !== confirm)              { notify('Les mots de passe ne correspondent pas', 'warning'); return; }
    if (newPwd.length < 6)              { notify('Minimum 6 caractères', 'warning'); return; }
 
    btn.textContent = '⏳ Changement…';
    btn.style.opacity = '.7';
 
    try {
      const res = await auth(`${API()}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: newPwd }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      notify('✅ Mot de passe changé', 'success');
      // Vider les champs
      ['profil-pwd-current','profil-pwd-new','profil-pwd-confirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    } catch (err) {
      notify(err.message || 'Erreur changement mot de passe', 'error');
    } finally {
      if (btn) { btn.textContent = '🔑 Changer le mot de passe'; btn.style.opacity = '1'; }
    }
  }
 
  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function initProfilSection() {
    const sec = document.getElementById('profilSection');
    if (!sec) return;
    // Toujours recharger à chaque visite pour avoir les données fraîches
    loadProfile();
  }
 
  window.initProfilSection = initProfilSection;
  window.loadProfile       = loadProfile;
 
  window.addEventListener('pageChange', e => {
    if (e.detail?.key === 'profil') initProfilSection();
  });
 
})();
