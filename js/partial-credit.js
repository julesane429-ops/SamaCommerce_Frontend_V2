/**
 * partial-credit.js — Paiement partiel sur crédit
 *
 * Injecte un bouton "💳 Paiement partiel" dans l'historique
 * des crédits (section Crédits). Permet de payer une partie
 * du montant dû sans solder entièrement le crédit.
 *
 * Affiche le solde restant sur chaque ligne de crédit.
 *
 * PRÉREQUIS :
 *   - Exécuter migrations/partial_payment.sql
 *   - Appliquer routes/sales_partial_patch.js dans routes/sales.js
 *
 * INTÉGRATION : <script src="js/partial-credit.js"></script>
 */
(function () {

  const API  = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth = (url, o={}) => window.authfetch(url, o);
  const ok_  = r => { if(!r.ok) throw new Error(r.status); return r.json(); };

  // ══════════════════════════════════════
  // MODALE PAIEMENT PARTIEL
  // ══════════════════════════════════════
  function openPartialPaymentModal(credit) {
    document.getElementById('partial-pay-modal')?.remove();

    const alreadyPaid  = +credit.amount_paid || 0;
    const remaining    = credit.total - alreadyPaid;
    const isPartial    = alreadyPaid > 0 && alreadyPaid < credit.total;

    const bd = document.createElement('div');
    bd.id = 'partial-pay-modal';
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">💳 Paiement partiel</div>

        <!-- Info crédit -->
        <div style="background:#F9FAFB;border-radius:16px;padding:14px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:700;color:var(--text);">
            👤 ${credit.client_name || '—'}
          </div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px;">
            📦 ${credit.product_name || '—'}
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:10px;">
            <div style="text-align:center;">
              <div style="font-size:11px;color:var(--muted);margin-bottom:3px;">Total dû</div>
              <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:#EF4444;">
                ${credit.total.toLocaleString('fr-FR')} F
              </div>
            </div>
            ${isPartial ? `
              <div style="text-align:center;">
                <div style="font-size:11px;color:var(--muted);margin-bottom:3px;">Déjà payé</div>
                <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:#10B981;">
                  ${alreadyPaid.toLocaleString('fr-FR')} F
                </div>
              </div>
            ` : ''}
            <div style="text-align:center;">
              <div style="font-size:11px;color:var(--muted);margin-bottom:3px;">Restant</div>
              <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:#F59E0B;">
                ${remaining.toLocaleString('fr-FR')} F
              </div>
            </div>
          </div>

          ${isPartial ? `
            <!-- Barre progression -->
            <div style="margin-top:10px;">
              <div style="height:6px;background:#E5E7EB;border-radius:999px;overflow:hidden;">
                <div style="height:100%;width:${Math.round(alreadyPaid/credit.total*100)}%;background:linear-gradient(90deg,#10B981,#059669);border-radius:999px;"></div>
              </div>
              <div style="font-size:10px;color:var(--muted);margin-top:4px;text-align:right;">
                ${Math.round(alreadyPaid/credit.total*100)}% remboursé
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Montant à payer -->
        <div class="form-group">
          <label>Montant à encaisser maintenant *</label>
          <input id="pp-amount" type="number" min="1" max="${remaining}"
            placeholder="Ex: 5000"
            style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;text-align:center;">
          <div style="font-size:11px;color:var(--muted);margin-top:6px;text-align:center;">
            Maximum : ${remaining.toLocaleString('fr-FR')} F
          </div>
        </div>

        <!-- Raccourcis montants -->
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
          ${[25, 50, 75, 100].map(pct => {
            const amt = Math.round(remaining * pct / 100);
            return `<button onclick="document.getElementById('pp-amount').value=${amt}"
              style="flex:1;min-width:60px;padding:8px 4px;background:#EDE9FE;color:#7C3AED;
              border:none;border-radius:10px;font-family:'Sora',sans-serif;
              font-size:11px;font-weight:700;cursor:pointer;">
              ${pct}%<br><span style="font-size:10px;">${amt.toLocaleString('fr-FR')} F</span>
            </button>`;
          }).join('')}
        </div>

        <!-- Mode de paiement -->
        <div class="form-group">
          <label>Mode de paiement</label>
          <select id="pp-method">
            <option value="especes">💵 Espèces</option>
            <option value="wave">📱 Wave</option>
            <option value="orange">📞 Orange Money</option>
          </select>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" id="pp-cancel">Annuler</button>
          <button class="btn-confirm" id="pp-confirm">✅ Valider</button>
        </div>
      </div>
    `;

    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if(e.target===bd) bd.remove(); });
    bd.querySelector('#pp-cancel').addEventListener('click', () => bd.remove());

    bd.querySelector('#pp-confirm').addEventListener('click', async () => {
      const amount = parseFloat(bd.querySelector('#pp-amount').value);
      const method = bd.querySelector('#pp-method').value;

      if (!amount || amount <= 0) {
        window.showNotification?.('Saisissez un montant', 'warning'); return;
      }
      if (amount > remaining) {
        window.showNotification?.(`Maximum ${remaining.toLocaleString('fr-FR')} F`, 'warning'); return;
      }

      const btn = bd.querySelector('#pp-confirm');
      btn.textContent = '⏳ Enregistrement…'; btn.disabled = true;

      try {
        const data = await auth(`${API()}/sales/${credit.id}/partial-payment`, {
          method: 'PATCH',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ amount, payment_method: method }),
        }).then(ok_);

        window.showNotification?.(data.message, 'success');
        bd.remove();

        // Resync
        await window.syncFromServer?.();
        window.renderCreditsHistory?.();
        window.afficherCredits?.();

      } catch (err) {
        window.showNotification?.(err.message || 'Erreur paiement', 'error');
        btn.textContent = '✅ Valider'; btn.disabled = false;
      }
    });
  }

  // ══════════════════════════════════════
  // INJECTER BOUTONS DANS L'HISTORIQUE CRÉDITS
  // ══════════════════════════════════════
  function injectPartialButtons() {
    const tbody = document.getElementById('creditsHistoryBody');
    if (!tbody) return;

    const obs = new MutationObserver(() => {
      tbody.querySelectorAll('tr:not([data-partial-injected])').forEach(row => {
        row.dataset.partialInjected = '1';

        // Trouver l'ID de la vente (depuis bouton rembourser existant)
        const actionBtns = row.querySelectorAll('button[onclick]');
        let saleId = null;
        actionBtns.forEach(btn => {
          const m = (btn.getAttribute('onclick')||'').match(/\d+/);
          if (m) saleId = parseInt(m[0]);
        });
        if (!saleId) return;

        // Récupérer le crédit depuis appData
        const credit = window.appData?.credits?.find(c => c.id === saleId)
          || window.appData?.ventes?.find(v => v.id === saleId && !v.paid);
        if (!credit || credit.paid) return;

        const alreadyPaid = +(credit.amount_paid || 0);
        const remaining   = credit.total - alreadyPaid;

        // Créer le bouton paiement partiel
        const btn = document.createElement('button');
        btn.style.cssText = `
          background:#EDE9FE;color:#7C3AED;border:none;
          padding:4px 8px;border-radius:7px;
          font-size:11px;font-weight:700;cursor:pointer;margin-left:4px;
          white-space:nowrap;
        `;
        btn.innerHTML = alreadyPaid > 0
          ? `💳 ${Math.round(alreadyPaid/credit.total*100)}%`
          : '💳 Partiel';
        btn.title = `Paiement partiel — Reste: ${remaining.toLocaleString('fr-FR')} F`;

        btn.addEventListener('click', e => {
          e.stopPropagation();
          openPartialPaymentModal({
            ...credit,
            product_name: row.querySelector('td:nth-child(3)')?.textContent?.trim() || '—',
          });
        });

        const actCell = row.querySelector('td:last-child');
        if (actCell) actCell.appendChild(btn);

        // Afficher le solde restant dans la cellule montant
        if (alreadyPaid > 0 && !credit.paid) {
          const amountCell = row.querySelector('td:nth-child(5)');
          if (amountCell) {
            const restTag = document.createElement('div');
            restTag.style.cssText = 'font-size:10px;color:#F59E0B;font-weight:700;margin-top:2px;';
            restTag.textContent = `Reste: ${remaining.toLocaleString('fr-FR')} F`;
            amountCell.appendChild(restTag);
          }
        }
      });
    });

    obs.observe(tbody, { childList: true });
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    injectPartialButtons();
    window.addEventListener('pageChange', e => {
      if (e.detail?.key === 'credits') setTimeout(injectPartialButtons, 300);
    });

    // Exposer globalement
    window.openPartialPaymentModal = openPartialPaymentModal;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
