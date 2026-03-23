/**
 * barcode-scanner.js — Scanner de code-barres produit
 *
 * Ajoute un bouton 📷 dans la section Vente et dans le formulaire produit.
 * Utilise BarcodeDetector API (Chrome Android, Edge) nativement — sans lib.
 * Recherche le produit dans appData.produits par :
 *   1. scent (champ "parfum/référence") — idéal pour stocker le code barre
 *   2. name (correspondance partielle)
 *
 * Pour associer un code-barre à un produit : mettre le code dans le champ
 * "Parfum / Référence" du produit.
 *
 * Intégration dans index.html (après app.js) :
 *   <script src="js/barcode-scanner.js"></script>
 */

(function () {

  // ── Support ──
  const SUPPORTED = 'BarcodeDetector' in window;

  // ── Détecteur réutilisable ──
  let _detector = null;
  function getDetector() {
    if (!_detector && SUPPORTED) {
      _detector = new BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'],
      });
    }
    return _detector;
  }

  // ══════════════════════════════════════
  // RECHERCHE PRODUIT PAR CODE
  // ══════════════════════════════════════
  function findProduct(code) {
    const products = window.appData?.produits || [];
    const c = code.trim().toLowerCase();

    // 1. Correspondance exacte sur scent (référence/code-barre)
    let found = products.find(p => p.scent?.trim().toLowerCase() === c);
    if (found) return found;

    // 2. Correspondance exacte sur le nom
    found = products.find(p => p.name?.trim().toLowerCase() === c);
    if (found) return found;

    // 3. Le code est contenu dans le nom ou scent
    found = products.find(p =>
      p.scent?.toLowerCase().includes(c) || p.name?.toLowerCase().includes(c)
    );
    return found || null;
  }

  // ══════════════════════════════════════
  // MODAL SCANNER
  // ══════════════════════════════════════
  async function openScanner(onDetect) {
    if (!SUPPORTED) {
      _showUnsupportedFallback(onDetect);
      return;
    }

    // Demande accès caméra
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (err) {
      window.showNotification?.('❌ Accès caméra refusé', 'error');
      window.haptic?.error();
      return;
    }

    // ── UI ──
    const modal = document.createElement('div');
    modal.id = 'barcode-scanner-modal';
    modal.style.cssText = `
      position:fixed; inset:0; background:#000; z-index:2000;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
    `;
    modal.innerHTML = `
      <div style="position:relative; width:100%; max-width:480px; height:100%;">
        <!-- Vidéo -->
        <video id="barcode-video" autoplay playsinline muted
          style="width:100%; height:100%; object-fit:cover;"></video>

        <!-- Overlay de visée -->
        <div style="
          position:absolute; inset:0;
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          pointer-events:none;
        ">
          <!-- Zone de scan -->
          <div style="
            width:260px; height:160px; border-radius:16px;
            border:3px solid rgba(255,255,255,.9);
            box-shadow:0 0 0 9999px rgba(0,0,0,.55);
            position:relative;
          ">
            <!-- Coins colorés -->
            <div style="position:absolute;top:-3px;left:-3px;width:24px;height:24px;
              border-top:4px solid var(--primary,#7C3AED);
              border-left:4px solid var(--primary,#7C3AED);
              border-radius:6px 0 0 0;"></div>
            <div style="position:absolute;top:-3px;right:-3px;width:24px;height:24px;
              border-top:4px solid var(--primary,#7C3AED);
              border-right:4px solid var(--primary,#7C3AED);
              border-radius:0 6px 0 0;"></div>
            <div style="position:absolute;bottom:-3px;left:-3px;width:24px;height:24px;
              border-bottom:4px solid var(--primary,#7C3AED);
              border-left:4px solid var(--primary,#7C3AED);
              border-radius:0 0 0 6px;"></div>
            <div style="position:absolute;bottom:-3px;right:-3px;width:24px;height:24px;
              border-bottom:4px solid var(--primary,#7C3AED);
              border-right:4px solid var(--primary,#7C3AED);
              border-radius:0 0 6px 0;"></div>
            <!-- Ligne de scan animée -->
            <div id="scan-line" style="
              position:absolute; left:8px; right:8px; height:2px;
              background:var(--primary,#7C3AED);
              top:0; animation:scanLine 1.8s ease-in-out infinite;
            "></div>
          </div>
          <div style="
            color:#fff; font-family:'Sora',sans-serif;
            font-size:13px; font-weight:600;
            margin-top:20px; opacity:.85;
            text-shadow:0 1px 4px rgba(0,0,0,.5);
          ">Pointez la caméra sur le code-barres</div>
        </div>

        <!-- Bouton fermer -->
        <button id="barcode-close" style="
          position:absolute; top:16px; right:16px;
          background:rgba(0,0,0,.5); border:none; color:#fff;
          width:40px; height:40px; border-radius:50%; font-size:18px;
          cursor:pointer; display:flex; align-items:center; justify-content:center;
          backdrop-filter:blur(4px);
        ">✕</button>

        <!-- Résultat -->
        <div id="barcode-result" style="
          position:absolute; bottom:0; left:0; right:0;
          background:rgba(0,0,0,.7); backdrop-filter:blur(8px);
          padding:16px 20px; display:none;
        "></div>
      </div>
      <style>
        @keyframes scanLine {
          0%   { top: 10%; }
          50%  { top: 80%; }
          100% { top: 10%; }
        }
      </style>
    `;

    document.body.appendChild(modal);

    const video = modal.querySelector('#barcode-video');
    video.srcObject = stream;

    // Fermeture
    function close() {
      stream.getTracks().forEach(t => t.stop());
      modal.remove();
    }
    modal.querySelector('#barcode-close').addEventListener('click', close);

    // ── Boucle de détection ──
    const detector = getDetector();
    let _scanning  = true;
    let _lastCode  = null;
    let _debounce  = 0;

    async function scanLoop() {
      if (!_scanning || !document.getElementById('barcode-scanner-modal')) return;

      try {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          const barcodes = await detector.detect(video);

          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;

            // Éviter les détections répétées du même code
            if (code !== _lastCode || Date.now() - _debounce > 2000) {
              _lastCode = code;
              _debounce = Date.now();

              window.haptic?.success();

              const product = findProduct(code);
              const result  = modal.querySelector('#barcode-result');

              if (product) {
                result.style.display = 'block';
                result.innerHTML = `
                  <div style="display:flex;align-items:center;gap:12px;">
                    <div style="font-size:28px;">✅</div>
                    <div style="flex:1;">
                      <div style="color:#fff;font-family:'Sora',sans-serif;font-weight:800;font-size:14px;">
                        ${product.name}
                      </div>
                      <div style="color:rgba(255,255,255,.7);font-size:12px;margin-top:2px;">
                        ${product.price?.toLocaleString('fr-FR')} F · Stock: ${product.stock}
                      </div>
                    </div>
                    <button onclick="window._barcodeAddToCart(${product.id})" style="
                      background:var(--primary,#7C3AED);border:none;color:#fff;
                      padding:10px 16px;border-radius:12px;font-family:'Sora',sans-serif;
                      font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;
                    ">+ Panier</button>
                  </div>
                `;

                window._barcodeAddToCart = (id) => {
                  const p = (window.appData?.produits || []).find(pr => pr.id === id);
                  if (p) {
                    window.ajouterAuPanier?.(p);
                    window.showNotification?.(`✅ ${p.name} ajouté`, 'success');
                  }
                  close();
                };

                // Auto-ajouter et fermer après 1.5s
                setTimeout(() => {
                  if (product.stock > 0) {
                    window.ajouterAuPanier?.(product);
                    window.showNotification?.(`📦 ${product.name} ajouté au panier`, 'success');
                    close();
                  }
                }, 1500);

              } else {
                result.style.display = 'block';
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
                    <button onclick="window._barcodeCopyCode('${code}')" style="
                      background:rgba(255,255,255,.15);border:none;color:#fff;
                      padding:8px 14px;border-radius:10px;font-size:12px;cursor:pointer;
                    ">Copier</button>
                  </div>
                `;
                // Appeler le callback avec le code brut (pour recherche manuelle, etc.)
                onDetect?.({ code, product: null });
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

    // Arrêter quand la modal disparaît
    const obsModal = new MutationObserver(() => {
      if (!document.getElementById('barcode-scanner-modal')) {
        _scanning = false;
        obsModal.disconnect();
      }
    });
    obsModal.observe(document.body, { childList: true });
  }

  // ── Fallback si BarcodeDetector non supporté ──
  function _showUnsupportedFallback(onDetect) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;
      display:flex;align-items:center;justify-content:center;padding:20px;
    `;
    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:24px;width:100%;max-width:360px;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">📷</div>
        <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:15px;margin-bottom:8px;">
          Scanner non disponible
        </div>
        <div style="font-size:13px;color:#6B7280;margin-bottom:20px;line-height:1.5;">
          Le scanner fonctionne sur Chrome Android et Edge.<br>
          Saisissez le code manuellement :
        </div>
        <input id="manual-barcode" type="text" placeholder="Code-barres ou référence produit"
          style="width:100%;padding:12px;border:2px solid #E5E7EB;border-radius:12px;
                 font-size:14px;outline:none;text-align:center;box-sizing:border-box;
                 margin-bottom:12px;letter-spacing:1px;">
        <button onclick="
          const v=document.getElementById('manual-barcode')?.value.trim();
          if(v){window._barcodeManualSearch(v);}
        " style="
          width:100%;padding:12px;background:var(--primary,#7C3AED);color:#fff;
          border:none;border-radius:12px;font-family:'Sora',sans-serif;
          font-size:14px;font-weight:800;cursor:pointer;margin-bottom:8px;
        ">Rechercher</button>
        <button onclick="this.closest('[style]').remove()"
          style="width:100%;padding:10px;background:none;border:none;color:#9CA3AF;cursor:pointer;font-size:13px;">
          Annuler
        </button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    setTimeout(() => document.getElementById('manual-barcode')?.focus(), 100);

    window._barcodeManualSearch = (code) => {
      const product = findProduct(code);
      if (product) {
        window.ajouterAuPanier?.(product);
        window.showNotification?.(`✅ ${product.name} ajouté`, 'success');
        modal.remove();
      } else {
        window.showNotification?.(`❌ "${code}" introuvable`, 'error');
        window.haptic?.error();
      }
    };
  }

  // ══════════════════════════════════════
  // INJECTION DU BOUTON DANS LA SECTION VENTE
  // ══════════════════════════════════════
  function injectScanButton() {
    if (document.getElementById('barcode-scan-btn')) return;

    // Chercher la barre de recherche vente ou le header de la section vente
    const venteSection = document.getElementById('venteSection');
    if (!venteSection) return;

    // Chercher un bon endroit pour injecter (après le header ou après la recherche)
    const searchBar = venteSection.querySelector('.vente-search, #venteSearch, input[type="search"]');
    const anchor    = searchBar?.parentElement || venteSection.querySelector('.section-header, .top-bar') || venteSection.firstElementChild;
    if (!anchor) return;

    const btn = document.createElement('button');
    btn.id = 'barcode-scan-btn';
    btn.title = 'Scanner un code-barres';
    btn.style.cssText = `
      position:fixed; bottom:calc(var(--nav-h, 68px) + var(--safe-b, 0px) + 16px); right:16px;
      width:52px; height:52px; border-radius:50%;
      background:linear-gradient(135deg, var(--primary, #7C3AED), var(--accent, #EC4899));
      border:none; color:#fff; font-size:22px; cursor:pointer;
      box-shadow:0 4px 16px rgba(124,58,237,.4);
      display:none; align-items:center; justify-content:center;
      z-index:100; transition:transform .15s;
    `;
    btn.innerHTML = '📷';
    btn.addEventListener('click', () => { window.haptic?.tap(); openScanner(); });
    btn.addEventListener('touchstart', () => { btn.style.transform = 'scale(.92)'; });
    btn.addEventListener('touchend',   () => { btn.style.transform = ''; });

    document.body.appendChild(btn);

    // Afficher/masquer selon la section active
    window.addEventListener('pageChange', e => {
      btn.style.display = e.detail?.key === 'vente' ? 'flex' : 'none';
    });
    // Cas où on est déjà sur vente
    if (window.currentSection === 'vente') btn.style.display = 'flex';
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  window._barcodeManualSearch = null;
  window._barcodeAddToCart    = null;
  window.openBarcodeScanner   = openScanner;

  function init() {
    injectScanButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-injecter si la section est rechargée
  window.addEventListener('pageChange', (e) => {
    if (e.detail?.key === 'vente') injectScanButton();
  });

})();
