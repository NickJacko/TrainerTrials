// assets/js/trainer_widget.js
// Einheitliches Trainer-Widget für alle öffentlichen Seiten
// Einbinden mit: <script type="module" src="assets/js/trainer_widget.js"></script>

const STORAGE_KEY = 'catchmon_trainer_name';

function getSavedTrainer() {
  try { return localStorage.getItem(STORAGE_KEY) || null; }
  catch { return null; }
}

function getDonationTier(d) {
  if (d >= 2500) return 'god';
  if (d >= 500)  return 'king';
  if (d >= 250)  return 'diamond';
  if (d >= 100)  return 'flame';
  if (d >= 50)   return 'shine';
  return 'normal';
}

function calcTeamPts(team) {
  if (!team) return 0;
  const arr = Array.isArray(team) ? team : Object.values(team);
  return arr.reduce((s, c) => {
    if (!c) return s;
    const stats = c.stats || {};
    let p = (c.level || 1) * 10 + Object.values(stats).reduce((a,b) => a+(b||0), 0);
    p *= { Common:1, Uncommon:1.2, Rare:1.5, Epic:2, Legendary:3, Mythical:4 }[c.rarity||'Common'] || 1;
    if (c.shiny) p *= 1.5;
    return s + Math.floor(p);
  }, 0);
}

function calcLevel(pts) {
  return Math.floor(Math.pow(pts / 500, 0.6));
}

function capitalize(s) {
  return String(s ?? '').charAt(0).toUpperCase() + String(s ?? '').slice(1);
}

// CSS einmal injizieren
function injectCSS() {
  if (document.getElementById('trainer-widget-css')) return;
  const style = document.createElement('style');
  style.id = 'trainer-widget-css';
  style.textContent = `
    #trainerGlobalWidget {
      position: fixed; top: 12px; right: 12px; z-index: 1100;
      display: flex; align-items: center; gap: 0;
      background: rgba(255,255,255,0.08); backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.15); border-radius: 20px;
      overflow: hidden; transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    }
    #trainerGlobalWidget:hover { border-color: rgba(255,215,0,0.35); }

    #trainerGlobalWidget .tgw-profile {
      display: flex; align-items: center; gap: 9px;
      padding: 8px 12px 8px 14px;
      text-decoration: none; color: white;
      transition: background 0.15s ease;
    }
    #trainerGlobalWidget .tgw-profile:hover { background: rgba(255,255,255,0.06); }

    #trainerGlobalWidget .tgw-avatar { font-size: 1.15rem; line-height: 1; }
    #trainerGlobalWidget .tgw-info { line-height: 1.25; }
    #trainerGlobalWidget .tgw-name {
      font-size: 13px; font-weight: 700; white-space: nowrap;
      max-width: 120px; overflow: hidden; text-overflow: ellipsis;
    }
    #trainerGlobalWidget .tgw-level { font-size: 11px; opacity: 0.5; }

    #trainerGlobalWidget .tgw-change {
      display: flex; align-items: center; justify-content: center;
      width: 34px; height: 100%; min-height: 38px;
      border-left: 1px solid rgba(255,255,255,0.1);
      cursor: pointer; font-size: 13px; opacity: 0.45;
      transition: all 0.15s ease; background: transparent; color: white;
      text-decoration: none;
    }
    #trainerGlobalWidget .tgw-change:hover { opacity: 1; background: rgba(255,255,255,0.08); }

    /* Catcher-Name Tier-Styles (für das Widget) */
    #trainerGlobalWidget .cn-god,
    #trainerGlobalWidget .cn-king    { background-image: linear-gradient(90deg,#ffd700,#fff,#ffd700); background-size:200% auto; background-clip:text; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation:tgw-shine 3s linear infinite; }
    #trainerGlobalWidget .cn-flame   { background-image: linear-gradient(90deg,#ff4444,#fff,#ff4444); background-size:200% auto; background-clip:text; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation:tgw-shine 3s linear infinite; }
    #trainerGlobalWidget .cn-diamond { background-image: linear-gradient(90deg,#00bfff,#fff,#00bfff); background-size:200% auto; background-clip:text; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation:tgw-shine 3s linear infinite; }
    #trainerGlobalWidget .cn-shine   { background-image: linear-gradient(90deg,#32cd32,#fff,#32cd32); background-size:200% auto; background-clip:text; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation:tgw-shine 3s linear infinite; }
    @keyframes tgw-shine { to { background-position: -200% center; } }
  `;
  document.head.appendChild(style);
}

function buildWidget(trainerName, level, donation) {
  injectCSS();

  // Altes Widget entfernen falls vorhanden
  const old = document.getElementById('trainerGlobalWidget');
  if (old) old.remove();

  const tier = getDonationTier(donation);

  const widget = document.createElement('div');
  widget.id = 'trainerGlobalWidget';

  // Profil-Link (linker Teil)
  const profileLink = document.createElement('a');
  profileLink.className = 'tgw-profile';
  profileLink.href = `catcher_detail.html?name=${encodeURIComponent(trainerName)}`;

  const avatar = document.createElement('span');
  avatar.className = 'tgw-avatar';
  avatar.textContent = '👤';

  const info = document.createElement('div');
  info.className = 'tgw-info';

  const nameEl = document.createElement('div');
  nameEl.className = 'tgw-name';
  if (tier !== 'normal') {
    const span = document.createElement('span');
    span.className = `cn-${tier}`;
    span.textContent = capitalize(trainerName);
    nameEl.appendChild(span);
  } else {
    nameEl.textContent = capitalize(trainerName);
  }

  const levelEl = document.createElement('div');
  levelEl.className = 'tgw-level';
  levelEl.textContent = `Level ${level}`;

  info.append(nameEl, levelEl);
  profileLink.append(avatar, info);

  // Change-Button (rechter Teil) → öffnet Modal oder geht zu index
  const changeBtn = document.createElement('a');
  changeBtn.className = 'tgw-change';
  changeBtn.title = 'Change Trainer';
  changeBtn.textContent = '✎';

  // Wenn wir auf index.html sind → Modal öffnen
  // Auf anderen Seiten → zu index.html#choose
  const isIndex = window.location.pathname.endsWith('index.html') ||
                  window.location.pathname === '/' ||
                  window.location.pathname.endsWith('/');

  if (isIndex) {
    changeBtn.href = '#';
    changeBtn.addEventListener('click', e => {
      e.preventDefault();
      // Modal öffnen — index.js hat showModal() global
      if (typeof showModal === 'function') showModal();
    });
  } else {
    changeBtn.href = 'index.html#choose';
  }

  widget.append(profileLink, changeBtn);
  document.body.appendChild(widget);
}

// Firebase laden und Widget initialisieren
async function initTrainerWidget() {
  const trainerName = getSavedTrainer();
  if (!trainerName) return; // Kein Trainer gespeichert → kein Widget

  // Minimal-Widget sofort zeigen (ohne Daten)
  buildWidget(trainerName, '?', 0);

  // Dann Firebase-Daten nachladen für Level + Donation
  try {
    const { db } = await import('./firebase.client.js');
    const { ref, get } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');

    const snap = await get(ref(db, `trainers/${trainerName.toLowerCase()}`));
    const info = snap.val();
    if (info) {
      const team     = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
      const pts      = calcTeamPts(team);
      const level    = calcLevel(pts);
      const donation = info.donation || 0;
      buildWidget(trainerName, level, donation);
    }
  } catch (e) {
    console.warn('trainer_widget: Firebase load failed', e);
  }
}

// Auf index.html — Modal zeigen wenn #choose im Hash
if (window.location.hash === '#choose') {
  window.addEventListener('load', () => {
    history.replaceState(null, '', window.location.pathname);
    if (typeof showModal === 'function') showModal();
  });
}

initTrainerWidget();

// Export für index.js
export { getSavedTrainer, buildWidget, calcLevel, calcTeamPts };