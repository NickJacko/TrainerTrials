// assets/js/pages/catchdex_catcher.js
import { db } from '../firebase.client.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// ── Reveal ────────────────────────────────────────────────────────────────────
const observer = new IntersectionObserver(entries => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('in'), i * 80);
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.06 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeHtml(input) {
  const s = String(input ?? "");
  return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
function validateTrainerName(name) {
  if (!name) return null;
  const cleaned = name.trim().slice(0, 60);
  if (!/^[\w\s\-]+$/.test(cleaned)) return null;
  return cleaned;
}
function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }
function getDonationTier(donation) {
  if (donation >= 2500) return 'king';
  if (donation >= 500)  return 'flame';
  if (donation >= 250)  return 'diamond';
  if (donation >= 50)   return 'shine';
  return 'normal';
}

const rawName     = new URLSearchParams(window.location.search).get("name");
const trainerName = validateTrainerName(rawName);

const rarityOrder  = ["Starter", "Common", "Rare", "Legendary", "Mythical", "God"];
const rarityEmojis = { "Starter":"🌱", "Common":"⚪", "Rare":"🔵", "Legendary":"🟡", "Mythical":"🟣", "God":"⚫" };

// ── Title ─────────────────────────────────────────────────────────────────────
function setTitle(trainer, donation) {
  const el = document.getElementById("catcherTitle");
  el.textContent = '';
  el.appendChild(document.createTextNode('📘 '));
  const span = document.createElement('span');
  span.className = `catcher-name ${getDonationTier(donation)}`;
  span.textContent = capitalize(trainer);
  el.appendChild(span);
  el.appendChild(document.createTextNode("'s Catchdex"));
}

// ── Rarity Section Builder ────────────────────────────────────────────────────
function buildRaritySection(rarity, pokemons, caughtCount) {
  if (pokemons.length === 0) return null;

  const section = document.createElement('div');
  section.className = `rarity-section ${rarity.toLowerCase()} reveal`;

  const header = document.createElement('div');
  header.className = 'rarity-header';

  const title = document.createElement('h2');
  title.className = 'rarity-title';
  title.textContent = `${rarityEmojis[rarity] || '❓'} ${rarity}`;

  // Caught count in this rarity
  const totalInRarity  = pokemons.length;
  const caughtInRarity = pokemons.filter(p => p.name.toLowerCase() in caughtCount).length;

  const count = document.createElement('div');
  count.className = 'rarity-count';
  count.textContent = `${caughtInRarity} / ${totalInRarity}`;

  header.append(title, count);

  const grid = document.createElement('div');
  grid.className = 'dex-grid';

  pokemons.forEach(p => {
    const nameLower = p.name.toLowerCase();
    const caught    = nameLower in caughtCount;
    const copies    = caughtCount[nameLower] || 0;
    const star      = copies >= 3;
    const isGod     = rarity === "God";
    const id        = String(p.id).padStart(3, "0");
    const safeName  = capitalize(p.name).replace(/ /g, "_");

    const card = document.createElement('div');
    card.className = 'catchmon-card' + (caught ? '' : ' uncaught');

    if (star) {
      const starEl = document.createElement('div');
      starEl.className = 'star'; starEl.textContent = '★';
      card.appendChild(starEl);
    }

    const link = document.createElement('a');
    link.href = `dex_detail.html?name=${encodeURIComponent(safeName)}`;

    const img = document.createElement('img');
    img.src = escapeHtml(p.sprite);
    img.alt = isGod ? '???' : escapeHtml(capitalize(p.name));
    img.loading = 'lazy';
    img.onerror = function() { this.style.display = 'none'; };

    const idName = document.createElement('div');
    idName.className = 'id-name';
    idName.textContent = `#${isGod ? '???' : id}\n${isGod ? '??? ??? ???' : capitalize(p.name)}`;

    link.append(img, idName);
    card.appendChild(link);
    grid.appendChild(card);
  });

  section.append(header, grid);
  return section;
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────
function buildStatsBar(dexList, caught) {
  const total      = dexList.length;
  const caughtCount = Object.keys(caught).length;
  const pct        = total > 0 ? Math.round((caughtCount / total) * 100) : 0;

  const existing = document.getElementById('dexStatsBar');
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.id = 'dexStatsBar';
  bar.style.cssText = `
    background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
    border-radius:14px;padding:14px 18px;margin-bottom:20px;
    display:flex;align-items:center;justify-content:space-between;gap:16px;
  `;

  const left = document.createElement('div');
  left.style.cssText = 'font-size:0.85rem;color:rgba(255,255,255,0.5);';
  left.innerHTML = `<span style="color:white;font-weight:800;font-size:1rem;">${caughtCount}</span> / ${total} caught`;

  const trackWrap = document.createElement('div');
  trackWrap.style.cssText = 'flex:1;background:rgba(255,255,255,0.07);border-radius:4px;height:6px;overflow:hidden;';
  const fill = document.createElement('div');
  fill.style.cssText = `height:100%;border-radius:4px;background:linear-gradient(90deg,#4ECDC4,#667eea);width:0%;transition:width 1s ease;`;
  trackWrap.appendChild(fill);
  setTimeout(() => { fill.style.width = pct + '%'; }, 300);

  const right = document.createElement('div');
  right.style.cssText = 'font-size:1rem;font-weight:900;color:#FFD700;min-width:40px;text-align:right;';
  right.textContent = pct + '%';

  bar.append(left, trackWrap, right);
  return bar;
}

// ── Load ──────────────────────────────────────────────────────────────────────
async function loadCatchdex(trainer) {
  const container = document.getElementById("dexContainer");

  try {
    const res     = await fetch("dex_list.json?" + Date.now());
    const dexList = await res.json();

    onValue(ref(db, 'trainers'), snap => {
      const data        = snap.val() || {};
      const trainerData = data[trainer];

      // ── Trainer nicht in Firebase — leeres Dex anzeigen ──────────────────
      const team = trainerData
        ? (Array.isArray(trainerData.team)
            ? trainerData.team.filter(Boolean)
            : Object.values(trainerData.team || {}).filter(Boolean))
        : [];

      const donation = trainerData?.donation || 0;
      setTitle(trainer, donation);

      // Caught-Map aufbauen
      const caught = {};
      team.forEach(mon => {
        if (!mon?.name) return;
        const key = mon.name.toLowerCase();
        caught[key] = (caught[key] || 0) + 1;
      });

      // Dex nach Rarity gruppieren
      const byRarity = {};
      rarityOrder.forEach(r => byRarity[r] = []);
      dexList.forEach(mon => {
        const rarity = mon.sprite.split("/")[1] || "Common";
        (byRarity[rarity] || byRarity["Common"]).push(mon);
      });
      rarityOrder.forEach(r => { if (byRarity[r]) byRarity[r].sort((a,b) => a.id - b.id); });

      container.innerHTML = '';

      // Stats-Bar oben
      const statsBar = buildStatsBar(dexList, caught);
      container.appendChild(statsBar);

      // Hinweis wenn noch keine Catches
      if (team.length === 0) {
        const hint = document.createElement('div');
        hint.style.cssText = `
          text-align:center;padding:20px;margin-bottom:24px;
          background:rgba(78,205,196,0.06);border:1px solid rgba(78,205,196,0.15);
          border-radius:12px;font-size:0.85rem;color:rgba(255,255,255,0.4);
        `;
        hint.innerHTML = '🎯 No catches yet — all Catchmon shown as <strong style="color:rgba(255,255,255,0.6)">undiscovered</strong>';
        container.appendChild(hint);
      }

      // Rarity Sections
      rarityOrder.forEach(r => {
        const section = buildRaritySection(r, byRarity[r] || [], caught);
        if (section) {
          container.appendChild(section);
          observer.observe(section);
        }
      });
    });

  } catch (err) {
    console.error('Error loading catchdex:', err);
    container.innerHTML = '<div class="error-message">Error loading data. Please try again.</div>';
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
if (!trainerName) {
  document.getElementById("dexContainer").innerHTML = '<div class="error-message">Invalid or missing trainer name.</div>';
  document.getElementById("catcherTitle").textContent = "📘 Unknown Trainer\'s Catchdex";
} else {
  loadCatchdex(trainerName.toLowerCase());
}

console.log('📘 Catchdex Catcher loaded');