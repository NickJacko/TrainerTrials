// assets/js/pages/ranking_catchmon.js
import { db } from '../firebase.client.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

let caughtCatchmon  = []; // aus trainers/
let escapedCatchmon = []; // aus escaped/
let catcherDonations = {};
let activeRarityFilter = 'all';
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
  try { return localStorage.getItem('catchmon_trainer_name') || null; } catch { return null; }
}
function sumStats(stats) { return Object.values(stats || {}).reduce((a, b) => a + (b || 0), 0); }
function calcPoints(catchmon) {
  if (!catchmon) return 0;
  const level = catchmon.level || 1;
  const statSum = sumStats(catchmon.stats);
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
function buildCatcherCell(catcherName, donation, isMe) {
  const wrap = document.createElement('span');
  const span = document.createElement('span');
  span.className = `catcher-name ${getDonationTier(donation)}`;
  span.textContent = catcherName;
  span.addEventListener('click', (e) => {
    e.stopPropagation();
    window.location.href = `catcher_detail.html?name=${encodeURIComponent(catcherName)}`;
  });
  wrap.appendChild(span);
  if (isMe) {
    const you = document.createElement('span');
    you.className = 'you-tag'; you.textContent = 'YOU';
    wrap.appendChild(you);
  }
  return wrap;
}

// ── Rarity buttons ────────────────────────────────────────────────────────────
function updateRarityButtons() {
  document.querySelectorAll('.rarity-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.rarity === activeRarityFilter);
  });
}

// ── Scroll ────────────────────────────────────────────────────────────────────
function scrollToMyRow() {
  if (hasScrolled) return;
  const myRow = document.querySelector('tr.my-row');
  if (!myRow) return;
  hasScrolled = true;
  setTimeout(() => { myRow.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 400);
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderTable() {
  const tbody          = document.getElementById("rankingBody");
  const showCaughtOnly = document.getElementById("caughtOnly").checked;
  const savedTrainer   = getSavedTrainer();

  // Caught — immer anzeigen, nach Punkten sortiert
  const visibleCaught = caughtCatchmon
    .filter(p => activeRarityFilter === 'all' || p.rarity === activeRarityFilter)
    .sort((a, b) => b.points - a.points);

  // Escaped — nur wenn Checkbox nicht aktiv
  const visibleEscaped = showCaughtOnly ? [] : escapedCatchmon
    .filter(p => activeRarityFilter === 'all' || p.rarity === activeRarityFilter)
    .sort((a, b) => (b.escaped_at || 0) - (a.escaped_at || 0)); // neueste zuerst

  if (visibleCaught.length === 0 && visibleEscaped.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading"><div class="spinner"></div><div>No Catchmon found</div></td></tr>';
    return;
  }

  const rankClasses = ['rank-1','rank-2','rank-3'];
  const rowClasses  = ['gold-row','silver-row','bronze-row'];
  const fragment    = document.createDocumentFragment();

  // ── Caught rows ────────────────────────────────────────────────────────────
  visibleCaught.forEach((p, index) => {
    const tr   = document.createElement("tr");
    const isMe = savedTrainer && p.catcher?.toLowerCase() === savedTrainer.toLowerCase();
    if (rowClasses[index]) tr.classList.add(rowClasses[index]);
    if (isMe) tr.classList.add('my-row');
    tr.addEventListener('click', () => {
      window.location.href = `dex_detail.html?name=${encodeURIComponent(p.name)}`;
    });

    const tdRank = document.createElement('td');
    const badge  = document.createElement('div');
    badge.className = `rank-badge ${rankClasses[index] || 'rank-other'}`;
    badge.textContent = index + 1;
    tdRank.appendChild(badge);

    const tdSprite = document.createElement('td');
    const img = document.createElement('img');
    img.className = 'catchmon-sprite';
    img.src = p.sprite || ''; img.alt = p.name; img.loading = 'lazy';
    img.onerror = function() { this.style.display = 'none'; };
    tdSprite.appendChild(img);

    const tdName = document.createElement('td');
    tdName.className = 'name-cell';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name;
    const rarityBadge = document.createElement('span');
    rarityBadge.className = `rarity-pill rarity-${(p.rarity || 'common').toLowerCase()}`;
    rarityBadge.textContent = p.rarity || 'Common';
    tdName.append(nameSpan, document.createTextNode(' '), rarityBadge);

    const tdCatcher = document.createElement('td');
    tdCatcher.className = 'catcher-cell';
    tdCatcher.appendChild(buildCatcherCell(p.catcher, catcherDonations[p.catcher] || 0, isMe));

    const tdPoints = document.createElement('td');
    tdPoints.className = 'points-cell';
    tdPoints.textContent = p.points.toLocaleString('de-DE');

    const tdLevel = document.createElement('td');
    tdLevel.className = 'level-cell';
    tdLevel.textContent = p.level;

    const tdStats = document.createElement('td');
    tdStats.className = 'stats-cell';
    tdStats.textContent = p.statSum.toLocaleString('de-DE');

    const tdShiny = document.createElement('td');
    if (p.shiny) {
      const s = document.createElement('span');
      s.className = 'shiny-badge'; s.textContent = '✨';
      tdShiny.appendChild(s);
    }

    tr.append(tdRank, tdSprite, tdName, tdCatcher, tdPoints, tdLevel, tdStats, tdShiny);
    fragment.appendChild(tr);
  });

  // ── Escaped rows — grau, kein Catcher, kein Rank ─────────────────────────
  visibleEscaped.forEach((p) => {
    const tr = document.createElement("tr");
    tr.classList.add('uncaught-row');
    tr.title = 'Escaped — not caught by anyone';
    tr.addEventListener('click', () => {
      window.location.href = `dex_detail.html?name=${encodeURIComponent(p.name)}`;
    });

    // Rank — escaped symbol statt Nummer
    const tdRank = document.createElement('td');
    tdRank.innerHTML = '<span style="opacity:0.3;font-size:0.9em;">✗</span>';

    const tdSprite = document.createElement('td');
    const img = document.createElement('img');
    img.className = 'catchmon-sprite';
    img.src = p.sprite || ''; img.alt = p.name; img.loading = 'lazy';
    img.style.opacity = '0.45';
    img.style.filter = 'grayscale(60%)';
    img.onerror = function() { this.style.display = 'none'; };
    tdSprite.appendChild(img);

    const tdName = document.createElement('td');
    tdName.className = 'name-cell';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name;
    nameSpan.style.opacity = '0.5';
    const rarityBadge = document.createElement('span');
    rarityBadge.className = `rarity-pill rarity-${(p.rarity || 'common').toLowerCase()}`;
    rarityBadge.textContent = p.rarity || 'Common';
    rarityBadge.style.opacity = '0.5';
    tdName.append(nameSpan, document.createTextNode(' '), rarityBadge);

    const tdCatcher = document.createElement('td');
    tdCatcher.innerHTML = '<span style="opacity:0.3;font-size:0.85em;">✗ escaped</span>';

    const tdPoints = document.createElement('td');
    tdPoints.innerHTML = '<span style="opacity:0.25">—</span>';

    const tdLevel = document.createElement('td');
    tdLevel.className = 'level-cell';
    tdLevel.innerHTML = `<span style="opacity:0.4">${p.level || '—'}</span>`;

    const tdStats = document.createElement('td');
    tdStats.className = 'stats-cell';
    tdStats.innerHTML = p.statSum > 0
      ? `<span style="opacity:0.4">${p.statSum.toLocaleString('de-DE')}</span>`
      : '<span style="opacity:0.25">—</span>';

    const tdShiny = document.createElement('td');
    if (p.shiny) {
      const s = document.createElement('span');
      s.className = 'shiny-badge'; s.textContent = '✨';
      s.style.opacity = '0.5';
      tdShiny.appendChild(s);
    }

    tr.append(tdRank, tdSprite, tdName, tdCatcher, tdPoints, tdLevel, tdStats, tdShiny);
    fragment.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(fragment);
  scrollToMyRow();
}

function forceRefresh() {
  document.getElementById("rankingBody").innerHTML =
    '<tr><td colspan="8" class="loading"><div class="spinner"></div><div>Refreshing...</div></td></tr>';
  hasScrolled = false;
  renderTable();
}

// ── Firebase ──────────────────────────────────────────────────────────────────
onValue(ref(db, '.info/connected'), snap => {
  const el = document.getElementById('connectionStatus');
  if (snap.val()) {
    el.textContent = '🟢 Live'; el.className = 'connection-status connected';
  } else {
    el.textContent = '🔴 Offline'; el.className = 'connection-status disconnected';
  }
});

// Caught — aus trainers/
onValue(ref(db, 'trainers'), snap => {
  const data = snap.val() || {};
  caughtCatchmon = [];
  catcherDonations = {};
  for (const [catcher, info] of Object.entries(data)) {
    catcherDonations[catcher] = info.donation || 0;
    const team = Array.isArray(info.team) ? info.team : Object.values(info.team || {});
    for (const c of team) {
      if (c?.name) {
        caughtCatchmon.push({
          catcher,
          name:     c.name,
          level:    c.level    || 1,
          shiny:    c.shiny    || false,
          stats:    c.stats    || {},
          rarity:   c.rarity   || "Common",
          sprite:   c.sprite   || "",
          points:   calcPoints(c),
          statSum:  sumStats(c.stats),
          caught:   true,
        });
      }
    }
  }
  renderTable();
});

// Escaped — aus escaped/
onValue(ref(db, 'escaped'), snap => {
  const data = snap.val();
  escapedCatchmon = [];
  if (!data) { renderTable(); return; }
  const entries = typeof data === 'object' ? Object.values(data) : [];
  escapedCatchmon = entries
    .filter(e => e?.name)
    .map(e => ({
      name:      e.name,
      level:     e.level    || 1,
      shiny:     e.shiny    || false,
      stats:     e.stats    || {},
      rarity:    e.rarity   || "Common",
      sprite:    e.sprite   || "",
      statSum:   sumStats(e.stats),
      escaped_at: e.escaped_at || 0,
      caught:    false,
    }));
  renderTable();
}, err => console.error('Firebase escaped error:', err));

// ── Events ────────────────────────────────────────────────────────────────────
document.querySelectorAll('.rarity-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeRarityFilter = btn.dataset.rarity;
    hasScrolled = false;
    updateRarityButtons();
    renderTable();
  });
});
document.getElementById('caughtOnly').addEventListener('change', () => {
  hasScrolled = false;
  renderTable();
});
document.getElementById('refreshFab').addEventListener('click', forceRefresh);

console.log('🐲 Catchmon Ranking loaded');