// assets/js/pages/catchdex_live.js
import { db } from '../firebase.client.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const rarityOrder  = ["Starter", "Common", "Rare", "Legendary", "Mythical", "God"];
const rarityEmojis = { "Starter":"🌱", "Common":"⚪", "Rare":"🔵", "Legendary":"🟡", "Mythical":"🟣", "God":"⚫" };

let dexList     = [];
let enabledGens = new Set();
let myTeamNames = new Set();

let escapedCounts = {};
let caughtCounts  = {};

// ── Reveal ────────────────────────────────────────────────────────────────────
const revealObs = new IntersectionObserver(entries => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('in'), i * 60);
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.05 });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSavedTrainer() {
  try { return localStorage.getItem('catchmon_trainer_name') || null; } catch { return null; }
}
function escapeHtml(input) {
  const s = String(input ?? "");
  return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

// ── Search ────────────────────────────────────────────────────────────────────
function filterDex() {
  const input = document.getElementById("searchInput").value.toLowerCase();
  document.querySelectorAll(".rarity-section").forEach(section => {
    const cards = section.querySelectorAll(".card");
    let hasVisible = false;
    cards.forEach(card => {
      const visible = card.innerText.toLowerCase().includes(input);
      card.style.display = visible ? "" : "none";
      if (visible) hasVisible = true;
    });
    section.style.display = hasVisible ? "" : "none";
  });
}

// ── Build Section ─────────────────────────────────────────────────────────────
function buildRaritySection(rarity, pokemons) {
  if (pokemons.length === 0) return null;

  const section = document.createElement('div');
  section.className = `rarity-section ${rarity.toLowerCase()}`;

  // Count how many are caught vs total in this rarity
  const totalInRarity  = pokemons.length;
  const caughtInRarity = pokemons.filter(p => (caughtCounts[p.name.toLowerCase()] || 0) > 0).length;

  const header = document.createElement('div');
  header.className = 'rarity-header';
  const title = document.createElement('div');
  title.className = 'rarity-title';
  title.textContent = `${rarityEmojis[rarity] || '❓'} ${rarity}`;
  const count = document.createElement('div');
  count.className = 'rarity-count';
  // Show caught/total in header
  count.innerHTML = `<span style="color:rgba(255,255,255,0.8);font-weight:800;">${caughtInRarity}</span><span style="opacity:0.4"> / ${totalInRarity}</span>`;
  header.append(title, count);
  section.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'grid';

  pokemons.forEach(p => {
    const nameLower = p.name.toLowerCase();
    const escaped   = escapedCounts[nameLower] || 0;
    const caught    = caughtCounts[nameLower]  || 0;
    const id        = String(p.id).padStart(3, "0");
    const isGod     = rarity === "God";
    const isMe      = myTeamNames.has(nameLower);

    // ── uncaught if nobody has caught this catchmon yet ──────────────────────
    const neverCaught = caught === 0;

    const card = document.createElement('div');
    // Add 'uncaught' class if never caught by anyone
    card.className = 'card' + (isMe ? ' my-card' : '') + (neverCaught ? ' uncaught' : '');

    if (isMe) {
      const badge = document.createElement('span');
      badge.className = 'you-card-badge';
      badge.textContent = 'YOU';
      card.appendChild(badge);
    }

    // First-catch badge — show if caught but escaped > 0 (rare achievement)
    if (!neverCaught && caught === 1 && escaped > 5) {
      const rare = document.createElement('span');
      rare.style.cssText = 'position:absolute;top:4px;left:4px;font-size:9px;font-weight:800;color:#FFD700;letter-spacing:0.5px;text-shadow:0 0 8px rgba(255,215,0,0.6);';
      rare.textContent = '★ RARE';
      card.style.position = 'relative';
      card.appendChild(rare);
    }

    const link = document.createElement('a');
    link.href = `dex_detail.html?name=${encodeURIComponent(capitalize(p.name).replace(/ /g,"_"))}`;

    const img = document.createElement('img');
    img.src     = escapeHtml(p.sprite);
    img.alt     = isGod ? "???" : escapeHtml(capitalize(p.name));
    img.width   = 110; img.height = 110;
    img.loading = 'lazy';
    img.onerror = function() { this.style.display = 'none'; };

    const idName = document.createElement('div');
    idName.className = 'id-name';
    // Hide name for god rarity AND for never-caught (mystery)
    if (isGod) {
      idName.textContent = `#???\n??? ??? ???`;
    } else if (neverCaught) {
      idName.textContent = `#${id}\n${capitalize(p.name)}`;
    } else {
      idName.textContent = `#${id}\n${capitalize(p.name)}`;
    }

    const stats = document.createElement('div');
    stats.className = 'stats';
    if (isGod) {
      stats.textContent = "██ ██ / ██ ██";
    } else if (neverCaught) {
      // Show escaped count but not caught
      stats.textContent = escaped > 0 ? `${escaped} escaped / not caught yet` : 'Not caught yet';
      stats.style.color = 'rgba(255,255,255,0.3)';
    } else {
      stats.textContent = `${escaped} escaped / ${caught} caught`;
    }

    link.append(img, idName, stats);
    card.appendChild(link);
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderDex() {
  const container = document.getElementById("dexContainer");
  const filtered  = dexList.filter(p => enabledGens.has(p.gen)).sort((a, b) => a.id - b.id);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="loading"><div class="spinner"></div><div>No Catchmon found</div></div>';
    return;
  }

  const byRarity = {};
  rarityOrder.forEach(r => byRarity[r] = []);
  filtered.forEach(p => {
    const rarity = p.sprite.split("/")[1] || "Common";
    (byRarity[rarity] || byRarity["Common"]).push(p);
  });
  rarityOrder.forEach(r => { if (byRarity[r]) byRarity[r].sort((a,b) => a.id - b.id); });

  container.innerHTML = '';
  rarityOrder.forEach(r => {
    if (byRarity[r]?.length > 0) {
      const section = buildRaritySection(r, byRarity[r]);
      if (section) {
        container.appendChild(section);
        revealObs.observe(section);
      }
    }
  });
}

// ── Count helpers ─────────────────────────────────────────────────────────────
function buildEscapedCounts(escapedData) {
  const counts = {};
  if (!escapedData) return counts;
  const entries = typeof escapedData === 'object' ? Object.values(escapedData) : [];
  entries.forEach(e => {
    if (!e?.name) return;
    const key = e.name.toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function buildCaughtCounts(trainersData) {
  const counts = {};
  if (!trainersData) return counts;
  Object.values(trainersData).forEach(trainer => {
    const team = Array.isArray(trainer.team)
      ? trainer.team
      : Object.values(trainer.team || {});
    team.forEach(catchmon => {
      if (!catchmon?.name) return;
      const key = catchmon.name.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  return counts;
}

// ── Load Static ───────────────────────────────────────────────────────────────
async function loadStaticData() {
  try {
    const [dexRes, genRes] = await Promise.all([
      fetch("dex_list.json?" + Date.now()),
      fetch("gen_config.json?" + Date.now())
    ]);
    dexList     = await dexRes.json();
    const cfg   = await genRes.json();
    enabledGens = new Set(cfg.enabled_gens || []);
  } catch (err) {
    console.error("Error loading static data:", err);
    document.getElementById("dexContainer").innerHTML =
      '<div class="loading"><div class="spinner"></div><div>Error loading data</div></div>';
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await loadStaticData();

  const savedTrainer = getSavedTrainer();

  if (savedTrainer) {
    onValue(ref(db, `trainers/${savedTrainer.toLowerCase()}`), snap => {
      const info = snap.val();
      myTeamNames = info
        ? new Set((Array.isArray(info.team) ? info.team : Object.values(info.team || {}))
            .map(c => c.name?.toLowerCase()).filter(Boolean))
        : new Set();
      renderDex();
    });
  }

  onValue(ref(db, 'escaped'), snap => {
    escapedCounts = buildEscapedCounts(snap.val());
    renderDex();
  }, err => console.error('Firebase escaped error:', err));

  onValue(ref(db, 'trainers'), snap => {
    caughtCounts = buildCaughtCounts(snap.val());
    renderDex();
  }, err => console.error('Firebase trainers error:', err));
}

init();
document.getElementById('searchInput').addEventListener('keyup', filterDex);
console.log("📘 Catchdex Live loaded");