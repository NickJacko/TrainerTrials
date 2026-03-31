// assets/js/pages/index.js
import { db } from '../firebase.client.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}

function getDonationTier(d) {
  if (d >= 2500) return 'god';
  if (d >= 500)  return 'king';
  if (d >= 250)  return 'diamond';
  if (d >= 100)  return 'flame';
  if (d >= 50)   return 'shine';
  return 'normal';
}

function buildNameEl(name, donation) {
  const span = document.createElement('span');
  span.className = `catcher-name ${getDonationTier(donation)}`;
  span.textContent = name;
  return span;
}

function fmt(num) {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000)     return (num / 1_000).toFixed(1) + 'K';
  return String(num);
}

function calcPts(c) {
  if (!c) return 0;
  const stats = c.stats || {};
  let p = (c.level || 1) * 10 + Object.values(stats).reduce((a,b) => a + (b||0), 0);
  p *= { Common:1, Uncommon:1.2, Rare:1.5, Epic:2, Legendary:3, Mythical:4 }[c.rarity || 'Common'] || 1;
  if (c.shiny) p *= 1.5;
  return Math.floor(p);
}

function calcTeamPts(team) {
  if (!team) return 0;
  return (Array.isArray(team) ? team : Object.values(team)).reduce((s,c) => s + calcPts(c), 0);
}

function calcLevel(totalPoints) {
  return Math.floor(Math.pow(totalPoints / 500, 0.6));
}

function rarityClass(rarity) {
  return 'r-' + (rarity || 'common').toLowerCase();
}

function capitalize(s) {
  return String(s ?? "").charAt(0).toUpperCase() + String(s ?? "").slice(1);
}

// ── Trainer Picker Modal ──────────────────────────────────────────────────────

const STORAGE_KEY = 'catchmon_trainer_name';
let allTrainersData = {};
let selectedTrainer = null;

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

function showModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.add('visible');
  selectedTrainer = null;
  updateConfirmBtn();
  document.getElementById('modalSearch').value = '';
  document.getElementById('modalSearch').focus();
}

function hideModal() {
  document.getElementById('modalOverlay').classList.remove('visible');
}

function updateConfirmBtn() {
  const btn = document.getElementById('modalConfirm');
  btn.classList.toggle('ready', !!selectedTrainer);
}

function renderModalList(trainersData, filter = '') {
  const list = document.getElementById('modalList');
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
      ${filter ? 'No trainer found for "' + escapeHtml(filter) + '"' : 'No trainers yet'}
    </div>`;
    return;
  }

  list.innerHTML = '';
  trainers.forEach((t, i) => {
    const item = document.createElement('div');
    item.className = 'trainer-item' + (t.name === selectedTrainer ? ' selected' : '');
    item.dataset.name = t.name;

    const rankClass = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
    const level = calcLevel(t.totalPoints);

    item.innerHTML = `
      <div class="trainer-rank ${rankClass}">${i + 1}</div>
      <div class="trainer-info">
        <div class="trainer-name-row"></div>
        <div class="trainer-meta">Lvl ${level} · ${t.teamSize} Catchmon</div>
      </div>
      <div class="trainer-pts">${fmt(t.totalPoints)}</div>
    `;

    // Name mit Donation-Tier
    const nameRow = item.querySelector('.trainer-name-row');
    nameRow.appendChild(buildNameEl(capitalize(t.name), t.donation));

    item.addEventListener('click', () => {
      document.querySelectorAll('.trainer-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      selectedTrainer = t.name;
      updateConfirmBtn();
    });

    list.appendChild(item);
  });
}

function initModal(trainersData) {
  allTrainersData = trainersData;

  // Search
  document.getElementById('modalSearch').addEventListener('input', e => {
    renderModalList(allTrainersData, e.target.value);
  });

  // Skip
  document.getElementById('modalSkip').addEventListener('click', () => {
    hideModal();
  });

  // Confirm
  document.getElementById('modalConfirm').addEventListener('click', () => {
    if (!selectedTrainer) return;
    saveTrainer(selectedTrainer);
    hideModal();
    applyTrainer(selectedTrainer, allTrainersData);
  });

  renderModalList(trainersData);
}

function applyTrainer(name, trainersData) {
  if (!name) return;

  const info  = trainersData[name] || trainersData[name.toLowerCase()];
  const team  = info ? (Array.isArray(info.team) ? info.team : Object.values(info.team || {})) : [];
  const pts   = calcTeamPts(team);
  const level = calcLevel(pts);
  const donation = info?.donation || 0;

  // Widget top-left
  const widget = document.getElementById('trainerWidget');
  widget.classList.remove('hidden');
  widget.href = `catcher_detail.html?name=${encodeURIComponent(name)}`;

  const nameEl = document.getElementById('trainerWidgetName');
  nameEl.textContent = '';
  nameEl.appendChild(buildNameEl(capitalize(name), donation));

  document.getElementById('trainerWidgetLevel').textContent =
    `Level ${level} · ${fmt(pts)} pts`;

  // Change trainer on widget click — prevent navigation, open modal instead
  widget.addEventListener('click', e => {
    e.preventDefault();
    showModal();
  });

  // My Profile Button in Hero
  const profileBtn = document.getElementById('myProfileBtn');
  profileBtn.classList.add('visible');
  profileBtn.textContent = `👤 My Profile`;
  profileBtn.href = `catcher_detail.html?name=${encodeURIComponent(name)}`;
  profileBtn.addEventListener('click', e => {
    e.stopPropagation();
    window.location.href = profileBtn.href;
  });
}

// ── Connection ────────────────────────────────────────────────────────────────

onValue(ref(db, '.info/connected'), snap => {
  const el   = document.getElementById('connectionStatus');
  const live = document.getElementById('liveStatusText');
  if (snap.val()) {
    el.textContent = '🔥 Live';
    el.className = 'connection-status connected';
    live.textContent = 'LIVE — Like to catch!';
  } else {
    el.textContent = '🔴 Offline';
    el.className = 'connection-status';
    live.textContent = 'Reconnecting...';
  }
});

// ── Global Stats ──────────────────────────────────────────────────────────────

onValue(ref(db, 'global'), snap => {
  const d       = snap.val() || {};
  const spawns  = d.total_spawns    || 0;
  const catches = d.total_catches   || 0;
  const likes   = d.total_likes_ever || 0;

  document.getElementById('totalSpawns').textContent    = fmt(spawns);
  document.getElementById('totalLikesEver').textContent = fmt(likes);

  const rate = spawns > 0 ? ((catches / spawns) * 100).toFixed(1) + '%' : '0%';
  document.getElementById('catchRate').textContent    = rate;
  document.getElementById('catchRateSub').textContent = `${fmt(catches)} caught / ${fmt(spawns)} spawns`;
});

// ── Live Spawn Widget ─────────────────────────────────────────────────────────

let spawnTimer = null;

onValue(ref(db, 'spawn/current'), snap => {
  const data    = snap.val();
  const widget  = document.getElementById('spawnWidget');
  const imgWrap = document.getElementById('spawnImgWrap');
  const nameEl  = document.getElementById('spawnName');
  const metaEl  = document.getElementById('spawnMeta');
  const timerEl = document.getElementById('spawnTimer');

  if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; }

  if (!data || !data.name) {
    nameEl.textContent  = 'Waiting for spawn...';
    metaEl.textContent  = '—';
    timerEl.textContent = '—';
    imgWrap.innerHTML   = '<span style="font-size:2rem;">🥚</span>';
    widget.classList.remove('active');
    return;
  }

  widget.classList.add('active');

  imgWrap.innerHTML = '';
  if (data.sprite) {
    const img = document.createElement('img');
    img.src = data.sprite;
    img.alt = escapeHtml(data.name);
    img.onerror = () => { imgWrap.innerHTML = '<span style="font-size:2rem;">❓</span>'; };
    imgWrap.appendChild(img);
  } else {
    imgWrap.innerHTML = '<span style="font-size:2rem;">❓</span>';
  }

  nameEl.innerHTML = '';
  nameEl.appendChild(document.createTextNode(data.name + (data.shiny ? ' ✨' : '') + ' '));
  const rb = document.createElement('span');
  rb.className = `rarity-badge ${rarityClass(data.rarity)}`;
  rb.textContent = data.rarity || 'Common';
  nameEl.appendChild(rb);

  metaEl.textContent = `Level ${data.level || '?'}`;

  const interval   = data.spawn_interval || data.SPAWN_INTERVAL || 15;
  const spawnStart = data.spawn_start || Math.floor(Date.now() / 1000);

  function tick() {
    const remaining = Math.max(0, interval - (Math.floor(Date.now() / 1000) - spawnStart));
    timerEl.textContent =
      String(Math.floor(remaining / 60)).padStart(2, '0') + ':' +
      String(remaining % 60).padStart(2, '0');
  }
  tick();
  spawnTimer = setInterval(tick, 500);
});

// ── Trainers ──────────────────────────────────────────────────────────────────

let trainersLoaded = false;

onValue(ref(db, 'trainers'), snap => {
  const data = snap.val() || {};
  allTrainersData = data;

  const active = Object.values(data).filter(t => {
    const team = Array.isArray(t.team) ? t.team : Object.values(t.team || {});
    return team.length > 0;
  }).length;
  document.getElementById('totalCatchers').textContent = fmt(active);

  renderTopCatchers(data);
  renderTopCatchmon(data);

  // Modal initialisieren (nur einmal)
  if (!trainersLoaded) {
    trainersLoaded = true;
    initModal(data);

    const saved = getSavedTrainer();
    if (saved && data[saved]) {
      // Bekannter Trainer → direkt Widget zeigen, kein Modal
      applyTrainer(saved, data);
    } else {
      // Erster Besuch oder unbekannter Name → Modal zeigen
      clearTrainer();
      showModal();
    }
  } else {
    // Bei Live-Updates Widget aktualisieren falls Trainer bekannt
    const saved = getSavedTrainer();
    if (saved) applyTrainer(saved, data);
    // Modal-Liste aktualisieren falls offen
    const overlay = document.getElementById('modalOverlay');
    if (overlay.classList.contains('visible')) {
      const searchVal = document.getElementById('modalSearch').value;
      renderModalList(data, searchVal);
    }
  }
});

// ── Top Catchers ──────────────────────────────────────────────────────────────

function renderTopCatchers(data) {
  const container = document.getElementById('catcherRow');
  const list = Object.entries(data).map(([name, info]) => {
    const team = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
    return { name, teamSize: team.length, totalPoints: calcTeamPts(team),
             donation: info.donation || 0, catches: info.stats?.total_catches || 0 };
  }).filter(t => t.teamSize > 0).sort((a,b) => b.totalPoints - a.totalPoints).slice(0, 3);

  if (list.length === 0) {
    container.innerHTML = '<div class="loading"><div>No trainers yet</div></div>';
    return;
  }

  container.innerHTML = '';
  list.forEach((t, i) => {
    const medal = ['medal-1','medal-2','medal-3'][i] || '';
    const card  = document.createElement('div');
    card.className = `card ${medal}`;

    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = i + 1;

    const content = document.createElement('div');
    const title   = document.createElement('div'); title.className = 'card-title';
    title.appendChild(buildNameEl(capitalize(t.name), t.donation));
    const s1  = document.createElement('div'); s1.className = 'card-stat';  s1.textContent = `🐲 ${t.teamSize} Catchmon`;
    const s2  = document.createElement('div'); s2.className = 'card-stat';  s2.textContent = `✅ ${fmt(t.catches)} Catches`;
    const pts = document.createElement('div'); pts.className = 'pts';        pts.textContent = `${fmt(t.totalPoints)} pts`;

    content.append(title, s1, s2, pts);
    card.append(badge, content);
    card.addEventListener('click', () => {
      window.location.href = `catcher_detail.html?name=${encodeURIComponent(t.name)}`;
    });
    container.appendChild(card);
  });
}

// ── Top Catchmon ──────────────────────────────────────────────────────────────

function renderTopCatchmon(data) {
  const container = document.getElementById('catchmonRow');
  const all = [];

  for (const [trainer, info] of Object.entries(data)) {
    const team = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
    team.forEach(c => {
      if (c?.name) all.push({ ...c, caughtBy: trainer, trainerDonation: info.donation || 0 });
    });
  }

  if (all.length === 0) {
    container.innerHTML = '<div class="loading"><div>No Catchmon caught yet</div></div>';
    return;
  }

  const top3 = all.sort((a,b) => calcPts(b) - calcPts(a)).slice(0, 3);
  container.innerHTML = '';

  top3.forEach((c, i) => {
    const medal = ['medal-1','medal-2','medal-3'][i] || '';
    const card  = document.createElement('div');
    card.className = `card ${medal}`;

    const badge = document.createElement('div'); badge.className = 'badge'; badge.textContent = i + 1;
    const content = document.createElement('div');

    const img = document.createElement('img');
    img.src = c.sprite || '';
    img.alt = escapeHtml(c.name);
    img.style.cssText = 'width:72px;height:72px;object-fit:contain;margin-bottom:10px;filter:drop-shadow(0 0 8px rgba(255,255,255,0.2));';
    img.onerror = () => { img.style.display = 'none'; };

    const title = document.createElement('div'); title.className = 'card-title';
    title.textContent = c.name + (c.shiny ? ' ✨' : '');
    const rb = document.createElement('span');
    rb.className = `rarity-badge ${rarityClass(c.rarity)}`;
    rb.textContent = c.rarity || 'Common';
    title.appendChild(document.createTextNode(' '));
    title.appendChild(rb);

    const lvl        = document.createElement('div'); lvl.className = 'card-stat'; lvl.textContent = `Level ${c.level || 1}`;
    const catcherDiv = document.createElement('div'); catcherDiv.className = 'card-stat';
    catcherDiv.appendChild(document.createTextNode('by '));
    catcherDiv.appendChild(buildNameEl(capitalize(c.caughtBy), c.trainerDonation));
    const pts = document.createElement('div'); pts.className = 'pts'; pts.textContent = `${fmt(calcPts(c))} pts`;

    content.append(img, title, lvl, catcherDiv, pts);
    card.append(badge, content);
    card.addEventListener('click', () => {
      window.location.href = `catcher_detail.html?name=${encodeURIComponent(c.caughtBy)}`;
    });
    container.appendChild(card);
  });
}

console.log('🎮 Catchmon Arena Hub loaded — Trainer Picker active');