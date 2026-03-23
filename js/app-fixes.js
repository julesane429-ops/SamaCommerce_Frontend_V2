/**
 * app-fixes.js — Correctifs ciblés
 *
 * 1. _showInviteLink : remplace la version avec onclick inline cassé
 *    (le > dans () => ferme le <button prématurément → CSS affiché comme texte)
 *
 * 2. Notifications anti-clignotement : debounce le refresh après syncFromServer
 *    (patché 2x par notifications.js + inapp-notifications.js → appels en rafale)
 *
 * Intégration dans index.html — DERNIER script avant </body> :
 *   <script src="js/app-fixes.js"></script>
 */

(function () {

  // ══════════════════════════════════════════════════════
  // 1. FIX _showInviteLink
  //    Cause : onclick="...() => ..." — le > de l'arrow function
  //    ferme la balise <button, le reste s'affiche comme texte brut.
  //    Solution : createElement + addEventListener (zéro HTML inline)
  // ══════════════════════════════════════════════════════
  window._showInviteLink = function (link, email) {
    // Overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999',
      'background:rgba(0,0,0,.55)',
      'display:flex', 'align-items:center',
      'justify-content:center', 'padding:20px',
      'box-sizing:border-box',
    ].join(';');

    // Carte
    const card = document.createElement('div');
    card.style.cssText = [
      'background:#fff', 'border-radius:20px', 'padding:24px',
      'width:100%', 'max-width:360px', 'box-sizing:border-box',
      'font-family:\'DM Sans\',sans-serif',
    ].join(';');

    // Icône
    const icon = document.createElement('div');
    icon.style.cssText = 'text-align:center;font-size:36px;margin-bottom:8px;';
    icon.textContent = '✅';
    card.appendChild(icon);

    // Titre
    const title = document.createElement('div');
    title.style.cssText = [
      "font-family:'Sora',sans-serif", 'font-weight:800', 'font-size:16px',
      'text-align:center', 'margin-bottom:4px', 'color:#111',
    ].join(';');
    title.textContent = 'Invitation créée !';
    card.appendChild(title);

    // Sous-titre
    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:12px;color:#9CA3AF;text-align:center;margin-bottom:16px;';
    sub.textContent = 'Partagez ce lien avec ' + (email || '') + ' · valide 72h';
    card.appendChild(sub);

    // Boîte du lien
    const linkBox = document.createElement('div');
    linkBox.style.cssText = [
      'background:#F5F3FF', 'border-radius:12px', 'padding:12px',
      'margin-bottom:16px',
    ].join(';');
    const linkTxt = document.createElement('div');
    linkTxt.style.cssText = [
      'font-size:11px', 'color:#7C3AED', 'word-break:break-all',
      'line-height:1.6', 'font-family:monospace',
    ].join(';');
    linkTxt.textContent = link;  // textContent → aucun risque d'injection HTML
    linkBox.appendChild(linkTxt);
    card.appendChild(linkBox);

    // Bouton copier
    const copyBtn = document.createElement('button');
    copyBtn.style.cssText = [
      'width:100%', 'padding:13px', 'background:#7C3AED', 'color:#fff',
      'border:none', 'border-radius:14px', "font-family:'Sora',sans-serif",
      'font-size:14px', 'font-weight:800', 'cursor:pointer',
      'margin-bottom:8px', 'display:block', 'box-sizing:border-box',
    ].join(';');
    copyBtn.textContent = '📋 Copier le lien';
    copyBtn.addEventListener('click', function () {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(link).then(function () {
          copyBtn.textContent = '✅ Copié !';
          setTimeout(function () { copyBtn.textContent = '📋 Copier le lien'; }, 2000);
          window.showNotification?.('📋 Lien copié !', 'success');
        });
      } else {
        // Fallback pour anciens navigateurs
        const inp = document.createElement('input');
        inp.value = link;
        inp.style.position = 'fixed';
        inp.style.opacity = '0';
        document.body.appendChild(inp);
        inp.select();
        try { document.execCommand('copy'); } catch (_) {}
        inp.remove();
        copyBtn.textContent = '✅ Copié !';
        setTimeout(function () { copyBtn.textContent = '📋 Copier le lien'; }, 2000);
      }
    });
    card.appendChild(copyBtn);

    // Bouton WhatsApp
    const waBtn = document.createElement('a');
    const waText = encodeURIComponent('Vous êtes invité à rejoindre ma boutique sur Sama Commerce :\n' + link);
    waBtn.href = 'https://wa.me/?text=' + waText;
    waBtn.target = '_blank';
    waBtn.rel = 'noopener noreferrer';
    waBtn.style.cssText = [
      'display:block', 'width:100%', 'padding:13px', 'box-sizing:border-box',
      'background:linear-gradient(135deg,#25D366,#128C7E)', 'color:#fff',
      'border-radius:14px', "font-family:'Sora',sans-serif",
      'font-size:14px', 'font-weight:800', 'text-align:center',
      'text-decoration:none', 'margin-bottom:8px',
    ].join(';');
    waBtn.textContent = '💬 Envoyer via WhatsApp';
    card.appendChild(waBtn);

    // Bouton fermer
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = [
      'width:100%', 'padding:11px', 'background:#F3F4F6', 'color:#6B7280',
      'border:none', 'border-radius:14px', 'font-size:13px', 'cursor:pointer',
      'box-sizing:border-box',
    ].join(';');
    closeBtn.textContent = 'Fermer';
    closeBtn.addEventListener('click', function () { overlay.remove(); });
    card.appendChild(closeBtn);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
  };


  // ══════════════════════════════════════════════════════
  // 2. ANTI-CLIGNOTEMENT DES ALERTES / NOTIFICATIONS
  //    Cause : syncFromServer patché 2x (notifications.js + inapp-notifications.js)
  //    → refresh() appelé 4-5 fois en rafale → badge clignote
  //    Solution : debounce — une seule exécution 600ms après la dernière rafale
  // ══════════════════════════════════════════════════════
  function debounceNotifRefresh() {
    var _timer = null;

    function patchSync() {
      var current = window.syncFromServer;
      if (!current || current._debouncedNotif) return;

      window.syncFromServer = async function () {
        var result = await current.apply(this, arguments);

        // Debounce : annuler les refresh précédents, ne déclencher qu'une seule fois
        clearTimeout(_timer);
        _timer = setTimeout(function () {
          window.inappNotifications?.refresh?.();
          window.scNotifications?.check?.();
          window.verifierStockFaible?.();
        }, 650);

        return result;
      };
      window.syncFromServer._debouncedNotif = true;
      // Conserver les flags des patches précédents pour éviter les doubles-patches
      window.syncFromServer._notifPatched = true;
    }

    // Attendre que syncFromServer soit disponible
    function waitAndPatch() {
      if (window.syncFromServer && !window.syncFromServer._debouncedNotif) {
        patchSync();
      } else if (!window.syncFromServer) {
        setTimeout(waitAndPatch, 300);
      }
    }

    // Lancer le patch après que tous les scripts aient patché syncFromServer
    setTimeout(waitAndPatch, 1500);
  }

  debounceNotifRefresh();

})();
