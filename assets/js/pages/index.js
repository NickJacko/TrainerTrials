// assets/js/pages/index.js
import { db } from '../firebase.client.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
function getDonationTier(d) {
  if (d >= 2500) return 'god'; if (d >= 500) return 'king';
  if (d >= 250)  return 'diamond'; if (d >= 100) return 'flame';
  if (d >= 50)   return 'shine'; return 'normal';
}
function buildNameEl(name, donation) {
  const span = document.createElement('span');
  span.className = `catcher-name ${getDonationTier(donation)}`;
  span.textContent = name;
  return span;
}
function fmt(num) {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000)     return (num / 1_000).toFixed(1) + 'K';
  return String(num);
}
function calcPts(c) {
  if (!c) return 0;
  const stats = c.stats || {};
  let p = (c.level || 1) * 10 + Object.values(stats).reduce((a,b) => a + (b||0), 0);
  p *= { Common:1, Uncommon:1.2, Rare:1.5, Epic:2, Legendary:3, Mythical:4 }[c.rarity || 'Common'] || 1;
  if (c.shiny) p *= 1.5;
  return Math.floor(p);
}
function calcTeamPts(team) {
  if (!team) return 0;
  return (Array.isArray(team) ? team : Object.values(team)).reduce((s,c) => s + calcPts(c), 0);
}
function rarityClass(rarity) { return 'r-' + (rarity || 'common').toLowerCase(); }
function capitalize(s) { return String(s ?? "").charAt(0).toUpperCase() + String(s ?? "").slice(1); }
function getSavedTrainer() { try { return localStorage.getItem('catchmon_trainer_name') || null; } catch { return null; } }

// ── Reveal on scroll ──────────────────────────────────────────────────────────
const revealEls = document.querySelectorAll('.reveal');
const observer  = new IntersectionObserver(entries => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('in'), i * 80);
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.06 });
revealEls.forEach(el => observer.observe(el));

// ── Connection ────────────────────────────────────────────────────────────────
onValue(ref(db, '.info/connected'), snap => {
  const live = document.getElementById('liveStatusText');
  if (live) live.textContent = snap.val() ? 'LIVE — Like to catch!' : 'Reconnecting...';
});

// ── Global Stats ──────────────────────────────────────────────────────────────
onValue(ref(db, 'global'), snap => {
  const d       = snap.val() || {};
  const spawns  = d.total_spawns     || 0;
  const catches = d.total_catches    || 0;
  const likes   = d.total_likes_ever || 0;
  document.getElementById('totalSpawns').textContent    = fmt(spawns);
  document.getElementById('totalLikesEver').textContent = fmt(likes);
  const rate = spawns > 0 ? ((catches / spawns) * 100).toFixed(1) + '%' : '0%';
  document.getElementById('catchRate').textContent    = rate;
  document.getElementById('catchRateSub').textContent = `${fmt(catches)} caught / ${fmt(spawns)} spawns`;
});

// ── Live Spawn Widget ─────────────────────────────────────────────────────────
let spawnTimer = null;

onValue(ref(db, 'spawn/current'), snap => {
  const data    = snap.val();
  const widget  = document.getElementById('spawnWidget');
  const imgWrap = document.getElementById('spawnImgWrap');
  const nameEl  = document.getElementById('spawnName');
  const metaEl  = document.getElementById('spawnMeta');
  const timerEl = document.getElementById('spawnTimer');

  if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; }

  if (!data || !data.name) {
    nameEl.textContent  = 'Waiting for spawn...';
    metaEl.textContent  = '—';
    timerEl.textContent = '—';
    imgWrap.innerHTML   = '<span class="spawn-egg">🥚</span>';
    widget.classList.remove('active');
    return;
  }

  widget.classList.add('active');
  imgWrap.innerHTML = '';
  if (data.sprite) {
    const img = document.createElement('img');
    img.src = data.sprite; img.alt = escapeHtml(data.name);
    img.onerror = () => { imgWrap.innerHTML = '<span class="spawn-egg">❓</span>'; };
    imgWrap.appendChild(img);
  } else {
    imgWrap.innerHTML = '<span class="spawn-egg">❓</span>';
  }

  nameEl.innerHTML = '';
  nameEl.appendChild(document.createTextNode(data.name + (data.shiny ? ' ✨' : '') + ' '));
  const rb = document.createElement('span');
  rb.className = `rarity-badge ${rarityClass(data.rarity)}`;
  rb.textContent = data.rarity || 'Common';
  nameEl.appendChild(rb);
  metaEl.textContent = `Level ${data.level || '?'}`;

  const interval   = data.spawn_interval || data.SPAWN_INTERVAL || 15;
  const spawnStart = data.spawn_start || Math.floor(Date.now() / 1000);
  function tick() {
    const remaining = Math.max(0, interval - (Math.floor(Date.now() / 1000) - spawnStart));
    timerEl.textContent =
      String(Math.floor(remaining / 60)).padStart(2, '0') + ':' +
      String(remaining % 60).padStart(2, '0');
  }
  tick();
  spawnTimer = setInterval(tick, 500);
});

// ── Trainers ──────────────────────────────────────────────────────────────────
onValue(ref(db, 'trainers'), snap => {
  const data = snap.val() || {};
  const active = Object.values(data).filter(t => {
    const team = Array.isArray(t.team) ? t.team : Object.values(t.team || {});
    return team.length > 0;
  }).length;
  document.getElementById('totalCatchers').textContent = fmt(active);
  renderTopCatchers(data);
  renderTopCatchmon(data);
});

// ── Top Catchers ──────────────────────────────────────────────────────────────
function renderTopCatchers(data) {
  const container = document.getElementById('catcherRow');
  const list = Object.entries(data).map(([name, info]) => {
    const team = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
    return { name, teamSize: team.length, totalPoints: calcTeamPts(team),
             donation: info.donation || 0, catches: info.stats?.total_catches || 0 };
  }).filter(t => t.teamSize > 0).sort((a,b) => b.totalPoints - a.totalPoints).slice(0, 3);

  if (list.length === 0) { container.innerHTML = '<div class="loading"><div>No trainers yet</div></div>'; return; }
  container.innerHTML = '';

  list.forEach((t, i) => {
    const medal  = ['medal-1','medal-2','medal-3'][i] || '';
    const card   = document.createElement('div');
    card.className = `card ${medal}`;

    const badge = document.createElement('div'); badge.className = 'card-badge'; badge.textContent = i + 1;
    const title = document.createElement('div'); title.className = 'card-title';
    title.appendChild(buildNameEl(capitalize(t.name), t.donation));
    const s1  = document.createElement('div'); s1.className = 'card-stat';  s1.textContent = `🐲 ${t.teamSize} Catchmon`;
    const s2  = document.createElement('div'); s2.className = 'card-stat';  s2.textContent = `✅ ${fmt(t.catches)} Catches`;
    const pts = document.createElement('div'); pts.className = 'pts';        pts.textContent = `${fmt(t.totalPoints)} pts`;

    card.append(badge, title, s1, s2, pts);
    card.addEventListener('click', () => { window.location.href = `catcher_detail.html?name=${encodeURIComponent(t.name)}`; });
    container.appendChild(card);
  });
}

// ── Top Catchmon ──────────────────────────────────────────────────────────────
function renderTopCatchmon(data) {
  const container = document.getElementById('catchmonRow');
  const all = [];
  for (const [trainer, info] of Object.entries(data)) {
    const team = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
    team.forEach(c => { if (c?.name) all.push({ ...c, caughtBy: trainer, trainerDonation: info.donation || 0 }); });
  }
  if (all.length === 0) { container.innerHTML = '<div class="loading"><div>No Catchmon yet</div></div>'; return; }

  const top3 = all.sort((a,b) => calcPts(b) - calcPts(a)).slice(0, 3);
  container.innerHTML = '';

  top3.forEach((c, i) => {
    const medal = ['medal-1','medal-2','medal-3'][i] || '';
    const card  = document.createElement('div'); card.className = `card ${medal}`;

    const badge = document.createElement('div'); badge.className = 'card-badge'; badge.textContent = i + 1;

    const img = document.createElement('img');
    img.src = c.sprite || ''; img.alt = escapeHtml(c.name);
    img.style.cssText = 'width:68px;height:68px;object-fit:contain;margin-bottom:10px;filter:drop-shadow(0 0 10px rgba(255,255,255,0.15));';
    img.onerror = () => { img.style.display = 'none'; };

    const title = document.createElement('div'); title.className = 'card-title';
    title.textContent = c.name + (c.shiny ? ' ✨' : '');
    const rb = document.createElement('span');
    rb.className = `rarity-badge ${rarityClass(c.rarity)}`; rb.textContent = c.rarity || 'Common';
    title.appendChild(document.createTextNode(' ')); title.appendChild(rb);

    const lvl = document.createElement('div'); lvl.className = 'card-stat'; lvl.textContent = `Level ${c.level || 1}`;
    const cDiv = document.createElement('div'); cDiv.className = 'card-stat';
    cDiv.appendChild(document.createTextNode('by '));
    cDiv.appendChild(buildNameEl(capitalize(c.caughtBy), c.trainerDonation));

    const pts = document.createElement('div'); pts.className = 'pts'; pts.textContent = `${fmt(calcPts(c))} pts`;

    card.append(badge, img, title, lvl, cDiv, pts);
    card.addEventListener('click', () => { window.location.href = `catcher_detail.html?name=${encodeURIComponent(c.caughtBy)}`; });
    container.appendChild(card);
  });
}

// ── Live Catch Chances ────────────────────────────────────────────────────────
onValue(ref(db, 'spawn/chances'), snap => { renderChancesLeaderboard(snap.val()); });

function renderChancesLeaderboard(data) {
  const section   = document.getElementById('chancesSection');
  const list      = document.getElementById('chancesList');
  const myRank    = document.getElementById('chancesMyRank');
  const myRankRow = document.getElementById('myRankRow');
  const info      = document.getElementById('chancesSpawnInfo');
  const savedTrainer = getSavedTrainer();

  if (!data || Object.keys(data).length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  const sorted    = Object.values(data).sort((a, b) => b.chance - a.chance);
  const maxChance = sorted[0]?.chance || 1;

  const spawnText = document.getElementById('spawnName')?.textContent
    ?.replace(/\s*(Common|Rare|Starter|Legendary|Mythical|God)\s*$/, '').trim();
  info.textContent = spawnText && spawnText !== 'Waiting for spawn...' ? `for ${spawnText}` : '';

  list.innerHTML = '';
  sorted.slice(0, 5).forEach((entry, i) => {
    const isMe = savedTrainer && entry.name?.toLowerCase() === savedTrainer.toLowerCase();
    list.appendChild(buildChanceRow(entry, i, maxChance, isMe));
  });

  myRank.style.display = 'none';
  if (savedTrainer) {
    const myIndex = sorted.findIndex(e => e.name?.toLowerCase() === savedTrainer.toLowerCase());
    if (myIndex >= 5) {
      myRank.style.display = 'block';
      myRankRow.innerHTML = '';
      if (myIndex > 0) myRankRow.appendChild(buildChanceRow(sorted[myIndex - 1], myIndex - 1, maxChance, false));
      myRankRow.appendChild(buildChanceRow(sorted[myIndex], myIndex, maxChance, true));
      if (myIndex < sorted.length - 1) myRankRow.appendChild(buildChanceRow(sorted[myIndex + 1], myIndex + 1, maxChance, false));
    }
  }
}

function buildChanceRow(entry, index, maxChance, isMe) {
  const row = document.createElement('div');
  const rankClass = index === 0 ? 'top1' : index === 1 ? 'top2' : index === 2 ? 'top3' : '';
  row.className = `chance-row ${rankClass} ${isMe ? 'is-me' : ''}`;

  const rankEmoji     = ['🥇','🥈','🥉'][index] || `${index + 1}`;
  const barPct        = maxChance > 0 ? Math.round((entry.chance / maxChance) * 100) : 0;
  const chanceDisplay = entry.chance < 0.01 ? '<0.01%' : entry.chance.toFixed(2) + '%';
  const tier          = getDonationTier(entry.donation || 0);

  row.innerHTML = `
    <div class="chance-rank">${rankEmoji}</div>
    <div class="chance-name"></div>
    <div class="chance-likes">❤️ ${fmt(entry.likes || 0)}</div>
    <div class="chance-bar-wrap"><div class="chance-bar" style="width:${barPct}%"></div></div>
    <div class="chance-pct">${chanceDisplay}</div>
  `;

  const nameEl = row.querySelector('.chance-name');
  const span   = document.createElement('span');
  span.className   = `catcher-name ${tier}`;
  span.textContent = capitalize(entry.name || '');
  nameEl.appendChild(span);
  if (isMe) {
    const you = document.createElement('span');
    you.style.cssText = 'font-size:10px;opacity:0.5;font-weight:600;margin-left:5px;-webkit-text-fill-color:rgba(255,255,255,0.5);background:none;animation:none;';
    you.textContent = '(you)';
    nameEl.appendChild(you);
  }
  return row;
}

console.log('🎮 Catchmon Arena loaded');