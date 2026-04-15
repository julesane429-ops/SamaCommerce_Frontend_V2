/**
 * fix-push-enhanced.js — Push notifications améliorées
 *
 * 1. Enregistre l'abonnement push au premier lancement
 * 2. Déclenche la vérification des alertes proactives à chaque login
 * 3. Affiche les notifications in-app pour les alertes push reçues
 *
 * INTÉGRATION : <script src="js/fix-push-enhanced.js"></script>
 */

(function () {

  var API = function () {
    return document.querySelector('meta[name="api-base"]')?.content || '';
  };

  // ══════════════════════════════════════
  // 1. ENREGISTREMENT PUSH
  // ══════════════════════════════════════
  async function registerPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'denied') return;

    try {
      // Récupérer la clé VAPID
      var res = await fetch(API() + '/push/vapid-key');
      var data = await res.json();
      if (!data.publicKey) return;

      var registration = await navigator.serviceWorker.ready;
      var existing = await registration.pushManager.getSubscription();

      if (!existing) {
        // Demander la permission si pas encore fait
        if (Notification.permission === 'default') {
          var perm = await Notification.requestPermission();
          if (perm !== 'granted') return;
        }

        existing = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        });
      }

      // Envoyer au serveur
      var token = localStorage.getItem('authToken');
      if (token && existing) {
        await fetch(API() + '/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({ subscription: existing.toJSON() }),
        });
      }
    } catch (e) {
      console.warn('Push registration:', e.message);
    }
  }

  // ══════════════════════════════════════
  // 2. ALERTES PROACTIVES AU LOGIN
  // ══════════════════════════════════════
  async function checkProactiveAlerts() {
    try {
      var token = localStorage.getItem('authToken');
      if (!token) return;

      var res = await fetch(API() + '/push/check-alerts', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
      });

      if (!res.ok) return;
      var data = await res.json();

      // Afficher les alertes en in-app aussi
      if (data.alerts && data.alerts.length) {
        data.alerts.forEach(function (alert, i) {
          setTimeout(function () {
            window.showNotification?.(alert.title + ' — ' + alert.body, 'warning');
          }, 1500 + i * 2000);
        });
      }
    } catch (e) {
      // Silencieux — pas de push, pas grave
    }
  }

  // ══════════════════════════════════════
  // UTILS
  // ══════════════════════════════════════
  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // ══════════════════════════════════════
  // INIT — après que l'app soit chargée
  // ══════════════════════════════════════
  function init() {
    if (!localStorage.getItem('authToken')) return;

    // Enregistrer push après un délai (pas bloquer le rendu)
    setTimeout(registerPush, 3000);

    // Vérifier les alertes proactives après la sync initiale
    setTimeout(checkProactiveAlerts, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 2000); });
  } else {
    setTimeout(init, 2000);
  }

})();
