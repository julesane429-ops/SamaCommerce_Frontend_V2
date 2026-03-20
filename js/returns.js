/**
 * returns.js — Gestion des retours produits
 *
 * Depuis la section Chiffres → Historique des ventes :
 *   - Bouton "↩️ Retour" sur chaque vente
 *   - Modale de retour partiel ou total
 *   - Recrédite le stock automatiquement
 *   - Visible dans le bilan caisse
 *
 * INTÉGRATION : <script src="js/returns.js"></script>
 */

(function () {

  const API    = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth   = (url, o={}) => window.authfetch(url, o);
  const notify = (m, t) => window.showNotification?.(m, t);
  const ok_    = r => { if(!r.ok) throw new Error(r.status); return r.json(); };

  // ══════════════════════════════════════
  // OUVRIR MODALE RETOUR
  // ══════════════════════════════════════
  function openReturnModal(sale) {
    const bd = document.createElement('div');
    bd.className = 'module-sheet-backdrop';
    bd.innerHTML = `
      <div class="module-sheet">
        <div class="module-sheet-pill"></div>
        <div class="module-sheet-title">↩️ Retour produit</div>

        <!-- Info vente -->
        <div style="background:#F9FAFB;border-radius:14px;padding:14px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:700;color:var(--text);">📦 ${sale.product_name || '—'}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px;">
            Qté vendue : ${sale.quantity} · Total : ${(sale.total||0).toLocaleString('fr-FR')} F
          </div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">
            📅 ${new Date(sale.created_at).toLocaleDateString('fr-FR')}
          </div>
        </div>

        <div class="form-group">
          <label>Quantité à retourner *</label>
          <input id="ret-qty" type="number" min="1" max="${sale.quantity}" value="1" placeholder="Quantité">
        </div>

        <div class="form-group">
          <label>Motif du retour</label>
          <select id="ret-reason">
            <option value="defaut">🔧 Défaut / Problème qualité</option>
            <option value="erreur">❌ Erreur de produit</option>
            <option value="insatisfaction">😕 Insatisfaction client</option>
            <option value="autre">📝 Autre</option>
          </select>
        </div>

        <div class="form-group">
          <label>Mode de remboursement</label>
          <select id="ret-refund">
            <option value="avoir">📋 Avoir (crédit en boutique)</option>
            <option value="especes">💵 Espèces</option>
            <option value="wave">📱 Wave</option>
            <option value="orange">📞 Orange Money</option>
          </select>
        </div>

        <!-- Aperçu montant -->
        <div id="ret-preview" style="
          background:linear-gradient(135deg,#FEF3C7,#FFFBEB);
          border-radius:12px;padding:12px;margin-bottom:16px;
          display:flex;justify-content:space-between;align-items:center;
          border:1.5px solid #FDE68A;
        ">
          <div style="font-size:13px;font-weight:700;color:#92400E;">↩️ Montant remboursé</div>
          <div id="ret-amount-preview" style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:#D97706;">
            ${Math.round(sale.total/sale.quantity).toLocaleString('fr-FR')} F
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" id="ret-cancel">Annuler</button>
          <button class="btn-confirm" id="ret-confirm">✅ Valider le retour</button>
        </div>
      </div>
    `;

    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if(e.target===bd) bd.remove(); });
    bd.querySelector('#ret-cancel').addEventListener('click', ()=>bd.remove());

    // Mettre à jour l'aperçu en temps réel
    const qtyInput = bd.querySelector('#ret-qty');
    const preview  = bd.querySelector('#ret-amount-preview');
    const unitPrice = sale.total / sale.quantity;

    qtyInput.addEventListener('input', () => {
      const qty = Math.min(Math.max(parseInt(qtyInput.value)||1, 1), sale.quantity);
      preview.textContent = `${Math.round(unitPrice * qty).toLocaleString('fr-FR')} F`;
    });

    bd.querySelector('#ret-confirm').addEventListener('click', async () => {
      const qty    = Math.min(Math.max(parseInt(qtyInput.value)||1, 1), sale.quantity);
      const reason = bd.querySelector('#ret-reason').value;
      const method = bd.querySelector('#ret-refund').value;

      try {
        const data = await auth(`${API()}/returns`, {
          method:  'POST',
          headers: { 'Content-Type':'application/json' },
          body:    JSON.stringify({ sale_id: sale.id, quantity: qty, reason, refund_method: method }),
        }).then(ok_);

        notify(`✅ ${data.message}`, 'success');
        bd.remove();

        // Resync appData
        await window.syncFromServer?.();
        window.renderSalesHistory?.();
      } catch (err) {
        notify(err.message === '400' ? 'Quantité invalide' : 'Erreur retour', 'error');
      }
    });
  }

  // ══════════════════════════════════════
  // INJECTER BOUTON RETOUR DANS L'HISTORIQUE
  // ══════════════════════════════════════
  function injectReturnButtons() {
    const tbody = document.getElementById('salesHistoryBody');
    if (!tbody) return;

    const obs = new MutationObserver(() => {
      tbody.querySelectorAll('tr:not([data-return-injected])').forEach(row => {
        row.dataset.returnInjected = '1';

        // Récupérer l'ID de la vente depuis le bouton d'annulation existant
        const cancelBtn = row.querySelector('[onclick*="annulerVente"]');
        if (!cancelBtn) return;
        const m = (cancelBtn.getAttribute('onclick')||'').match(/\d+/);
        if (!m) return;
        const saleId = parseInt(m[0]);

        // Trouver la vente dans appData
        const sale = window.appData?.ventes?.find(v => v.id === saleId);
        if (!sale || sale.quantity === 0) return; // déjà annulée

        // Créer le bouton retour
        const btn = document.createElement('button');
        btn.style.cssText = `
          background:#FEF3C7;color:#D97706;border:none;
          padding:4px 8px;border-radius:7px;font-size:11px;font-weight:700;
          cursor:pointer;margin-left:4px;
        `;
        btn.textContent = '↩️';
        btn.title       = 'Enregistrer un retour';
        btn.addEventListener('click', e => {
          e.stopPropagation();
          openReturnModal(sale);
        });

        // Ajouter dans la cellule Actions
        const actCell = row.querySelector('td:last-child');
        if (actCell) actCell.appendChild(btn);
      });
    });

    obs.observe(tbody, { childList:true });
  }

  // ══════════════════════════════════════
  // API PUBLIQUE
  // ══════════════════════════════════════
  window.openReturnModal    = openReturnModal;
  window.returnsModule      = { inject: injectReturnButtons };

  function init() {
    injectReturnButtons();
    window.addEventListener('pageChange', e => {
      if (e.detail?.key === 'rapports') setTimeout(injectReturnButtons, 400);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
