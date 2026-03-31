// assets/js/pages/catchdex_live.js
import { db } from '../firebase.client.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const rarityOrder  = ["Starter", "Common", "Rare", "Legendary", "Mythical", "God"];
const rarityEmojis = { "Starter":"🌱", "Common":"⚪", "Rare":"🔵", "Legendary":"🟡", "Mythical":"🟣", "God":"⚫" };

let dexList    = [];
let enabledGens = new Set();
let seenData   = {};
let myTeamNames = new Set(); // Namen des eigenen Teams

function getSavedTrainer() {
  try { return localStorage.getItem('catchmon_trainer_name') || null; }
  catch { return null; }
}

function escapeHtml(input) {
  const s = String(input ?? "");
  return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

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

function buildRaritySection(rarity, pokemons) {
  if (pokemons.length === 0) return '';
  const rarityClass = rarity.toLowerCase();
  const emoji = rarityEmojis[rarity] || "❓";

  const section = document.createElement('div');
  section.className = `rarity-section ${rarityClass}`;

  const header = document.createElement('div');
  header.className = 'rarity-header';
  header.innerHTML = `<h2 class="rarity-title">${emoji} ${rarity}</h2><div class="rarity-count">${pokemons.length} Catchmon</div>`;
  section.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'grid';

  pokemons.forEach(p => {
    const nameLower = p.name.toLowerCase();
    const escaped   = seenData[nameLower]?.escaped || 0;
    const caught    = seenData[nameLower]?.caught  || 0;
    const id        = String(p.id).padStart(3, "0");
    const isGod     = rarity === "God";
    const isMe      = myTeamNames.has(nameLower);

    const card = document.createElement('div');
    card.className = 'card' + (isMe ? ' my-card' : '');

    // YOU badge
    if (isMe) {
      const badge = document.createElement('span');
      badge.className = 'you-card-badge';
      badge.textContent = 'YOU';
      card.appendChild(badge);
    }

    const link = document.createElement('a');
    link.href = `dex_detail.html?name=${encodeURIComponent(capitalize(p.name).replace(/ /g,"_"))}`;

    const img = document.createElement('img');
    img.src    = escapeHtml(p.sprite);
    img.alt    = isGod ? "???" : escapeHtml(capitalize(p.name));
    img.width  = 115; img.height = 115;
    img.loading = 'lazy';
    img.onerror = function() { this.style.display = 'none'; };

    const idName = document.createElement('div');
    idName.className = 'id-name';
    idName.textContent = `#${isGod ? "???" : id}\n${isGod ? "??? ??? ???" : capitalize(p.name)}`;

    const stats = document.createElement('div');
    stats.className = 'stats';
    stats.textContent = isGod ? "██ ██ / ██ ██" : `${escaped} escaped / ${caught} caught`;

    link.append(img, idName, stats);
    card.appendChild(link);
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

function renderDex() {
  const container = document.getElementById("dexContainer");
  const filtered  = dexList.filter(p => enabledGens.has(p.gen)).sort((a, b) => a.id - b.id);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div>No Catchmon found</div></div>';
    return;
  }

  const byRarity = {};
  rarityOrder.forEach(r => byRarity[r] = []);
  filtered.forEach(p => {
    const parts  = p.sprite.split("/");
    const rarity = parts.length > 1 ? parts[1] : "Common";
    (byRarity[rarity] || byRarity["Common"]).push(p);
  });
  rarityOrder.forEach(r => { if (byRarity[r]) byRarity[r].sort((a,b) => a.id - b.id); });

  container.innerHTML = '';
  rarityOrder.forEach(r => {
    if (byRarity[r]?.length > 0) {
      container.appendChild(buildRaritySection(r, byRarity[r]));
    }
  });
}

async function loadStaticData() {
  try {
    const [dexRes, genRes] = await Promise.all([
      fetch("dex_list.json?" + Date.now()),
      fetch("gen_config.json?" + Date.now())
    ]);
    dexList     = await dexRes.json();
    const genConfig = await genRes.json();
    enabledGens = new Set(genConfig.enabled_gens || []);
  } catch (err) {
    console.error("Error loading static data:", err);
    document.getElementById("dexContainer").innerHTML =
      '<div class="loading"><div class="loading-spinner"></div><div>Error loading data</div></div>';
  }
}

async function init() {
  await loadStaticData();

  // Eigenes Team laden für Highlighting
  const savedTrainer = getSavedTrainer();
  if (savedTrainer) {
    onValue(ref(db, `trainers/${savedTrainer.toLowerCase()}`), snap => {
      const info = snap.val();
      if (info) {
        const team = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
        myTeamNames = new Set(team.map(c => c.name?.toLowerCase()).filter(Boolean));
      } else {
        myTeamNames = new Set();
      }
      // Nach Laden neu rendern
      renderDex();
    });
  }

  // Dex-Statistiken (seen/caught)
  onValue(ref(db, 'dex/seen_caught'), (snapshot) => {
    seenData = snapshot.val() || {};
    renderDex();
  }, (error) => {
    console.error('Firebase error:', error);
    renderDex();
  });
}

init();
document.getElementById('searchInput').addEventListener('keyup', filterDex);
console.log("📘 Catchdex loaded — my-card highlight, trainer widget");