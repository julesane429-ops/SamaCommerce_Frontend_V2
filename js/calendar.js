/**
 * calendar.js — Calendrier des échéances
 *
 * Vue calendrier mensuelle affichant :
 *   💳 Crédits arrivant à échéance
 *   🚚 Livraisons attendues (expected_date)
 *   📦 Commandes prévues (expected_date)
 *
 * Section : #calendrierSection (à ajouter dans index.html)
 * Accessible depuis le Plus Sheet
 *
 * INTÉGRATION :
 *   1. <script src="js/calendar.js"></script> avant </body>
 *   2. Section HTML + bouton Plus Sheet (voir bas de fichier)
 *   3. Ajouter 'calendrier' dans utils.js sections[] et updateNavUI()
 */

(function () {

  const API    = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth   = (url, o={}) => window.authfetch(url, o);

  // État
  let currentYear  = new Date().getFullYear();
  let currentMonth = new Date().getMonth(); // 0-indexé
  let events       = []; // { date: 'YYYY-MM-DD', type, label, amount, id, nav }

  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const DAYS_FR   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  // ══════════════════════════════════════
  // CHARGER LES ÉVÉNEMENTS
  // ══════════════════════════════════════
  async function loadEvents() {
    events = [];

    // ── Crédits (depuis appData) ──
    const credits = window.appData?.credits || [];
    credits.forEach(c => {
      if (!c.due_date || c.paid) return;
      const d    = new Date(c.due_date);
      const isLate = d < new Date();
      events.push({
        date:   d.toISOString().split('T')[0],
        type:   'credit',
        label:  c.client_name || 'Crédit',
        amount: c.total || 0,
        late:   isLate,
        nav:    'credits',
        id:     c.id,
      });
    });

    // ── Commandes + Livraisons (depuis API) ──
    try {
      const [rc, rl] = await Promise.allSettled([
        auth(`${API()}/commandes`).then(r => r.ok ? r.json() : []),
        auth(`${API()}/livraisons`).then(r => r.ok ? r.json() : []),
      ]);

      if (rc.status === 'fulfilled') {
        (rc.value || []).forEach(c => {
          if (!c.expected_date) return;
          if (['recue','annulee'].includes(c.status)) return;
          const d = new Date(c.expected_date);
          events.push({
            date:   d.toISOString().split('T')[0],
            type:   'commande',
            label:  c.fournisseur_name || `Commande #${c.id}`,
            amount: c.total || 0,
            late:   d < new Date() && c.status !== 'recue',
            nav:    'commandes',
            id:     c.id,
          });
        });
      }

      if (rl.status === 'fulfilled') {
        (rl.value || []).forEach(l => {
          if (!l.expected_date) return;
          if (l.status === 'livree') return;
          const d = new Date(l.expected_date);
          events.push({
            date:   d.toISOString().split('T')[0],
            type:   'livraison',
            label:  l.fournisseur_name || `Livraison #${l.id}`,
            amount: l.commande_total || 0,
            late:   d < new Date(),
            nav:    'livraisons',
            id:     l.id,
          });
        });
      }
    } catch {}

    renderCalendar();
    renderEventList();
  }

  // ══════════════════════════════════════
  // CONFIG VISUELLE PAR TYPE
  // ══════════════════════════════════════
  const TYPE_CONFIG = {
    credit:   { icon:'💳', color:'#EF4444', bg:'#FEF2F2', label:'Crédit'   },
    commande: { icon:'📦', color:'#F59E0B', bg:'#FFFBEB', label:'Commande' },
    livraison:{ icon:'🚚', color:'#3B82F6', bg:'#EFF6FF', label:'Livraison'},
  };

  // ══════════════════════════════════════
  // RENDU CALENDRIER
  // ══════════════════════════════════════
  function renderCalendar() {
    const grid = document.getElementById('cal-grid');
    const title = document.getElementById('cal-month-title');
    if (!grid || !title) return;

    title.textContent = `${MONTHS_FR[currentMonth]} ${currentYear}`;

    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay  = new Date(currentYear, currentMonth + 1, 0);
    const today    = new Date().toISOString().split('T')[0];

    // Jour de la semaine du 1er (0=dim → convertir en 0=lun)
    let startDow = firstDay.getDay(); // 0=dim
    startDow = startDow === 0 ? 6 : startDow - 1; // 0=lun

    // En-têtes jours
    let html = DAYS_FR.map(d =>
      `<div style="text-align:center;font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;padding:4px 0;">${d}</div>`
    ).join('');

    // Cases vides avant le 1er
    for (let i = 0; i < startDow; i++) {
      html += `<div></div>`;
    }

    // Jours du mois
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const dayEvents = events.filter(e => e.date === dateStr);
      const isToday   = dateStr === today;
      const isPast    = dateStr < today;
      const hasLate   = dayEvents.some(e => e.late);

      html += `
        <div class="cal-day ${isToday ? 'cal-today' : ''} ${isPast && !isToday ? 'cal-past' : ''} ${dayEvents.length ? 'cal-has-events' : ''}"
             data-date="${dateStr}"
             style="
               min-height:52px; border-radius:12px; padding:5px 4px;
               cursor:${dayEvents.length ? 'pointer' : 'default'};
               background:${isToday ? 'linear-gradient(135deg,#7C3AED,#EC4899)' : dayEvents.length ? 'var(--surface)' : 'transparent'};
               border:${dayEvents.length && !isToday ? '1.5px solid #E5E7EB' : 'none'};
               ${isToday ? 'box-shadow:0 4px 14px rgba(124,58,237,.3);' : ''}
               transition:transform .12s;
             "
             ${dayEvents.length ? `onclick="window._calShowDay('${dateStr}')"` : ''}>

          <!-- Numéro du jour -->
          <div style="
            font-family:'Sora',sans-serif; font-size:12px; font-weight:${isToday?800:600};
            color:${isToday?'#fff':isPast?'var(--muted)':'var(--text)'};
            text-align:center; margin-bottom:3px;
          ">${day}</div>

          <!-- Points événements -->
          ${dayEvents.length ? `
            <div style="display:flex;flex-wrap:wrap;gap:2px;justify-content:center;">
              ${dayEvents.slice(0,3).map(e => `
                <div style="
                  width:6px; height:6px; border-radius:50%;
                  background:${e.late ? '#EF4444' : TYPE_CONFIG[e.type]?.color || '#7C3AED'};
                  ${isToday ? 'background:rgba(255,255,255,.8);' : ''}
                "></div>
              `).join('')}
              ${dayEvents.length > 3 ? `<div style="font-size:8px;color:${isToday?'#fff':'var(--muted)'};">+${dayEvents.length-3}</div>` : ''}
            </div>
          ` : ''}

          <!-- Indicateur retard -->
          ${hasLate && !isToday ? `
            <div style="position:absolute;top:3px;right:3px;width:6px;height:6px;border-radius:50%;background:#EF4444;"></div>
          ` : ''}
        </div>
      `;
    }

    grid.innerHTML = html;
  }

  // ══════════════════════════════════════
  // AFFICHER LES ÉVÉNEMENTS D'UN JOUR (popup)
  // ══════════════════════════════════════
  window._calShowDay = function (dateStr) {
    const dayEvents = events.filter(e => e.date === dateStr);
    if (!dayEvents.length) return;

    const d      = new Date(dateStr + 'T12:00:00');
    const label  = d.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long' });
    const totalAmt = dayEvents.reduce((s,e) => s+(e.amount||0), 0);

    const existing = document.getElementById('cal-day-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'cal-day-popup';
    popup.style.cssText = `
      position:fixed; inset:0; background:rgba(10,7,30,.6);
      backdrop-filter:blur(5px); z-index:600;
      display:flex; flex-direction:column;
      justify-content:flex-end; align-items:center;
      padding-bottom:calc(var(--nav-h,68px) + var(--safe-b,0px));
    `;

    popup.innerHTML = `
      <div style="
        background:var(--surface); border-radius:24px 24px 0 0;
        padding:10px 20px 28px; width:100%; max-width:480px;
        animation:moduleSheetUp .3s cubic-bezier(.34,1.3,.64,1) both;
      ">
        <div style="width:36px;height:4px;background:#E5E7EB;border-radius:2px;margin:0 auto 14px;"></div>
        <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:var(--text);margin-bottom:4px;text-transform:capitalize;">${label}</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:16px;">${dayEvents.length} événement${dayEvents.length>1?'s':''} · ${totalAmt.toLocaleString('fr-FR')} F</div>

        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px;">
          ${dayEvents.map(e => {
            const cfg  = TYPE_CONFIG[e.type] || {};
            const isLate = e.late;
            return `
              <div style="
                background:${isLate ? '#FEF2F2' : cfg.bg};
                border:1.5px solid ${isLate ? '#FCA5A5' : cfg.color+'33'};
                border-radius:14px; padding:13px 14px;
                display:flex; align-items:center; gap:12px;
                cursor:pointer;
              " onclick="window.navTo?.('${e.nav}');document.getElementById('cal-day-popup')?.remove();">
                <div style="font-size:24px;">${cfg.icon}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:${isLate ? '#991B1B' : 'var(--text)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.label}</div>
                  <div style="font-size:11px;color:${isLate ? '#EF4444' : 'var(--muted)'};margin-top:2px;">
                    ${cfg.label}${isLate ? ' · ⚠️ En retard' : ''}
                  </div>
                </div>
                <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:${isLate ? '#EF4444' : cfg.color};flex-shrink:0;">
                  ${(e.amount||0).toLocaleString('fr-FR')} F
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <button onclick="document.getElementById('cal-day-popup').remove()"
          style="width:100%;padding:13px;background:#F9FAFB;color:#6B7280;border:none;border-radius:14px;font-family:'Sora',sans-serif;font-size:14px;font-weight:600;cursor:pointer;">
          Fermer
        </button>
      </div>
    `;

    document.body.appendChild(popup);
    popup.addEventListener('click', e => { if(e.target===popup) popup.remove(); });
  };

  // ══════════════════════════════════════
  // LISTE DES ÉVÉNEMENTS DU MOIS
  // ══════════════════════════════════════
  function renderEventList() {
    const el = document.getElementById('cal-event-list');
    if (!el) return;

    const monthStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}`;
    const monthEvts = events
      .filter(e => e.date.startsWith(monthStr))
      .sort((a,b) => a.date.localeCompare(b.date));

    if (!monthEvts.length) {
      el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px;">✨ Aucune échéance ce mois-ci</div>`;
      return;
    }

    // Grouper par date
    const grouped = {};
    monthEvts.forEach(e => {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    });

    const today = new Date().toISOString().split('T')[0];

    el.innerHTML = Object.entries(grouped).map(([date, evts]) => {
      const d      = new Date(date + 'T12:00:00');
      const dLabel = d.toLocaleDateString('fr-FR', { weekday:'short', day:'2-digit', month:'short' });
      const isToday = date === today;
      const isPast  = date < today;

      return `
        <div style="margin-bottom:12px;">
          <!-- Label date -->
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <div style="
              font-family:'Sora',sans-serif; font-size:12px; font-weight:800;
              color:${isToday?'var(--primary)':isPast?'var(--red)':'var(--text)'};
              text-transform:capitalize;
            ">${isToday ? '📍 Aujourd\'hui' : dLabel}</div>
            ${isPast && !isToday ? '<span style="font-size:10px;background:#FEE2E2;color:#991B1B;padding:2px 7px;border-radius:6px;font-weight:700;">En retard</span>' : ''}
          </div>

          <!-- Événements -->
          ${evts.map(e => {
            const cfg = TYPE_CONFIG[e.type] || {};
            return `
              <div style="
                background:var(--surface); border-radius:14px; padding:11px 14px;
                display:flex; align-items:center; gap:10px; margin-bottom:6px;
                box-shadow:0 1px 8px rgba(0,0,0,.05);
                border-left:3px solid ${e.late ? '#EF4444' : cfg.color};
                cursor:pointer;
              " onclick="window.navTo?.('${e.nav}')">
                <div style="font-size:20px;">${cfg.icon}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.label}</div>
                  <div style="font-size:11px;color:${e.late?'#EF4444':'var(--muted)'};margin-top:2px;">${cfg.label}${e.late?' · ⚠️ En retard':''}</div>
                </div>
                <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:${e.late?'#EF4444':cfg.color};flex-shrink:0;">
                  ${(e.amount||0).toLocaleString('fr-FR')} F
                </div>
              </div>`;
          }).join('')}
        </div>
      `;
    }).join('');
  }

  // ══════════════════════════════════════
  // NAVIGATION MOIS
  // ══════════════════════════════════════
  function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
    renderEventList();
  }

  function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
    renderEventList();
  }

  window._calPrev = prevMonth;
  window._calNext = nextMonth;

  // ══════════════════════════════════════
  // RENDER STATS MOIS
  // ══════════════════════════════════════
  function renderMonthStats() {
    const el = document.getElementById('cal-month-stats');
    if (!el) return;

    const monthStr  = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}`;
    const monthEvts = events.filter(e => e.date.startsWith(monthStr));
    const credits   = monthEvts.filter(e => e.type==='credit');
    const commandes = monthEvts.filter(e => e.type==='commande');
    const livraisons= monthEvts.filter(e => e.type==='livraison');
    const totalDu   = credits.reduce((s,e)=>s+(e.amount||0),0);

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
        <div style="background:#FEF2F2;border-radius:14px;padding:12px;text-align:center;">
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:#EF4444;">${credits.length}</div>
          <div style="font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;margin-top:3px;">💳 Crédits</div>
          ${totalDu > 0 ? `<div style="font-size:11px;font-weight:700;color:#EF4444;">${totalDu.toLocaleString('fr-FR')} F</div>` : ''}
        </div>
        <div style="background:#FFFBEB;border-radius:14px;padding:12px;text-align:center;">
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:#F59E0B;">${commandes.length}</div>
          <div style="font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;margin-top:3px;">📦 Commandes</div>
        </div>
        <div style="background:#EFF6FF;border-radius:14px;padding:12px;text-align:center;">
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:#3B82F6;">${livraisons.length}</div>
          <div style="font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;margin-top:3px;">🚚 Livraisons</div>
        </div>
      </div>`;
  }

  // ══════════════════════════════════════
  // INIT SECTION
  // ══════════════════════════════════════
  function initCalendrierSection() {
    const sec = document.getElementById('calendrierSection');
    if (!sec || sec._init) return;
    sec._init = true;

    // Boutons navigation mois
    document.getElementById('cal-prev')?.addEventListener('click', () => { prevMonth(); renderMonthStats(); });
    document.getElementById('cal-next')?.addEventListener('click', () => { nextMonth(); renderMonthStats(); });

    // Revenir à aujourd'hui
    document.getElementById('cal-today-btn')?.addEventListener('click', () => {
      currentYear  = new Date().getFullYear();
      currentMonth = new Date().getMonth();
      renderCalendar(); renderEventList(); renderMonthStats();
    });

    loadEvents().then(() => renderMonthStats());
  }

  window.initCalendrierSection = initCalendrierSection;

  window.addEventListener('pageChange', e => {
    if (e.detail?.key === 'calendrier') initCalendrierSection();
  });

})();
