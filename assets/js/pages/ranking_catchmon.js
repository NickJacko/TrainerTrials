// assets/js/pages/ranking_catchmon.js
import { db } from '../firebase.client.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

let allCatchmon = [];
let catcherDonations = {};

function sumStats(stats) { return Object.values(stats || {}).reduce((a, b) => a + (b || 0), 0); }

function calcPoints(catchmon) {
  if (!catchmon) return 0;
  const level = catchmon.level || 1;
  const statSum = sumStats(catchmon.stats);
  let points = level * 10 + statSum;
  const rarityMultipliers = { "Common": 1, "Uncommon": 1.2, "Rare": 1.5, "Epic": 2, "Legendary": 3, "Mythical": 5 };
  points *= rarityMultipliers[catchmon.rarity] || 1;
  if (catchmon.shiny) points *= 2;
  return Math.round(points);
}

function getDonationTier(donation) {
  if (donation >= 1000) return "king";
  if (donation >= 500) return "flame";
  if (donation >= 250) return "diamond";
  if (donation >= 100) return "shine";
  return "normal";
}

function buildCatcherCell(catcherName, donation) {
  const tier = getDonationTier(donation);
  const span = document.createElement('span');
  span.className = `catcher-name ${tier}`;
  span.textContent = catcherName;
  return span;
}

function renderTable() {
  const tbody = document.getElementById("rankingBody");
  const showCaughtOnly = document.getElementById("caughtOnly").checked;

  const visible = allCatchmon
    .filter(p => !showCaughtOnly || p.caught)
    .sort((a, b) => b.points - a.points);

  if (visible.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading"><div class="loading-spinner"></div><div>No Catchmon found</div></td></tr>';
    return;
  }

  const rankClasses = ['rank-1', 'rank-2', 'rank-3'];
  const rowClasses = ['gold-row', 'silver-row', 'bronze-row'];
  const fragment = document.createDocumentFragment();

  visible.forEach((p, index) => {
    const tr = document.createElement("tr");
    if (rowClasses[index]) tr.classList.add(rowClasses[index]);

    const tdRank = document.createElement('td');
    const badge = document.createElement('div');
    badge.className = `rank-badge ${rankClasses[index] || 'rank-other'}`;
    badge.textContent = index + 1;
    tdRank.appendChild(badge);

    const tdSprite = document.createElement('td');
    const spriteLink = document.createElement('a');
    spriteLink.href = `dex_detail.html?name=${encodeURIComponent(p.name)}`;
    const img = document.createElement('img');
    img.className = 'catchmon-sprite';
    img.src = p.sprite || '';
    img.alt = p.name;
    img.loading = 'lazy';
    img.onerror = function() { this.style.display = 'none'; };
    spriteLink.appendChild(img);
    tdSprite.appendChild(spriteLink);

    const tdName = document.createElement('td');
    tdName.className = 'name-cell';
    const nameLink = document.createElement('a');
    nameLink.href = `dex_detail.html?name=${encodeURIComponent(p.name)}`;
    nameLink.textContent = p.name;
    tdName.appendChild(nameLink);

    const tdCatcher = document.createElement('td');
    tdCatcher.className = 'catcher-cell';
    tdCatcher.appendChild(buildCatcherCell(p.catcher, catcherDonations[p.catcher] || 0));

    const tdPoints = document.createElement('td');
    tdPoints.className = 'points-cell';
    tdPoints.textContent = p.points.toLocaleString('de-DE');

    const tdLevel = document.createElement('td');
    tdLevel.className = 'level-cell';
    tdLevel.textContent = p.level;

    const tdStats = document.createElement('td');
    tdStats.className = 'stats-cell';
    tdStats.textContent = p.statSum.toLocaleString('de-DE');

    const tdShiny = document.createElement('td');
    if (p.shiny) {
      const shinySpan = document.createElement('span');
      shinySpan.className = 'shiny-badge';
      shinySpan.textContent = '✨';
      tdShiny.appendChild(shinySpan);
    }

    tr.append(tdRank, tdSprite, tdName, tdCatcher, tdPoints, tdLevel, tdStats, tdShiny);
    fragment.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(fragment);
}

function forceRefresh() {
  document.getElementById("rankingBody").innerHTML =
    '<tr><td colspan="8" class="loading"><div class="loading-spinner"></div><div>Refreshing...</div></td></tr>';
  renderTable();
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
  allCatchmon = [];
  catcherDonations = {};
  for (const [catcher, info] of Object.entries(trainersData)) {
    catcherDonations[catcher] = info.donation || 0;
    const team = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
    for (const c of team) {
      if (c && c.name) {
        allCatchmon.push({
          catcher, name: c.name, level: c.level || 1, shiny: c.shiny || false,
          stats: c.stats || {}, rarity: c.rarity || "Common", sprite: c.sprite || "",
          points: calcPoints(c), statSum: sumStats(c.stats), caught: true
        });
      }
    }
  }
  renderTable();
});

document.getElementById('caughtOnly').addEventListener('change', renderTable);
document.getElementById('refreshFab').addEventListener('click', forceRefresh);

console.log('🔥 Catchmon Ranking loaded — XSS-safe, Firebase realtime');