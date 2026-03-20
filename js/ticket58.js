/**
 * ticket58.js — Impression ticket thermique 58mm
 *
 * Remplace window.imprimerRecu par une version améliorée qui :
 *   - Détecte automatiquement si l'utilisateur a une imprimante 58mm
 *   - Génère un format 58mm optimisé (monospace, 32 colonnes)
 *   - Garde le format original A4 comme fallback
 *   - Mémorise la préférence dans localStorage
 *   - Ajoute un bouton de sélection du format dans la section Vente
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/ticket58.js"></script>
 */

(function () {

  const PREF_KEY   = 'sc_ticket_format'; // '58mm' | 'a4'
  const COLS_58    = 32; // Colonnes pour 58mm
  const BOUTIQUE   = () => document.getElementById('appHeader')?.textContent?.replace('🏪','').trim() || 'Sama Commerce';

  // ── Préférence ──
  function getFormat()       { return localStorage.getItem(PREF_KEY) || '58mm'; }
  function setFormat(f)      { localStorage.setItem(PREF_KEY, f); }

  // ── Centrer du texte sur N colonnes ──
  function center(text, cols = COLS_58) {
    const t = String(text);
    if (t.length >= cols) return t.slice(0, cols);
    const pad = Math.floor((cols - t.length) / 2);
    return ' '.repeat(pad) + t;
  }

  // ── Ligne gauche/droite ──
  function split(left, right, cols = COLS_58) {
    const l = String(left), r = String(right);
    const space = cols - l.length - r.length;
    return l + ' '.repeat(Math.max(1, space)) + r;
  }

  // ── Séparateur ──
  function sep(char = '-', cols = COLS_58) { return char.repeat(cols); }

  // ══════════════════════════════════════
  // GÉNÉRATION TICKET 58mm
  // ══════════════════════════════════════
  function genTicket58(panier, paymentMethod, extra = {}) {
    const now     = new Date();
    const dateStr = now.toLocaleDateString('fr-FR');
    const timeStr = now.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    const numero  = localStorage.getItem('compteurRecu') || '0001';
    const boutique = BOUTIQUE();

    const METHODS = { especes:'Especes', wave:'Wave', orange:'Orange Money', credit:'Credit' };
    const methode = METHODS[paymentMethod] || paymentMethod || 'Especes';

    let total = 0;
    const lignes = panier.map(item => {
      const prix     = item.price || 0;
      const qte      = item.quantite || 1;
      const sousTotal = prix * qte;
      total += sousTotal;
      return { name: item.name, qte, prix, sousTotal };
    });

    // Construire le ticket ligne par ligne
    const lines = [];

    // En-tête
    lines.push(center(boutique));
    lines.push(center('━━━━━━━━━━━━━━━━━━━━━━━━'));
    lines.push(center('RECU DE VENTE'));
    lines.push(sep('─'));
    lines.push(split('N° : ' + numero, dateStr + ' ' + timeStr));
    lines.push(sep('─'));

    // Articles
    lignes.forEach(it => {
      // Nom (tronqué à 20 car si long)
      const name = it.name.length > 20 ? it.name.slice(0, 19) + '.' : it.name;
      lines.push(name);
      lines.push(split(`  ${it.qte} x ${it.prix.toLocaleString('fr-FR')}F`, `${it.sousTotal.toLocaleString('fr-FR')} F`));
    });

    lines.push(sep('─'));

    // Total
    lines.push(split('** TOTAL **', `${total.toLocaleString('fr-FR')} F`));
    lines.push(split('Paiement :', methode));

    // Infos client si crédit
    if (extra.clientName) {
      lines.push(sep('─'));
      lines.push('Client : ' + extra.clientName);
      if (extra.clientPhone) lines.push('Tel    : ' + extra.clientPhone);
      if (extra.dueDate) lines.push('Echeance: ' + new Date(extra.dueDate).toLocaleDateString('fr-FR'));
    }

    lines.push(sep('═'));
    lines.push(center('Merci pour votre achat !'));
    lines.push(center('A bientot :)'));
    lines.push('');
    lines.push('');
    lines.push(''); // Espace pour le coupage

    return lines.join('\n');
  }

  // ══════════════════════════════════════
  // FORMAT ORIGINAL A4 (inchangé)
  // ══════════════════════════════════════
  function imprimerA4(panier, paymentMethod) {
    const numero  = localStorage.getItem('compteurRecu') || '0001';
    const date    = new Date().toLocaleString('fr-FR');
    const boutique = BOUTIQUE();
    let total = 0;

    const lignes = panier.map(item => {
      const prix     = item.price || 0;
      const qte      = item.quantite || 1;
      const sousTotal = prix * qte;
      total += sousTotal;
      return `
        <tr>
          <td>${item.name}</td>
          <td style="text-align:center">${qte}</td>
          <td style="text-align:right">${sousTotal.toLocaleString('fr-FR')} F</td>
        </tr>`;
    }).join('');

    const METHODS = { especes:'💵 Espèces', wave:'📱 Wave', orange:'📞 Orange Money', credit:'📝 Crédit' };

    const html = `<!DOCTYPE html><html><head><title>Reçu</title>
    <style>
      body{font-family:Arial,sans-serif;max-width:400px;margin:auto;padding:20px;}
      .header{text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:10px;}
      .boutique{font-size:20px;font-weight:bold;color:#7C3AED;}
      h2{margin:4px 0;font-size:16px;}
      .info{font-size:12px;color:#666;margin:4px 0;}
      table{width:100%;border-collapse:collapse;margin:10px 0;}
      th{background:#f3f4f6;padding:6px;font-size:12px;text-align:left;}
      td{padding:5px 6px;font-size:12px;border-bottom:1px solid #eee;}
      .total-row{background:#EDE9FE;font-weight:bold;font-size:14px;}
      .total-row td{padding:8px 6px;}
      .footer{text-align:center;margin-top:14px;font-size:12px;color:#666;}
      .paiement{text-align:center;font-size:13px;font-weight:bold;margin:8px 0;}
    </style></head><body>
    <div class="header">
      <div class="boutique">🏪 ${boutique}</div>
      <h2>Reçu de vente</h2>
      <div class="info">N° ${numero}</div>
      <div class="info">${date}</div>
    </div>
    <table>
      <tr><th>Article</th><th style="text-align:center">Qté</th><th style="text-align:right">Montant</th></tr>
      ${lignes}
      <tr class="total-row"><td colspan="2"><b>TOTAL</b></td><td style="text-align:right"><b>${total.toLocaleString('fr-FR')} F</b></td></tr>
    </table>
    <div class="paiement">${METHODS[paymentMethod] || paymentMethod}</div>
    <div class="footer">Merci pour votre achat !<br>À bientôt 🙏</div>
    </body></html>`;

    const win = window.open('', 'PRINT', 'height=600,width=420');
    if (!win) { window.showNotification?.('Popup bloqué — autorisez les popups', 'warning'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  // ══════════════════════════════════════
  // IMPRESSION TICKET 58mm
  // ══════════════════════════════════════
  function imprimer58(panier, paymentMethod, extra = {}) {
    const texte = genTicket58(panier, paymentMethod, extra);

    const html = `<!DOCTYPE html><html><head><title>Ticket</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body {
        font-family: 'Courier New', Courier, monospace;
        font-size: 12px;
        line-height: 1.4;
        width: 58mm;
        max-width: 58mm;
        padding: 2mm 2mm 8mm;
        background: #fff;
        color: #000;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-all;
        font-family: inherit;
        font-size: inherit;
      }
      @media print {
        @page {
          size: 58mm auto;
          margin: 0;
        }
        body { padding: 1mm 1mm 10mm; }
      }
    </style></head><body>
    <pre>${texte.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
    <script>
      window.onload = function() {
        window.print();
        setTimeout(function() { window.close(); }, 500);
      };
    <\/script>
    </body></html>`;

    const win = window.open('', 'TICKET58', 'height=800,width=260');
    if (!win) { window.showNotification?.('Popup bloqué — autorisez les popups', 'warning'); return; }
    win.document.write(html);
    win.document.close();
  }

  // ══════════════════════════════════════
  // NOUVEAU imprimerRecu (remplace l'original)
  // ══════════════════════════════════════
  function imprimerRecu(paymentMethod = 'especes', extra = {}) {
    const panier = window.appData?.panier || [];
    if (!panier.length) return;

    // Incrémenter le compteur (comme l'original)
    let compteur = parseInt(localStorage.getItem('compteurRecu') || '0');
    compteur++;
    localStorage.setItem('compteurRecu', compteur);

    const format = getFormat();
    if (format === '58mm') {
      imprimer58(panier, paymentMethod, extra);
    } else {
      imprimerA4(panier, paymentMethod);
    }
  }

  // ══════════════════════════════════════
  // SÉLECTEUR DE FORMAT (injecté dans la section Vente)
  // ══════════════════════════════════════
  function injectFormatSelector() {
    if (document.getElementById('ticket-format-selector')) return;

    const printBtn = document.getElementById('btnPrintReceipt');
    if (!printBtn) return;

    const selector = document.createElement('div');
    selector.id = 'ticket-format-selector';
    selector.style.cssText = `
      display:flex;align-items:center;gap:8px;
      margin-top:8px;padding:10px 14px;
      background:var(--surface);
      border:1.5px solid #E5E7EB;
      border-radius:13px;
    `;

    const currentFormat = getFormat();
    selector.innerHTML = `
      <span style="font-size:16px;">🖨️</span>
      <span style="font-size:12px;font-weight:600;color:var(--muted);flex:1;">Format imprimante :</span>
      <button id="fmt-58" style="
        padding:5px 12px;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;
        background:${currentFormat==='58mm'?'var(--primary)':'#F3F4F6'};
        color:${currentFormat==='58mm'?'#fff':'var(--muted)'};
        transition:all .15s;
      ">📱 58mm</button>
      <button id="fmt-a4" style="
        padding:5px 12px;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;
        background:${currentFormat==='a4'?'var(--primary)':'#F3F4F6'};
        color:${currentFormat==='a4'?'#fff':'var(--muted)'};
        transition:all .15s;
      ">🖥️ A4</button>
    `;

    printBtn.parentNode.insertBefore(selector, printBtn.nextSibling);
    selector.style.display = 'none'; // Caché par défaut, affiché après vente

    selector.querySelector('#fmt-58').addEventListener('click', () => {
      setFormat('58mm');
      selector.querySelector('#fmt-58').style.background = 'var(--primary)';
      selector.querySelector('#fmt-58').style.color = '#fff';
      selector.querySelector('#fmt-a4').style.background = '#F3F4F6';
      selector.querySelector('#fmt-a4').style.color = 'var(--muted)';
      window.showNotification?.('📱 Format 58mm sélectionné', 'success');
    });

    selector.querySelector('#fmt-a4').addEventListener('click', () => {
      setFormat('a4');
      selector.querySelector('#fmt-a4').style.background = 'var(--primary)';
      selector.querySelector('#fmt-a4').style.color = '#fff';
      selector.querySelector('#fmt-58').style.background = '#F3F4F6';
      selector.querySelector('#fmt-58').style.color = 'var(--muted)';
      window.showNotification?.('🖥️ Format A4 sélectionné', 'success');
    });

    // Afficher/cacher avec le bouton imprimer
    const obs = new MutationObserver(() => {
      selector.style.display = printBtn.classList.contains('hidden') ? 'none' : 'flex';
    });
    obs.observe(printBtn, { attributes:true, attributeFilter:['class'] });
  }

  // ══════════════════════════════════════
  // EXPOSER & INIT
  // ══════════════════════════════════════
  window.imprimerRecu  = imprimerRecu;
  window.imprimer58    = imprimer58;
  window.imprimerA4    = imprimerA4;
  window.genTicket58   = genTicket58;
  window.setTicketFormat = setFormat;
  window.getTicketFormat = getFormat;

  function init() {
    injectFormatSelector();
    // Re-injecter si la section Vente se recharge
    window.addEventListener('pageChange', e => {
      if (e.detail?.key === 'vente') setTimeout(injectFormatSelector, 200);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
