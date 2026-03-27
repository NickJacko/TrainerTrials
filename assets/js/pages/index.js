// assets/js/pages/index.js
import { db } from '../firebase.client.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

function escapeHtml(input) {
  const s = String(input ?? "");
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function getDonationTier(donation) {
  if (donation >= 2500) return 'god';
  if (donation >= 500) return 'king';
  if (donation >= 250) return 'diamond';
  if (donation >= 100) return 'flame';
  if (donation >= 50) return 'shine';
  return 'normal';
}

function buildCatcherNameEl(name, donation) {
  const tier = getDonationTier(donation);
  const span = document.createElement('span');
  span.className = `catcher-name ${tier}`;
  span.textContent = name;
  return span;
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

function calcCatchmonPoints(catchmon) {
  if (!catchmon) return 0;
  const level = catchmon.level || 1;
  const stats = catchmon.stats || {};
  const statSum = Object.values(stats).reduce((s, v) => s + (v || 0), 0);
  let points = level * 10 + statSum;
  const rarityMultipliers = { "Common": 1, "Uncommon": 1.2, "Rare": 1.5, "Epic": 2, "Legendary": 3, "Mythical": 4 };
  points *= rarityMultipliers[catchmon.rarity || "Common"] || 1;
  if (catchmon.shiny) points *= 1.5;
  return Math.floor(points);
}

function calcTotalPoints(team) {
  if (!team) return 0;
  const arr = Array.isArray(team) ? team : Object.values(team);
  return arr.reduce((sum, p) => sum + calcCatchmonPoints(p), 0);
}

onValue(ref(db, '.info/connected'), (snapshot) => {
  const el = document.getElementById('connectionStatus');
  const liveEl = document.getElementById('liveStatusText');
  if (snapshot.val()) {
    el.textContent = '🔥 Firebase Live';
    el.className = 'connection-status connected';
    liveEl.textContent = 'LIVE NOW - Join the Action!';
  } else {
    el.textContent = '❌ Offline';
    el.className = 'connection-status';
    liveEl.textContent = 'Reconnecting...';
  }
});

onValue(ref(db, 'global'), (snapshot) => {
  const data = snapshot.val() || {};
  document.getElementById('totalSpawns').textContent = formatNumber(data.total_spawns || 0);
  document.getElementById('totalCatches').textContent = formatNumber(data.total_catches || 0);
  document.getElementById('totalEscapes').textContent = formatNumber(data.total_escapes || 0);
  document.getElementById('totalLikesEver').textContent = formatNumber(data.total_likes_ever || 0);
});

onValue(ref(db, 'trainers'), (snapshot) => {
  const trainersData = snapshot.val() || {};
  renderTopCatchers(trainersData);
  renderTopCatchmon(trainersData);
});

function renderTopCatchers(trainersData) {
  const container = document.getElementById('catcherRow');
  const trainers = Object.entries(trainersData).map(([name, info]) => {
    const team = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
    return { name, team, totalPoints: calcTotalPoints(team), teamSize: team.length, donation: info.donation || 0, totalCatches: info.stats?.total_catches || 0 };
  }).filter(t => t.teamSize > 0).sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 3);

  if (trainers.length === 0) {
    container.innerHTML = '<div class="loading"><div>No active trainers found</div></div>';
    return;
  }

  container.innerHTML = '';
  trainers.forEach((trainer, index) => {
    const medalClass = ['medal-1', 'medal-2', 'medal-3'][index] || '';
    const card = document.createElement('div');
    card.className = `card ${medalClass}`;
    card.style.cursor = 'pointer';

    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = index + 1;

    const content = document.createElement('div');
    content.className = 'card-content';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'card-title';
    titleDiv.appendChild(buildCatcherNameEl(trainer.name, trainer.donation));

    const s1 = document.createElement('div'); s1.className = 'card-stats'; s1.textContent = `Team: ${trainer.teamSize} Catchmon`;
    const s2 = document.createElement('div'); s2.className = 'card-stats'; s2.textContent = `Catches: ${formatNumber(trainer.totalCatches)}`;
    const s3 = document.createElement('div'); s3.className = 'card-stats'; s3.textContent = `Donation: ${formatNumber(trainer.donation)}€`;
    const pts = document.createElement('div'); pts.className = 'points-highlight'; pts.textContent = `${formatNumber(trainer.totalPoints)} Points`;

    content.append(titleDiv, s1, s2, s3, pts);
    card.append(badge, content);
    card.addEventListener('click', () => { window.location.href = `catcher_detail.html?name=${encodeURIComponent(trainer.name)}`; });
    container.appendChild(card);
  });
}

function renderTopCatchmon(trainersData) {
  const container = document.getElementById('catchmonRow');
  const allCatchmon = [];

  for (const [trainerName, info] of Object.entries(trainersData)) {
    const team = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
    team.forEach(c => {
      if (c && c.name) allCatchmon.push({ ...c, caughtBy: trainerName, trainerDonation: info.donation || 0 });
    });
  }

  if (allCatchmon.length === 0) {
    container.innerHTML = '<div class="loading"><div>No Catchmon caught yet</div></div>';
    return;
  }

  const top3 = allCatchmon.sort((a, b) => calcCatchmonPoints(b) - calcCatchmonPoints(a)).slice(0, 3);
  container.innerHTML = '';

  top3.forEach((catchmon, index) => {
    const medalClass = ['medal-1', 'medal-2', 'medal-3'][index] || '';
    const card = document.createElement('div');
    card.className = `card ${medalClass}`;
    card.style.cursor = 'pointer';

    const badge = document.createElement('div'); badge.className = 'badge'; badge.textContent = index + 1;
    const content = document.createElement('div'); content.className = 'card-content';

    const img = document.createElement('img');
    img.src = catchmon.sprite || '';
    img.alt = escapeHtml(catchmon.name);
    img.style.cssText = 'width:80px;height:80px;object-fit:contain;margin-bottom:10px;filter:drop-shadow(0 0 10px rgba(255,255,255,0.3));';
    img.onerror = function() { this.style.display = 'none'; };

    const titleDiv = document.createElement('div'); titleDiv.className = 'card-title'; titleDiv.textContent = `${catchmon.name}${catchmon.shiny ? ' ✨' : ''}`;
    const levelDiv = document.createElement('div'); levelDiv.className = 'card-stats'; levelDiv.textContent = `Level ${catchmon.level || 1}`;

    const catcherDiv = document.createElement('div'); catcherDiv.className = 'card-stats';
    catcherDiv.appendChild(document.createTextNode('Catcher: '));
    catcherDiv.appendChild(buildCatcherNameEl(catchmon.caughtBy, catchmon.trainerDonation));

    const rarityDiv = document.createElement('div'); rarityDiv.className = 'card-stats'; rarityDiv.textContent = `Rarity: ${catchmon.rarity || 'Unknown'}`;
    const ptsDiv = document.createElement('div'); ptsDiv.className = 'points-highlight'; ptsDiv.textContent = `${formatNumber(calcCatchmonPoints(catchmon))} Points`;

    content.append(img, titleDiv, levelDiv, catcherDiv, rarityDiv, ptsDiv);
    card.append(badge, content);
    card.addEventListener('click', () => { window.location.href = `catcher_detail.html?name=${encodeURIComponent(catchmon.caughtBy)}`; });
    container.appendChild(card);
  });
}

console.log('🔥 Firebase Live Hub loaded — XSS-safe, central firebase.client.js');