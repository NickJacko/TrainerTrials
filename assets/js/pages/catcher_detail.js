// assets/js/pages/catcher_detail.js
import { db } from '../firebase.client.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { runCatchup } from '../catchup.js';

// ── Reveal ────────────────────────────────────────────────────────────────────
const revealObs = new IntersectionObserver(entries => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('in'), i * 80);
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.06 });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeHtml(input) {
  const s = String(input ?? "");
  return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
function validateTrainerName(name) {
  if (!name) return null;
  const cleaned = name.trim().slice(0, 60);
  if (!/^[\w\s\-]+$/.test(cleaned)) return null;
  return cleaned;
}
function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function getDonationTier(donation) {
  if (donation >= 2500) return "king";
  if (donation >= 500)  return "flame";
  if (donation >= 250)  return "diamond";
  if (donation >= 100)  return "shine-t";
  return "normal";
}

function calcPoints(catchmon) {
  if (!catchmon) return 0;
  const level = catchmon.level || 1;
  const stats = catchmon.stats || {};
  const statSum = Object.values(stats).reduce((sum, val) => sum + (val || 0), 0);
  let points = level * 10 + statSum;
  const rarityMultipliers = { "Common":1, "Uncommon":1.2, "Rare":1.5, "Epic":2, "Legendary":3, "Mythical":5 };
  points *= rarityMultipliers[catchmon.rarity] || 1;
  if (catchmon.shiny) points *= 2;
  return Math.round(points);
}

function getPlayerLevel(totalPoints) { return Math.max(1, Math.floor(Math.pow(totalPoints / 500, 0.6))); }
function getXpForLevel(level) { return Math.pow(level, 1.666) * 500; }

function getLevelColor(level) {
  if (level >= 50) return "level-rainbow";
  if (level >= 40) return "level-deepred";
  if (level >= 35) return "level-red";
  if (level >= 30) return "level-orange";
  if (level >= 25) return "level-yellow";
  if (level >= 20) return "level-blue";
  if (level >= 15) return "level-cyan";
  if (level >= 10) return "level-green";
  if (level >= 5)  return "level-lightgreen";
  return "level-gray";
}

function animateNumber(elementId, targetNumber) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const duration = 1500;
  const startTime = Date.now();
  function update() {
    const progress = Math.min((Date.now() - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(targetNumber * eased);
    element.textContent = elementId === 'statPoints'
      ? current.toLocaleString('en-US')
      : current;
    if (progress < 1) requestAnimationFrame(update);
  }
  update();
}

// ── URL Param ─────────────────────────────────────────────────────────────────
const rawName     = new URLSearchParams(window.location.search).get("name");
const trainerName = validateTrainerName(rawName);

if (!trainerName) {
  document.getElementById("teamTable").innerHTML =
    '<tr><td colspan="5" class="error-message">Invalid or missing trainer name.</td></tr>';
}

// ── ACHIEVEMENTS ──────────────────────────────────────────────────────────────
// Definition: { id, icon, secretIcon, name, desc, color, check(team, dexList) }
const ACHIEVEMENTS = [
  {
    id: 'first_catch',
    icon: '🥚', name: 'First Catch',
    desc: 'Catch your very first Catchmon',
    color: 'ach-teal',
    check: (team) => team.length >= 1,
  },
  {
    id: 'collector',
    icon: '🌱', name: 'Collector',
    desc: 'Catch every Common Catchmon at least once',
    color: 'ach-teal',
    check: (team, dexList) => {
      if (!dexList?.length) return false;
      // sprite path: "catchmon/Common/Name.png"
      const commons = dexList.filter(p => p.sprite?.includes('Common/')).map(p => p.name.toLowerCase());
      if (!commons.length) return false;
      const caughtNames = new Set(team.map(p => p.name.toLowerCase()));
      return commons.every(n => caughtNames.has(n));
    },
  },
  {
    id: 'starter_club',
    icon: '💧', name: 'Starter Club',
    desc: 'Catch every Starter Catchmon at least once',
    color: 'ach-teal',
    check: (team, dexList) => {
      if (!dexList?.length) return false;
      const starters = dexList.filter(p => p.sprite?.includes('Starter/')).map(p => p.name.toLowerCase());
      if (!starters.length) return false;
      const caughtNames = new Set(team.map(p => p.name.toLowerCase()));
      return starters.every(n => caughtNames.has(n));
    },
  },
  {
    id: 'rare_hunter',
    icon: '🔵', name: 'Rare Hunter',
    desc: 'Catch every Rare Catchmon at least once',
    color: 'ach-teal',
    check: (team, dexList) => {
      if (!dexList?.length) return false;
      const rares = dexList.filter(p => p.sprite?.includes('Rare/')).map(p => p.name.toLowerCase());
      if (!rares.length) return false;
      const caughtNames = new Set(team.map(p => p.name.toLowerCase()));
      return rares.every(n => caughtNames.has(n));
    },
  },
  {
    id: 'legendary',
    icon: '🏆', name: 'Legend Slayer',
    desc: 'Catch a Legendary Catchmon',
    color: 'ach-gold',
    check: (team) => team.some(p => p.rarity === 'Legendary'),
  },
  {
    id: 'mythical',
    icon: '🟣', name: 'Myth Touched',
    desc: 'Catch a Mythical Catchmon',
    color: 'ach-purple',
    check: (team) => team.some(p => p.rarity === 'Mythical'),
  },
  {
    id: 'shiny',
    icon: '⭐', name: 'Shiny Lucky',
    desc: 'Catch a shiny Catchmon',
    color: 'ach-gold',
    check: (team) => team.some(p => p.shiny),
  },
  {
    id: 'dex_master',
    icon: '📘', name: 'Dex Master',
    desc: 'Catch every single Catchmon (excl. God)',
    color: 'ach-gold',
    check: (team, dexList) => {
      if (!dexList?.length) return false;
      // Exclude God rarity — they are the final secret
      const required = dexList
        .filter(p => !p.sprite?.includes('God/'))
        .map(p => p.name.toLowerCase());
      if (!required.length) return false;
      const caughtNames = new Set(team.map(p => p.name.toLowerCase()));
      return required.every(n => caughtNames.has(n));
    },
  },
  {
    id: 'supporter',
    icon: '💎', name: 'Supporter',
    desc: 'Send a Gift during the live stream',
    color: 'ach-teal',
    check: (team, dexList, donation) => (donation || 0) >= 50,
  },
  {
    id: 'god',
    icon: '❓',
    unlockedIcon: '⚫',
    name: '???',
    unlockedName: 'The One',
    desc: 'Catch a God-tier Catchmon',
    color: 'ach-secret',
    check: (team) => team.some(p => p.rarity === 'God'),
  },
];

let dexListGlobal = [];

function renderAchievements(team, donation) {
  const grid = document.getElementById('achGrid');
  if (!grid) return;

  grid.innerHTML = '';
  let unlockedCount = 0;

  ACHIEVEMENTS.forEach(ach => {
    const unlocked = ach.check(team, dexListGlobal, donation);
    if (unlocked) unlockedCount++;

    const isSecret = ach.id === 'god';
    const showSecret = isSecret && !unlocked;

    const badge = document.createElement('div');
    badge.className = `ach-badge ${unlocked ? 'unlocked ' + ach.color : 'locked'}`;
    badge.title = unlocked
      ? `${ach.unlockedName || ach.name}: ${ach.desc}`
      : showSecret
        ? '??? — Secret Achievement'
        : `${ach.name}: ${ach.desc}`;

    const iconEl = document.createElement('div');
    iconEl.className = 'ach-icon';
    iconEl.textContent = unlocked
      ? (ach.unlockedIcon || ach.icon)
      : showSecret ? '❓' : ach.icon;

    const nameEl = document.createElement('div');
    nameEl.className = 'ach-name';
    nameEl.textContent = unlocked
      ? (ach.unlockedName || ach.name)
      : showSecret ? '???' : ach.name;

    badge.append(iconEl, nameEl);
    grid.appendChild(badge);
  });

  const countEl = document.getElementById('achCount');
  if (countEl) countEl.textContent = `${unlockedCount} / ${ACHIEVEMENTS.length}`;
}

// ── Rarity grouping ───────────────────────────────────────────────────────────
const RARITY_ORDER  = ["God","Mythical","Legendary","Rare","Starter","Common"];
const RARITY_COLORS = {
  God:       { bg:"rgba(128,0,128,0.15)",   border:"rgba(128,0,128,0.3)",   text:"#ce93d8" },
  Mythical:  { bg:"rgba(156,39,176,0.15)",  border:"rgba(156,39,176,0.3)",  text:"#ce93d8" },
  Legendary: { bg:"rgba(255,152,0,0.1)",    border:"rgba(255,152,0,0.25)",  text:"#ffb74d" },
  Rare:      { bg:"rgba(33,150,243,0.1)",   border:"rgba(33,150,243,0.25)", text:"#64b5f6" },
  Starter:   { bg:"rgba(76,175,80,0.1)",    border:"rgba(76,175,80,0.25)",  text:"#81c784" },
  Common:    { bg:"rgba(255,255,255,0.03)", border:"rgba(255,255,255,0.08)",text:"#9e9e9e" },
};
const RARITY_EMOJIS = { God:"⚫", Mythical:"🟣", Legendary:"🟡", Rare:"🔵", Starter:"🌱", Common:"⚪" };

function renderTeamGrouped(team) {
  const tbody = document.getElementById("teamTable");
  const countEl = document.getElementById("teamCount");
  if (countEl) countEl.textContent = team.length > 0 ? `${team.length} Catchmon` : '';

  if (!team || team.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:48px 20px;">
          <div style="font-size:2.5rem;margin-bottom:12px;">🎯</div>
          <div style="font-size:1rem;font-weight:800;color:rgba(255,255,255,0.7);margin-bottom:6px;">No Catchmon yet</div>
          <div style="font-size:0.85rem;color:rgba(255,255,255,0.3);line-height:1.5;">
            This trainer hasn't caught anything yet.<br>Join the next live stream to start catching!
          </div>
        </td>
      </tr>`;
    return;
  }

  const groups = {};
  RARITY_ORDER.forEach(r => groups[r] = []);
  team.forEach(p => { const r = p.rarity || "Common"; (groups[r] || groups["Common"]).push(p); });
  Object.values(groups).forEach(g => g.sort((a, b) => calcPoints(b) - calcPoints(a)));

  const fragment = document.createDocumentFragment();

  RARITY_ORDER.forEach(rarity => {
    const group = groups[rarity];
    if (!group?.length) return;
    const colors = RARITY_COLORS[rarity] || RARITY_COLORS.Common;

    const headerRow = document.createElement('tr');
    headerRow.className = 'rarity-group-header';
    headerRow.style.cssText = `background:${colors.bg};border-top:1px solid ${colors.border};`;
    const headerTd = document.createElement('td');
    headerTd.colSpan = 5;
    headerTd.style.cssText = `color:${colors.text};font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;`;
    headerTd.textContent = `${RARITY_EMOJIS[rarity] || ''} ${rarity}  ·  ${group.length}`;
    headerRow.appendChild(headerTd);
    fragment.appendChild(headerRow);

    group.forEach(p => {
      const row = document.createElement("tr");
      row.addEventListener('click', () => {
        window.location.href = `dex_detail.html?name=${encodeURIComponent(p.name)}`;
      });

      const sumStats = Object.values(p.stats || {}).reduce((a, b) => a + (b || 0), 0);
      const points   = calcPoints(p);

      const tdSprite = document.createElement('td');
      const img = document.createElement('img');
      img.className = 'catchmon-image';
      img.src = p.sprite || ''; img.alt = escapeHtml(p.name); img.loading = 'lazy';
      img.onerror = function() { this.style.display = 'none'; };
      tdSprite.appendChild(img);

      const tdName = document.createElement('td');
      tdName.className = 'catchmon-name';
      tdName.textContent = p.name + (p.shiny ? ' ✨' : '');

      const tdLevel = document.createElement('td');
      tdLevel.className = 'level-cell';
      tdLevel.textContent = p.level;

      const tdStats = document.createElement('td');
      tdStats.className = 'stats-cell';
      tdStats.textContent = sumStats.toLocaleString('en-US');

      const tdPoints = document.createElement('td');
      tdPoints.className = 'points-cell';
      tdPoints.textContent = points.toLocaleString('en-US');

      row.append(tdSprite, tdName, tdLevel, tdStats, tdPoints);
      fragment.appendChild(row);
    });
  });

  tbody.innerHTML = '';
  tbody.appendChild(fragment);
}

// ── Dex completion ────────────────────────────────────────────────────────────
async function updateDexCompletion(team) {
  try {
    const res     = await fetch("dex_list.json?" + Date.now());
    const dexList = await res.json();
    dexListGlobal = dexList;  // save for achievements
    const caught  = new Set(team.map(p => p.name.toLowerCase())).size;
    const total   = dexList.length;
    const pct     = total > 0 ? Math.round((caught / total) * 100) : 0;
    document.getElementById('dexCaughtCount').textContent = caught;
    document.getElementById('dexTotalCount').textContent  = total;
    document.getElementById('dexPct').textContent         = `${pct}%`;
    setTimeout(() => { document.getElementById('dexBar').style.width = `${pct}%`; }, 600);
  } catch {
    document.getElementById('dexTotalCount').textContent = '?';
  }
}

// ── Load ──────────────────────────────────────────────────────────────────────
function loadCatcherData(trainersData) {
  const trainer = trainerName.toLowerCase();
  const catcher = trainersData[trainer];

  if (!catcher) {
    document.getElementById("catcherTitle").textContent = capitalize(trainer);
    document.getElementById("totalPoints").textContent  = "New Trainer";
    document.getElementById("statPoints").textContent   = "0";
    document.getElementById("statTeam").textContent     = "0";
    document.getElementById("statLevel").textContent    = "1";
    const fill = document.getElementById("levelFill");
    fill.style.width = "0%"; fill.className = "xp-fill level-gray";
    document.getElementById("levelPercentText").textContent = "0%";
    document.getElementById("levelLabel").textContent       = "Level 1 – 0 / 500 XP";
    document.getElementById('dexCaughtCount').textContent   = "0";
    document.getElementById('dexPct').textContent           = "0%";
    try { document.getElementById('dexBar').style.width = "0%"; } catch {}
    document.getElementById("catchdexLink").href =
      `catchdex_catcher.html?name=${encodeURIComponent(trainerName)}`;
    renderTeamGrouped([]);
    renderAchievements([], 0);
    return;
  }

  // ── Trainer found ─────────────────────────────────────────────────────────
  const tier = getDonationTier(catcher.donation || 0);
  const titleEl = document.getElementById("catcherTitle");
  titleEl.textContent = '';
  if (tier !== "normal") {
    const span = document.createElement('span');
    span.className = `catcher-name ${tier}`;
    span.textContent = capitalize(trainer);
    titleEl.appendChild(span);
  } else {
    titleEl.textContent = capitalize(trainer);
  }

  const team = Array.isArray(catcher.team)
    ? catcher.team.filter(Boolean)
    : Object.values(catcher.team || {}).filter(Boolean);

  const totalPoints = team.reduce((sum, p) => sum + calcPoints(p), 0);
  const donation    = catcher.donation || 0;

  document.getElementById("totalPoints").textContent =
    `${totalPoints.toLocaleString('en-US')} Total Points`;

  animateNumber('statPoints', totalPoints);
  animateNumber('statTeam', team.length);
  const level = getPlayerLevel(totalPoints);
  animateNumber('statLevel', level);

  // XP bar
  const xpNow  = totalPoints;
  const xpPrev = getXpForLevel(level);
  const xpNext = getXpForLevel(level + 1);
  const pct    = Math.min(100, ((xpNow - xpPrev) / (xpNext - xpPrev)) * 100);
  setTimeout(() => {
    const fill = document.getElementById("levelFill");
    fill.style.width    = `${pct.toFixed(1)}%`;
    fill.className      = `xp-fill ${getLevelColor(level)}`;
    document.getElementById("levelPercentText").textContent = `${pct.toFixed(1)}%`;
  }, 500);
  document.getElementById("levelLabel").textContent =
    `Level ${level} – ${Math.floor(xpNow).toLocaleString('en-US')} / ${Math.floor(xpNext).toLocaleString('en-US')} XP`;

  document.getElementById("catchdexLink").href =
    `catchdex_catcher.html?name=${encodeURIComponent(trainerName)}`;

  updateDexCompletion(team).then(() => {
    // Render achievements after dex is loaded so dex-based ones work
    renderAchievements(team, donation);
  });
  renderTeamGrouped(team);
  if (team.length > 0) runCatchup(trainerName, team);
}

onValue(ref(db, 'trainers'), snap => {
  const data = snap.val() || {};
  if (trainerName) loadCatcherData(data);
});

console.log('🎮 Catcher Detail loaded');