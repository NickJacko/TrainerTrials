// assets/js/pages/dex_detail.js
import { db } from '../firebase.client.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const statsOrder = ["ATK","DEF","SPD","WIS","CHA","LUK"];
let allEntries = [];
let escapedEntries = [];
let catcherDonations = {};
let dexList = [];
let isGodMode = false;
let pendingTrainers = null;
let pendingEscaped  = null;

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
  try { return localStorage.getItem('catchmon_trainer_name') || null; } catch { return null; }
}
function escapeHtml(input) {
  const s = String(input ?? "");
  return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
function validateCatchmonName(name) {
  if (!name) return null;
  const cleaned = name.trim().slice(0, 60);
  if (!/^[\w\s\-]+$/.test(cleaned)) return null;
  return cleaned;
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function sumStats(stats) { return Object.values(stats || {}).reduce((a, b) => a + (b || 0), 0); }

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
function getDonationTier(donation) {
  if (donation >= 2500) return "king";
  if (donation >= 500)  return "flame";
  if (donation >= 250)  return "diamond";
  if (donation >= 100)  return "shine";
  return "normal";
}
function isGodCatchmon(sprite) { return sprite && sprite.includes('/God/'); }

// ── Relative time in English ──────────────────────────────────────────────────
function relativeTime(tsMs) {
  if (!tsMs) return null;
  const diff = Date.now() - tsMs;
  const min  = Math.floor(diff / 60000);
  const h    = Math.floor(diff / 3600000);
  const d    = Math.floor(diff / 86400000);
  if (min < 2)  return 'just now';
  if (min < 60) return `${min}m ago`;
  if (h < 24)   return `${h}h ago`;
  if (d < 30)   return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo === 1 ? '' : 's'} ago`;
}

// ── URL Param ─────────────────────────────────────────────────────────────────
const rawName      = new URLSearchParams(window.location.search).get("name");
const catchmonName = validateCatchmonName(rawName);
if (!catchmonName) {
  document.getElementById("catchTitle").textContent = "Invalid Catchmon name.";
  document.getElementById("summary").textContent    = "";
}

// ── Render Table ──────────────────────────────────────────────────────────────
function renderTable() {
  const tbody          = document.querySelector("#dataTable tbody");
  const showCaughtOnly = document.getElementById("caughtOnly").checked;
  const savedTrainer   = getSavedTrainer();

  const caught  = allEntries.sort((a, b) => calcPoints(b) - calcPoints(a));
  const escaped = showCaughtOnly ? [] : escapedEntries;

  if (caught.length === 0 && escaped.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="loading"><div class="spinner"></div><div>No data available</div></td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();

  // ── Caught rows ────────────────────────────────────────────────────────────
  caught.forEach(e => {
    const tr   = document.createElement("tr");
    const isMe = savedTrainer && e.catcher && e.catcher.toLowerCase() === savedTrainer.toLowerCase();
    if (isMe) tr.classList.add('my-row');

    const tdCatcher = document.createElement('td');
    if (isGodMode) {
      const span = document.createElement('span');
      span.style.color = '#9370DB';
      span.textContent = '█████';
      tdCatcher.appendChild(span);
    } else {
      const tier = getDonationTier(catcherDonations[e.catcher] || 0);
      const el   = document.createElement('span');
      el.className   = `catcher-name ${tier}`;
      el.textContent = capitalize(e.catcher);
      el.addEventListener('click', () => {
        window.location.href = `catcher_detail.html?name=${encodeURIComponent(e.catcher)}`;
      });
      tdCatcher.appendChild(el);
      if (isMe) {
        const you = document.createElement('span');
        you.className = 'you-tag'; you.textContent = 'YOU';
        tdCatcher.appendChild(you);
      }
    }

    const tdPoints = document.createElement('td');
    tdPoints.textContent = calcPoints(e).toLocaleString('en-US');
    const tdLevel = document.createElement('td');
    tdLevel.textContent = e.level || 1;
    const tdShiny = document.createElement('td');
    tdShiny.textContent = e.shiny ? "✨" : "";
    const tdSum = document.createElement('td');
    tdSum.textContent = sumStats(e.stats).toLocaleString('en-US');
    const tdTime = document.createElement('td');
    tdTime.className = 'time-cell';
    const rel = relativeTime(e.caught_at);
    tdTime.textContent = rel || '—';
    if (rel && e.caught_at) tdTime.title = new Date(e.caught_at).toLocaleString('en-US');

    tr.append(tdCatcher, tdPoints, tdLevel, tdShiny, tdSum, tdTime);
    statsOrder.forEach(s => {
      const td = document.createElement('td');
      td.textContent = e.stats?.[s] ?? 0;
      tr.appendChild(td);
    });
    fragment.appendChild(tr);
  });

  // ── Escaped rows ──────────────────────────────────────────────────────────
  escaped.forEach(e => {
    const tr = document.createElement("tr");
    tr.classList.add('uncaught-row');
    tr.title = 'Escaped — not caught';

    const tdCatcher = document.createElement('td');
    tdCatcher.innerHTML = '<span style="opacity:0.35;font-size:0.85em;">✗ escaped</span>';

    // ── Points für escaped anzeigen ───────────────────────────────────────────
    const tdPoints = document.createElement('td');
    const escapedPoints = calcPoints(e);
    tdPoints.innerHTML = escapedPoints > 0
      ? `<span style="opacity:0.45">${escapedPoints.toLocaleString('en-US')}</span>`
      : '<span style="opacity:0.25">—</span>';

    const tdLevel = document.createElement('td');
    tdLevel.innerHTML = `<span style="opacity:0.4">${e.level || '—'}</span>`;
    const tdShiny = document.createElement('td');
    tdShiny.textContent = e.shiny ? "✨" : "";
    const tdSum = document.createElement('td');
    tdSum.innerHTML = e.stats
      ? `<span style="opacity:0.4">${sumStats(e.stats).toLocaleString('en-US')}</span>`
      : '<span style="opacity:0.25">—</span>';
    const tdTime = document.createElement('td');
    tdTime.className = 'time-cell';
    const rel = relativeTime(e.escaped_at);
    tdTime.textContent = rel || '—';
    if (rel && e.escaped_at) tdTime.title = new Date(e.escaped_at).toLocaleString('en-US');

    tr.append(tdCatcher, tdPoints, tdLevel, tdShiny, tdSum, tdTime);
    statsOrder.forEach(s => {
      const td = document.createElement('td');
      td.innerHTML = e.stats?.[s] !== undefined
        ? `<span style="opacity:0.4">${e.stats[s]}</span>`
        : '<span style="opacity:0.25">—</span>';
      tr.appendChild(td);
    });
    fragment.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(fragment);
}

// ── Process data ──────────────────────────────────────────────────────────────
function processTrainers(trainersData) {
  const lowerName = catchmonName.toLowerCase();
  const caughtEntries = [];
  catcherDonations = {};

  Object.entries(trainersData).forEach(([catcher, info]) => {
    catcherDonations[catcher] = info.donation || 0;
    const team = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
    team.forEach(p => {
      if (p.name && p.name.toLowerCase() === lowerName) {
        caughtEntries.push({ ...p, catcher });
      }
    });
  });

  allEntries = caughtEntries;
  updateSummary();
  renderTable();
}

function processEscaped(escapedData) {
  const lowerName = catchmonName.toLowerCase();
  escapedEntries = [];
  if (!escapedData) { renderTable(); return; }
  const entries = typeof escapedData === 'object' ? Object.values(escapedData) : [];
  escapedEntries = entries
    .filter(e => e?.name && e.name.toLowerCase() === lowerName)
    .sort((a, b) => (b.escaped_at || 0) - (a.escaped_at || 0));
  updateSummary();
  renderTable();
}

// ── Summary in English ────────────────────────────────────────────────────────
function updateSummary() {
  if (isGodMode) return;
  const trainerCount = new Set(allEntries.map(e => e.catcher)).size;
  document.getElementById("summary").textContent =
    `${allEntries.length} caught · ${trainerCount} trainer${trainerCount !== 1 ? 's' : ''} · ${escapedEntries.length} escaped`;
}

// ── Header ────────────────────────────────────────────────────────────────────
function setupHeader() {
  const lowerName = catchmonName.toLowerCase();
  const dexEntry  = dexList.find(p => p.name.toLowerCase() === lowerName);
  const sprite    = dexEntry?.sprite || "";

  if (isGodCatchmon(sprite)) {
    isGodMode = true;
    document.body.classList.add('god-mode');
    document.getElementById("catchTitle").textContent = "#??? ??? ??? ???";
    document.getElementById("summary").textContent    = "█ CLASSIFIED / █ CLASSIFIED";
  } else {
    document.getElementById("catchTitle").textContent =
      `#${String(dexEntry?.id || "").padStart(3,"0")} ${capitalize(catchmonName)}`;
  }

  const imgEl = document.getElementById("catchImg");
  imgEl.src = sprite;
  imgEl.alt = escapeHtml(catchmonName);
}

// ── Firebase ──────────────────────────────────────────────────────────────────
onValue(ref(db, 'trainers'), snap => {
  const data = snap.val() || {};
  if (catchmonName && dexList.length > 0) processTrainers(data);
  else if (catchmonName) pendingTrainers = data;
});

onValue(ref(db, 'escaped'), snap => {
  const data = snap.val();
  if (catchmonName && dexList.length > 0) processEscaped(data);
  else if (catchmonName) pendingEscaped = data;
}, err => console.error('Firebase escaped error:', err));

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  if (!catchmonName) return;
  try {
    const res = await fetch("dex_list.json?" + Date.now());
    dexList = await res.json();
    setupHeader();
    if (pendingTrainers) { processTrainers(pendingTrainers); pendingTrainers = null; }
    if (pendingEscaped)  { processEscaped(pendingEscaped);  pendingEscaped  = null; }
  } catch (err) {
    console.error("Error loading dex list:", err);
    document.getElementById("catchTitle").textContent = "Error loading data";
  }
}

init();
document.getElementById('caughtOnly').addEventListener('change', renderTable);
console.log('🔥 Dex Detail loaded');