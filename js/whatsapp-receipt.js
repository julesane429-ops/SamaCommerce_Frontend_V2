/**
 * whatsapp-receipt.js — Partage de reçu après vente
 *
 * Ce script :
 *  1. Intercepte finaliserVente() pour capturer le panier AVANT vidage
 *  2. Affiche une modale "Partager le reçu" avec 3 options :
 *     - 📱 WhatsApp (lien wa.me avec message pré-formaté)
 *     - 📋 Copier le texte
 *     - 🖨️ Imprimer (délègue à imprimerRecu existant)
 *  3. Gère aussi les ventes à crédit (capture client_name + phone)
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/whatsapp-receipt.js"></script>
 */

(function () {

  // Dernier reçu capturé
  let _lastReceipt = null;

  // ══════════════════════════════════════
  // CAPTURER LE PANIER AVANT VIDAGE
  // Wrapper sur finaliserVente
  // ══════════════════════════════════════
  function hookFinaliserVente() {
    const orig = window.finaliserVente;
    if (typeof orig !== 'function') {
      setTimeout(hookFinaliserVente, 300);
      return;
    }

    window.finaliserVente = async function (paymentMethod, ...args) {
      // Capturer le panier avant l'appel original
      const panier = (window.appData?.panier || []).map(i => ({ ...i }));
      const total  = panier.reduce((s, i) => s + (i.price || 0) * (i.quantite || 0), 0);

      const result = await orig.call(this, paymentMethod, ...args);

      // Stocker le reçu après la vente
      if (panier.length > 0) {
        _lastReceipt = {
          items:         panier,
          total,
          paymentMethod,
          date:          new Date(),
          numero:        genNumero(),
          boutique:      getBoutique(),
          clientName:    window.clientVente?.getSelected()?.name  || null,
          clientPhone:   window.clientVente?.getSelected()?.phone || null,
        };
        // Afficher la modale de partage
        setTimeout(() => showShareModal(), 600);
      }

      return result;
    };
  }

  // Wrapper sur finaliserVenteCredit pour capturer aussi le client
  function hookFinaliserVenteCredit() {
    const orig = window.finaliserVenteCredit;
    if (typeof orig !== 'function') {
      setTimeout(hookFinaliserVenteCredit, 300);
      return;
    }

    window.finaliserVenteCredit = async function (...args) {
      const panier      = (window.appData?.panier || []).map(i => ({ ...i }));
      const total       = panier.reduce((s, i) => s + (i.price || 0) * (i.quantite || 0), 0);
      const clientName  = document.getElementById('creditClientName')?.value.trim() || null;
      const clientPhone = document.getElementById('creditClientPhone')?.value.trim() || null;

      const result = await orig.call(this, ...args);

      if (panier.length > 0) {
        _lastReceipt = {
          items:         panier,
          total,
          paymentMethod: 'Crédit',
          date:          new Date(),
          numero:        genNumero(),
          boutique:      getBoutique(),
          clientName,
          clientPhone,
        };
        setTimeout(() => showShareModal(), 600);
      }

      return result;
    };
  }

  // ══════════════════════════════════════
  // UTILITAIRES
  // ══════════════════════════════════════
  function genNumero() {
    return 'SC-' + Date.now().toString().slice(-6);
  }

  function getBoutique() {
    const header = document.getElementById('appHeader');
    if (header) return header.textContent.replace('🏪','').trim();
    return 'Sama Commerce';
  }

  function formatPayment(method) {
    const map = {
      especes: '💵 Espèces',
      wave:    '📱 Wave',
      orange:  '📞 Orange Money',
      credit:  '📝 Crédit',
      Crédit:  '📝 Crédit',
    };
    return map[method] || method;
  }

  // ══════════════════════════════════════
  // GÉNÉRER LE TEXTE DU REÇU
  // ══════════════════════════════════════
  function buildReceiptText(r) {
    if (!r) return '';

    const dateStr = r.date.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const sep  = '─'.repeat(28);
    const sep2 = '═'.repeat(28);

    let lignes = r.items.map(i => {
      const prix   = (i.price || 0).toLocaleString('fr-FR');
      const sous   = ((i.price||0) * (i.quantite||0)).toLocaleString('fr-FR');
      const name   = i.name.length > 16 ? i.name.slice(0,15)+'…' : i.name;
      return `  ${name}\n  ${i.quantite} × ${prix} F = *${sous} F*`;
    }).join('\n');

    let client = '';
    if (r.clientName) {
      client = `\n👤 Client : *${r.clientName}*`;
      if (r.clientPhone) client += `\n📞 Tél : ${r.clientPhone}`;
    }

    return [
      `🧾 *REÇU — ${r.boutique}*`,
      `N° ${r.numero}`,
      `📅 ${dateStr}`,
      sep,
      lignes,
      sep,
      `💰 *TOTAL : ${r.total.toLocaleString('fr-FR')} F*`,
      `${formatPayment(r.paymentMethod)}`,
      client,
      sep2,
      `✨ Merci pour votre achat !\n_Sama Commerce_`,
    ].filter(Boolean).join('\n');
  }

  // ══════════════════════════════════════
  // MODALE DE PARTAGE
  // ══════════════════════════════════════
  function showShareModal() {
    if (!_lastReceipt) return;

    // Supprimer si déjà ouverte
    document.getElementById('share-receipt-modal')?.remove();

    const r    = _lastReceipt;
    const text = buildReceiptText(r);
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

    // Si on a le numéro du client → lien direct vers le client
    const waClientUrl = r.clientPhone
      ? `https://wa.me/${r.clientPhone.replace(/\s+/g, '')}?text=${encodeURIComponent(text)}`
      : null;

    const modal = document.createElement('div');
    modal.id    = 'share-receipt-modal';
    modal.style.cssText = `
      position:fixed; inset:0;
      background:rgba(10,7,30,.6);
      backdrop-filter:blur(5px);
      z-index:600;
      display:flex;
      flex-direction:column;
      justify-content:flex-end;
      align-items:center;
      padding-bottom:calc(var(--nav-h,68px) + var(--safe-b,0px));
      animation:eodBackdropIn .2s ease both;
    `;

    modal.innerHTML = `
      <div style="
        background:var(--surface,#fff);
        border-radius:24px 24px 0 0;
        padding:10px 20px 28px;
        width:100%; max-width:480px;
        animation:moduleSheetUp .3s cubic-bezier(.34,1.3,.64,1) both;
      ">
        <div style="width:36px;height:4px;background:#E5E7EB;border-radius:2px;margin:0 auto 16px;"></div>

        <!-- Icône succès -->
        <div style="text-align:center;margin-bottom:18px;">
          <div style="width:64px;height:64px;border-radius:20px;background:linear-gradient(135deg,#10B981,#059669);color:#fff;font-size:28px;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">✅</div>
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:var(--text);">Vente enregistrée !</div>
          <div style="font-size:13px;color:var(--muted);margin-top:4px;">
            ${r.items.length} article${r.items.length>1?'s':''} · <strong>${r.total.toLocaleString('fr-FR')} F</strong> · ${formatPayment(r.paymentMethod)}
          </div>
        </div>

        <!-- Aperçu reçu -->
        <div id="receipt-preview" style="
          background:var(--bg,#F9FAFB);
          border-radius:14px;
          padding:14px;
          margin-bottom:16px;
          font-family:monospace;
          font-size:12px;
          color:var(--text);
          line-height:1.6;
          max-height:180px;
          overflow-y:auto;
          white-space:pre-wrap;
          border:1px dashed #E5E7EB;
        ">${escHtml(text)}</div>

        <!-- Boutons partage -->
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">

          <!-- WhatsApp client (si crédit avec téléphone) -->
          ${waClientUrl ? `
            <a href="${waClientUrl}" target="_blank" rel="noopener"
               style="
                 display:flex;align-items:center;justify-content:center;gap:10px;
                 background:linear-gradient(135deg,#25D366,#128C7E);
                 color:#fff;text-decoration:none;
                 padding:14px;border-radius:14px;
                 font-family:'Sora',sans-serif;font-size:14px;font-weight:700;
                 box-shadow:0 4px 14px rgba(37,211,102,.3);
               " onclick="document.getElementById('share-receipt-modal').remove();">
              <span style="font-size:22px;">💬</span>
              Envoyer à ${r.clientName}
            </a>
          ` : ''}

          <!-- WhatsApp (choisir contact) -->
          <a href="${waUrl}" target="_blank" rel="noopener"
             style="
               display:flex;align-items:center;justify-content:center;gap:10px;
               background:${waClientUrl?'#ECFDF5':'linear-gradient(135deg,#25D366,#128C7E)'};
               color:${waClientUrl?'#059669':'#fff'};text-decoration:none;
               padding:14px;border-radius:14px;
               font-family:'Sora',sans-serif;font-size:14px;font-weight:700;
               border:${waClientUrl?'1.5px solid #6EE7B7':'none'};
               ${waClientUrl?'':'box-shadow:0 4px 14px rgba(37,211,102,.3);'}
             " onclick="document.getElementById('share-receipt-modal').remove();">
            <span style="font-size:22px;">📱</span>
            ${waClientUrl?'Autre contact WhatsApp':'Partager via WhatsApp'}
          </a>

          <!-- Copier le texte -->
          <button id="share-copy-btn" style="
            display:flex;align-items:center;justify-content:center;gap:10px;
            background:#EDE9FE;color:#7C3AED;
            border:none;padding:14px;border-radius:14px;
            font-family:'Sora',sans-serif;font-size:14px;font-weight:700;
            cursor:pointer;width:100%;
          ">
            <span style="font-size:20px;">📋</span>
            Copier le reçu
          </button>

          <!-- Imprimer -->
          <button id="share-print-btn" style="
            display:flex;align-items:center;justify-content:center;gap:10px;
            background:#F3F4F6;color:#6B7280;
            border:none;padding:12px;border-radius:14px;
            font-family:'Sora',sans-serif;font-size:13px;font-weight:600;
            cursor:pointer;width:100%;
          ">
            <span style="font-size:18px;">🖨️</span>
            Imprimer
          </button>
        </div>

        <button id="share-close-btn" style="
          width:100%;padding:13px;
          background:#F9FAFB;color:#6B7280;
          border:none;border-radius:14px;
          font-family:'Sora',sans-serif;font-size:14px;font-weight:600;
          cursor:pointer;
        ">Fermer</button>
      </div>
    `;

    document.body.appendChild(modal);

    // ── Copier ──
    modal.querySelector('#share-copy-btn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        const btn = modal.querySelector('#share-copy-btn');
        btn.innerHTML = '<span style="font-size:20px;">✅</span> Copié !';
        btn.style.background = '#ECFDF5';
        btn.style.color = '#059669';
        setTimeout(() => {
          btn.innerHTML = '<span style="font-size:20px;">📋</span> Copier le reçu';
          btn.style.background = '#EDE9FE';
          btn.style.color = '#7C3AED';
        }, 2000);
      } catch {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy');
        ta.remove();
        window.showNotification?.('📋 Reçu copié !', 'success');
      }
    });

    // ── Imprimer ──
    modal.querySelector('#share-print-btn')?.addEventListener('click', () => {
      modal.remove();
      // Remettre temporairement le panier pour imprimerRecu
      if (typeof window.imprimerRecu === 'function') {
        const fakeData = window.appData || {};
        const origPanier = fakeData.panier;
        fakeData.panier = r.items;
        window.imprimerRecu(r.paymentMethod);
        fakeData.panier = origPanier;
      }
    });

    // ── Fermer ──
    modal.querySelector('#share-close-btn')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  // ══════════════════════════════════════
  // HELPER : échapper HTML pour l'aperçu
  // ══════════════════════════════════════
  function escHtml(str) {
    return str
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/\*/g,'<strong>').replace(/\*/g,'</strong>');
  }

  // ══════════════════════════════════════
  // BOUTON "Partager" sur le reçu existant
  // Injecté à côté du bouton Imprimer
  // ══════════════════════════════════════
  function injectShareButton() {
    const printBtn = document.getElementById('btnPrintReceipt');
    if (!printBtn || document.getElementById('btnShareReceipt')) return;

    const shareBtn = document.createElement('button');
    shareBtn.id = 'btnShareReceipt';
    shareBtn.style.cssText = `
      display:none;width:100%;margin-top:8px;padding:12px;
      background:linear-gradient(135deg,#25D366,#128C7E);
      color:#fff;border:none;border-radius:13px;
      font-family:'Sora',sans-serif;font-size:13px;font-weight:700;
      cursor:pointer;
    `;
    shareBtn.innerHTML = '💬 Partager le reçu';
    shareBtn.addEventListener('click', () => showShareModal());

    printBtn.parentNode.insertBefore(shareBtn, printBtn.nextSibling);

    // Montrer/cacher en sync avec btnPrintReceipt
    const observer = new MutationObserver(() => {
      shareBtn.style.display = printBtn.classList.contains('hidden') ? 'none' : 'block';
    });
    observer.observe(printBtn, { attributes: true, attributeFilter: ['class'] });
  }

  // ══════════════════════════════════════
  // API PUBLIQUE
  // ══════════════════════════════════════
  window.partagerRecu = showShareModal;
  window.buildReceiptText = buildReceiptText;
  window.getLastReceipt   = () => _lastReceipt;

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    // Hooks sur les fonctions de vente (avec retry)
    window.addEventListener('load', () => {
      setTimeout(() => {
        hookFinaliserVente();
        hookFinaliserVenteCredit();
        injectShareButton();
      }, 500);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
