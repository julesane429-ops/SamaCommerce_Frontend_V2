/**
 * i18n.js — Multi-langue Français / Wolof
 *
 * Système de traduction minimal :
 *   - Français (défaut)
 *   - Wolof (wo) — langue principale au Sénégal
 *
 * Utilisation :
 *   window.t('vente.encaisser')  → 'ENCAISSER' ou 'JAAY'
 *   window.setLang('wo')         → bascule en wolof
 *
 * Les éléments HTML avec data-i18n="key" sont mis à jour auto.
 *
 * INTÉGRATION dans index.html, dans <head> avant les autres scripts :
 *   <script src="js/i18n.js"></script>
 */

(function () {

  const LANG_KEY = 'sc_lang';

  // ══════════════════════════════════════
  // DICTIONNAIRE
  // ══════════════════════════════════════
  const TRANSLATIONS = {
    fr: {
      // Navigation
      'nav.accueil':    'Accueil',
      'nav.stock':      'Stock',
      'nav.chiffres':   'Chiffres',
      'nav.plus':       'Plus',

      // Accueil
      'home.encaisse':  'Encaissé',
      'home.vendus':    'Vendus',
      'home.en_stock':  'En stock',
      'home.vendre':    'VENDRE',
      'home.stock':     'STOCK',
      'home.categories':'CATÉGORIES',
      'home.chiffres':  'CHIFFRES',
      'home.inventaire':'INVENTAIRE',
      'home.credits':   'CRÉDITS',

      // Vente
      'vente.panier':       'Panier',
      'vente.encaisser':    'ENCAISSER',
      'vente.total':        'TOTAL',
      'vente.paiement':     'Mode de paiement',
      'vente.especes':      'Espèces',
      'vente.credit':       'Crédit',
      'vente.panier_vide':  'Votre panier est vide',

      // Stock
      'stock.titre':        'Mon Stock',
      'stock.ajouter':      '+ Ajouter',
      'stock.tous':         'Tous',

      // Général
      'btn.annuler':  'Annuler',
      'btn.confirmer':'Confirmer',
      'btn.fermer':   'Fermer',
      'btn.modifier': 'Modifier',
      'btn.supprimer':'Supprimer',
      'btn.ajouter':  'Ajouter',
      'btn.enregistrer': 'Enregistrer',

      // Plus sheet
      'plus.titre':       '✨ Plus',
      'plus.categories':  'Catégories',
      'plus.inventaire':  'Inventaire',
      'plus.credits':     'Crédits',
      'plus.clients':     'Clients',
      'plus.fournisseurs':'Fournisseurs',
      'plus.commandes':   'Commandes',
      'plus.livraisons':  'Livraisons',
      'plus.calendrier':  'Échéances',
      'plus.profil':      'Mon Profil',

      // Statuts
      'status.en_attente': 'En attente',
      'status.confirmee':  'Confirmée',
      'status.recue':      'Reçue',
      'status.annulee':    'Annulée',
      'status.en_transit': 'En transit',
      'status.livree':     'Livrée',
      'status.probleme':   'Problème',

      // Messages
      'msg.chargement':    'Chargement…',
      'msg.sync':          'Synchronisation en cours…',
      'msg.hors_ligne':    'Hors connexion',
      'msg.merci':         'Merci pour votre achat !',
    },

    wo: {
      // Navigation
      'nav.accueil':    'Kër',
      'nav.stock':      'Liggéey',
      'nav.chiffres':   'Xaalis',
      'nav.plus':       'Yeneen',

      // Accueil — CA/ventes/stock
      'home.encaisse':  'Xaalis bañ',
      'home.vendus':    'Jaaye',
      'home.en_stock':  'Ci biir',
      'home.vendre':    'JAAY',
      'home.stock':     'LIGGÉEY',
      'home.categories':'NGÉLAW',
      'home.chiffres':  'XAALIS',
      'home.inventaire':'BILAN',
      'home.credits':   'JUBBANTI',

      // Vente
      'vente.panier':       'Panier bi',
      'vente.encaisser':    'JAAY',
      'vente.total':        'YÉP',
      'vente.paiement':     'Lan ngay jeex ak?',
      'vente.especes':      'Xaalis wér',
      'vente.credit':       'Crédit',
      'vente.panier_vide':  'Panier bi doyuñu',

      // Stock
      'stock.titre':        'Liggéey bi',
      'stock.ajouter':      '+ Yokk',
      'stock.tous':         'Yép',

      // Général
      'btn.annuler':  'Dégël',
      'btn.confirmer':'Dalal',
      'btn.fermer':   'Tëj',
      'btn.modifier': 'Soppi',
      'btn.supprimer':'Lëk',
      'btn.ajouter':  'Yokk',
      'btn.enregistrer': 'Bind',

      // Plus sheet
      'plus.titre':       '✨ Yeneen',
      'plus.categories':  'Ngélaw',
      'plus.inventaire':  'Bilan',
      'plus.credits':     'Jubbanti',
      'plus.clients':     'Acheteur yi',
      'plus.fournisseurs':'Vendeur yi',
      'plus.commandes':   'Commande yi',
      'plus.livraisons':  'Liivreeson yi',
      'plus.calendrier':  'Njariñ yi',
      'plus.profil':      'Sa diggante',

      // Statuts
      'status.en_attente': 'Ci kanam',
      'status.confirmee':  'Seetël',
      'status.recue':      'Jënd',
      'status.annulee':    'Dugël nañu',
      'status.en_transit': 'Ci roto',
      'status.livree':     'Jëndeel',
      'status.probleme':   'Mbugël',

      // Messages
      'msg.chargement':    'Jël def…',
      'msg.sync':          'Soppiku…',
      'msg.hors_ligne':    'Internet bañ',
      'msg.merci':         'Jërejëf ci sa jënd!',
    },
  };

  // ══════════════════════════════════════
  // LANGUE COURANTE
  // ══════════════════════════════════════
  let currentLang = localStorage.getItem(LANG_KEY) || 'fr';

  // Détecter automatiquement si pas encore défini
  if (!localStorage.getItem(LANG_KEY)) {
    const nav = navigator.language || navigator.userLanguage || 'fr';
    // Le Sénégal → code 'fr-SN' ou 'wo'
    if (nav.startsWith('wo')) currentLang = 'wo';
    else currentLang = 'fr';
  }

  // ══════════════════════════════════════
  // FONCTION DE TRADUCTION
  // ══════════════════════════════════════
  function t(key, lang = currentLang) {
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['fr']?.[key] || key;
  }

  // ══════════════════════════════════════
  // APPLIQUER LES TRADUCTIONS AU DOM
  // ══════════════════════════════════════
  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const val = t(key);
      if (val) el.textContent = val;
    });

    // Mettre à jour les placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      const val = t(key);
      if (val) el.placeholder = val;
    });

    // Attribut lang sur <html>
    document.documentElement.lang = currentLang;
  }

  // ══════════════════════════════════════
  // CHANGER DE LANGUE
  // ══════════════════════════════════════
  function setLang(lang) {
    if (!TRANSLATIONS[lang]) return;
    currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);
    applyTranslations();
    window.showNotification?.(
      lang === 'wo' ? '🇸🇳 Wolof' : '🇫🇷 Français',
      'success'
    );
  }

  // ══════════════════════════════════════
  // SÉLECTEUR LANGUE (dans le profil)
  // ══════════════════════════════════════
  function injectLangInProfile() {
    const obs = new MutationObserver(() => {
      const content = document.getElementById('profilContent');
      if (!content || content.querySelector('#lang-section')) return;
      if (!content.querySelector('#profil-save-info')) return;

      const section = document.createElement('div');
      section.id = 'lang-section';
      section.style.cssText = 'background:var(--surface);border-radius:20px;padding:18px;margin-bottom:14px;box-shadow:0 2px 14px rgba(0,0,0,.06);';
      section.innerHTML = `
        <div style="font-family:'Sora',sans-serif;font-size:15px;font-weight:800;color:var(--text);margin-bottom:14px;">🌐 Langue / Làkk</div>
        <div style="display:flex;gap:10px;">
          <button id="lang-fr" style="
            flex:1;padding:12px;border-radius:14px;border:2px solid ${currentLang==='fr'?'var(--primary)':'#E5E7EB'};
            background:${currentLang==='fr'?'#EDE9FE':'var(--surface)'};
            font-family:'Sora',sans-serif;font-size:13px;font-weight:700;
            color:${currentLang==='fr'?'var(--primary)':'var(--text)'};cursor:pointer;
            transition:all .15s;
          " onclick="window.setLang('fr')">
            🇫🇷 Français
          </button>
          <button id="lang-wo" style="
            flex:1;padding:12px;border-radius:14px;border:2px solid ${currentLang==='wo'?'var(--primary)':'#E5E7EB'};
            background:${currentLang==='wo'?'#EDE9FE':'var(--surface)'};
            font-family:'Sora',sans-serif;font-size:13px;font-weight:700;
            color:${currentLang==='wo'?'var(--primary)':'var(--text)'};cursor:pointer;
            transition:all .15s;
          " onclick="window.setLang('wo')">
            🇸🇳 Wolof
          </button>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:10px;">
          ${currentLang==='wo' ? 'Xam-xam wolof ci jàppoo.' : 'La traduction wolof est partielle — les éléments dynamiques restent en français.'}
        </div>
      `;

      const logoutBtn = Array.from(content.querySelectorAll('button')).find(b => b.textContent.includes('Déconnecter'));
      if (logoutBtn) logoutBtn.parentNode.insertBefore(section, logoutBtn);
      else content.appendChild(section);
    });

    const content = document.getElementById('profilContent');
    if (content) obs.observe(content, { childList:true });
  }

  // ══════════════════════════════════════
  // API PUBLIQUE
  // ══════════════════════════════════════
  window.t           = t;
  window.setLang     = setLang;
  window.getLang     = () => currentLang;
  window.TRANSLATIONS = TRANSLATIONS;

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    applyTranslations();
    injectLangInProfile();

    window.addEventListener('pageChange', e => {
      if (e.detail?.key === 'profil') setTimeout(injectLangInProfile, 500);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
