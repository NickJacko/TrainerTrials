// assets/js/pages/catcher_detail.js
import { db } from '../firebase.client.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

function escapeHtml(input) {
  const s = String(input ?? "");
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
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
  if (donation >= 500) return "flame";
  if (donation >= 250) return "diamond";
  if (donation >= 100) return "shine";
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
  if (level >= 5) return "level-lightgreen";
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

function loadCatcherData(trainersData) {
  const trainer = trainerName.toLowerCase();
  const catcher = trainersData[trainer];

  if (!catcher) {
    document.getElementById("teamTable").innerHTML =
      '<tr><td colspan="5" class="error-message">Trainer not found or no data available.</td></tr>';
    return;
  }

  const tier = getDonationTier(catcher.donation || 0);

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
  const sorted = team.slice().sort((a, b) => calcPoints(b) - calcPoints(a));
  const totalPoints = sorted.reduce((sum, p) => sum + calcPoints(p), 0);

  animateNumber('statPoints', totalPoints);
  animateNumber('statTeam', sorted.length);
  const level = getPlayerLevel(totalPoints);
  animateNumber('statLevel', level);

  document.getElementById("totalPoints").textContent = `${totalPoints.toLocaleString('de-DE')} Total Points`;

  const xpNow = totalPoints;
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

  document.getElementById("catchdexLink").href =
    `catchdex_catcher.html?name=${encodeURIComponent(trainerName)}`;

  const tbody = document.getElementById("teamTable");

  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="error-message">No Catchmon in team yet</td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();
  sorted.forEach((p) => {
    const row = document.createElement("tr");
    const sumStats = Object.values(p.stats || {}).reduce((a, b) => a + (b || 0), 0);
    const points = calcPoints(p);
    const catchLink = `dex_detail.html?name=${encodeURIComponent(p.name)}`;

    const tdSprite = document.createElement('td');
    const spriteLink = document.createElement('a');
    spriteLink.href = catchLink;
    const img = document.createElement('img');
    img.className = 'catchmon-image';
    img.src = p.sprite || '';
    img.alt = escapeHtml(p.name);
    img.loading = 'lazy';
    img.onerror = function() { this.style.display = 'none'; };
    spriteLink.appendChild(img);
    tdSprite.appendChild(spriteLink);

    const tdName = document.createElement('td');
    tdName.className = 'catchmon-name';
    const nameLink = document.createElement('a');
    nameLink.href = catchLink;
    nameLink.textContent = p.name;
    tdName.appendChild(nameLink);

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

  tbody.innerHTML = '';
  tbody.appendChild(fragment);
}

onValue(ref(db, '.info/connected'), (snapshot) => {
  const el = document.getElementById('connectionStatus');
  if (snapshot.val()) {
    el.textContent = '🟢 Connected'; el.className = 'connection-status connected';
  } else {
    el.textContent = '🔴 Offline'; el.className = 'connection-status disconnected';
  }
});

onValue(ref(db, 'trainers'), (snapshot) => {
  const trainersData = snapshot.val() || {};
  if (trainerName) loadCatcherData(trainersData);
});

console.log('🔥 Catcher Detail loaded — XSS-safe, Firebase realtime');