// assets/js/trainer_widget.js
// Globales Trainer-Widget + Modal für alle Seiten

const STORAGE_KEY = 'catchmon_trainer_name';

function getSavedTrainer() {
  try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
}
function saveTrainer(name) {
  try { localStorage.setItem(STORAGE_KEY, name); } catch {}
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

// ── CSS ───────────────────────────────────────────────────────────────────────
function injectCSS() {
  if (document.getElementById('tw-css')) return;
  const style = document.createElement('style');
  style.id = 'tw-css';
  style.textContent = `
    /* ── WIDGET ── */
    #twWidget {
      position: fixed; top: 14px; right: 14px; z-index: 1100;
      display: flex; align-items: stretch;
      background: rgba(8,8,24,0.85);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px; overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      backdrop-filter: blur(16px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    #twWidget:hover { border-color: rgba(255,215,0,0.3); box-shadow: 0 4px 24px rgba(255,215,0,0.1); }

    #twWidget .tw-profile {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 10px 9px 13px;
      text-decoration: none; color: white;
      transition: background 0.15s;
    }
    #twWidget .tw-profile:hover { background: rgba(255,255,255,0.05); }
    #twWidget .tw-avatar { font-size: 1.1rem; line-height: 1; opacity: 0.8; }
    #twWidget .tw-info { line-height: 1.2; }
    #twWidget .tw-name {
      font-size: 13px; font-weight: 800; white-space: nowrap;
      max-width: 120px; overflow: hidden; text-overflow: ellipsis;
    }
    #twWidget .tw-level { font-size: 10px; opacity: 0.38; font-weight: 600; letter-spacing: 0.3px; margin-top: 1px; }

    #twWidget .tw-edit {
      display: flex; align-items: center; justify-content: center;
      width: 34px; border-left: 1px solid rgba(255,255,255,0.07);
      cursor: pointer; font-size: 13px; opacity: 0.35; color: white;
      transition: all 0.15s; background: transparent;
      border-top: none; border-right: none; border-bottom: none;
    }
    #twWidget .tw-edit:hover { opacity: 0.9; background: rgba(255,215,0,0.08); }

    /* Name tiers */
    #twWidget .cn-god, #twWidget .cn-king {
      background-image: linear-gradient(90deg,#ffd700,#fff8,#ffd700);
      background-size:200% auto; background-clip:text;
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      animation: tw-shine 3s linear infinite;
    }
    #twWidget .cn-flame {
      background-image: linear-gradient(90deg,#ff4444,#fff8,#ff4444);
      background-size:200% auto; background-clip:text;
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      animation: tw-shine 3s linear infinite;
    }
    #twWidget .cn-diamond {
      background-image: linear-gradient(90deg,#00bfff,#fff8,#00bfff);
      background-size:200% auto; background-clip:text;
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      animation: tw-shine 3s linear infinite;
    }
    #twWidget .cn-shine {
      background-image: linear-gradient(90deg,#32cd32,#fff8,#32cd32);
      background-size:200% auto; background-clip:text;
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      animation: tw-shine 3s linear infinite;
    }
    @keyframes tw-shine { to { background-position: -200% center; } }

    /* ── MODAL OVERLAY ── */
    #twModalOverlay {
      position: fixed; inset: 0; z-index: 9000;
      background: rgba(4,2,14,0.92);
      backdrop-filter: blur(16px);
      display: flex; align-items: center; justify-content: center; padding: 20px;
      opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden;
    }
    #twModalOverlay::before {
      content: '';
      position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(78,205,196,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(78,205,196,0.03) 1px, transparent 1px);
      background-size: 56px 56px;
      pointer-events: none;
    }
    #twModalOverlay.visible { opacity: 1; pointer-events: all; }

    /* ── MODAL ── */
    #twModal {
      background: rgba(10,10,28,0.98);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 24px; padding: 28px 24px;
      width: 100%; max-width: 480px; max-height: 82vh;
      display: flex; flex-direction: column;
      box-shadow: 0 40px 100px rgba(0,0,0,0.7);
      transform: translateY(24px) scale(0.97);
      transition: transform 0.35s cubic-bezier(0.22,1,0.36,1);
      color: white; position: relative; z-index: 1;
    }
    #twModalOverlay.visible #twModal { transform: translateY(0) scale(1); }

    /* Header */
    .tw-modal-header { margin-bottom: 20px; }
    .tw-modal-eyebrow {
      font-size: 10px; font-weight: 700; letter-spacing: 3px;
      text-transform: uppercase; color: #4ECDC4; opacity: 0.65; margin-bottom: 8px;
    }
    .tw-modal-title {
      font-size: 1.9rem; font-weight: 900; letter-spacing: -1px; margin-bottom: 4px;
      background: linear-gradient(90deg,#FFD700,#4ECDC4);
      background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .tw-modal-sub { font-size: 0.85rem; opacity: 0.4; }

    /* Search */
    .tw-modal-search { position: relative; margin-bottom: 14px; flex-shrink: 0; }
    .tw-modal-search input {
      width: 100%; padding: 12px 16px 12px 42px; font-size: 14px;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px; color: white; outline: none; transition: all 0.2s;
      font-family: inherit;
    }
    .tw-modal-search input::placeholder { color: rgba(255,255,255,0.3); }
    .tw-modal-search input:focus { border-color: rgba(78,205,196,0.4); background: rgba(255,255,255,0.08); }
    .tw-modal-search-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); font-size: 1rem; opacity: 0.35; }

    /* List */
    .tw-modal-list {
      flex: 1; overflow-y: auto; display: flex; flex-direction: column;
      gap: 5px; padding-right: 2px; min-height: 0;
    }
    .tw-modal-list::-webkit-scrollbar { width: 3px; }
    .tw-modal-list::-webkit-scrollbar-track { background: transparent; }
    .tw-modal-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }

    .tw-trainer-item {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; border-radius: 12px;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
      cursor: pointer; transition: all 0.15s ease;
    }
    .tw-trainer-item:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,215,0,0.25); transform: translateX(3px); }
    .tw-trainer-item.selected { background: rgba(255,215,0,0.1); border-color: rgba(255,215,0,0.4); }

    .tw-rank {
      width: 28px; height: 28px; border-radius: 50%;
      background: rgba(255,255,255,0.07); display: flex; align-items: center;
      justify-content: center; font-size: 11px; font-weight: 800; flex-shrink: 0;
      color: rgba(255,255,255,0.5);
    }
    .tw-rank.r1 { background: linear-gradient(45deg,#ffd700,#ffed4e); color: #333; }
    .tw-rank.r2 { background: linear-gradient(45deg,#c0c0c0,#e8e8e8); color: #333; }
    .tw-rank.r3 { background: linear-gradient(45deg,#cd7f32,#daa520); color: white; }

    .tw-item-info { flex: 1; min-width: 0; }
    .tw-item-name { font-size: 0.95rem; font-weight: 800; margin-bottom: 2px; }
    .tw-item-meta { font-size: 11px; opacity: 0.4; }
    .tw-item-pts  { font-size: 0.9rem; font-weight: 800; color: #FFD700; flex-shrink: 0; }

    /* Footer */
    .tw-modal-footer { margin-top: 16px; flex-shrink: 0; display: flex; gap: 8px; }
    .tw-btn-skip {
      flex: 1; padding: 12px; background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
      color: rgba(255,255,255,0.5); font-size: 13px; font-weight: 700;
      cursor: pointer; transition: all 0.2s; font-family: inherit;
    }
    .tw-btn-skip:hover { background: rgba(255,255,255,0.1); color: white; }
    .tw-btn-confirm {
      flex: 2; padding: 12px;
      background: linear-gradient(135deg,#FFD700,#FFA500);
      border: none; border-radius: 12px; color: #1a1a1a;
      font-size: 14px; font-weight: 900; cursor: pointer;
      transition: all 0.2s; opacity: 0.35; pointer-events: none;
      font-family: inherit;
    }
    .tw-btn-confirm.ready { opacity: 1; pointer-events: all; }
    .tw-btn-confirm.ready:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(255,215,0,0.35); }

    /* Loading */
    .tw-modal-loading { text-align: center; padding: 36px; opacity: 0.4; font-size: 13px; }
    .tw-loading-spinner {
      width: 22px; height: 22px; border: 2px solid rgba(255,255,255,0.15);
      border-top-color: #FFD700; border-radius: 50%;
      animation: tw-spin 0.8s linear infinite; margin: 0 auto 10px;
    }
    @keyframes tw-spin { to { transform: rotate(360deg); } }

    /* Name tiers in modal */
    .tw-trainer-item .cn-god, .tw-trainer-item .cn-king {
      background-image: linear-gradient(90deg,#ffd700,#fff8,#ffd700);
      background-size:200% auto; background-clip:text;
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      animation: tw-shine 3s linear infinite;
    }
    .tw-trainer-item .cn-flame {
      background-image: linear-gradient(90deg,#ff4444,#fff8,#ff4444);
      background-size:200% auto; background-clip:text;
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      animation: tw-shine 3s linear infinite;
    }
    .tw-trainer-item .cn-diamond {
      background-image: linear-gradient(90deg,#00bfff,#fff8,#00bfff);
      background-size:200% auto; background-clip:text;
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      animation: tw-shine 3s linear infinite;
    }
    .tw-trainer-item .cn-shine {
      background-image: linear-gradient(90deg,#32cd32,#fff8,#32cd32);
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
        <div class="tw-modal-eyebrow">Catchmon Arena · Profile</div>
        <div class="tw-modal-title">Choose your Trainer</div>
        <div class="tw-modal-sub">Select your name to track progress across all pages</div>
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
  document.getElementById('twSkip').addEventListener('click', () => {
    hideModal();
    if (!getSavedTrainer()) buildGuestWidget();
  });
  document.getElementById('twConfirm').addEventListener('click', () => {
    if (!twSelectedTrainer) return;
    saveTrainer(twSelectedTrainer);
    hideModal();
    loadAndBuildWidget(twSelectedTrainer);
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
  if (search) search.value = '';
  if (Object.keys(twAllTrainers).length > 0) renderModalList(twAllTrainers, '');
  document.getElementById('twModalOverlay').classList.add('visible');
  setTimeout(() => document.getElementById('twSearch')?.focus(), 100);
}
function hideModal() {
  const o = document.getElementById('twModalOverlay');
  if (o) o.classList.remove('visible');
}
function updateConfirmBtn() {
  const btn = document.getElementById('twConfirm');
  if (btn) btn.classList.toggle('ready', !!twSelectedTrainer);
}

function renderModalList(trainersData, filter = '') {
  const list = document.getElementById('twList');
  if (!list) return;
  const fl = filter.toLowerCase();

  const trainers = Object.entries(trainersData)
    .map(([name, info]) => {
      const team = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
      return { name, totalPoints: calcTeamPts(team), teamSize: team.length, donation: info.donation || 0 };
    })
    .filter(t => t.teamSize > 0)
    .filter(t => !filter || t.name.toLowerCase().includes(fl))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  if (trainers.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:32px;opacity:0.35;font-size:13px">${filter ? 'No trainer found' : 'No trainers yet'}</div>`;
    return;
  }

  list.innerHTML = '';
  trainers.forEach((t, i) => {
    const item = document.createElement('div');
    item.className = 'tw-trainer-item' + (t.name === twSelectedTrainer ? ' selected' : '');
    item.dataset.name = t.name;

    const rankClass = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
    const tier       = getDonationTier(t.donation);

    const rankEl = document.createElement('div');
    rankEl.className = `tw-rank ${rankClass}`;
    rankEl.textContent = i + 1;

    const infoEl  = document.createElement('div'); infoEl.className = 'tw-item-info';
    const nameRow = document.createElement('div'); nameRow.className = 'tw-item-name';
    if (tier !== 'normal') {
      const span = document.createElement('span');
      span.className = `cn-${tier}`; span.textContent = capitalize(t.name);
      nameRow.appendChild(span);
    } else { nameRow.textContent = capitalize(t.name); }

    const meta = document.createElement('div'); meta.className = 'tw-item-meta';
    meta.textContent = `Lvl ${calcLevel(t.totalPoints)} · ${t.teamSize} Catchmon`;
    infoEl.append(nameRow, meta);

    const ptsEl = document.createElement('div'); ptsEl.className = 'tw-item-pts';
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
  buildModal();
  const old = document.getElementById('twWidget');
  if (old) old.remove();

  const tier   = getDonationTier(donation);
  const widget = document.createElement('div');
  widget.id = 'twWidget';

  const profileLink = document.createElement('a');
  profileLink.className = 'tw-profile';
  profileLink.href = `catcher_detail.html?name=${encodeURIComponent(trainerName)}`;

  const avatar  = document.createElement('span'); avatar.className = 'tw-avatar'; avatar.textContent = '👤';
  const info    = document.createElement('div');  info.className   = 'tw-info';
  const nameEl  = document.createElement('div');  nameEl.className = 'tw-name';
  if (tier !== 'normal') {
    const span = document.createElement('span'); span.className = `cn-${tier}`; span.textContent = capitalize(trainerName);
    nameEl.appendChild(span);
  } else { nameEl.textContent = capitalize(trainerName); }
  const levelEl = document.createElement('div'); levelEl.className = 'tw-level'; levelEl.textContent = `Level ${level}`;
  info.append(nameEl, levelEl);
  profileLink.append(avatar, info);

  const editBtn = document.createElement('button');
  editBtn.className = 'tw-edit'; editBtn.title = 'Change Trainer'; editBtn.textContent = '✎';
  editBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showModal(); });

  widget.append(profileLink, editBtn);
  document.body.appendChild(widget);
}

function buildGuestWidget() {
  injectCSS();
  buildModal();
  const old = document.getElementById('twWidget');
  if (old) old.remove();

  const widget = document.createElement('div');
  widget.id = 'twWidget'; widget.style.cursor = 'pointer';

  const btn = document.createElement('div');
  btn.className = 'tw-profile';
  btn.style.cssText = 'display:flex;align-items:center;gap:9px;padding:9px 13px;cursor:pointer;';

  const avatar  = document.createElement('span'); avatar.className = 'tw-avatar'; avatar.textContent = '👤';
  const info    = document.createElement('div');  info.className   = 'tw-info';
  const nameEl  = document.createElement('div');  nameEl.className = 'tw-name'; nameEl.style.cssText = '-webkit-text-fill-color:rgba(255,255,255,0.35);'; nameEl.textContent = 'Choose Trainer';
  const levelEl = document.createElement('div');  levelEl.className = 'tw-level'; levelEl.textContent = 'Click to set up';
  info.append(nameEl, levelEl);
  btn.append(avatar, info);

  widget.appendChild(btn);
  widget.addEventListener('click', () => showModal());
  document.body.appendChild(widget);
}

// ── FIREBASE ──────────────────────────────────────────────────────────────────
async function loadAndBuildWidget(trainerName) {
  buildWidget(trainerName, '?', 0);
  try {
    const { db } = await import('./firebase.client.js');
    const { ref, get, onValue } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');

    onValue(ref(db, 'trainers'), snap => {
      twAllTrainers = snap.val() || {};
      const overlay = document.getElementById('twModalOverlay');
      if (overlay?.classList.contains('visible')) {
        renderModalList(twAllTrainers, document.getElementById('twSearch')?.value || '');
      }
    });

    const snap = await get(ref(db, `trainers/${trainerName.toLowerCase()}`));
    const info = snap.val();
    if (info) {
      const team = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
      buildWidget(trainerName, calcLevel(calcTeamPts(team)), info.donation || 0);
    }
  } catch (e) { console.warn('trainer_widget: Firebase load failed', e); }
}

async function initTrainerWidget() {
  injectCSS();
  buildModal();
  const trainerName = getSavedTrainer();
  if (trainerName) {
    await loadAndBuildWidget(trainerName);
  } else {
    buildGuestWidget();
    let modalOpened = false;
    try {
      const { db } = await import('./firebase.client.js');
      const { ref, onValue } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
      onValue(ref(db, 'trainers'), snap => {
        twAllTrainers = snap.val() || {};
        if (!modalOpened && Object.keys(twAllTrainers).length > 0) {
          modalOpened = true;
          renderModalList(twAllTrainers, '');
          showModal();
        }
      });
    } catch {}
  }
}

window.twShowModal = showModal;
initTrainerWidget();