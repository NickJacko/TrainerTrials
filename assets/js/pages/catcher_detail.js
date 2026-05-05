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

function getPlayerLevel(totalPoints) { return Math.floor(Math.pow(totalPoints / 500, 0.6)); }
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
    element.textContent = elementId === 'statPoints' ? current.toLocaleString('de-DE') : current;
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

  // ── Leeres Team — noch keine Catches ──────────────────────────────────────
  if (!team || team.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:48px 20px;">
          <div style="font-size:2.5rem;margin-bottom:12px;">🎯</div>
          <div style="font-size:1rem;font-weight:800;color:rgba(255,255,255,0.7);margin-bottom:6px;">
            No Catchmon yet
          </div>
          <div style="font-size:0.85rem;color:rgba(255,255,255,0.3);line-height:1.5;">
            This trainer hasn't caught anything yet.<br>
            Join the next live stream to start catching!
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
    headerRow.style.cssText = `background:${colors.bg}; border-top: 1px solid ${colors.border};`;
    const headerTd = document.createElement('td');
    headerTd.colSpan = 5;
    headerTd.style.cssText = `color:${colors.text}; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:1.5px;`;
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
      tdStats.textContent = sumStats.toLocaleString('de-DE');

      const tdPoints = document.createElement('td');
      tdPoints.className = 'points-cell';
      tdPoints.textContent = points.toLocaleString('de-DE');

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
    const caught  = new Set(team.map(p => p.name.toLowerCase())).size;
    const total   = dexList.length;
    const pct     = total > 0 ? Math.round((caught / total) * 100) : 0;
    document.getElementById('dexCaughtCount').textContent = caught;
    document.getElementById('dexTotalCount').textContent  = total;
    document.getElementById('dexPct').textContent         = `${pct}%`;
    setTimeout(() => { document.getElementById('dexBar').style.width = `${pct}%`; }, 600);
  } catch {
    // dex_list.json nicht gefunden — Fallback
    document.getElementById('dexCaughtCount').textContent = '—';
    document.getElementById('dexTotalCount').textContent  = '—';
    document.getElementById('dexPct').textContent         = '—';
  }
}

// ── Load ──────────────────────────────────────────────────────────────────────
function loadCatcherData(trainersData) {
  const trainer = trainerName.toLowerCase();
  const catcher = trainersData[trainer];

  // ── Trainer existiert noch nicht in Firebase ──────────────────────────────
  if (!catcher) {
    // Name trotzdem anzeigen — er hat nur noch nichts gefangen
    const titleEl = document.getElementById("catcherTitle");
    titleEl.textContent = capitalize(trainer);

    document.getElementById("totalPoints").textContent = "0 Total Points";
    document.getElementById("statPoints").textContent  = "0";
    document.getElementById("statTeam").textContent    = "0";
    document.getElementById("statLevel").textContent   = "1";

    // XP bar auf 0
    const fill = document.getElementById("levelFill");
    fill.style.width = "0%";
    fill.className   = "xp-fill level-gray";
    document.getElementById("levelPercentText").textContent = "0%";
    document.getElementById("levelLabel").textContent       = "Level 1 – 0 / 500 XP";

    // Dex auf 0
    document.getElementById('dexCaughtCount').textContent = "0";
    document.getElementById('dexPct').textContent         = "0%";
    try { document.getElementById('dexBar').style.width   = "0%"; } catch {}

    // Catchdex Link trotzdem setzen
    document.getElementById("catchdexLink").href =
      `catchdex_catcher.html?name=${encodeURIComponent(trainerName)}`;

    // Leeres Team rendern
    renderTeamGrouped([]);
    return;
  }

  // ── Trainer gefunden ──────────────────────────────────────────────────────
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

  document.getElementById("totalPoints").textContent =
    `${totalPoints.toLocaleString('de-DE')} Total Points`;

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
    `Level ${level} – ${Math.floor(xpNow).toLocaleString('de-DE')} / ${Math.floor(xpNext).toLocaleString('de-DE')} XP`;

  document.getElementById("catchdexLink").href =
    `catchdex_catcher.html?name=${encodeURIComponent(trainerName)}`;

  updateDexCompletion(team);
  renderTeamGrouped(team);
  if (team.length > 0) runCatchup(trainerName, team);
}

onValue(ref(db, 'trainers'), snap => {
  const data = snap.val() || {};
  if (trainerName) loadCatcherData(data);
});

console.log('🎮 Catcher Detail loaded');