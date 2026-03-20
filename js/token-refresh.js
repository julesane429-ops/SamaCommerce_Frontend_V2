/**
 * token-refresh.js — Refresh token JWT silencieux
 *
 * Intercepte authfetch pour :
 *   1. Détecter les 401/403 (token expiré)
 *   2. Tenter un refresh silencieux
 *   3. Rejouer la requête originale avec le nouveau token
 *   4. Si refresh échoue → déconnecter proprement
 *
 * INTÉGRATION dans index.html, avant app.js :
 *   <script src="js/token-refresh.js"></script>
 */

(function () {

  const API      = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const RTOKEN_KEY = 'sc_refresh_token';
  const TOKEN_KEY  = 'authToken';

  let isRefreshing   = false;
  let refreshQueue   = []; // Requêtes en attente pendant le refresh

  // ══════════════════════════════════════
  // REFRESH
  // ══════════════════════════════════════
  async function doRefresh() {
    const refreshToken = localStorage.getItem(RTOKEN_KEY);
    if (!refreshToken) throw new Error('No refresh token');

    const res = await fetch(`${API()}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) throw new Error('Refresh failed');

    const data = await res.json();
    localStorage.setItem(TOKEN_KEY,  data.token);
    localStorage.setItem(RTOKEN_KEY, data.refresh_token);
    return data.token;
  }

  // ══════════════════════════════════════
  // WRAPPER AUTHFETCH avec auto-refresh
  // ══════════════════════════════════════
  function wrapAuthFetch() {
    const orig = window.authfetch;
    if (typeof orig !== 'function') { setTimeout(wrapAuthFetch, 200); return; }
    if (orig._refreshWrapped) return;

    window.authfetch = async function (url, opts = {}) {
      // Première tentative
      let res = await orig(url, opts);

      // Si 401 ou 403 → tenter refresh
      if (res.status === 401 || res.status === 403) {
        const refreshToken = localStorage.getItem(RTOKEN_KEY);
        if (!refreshToken) {
          // Pas de refresh token → déconnecter
          return res;
        }

        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const newToken = await doRefresh();
            // Vider la file d'attente avec le nouveau token
            refreshQueue.forEach(cb => cb(newToken));
            refreshQueue = [];
          } catch {
            // Refresh échoué → déconnecter
            refreshQueue.forEach(cb => cb(null));
            refreshQueue = [];
            isRefreshing = false;
            handleLogout();
            return res;
          }
          isRefreshing = false;
        } else {
          // Attendre que le refresh en cours se termine
          await new Promise(resolve => {
            refreshQueue.push(token => {
              if (token) resolve(token);
              else resolve(null);
            });
          });
        }

        // Rejouer la requête avec le nouveau token
        const newToken = localStorage.getItem(TOKEN_KEY);
        if (!newToken) return res;

        const newOpts = {
          ...opts,
          headers: {
            ...(opts.headers || {}),
            'Authorization': `Bearer ${newToken}`,
          },
        };
        res = await orig(url, newOpts);
      }

      return res;
    };

    window.authfetch._refreshWrapped = true;
  }

  // ══════════════════════════════════════
  // LOGOUT PROPRE
  // ══════════════════════════════════════
  function handleLogout() {
    const refreshToken = localStorage.getItem(RTOKEN_KEY);
    if (refreshToken) {
      fetch(`${API()}/auth/logout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(RTOKEN_KEY);
    window.showNotification?.('Session expirée — reconnexion requise', 'warning');
    setTimeout(() => {
      window.location.replace('login/login.html?expired=1');
    }, 1500);
  }

  // ══════════════════════════════════════
  // SAUVEGARDER LE REFRESH TOKEN À LA CONNEXION
  // ══════════════════════════════════════
  function patchLogin() {
    // Intercepter les réponses de login pour sauvegarder refresh_token
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
      const res = await origFetch.apply(this, args);

      // Détecter les réponses de login/register/demo
      const url = String(args[0] || '');
      if (url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/demo/login')) {
        const clone = res.clone();
        clone.json().then(data => {
          if (data.refresh_token) {
            localStorage.setItem(RTOKEN_KEY, data.refresh_token);
          }
        }).catch(() => {});
      }

      return res;
    };
  }

  // ══════════════════════════════════════
  // VÉRIFICATION PROACTIVE toutes les 6h
  // ══════════════════════════════════════
  function scheduleProactiveRefresh() {
    setInterval(async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      const refreshToken = localStorage.getItem(RTOKEN_KEY);
      if (!token || !refreshToken) return;

      try {
        // Décoder le JWT pour voir son expiry
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiresIn = (payload.exp * 1000) - Date.now();

        // Refresh si expire dans moins de 1h
        if (expiresIn < 60 * 60 * 1000) {
          await doRefresh();
          console.log('🔄 Token renouvelé proactivement');
        }
      } catch {
        // Token malformé ou refresh échoué → ignorer silencieusement
      }
    }, 60 * 60 * 1000); // Vérifier toutes les heures
  }

  // ══════════════════════════════════════
  // API PUBLIQUE
  // ══════════════════════════════════════
  window.tokenRefresh = {
    doRefresh,
    logout: handleLogout,
  };

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    patchLogin();
    wrapAuthFetch();
    scheduleProactiveRefresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
