/**
 * js/planConfig.js — VERSION FRONTEND (navigateur uniquement)
 *
 * ⚠️  Ce fichier est DIFFÉRENT de middleware/planConfig.js (backend Node.js)
 *     Il ne contient PAS de module.exports — incompatible avec les navigateurs.
 *
 * Expose sur window : PLANS, getPlan, PAID_PLANS
 */
(function () {
  const PLANS = {
    Free: {
      label: 'Gratuit', price: 0,
      products_limit: 5, members_limit: 0, boutiques_limit: 1,
      features: {
        ventes: true, stock: true, categories: true, caisse: false,
        credits: false, clients: false, fournisseurs: false, commandes: false,
        livraisons: false, rapports: false, photos: false, export: false,
        whatsapp: false, team: false, finance: false, multi_boutique: false,
      },
    },
    Starter: {
      label: 'Starter', price: 2500,
      products_limit: 30, members_limit: 0, boutiques_limit: 1,
      features: {
        ventes: true, stock: true, categories: true, caisse: true,
        credits: true, clients: true, fournisseurs: false, commandes: false,
        livraisons: false, rapports: false, photos: true, export: false,
        whatsapp: false, team: false, finance: false, multi_boutique: false,
      },
    },
    Pro: {
      label: 'Pro', price: 5000,
      products_limit: Infinity, members_limit: 0, boutiques_limit: 1,
      features: {
        ventes: true, stock: true, categories: true, caisse: true,
        credits: true, clients: true, fournisseurs: true, commandes: true,
        livraisons: true, rapports: true, photos: true, export: true,
        whatsapp: true, team: false, finance: true, multi_boutique: false,
      },
    },
    Business: {
      label: 'Business', price: 9000,
      products_limit: Infinity, members_limit: 3, boutiques_limit: 1,
      features: {
        ventes: true, stock: true, categories: true, caisse: true,
        credits: true, clients: true, fournisseurs: true, commandes: true,
        livraisons: true, rapports: true, photos: true, export: true,
        whatsapp: true, team: true, finance: true, multi_boutique: false,
      },
    },
    Enterprise: {
      label: 'Enterprise', price: 15000,
      products_limit: Infinity, members_limit: Infinity, boutiques_limit: Infinity,
      features: {
        ventes: true, stock: true, categories: true, caisse: true,
        credits: true, clients: true, fournisseurs: true, commandes: true,
        livraisons: true, rapports: true, photos: true, export: true,
        whatsapp: true, team: true, finance: true, multi_boutique: true,
      },
    },
  };

  const PAID_PLANS = ['Starter', 'Pro', 'Business', 'Enterprise'];

  function getPlan(planName)           { return PLANS[planName] || PLANS.Free; }
  function hasFeature(planName, feat)  { return getPlan(planName).features[feat] === true; }
  function getProductLimit(planName)   { return getPlan(planName).products_limit; }
  function getMembersLimit(planName)   { return getPlan(planName).members_limit ?? 0; }
  function getBoutiquesLimit(planName) { return getPlan(planName).boutiques_limit ?? 1; }

  // Exposer sur window pour les autres scripts
  window.PLANS              = PLANS;
  window.PAID_PLANS         = PAID_PLANS;
  window.getPlan            = getPlan;
  window.hasFeature         = hasFeature;
  window.getProductLimit    = getProductLimit;
  window.getMembersLimit    = getMembersLimit;
  window.getBoutiquesLimit  = getBoutiquesLimit;
})();
