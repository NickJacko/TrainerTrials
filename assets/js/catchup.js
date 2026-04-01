// assets/js/catchup.js
// Zeigt neue Catchmon + Fusionen seit dem letzten Profilbesuch als animierte Sequenz

const STORAGE_PREFIX = 'catchup_';

function getLastSnapshot(trainerName) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + trainerName.toLowerCase());
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSnapshot(trainerName, team) {
  try {
    const snapshot = team.map(c => ({
      id:    c.id || null,
      name:  c.name,
      level: c.level,
      stage: c.stage || 1,
      shiny: c.shiny || false,
      rarity: c.rarity || 'Common',
      sprite: c.sprite || '',
      evolution_line: c.evolution_line || [c.name],
    }));
    localStorage.setItem(STORAGE_PREFIX + trainerName.toLowerCase(), JSON.stringify(snapshot));
  } catch {}
}

function diffTeam(oldTeam, newTeam) {
  // Build lookup by id (fallback: name+stage)
  const oldMap = new Map();
  (oldTeam || []).forEach(c => {
    const key = c.id || `${c.name}_${c.stage || 1}`;
    oldMap.set(key, c);
  });

  const newCatches  = [];
  const fusions     = [];

  newTeam.forEach(c => {
    const key = c.id || `${c.name}_${c.stage || 1}`;
    if (!oldMap.has(key)) {
      // Completely new entry — check if it's a fusion result
      // A fusion result has stage > 1 and its base name was in old team
      const evoLine  = c.evolution_line || [c.name];
      const stage    = c.stage || 1;
      if (stage > 1) {
        // Look for two stage-(stage-1) predecessors in old team
        const prevName = evoLine[stage - 2] || null;
        const prevEntries = (oldTeam || []).filter(o =>
          o.name === prevName && (o.stage || 1) === stage - 1
        );
        if (prevEntries.length >= 2) {
          fusions.push({ result: c, from: prevEntries.slice(0, 2) });
          return;
        }
      }
      newCatches.push(c);
    }
  });

  return { newCatches, fusions };
}

// ── CSS ───────────────────────────────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById('catchup-css')) return;
  const style = document.createElement('style');
  style.id = 'catchup-css';
  style.textContent = `
    #catchupOverlay {
      position: fixed; inset: 0; z-index: 9500;
      background: rgba(4,2,14,0.96);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      cursor: pointer;
      overflow: hidden;
    }

    /* Grid texture same as site */
    #catchupOverlay::before {
      content: '';
      position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(78,205,196,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(78,205,196,0.04) 1px, transparent 1px);
      background-size: 56px 56px;
      pointer-events: none;
    }

    /* Glow orb behind sprite */
    #catchupOrb {
      position: absolute; border-radius: 50%;
      width: 340px; height: 340px;
      filter: blur(80px);
      pointer-events: none; z-index: 0;
      transition: background 0.5s ease;
    }

    /* Counter */
    #catchupCounter {
      position: absolute; top: 24px; left: 50%; transform: translateX(-50%);
      font-size: 11px; font-weight: 700; opacity: 0.3; letter-spacing: 2px;
      color: white; text-transform: uppercase; z-index: 2;
    }

    /* Main card */
    #catchupCard {
      display: flex; flex-direction: column; align-items: center;
      gap: 18px; text-align: center; position: relative; z-index: 2;
      animation: cuFadeIn 0.55s cubic-bezier(0.22,1,0.36,1) forwards;
    }
    @keyframes cuFadeIn {
      from { opacity:0; transform:translateY(50px) scale(0.88); }
      to   { opacity:1; transform:translateY(0)    scale(1); }
    }

    /* Fusion row */
    #catchupFusionRow {
      display: flex; align-items: center; gap: 20px;
      position: relative; z-index: 2;
      animation: cuFadeIn 0.55s cubic-bezier(0.22,1,0.36,1) forwards;
    }
    .cu-fusion-src { display: flex; flex-direction: column; align-items: center; gap: 8px; opacity: 0.55; }
    .cu-fusion-src img { width: 80px; height: 80px; object-fit: contain; border-radius: 14px; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.6)); }
    .cu-fusion-src .cu-name { font-size: 12px; font-weight: 700; opacity: 0.7; color: white; }
    .cu-plus  { font-size: 1.8rem; opacity: 0.3; color: white; }
    .cu-arrow { font-size: 1.8rem; color: #FFD700; animation: cuArrow 1s ease-in-out infinite alternate; }
    @keyframes cuArrow { from{transform:translateX(-5px)} to{transform:translateX(5px)} }

    /* Sprite */
    #catchupSprite {
      width: 200px; height: 200px; object-fit: contain;
      border-radius: 24px;
      animation: cuFloat 3.5s ease-in-out infinite;
    }
    @keyframes cuFloat { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-12px) scale(1.02)} }

    #catchupSprite.shiny {
      filter: drop-shadow(0 0 28px rgba(255,215,0,0.9)) drop-shadow(0 0 56px rgba(255,200,0,0.5));
      animation: cuFloat 3.5s ease-in-out infinite, cuShinyPulse 1.8s ease-in-out infinite;
    }
    @keyframes cuShinyPulse {
      0%,100%{ filter: drop-shadow(0 0 28px rgba(255,215,0,0.8)); }
      50%    { filter: drop-shadow(0 0 60px rgba(255,215,0,1)) drop-shadow(0 0 90px rgba(255,150,0,0.9)); }
    }

    /* Flash */
    #catchupFlash {
      position: fixed; inset: 0; z-index: 9600;
      background: white; opacity: 0; pointer-events: none;
      animation: cuFlash 0.7s ease forwards;
    }
    @keyframes cuFlash { 0%{opacity:0} 25%{opacity:0.85} 100%{opacity:0} }

    /* Type badge */
    #catchupTypeBadge {
      font-size: 10px; font-weight: 800; letter-spacing: 2.5px;
      padding: 5px 16px; border-radius: 24px; text-transform: uppercase;
    }
    .cu-badge-new    { background: rgba(78,205,196,0.15); color: #4ECDC4; border: 1px solid rgba(78,205,196,0.35); }
    .cu-badge-fusion { background: rgba(255,152,0,0.15);  color: #ffb74d; border: 1px solid rgba(255,152,0,0.35); }

    /* Name label */
    #catchupLabel {
      font-size: clamp(1.8rem, 6vw, 3.2rem); font-weight: 900;
      color: white; letter-spacing: -1.5px; line-height: 1;
    }

    /* Rarity badge */
    #catchupRarity {
      display: inline-block; font-size: 11px; font-weight: 700;
      padding: 3px 10px; border-radius: 10px; margin-left: 10px;
      vertical-align: middle;
    }
    .cu-rarity-common   { background:rgba(158,158,158,0.2); color:#bdbdbd; }
    .cu-rarity-starter  { background:rgba(76,175,80,0.2);   color:#a5d6a7; }
    .cu-rarity-rare     { background:rgba(33,150,243,0.2);  color:#90caf9; }
    .cu-rarity-legendary{ background:rgba(255,152,0,0.2);   color:#ffcc80; }
    .cu-rarity-mythical { background:rgba(156,39,176,0.2);  color:#e1bee7; }
    .cu-rarity-god      { background:rgba(128,0,128,0.2);   color:#ce93d8; }

    /* Level pill */
    #catchupLevel {
      font-size: 0.95rem; font-weight: 800;
      padding: 6px 20px; border-radius: 24px;
      background: rgba(255,215,0,0.12); border: 1px solid rgba(255,215,0,0.3);
      color: #FFD700; letter-spacing: 0.5px;
    }

    /* Hint */
    #catchupHint {
      position: absolute; bottom: 72px; left: 50%; transform: translateX(-50%);
      font-size: 12px; opacity: 0.25; color: white; font-weight: 500; letter-spacing: 1px;
      animation: cuHintPulse 2.5s ease-in-out infinite; white-space: nowrap; z-index: 2;
    }
    @keyframes cuHintPulse { 0%,100%{opacity:0.2} 50%{opacity:0.45} }

    /* Skip */
    #catchupSkip {
      position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%);
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.35); padding: 8px 28px; border-radius: 24px;
      font-size: 12px; font-weight: 700; cursor: pointer; letter-spacing: 1px;
      text-transform: uppercase;
      transition: all 0.2s ease; z-index: 2;
    }
    #catchupSkip:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.65); border-color: rgba(255,255,255,0.22); }

    /* Dots */
    #catchupDots {
      position: absolute; bottom: 104px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 7px; z-index: 2;
    }
    .cu-dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,0.18); transition: all 0.3s ease; }
    .cu-dot.active { background: white; transform: scale(1.5); }
  `;
  document.head.appendChild(style);
}

// ── OVERLAY ───────────────────────────────────────────────────────────────────

function buildOverlay() {
  const el = document.createElement('div');
  el.id = 'catchupOverlay';
  el.innerHTML = `
    <div id="catchupOrb"></div>
    <div id="catchupCounter"></div>
    <div id="catchupCard" style="display:none"></div>
    <div id="catchupFusionRow" style="display:none"></div>
    <div id="catchupDots"></div>
    <div id="catchupHint">Tap anywhere for next</div>
    <button id="catchupSkip">Skip All</button>
  `;
  document.body.appendChild(el);
  return el;
}

function capitalize(s) { return String(s ?? '').charAt(0).toUpperCase() + String(s ?? '').slice(1); }

function rarityClass(rarity) { return 'cu-rarity-' + (rarity || 'common').toLowerCase(); }

function showFlash() {
  const old = document.getElementById('catchupFlash');
  if (old) old.remove();
  const flash = document.createElement('div');
  flash.id = 'catchupFlash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 700);
}

function buildDots(total, current) {
  const container = document.getElementById('catchupDots');
  container.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = 'cu-dot' + (i === current ? ' active' : '');
    container.appendChild(dot);
  }
}

async function showSequence(items) {
  injectCSS();
  const overlay  = buildOverlay();
  const card     = document.getElementById('catchupCard');
  const fusRow   = document.getElementById('catchupFusionRow');
  const counter  = document.getElementById('catchupCounter');
  const skipBtn  = document.getElementById('catchupSkip');

  let index = 0;

  function close() {
    overlay.style.transition = 'opacity 0.4s ease';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 400);
  }

  skipBtn.addEventListener('click', e => { e.stopPropagation(); close(); });


  const RARITY_ORBS = {
    Common:    'rgba(158,158,158,0.18)',
    Starter:   'rgba(76,175,80,0.22)',
    Rare:      'rgba(33,150,243,0.22)',
    Legendary: 'rgba(255,152,0,0.24)',
    Mythical:  'rgba(156,39,176,0.24)',
    God:       'rgba(128,0,128,0.28)',
  };
  function setOrb(rarity) {
    const orb = document.getElementById('catchupOrb');
    if (orb) orb.style.background = RARITY_ORBS[rarity] || RARITY_ORBS.Common;
  }
  function renderItem(i) {
    if (i >= items.length) { close(); return; }
    const item = items[i];
    counter.textContent = `${i + 1} / ${items.length}`;
    buildDots(items.length, i);

    card.style.display    = 'none';
    fusRow.style.display  = 'none';
    card.innerHTML        = '';
    fusRow.innerHTML      = '';

    if (item.type === 'new') {
      // Trigger re-animation
      card.style.animation = 'none';
      void card.offsetWidth;
      card.style.animation = '';

      card.style.display = 'flex';

      const badge = document.createElement('div');
      badge.id = 'catchupTypeBadge';
      badge.className = 'cu-badge-new';
      badge.textContent = '✨ New Catch';

      const img = document.createElement('img');
      img.id  = 'catchupSprite';
      img.src = item.sprite || '';
      img.alt = item.name;
      if (item.shiny) img.classList.add('shiny');

      const label = document.createElement('div');
      label.id = 'catchupLabel';
      label.textContent = capitalize(item.name) + (item.shiny ? ' ✨' : '');

      const rarityBadge = document.createElement('span');
      rarityBadge.id = 'catchupRarity';
      rarityBadge.className = rarityClass(item.rarity);
      rarityBadge.textContent = item.rarity || 'Common';
      label.appendChild(rarityBadge);

      setOrb(item.rarity);
      const levelEl = document.createElement('div');
      levelEl.id = 'catchupLevel';
      levelEl.textContent = `Level ${item.level}`;

      card.append(badge, img, label, levelEl);

    } else if (item.type === 'fusion') {
      fusRow.style.animation = 'none';
      void fusRow.offsetWidth;
      fusRow.style.animation = '';
      fusRow.style.display = 'flex';

      // From A
      const srcA = document.createElement('div');
      srcA.className = 'cu-fusion-src';
      const imgA = document.createElement('img');
      imgA.src = item.fromA.sprite || ''; imgA.alt = item.fromA.name;
      const nameA = document.createElement('div'); nameA.className = 'cu-name'; nameA.textContent = capitalize(item.fromA.name);
      srcA.append(imgA, nameA);

      // Plus
      const plus = document.createElement('div'); plus.className = 'cu-plus'; plus.textContent = '+';

      // From B
      const srcB = document.createElement('div');
      srcB.className = 'cu-fusion-src';
      const imgB = document.createElement('img');
      imgB.src = item.fromB.sprite || ''; imgB.alt = item.fromB.name;
      const nameB = document.createElement('div'); nameB.className = 'cu-name'; nameB.textContent = capitalize(item.fromB.name);
      srcB.append(imgB, nameB);

      // Arrow
      const arrow = document.createElement('div'); arrow.className = 'cu-arrow'; arrow.textContent = '→';

      // Result card
      const resultCard = document.createElement('div');
      resultCard.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;';

      const badge = document.createElement('div');
      badge.id = 'catchupTypeBadge';
      badge.className = 'cu-badge-fusion';
      badge.textContent = '🔥 Fusion';

      const imgR = document.createElement('img');
      imgR.id = 'catchupSprite';
      imgR.src = item.result.sprite || ''; imgR.alt = item.result.name;
      if (item.result.shiny) imgR.classList.add('shiny');

      const labelR = document.createElement('div');
      labelR.id = 'catchupLabel';
      labelR.textContent = capitalize(item.result.name) + (item.result.shiny ? ' ✨' : '');
      const rarR = document.createElement('span');
      rarR.id = 'catchupRarity'; rarR.className = rarityClass(item.result.rarity);
      rarR.textContent = item.result.rarity || 'Common';
      labelR.appendChild(rarR);

      const lvlR = document.createElement('div');
      lvlR.id = 'catchupLevel';
      lvlR.textContent = `Level ${item.result.level}`;

      resultCard.append(badge, imgR, labelR, lvlR);
      fusRow.append(srcA, plus, srcB, arrow, resultCard);

      setOrb(item.result?.rarity);
      // Flash effect for fusions
      setTimeout(showFlash, 200);
    }
  }

  renderItem(0);

  overlay.addEventListener('click', () => {
    index++;
    if (index >= items.length) { close(); return; }
    renderItem(index);
  });
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

export function runCatchup(trainerName, currentTeam) {
  if (!trainerName || !currentTeam?.length) return;

  const lastSnapshot = getLastSnapshot(trainerName);

  // Always save current state for next visit
  saveSnapshot(trainerName, currentTeam);

  if (!lastSnapshot) return; // First ever visit — nothing to show

  const { newCatches, fusions } = diffTeam(lastSnapshot, currentTeam);

  if (newCatches.length === 0 && fusions.length === 0) return;

  // Build sequence: fusions first (they explain why old ones are gone), then new
  const items = [];

  fusions.forEach(f => {
    items.push({
      type:   'fusion',
      result: f.result,
      fromA:  f.from[0],
      fromB:  f.from[1],
    });
  });

  newCatches.forEach(c => {
    items.push({
      type:   'new',
      name:   c.name,
      level:  c.level,
      rarity: c.rarity,
      sprite: c.sprite,
      shiny:  c.shiny || false,
    });
  });

  showSequence(items);
}