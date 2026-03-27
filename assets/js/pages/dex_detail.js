// assets/js/pages/dex_detail.js
import { db } from '../firebase.client.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const statsOrder = ["ATK", "DEF", "SPD", "WIS", "CHA", "LUK"];
let allEntries = [];
let catcherDonations = {};
let dexList = [];
let isGodMode = false;
let pendingTrainers = null;

function escapeHtml(input) {
  const s = String(input ?? "");
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function validateCatchmonName(name) {
  if (!name) return null;
  const cleaned = name.trim().slice(0, 60);
  if (!/^[\w\s\-]+$/.test(cleaned)) return null;
  return cleaned;
}

const rawName = new URLSearchParams(window.location.search).get("name");
const catchmonName = validateCatchmonName(rawName);

if (!catchmonName) {
  document.getElementById("catchTitle").textContent = "Invalid Catchmon name.";
  document.getElementById("summary").textContent = "";
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function sumStats(stats) { return Object.values(stats || {}).reduce((a, b) => a + (b || 0), 0); }

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

function isGodCatchmon(sprite) { return sprite && sprite.includes('/God/'); }

function renderTable() {
  const tbody = document.querySelector("#dataTable tbody");
  const showCaughtOnly = document.getElementById("caughtOnly").checked;

  if (allEntries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="loading"><div class="loading-spinner"></div><div>No data available</div></td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();

  allEntries
    .filter(e => !showCaughtOnly || e.catcher)
    .sort((a, b) => calcPoints(b) - calcPoints(a))
    .forEach(e => {
      const tr = document.createElement("tr");

      const tdCatcher = document.createElement('td');
      if (!e.catcher) {
        tdCatcher.textContent = "❌";
      } else if (isGodMode) {
        const span = document.createElement('span');
        span.style.color = '#9370DB';
        span.textContent = '█████';
        tdCatcher.appendChild(span);
      } else {
        const tier = getDonationTier(catcherDonations[e.catcher] || 0);
        if (tier !== "normal") {
          const span = document.createElement('span');
          span.className = `catcher-name ${tier}`;
          span.textContent = capitalize(e.catcher);
          tdCatcher.appendChild(span);
        } else {
          tdCatcher.textContent = capitalize(e.catcher);
        }
      }

      const tdPoints = document.createElement('td');
      tdPoints.textContent = calcPoints(e).toLocaleString('de-DE');

      const tdLevel = document.createElement('td');
      tdLevel.textContent = e.level || 1;

      const tdShiny = document.createElement('td');
      tdShiny.textContent = e.shiny ? "✨" : "";

      const tdSum = document.createElement('td');
      tdSum.textContent = sumStats(e.stats).toLocaleString('de-DE');

      tr.append(tdCatcher, tdPoints, tdLevel, tdShiny, tdSum);

      statsOrder.forEach(s => {
        const td = document.createElement('td');
        td.textContent = e.stats?.[s] ?? 0;
        tr.appendChild(td);
      });

      fragment.appendChild(tr);
    });

  tbody.innerHTML = '';
  tbody.appendChild(fragment);
}

function processData(trainersData) {
  const lowerName = catchmonName.toLowerCase();
  const entries = [];
  catcherDonations = {};

  Object.entries(trainersData).forEach(([catcher, info]) => {
    catcherDonations[catcher] = info.donation || 0;
    const team = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
    team.forEach(p => {
      if (p.name && p.name.toLowerCase() === lowerName) {
        entries.push({ ...p, catcher });
      }
    });
  });

  const dexEntry = dexList.find(p => p.name.toLowerCase() === lowerName);
  const sprite = dexEntry?.sprite || "";

  if (isGodCatchmon(sprite)) {
    isGodMode = true;
    document.body.classList.add('god-mode');
    document.getElementById("catchTitle").textContent = "#??? ??? ??? ???";
    document.getElementById("summary").textContent = "█ CLASSIFIED / █ CLASSIFIED";
  } else {
    document.getElementById("catchTitle").textContent =
      `#${String(dexEntry?.id || "").padStart(3, "0")} ${capitalize(catchmonName)}`;
    document.getElementById("summary").textContent = `${entries.length} caught`;
  }

  const imgEl = document.getElementById("catchImg");
  imgEl.src = sprite;
  imgEl.alt = escapeHtml(catchmonName);

  allEntries = entries;
  renderTable();
}

// Firebase listeners
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
  if (catchmonName && dexList.length > 0) processData(trainersData);
  else if (catchmonName) pendingTrainers = trainersData;
});

async function init() {
  if (!catchmonName) return;
  try {
    const res = await fetch("dex_list.json?" + Date.now());
    dexList = await res.json();
    if (pendingTrainers) {
      processData(pendingTrainers);
      pendingTrainers = null;
    }
  } catch (err) {
    console.error("Error loading dex list:", err);
    document.getElementById("catchTitle").textContent = "Error loading data";
  }
}

init();
document.getElementById('caughtOnly').addEventListener('change', renderTable);
console.log('🔥 Dex Detail loaded — XSS-safe, Firebase realtime');