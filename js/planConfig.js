/**
 * planConfig.js — Source de vérité frontend pour les plans
 * Miroir de middleware/planConfig.js côté backend
 */
window.PLANS = {
  Free: {
    label: 'Gratuit', price: 0, emoji: '🆓',
    color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB',
    products_limit: 5, members_limit: 0,
    features: { ventes:true, stock:true, categories:true,
      caisse:false, credits:false, clients:false, fournisseurs:false,
      commandes:false, livraisons:false, rapports:false,
      photos:false, export:false, whatsapp:false, team:false, finance:false },
  },
  Starter: {
    label: 'Starter', price: 2500, emoji: '🌱',
    color: '#059669', bg: '#ECFDF5', border: '#6EE7B7',
    products_limit: 30, members_limit: 0,
    features: { ventes:true, stock:true, categories:true,
      caisse:true, credits:true, clients:true, fournisseurs:false,
      commandes:false, livraisons:false, rapports:false,
      photos:true, export:false, whatsapp:false, team:false, finance:false },
  },
  Pro: {
    label: 'Pro', price: 5000, emoji: '⭐',
    color: '#7C3AED', bg: '#EDE9FE', border: '#C4B5FD',
    products_limit: Infinity, members_limit: 0,
    features: { ventes:true, stock:true, categories:true,
      caisse:true, credits:true, clients:true, fournisseurs:true,
      commandes:true, livraisons:true, rapports:true,
      photos:true, export:true, whatsapp:true, team:false, finance:true },
  },
  Business: {
    label: 'Business', price: 9000, emoji: '🏆',
    color: '#92400E', bg: '#FEF9C3', border: '#FCD34D',
    products_limit: Infinity, members_limit: 3,
    features: { ventes:true, stock:true, categories:true,
      caisse:true, credits:true, clients:true, fournisseurs:true,
      commandes:true, livraisons:true, rapports:true,
      photos:true, export:true, whatsapp:true, team:true, finance:true },
  },
};

window.getPlan = (name) => window.PLANS[name] || window.PLANS.Free;
window.planHasFeature = (planName, feat) => window.getPlan(planName).features[feat] === true;
