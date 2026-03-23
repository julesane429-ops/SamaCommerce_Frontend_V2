/**
 * barcode-scanner.js — Scanner de code-barres produit
 *
 * Injecte un bouton 📷 directement dans la section Vente (dans le DOM
 * de venteSection) — pas de floating button ni de show/hide JS.
 * Utilise BarcodeDetector API (Chrome Android, Edge) nativement.
 *
 * Pour associer un code-barre à un produit :
 *   → Mettre le code dans le champ "Parfum / Référence" du produit
 *
 * Intégration dans index.html (après app.js) :
 *   <script src="js/barcode-scanner.js"></script>
 */

(function () {

  const SUPPORTED = 'BarcodeDetector' in window;
  let _detector = null;

  function getDetector() {
    if (!_detector && SUPPORTED) {
      _detector = new BarcodeDetector({
        formats: ['ean_13','ean_8','code_128','code_39','qr_code','upc_a','upc_e'],
      });
    }
    return _detector;
  }

  // ══════════════════════════════════════
  // RECHERCHE PRODUIT
  // ══════════════════════════════════════
  function findProduct(code) {
    const products = window.appData?.produits || [];
    const c = code.trim().toLowerCase();

    return products.find(p => p.scent?.trim().toLowerCase() === c)
        || products.find(p => p.name?.trim().toLowerCase() === c)
        || products.find(p => p.scent?.toLowerCase().includes(c) || p.name?.toLowerCase().includes(c))
        || null;
  }

  // ══════════════════════════════════════
  // MODAL CAMERA
  // ══════════════════════════════════════
  async function openScanner() {
    if (!SUPPORTED) { _showManualFallback(); return; }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch {
      window.showNotification?.('❌ Accès caméra refusé', 'error');
      window.haptic?.error();
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'barcode-scanner-modal';
    modal.style.cssText = `
      position:fixed; inset:0; background:#000; z-index:2000;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
    `;
    modal.innerHTML = `
      <div style="position:relative;width:100%;max-width:480px;height:100%;">
        <video id="barcode-video" autoplay playsinline muted
          style="width:100%;height:100%;object-fit:cover;"></video>

        <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                    align-items:center;justify-content:center;pointer-events:none;">
          <div style="width:260px;height:160px;border-radius:16px;
                      border:3px solid rgba(255,255,255,.9);
                      box-shadow:0 0 0 9999px rgba(0,0,0,.55);position:relative;">
            <div style="position:absolute;top:-3px;left:-3px;width:24px;height:24px;
              border-top:4px solid var(--primary,#7C3AED);border-left:4px solid var(--primary,#7C3AED);
              border-radius:6px 0 0 0;"></div>
            <div style="position:absolute;top:-3px;right:-3px;width:24px;height:24px;
              border-top:4px solid var(--primary,#7C3AED);border-right:4px solid var(--primary,#7C3AED);
              border-radius:0 6px 0 0;"></div>
            <div style="position:absolute;bottom:-3px;left:-3px;width:24px;height:24px;
              border-bottom:4px solid var(--primary,#7C3AED);border-left:4px solid var(--primary,#7C3AED);
              border-radius:0 0 0 6px;"></div>
            <div style="position:absolute;bottom:-3px;right:-3px;width:24px;height:24px;
              border-bottom:4px solid var(--primary,#7C3AED);border-right:4px solid var(--primary,#7C3AED);
              border-radius:0 0 6px 0;"></div>
            <div style="position:absolute;left:8px;right:8px;height:2px;
              background:var(--primary,#7C3AED);top:0;
              animation:scanLine 1.8s ease-in-out infinite;"></div>
          </div>
          <div style="color:#fff;font-family:'Sora',sans-serif;font-size:13px;font-weight:600;
                      margin-top:20px;opacity:.85;text-shadow:0 1px 4px rgba(0,0,0,.5);">
            Pointez la caméra sur le code-barres
          </div>
        </div>

        <button id="barcode-close" style="position:absolute;top:16px;right:16px;
          background:rgba(0,0,0,.5);border:none;color:#fff;width:40px;height:40px;
          border-radius:50%;font-size:18px;cursor:pointer;
          display:flex;align-items:center;justify-content:center;">✕</button>

        <div id="barcode-result" style="position:absolute;bottom:0;left:0;right:0;
          background:rgba(0,0,0,.75);backdrop-filter:blur(8px);
          padding:16px 20px;display:none;"></div>
      </div>
      <style>
        @keyframes scanLine { 0%,100%{top:10%} 50%{top:80%} }
      </style>
    `;
    document.body.appendChild(modal);

    const video = modal.querySelector('#barcode-video');
    video.srcObject = stream;

    function close() {
      stream.getTracks().forEach(t => t.stop());
      modal.remove();
    }
    modal.querySelector('#barcode-close').addEventListener('click', close);

    const detector = getDetector();
    let _scanning = true, _lastCode = null, _debounce = 0;

    async function scanLoop() {
      if (!_scanning || !document.getElementById('barcode-scanner-modal')) return;
      try {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code !== _lastCode || Date.now() - _debounce > 2000) {
              _lastCode = code; _debounce = Date.now();
              window.haptic?.success();
              const product = findProduct(code);
              const result  = modal.querySelector('#barcode-result');
              result.style.display = 'block';

              if (product) {
                result.innerHTML = `
                  <div style="display:flex;align-items:center;gap:12px;">
                    <div style="font-size:28px;">✅</div>
                    <div style="flex:1;">
                      <div style="color:#fff;font-family:'Sora',sans-serif;font-weight:800;font-size:14px;">${product.name}</div>
                      <div style="color:rgba(255,255,255,.7);font-size:12px;margin-top:2px;">
                        ${product.price?.toLocaleString('fr-FR')} F · Stock: ${product.stock}
                      </div>
                    </div>
                    <button id="barcode-add-btn" style="
                      background:var(--primary,#7C3AED);border:none;color:#fff;
                      padding:10px 16px;border-radius:12px;font-family:'Sora',sans-serif;
                      font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;">
                      + Panier
                    </button>
                  </div>`;
                modal.querySelector('#barcode-add-btn')?.addEventListener('click', () => {
                  window.ajouterAuPanier?.(product);
                  window.showNotification?.(`✅ ${product.name} ajouté`, 'success');
                  close();
                });
                // Auto-ajout après 1.5s
                setTimeout(() => {
                  if (document.getElementById('barcode-scanner-modal') && product.stock > 0) {
                    window.ajouterAuPanier?.(product);
                    window.showNotification?.(`📦 ${product.name} ajouté au panier`, 'success');
                    close();
                  }
                }, 1500);
              } else {
                result.innerHTML = `
                  <div style="display:flex;align-items:center;gap:12px;">
                    <div style="font-size:28px;">❓</div>
                    <div style="flex:1;">
                      <div style="color:#fff;font-family:'Sora',sans-serif;font-weight:700;font-size:13px;">
                        Produit introuvable
                      </div>
                      <div style="color:rgba(255,255,255,.6);font-size:11px;font-family:monospace;margin-top:2px;">
                        Code : ${code}
                      </div>
                    </div>
                  </div>`;
              }
            }
          }
        }
      } catch (_) {}
      if (_scanning) requestAnimationFrame(scanLoop);
    }

    video.addEventListener('loadedmetadata', () => {
      _scanning = true;
      requestAnimationFrame(scanLoop);
    });

    const obs = new MutationObserver(() => {
      if (!document.getElementById('barcode-scanner-modal')) { _scanning = false; obs.disconnect(); }
    });
    obs.observe(document.body, { childList: true });
  }

  // ══════════════════════════════════════
  // FALLBACK SAISIE MANUELLE (iOS / Firefox)
  // ══════════════════════════════════════
  function _showManualFallback() {
    const modal = document.createElement('div');
    modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;
      display:flex;align-items:center;justify-content:center;padding:20px;`;
    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:24px;width:100%;max-width:360px;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">📷</div>
        <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:15px;margin-bottom:8px;">
          Scanner non disponible
        </div>
        <div style="font-size:12px;color:#6B7280;margin-bottom:20px;line-height:1.5;">
          Fonctionne sur Chrome Android et Edge.<br>Saisissez le code manuellement :
        </div>
        <input id="manual-barcode" type="text" placeholder="Code-barres ou référence produit"
          style="width:100%;padding:12px;border:2px solid #E5E7EB;border-radius:12px;
                 font-size:14px;outline:none;text-align:center;box-sizing:border-box;
                 margin-bottom:12px;letter-spacing:1px;">
        <button id="manual-search-btn" style="
          width:100%;padding:12px;background:var(--primary,#7C3AED);color:#fff;
          border:none;border-radius:12px;font-family:'Sora',sans-serif;
          font-size:14px;font-weight:800;cursor:pointer;margin-bottom:8px;">
          Rechercher
        </button>
        <button onclick="this.closest('[style]').remove()"
          style="width:100%;padding:10px;background:none;border:none;color:#9CA3AF;cursor:pointer;font-size:13px;">
          Annuler
        </button>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    const input = modal.querySelector('#manual-barcode');
    modal.querySelector('#manual-search-btn').addEventListener('click', () => {
      const code = input?.value.trim();
      if (!code) return;
      const product = findProduct(code);
      if (product) {
        window.ajouterAuPanier?.(product);
        window.showNotification?.(`✅ ${product.name} ajouté`, 'success');
        modal.remove();
      } else {
        window.showNotification?.(`❌ "${code}" introuvable`, 'error');
        window.haptic?.error();
      }
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') modal.querySelector('#manual-search-btn').click();
    });

    setTimeout(() => input?.focus(), 100);
  }

  // ══════════════════════════════════════
  // INJECTION DU BOUTON DANS venteSection
  // ✅ Directement dans le DOM — pas de floating, pas de show/hide JS
  // ══════════════════════════════════════
  function injectScanButton() {
    if (document.getElementById('vente-scan-btn-row')) return;

    const venteSection = document.getElementById('venteSection');
    if (!venteSection) return;

    // Trouver le label "Choisir produits" ou le div categoriesVente
    const categoriesVente = document.getElementById('categoriesVente');
    const sectionLabel    = venteSection.querySelector('.section-label');

    // Créer la barre de scan
    const row = document.createElement('div');
    row.id = 'vente-scan-btn-row';
    row.style.cssText = `
      display:flex; align-items:center; gap:10px;
      padding: 0 0 12px;
    `;
    row.innerHTML = `
      <button id="vente-scan-btn" style="
        flex:1;
        display:flex; align-items:center; justify-content:center; gap:8px;
        padding:12px 16px;
        background:linear-gradient(135deg, var(--primary,#7C3AED), var(--accent,#EC4899));
        color:#fff; border:none; border-radius:14px; cursor:pointer;
        font-family:'Sora',sans-serif; font-size:14px; font-weight:800;
        box-shadow:0 4px 14px rgba(124,58,237,.3);
        transition:transform .15s, box-shadow .15s;
      ">
        <span style="font-size:20px;">📷</span>
        <span>Scanner un code-barres</span>
      </button>
    `;

    // Ajouter active state
    const btn = row.querySelector('#vente-scan-btn');
    btn.addEventListener('touchstart', () => {
      btn.style.transform = 'scale(.97)';
      btn.style.boxShadow = '0 2px 8px rgba(124,58,237,.2)';
    });
    btn.addEventListener('touchend', () => {
      btn.style.transform = '';
      btn.style.boxShadow = '0 4px 14px rgba(124,58,237,.3)';
    });
    btn.addEventListener('click', () => {
      window.haptic?.tap();
      openScanner();
    });

    // Insérer AVANT categoriesVente (ou après le section-label si trouvé)
    if (categoriesVente) {
      categoriesVente.parentNode.insertBefore(row, categoriesVente);
    } else if (sectionLabel) {
      sectionLabel.parentNode.insertBefore(row, sectionLabel.nextSibling);
    } else {
      venteSection.appendChild(row);
    }
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  window.openBarcodeScanner = openScanner;

  function init() {
    // Injecter dès que venteSection est dans le DOM
    if (document.getElementById('venteSection')) {
      injectScanButton();
    } else {
      // Si le DOM n'est pas encore prêt
      const obs = new MutationObserver(() => {
        if (document.getElementById('venteSection')) {
          injectScanButton();
          obs.disconnect();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
