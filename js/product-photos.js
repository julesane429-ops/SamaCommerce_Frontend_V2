/**
 * product-photos.js — Photos produits
 *
 * Permet d'ajouter une photo à chaque produit :
 *   - Upload depuis la galerie ou l'appareil photo
 *   - Compression automatique (max 400x400px, qualité 0.75)
 *   - Stockage en base64 dans la colonne image_url (PATCH /products/:id)
 *   - Affichage dans la liste Stock et les modales
 *   - Intégration avec product-share.js (image utilisée dans la fiche partageable)
 *
 * PRÉREQUIS :
 *   1. Exécuter migrations/add_product_image.sql dans Supabase
 *   2. Appliquer PATCH_products_backend.js dans routes/products.js
 *   3. <script src="js/product-photos.js"></script> avant </body>
 */

(function () {

  const API  = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const auth = (url, o={}) => window.authfetch?.(url, o);
  const ok_  = r => { if (!r.ok) throw new Error(r.status); return r.json(); };

  // ══════════════════════════════════════
  // COMPRESSION IMAGE
  // ══════════════════════════════════════
  function compressImage(file, maxSize = 400, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > h) { if (w > maxSize) { h *= maxSize/w; w = maxSize; } }
          else       { if (h > maxSize) { w *= maxSize/h; h = maxSize; } }
          canvas.width = Math.round(w);
          canvas.height = Math.round(h);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ══════════════════════════════════════
  // UPLOAD PHOTO
  // ══════════════════════════════════════
  async function uploadPhoto(produitId, file) {
    try {
      const base64 = await compressImage(file);
      await auth(`${API()}/products/${produitId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image_url: base64 }),
      }).then(ok_);

      // Mettre à jour en mémoire
      const produit = window.appData?.produits?.find(p => p.id === produitId);
      if (produit) produit.image_url = base64;

      window.showNotification?.('✅ Photo mise à jour', 'success');
      return base64;
    } catch (err) {
      window.showNotification?.('Erreur upload photo', 'error');
      throw err;
    }
  }

  // ══════════════════════════════════════
  // SUPPRIMER PHOTO
  // ══════════════════════════════════════
  async function deletePhoto(produitId) {
    try {
      await auth(`${API()}/products/${produitId}/image`, { method: 'DELETE' }).then(ok_);
      const produit = window.appData?.produits?.find(p => p.id === produitId);
      if (produit) produit.image_url = null;
      window.showNotification?.('🗑️ Photo supprimée', 'success');
    } catch {
      window.showNotification?.('Erreur suppression photo', 'error');
    }
  }

  // ══════════════════════════════════════
  // INPUT FILE (caché)
  // ══════════════════════════════════════
  let fileInput = null;
  let pendingCallback = null;

  function getFileInput() {
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type    = 'file';
      fileInput.accept  = 'image/*';
      fileInput.capture = 'environment'; // Ouvrir la caméra par défaut sur mobile
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file || !pendingCallback) return;
        pendingCallback(file);
        pendingCallback = null;
        fileInput.value = '';
      });
    }
    return fileInput;
  }

  function pickImage(callback) {
    pendingCallback = callback;
    getFileInput().click();
  }

  // ══════════════════════════════════════
  // MODALE DE GESTION PHOTO
  // ══════════════════════════════════════
  function openPhotoModal(produit) {
    document.getElementById('photo-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'photo-modal';
    modal.style.cssText = `
      position:fixed;inset:0;
      background:rgba(10,7,30,.7);
      backdrop-filter:blur(8px);
      z-index:600;
      display:flex;flex-direction:column;
      justify-content:flex-end;align-items:center;
      padding-bottom:calc(var(--nav-h,68px)+var(--safe-b,0px));
    `;

    const hasPhoto = !!produit.image_url;

    modal.innerHTML = `
      <div style="
        background:var(--surface,#fff);
        border-radius:24px 24px 0 0;
        padding:10px 20px 28px;
        width:100%;max-width:480px;
        animation:moduleSheetUp .3s cubic-bezier(.34,1.3,.64,1) both;
      ">
        <div style="width:36px;height:4px;background:#E5E7EB;border-radius:2px;margin:0 auto 16px;"></div>
        <div style="font-family:'Sora',sans-serif;font-size:17px;font-weight:800;color:var(--text);text-align:center;margin-bottom:16px;">
          📷 Photo — ${produit.name}
        </div>

        <!-- Aperçu actuel -->
        <div id="photo-preview" style="
          width:100%;height:200px;border-radius:18px;
          background:#F3F4F6;
          display:flex;align-items:center;justify-content:center;
          margin-bottom:16px;overflow:hidden;position:relative;
          border:2px dashed #E5E7EB;
        ">
          ${hasPhoto ? `
            <img src="${produit.image_url}"
              style="width:100%;height:100%;object-fit:cover;border-radius:16px;"
              alt="${produit.name}">
          ` : `
            <div style="text-align:center;color:var(--muted);">
              <div style="font-size:48px;margin-bottom:8px;">📷</div>
              <div style="font-size:13px;font-weight:600;">Aucune photo</div>
            </div>
          `}
        </div>

        <!-- Actions -->
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">

          <!-- Depuis la galerie -->
          <button id="photo-gallery" style="
            display:flex;align-items:center;gap:12px;
            background:#EDE9FE;color:#7C3AED;
            border:none;padding:14px;border-radius:14px;
            font-family:'Sora',sans-serif;font-size:14px;font-weight:700;
            cursor:pointer;
          ">
            <span style="font-size:22px;">🖼️</span>
            <div style="text-align:left;">
              <div>Choisir depuis la galerie</div>
              <div style="font-size:11px;font-weight:500;opacity:.7;">JPG, PNG, WEBP</div>
            </div>
          </button>

          <!-- Prendre une photo -->
          <button id="photo-camera" style="
            display:flex;align-items:center;gap:12px;
            background:#EFF6FF;color:#2563EB;
            border:none;padding:14px;border-radius:14px;
            font-family:'Sora',sans-serif;font-size:14px;font-weight:700;
            cursor:pointer;
          ">
            <span style="font-size:22px;">📷</span>
            <div style="text-align:left;">
              <div>Prendre une photo</div>
              <div style="font-size:11px;font-weight:500;opacity:.7;">Appareil photo</div>
            </div>
          </button>

          <!-- Supprimer -->
          ${hasPhoto ? `
            <button id="photo-delete" style="
              display:flex;align-items:center;gap:12px;
              background:#FEF2F2;color:#DC2626;
              border:none;padding:12px;border-radius:14px;
              font-family:'Sora',sans-serif;font-size:13px;font-weight:700;
              cursor:pointer;
            ">
              <span style="font-size:20px;">🗑️</span>
              Supprimer la photo
            </button>
          ` : ''}
        </div>

        <button id="photo-close" style="
          width:100%;padding:13px;background:#F9FAFB;color:#6B7280;
          border:none;border-radius:14px;font-family:'Sora',sans-serif;
          font-size:14px;font-weight:600;cursor:pointer;
        ">Fermer</button>
      </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
    modal.querySelector('#photo-close').addEventListener('click', () => modal.remove());

    // Galerie (sans capture)
    modal.querySelector('#photo-gallery').addEventListener('click', () => {
      const fi = getFileInput();
      fi.removeAttribute('capture');
      pickImage(async file => {
        await processFile(file, produit, modal);
      });
    });

    // Caméra
    modal.querySelector('#photo-camera').addEventListener('click', () => {
      const fi = getFileInput();
      fi.capture = 'environment';
      pickImage(async file => {
        await processFile(file, produit, modal);
      });
    });

    // Supprimer
    modal.querySelector('#photo-delete')?.addEventListener('click', async () => {
      await deletePhoto(produit.id);
      modal.remove();
      refreshProductCards();
    });
  }

  async function processFile(file, produit, modal) {
    // Afficher spinner
    const preview = modal.querySelector('#photo-preview');
    if (preview) {
      preview.innerHTML = `<div style="text-align:center;color:var(--muted);">
        <div style="font-size:32px;animation:pulse 1s infinite;">⏳</div>
        <div style="font-size:12px;margin-top:8px;">Compression…</div>
      </div>`;
    }

    try {
      const base64 = await uploadPhoto(produit.id, file);

      // Mettre à jour l'aperçu
      if (preview) {
        preview.innerHTML = `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;" alt="${produit.name}">`;
        preview.style.border = 'none';
      }

      // Rafraîchir la liste des produits
      setTimeout(() => {
        refreshProductCards();
        modal.remove();
      }, 800);
    } catch {
      if (preview) {
        preview.innerHTML = `<div style="text-align:center;color:#EF4444;">
          <div style="font-size:32px;">❌</div>
          <div style="font-size:12px;margin-top:8px;">Erreur upload</div>
        </div>`;
      }
    }
  }

  // ══════════════════════════════════════
  // RAFRAÎCHIR LES CARTES PRODUIT
  // ══════════════════════════════════════
  function refreshProductCards() {
    window.afficherProduits?.();
    // Aussi rafraîchir les cartes de vente
    window.afficherCategoriesVente?.();
  }

  // ══════════════════════════════════════
  // INJECTER LES PHOTOS DANS LES CARTES
  // ══════════════════════════════════════
  function injectPhotoInCards() {
    const list = document.getElementById('listeProduits');
    if (!list) return;

    const obs = new MutationObserver(() => {
      // Chercher les cartes produit sans photo déjà injectée
      list.querySelectorAll('[data-produit-id], .product-card').forEach(card => {
        if (card.querySelector('.photo-injected')) return;

        // Extraire l'ID du produit
        let prodId = parseInt(card.dataset?.produitId);
        if (!prodId) {
          const btn = card.querySelector('[onclick*="supprimerProduit"]');
          if (btn) {
            const m = (btn.getAttribute('onclick')||'').match(/\d+/);
            if (m) prodId = parseInt(m[0]);
          }
        }
        if (!prodId) return;

        const produit = window.appData?.produits?.find(p => p.id === prodId);
        if (!produit) return;

        // Marquer comme traité
        const marker = document.createElement('span');
        marker.className = 'photo-injected';
        marker.style.display = 'none';
        card.appendChild(marker);

        // Ajouter la photo si elle existe
        if (produit.image_url) {
          const imgWrap = document.createElement('div');
          imgWrap.style.cssText = `
            width:100%;height:120px;border-radius:12px;
            overflow:hidden;margin-bottom:8px;
            background:#F3F4F6;flex-shrink:0;
          `;
          imgWrap.innerHTML = `<img src="${produit.image_url}"
            style="width:100%;height:100%;object-fit:cover;"
            alt="${produit.name}"
            loading="lazy">`;
          card.insertBefore(imgWrap, card.firstChild);
        }

        // Bouton photo
        const photoBtn = document.createElement('button');
        photoBtn.className = 'btn-share-product'; // Même style que le partage
        photoBtn.style.cssText = `
          background:${produit.image_url?'#ECFDF5':'#F3F4F6'};
          color:${produit.image_url?'#059669':'var(--muted)'};
          border:none;padding:5px 10px;
          border-radius:8px;font-size:11px;font-weight:700;
          cursor:pointer;margin-left:4px;
          transition:transform .12s;
        `;
        photoBtn.innerHTML = produit.image_url ? '📷✓' : '📷';
        photoBtn.title     = produit.image_url ? 'Modifier la photo' : 'Ajouter une photo';
        photoBtn.addEventListener('click', e => {
          e.stopPropagation();
          openPhotoModal(produit);
        });

        // Insérer avec les autres boutons d'action
        const actionZone = card.querySelector('[onclick*="supprimerProduit"]')?.parentNode;
        if (actionZone) actionZone.appendChild(photoBtn);
      });
    });

    obs.observe(list, { childList:true, subtree:true });
  }

  // ══════════════════════════════════════
  // INTÉGRER AVEC MODALES EDIT/AJOUT
  // ══════════════════════════════════════
  function enhanceModals() {
    // Ajouter photo dans modale d'édition
    const editModal = document.getElementById('modalEditProduit');
    if (editModal && !editModal.querySelector('#edit-photo-row')) {
      const row = document.createElement('div');
      row.id = 'edit-photo-row';
      row.className = 'form-group';
      row.innerHTML = `
        <label>📷 Photo du produit</label>
        <div id="edit-photo-preview" style="
          width:100%;height:80px;border-radius:12px;
          background:#F3F4F6;border:2px dashed #E5E7EB;
          display:flex;align-items:center;justify-content:center;
          font-size:24px;cursor:pointer;margin-bottom:8px;
          overflow:hidden;
        " onclick="document.getElementById('edit-photo-trigger').click()">📷</div>
        <input id="edit-photo-trigger" type="file" accept="image/*" style="display:none">
        <div style="font-size:11px;color:var(--muted);">Appuyez pour choisir une photo (max 400×400px)</div>
      `;

      const actions = editModal.querySelector('.modal-actions');
      if (actions) editModal.insertBefore(row, actions);

      // Gérer l'upload dans la modale d'édition
      row.querySelector('#edit-photo-trigger').addEventListener('change', async function() {
        const file = this.files[0];
        if (!file) return;
        const preview = document.getElementById('edit-photo-preview');
        if (preview) preview.innerHTML = '⏳';

        try {
          const base64 = await compressImage(file);
          if (preview) {
            preview.innerHTML = `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`;
          }
          // Stocker temporairement
          window._pendingProductImage = base64;
        } catch {
          window.showNotification?.('Erreur traitement image','error');
        }
      });
    }

    // Hook sur mettreAJourProduit pour inclure l'image
    const origUpdate = window.mettreAJourProduit;
    if (typeof origUpdate === 'function' && !origUpdate._photoHooked) {
      window.mettreAJourProduit = async function(...args) {
        const result = await origUpdate.apply(this, args);
        if (window._pendingProductImage && window._editingProduitId) {
          try {
            await auth(`${API()}/products/${window._editingProduitId}`, {
              method:'PATCH',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ image_url: window._pendingProductImage }),
            }).then(ok_);
            const p = window.appData?.produits?.find(x=>x.id===window._editingProduitId);
            if(p) p.image_url = window._pendingProductImage;
            window._pendingProductImage = null;
          } catch {}
        }
        return result;
      };
      window.mettreAJourProduit._photoHooked = true;
    }
  }

  // ══════════════════════════════════════
  // PATCH product-share.js : utiliser l'image du produit
  // ══════════════════════════════════════
  function patchProductShare() {
    const origShare = window.shareProduct;
    if (typeof origShare !== 'function' || origShare._photoPatched) return;

    window.shareProduct = function(produit, ...args) {
      // Si le produit a une image, la passer à generateProductCard
      if (produit.image_url) {
        window._shareProductImage = produit.image_url;
      }
      return origShare.call(this, produit, ...args);
    };
    window.shareProduct._photoPatched = true;
  }

  // ══════════════════════════════════════
  // API PUBLIQUE
  // ══════════════════════════════════════
  window.productPhotos = {
    open:    openPhotoModal,
    upload:  uploadPhoto,
    delete:  deletePhoto,
    compress: compressImage,
  };

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    injectPhotoInCards();
    enhanceModals();
    patchProductShare();

    window.addEventListener('pageChange', e => {
      if (e.detail?.key === 'stock') {
        setTimeout(() => { injectPhotoInCards(); enhanceModals(); }, 200);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
