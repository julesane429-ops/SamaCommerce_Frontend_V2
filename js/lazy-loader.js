/**
 * lazy-loader.js — Chargement différé des librairies lourdes
 *
 * Retire xlsx, jspdf, jspdf-autotable du <head> → gain ~300KB au démarrage.
 * Charge chaque lib uniquement quand elle est réellement nécessaire.
 *
 * ════ MODIFICATION REQUISE DANS index.html ════
 * Supprimer ces 3 lignes du <head> :
 *   <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
 *   <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
 *   <script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js"></script>
 *
 * Ajouter avant </body> (après offline-cache.js) :
 *   <script src="js/lazy-loader.js"></script>
 * ══════════════════════════════════════════════
 *
 * Intégration dans index.html (avant app.js) :
 *   <script src="js/lazy-loader.js"></script>
 */

(function () {

  // ── Registre des librairies ──
  const LIBS = {
    xlsx: {
      url:    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
      check:  () => typeof XLSX !== 'undefined',
      loaded: false,
    },
    jspdf: {
      urls: [
        'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
        'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
      ],
      check:  () => typeof window.jspdf !== 'undefined' || typeof jsPDF !== 'undefined',
      loaded: false,
    },
  };

  // ── Promesses en cours (évite les doubles chargements) ──
  const _pending = {};

  // ── Charger un script dynamiquement ──
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src  = url;
      s.async = false; // important pour les dépendances ordonnées
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ── Charger une lib (avec mise en cache) ──
  async function loadLib(name) {
    const lib = LIBS[name];
    if (!lib) return;
    if (lib.loaded || lib.check()) { lib.loaded = true; return; }
    if (_pending[name]) return _pending[name];

    const promise = (async () => {
      try {
        if (lib.url) {
          await loadScript(lib.url);
        } else if (lib.urls) {
          for (const url of lib.urls) { await loadScript(url); }
        }
        lib.loaded = true;
        console.log(`[lazy-loader] ✅ ${name} chargé`);
      } catch (err) {
        console.error(`[lazy-loader] ❌ Erreur chargement ${name}:`, err);
      } finally {
        delete _pending[name];
      }
    })();

    _pending[name] = promise;
    return promise;
  }

  // ══════════════════════════════════════
  // DÉCLENCHEURS AUTOMATIQUES
  // ══════════════════════════════════════

  // ── xlsx → au clic sur un bouton Export Excel ──
  function watchExcelButtons() {
    // Observer l'ajout de boutons export dans le DOM
    const observer = new MutationObserver(() => {
      document.querySelectorAll(
        '#btnExportExcel, [id*="excel"], [id*="export"], [onclick*="excel"], [onclick*="export"]'
      ).forEach(btn => {
        if (btn._xlsxWatched) return;
        btn._xlsxWatched = true;

        const origClick = btn.onclick;
        btn.addEventListener('click', async (e) => {
          if (!LIBS.xlsx.loaded) {
            e.stopImmediatePropagation();
            const originalText = btn.textContent;
            btn.textContent = '⌛';
            btn.disabled = true;
            await loadLib('xlsx');
            btn.textContent = originalText;
            btn.disabled = false;
            // Re-déclencher le clic
            btn.click();
          }
        }, true); // capture phase
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Vérifier les boutons déjà présents
    observer.takeRecords();
  }

  // ── jspdf → au clic sur un bouton PDF ──
  function watchPdfButtons() {
    const observer = new MutationObserver(() => {
      document.querySelectorAll(
        '#btnPdfRapports, #btnPdfInventaire, [id*="pdf"], [onclick*="pdf"], [onclick*="PDF"]'
      ).forEach(btn => {
        if (btn._jspdfWatched) return;
        btn._jspdfWatched = true;

        btn.addEventListener('click', async (e) => {
          if (!LIBS.jspdf.loaded) {
            e.stopImmediatePropagation();
            const originalText = btn.innerHTML;
            btn.innerHTML = '⌛';
            btn.disabled = true;
            await loadLib('jspdf');
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.click();
          }
        }, true);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Préchargement en arrière-plan après idle ──
  // Charge xlsx + jspdf 5s après le démarrage (quand tout est calme)
  function preloadAfterIdle() {
    const preload = () => {
      // Précharger seulement si l'utilisateur est actif depuis un moment
      setTimeout(async () => {
        if (!LIBS.xlsx.loaded)  await loadLib('xlsx');
        if (!LIBS.jspdf.loaded) await loadLib('jspdf');
      }, 5000);
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(preload, { timeout: 8000 });
    } else {
      setTimeout(preload, 5000);
    }
  }

  // ══════════════════════════════════════
  // PATCHES DES FONCTIONS QUI UTILISENT CES LIBS
  // ══════════════════════════════════════

  // Patcher generateRapportsPDF pour s'assurer que jspdf est chargé
  function patchPdfFunctions() {
    const patchFn = (fnName) => {
      const orig = window[fnName];
      if (!orig || orig._lazyPatched) return;

      window[fnName] = async function (...args) {
        if (!LIBS.jspdf.loaded) {
          window.showNotification?.('⌛ Chargement PDF…', 'info');
          await loadLib('jspdf');
        }
        return orig.apply(this, args);
      };
      window[fnName]._lazyPatched = true;
    };

    // Patcher dès que disponibles
    ['generateRapportsPDF', 'generateInventairePDF', 'generateClientPDF'].forEach(fn => {
      if (window[fn]) patchFn(fn);
    });

    // Observer pour les fonctions définies plus tard
    const origDefProp = Object.defineProperty;
    // Simple polling pour les fonctions tardives
    const pollFns = ['generateRapportsPDF', 'generateInventairePDF'];
    let pollAttempts = 0;
    const poll = setInterval(() => {
      pollFns.forEach(patchFn);
      pollAttempts++;
      if (pollAttempts > 20) clearInterval(poll);
    }, 500);
  }

  // Patcher les fonctions export Excel
  function patchExcelFunctions() {
    const patchFn = (fnName) => {
      const orig = window[fnName];
      if (!orig || orig._lazyPatched) return;

      window[fnName] = async function (...args) {
        if (!LIBS.xlsx.loaded) {
          window.showNotification?.('⌛ Chargement Excel…', 'info');
          await loadLib('xlsx');
        }
        return orig.apply(this, args);
      };
      window[fnName]._lazyPatched = true;
    };

    ['exportToExcel', 'exportVentes', 'exportInventaire', 'exportClients'].forEach(fn => {
      if (window[fn]) patchFn(fn);
    });

    let attempts = 0;
    const poll = setInterval(() => {
      ['exportToExcel', 'exportVentes'].forEach(patchFn);
      attempts++;
      if (attempts > 20) clearInterval(poll);
    }, 500);
  }

  // ══════════════════════════════════════
  // API PUBLIQUE
  // ══════════════════════════════════════
  window.lazyLoader = {
    load:    loadLib,
    loadXlsx:  () => loadLib('xlsx'),
    loadJspdf: () => loadLib('jspdf'),
    isLoaded:  (name) => LIBS[name]?.loaded || LIBS[name]?.check() || false,
  };

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    watchExcelButtons();
    watchPdfButtons();
    patchPdfFunctions();
    patchExcelFunctions();
    preloadAfterIdle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
