// assets/js/pages/catcher_ranking.js
import { db } from '../firebase.client.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

let currentSortMode = 'points';
let allCatchers = [];

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

function calcLevel(points) { return Math.floor(Math.pow(points / 500, 0.6)); }

function getDonationTier(donation) {
  if (donation >= 2500) return "king";
  if (donation >= 500)  return "flame";
  if (donation >= 250)  return "diamond";
  if (donation >= 100)  return "shine";
  return "normal";
}

function animateNumber(elementId, targetNumber) {
  const element = document.getElementById(elementId);
  const startNumber = parseInt(element.textContent.replace(/\D/g, '')) || 0;
  const duration = 1000;
  const startTime = Date.now();
  function update() {
    const progress = Math.min((Date.now() - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(startNumber + (targetNumber - startNumber) * eased);
    element.textContent = elementId === 'totalPoints' ? current.toLocaleString('de-DE') : current;
    if (progress < 1) requestAnimationFrame(update);
  }
  update();
}

function setSortMode(mode) {
  currentSortMode = mode;
  document.querySelectorAll('.sort-button').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`sort${mode.charAt(0).toUpperCase() + mode.slice(1)}`).classList.add('active');
  renderTable();
}

function filterTable() {
  const input = document.getElementById("searchInput").value.toUpperCase();
  document.getElementById("rankingBody").querySelectorAll("tr").forEach(row => {
    const nameCell = row.querySelector("td:nth-child(2)");
    if (nameCell) row.style.display = nameCell.textContent.toUpperCase().includes(input) ? "" : "none";
  });
}

function forceRefresh() {
  const fab = document.getElementById('refreshFab');
  fab.style.transform = 'scale(1.2)';
  setTimeout(() => { fab.style.transform = ''; }, 200);
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById("rankingBody");
  if (allCatchers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading"><div class="loading-spinner"></div><div>No catchers found</div></td></tr>';
    return;
  }

  const sorted = [...allCatchers].sort((a, b) => {
    if (currentSortMode === 'points') return b.totalPoints - a.totalPoints;
    if (currentSortMode === 'level')  return b.level - a.level;
    if (currentSortMode === 'count')  return b.teamSize - a.teamSize;
    return 0;
  });

  const rankClasses = ['rank-1', 'rank-2', 'rank-3'];
  const rowClasses  = ['gold-row', 'silver-row', 'bronze-row'];
  const fragment = document.createDocumentFragment();

  sorted.forEach((catcher, index) => {
    const tr = document.createElement("tr");
    if (rowClasses[index]) tr.classList.add(rowClasses[index]);

    // Ganze Zeile klickbar
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => {
      window.location.href = `catcher_detail.html?name=${encodeURIComponent(catcher.name)}`;
    });

    // Rank
    const tdRank = document.createElement('td');
    const badge = document.createElement('div');
    badge.className = `rank-badge ${rankClasses[index] || 'rank-other'}`;
    badge.textContent = index + 1;
    tdRank.appendChild(badge);

    // Name
    const tdName = document.createElement('td');
    tdName.className = 'catcher-cell';
    const tier = getDonationTier(catcher.donation);
    const nameDiv = document.createElement('div');
    if (tier !== 'normal') {
      const span = document.createElement('span');
      span.className = `catcher-name ${tier}`;
      span.textContent = capitalize(catcher.name);
      nameDiv.appendChild(span);
    } else {
      nameDiv.textContent = capitalize(catcher.name);
    }
    const levelDiv = document.createElement('div');
    levelDiv.className = 'level-display';
    levelDiv.textContent = `Level ${catcher.level}`;
    tdName.appendChild(nameDiv);
    tdName.appendChild(levelDiv);

    // Points
    const tdPoints = document.createElement('td');
    tdPoints.className = 'points-cell';
    tdPoints.textContent = catcher.totalPoints.toLocaleString('de-DE');

    // Team
    const tdTeam = document.createElement('td');
    tdTeam.className = 'team-count';
    tdTeam.textContent = catcher.teamSize;

    // Level
    const tdLevel = document.createElement('td');
    tdLevel.textContent = catcher.level;

    tr.append(tdRank, tdName, tdPoints, tdTeam, tdLevel);
    fragment.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(fragment);
}

// Firebase
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
  allCatchers = Object.entries(trainersData).map(([name, info]) => {
    const team = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
    const totalPoints = team.reduce((sum, p) => sum + calcPoints(p), 0);
    return { name, teamSize: team.length, totalPoints, level: calcLevel(totalPoints), donation: info.donation || 0 };
  });
  animateNumber('totalCatchers', allCatchers.length);
  animateNumber('totalPoints', allCatchers.reduce((sum, c) => sum + c.totalPoints, 0));
  renderTable();
});

document.getElementById('searchInput').addEventListener('keyup', filterTable);
document.getElementById('refreshFab').addEventListener('click', forceRefresh);
document.getElementById('sortPoints').addEventListener('click', () => setSortMode('points'));
document.getElementById('sortLevel').addEventListener('click',  () => setSortMode('level'));
document.getElementById('sortCount').addEventListener('click',  () => setSortMode('count'));

console.log('🔥 Catcher Ranking loaded — clickable rows');