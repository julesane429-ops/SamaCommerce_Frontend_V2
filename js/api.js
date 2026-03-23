export function authfetch(url, options = {}) {
  const token = localStorage.getItem('authToken');
  if (!token) {
    console.warn("Token manquant, rejet de la promesse");
    return Promise.reject(new Error('Token manquant'));
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.warn("⚠️ Token expiré");
      localStorage.removeItem('authToken');
      return Promise.reject(new Error('Token expiré'));
    }
  } catch (e) {
    console.error("Erreur décodage token:", e);
  }

  // ✅ X-Boutique-Id uniquement pour les boutiques secondaires
  // Boutique principale (is_primary) → pas de header → backend retourne tout (cumul)
  // Boutique secondaire → header → backend filtre par cette boutique
  const isPrimary  = localStorage.getItem('sc_active_boutique_is_primary') === '1';
  const savedBid   = parseInt(localStorage.getItem('sc_active_boutique') || '0') || null;
  const boutiqueId = (!isPrimary && (window._activeBoutiqueId || savedBid)) ? (window._activeBoutiqueId || savedBid) : null;

  const headers = {
    ...(options.headers || {}),
    'Authorization': 'Bearer ' + token,
    ...(boutiqueId ? { 'X-Boutique-Id': String(boutiqueId) } : {}),
  };

  return fetch(url, { ...options, headers }).then(res => {
    if (res.status === 401) {
      localStorage.removeItem('authToken');
      return Promise.reject(new Error('401 Unauthorized'));
    }
    if (res.status === 402) {
      res.clone().json().then(data => {
        const msg = data?.message || 'Cette fonctionnalité nécessite un abonnement Premium.';
        window.showNotification?.(msg, 'warning');
        if (data?.upgrade_required) setTimeout(() => window.showModalById?.('premiumModal'), 300);
      }).catch(() => {});
    }
    if (res.status === 502 || res.status === 503) showColdStartBanner();
    return res;
  }).catch(err => {
    if (err.message === 'Failed to fetch' || err.name === 'TypeError') showColdStartBanner();
    return Promise.reject(err);
  });
}
