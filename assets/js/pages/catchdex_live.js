// assets/js/pages/catchdex_live.js
import { db } from '../firebase.client.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const rarityOrder = ["Starter", "Common", "Rare", "Legendary", "Mythical", "God"];
const rarityEmojis = { "Starter": "🌱", "Common": "⚪", "Rare": "🔵", "Legendary": "🟡", "Mythical": "🟣", "God": "⚫" };

let dexList = [];
let enabledGens = new Set();
let seenData = {};

function escapeHtml(input) {
  const s = String(input ?? "");
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
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

  let cardsHtml = '';
  pokemons.forEach(p => {
    const name = p.name.toLowerCase();
    const escaped = seenData[name]?.escaped || 0;
    const caught = seenData[name]?.caught || 0;
    const id = String(p.id).padStart(3, "0");
    const displayName = rarity === "God" ? "??? ??? ???" : escapeHtml(capitalize(p.name));
    const displayId = rarity === "God" ? "???" : id;
    const safeName = capitalize(p.name).replace(/ /g, "_");

    cardsHtml += `
      <div class="card">
        <a href="dex_detail.html?name=${encodeURIComponent(safeName)}">
          <img src="${escapeHtml(p.sprite)}" alt="${escapeHtml(capitalize(p.name))}">
          <div class="id-name">#${displayId}<br>${displayName}</div>
          <div class="stats">${escaped} escaped / ${caught} caught</div>
        </a>
      </div>
    `;
  });

  return `
    <div class="rarity-section ${rarityClass}">
      <div class="rarity-header">
        <h2 class="rarity-title">${emoji} ${rarity}</h2>
        <div class="rarity-count">${pokemons.length} Catchmon</div>
      </div>
      <div class="grid">${cardsHtml}</div>
    </div>
  `;
}

function renderDex() {
  const container = document.getElementById("dexContainer");
  const filtered = dexList.filter(p => enabledGens.has(p.gen)).sort((a, b) => a.id - b.id);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div>No Catchmon found</div></div>';
    return;
  }

  const byRarity = {};
  rarityOrder.forEach(r => byRarity[r] = []);
  filtered.forEach(p => {
    const parts = p.sprite.split("/");
    const rarity = parts.length > 1 ? parts[1] : "Common";
    (byRarity[rarity] || byRarity["Common"]).push(p);
  });
  rarityOrder.forEach(r => { if (byRarity[r]) byRarity[r].sort((a, b) => a.id - b.id); });
  container.innerHTML = rarityOrder.map(r => buildRaritySection(r, byRarity[r] || [])).join('');
}

async function loadStaticData() {
  try {
    const [dexRes, genRes] = await Promise.all([
      fetch("dex_list.json?" + Date.now()),
      fetch("gen_config.json?" + Date.now())
    ]);
    dexList = await dexRes.json();
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
console.log("📘 Catchdex loaded — Firebase realtime active");