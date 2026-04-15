/**
 * activity-logs-section.js — Section "Logs d'activité"
 *
 * Ajoute une section "Journal" accessible via le menu Plus.
 * Affiche les actions des employés en timeline : ventes, modifications,
 * suppressions, etc. Filtre par sévérité et recherche.
 *
 * Visible uniquement pour les plans avec employés (Pro+).
 *
 * INTÉGRATION : <script src="js/activity-logs-section.js"></script>
 */

(function () {

  var API = function () {
    return document.querySelector('meta[name="api-base"]')?.content || '';
  };

  var SEVERITY_MAP = {
    info:     { icon: 'ℹ️', label: 'Info',     color: '#3B82F6', bg: '#EFF6FF' },
    warning:  { icon: '⚠️', label: 'Important', color: '#F59E0B', bg: '#FFFBEB' },
    critical: { icon: '🔴', label: 'Critique',  color: '#EF4444', bg: '#FEE2E2' },
  };

  var ACTION_LABELS = {
    vente: '💳 Vente enregistrée',
    modification_vente: '✏️ Vente modifiée',
    suppression_vente: '🗑️ Vente supprimée',
    credit_rembourse: '💰 Crédit remboursé',
    paiement_partiel: '💳 Paiement partiel',
    ajout_categorie: '🏷️ Catégorie ajoutée',
    modification_categorie: '✏️ Catégorie modifiée',
    suppression_categorie: '🗑️ Catégorie supprimée',
    ajout_produit: '📦 Produit ajouté',
    modification_produit: '✏️ Produit modifié',
    suppression_produit: '🗑️ Produit supprimé',
    modification_stock: '📊 Stock modifié',
  };

  var _logs = [];
  var _filter = 'all';

  // ══════════════════════════════════════
  // INJECTER LA SECTION HTML
  // ══════════════════════════════════════
  function injectSection() {
    if (document.getElementById('logsSection')) return;

    var scroll = document.querySelector('.scroll-content');
    if (!scroll) return;

    var section = document.createElement('div');
    section.className = 'section-page hidden';
    section.id = 'logsSection';
    section.innerHTML =
      '<div class="page-header" style="margin-top:6px;">' +
        '<h2>📋 Journal d\'activité</h2>' +
      '</div>' +
      '<div id="logsStats" style="display:flex;gap:8px;margin-bottom:14px;"></div>' +
      '<div id="logsFilters" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:10px;"></div>' +
      '<div id="logsList"></div>';

    scroll.appendChild(section);

    // Ajouter dans le menu Plus (enhanced-plus-menu)
    addToNavigation();
  }

  function addToNavigation() {
    // Ajouter "Journal" dans la sidebar desktop si elle existe
    var sidebar = document.querySelector('.dt-sidebar');
    if (sidebar && !sidebar.querySelector('[data-nav="logs"]')) {
      var profilBtn = sidebar.querySelector('[data-nav="profil"]');
      if (profilBtn) {
        var logsBtn = document.createElement('button');
        logsBtn.className = 'dt-sidebar-item';
        logsBtn.dataset.nav = 'logs';
        logsBtn.innerHTML = '<span class="dt-sidebar-item-icon">📋</span><span class="dt-sidebar-item-label">Journal</span>';
        logsBtn.addEventListener('click', function () {
          window.haptic?.tap();
          showLogsSection();
        });
        profilBtn.insertAdjacentElement('beforebegin', logsBtn);
      }
    }

    // Écouter showSection pour notre section custom
    var origShow = window.showSection;
    if (origShow && !origShow._logs) {
      window.showSection = function (section) {
        if (section === 'logs') {
          showLogsSection();
          return;
        }
        origShow(section);
      };
      window.showSection._logs = true;
    }
  }

  function showLogsSection() {
    // Cacher toutes les sections
    document.querySelectorAll('.section-page').forEach(function (s) {
      s.classList.add('hidden');
    });
    var section = document.getElementById('logsSection');
    if (section) {
      section.classList.remove('hidden');
      section.classList.add('sc-enter-forward');
    }

    var backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.style.display = 'block';

    loadLogs();
  }

  // ══════════════════════════════════════
  // CHARGER LES LOGS
  // ══════════════════════════════════════
  async function loadLogs() {
    var list = document.getElementById('logsList');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px;">Chargement…</div>';

    try {
      var url = API() + '/activity-logs?limit=50&days=30';
      if (_filter !== 'all') url += '&severity=' + _filter;

      var res = await window.authfetch?.(url);
      if (!res || !res.ok) {
        list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);">Section disponible avec un plan Pro+</div>';
        return;
      }

      var data = await res.json();
      _logs = data.logs || [];

      renderStats(data.stats || {});
      renderFilters();
      renderLogs();
    } catch (e) {
      list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--red);">Erreur de chargement</div>';
    }
  }

  // ══════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════
  function renderStats(stats) {
    var container = document.getElementById('logsStats');
    if (!container) return;

    container.innerHTML =
      renderStatCard(stats.info_count || 0, 'Actions', '#3B82F6', '#EFF6FF') +
      renderStatCard(stats.warning_count || 0, 'Importants', '#F59E0B', '#FFFBEB') +
      renderStatCard(stats.critical_count || 0, 'Critiques', '#EF4444', '#FEE2E2');
  }

  function renderStatCard(val, label, color, bg) {
    return '<div style="flex:1;text-align:center;padding:10px 8px;border-radius:12px;background:' + bg + ';">' +
      '<div style="font-family:Sora,sans-serif;font-size:18px;font-weight:800;color:' + color + ';">' + val + '</div>' +
      '<div style="font-size:10px;color:var(--muted);margin-top:2px;">' + label + '</div>' +
    '</div>';
  }

  function renderFilters() {
    var container = document.getElementById('logsFilters');
    if (!container) return;

    var filters = [
      { id: 'all',      label: 'Tout',       icon: '📋' },
      { id: 'info',     label: 'Actions',    icon: 'ℹ️' },
      { id: 'warning',  label: 'Importants', icon: '⚠️' },
      { id: 'critical', label: 'Critiques',  icon: '🔴' },
    ];

    container.innerHTML = filters.map(function (f) {
      var active = _filter === f.id;
      return '<button style="flex-shrink:0;padding:7px 14px;border-radius:10px;border:1.5px solid ' +
        (active ? 'var(--primary)' : 'rgba(124,58,237,.1)') + ';background:' +
        (active ? '#EDE9FE' : 'transparent') + ';font-family:Sora,sans-serif;font-size:12px;font-weight:700;' +
        'color:' + (active ? 'var(--primary)' : 'var(--muted)') + ';cursor:pointer;white-space:nowrap;" ' +
        'data-filter="' + f.id + '">' + f.icon + ' ' + f.label + '</button>';
    }).join('');

    container.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _filter = btn.dataset.filter;
        loadLogs();
      });
    });
  }

  function renderLogs() {
    var container = document.getElementById('logsList');
    if (!container) return;

    if (!_logs.length) {
      container.innerHTML = '<div style="text-align:center;padding:32px 16px;">' +
        '<div style="font-size:40px;margin-bottom:8px;">📋</div>' +
        '<div style="font-family:Sora,sans-serif;font-size:14px;font-weight:700;color:var(--text);">Aucune activité</div>' +
        '<div style="font-size:12px;color:var(--muted);margin-top:4px;">Les actions de votre équipe apparaîtront ici</div>' +
      '</div>';
      return;
    }

    container.innerHTML = '';
    var lastDate = '';

    _logs.forEach(function (log) {
      var sev = SEVERITY_MAP[log.severity] || SEVERITY_MAP.info;
      var label = ACTION_LABELS[log.action] || log.action;
      var date = new Date(log.created_at);
      var dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

      // Séparateur de date
      if (dateStr !== lastDate) {
        lastDate = dateStr;
        var sep = document.createElement('div');
        sep.style.cssText = 'font-family:Sora,sans-serif;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;padding:12px 0 6px;';
        sep.textContent = dateStr;
        container.appendChild(sep);
      }

      var el = document.createElement('div');
      el.style.cssText = 'display:flex;gap:12px;padding:12px 14px;border-radius:14px;margin-bottom:6px;background:var(--surface,#fff);box-shadow:0 1px 6px rgba(0,0,0,.04);border-left:3px solid ' + sev.color + ';';

      var timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      var details = '';
      if (log.details) {
        try {
          var d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
          if (d.total) details = ' · ' + Math.round(d.total).toLocaleString('fr-FR') + ' F';
          if (d.quantity) details += ' · x' + d.quantity;
          if (d.name) details = ' · ' + d.name;
        } catch (e) { /* ignore */ }
      }

      el.innerHTML =
        '<div style="width:36px;height:36px;border-radius:10px;background:' + sev.bg + ';display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">' + sev.icon + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-family:Sora,sans-serif;font-size:13px;font-weight:700;color:var(--text);">' + esc(label) + '</div>' +
          '<div style="font-size:11px;color:var(--muted);margin-top:2px;">' +
            esc(log.actor_name || 'Système') + ' · ' + timeStr + details +
          '</div>' +
        '</div>';

      container.appendChild(el);
    });
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init() {
    injectSection();
    // pageChange support
    window.addEventListener('pageChange', function (e) {
      if (e.detail?.key === 'logs') {
        showLogsSection();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 700); });
  } else {
    setTimeout(init, 700);
  }

})();
