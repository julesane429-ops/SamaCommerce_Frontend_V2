/**
 * whatsapp-reminders.js — Rappels automatiques WhatsApp
 *
 * Détecte les crédits arrivant à échéance dans ≤ 2 jours
 * et propose d'envoyer un rappel WhatsApp au client.
 *
 * Fonctionnement :
 *   1. Vérifie quotidiennement les crédits proche échéance
 *   2. Affiche une liste des rappels à envoyer
 *   3. Génère le message WhatsApp automatiquement
 *   4. Bouton par client → ouvre wa.me directement
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/whatsapp-reminders.js"></script>
 */

(function () {

  const SENT_KEY   = 'sc_wa_reminders_sent'; // { creditId: dateStr }
  const CHECK_KEY  = 'sc_wa_last_check';
  const DAYS_AHEAD = 2; // Alerter J-2

  // ══════════════════════════════════════
  // CRÉDITS À RAPPELER
  // ══════════════════════════════════════
  function getCreditsToRemind() {
    const credits = window.appData?.credits || [];
    const today   = new Date(); today.setHours(0,0,0,0);
    const limit   = new Date(today); limit.setDate(today.getDate() + DAYS_AHEAD);
    const sent    = getSent();

    return credits.filter(c => {
      if (c.paid) return false;
      if (!c.due_date) return false;
      if (!c.client_phone) return false; // Pas de téléphone → impossible d'envoyer
      const due = new Date(c.due_date); due.setHours(0,0,0,0);
      if (due > limit) return false;
      // Ne pas rappeler si déjà envoyé aujourd'hui
      const sentDate = sent[c.id];
      const todayStr = today.toISOString().split('T')[0];
      if (sentDate === todayStr) return false;
      return true;
    }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  }

  function getSent() {
    try { return JSON.parse(localStorage.getItem(SENT_KEY) || '{}'); } catch { return {}; }
  }

  function markSent(creditId) {
    const sent   = getSent();
    sent[creditId] = new Date().toISOString().split('T')[0];
    localStorage.setItem(SENT_KEY, JSON.stringify(sent));
  }

  // ══════════════════════════════════════
  // GÉNÉRER LE MESSAGE WHATSAPP
  // ══════════════════════════════════════
  function buildMessage(credit) {
    const boutique = document.getElementById('appHeader')?.textContent?.replace('🏪','').trim() || 'Sama Commerce';
    const dueDate  = new Date(credit.due_date).toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long' });
    const isToday  = new Date(credit.due_date).toDateString() === new Date().toDateString();
    const isOverdue = new Date(credit.due_date) < new Date();

    let greeting;
    if (isOverdue) {
      greeting = `⚠️ Rappel urgent : votre crédit chez *${boutique}* est en retard.`;
    } else if (isToday) {
      greeting = `🔔 Rappel : votre crédit chez *${boutique}* est dû *aujourd'hui*.`;
    } else {
      greeting = `🔔 Rappel de *${boutique}* : votre crédit arrive à échéance dans 2 jours.`;
    }

    return `Bonjour *${credit.client_name}* 👋\n\n` +
      `${greeting}\n\n` +
      `📦 *${credit.product_name || 'Achat'}*\n` +
      `💰 Montant dû : *${(credit.total||0).toLocaleString('fr-FR')} F CFA*\n` +
      `📅 Échéance : *${dueDate}*\n\n` +
      `Merci de régler ce montant dans les meilleurs délais.\n\n` +
      `_${boutique} vous remercie de votre confiance 🙏_`;
  }

  // ══════════════════════════════════════
  // AFFICHER LES RAPPELS
  // ══════════════════════════════════════
  function showRemindersPanel(credits) {
    document.getElementById('wa-reminders-panel')?.remove();
    if (!credits.length) return;

    // Chercher l'endroit où insérer (section Crédits ou accueil)
    const credSection = document.getElementById('creditsSection');
    const menuSection = document.getElementById('menuSection');
    const target      = credSection && !credSection.classList.contains('hidden')
                      ? credSection
                      : menuSection;
    if (!target) return;

    const panel = document.createElement('div');
    panel.id = 'wa-reminders-panel';
    panel.style.cssText = `
      background:linear-gradient(135deg,#ECFDF5,#D1FAE5);
      border:1.5px solid #6EE7B7;
      border-radius:18px; padding:14px 16px; margin-bottom:14px;
      animation:reapproIn .35s cubic-bezier(.34,1.3,.64,1) both;
    `;

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="font-family:'Sora',sans-serif;font-size:14px;font-weight:800;color:#065F46;display:flex;align-items:center;gap:6px;">
          💬 Rappels WhatsApp
          <span style="background:#10B981;color:#fff;font-size:10px;padding:2px 7px;border-radius:6px;">${credits.length}</span>
        </div>
        <button onclick="document.getElementById('wa-reminders-panel').remove()" style="background:none;border:none;font-size:18px;color:#059669;cursor:pointer;">✕</button>
      </div>
      <div style="font-size:12px;color:#065F46;margin-bottom:10px;">
        ${credits.length} client${credits.length>1?'s':''} à relancer aujourd'hui
      </div>

      <!-- Liste des crédits -->
      ${credits.map(c => {
        const due     = new Date(c.due_date);
        const isToday = due.toDateString() === new Date().toDateString();
        const isLate  = due < new Date();
        const msg     = buildMessage(c);
        const phone   = (c.client_phone||'').replace(/\s+/g,'');
        const waUrl   = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

        return `
          <div style="
            background:rgba(255,255,255,.7);border-radius:12px;
            padding:10px 12px;margin-bottom:8px;
            display:flex;align-items:center;gap:10px;
          ">
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:700;color:#065F46;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${c.client_name}
              </div>
              <div style="font-size:11px;color:#059669;margin-top:2px;">
                📞 ${c.client_phone} · ${(c.total||0).toLocaleString('fr-FR')} F
                ${isLate ? ' · <span style="color:#EF4444;font-weight:700;">⚠️ En retard</span>'
                : isToday ? ' · <span style="color:#D97706;font-weight:700;">📅 Aujourd\'hui</span>'
                : ' · 📅 Dans 2 jours'}
              </div>
            </div>
            <a href="${waUrl}" target="_blank" rel="noopener"
               style="
                 background:linear-gradient(135deg,#25D366,#128C7E);
                 color:#fff;text-decoration:none;
                 padding:7px 12px;border-radius:10px;
                 font-family:'Sora',sans-serif;font-size:11px;font-weight:700;
                 white-space:nowrap;flex-shrink:0;
               "
               onclick="window._waMarkSent(${c.id});this.style.background='#6B7280';">
              💬 Envoyer
            </a>
          </div>
        `;
      }).join('')}

      <!-- Tout envoyer -->
      ${credits.length > 1 ? `
        <button onclick="window._waSendAll()" style="
          width:100%;margin-top:4px;padding:10px;
          background:linear-gradient(135deg,#10B981,#059669);
          color:#fff;border:none;border-radius:12px;
          font-family:'Sora',sans-serif;font-size:13px;font-weight:700;
          cursor:pointer;
        ">💬 Envoyer tous les rappels (${credits.length})</button>
      ` : ''}
    `;

    // Insérer en haut de la section
    target.insertBefore(panel, target.firstChild.nextSibling);

    // Fonctions globales pour les onclick inline
    window._waMarkSent = markSent;
    window._waSendAll  = () => {
      let i = 0;
      credits.forEach(c => {
        setTimeout(() => {
          const msg   = buildMessage(c);
          const phone = (c.client_phone||'').replace(/\s+/g,'');
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
          markSent(c.id);
        }, i * 1500); // 1.5s entre chaque ouverture
        i++;
      });
      document.getElementById('wa-reminders-panel')?.remove();
      window.showNotification?.(`💬 ${credits.length} messages ouverts`, 'success');
    };
  }

  // ══════════════════════════════════════
  // VÉRIFICATION QUOTIDIENNE
  // ══════════════════════════════════════
  function check() {
    // Vérifier la feature whatsapp (Pro+)
    if (typeof window.canUseFeature === 'function' && !window.canUseFeature('whatsapp')) return;

    const today   = new Date().toISOString().split('T')[0];
    const lastChk = localStorage.getItem(CHECK_KEY);

    // Vérifier max 1x/heure (pas 1x/jour — pour être réactif)
    const lastMs = parseInt(lastChk || '0');
    if (Date.now() - lastMs < 60 * 60 * 1000) return;
    localStorage.setItem(CHECK_KEY, String(Date.now()));

    const credits = getCreditsToRemind();
    if (!credits.length) return;

    // Afficher selon la section active
    showRemindersPanel(credits);

    // Notification push si disponible
    if (Notification.permission === 'granted' && credits.length > 0) {
      window.scNotifications?.sendLocalNotif?.({
        title: `💬 ${credits.length} rappel${credits.length>1?'s':''} à envoyer`,
        body:  credits.map(c => c.client_name).slice(0,3).join(', '),
        type:  'credit',
        tag:   'wa-reminders',
        url:   '/?shortcut=credits',
      });
    }
  }

  // ══════════════════════════════════════
  // API PUBLIQUE
  // ══════════════════════════════════════
  window.waReminders = {
    check,
    getCredits: getCreditsToRemind,
    send:       (credit) => {
      const msg   = buildMessage(credit);
      const phone = (credit.client_phone||'').replace(/\s+/g,'');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
      markSent(credit.id);
    },
  };

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    // Vérifier après sync serveur (données fraîches)
    window.addEventListener('load', () => {
      setTimeout(check, 4000);
      // Revérifier à chaque changement de section
      window.addEventListener('pageChange', e => {
        if(['menu','credits'].includes(e.detail?.key)) {
          setTimeout(check, 300);
        }
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
