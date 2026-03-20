/**
 * pin-security.js — Verrou PIN + Biométrie (opt-in)
 *
 * NE S'ACTIVE QUE si l'utilisateur le configure explicitement.
 * Accessible depuis le Profil → Sécurité.
 *
 * Fonctionnalités :
 *   - PIN à 4 chiffres (stocké hashé en SHA-256 dans localStorage)
 *   - Biométrie optionnelle via WebAuthn (empreinte / Face ID)
 *   - Verrou après 5 tentatives échouées (30s de délai)
 *   - Auto-verrouillage après 5 minutes d'inactivité
 *   - Désactivation simple depuis le profil
 *
 * INTÉGRATION dans index.html, avant </body> :
 *   <script src="js/pin-security.js"></script>
 */

(function () {

  const PIN_KEY       = 'sc_pin_hash';
  const BIO_KEY       = 'sc_bio_enabled';
  const ATTEMPTS_KEY  = 'sc_pin_attempts';
  const LOCKED_KEY    = 'sc_pin_locked_until';
  const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes
  const MAX_ATTEMPTS  = 5;
  const LOCK_DURATION = 30 * 1000; // 30 secondes

  let inactivityTimer = null;
  let isUnlocked      = false;

  // ══════════════════════════════════════
  // HASH SHA-256 du PIN
  // ══════════════════════════════════════
  async function hashPin(pin) {
    const buf    = new TextEncoder().encode(pin + 'sc_salt_v1');
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  // ══════════════════════════════════════
  // ÉTAT DU PIN
  // ══════════════════════════════════════
  function isPINEnabled()  { return !!localStorage.getItem(PIN_KEY); }
  function isBioEnabled()  { return localStorage.getItem(BIO_KEY) === 'true'; }

  function getAttempts()   { return parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0'); }
  function addAttempt()    { localStorage.setItem(ATTEMPTS_KEY, getAttempts() + 1); }
  function resetAttempts() { localStorage.removeItem(ATTEMPTS_KEY); }

  function isLocked() {
    const until = parseInt(localStorage.getItem(LOCKED_KEY) || '0');
    return Date.now() < until;
  }
  function lockout() {
    localStorage.setItem(LOCKED_KEY, Date.now() + LOCK_DURATION);
    resetAttempts();
  }
  function getLockRemaining() {
    return Math.ceil((parseInt(localStorage.getItem(LOCKED_KEY)||'0') - Date.now()) / 1000);
  }

  // ══════════════════════════════════════
  // BIOMÉTRIE (WebAuthn)
  // ══════════════════════════════════════
  const CRED_KEY = 'sc_bio_cred_id';

  async function registerBiometric() {
    if (!window.PublicKeyCredential) return false;
    try {
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge:  crypto.getRandomValues(new Uint8Array(32)),
          rp:         { name: 'Sama Commerce' },
          user:       { id: new Uint8Array(16), name: 'user', displayName: 'Utilisateur' },
          pubKeyCredParams: [{ type:'public-key', alg:-7 }, { type:'public-key', alg:-257 }],
          authenticatorSelection: { userVerification:'required', requireResidentKey:false },
          timeout: 60000,
        }
      });
      localStorage.setItem(CRED_KEY, btoa(String.fromCharCode(...new Uint8Array(cred.rawId))));
      localStorage.setItem(BIO_KEY, 'true');
      return true;
    } catch { return false; }
  }

  async function verifyBiometric() {
    if (!window.PublicKeyCredential) return false;
    const credId = localStorage.getItem(CRED_KEY);
    if (!credId) return false;
    try {
      const rawId = Uint8Array.from(atob(credId), c => c.charCodeAt(0));
      await navigator.credentials.get({
        publicKey: {
          challenge:        crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type:'public-key', id:rawId }],
          userVerification: 'required',
          timeout:          30000,
        }
      });
      return true;
    } catch { return false; }
  }

  // ══════════════════════════════════════
  // ÉCRAN DE VERROUILLAGE
  // ══════════════════════════════════════
  function showLockScreen(onUnlock) {
    document.getElementById('pin-lockscreen')?.remove();

    const screen = document.createElement('div');
    screen.id = 'pin-lockscreen';
    screen.style.cssText = `
      position:fixed; inset:0; z-index:9999;
      background:linear-gradient(135deg,#2E1065,#4C1D95,#500724);
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      padding:20px;
      animation:pinFadeIn .25s ease both;
    `;

    const boutique = document.getElementById('appHeader')?.textContent?.replace('🏪','').trim() || 'Sama Commerce';
    const lockedUntil = isLocked() ? getLockRemaining() : 0;

    screen.innerHTML = `
      <style>
        @keyframes pinFadeIn { from{opacity:0;transform:scale(.97)} to{opacity:1;transform:scale(1)} }
        @keyframes pinShake  { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
        .pin-dot {
          width:14px; height:14px; border-radius:50%;
          border:2px solid rgba(255,255,255,.5);
          transition:background .15s, border-color .15s, transform .15s;
        }
        .pin-dot.filled { background:#fff; border-color:#fff; transform:scale(1.1); }
        .pin-key {
          width:72px; height:72px; border-radius:50%;
          background:rgba(255,255,255,.12);
          border:none; color:#fff;
          font-size:22px; font-family:'Sora',sans-serif; font-weight:700;
          cursor:pointer; transition:background .15s, transform .1s;
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          line-height:1; gap:2px;
          -webkit-tap-highlight-color:transparent;
        }
        .pin-key:active { background:rgba(255,255,255,.25); transform:scale(.92); }
        .pin-key-sub { font-size:8px; font-weight:600; opacity:.6; letter-spacing:.5px; text-transform:uppercase; }
        .pin-key.del  { background:rgba(255,255,255,.06); }
        .pin-key.bio  { background:rgba(255,255,255,.06); font-size:28px; }
        #pin-error { min-height:20px; font-size:12px; font-weight:700; color:#FCA5A5; text-align:center; margin-top:6px; }
      </style>

      <!-- Logo + Titre -->
      <div style="text-align:center;margin-bottom:32px;">
        <div style="font-size:40px;margin-bottom:8px;">🔐</div>
        <div style="font-family:'Sora',sans-serif;font-size:22px;font-weight:800;color:#fff;margin-bottom:4px;">${boutique}</div>
        <div style="font-size:13px;color:rgba(255,255,255,.6);">Entrez votre code PIN</div>
      </div>

      <!-- Points PIN -->
      <div id="pin-dots" style="display:flex;gap:16px;margin-bottom:28px;">
        <div class="pin-dot" id="pd-0"></div>
        <div class="pin-dot" id="pd-1"></div>
        <div class="pin-dot" id="pd-2"></div>
        <div class="pin-dot" id="pd-3"></div>
      </div>

      <!-- Erreur / Lockout -->
      <div id="pin-error">${lockedUntil > 0 ? `⏳ Réessayez dans ${lockedUntil}s` : ''}</div>

      <!-- Clavier numérique -->
      <div id="pin-keypad" style="
        display:grid; grid-template-columns:repeat(3,1fr); gap:14px;
        max-width:260px; width:100%;
        ${lockedUntil > 0 ? 'opacity:.4;pointer-events:none;' : ''}
      ">
        ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k,i) => {
          if (k === '') return `<div></div>`;
          const isBio = false;
          const isDel = k === '⌫';
          return `<button class="pin-key ${isDel?'del':''}"
            data-key="${k}" onclick="window._pinKey('${k}')">
            ${k}
            ${typeof k === 'number' && k > 0 ? `<div class="pin-key-sub">${['','ABC','DEF','GHI','JKL','MNO','PQRS','TUV','WXYZ'][k]||''}</div>` : ''}
          </button>`;
        }).join('')}
      </div>

      <!-- Biométrie si disponible -->
      ${isBioEnabled() ? `
        <button class="pin-key bio" style="margin-top:20px;width:60px;height:60px;font-size:28px;"
          onclick="window._pinBio()">
          👆
        </button>
        <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:6px;">Déverrouillez avec votre empreinte</div>
      ` : ''}
    `;

    document.body.appendChild(screen);

    // Countdown si lockout
    if (lockedUntil > 0) {
      const interval = setInterval(() => {
        const rem = getLockRemaining();
        const errEl = screen.querySelector('#pin-error');
        const kpad  = screen.querySelector('#pin-keypad');
        if (rem <= 0) {
          clearInterval(interval);
          if (errEl) errEl.textContent = '';
          if (kpad)  { kpad.style.opacity='1'; kpad.style.pointerEvents='auto'; }
        } else {
          if (errEl) errEl.textContent = `⏳ Réessayez dans ${rem}s`;
        }
      }, 1000);
    }

    // État du PIN saisi
    let entered = '';

    window._pinKey = async (key) => {
      if (isLocked()) return;

      if (key === '⌫') {
        entered = entered.slice(0, -1);
        updateDots(entered.length);
        return;
      }

      if (typeof key === 'number' || (typeof key === 'string' && /\d/.test(key))) {
        if (entered.length >= 4) return;
        entered += String(key);
        updateDots(entered.length);

        if (entered.length === 4) {
          await verifyPin(entered, screen, onUnlock);
          entered = '';
        }
      }
    };

    window._pinBio = async () => {
      const ok = await verifyBiometric();
      if (ok) unlockApp(screen, onUnlock);
      else {
        const errEl = screen.querySelector('#pin-error');
        if (errEl) errEl.textContent = 'Biométrie échouée — utilisez votre PIN';
      }
    };

    function updateDots(n) {
      for (let i = 0; i < 4; i++) {
        const dot = screen.querySelector(`#pd-${i}`);
        if (dot) dot.classList.toggle('filled', i < n);
      }
    }

    // Auto-biométrie au chargement
    if (isBioEnabled() && !isLocked()) {
      setTimeout(() => window._pinBio?.(), 300);
    }
  }

  async function verifyPin(pin, screen, onUnlock) {
    const hash    = await hashPin(pin);
    const stored  = localStorage.getItem(PIN_KEY);

    if (hash === stored) {
      resetAttempts();
      unlockApp(screen, onUnlock);
    } else {
      addAttempt();
      const att  = getAttempts();
      const rem  = MAX_ATTEMPTS - att;
      const errEl = screen?.querySelector('#pin-error');

      if (att >= MAX_ATTEMPTS) {
        lockout();
        if (errEl) errEl.textContent = `🔒 Trop de tentatives — attendez 30s`;
        const kpad = screen?.querySelector('#pin-keypad');
        if (kpad) { kpad.style.opacity='.4'; kpad.style.pointerEvents='none'; }
        setTimeout(() => { if(kpad){kpad.style.opacity='1';kpad.style.pointerEvents='auto';} if(errEl)errEl.textContent=''; }, LOCK_DURATION);
      } else {
        if (errEl) errEl.textContent = `❌ PIN incorrect — ${rem} tentative${rem>1?'s':''} restante${rem>1?'s':''}`;
      }

      // Animation secousse des points
      const dots = screen?.querySelector('#pin-dots');
      if (dots) {
        dots.style.animation = 'pinShake .35s ease';
        setTimeout(() => { if(dots) dots.style.animation=''; }, 400);
      }
      // Vider les points après erreur
      setTimeout(() => { for(let i=0;i<4;i++){ const d=screen?.querySelector(`#pd-${i}`); if(d) d.classList.remove('filled'); } }, 400);
    }
  }

  function unlockApp(screen, onUnlock) {
    isUnlocked = true;
    screen.style.animation = 'pinFadeIn .2s ease reverse both';
    setTimeout(() => { screen.remove(); delete window._pinKey; delete window._pinBio; }, 220);
    onUnlock?.();
    startInactivityTimer();
  }

  // ══════════════════════════════════════
  // AUTO-VERROUILLAGE PAR INACTIVITÉ
  // ══════════════════════════════════════
  function startInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      if (!isPINEnabled()) return;
      isUnlocked = false;
      showLockScreen();
    }, INACTIVITY_MS);
  }

  function resetInactivityTimer() {
    if (isUnlocked && isPINEnabled()) startInactivityTimer();
  }

  ['touchstart','click','keydown','scroll'].forEach(evt => {
    document.addEventListener(evt, resetInactivityTimer, { passive:true });
  });

  // ══════════════════════════════════════
  // CONFIGURATION DU PIN (depuis le profil)
  // ══════════════════════════════════════
  function openPINSetup(onDone) {
    const bd = document.createElement('div');
    bd.style.cssText = `
      position:fixed;inset:0;background:rgba(10,7,30,.7);
      backdrop-filter:blur(8px);z-index:9998;
      display:flex;flex-direction:column;justify-content:flex-end;align-items:center;
      padding-bottom:calc(var(--nav-h,68px)+var(--safe-b,0px));
    `;

    bd.innerHTML = `
      <div style="
        background:var(--surface,#fff);border-radius:24px 24px 0 0;
        padding:20px;width:100%;max-width:480px;
        animation:moduleSheetUp .3s cubic-bezier(.34,1.3,.64,1) both;
      ">
        <div style="width:36px;height:4px;background:#E5E7EB;border-radius:2px;margin:0 auto 16px;"></div>
        <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:var(--text);text-align:center;margin-bottom:6px;">
          🔐 Configurer le PIN
        </div>
        <div id="pin-setup-step" style="font-size:13px;color:var(--muted);text-align:center;margin-bottom:20px;">
          Choisissez un code à 4 chiffres
        </div>

        <!-- Points -->
        <div style="display:flex;justify-content:center;gap:16px;margin-bottom:20px;" id="setup-dots">
          ${[0,1,2,3].map(i=>`<div style="width:14px;height:14px;border-radius:50%;border:2px solid #E5E7EB;transition:all .15s;" id="sdot-${i}"></div>`).join('')}
        </div>

        <!-- Clavier -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:260px;margin:0 auto 16px;">
          ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => {
            if(k==='') return '<div></div>';
            return `<button style="
              height:56px;border-radius:14px;border:none;
              background:#F3F4F6;color:var(--text);
              font-size:18px;font-family:'Sora',sans-serif;font-weight:700;
              cursor:pointer;transition:background .12s,transform .1s;
              -webkit-tap-highlight-color:transparent;
            " onmousedown="this.style.background='#EDE9FE'" onmouseup="this.style.background='#F3F4F6'"
              onclick="window._setupKey('${k}')">${k}</button>`;
          }).join('')}
        </div>

        <!-- Biométrie -->
        ${window.PublicKeyCredential ? `
          <div id="bio-setup-row" style="
            display:flex;align-items:center;justify-content:space-between;
            padding:12px 16px;background:#F9FAFB;border-radius:14px;margin-bottom:12px;
          ">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text);">👆 Déverrouillez avec biométrie</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px;">Empreinte digitale ou Face ID</div>
            </div>
            <button id="bio-toggle" onclick="window._toggleBio()" style="
              padding:7px 14px;border:none;border-radius:10px;
              background:${isBioEnabled()?'var(--primary)':'#E5E7EB'};
              color:${isBioEnabled()?'#fff':'var(--muted)'};
              font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;
            ">${isBioEnabled()?'Activé ✓':'Activer'}</button>
          </div>
        ` : ''}

        <button onclick="this.closest('div[style*=\"position:fixed\"]').remove()" style="
          width:100%;padding:12px;background:#F3F4F6;color:#6B7280;
          border:none;border-radius:14px;font-family:'Sora',sans-serif;
          font-size:13px;font-weight:600;cursor:pointer;
        ">Annuler</button>
      </div>
    `;

    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if(e.target===bd) bd.remove(); });

    let step  = 1; // 1=saisie, 2=confirmation
    let first = '';
    let curr  = '';

    function updateSetupDots(n) {
      for(let i=0;i<4;i++) {
        const d = bd.querySelector(`#sdot-${i}`);
        if(d) { d.style.background = i<n?'var(--primary)':'transparent'; d.style.borderColor = i<n?'var(--primary)':'#E5E7EB'; }
      }
    }

    window._setupKey = async (key) => {
      if(key==='⌫') { curr=curr.slice(0,-1); updateSetupDots(curr.length); return; }
      if(curr.length>=4) return;
      curr += String(key);
      updateSetupDots(curr.length);

      if(curr.length===4) {
        if(step===1) {
          first = curr; curr='';
          bd.querySelector('#pin-setup-step').textContent = '🔁 Confirmez votre code';
          updateSetupDots(0);
          step=2;
        } else {
          if(curr === first) {
            const hash = await hashPin(curr);
            localStorage.setItem(PIN_KEY, hash);
            bd.remove();
            delete window._setupKey;
            window.showNotification?.('✅ PIN configuré avec succès','success');
            onDone?.();
          } else {
            bd.querySelector('#pin-setup-step').textContent='❌ Les codes ne correspondent pas — recommencez';
            bd.querySelector('#pin-setup-step').style.color='#EF4444';
            curr=''; first=''; step=1;
            updateSetupDots(0);
            setTimeout(()=>{ const el=bd.querySelector('#pin-setup-step'); if(el){el.textContent='Choisissez un code à 4 chiffres';el.style.color='';} },1500);
          }
        }
      }
    };

    window._toggleBio = async () => {
      if(isBioEnabled()) {
        localStorage.removeItem(BIO_KEY); localStorage.removeItem(CRED_KEY);
        const btn = bd.querySelector('#bio-toggle');
        if(btn) { btn.textContent='Activer'; btn.style.background='#E5E7EB'; btn.style.color='var(--muted)'; }
        window.showNotification?.('Biométrie désactivée','info');
      } else {
        const ok = await registerBiometric();
        if(ok) {
          const btn = bd.querySelector('#bio-toggle');
          if(btn) { btn.textContent='Activé ✓'; btn.style.background='var(--primary)'; btn.style.color='#fff'; }
          window.showNotification?.('✅ Biométrie activée','success');
        } else {
          window.showNotification?.('Biométrie non disponible sur cet appareil','warning');
        }
      }
    };
  }

  function disablePIN() {
    localStorage.removeItem(PIN_KEY);
    localStorage.removeItem(BIO_KEY);
    localStorage.removeItem(CRED_KEY);
    resetAttempts();
    isUnlocked = true;
    window.showNotification?.('🔓 PIN désactivé','info');
  }

  // ══════════════════════════════════════
  // INJECTION DANS LE PROFIL
  // ══════════════════════════════════════
  function injectPINSection() {
    // Observer l'apparition de #profilContent rempli
    const obs = new MutationObserver(() => {
      const content = document.getElementById('profilContent');
      if (!content || content.querySelector('#pin-section')) return;
      if (!content.querySelector('#profil-save-info')) return; // pas encore rendu

      const section = document.createElement('div');
      section.id = 'pin-section';
      section.style.cssText = 'background:var(--surface);border-radius:20px;padding:18px;margin-bottom:14px;box-shadow:0 2px 14px rgba(0,0,0,.06);';
      section.innerHTML = `
        <div style="font-family:'Sora',sans-serif;font-size:15px;font-weight:800;color:var(--text);margin-bottom:14px;">🔐 Sécurité PIN</div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #F3F4F6;">
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text);">Verrou PIN</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">
              ${isPINEnabled() ? '✅ Activé — code à 4 chiffres' : 'Désactivé — l\'app s\'ouvre sans code'}
            </div>
          </div>
          <button id="pin-toggle-btn" style="
            padding:8px 16px;border:none;border-radius:11px;
            background:${isPINEnabled()?'#FEF2F2':'linear-gradient(135deg,var(--primary),var(--accent))'};
            color:${isPINEnabled()?'#DC2626':'#fff'};
            font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer;
          ">${isPINEnabled()?'Désactiver':'Activer'}</button>
        </div>
        ${isPINEnabled() ? `
          <div style="padding:10px 0 0;font-size:12px;color:var(--muted);">
            Auto-verrouillage après 5 minutes d'inactivité.
            ${isBioEnabled() ? ' · 👆 Biométrie activée.' : ''}
          </div>
        ` : ''}
      `;

      section.querySelector('#pin-toggle-btn').addEventListener('click', () => {
        if(isPINEnabled()) {
          disablePIN();
          section.remove(); injectPINSection();
        } else {
          openPINSetup(() => { section.remove(); injectPINSection(); });
        }
      });

      // Insérer avant le bouton déconnexion
      const logoutBtn = Array.from(content.querySelectorAll('button')).find(b => b.textContent.includes('Déconnecter'));
      if(logoutBtn) logoutBtn.parentNode.insertBefore(section, logoutBtn);
      else content.appendChild(section);
    });

    const content = document.getElementById('profilContent');
    if(content) obs.observe(content, { childList:true, subtree:false });
  }

  // ══════════════════════════════════════
  // INIT — Vérifier au démarrage
  // ══════════════════════════════════════
  function init() {
    if(!isPINEnabled()) return;

    // Attendre que l'app soit prête avant d'afficher le verrou
    window.addEventListener('load', () => {
      setTimeout(() => {
        if(!isPINEnabled() || isUnlocked) return;
        showLockScreen(() => { isUnlocked = true; });
      }, 800);
    });
  }

  // ══════════════════════════════════════
  // API PUBLIQUE
  // ══════════════════════════════════════
  window.pinSecurity = {
    isEnabled:  isPINEnabled,
    setup:      openPINSetup,
    disable:    disablePIN,
    lock:       () => { isUnlocked=false; showLockScreen(()=>{isUnlocked=true;}); },
    isUnlocked: () => isUnlocked,
  };

  injectPINSection();

  // Observer les changements de section profil
  window.addEventListener('pageChange', e => {
    if(e.detail?.key === 'profil') setTimeout(injectPINSection, 500);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
