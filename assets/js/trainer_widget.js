// assets/js/trainer_widget.js
// Globales Trainer-Widget + Modal für alle Seiten

const STORAGE_KEY = 'catchmon_trainer_name';

function getSavedTrainer() {
  try { return localStorage.getItem(STORAGE_KEY) || null; }
  catch { return null; }
}
function saveTrainer(name) {
  try { localStorage.setItem(STORAGE_KEY, name); }
  catch {}
}
function clearTrainer() {
  try { localStorage.removeItem(STORAGE_KEY); }
  catch {}
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

function calcLevel(pts) { return Math.floor(Math.pow(pts / 500, 0.6)); }
function capitalize(s) { return String(s ?? '').charAt(0).toUpperCase() + String(s ?? '').slice(1); }
function fmt(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000)    return (num / 1000).toFixed(1) + 'K';
  return String(num);
}
function escapeHtml(s) {
  return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

// ── CSS ───────────────────────────────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById('tw-css')) return;
  const style = document.createElement('style');
  style.id = 'tw-css';
  style.textContent = `
    /* ── WIDGET ── */
    #twWidget {
      position: fixed; top: 12px; right: 12px; z-index: 1100;
      display: flex; align-items: stretch; gap: 0;
      background: rgba(255,255,255,0.08); backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.15); border-radius: 20px;
      overflow: hidden; transition: border-color 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    }
    #twWidget:hover { border-color: rgba(255,215,0,0.35); }
    #twWidget .tw-profile {
      display: flex; align-items: center; gap: 9px;
      padding: 8px 12px 8px 14px;
      text-decoration: none; color: white;
      transition: background 0.15s ease;
    }
    #twWidget .tw-profile:hover { background: rgba(255,255,255,0.06); }
    #twWidget .tw-avatar { font-size: 1.15rem; line-height: 1; }
    #twWidget .tw-info { line-height: 1.25; }
    #twWidget .tw-name {
      font-size: 13px; font-weight: 700; white-space: nowrap;
      max-width: 130px; overflow: hidden; text-overflow: ellipsis;
    }
    #twWidget .tw-level { font-size: 11px; opacity: 0.5; }
    #twWidget .tw-edit {
      display: flex; align-items: center; justify-content: center;
      width: 36px; border-left: 1px solid rgba(255,255,255,0.1);
      cursor: pointer; font-size: 14px; opacity: 0.45; color: white;
      transition: all 0.15s ease; background: transparent; border-top: none; border-right: none; border-bottom: none;
    }
    #twWidget .tw-edit:hover { opacity: 1; background: rgba(255,255,255,0.08); }

    /* Name tier styles */
    #twWidget .cn-god, #twWidget .cn-king {
      background-image: linear-gradient(90deg,#ffd700,#fff,#ffd700);
      background-size:200% auto; background-clip:text;
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      animation: tw-shine 3s linear infinite;
    }
    #twWidget .cn-flame {
      background-image: linear-gradient(90deg,#ff4444,#fff,#ff4444);
      background-size:200% auto; background-clip:text;
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      animation: tw-shine 3s linear infinite;
    }
    #twWidget .cn-diamond {
      background-image: linear-gradient(90deg,#00bfff,#fff,#00bfff);
      background-size:200% auto; background-clip:text;
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      animation: tw-shine 3s linear infinite;
    }
    #twWidget .cn-shine {
      background-image: linear-gradient(90deg,#32cd32,#fff,#32cd32);
      background-size:200% auto; background-clip:text;
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      animation: tw-shine 3s linear infinite;
    }
    @keyframes tw-shine { to { background-position: -200% center; } }

    /* ── MODAL ── */
    #twModalOverlay {
      position: fixed; inset: 0; z-index: 9000;
      background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center; padding: 20px;
      opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    }
    #twModalOverlay.visible { opacity: 1; pointer-events: all; }
    #twModal {
      background: linear-gradient(145deg, #1a1a2e, #16213e);
      border: 1px solid rgba(255,255,255,0.15); border-radius: 28px; padding: 32px;
      width: 100%; max-width: 520px; max-height: 85vh;
      display: flex; flex-direction: column;
      box-shadow: 0 30px 80px rgba(0,0,0,0.5);
      transform: translateY(20px); transition: transform 0.3s ease; color: white;
    }
    #twModalOverlay.visible #twModal { transform: translateY(0); }
    .tw-modal-header { text-align: center; margin-bottom: 24px; }
    .tw-modal-icon { font-size: 3rem; margin-bottom: 12px; }
    .tw-modal-title {
      font-size: 1.8rem; font-weight: 900; margin-bottom: 6px;
      background: linear-gradient(45deg, #FFD700, #4ECDC4);
      background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .tw-modal-sub { font-size: 0.95rem; opacity: 0.6; }
    .tw-modal-search { position: relative; margin-bottom: 16px; flex-shrink: 0; }
    .tw-modal-search input {
      width: 100%; padding: 14px 18px 14px 44px; font-size: 15px;
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
      border-radius: 16px; color: white; outline: none; transition: all 0.2s;
    }
    .tw-modal-search input::placeholder { color: rgba(255,255,255,0.4); }
    .tw-modal-search input:focus { border-color: rgba(255,215,0,0.5); background: rgba(255,255,255,0.12); }
    .tw-modal-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 1.1rem; opacity: 0.5; }
    .tw-modal-list {
      flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;
    }
    .tw-modal-list::-webkit-scrollbar { width: 4px; }
    .tw-modal-list::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
    .tw-modal-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
    .tw-trainer-item {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 16px; border-radius: 16px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);
      cursor: pointer; transition: all 0.15s ease;
    }
    .tw-trainer-item:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,215,0,0.3); transform: translateX(4px); }
    .tw-trainer-item.selected { background: rgba(255,215,0,0.15); border-color: rgba(255,215,0,0.5); }
    .tw-rank { width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; flex-shrink: 0; color: rgba(255,255,255,0.6); }
    .tw-rank.r1 { background: linear-gradient(45deg,#ffd700,#ffed4e); color: #333; }
    .tw-rank.r2 { background: linear-gradient(45deg,#c0c0c0,#e8e8e8); color: #333; }
    .tw-rank.r3 { background: linear-gradient(45deg,#cd7f32,#daa520); color: white; }
    .tw-item-info { flex: 1; min-width: 0; }
    .tw-item-name { font-size: 1rem; font-weight: 700; margin-bottom: 3px; }
    .tw-item-meta { font-size: 12px; opacity: 0.55; }
    .tw-item-pts { font-size: 1rem; font-weight: 800; color: #FFD700; flex-shrink: 0; }
    .tw-modal-footer { margin-top: 20px; flex-shrink: 0; display: flex; gap: 10px; }
    .tw-btn-skip {
      flex: 1; padding: 13px; background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12); border-radius: 14px;
      color: rgba(255,255,255,0.6); font-size: 14px; font-weight: 600;
      cursor: pointer; transition: all 0.2s;
    }
    .tw-btn-skip:hover { background: rgba(255,255,255,0.12); color: white; }
    .tw-btn-confirm {
      flex: 2; padding: 13px; background: linear-gradient(135deg,#FFD700,#FFA500);
      border: none; border-radius: 14px; color: #1a1a1a;
      font-size: 15px; font-weight: 800; cursor: pointer;
      transition: all 0.2s; opacity: 0.4; pointer-events: none;
    }
    .tw-btn-confirm.ready { opacity: 1; pointer-events: all; }
    .tw-btn-confirm.ready:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(255,215,0,0.4); }
    .tw-modal-loading { text-align: center; padding: 40px; opacity: 0.6; }
    .tw-loading-spinner { width: 28px; height: 28px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #FFD700; border-radius: 50%; animation: tw-spin 0.8s linear infinite; margin: 0 auto 12px; }
    @keyframes tw-spin { to { transform: rotate(360deg); } }

    /* Catcher name tiers in modal list */
    .tw-trainer-item .cn-god, .tw-trainer-item .cn-king {
      background-image: linear-gradient(90deg,#ffd700,#fff,#ffd700);
      background-size:200% auto; background-clip:text;
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      animation: tw-shine 3s linear infinite;
    }
    .tw-trainer-item .cn-flame {
      background-image: linear-gradient(90deg,#ff4444,#fff,#ff4444);
      background-size:200% auto; background-clip:text;
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      animation: tw-shine 3s linear infinite;
    }
    .tw-trainer-item .cn-diamond {
      background-image: linear-gradient(90deg,#00bfff,#fff,#00bfff);
      background-size:200% auto; background-clip:text;
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      animation: tw-shine 3s linear infinite;
    }
    .tw-trainer-item .cn-shine {
      background-image: linear-gradient(90deg,#32cd32,#fff,#32cd32);
      background-size:200% auto; background-clip:text;
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      animation: tw-shine 3s linear infinite;
    }
  `;
  document.head.appendChild(style);
}

// ── MODAL ─────────────────────────────────────────────────────────────────────

let twAllTrainers = {};
let twSelectedTrainer = null;

function buildModal() {
  if (document.getElementById('twModalOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'twModalOverlay';
  overlay.innerHTML = `
    <div id="twModal">
      <div class="tw-modal-header">
        <div class="tw-modal-icon">🎮</div>
        <div class="tw-modal-title">Choose your Trainer</div>
        <div class="tw-modal-sub">Select your name to track your progress</div>
      </div>
      <div class="tw-modal-search">
        <div class="tw-modal-search-icon">🔍</div>
        <input type="text" id="twSearch" placeholder="Search trainer...">
      </div>
      <div class="tw-modal-list" id="twList">
        <div class="tw-modal-loading">
          <div class="tw-loading-spinner"></div>
          <div>Loading trainers...</div>
        </div>
      </div>
      <div class="tw-modal-footer">
        <button class="tw-btn-skip" id="twSkip">Skip for now</button>
        <button class="tw-btn-confirm" id="twConfirm">✓ Select Trainer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('twSearch').addEventListener('input', e => {
    renderModalList(twAllTrainers, e.target.value);
  });
  document.getElementById('twSkip').addEventListener('click', hideModal);
  document.getElementById('twConfirm').addEventListener('click', () => {
    if (!twSelectedTrainer) return;
    saveTrainer(twSelectedTrainer);
    hideModal();
    // Widget neu bauen mit neuem Trainer
    loadAndBuildWidget(twSelectedTrainer);
    // Falls index.js applyTrainer kennt, aufrufen
    if (typeof window.applyTrainer === 'function') {
      window.applyTrainer(twSelectedTrainer, twAllTrainers);
    }
  });
}

function showModal() {
  buildModal();
  twSelectedTrainer = null;
  updateConfirmBtn();
  const search = document.getElementById('twSearch');
  if (search) { search.value = ''; }
  if (Object.keys(twAllTrainers).length > 0) {
    renderModalList(twAllTrainers, '');
  }
  document.getElementById('twModalOverlay').classList.add('visible');
  setTimeout(() => document.getElementById('twSearch')?.focus(), 100);
}

function hideModal() {
  const overlay = document.getElementById('twModalOverlay');
  if (overlay) overlay.classList.remove('visible');
}

function updateConfirmBtn() {
  const btn = document.getElementById('twConfirm');
  if (btn) btn.classList.toggle('ready', !!twSelectedTrainer);
}

function renderModalList(trainersData, filter = '') {
  const list = document.getElementById('twList');
  if (!list) return;
  const filterLower = filter.toLowerCase();

  const trainers = Object.entries(trainersData)
    .map(([name, info]) => {
      const team = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
      const totalPoints = calcTeamPts(team);
      return { name, totalPoints, teamSize: team.length, donation: info.donation || 0 };
    })
    .filter(t => t.teamSize > 0)
    .filter(t => !filter || t.name.toLowerCase().includes(filterLower))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  if (trainers.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:32px;opacity:0.5">
      ${filter ? 'No trainer found' : 'No trainers yet'}
    </div>`;
    return;
  }

  list.innerHTML = '';
  trainers.forEach((t, i) => {
    const item = document.createElement('div');
    item.className = 'tw-trainer-item' + (t.name === twSelectedTrainer ? ' selected' : '');
    item.dataset.name = t.name;

    const rankClass = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
    const level = calcLevel(t.totalPoints);
    const tier  = getDonationTier(t.donation);

    const rankEl = document.createElement('div');
    rankEl.className = `tw-rank ${rankClass}`;
    rankEl.textContent = i + 1;

    const infoEl = document.createElement('div');
    infoEl.className = 'tw-item-info';

    const nameRow = document.createElement('div');
    nameRow.className = 'tw-item-name';
    if (tier !== 'normal') {
      const span = document.createElement('span');
      span.className = `cn-${tier}`;
      span.textContent = capitalize(t.name);
      nameRow.appendChild(span);
    } else {
      nameRow.textContent = capitalize(t.name);
    }

    const meta = document.createElement('div');
    meta.className = 'tw-item-meta';
    meta.textContent = `Lvl ${level} · ${t.teamSize} Catchmon`;

    infoEl.append(nameRow, meta);

    const ptsEl = document.createElement('div');
    ptsEl.className = 'tw-item-pts';
    ptsEl.textContent = fmt(t.totalPoints);

    item.append(rankEl, infoEl, ptsEl);
    item.addEventListener('click', () => {
      document.querySelectorAll('.tw-trainer-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      twSelectedTrainer = t.name;
      updateConfirmBtn();
    });

    list.appendChild(item);
  });
}

// ── WIDGET ────────────────────────────────────────────────────────────────────

function buildWidget(trainerName, level, donation) {
  injectCSS();
  buildModal(); // Modal DOM bereit machen

  const old = document.getElementById('twWidget');
  if (old) old.remove();

  const tier = getDonationTier(donation);
  const widget = document.createElement('div');
  widget.id = 'twWidget';

  // Profil-Link
  const profileLink = document.createElement('a');
  profileLink.className = 'tw-profile';
  profileLink.href = `catcher_detail.html?name=${encodeURIComponent(trainerName)}`;

  const avatar = document.createElement('span');
  avatar.className = 'tw-avatar';
  avatar.textContent = '👤';

  const info = document.createElement('div');
  info.className = 'tw-info';

  const nameEl = document.createElement('div');
  nameEl.className = 'tw-name';
  if (tier !== 'normal') {
    const span = document.createElement('span');
    span.className = `cn-${tier}`;
    span.textContent = capitalize(trainerName);
    nameEl.appendChild(span);
  } else {
    nameEl.textContent = capitalize(trainerName);
  }

  const levelEl = document.createElement('div');
  levelEl.className = 'tw-level';
  levelEl.textContent = `Level ${level}`;

  info.append(nameEl, levelEl);
  profileLink.append(avatar, info);

  // Edit-Button → öffnet Modal direkt auf dieser Seite
  const editBtn = document.createElement('button');
  editBtn.className = 'tw-edit';
  editBtn.title = 'Change Trainer';
  editBtn.textContent = '✎';
  editBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    showModal();
  });

  widget.append(profileLink, editBtn);
  document.body.appendChild(widget);
}

// ── FIREBASE LADEN ────────────────────────────────────────────────────────────

async function loadAndBuildWidget(trainerName) {
  // Sofort minimal anzeigen
  buildWidget(trainerName, '?', 0);

  try {
    const { db } = await import('./firebase.client.js');
    const { ref, get, onValue } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');

    // Alle Trainer für Modal laden
    onValue(ref(db, 'trainers'), snap => {
      twAllTrainers = snap.val() || {};
      // Modal-Liste aktualisieren falls offen
      const overlay = document.getElementById('twModalOverlay');
      if (overlay?.classList.contains('visible')) {
        const search = document.getElementById('twSearch');
        renderModalList(twAllTrainers, search?.value || '');
      }
    });

    // Widget mit echten Daten updaten
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

async function initTrainerWidget() {
  injectCSS();
  buildModal();

  const trainerName = getSavedTrainer();
  if (trainerName) {
    await loadAndBuildWidget(trainerName);
  } else {
    // Kein Trainer → Trainers trotzdem für Modal laden
    try {
      const { db } = await import('./firebase.client.js');
      const { ref, onValue } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
      onValue(ref(db, 'trainers'), snap => {
        twAllTrainers = snap.val() || {};
      });
    } catch {}
  }
}

// Global exportieren damit index.js darauf zugreifen kann
window.twShowModal = showModal;

initTrainerWidget();