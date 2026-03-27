// assets/js/pages/catchdex_catcher.js
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

const rarityOrder = ["Starter", "Common", "Rare", "Legendary", "Mythical", "God"];
const rarityEmojis = { "Starter": "🌱", "Common": "⚪", "Rare": "🔵", "Legendary": "🟡", "Mythical": "🟣", "God": "⚫" };

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function getDonationTier(donation) {
  if (donation >= 1000) return 'king';
  if (donation >= 500) return 'flame';
  if (donation >= 250) return 'diamond';
  if (donation >= 100) return 'shine';
  return 'normal';
}

function setTitle(trainer, donation) {
  const titleEl = document.getElementById("catcherTitle");
  titleEl.textContent = '';
  titleEl.appendChild(document.createTextNode('📘 '));
  const tier = getDonationTier(donation);
  const nameSpan = document.createElement('span');
  nameSpan.className = `catcher-name ${tier}`;
  nameSpan.textContent = capitalize(trainer);
  titleEl.appendChild(nameSpan);
  titleEl.appendChild(document.createTextNode("'s Catchdex"));
}

function buildRaritySection(rarity, pokemons, caughtCount) {
  if (pokemons.length === 0) return '';
  const rarityClass = rarity.toLowerCase();
  const emoji = rarityEmojis[rarity] || "❓";

  let cardsHtml = '';
  pokemons.forEach(p => {
    const name = p.name.toLowerCase();
    const caught = name in caughtCount;
    const count = caughtCount[name] || 0;
    const star = count >= 3;
    const id = String(p.id).padStart(3, "0");
    const displayName = rarity === "God" ? "??? ??? ???" : escapeHtml(capitalize(p.name));
    const displayId = rarity === "God" ? "???" : id;
    const safeName = capitalize(p.name).replace(/ /g, "_");

    cardsHtml += `
      <div class="catchmon-card${caught ? "" : " uncaught"}">
        <a href="dex_detail.html?name=${encodeURIComponent(safeName)}">
          <img src="${escapeHtml(p.sprite)}" alt="${escapeHtml(capitalize(p.name))}" loading="lazy">
          <div class="id-name">#${displayId}<br>${displayName}</div>
          ${star ? '<div class="star">★</div>' : ''}
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
      <div class="dex-grid">${cardsHtml}</div>
    </div>
  `;
}

async function loadCatchdex(trainer) {
  const container = document.getElementById("dexContainer");
  const titleEl = document.getElementById("catcherTitle");

  try {
    const dexRes = await fetch("dex_list.json?" + Date.now());
    const dexList = await dexRes.json();

    onValue(ref(db, 'trainers'), (snapshot) => {
      const trainersData = snapshot.val() || {};
      const trainerData = trainersData[trainer];

      if (!trainerData) {
        titleEl.textContent = `📘 ${capitalize(trainer)}'s Catchdex`;
        container.innerHTML = '<div class="error-message">Trainer not found.</div>';
        return;
      }

      const team = Array.isArray(trainerData.team) ? trainerData.team : Object.values(trainerData.team || {});
      const donation = trainerData.donation || 0;
      const caughtCount = {};
      team.forEach(mon => {
        const monName = mon.name.toLowerCase();
        caughtCount[monName] = (caughtCount[monName] || 0) + 1;
      });

      setTitle(trainer, donation);

      const byRarity = {};
      rarityOrder.forEach(r => byRarity[r] = []);
      dexList.forEach(mon => {
        const parts = mon.sprite.split("/");
        const rarity = parts.length > 1 ? parts[1] : "Common";
        (byRarity[rarity] || byRarity["Common"]).push(mon);
      });
      rarityOrder.forEach(r => { if (byRarity[r]) byRarity[r].sort((a, b) => a.id - b.id); });

      container.innerHTML = rarityOrder.map(r => buildRaritySection(r, byRarity[r] || [], caughtCount)).join('');
    });

  } catch (error) {
    console.error('Error loading catchdex:', error);
    titleEl.textContent = `📘 ${capitalize(trainer)}'s Catchdex`;
    container.innerHTML = '<div class="error-message">Error loading data. Please try again later.</div>';
  }
}

// Background effects
let backgroundElements = [];
const maxElements = 8;

function createFloatingElement() {
  if (backgroundElements.length >= maxElements) return;
  const elements = ['🏆', '🥇', '👑', '⭐', '💎', '🔥', '⚡'];
  const el = document.createElement('div');
  el.className = 'floating-element';
  el.textContent = elements[Math.floor(Math.random() * elements.length)];
  el.style.left = Math.random() * 100 + '%';
  el.style.animationDuration = (Math.random() * 4 + 8) + 's';
  el.style.animationDelay = Math.random() * 2 + 's';
  document.getElementById('bgEffects').appendChild(el);
  backgroundElements.push(el);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); backgroundElements = backgroundElements.filter(e => e !== el); }, 12000);
}

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let lastTime = 0;
  function animate() {
    const now = Date.now();
    if (now - lastTime > 3000) { createFloatingElement(); lastTime = now; }
    requestAnimationFrame(animate);
  }
  animate();
  for (let i = 0; i < 3; i++) setTimeout(createFloatingElement, i * 1000);
}

// Init
if (!trainerName) {
  document.getElementById("dexContainer").innerHTML = '<div class="error-message">Invalid or missing trainer name.</div>';
  document.getElementById("catcherTitle").textContent = "📘 Unknown Trainer's Catchdex";
} else {
  loadCatchdex(trainerName.toLowerCase());
}

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW registration failed:', err));
  });
}

console.log('📘 Catchdex loaded — XSS-safe, Firebase v10 modular');