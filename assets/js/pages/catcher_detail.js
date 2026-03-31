// assets/js/pages/catcher_detail.js
import { db } from '../firebase.client.js';
import { ref, onValue, get } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { runCatchup } from '../catchup.js';

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

const rawName = new URLSearchParams(window.location.search).get("name");
const trainerName = validateTrainerName(rawName);

if (!trainerName) {
  document.getElementById("teamTable").innerHTML =
    '<tr><td colspan="5" class="error-message">Invalid or missing trainer name.</td></tr>';
}

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function calcPoints(catchmon) {
  if (!catchmon) return 0;
  const level = catchmon.level || 1;
  const stats = catchmon.stats || {};
  const statSum = Object.values(stats).reduce((sum, val) => sum + (val || 0), 0);
  let points = level * 10 + statSum;
  const rarityMultipliers = { "Common": 1, "Uncommon": 1.2, "Rare": 1.5, "Epic": 2, "Legendary": 3, "Mythical": 5 };
  points *= rarityMultipliers[catchmon.rarity] || 1;
  if (catchmon.shiny) points *= 2;
  return Math.round(points);
}

function getDonationTier(donation) {
  if (donation >= 2500) return "king";
  if (donation >= 500)  return "flame";
  if (donation >= 250)  return "diamond";
  if (donation >= 100)  return "shine";
  return "normal";
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

// Rarity order + colors for grouped view
const RARITY_ORDER = ["God", "Mythical", "Legendary", "Rare", "Starter", "Common"];
const RARITY_COLORS = {
  God:       { bg: "rgba(128,0,128,0.2)",  border: "rgba(128,0,128,0.4)",  text: "#ce93d8" },
  Mythical:  { bg: "rgba(156,39,176,0.2)", border: "rgba(156,39,176,0.4)", text: "#ce93d8" },
  Legendary: { bg: "rgba(255,152,0,0.15)", border: "rgba(255,152,0,0.35)", text: "#ffb74d" },
  Rare:      { bg: "rgba(33,150,243,0.15)",border: "rgba(33,150,243,0.35)",text: "#64b5f6" },
  Starter:   { bg: "rgba(76,175,80,0.15)", border: "rgba(76,175,80,0.35)", text: "#81c784" },
  Common:    { bg: "rgba(255,255,255,0.05)",border:"rgba(255,255,255,0.1)", text: "#e0e0e0" },
};

function renderTeamGrouped(team) {
  const tbody = document.getElementById("teamTable");

  if (team.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="error-message">No Catchmon in team yet</td></tr>';
    return;
  }

  // Group by rarity
  const groups = {};
  RARITY_ORDER.forEach(r => groups[r] = []);
  team.forEach(p => {
    const r = p.rarity || "Common";
    if (!groups[r]) groups[r] = [];
    groups[r].push(p);
  });
  // Sort within each group by points desc
  Object.values(groups).forEach(g => g.sort((a, b) => calcPoints(b) - calcPoints(a)));

  const fragment = document.createDocumentFragment();

  RARITY_ORDER.forEach(rarity => {
    const group = groups[rarity];
    if (!group || group.length === 0) return;

    const colors = RARITY_COLORS[rarity] || RARITY_COLORS.Common;

    // Group header row
    const headerRow = document.createElement('tr');
    headerRow.className = 'rarity-group-header';
    headerRow.style.cssText = `background: ${colors.bg}; border-top: 2px solid ${colors.border};`;
    const headerTd = document.createElement('td');
    headerTd.colSpan = 5;
    headerTd.style.cssText = `color: ${colors.text}; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; padding: 8px 12px; text-align: left;`;
    const rarityEmojis = { God:"⚫", Mythical:"🟣", Legendary:"🟡", Rare:"🔵", Starter:"🌱", Common:"⚪" };
    headerTd.textContent = `${rarityEmojis[rarity] || ''} ${rarity}  ·  ${group.length}`;
    headerRow.appendChild(headerTd);
    fragment.appendChild(headerRow);

    // Catchmon rows
    group.forEach(p => {
      const row = document.createElement("tr");
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        window.location.href = `dex_detail.html?name=${encodeURIComponent(p.name)}`;
      });

      const sumStats = Object.values(p.stats || {}).reduce((a, b) => a + (b || 0), 0);
      const points = calcPoints(p);

      const tdSprite = document.createElement('td');
      const img = document.createElement('img');
      img.className = 'catchmon-image';
      img.src = p.sprite || '';
      img.alt = escapeHtml(p.name);
      img.loading = 'lazy';
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

async function updateDexCompletion(team) {
  try {
    // Unique Catchmon names in team
    const caughtNames = new Set(team.map(p => p.name.toLowerCase()));

    // Load dex_list to get total
    const res = await fetch("dex_list.json?" + Date.now());
    const dexList = await res.json();
    const total = dexList.length;
    const caught = caughtNames.size;
    const pct = total > 0 ? Math.round((caught / total) * 100) : 0;

    // Update UI
    document.getElementById('dexCaughtCount').textContent = caught;
    document.getElementById('dexTotalCount').textContent = total;
    document.getElementById('dexPct').textContent = `${pct}%`;
    setTimeout(() => {
      const bar = document.getElementById('dexBar');
      bar.style.width = `${pct}%`;
    }, 600);
  } catch (e) {
    console.warn('Could not load dex_list.json for completion:', e);
  }
}

function loadCatcherData(trainersData) {
  const trainer = trainerName.toLowerCase();
  const catcher = trainersData[trainer];

  if (!catcher) {
    document.getElementById("teamTable").innerHTML =
      '<tr><td colspan="5" class="error-message">Trainer not found.</td></tr>';
    return;
  }

  const tier = getDonationTier(catcher.donation || 0);

  // Title
  const titleEl = document.getElementById("catcherTitle");
  titleEl.textContent = '';
  titleEl.appendChild(document.createTextNode('🎮 '));
  if (tier !== "normal") {
    const span = document.createElement('span');
    span.className = `catcher-name ${tier}`;
    span.textContent = capitalize(trainer);
    titleEl.appendChild(span);
  } else {
    titleEl.appendChild(document.createTextNode(capitalize(trainer)));
  }

  const team = Array.isArray(catcher.team) ? catcher.team : Object.values(catcher.team || {});
  const totalPoints = team.reduce((sum, p) => sum + calcPoints(p), 0);

  animateNumber('statPoints', totalPoints);
  animateNumber('statTeam', team.length);
  const level = getPlayerLevel(totalPoints);
  animateNumber('statLevel', level);

  document.getElementById("totalPoints").textContent = `${totalPoints.toLocaleString('de-DE')} Total Points`;

  // XP bar
  const xpNow  = totalPoints;
  const xpPrev = getXpForLevel(level);
  const xpNext = getXpForLevel(level + 1);
  const percent = Math.min(100, ((xpNow - xpPrev) / (xpNext - xpPrev)) * 100);
  setTimeout(() => {
    const fill = document.getElementById("levelFill");
    fill.style.width = `${percent.toFixed(1)}%`;
    fill.className = `level-bar ${getLevelColor(level)}`;
    document.getElementById("levelPercentText").textContent = `${percent.toFixed(1)}%`;
  }, 500);
  document.getElementById("levelLabel").textContent =
    `Level ${level} – ${Math.floor(xpNow).toLocaleString('de-DE')} / ${Math.floor(xpNext).toLocaleString('de-DE')} XP`;

  // Catchdex link
  document.getElementById("catchdexLink").href =
    `catchdex_catcher.html?name=${encodeURIComponent(trainerName)}`;

  // Dex completion
  updateDexCompletion(team);

  // Team grouped by rarity
  renderTeamGrouped(team);

  // Catchup — zeige neue Catchmon seit letztem Besuch
  runCatchup(trainerName, team);
}


onValue(ref(db, 'trainers'), (snapshot) => {
  const trainersData = snapshot.val() || {};
  if (trainerName) loadCatcherData(trainersData);
});

console.log('🔥 Catcher Detail loaded — rarity grouping, dex completion');