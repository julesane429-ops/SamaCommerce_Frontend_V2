/**
 * subscription-guard.js — Vérification d'abonnement côté frontend
 *
 * Au chargement de l'app :
 *   1. Charge le profil via /auth/me
 *   2. Affiche une bannière si abonnement expire bientôt ou est expiré
 *   3. Intercepte la navigation vers les sections Premium-only
 *   4. Affiche une modale de renouvellement au lieu d'un écran vide
 *
 * Sections Premium-only : rapports, inventaire (export), caisse, équipe
 */

(function () {

  const API     = () => document.querySelector('meta[name="api-base"]')?.content || 'https://samacommerce-backend-v2.onrender.com';
  const notify  = (m, t) => window.showNotification?.(m, t);

  // Map section → feature requise (utilise planConfig.js)
  const SECTION_FEATURES = {
    boutiques:    'multi_boutique',
    rapports:     'rapports',
    caisse:       'caisse',
    team:         'team',
    clients:      'clients',
    fournisseurs: 'fournisseurs',
    commandes:    'commandes',
    livraisons:   'livraisons',
  };

  let _profile = null;
  let _bannerShown = false;

  // ══════════════════════════════════════
  // CHARGER LE PROFIL
  // ══════════════════════════════════════
  async function loadProfile() {
    if (!window.authfetch) return;
    try {
      const res = await window.authfetch(`${API()}/auth/me`);
      if (!res.ok) return;
      _profile = await res.json();
      checkSubscription();
    } catch (err) {
      console.warn('subscription-guard: profil non chargé', err.message);
    }
  }

  // ══════════════════════════════════════
  // VÉRIFIER L'ABONNEMENT
  // ══════════════════════════════════════
  function checkSubscription() {
    if (!_profile) return;

    const plan       = _profile.plan || 'Free';
    const planCfg    = window.getPlan?.(plan) || { label: plan };
    const PAID_PLANS = ['Starter', 'Pro', 'Business'];
    const isPaid     = PAID_PLANS.includes(plan) && _profile.upgrade_status === 'validé';
    const expiration = _profile.expiration ? new Date(_profile.expiration) : null;
    const now        = new Date();
    const daysLeft   = expiration ? Math.ceil((expiration - now) / (1000 * 60 * 60 * 24)) : null;
    const isExpired  = expiration && expiration < now;
    const isPending  = _profile.upgrade_status === 'en attente';

    // Stocker l'état complet pour les guards de navigation
    window._subscriptionState = { plan, isPaid, isExpired, daysLeft, isPending };

    if (!_bannerShown) {
      _bannerShown = true;
      if (isPaid && isExpired)                        showSubscriptionBanner('expired');
      else if (isPaid && daysLeft !== null && daysLeft <= 7) showSubscriptionBanner('warning', daysLeft);
      else if (isPending)                             showSubscriptionBanner('pending');
    }

    // Démarrer le polling si plan en attente de validation
    if (isPending) {
      startPolling();
    } else {
      stopPolling();
    }
  }

  // ══════════════════════════════════════
  // BANNIÈRE D'ABONNEMENT
  // ══════════════════════════════════════
  function showSubscriptionBanner(type, daysLeft) {
    if (document.getElementById('sub-banner')) return;

    const configs = {
      expired: {
        bg:    '#FEF2F2',
        border:'#FCA5A5',
        color: '#991B1B',
        icon:  '❌',
        text:  'Votre abonnement Premium a expiré. Certaines fonctionnalités sont désactivées.',
        cta:   'Renouveler',
      },
      warning: {
        bg:    '#FFFBEB',
        border:'#FCD34D',
        color: '#92400E',
        icon:  '⏳',
        text:  `Votre abonnement expire dans <strong>${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong>.`,
        cta:   'Renouveler',
      },
      pending: {
        bg:    '#EFF6FF',
        border:'#93C5FD',
        color: '#1E40AF',
        icon:  '⏳',
        text:  'Votre demande Premium est en cours de validation (sous 24h).',
        cta:   null,
      },
    };

    const c = configs[type];
    if (!c) return;

    const banner = document.createElement('div');
    banner.id = 'sub-banner';
    banner.style.cssText = `
      position: fixed; bottom: 70px; left: 50%; transform: translateX(-50%);
      background: ${c.bg}; border: 1.5px solid ${c.border}; border-radius: 14px;
      padding: 11px 16px; color: ${c.color}; font-size: 13px; font-weight: 600;
      display: flex; align-items: center; gap: 10px; z-index: 900;
      max-width: calc(100vw - 32px); box-shadow: 0 4px 20px rgba(0,0,0,.12);
      animation: slideUp .3s ease both;
    `;
    banner.innerHTML = `
      <span style="font-size:18px;">${c.icon}</span>
      <span style="flex:1;line-height:1.4;">${c.text}</span>
      ${c.cta ? `<button onclick="window.showModalById?.('premiumModal');document.getElementById('sub-banner')?.remove();"
        style="background:${c.color};color:#fff;border:none;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">
        ${c.cta}
      </button>` : ''}
      <button onclick="this.parentElement.remove()"
        style="background:none;border:none;color:${c.color};cursor:pointer;font-size:16px;padding:0;opacity:.6;">✕</button>
    `;

    document.body.appendChild(banner);

    // Auto-masquer après 12s (sauf expiration)
    if (type !== 'expired') {
      setTimeout(() => banner.remove(), 12000);
    }
  }

  // ══════════════════════════════════════
  // GUARD DE NAVIGATION
  // Intercepte navTo() pour les sections Premium-only
  // ══════════════════════════════════════
  function guardNavigation() {
    const originalNavTo = window.navTo;
    if (typeof originalNavTo !== 'function') {
      // Réessayer quand navTo sera défini
      setTimeout(guardNavigation, 500);
      return;
    }
    if (originalNavTo._subscriptionGuarded) return;

    window.navTo = function (section) {
      const state = window._subscriptionState;
      if (!state) { originalNavTo(section); return; }

      const requiredFeature = SECTION_FEATURES[section];
      if (requiredFeature) {
        // Expiré → bloquer
        if (state.isExpired) {
          showPremiumRequired(section, true);
          return;
        }
        // Plan actif mais feature pas incluse
        const plan = state.plan || 'Free';
        if (!window.planHasFeature?.(plan, requiredFeature)) {
          showPremiumRequired(section, false, requiredFeature);
          return;
        }
      }

      originalNavTo(section);
    };

    window.navTo._subscriptionGuarded = true;
  }

  // ══════════════════════════════════════
  // MODALE "FONCTIONNALITÉ PREMIUM"
  // ══════════════════════════════════════
  const SECTION_LABELS = {
    rapports: 'Rapports & Chiffres',
    caisse:   'Caisse',
    team:     "Gestion d'équipe",
    boutiques: 'Multi-boutiques',
  };

  function showPremiumRequired(section, isExpired = false, feature = null) {
    const existing = document.getElementById('premium-gate-modal');
    if (existing) existing.remove();

    const label = SECTION_LABELS[section] || section;

    // Trouver le plan minimum requis pour cette feature
    let minPlan = null;
    if (feature && window.PLANS) {
      const ordered = ['Starter', 'Pro', 'Business'];
      minPlan = ordered.find(p => window.PLANS[p]?.features[feature]);
    }
    const bd    = document.createElement('div');
    bd.id = 'premium-gate-modal';
    bd.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;';
    bd.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:24px;max-width:320px;width:100%;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">${isExpired ? '⏰' : '⭐'}</div>
        <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:#111;margin-bottom:8px;">
          ${isExpired ? 'Abonnement expiré' : 'Fonctionnalité Premium'}
        </div>
        <div style="font-size:13px;color:#6B7280;line-height:1.5;margin-bottom:20px;">
          ${isExpired
            ? `Votre abonnement a expiré. Renouvelez pour accéder à <strong>${label}</strong>.`
            : minPlan
              ? `<strong>${label}</strong> est disponible à partir du plan <strong>${window.PLANS[minPlan]?.emoji || ''} ${minPlan}</strong> (${(window.PLANS[minPlan]?.price || 0).toLocaleString('fr-FR')} FCFA/mois).`
              : `<strong>${label}</strong> nécessite un abonnement supérieur.`
          }
        </div>
        <button onclick="window.showModalById?.('premiumModal');document.getElementById('premium-gate-modal')?.remove();"
          style="width:100%;padding:13px;background:linear-gradient(135deg,#7C3AED,#EC4899);color:#fff;border:none;border-radius:14px;font-family:'Sora',sans-serif;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:10px;">
          🚀 ${isExpired ? 'Renouveler mon abonnement' : 'Passer en Premium'}
        </button>
        <button onclick="document.getElementById('premium-gate-modal')?.remove();"
          style="background:none;border:none;color:#9CA3AF;font-size:13px;cursor:pointer;">
          Plus tard
        </button>
      </div>`;
    bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
    document.body.appendChild(bd);
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    // Attendre que authfetch soit disponible (chargé par api.js)
    if (!window.authfetch) {
      setTimeout(init, 300);
      return;
    }
    loadProfile();
    guardNavigation();
  }

  // ══════════════════════════════════════
  // POLLING — détection changement de plan
  // Vérifie toutes les 30s si le plan a changé (ex: admin vient de valider)
  // ══════════════════════════════════════
  let _pollInterval = null;
  let _lastStatus   = null;

  function startPolling() {
    if (_pollInterval) return; // déjà actif
    _pollInterval = setInterval(async () => {
      const prevPlan   = _profile?.plan;
      const prevStatus = _profile?.upgrade_status;

      await loadProfile();

      const newPlan   = _profile?.plan;
      const newStatus = _profile?.upgrade_status;

      // Changement détecté
      if (prevStatus !== newStatus || prevPlan !== newPlan) {

        // En attente → validé : plan activé !
        if (prevStatus === 'en attente' && newStatus === 'validé') {
          const planCfg = window.getPlan?.(newPlan) || {};
          window.showNotification?.(
            `🎉 Votre abonnement ${planCfg.emoji || ''} ${planCfg.label || newPlan} est maintenant actif !`,
            'success'
          );
          // Arrêter le polling — plus besoin
          stopPolling();
          // Recharger les données pour débloquer les sections
          await window.syncFromServer?.();
          window.updateStats?.();
          window.afficherProduits?.();
          window.afficherCategories?.();
          // Retirer la bannière "en attente" si présente
          document.getElementById('sub-banner')?.remove();
        }

        // Validé → expiré : plan rétrogradé
        if (prevStatus === 'validé' && (newStatus === 'expiré' || newPlan === 'Free')) {
          window.showNotification?.(
            '⚠️ Votre abonnement a expiré. Certaines fonctionnalités sont désactivées.',
            'warning'
          );
          stopPolling();
          await window.syncFromServer?.();
        }
      }

      // Arrêter le polling si plus en attente et plan actif
      if (newStatus !== 'en attente' && window.planHasFeature?.(newPlan, 'ventes')) {
        stopPolling();
      }
    }, 30000); // toutes les 30 secondes

    console.log('🔄 Polling plan démarré (statut: en attente)');
  }

  function stopPolling() {
    if (_pollInterval) {
      clearInterval(_pollInterval);
      _pollInterval = null;
    }
  }

  // ══════════════════════════════════════
  // HELPER PUBLIC — vérification de feature
  // Utilisable par n'importe quel module :
  //   if (!window.canUseFeature('export')) { showUpgradeModal(); return; }
  // ══════════════════════════════════════
  function canUseFeature(feature) {
    const state = window._subscriptionState;
    if (!state) return true;  // pas encore chargé → on laisse passer
    if (state.isExpired) return false;
    return window.planHasFeature?.(state.plan, feature) ?? true;
  }

  function showUpgradeModal(feature) {
    const minPlan = (() => {
      if (!window.PLANS) return 'Pro';
      const ordered = ['Starter', 'Pro', 'Business'];
      return ordered.find(p => window.PLANS[p]?.features[feature]) || 'Pro';
    })();
    const cfg = window.PLANS?.[minPlan];
    window.showNotification?.(
      `${cfg?.emoji || '⭐'} La fonctionnalité "${feature}" nécessite le plan ${minPlan} (${(cfg?.price || 0).toLocaleString('fr-FR')} F/mois).`,
      'warning'
    );
    setTimeout(() => window.showModalById?.('premiumModal'), 400);
  }

  // Exposer pour que app.js puisse recharger après sync
  window.subscriptionGuard = { reload: loadProfile, startPolling, stopPolling };
  window.canUseFeature   = canUseFeature;
  window.showUpgradeModal = showUpgradeModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
