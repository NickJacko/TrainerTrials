// assets/js/pages/catcher_ranking.js
import { db } from '../firebase.client.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const STORAGE_KEY = 'catchmon_trainer_name';
let currentSortMode = 'points';
let allCatchers = [];
let hasScrolled = false;

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
function getSavedTrainer() {
  try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
}
function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

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

function calcLevel(points) { return Math.max(1, Math.floor(Math.pow(points / 500, 0.6))); }

function getDonationTier(donation) {
  if (donation >= 2500) return "king";
  if (donation >= 500)  return "flame";
  if (donation >= 250)  return "diamond";
  if (donation >= 100)  return "shine";
  return "normal";
}

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function animateNumber(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const start = parseInt(el.textContent.replace(/\D/g, '')) || 0;
  const duration = 1000;
  const t0 = Date.now();
  function update() {
    const p = Math.min((Date.now() - t0) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.floor(start + (target - start) * eased));
    if (p < 1) requestAnimationFrame(update);
  }
  update();
}

// ── Sort & Filter ─────────────────────────────────────────────────────────────
function setSortMode(mode) {
  currentSortMode = mode;
  document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`sort${mode.charAt(0).toUpperCase() + mode.slice(1)}`).classList.add('active');
  hasScrolled = false;
  renderTable();
}

function filterTable() {
  const input = document.getElementById("searchInput").value.toUpperCase();
  document.getElementById("rankingBody").querySelectorAll("tr").forEach(row => {
    const cell = row.querySelector("td:nth-child(2)");
    if (cell) row.style.display = cell.textContent.toUpperCase().includes(input) ? "" : "none";
  });
}

function forceRefresh() {
  const fab = document.getElementById('refreshFab');
  fab.style.transform = 'rotate(360deg) scale(1.15)';
  setTimeout(() => { fab.style.transform = ''; }, 300);
  hasScrolled = false;
  renderTable();
}

function scrollToMyRow() {
  if (hasScrolled) return;
  const myRow = document.querySelector('tr.my-row');
  if (!myRow) return;
  hasScrolled = true;
  setTimeout(() => { myRow.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 400);
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById("rankingBody");
  const savedTrainer = getSavedTrainer();

  if (allCatchers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading"><div class="spinner"></div><div>No catchers found</div></td></tr>';
    return;
  }

  const sorted = [...allCatchers].sort((a, b) => {
    if (currentSortMode === 'points') return b.totalPoints - a.totalPoints;
    if (currentSortMode === 'level')  return b.level - a.level;
    if (currentSortMode === 'count')  return b.teamSize - a.teamSize;
    return 0;
  });

  const rankClasses = ['rank-1','rank-2','rank-3'];
  const rowClasses  = ['gold-row','silver-row','bronze-row'];
  const fragment = document.createDocumentFragment();

  sorted.forEach((catcher, index) => {
    const isMe = savedTrainer && catcher.name.toLowerCase() === savedTrainer.toLowerCase();
    const tr = document.createElement("tr");
    if (rowClasses[index]) tr.classList.add(rowClasses[index]);
    if (isMe) tr.classList.add('my-row');
    tr.addEventListener('click', () => {
      window.location.href = `catcher_detail.html?name=${encodeURIComponent(catcher.name)}`;
    });

    const tdRank = document.createElement('td');
    const badge = document.createElement('div');
    badge.className = `rank-badge ${rankClasses[index] || 'rank-other'}`;
    badge.textContent = index + 1;
    tdRank.appendChild(badge);

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
    if (isMe) {
      const you = document.createElement('span');
      you.className = 'you-badge'; you.textContent = 'YOU';
      nameDiv.appendChild(you);
    }
    const levelDiv = document.createElement('div');
    levelDiv.className = 'level-display';
    levelDiv.textContent = `Level ${catcher.level}`;
    tdName.append(nameDiv, levelDiv);

    const tdPoints = document.createElement('td');
    tdPoints.className = 'points-cell';
    tdPoints.textContent = fmt(catcher.totalPoints);

    const tdTeam = document.createElement('td');
    tdTeam.className = 'team-count';
    tdTeam.textContent = catcher.teamSize;

    const tdLevel = document.createElement('td');
    tdLevel.textContent = catcher.level;

    tr.append(tdRank, tdName, tdPoints, tdTeam, tdLevel);
    fragment.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(fragment);
  scrollToMyRow();
}

// ── Firebase ──────────────────────────────────────────────────────────────────
onValue(ref(db, 'trainers'), snap => {
  const data = snap.val() || {};
  allCatchers = Object.entries(data).map(([name, info]) => {
    const team = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
    const totalPoints = team.reduce((sum, p) => sum + calcPoints(p), 0);
    return { name, teamSize: team.length, totalPoints, level: calcLevel(totalPoints), donation: info.donation || 0 };
  });
  animateNumber('totalCatchers', allCatchers.length);
  animateNumber('totalPoints', allCatchers.reduce((sum, c) => sum + c.totalPoints, 0));
  renderTable();
});

// ── Events ────────────────────────────────────────────────────────────────────
document.getElementById('searchInput').addEventListener('keyup', filterTable);
document.getElementById('refreshFab').addEventListener('click', forceRefresh);
document.getElementById('sortPoints').addEventListener('click', () => setSortMode('points'));
document.getElementById('sortLevel').addEventListener('click',  () => setSortMode('level'));
document.getElementById('sortCount').addEventListener('click',  () => setSortMode('count'));

console.log('🏆 Catcher Ranking loaded');