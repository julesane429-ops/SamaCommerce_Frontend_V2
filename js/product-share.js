/**
 * product-share.js — Fiche produit partageable
 *
 * Génère une image Canvas d'une fiche produit et propose
 * de la partager via WhatsApp, Facebook ou de la télécharger.
 *
 * Déclenché depuis :
 *   - Bouton "📤 Partager" dans les cartes produit
 *   - window.shareProduct(produit)
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/product-share.js"></script>
 */

(function () {

  // ══════════════════════════════════════
  // GÉNÉRATION CANVAS
  // ══════════════════════════════════════
  function generateProductCard(produit, categorie) {
    const W = 800, H = 800;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    const boutique = document.getElementById('appHeader')?.textContent?.replace('🏪','').trim() || 'Sama Commerce';

    // ── Fond dégradé ──
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#5B21B6');
    grad.addColorStop(.55, '#7C3AED');
    grad.addColorStop(1, '#EC4899');
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, W, H, 32);
    ctx.fill();

    // ── Blob déco ──
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.beginPath(); ctx.arc(650, 120, 180, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(100, 680, 150, 0, Math.PI*2); ctx.fill();

    // ── Carte produit (fond blanc) ──
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    roundRect(ctx, 60, 180, W-120, 460, 28);
    ctx.fill();

    // ── Emoji catégorie ──
    ctx.font = '90px serif';
    ctx.textAlign = 'center';
    ctx.fillText(categorie?.emoji || '📦', W/2, 310);

    // ── Nom produit ──
    ctx.fillStyle = '#1E1B4B';
    ctx.font = 'bold 44px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    const name = produit.name.length > 22 ? produit.name.slice(0,21)+'…' : produit.name;
    ctx.fillText(name, W/2, 385);

    // ── Catégorie ──
    if (categorie) {
      ctx.font = '26px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#7C3AED';
      ctx.fillText(categorie.name, W/2, 425);
    }

    // ── Séparateur ──
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(120, 455); ctx.lineTo(680, 455);
    ctx.stroke();

    // ── Prix ──
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 62px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${(produit.price||0).toLocaleString('fr-FR')} F`, W/2, 540);

    // ── Stock badge ──
    const stockOk = (produit.stock||0) > 5;
    const stockColor = produit.stock === 0 ? '#EF4444' : stockOk ? '#10B981' : '#F59E0B';
    const stockText  = produit.stock === 0 ? '⛔ Rupture de stock'
                     : stockOk ? `✅ En stock (${produit.stock})`
                     : `⚠️ Stock limité (${produit.stock})`;

    ctx.fillStyle = produit.stock === 0 ? '#FEF2F2' : stockOk ? '#ECFDF5' : '#FFFBEB';
    roundRect(ctx, W/2 - 160, 570, 320, 48, 24);
    ctx.fill();
    ctx.fillStyle = stockColor;
    ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText(stockText, W/2, 601);

    // ── En-tête boutique ──
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`🏪 ${boutique}`, W/2, 100);

    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.font = '22px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Contactez-nous pour commander', W/2, 138);

    // ── Contact (si disponible) ──
    const phone = window.appData?.profile?.phone ||
                  document.getElementById('profil-phone')?.value ||
                  localStorage.getItem('sc_phone') || '';

    if (phone) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = '26px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`📞 ${phone}`, W/2, 720);
    }

    // ── Hashtag ──
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font = '20px "Segoe UI", Arial, sans-serif';
    ctx.fillText('#SamaCommerce #BoutiqueEnLigne', W/2, 770);

    // ── Watermark coin ──
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.font = '18px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Sama Commerce', W - 30, H - 20);

    return canvas;
  }

  // ── Helper roundRect ──
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ══════════════════════════════════════
  // MODAL DE PARTAGE
  // ══════════════════════════════════════
  async function shareProduct(produit) {
    const cat    = window.appData?.categories?.find(c => c.id === produit.category_id);
    const canvas = generateProductCard(produit, cat);
    const imgUrl = canvas.toDataURL('image/png');
    const boutique = document.getElementById('appHeader')?.textContent?.replace('🏪','').trim() || 'Sama Commerce';

    // Message texte WhatsApp
    const phone = localStorage.getItem('sc_phone') || '';
    const msgWA = `🏪 *${boutique}*\n\n` +
      `📦 *${produit.name}*\n` +
      `${cat ? cat.emoji + ' ' + cat.name + '\n' : ''}` +
      `💰 Prix : *${(produit.price||0).toLocaleString('fr-FR')} F*\n` +
      `${produit.stock > 0 ? '✅ Disponible' : '⛔ Rupture de stock'}\n\n` +
      `Contactez-nous pour commander 🛍️` +
      (phone ? `\n📞 ${phone}` : '') +
      `\n\n_Sama Commerce_`;

    // Supprimer modal existante
    document.getElementById('product-share-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'product-share-modal';
    modal.style.cssText = `
      position:fixed; inset:0;
      background:rgba(10,7,30,.7);
      backdrop-filter:blur(8px);
      z-index:700;
      display:flex; flex-direction:column;
      justify-content:flex-end; align-items:center;
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
        <div style="width:36px;height:4px;background:#E5E7EB;border-radius:2px;margin:0 auto 14px;"></div>
        <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:var(--text);text-align:center;margin-bottom:14px;">
          📤 Partager ${produit.name}
        </div>

        <!-- Aperçu image -->
        <div style="
          border-radius:16px;overflow:hidden;margin-bottom:16px;
          box-shadow:0 8px 24px rgba(0,0,0,.15);
        ">
          <img id="share-preview-img" src="${imgUrl}"
            style="width:100%;display:block;border-radius:16px;"
            alt="Aperçu">
        </div>

        <!-- Boutons -->
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">

          <!-- WhatsApp -->
          <a href="https://wa.me/?text=${encodeURIComponent(msgWA)}"
             target="_blank" rel="noopener"
             style="
               display:flex;align-items:center;justify-content:center;gap:10px;
               background:linear-gradient(135deg,#25D366,#128C7E);
               color:#fff;text-decoration:none;padding:14px;border-radius:14px;
               font-family:'Sora',sans-serif;font-size:14px;font-weight:700;
               box-shadow:0 4px 14px rgba(37,211,102,.3);
             " onclick="document.getElementById('product-share-modal').remove();">
            <span style="font-size:22px;">💬</span>
            Partager sur WhatsApp
          </a>

          <!-- Télécharger l'image -->
          <button id="share-download" style="
            display:flex;align-items:center;justify-content:center;gap:10px;
            background:#EDE9FE;color:#7C3AED;
            border:none;padding:14px;border-radius:14px;
            font-family:'Sora',sans-serif;font-size:14px;font-weight:700;
            cursor:pointer;width:100%;
          ">
            <span style="font-size:20px;">📥</span>
            Télécharger l'image
          </button>

          <!-- Copier le texte -->
          <button id="share-copy-txt" style="
            display:flex;align-items:center;justify-content:center;gap:10px;
            background:#F3F4F6;color:#6B7280;
            border:none;padding:12px;border-radius:14px;
            font-family:'Sora',sans-serif;font-size:13px;font-weight:600;
            cursor:pointer;width:100%;
          ">
            <span style="font-size:18px;">📋</span>
            Copier le texte
          </button>
        </div>

        <button id="share-close" style="
          width:100%;padding:13px;
          background:#F9FAFB;color:#6B7280;
          border:none;border-radius:14px;
          font-family:'Sora',sans-serif;font-size:14px;font-weight:600;
          cursor:pointer;
        ">Fermer</button>
      </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
    modal.querySelector('#share-close').addEventListener('click', ()=>modal.remove());

    // Télécharger
    modal.querySelector('#share-download').addEventListener('click', () => {
      const link = document.createElement('a');
      link.download = `${produit.name.replace(/\s+/g,'_')}_${boutique.replace(/\s+/g,'_')}.png`;
      link.href = imgUrl;
      link.click();
      modal.remove();
    });

    // Copier texte
    modal.querySelector('#share-copy-txt').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(msgWA);
        const btn = modal.querySelector('#share-copy-txt');
        btn.innerHTML = '<span style="font-size:18px;">✅</span> Copié !';
        btn.style.background = '#ECFDF5';
        btn.style.color = '#059669';
        setTimeout(() => modal.remove(), 1500);
      } catch {
        window.showNotification?.('📋 Texte copié', 'success');
        modal.remove();
      }
    });

    // Web Share API si disponible (iOS/Android natif)
    if (navigator.canShare) {
      canvas.toBlob(async blob => {
        const file = new File([blob], `${produit.name}.png`, {type:'image/png'});
        if (navigator.canShare({files:[file]})) {
          // Remplacer le bouton WhatsApp par Share natif
          const waBtn = modal.querySelector('a[href*="wa.me"]');
          if (waBtn) {
            const nativeBtn = document.createElement('button');
            nativeBtn.style.cssText = waBtn.style.cssText.replace('text-decoration:none;', '');
            nativeBtn.style.background = 'linear-gradient(135deg,#7C3AED,#EC4899)';
            nativeBtn.style.boxShadow  = '0 4px 14px rgba(124,58,237,.3)';
            nativeBtn.innerHTML = '<span style="font-size:22px;">📤</span><span style="font-family:\'Sora\',sans-serif;font-size:14px;font-weight:700;color:#fff;">Partager (WhatsApp / FB / …)</span>';
            nativeBtn.addEventListener('click', async () => {
              try {
                await navigator.share({ files:[file], title:produit.name, text:msgWA });
              } catch {}
              modal.remove();
            });
            waBtn.parentNode.insertBefore(nativeBtn, waBtn);
            waBtn.style.display = 'none';
          }
        }
      }, 'image/png');
    }
  }

  // ══════════════════════════════════════
  // INJECTER LE BOUTON PARTAGER SUR LES CARTES PRODUIT
  // Via MutationObserver sur #listeProduits
  // ══════════════════════════════════════
  function injectShareButtons() {
    const list = document.getElementById('listeProduits');
    if (!list) return;

    const obs = new MutationObserver(() => {
      list.querySelectorAll('.product-card, [data-produit-id]').forEach(card => {
        if (card.querySelector('.btn-share-product')) return;

        // Trouver l'ID du produit depuis les boutons d'action existants
        const editBtn = card.querySelector('[onclick*="ouvrirModalEdit"], [onclick*="mettreAJourProduit"]');
        const delBtn  = card.querySelector('[onclick*="supprimerProduit"]');

        // Extraire l'ID depuis l'attribut onclick
        let prodId = null;
        [editBtn, delBtn].forEach(btn => {
          if (btn && !prodId) {
            const m = (btn.getAttribute('onclick')||'').match(/\d+/);
            if (m) prodId = parseInt(m[0]);
          }
        });

        if (!prodId) return;

        const shareBtn = document.createElement('button');
        shareBtn.className = 'btn-share-product';
        shareBtn.style.cssText = `
          background:#EDE9FE; color:#7C3AED;
          border:none; padding:5px 10px;
          border-radius:8px; font-size:11px; font-weight:700;
          cursor:pointer; margin-left:4px;
          transition:transform .12s;
        `;
        shareBtn.innerHTML = '📤';
        shareBtn.title = 'Partager ce produit';
        shareBtn.addEventListener('click', e => {
          e.stopPropagation();
          const prod = window.appData?.produits?.find(p => p.id === prodId);
          if (prod) shareProduct(prod);
        });

        // Insérer à côté des boutons d'action existants
        const actionZone = editBtn?.parentNode || delBtn?.parentNode;
        if (actionZone) actionZone.appendChild(shareBtn);
      });
    });

    obs.observe(list, { childList:true, subtree:true });
  }

  // ══════════════════════════════════════
  // EXPOSER
  // ══════════════════════════════════════
  window.shareProduct = shareProduct;

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    injectShareButtons();
    window.addEventListener('pageChange', e => {
      if (e.detail?.key === 'stock') setTimeout(injectShareButtons, 300);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
