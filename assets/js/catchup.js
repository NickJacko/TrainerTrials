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
      background: rgba(0,0,0,0.92);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      cursor: pointer;
    }

    /* Counter */
    #catchupCounter {
      position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
      font-size: 13px; font-weight: 700; opacity: 0.4; letter-spacing: 1px;
      color: white;
    }

    /* Main card */
    #catchupCard {
      display: flex; flex-direction: column; align-items: center;
      gap: 20px; text-align: center;
      animation: cuFadeIn 0.5s ease forwards;
    }
    @keyframes cuFadeIn { from { opacity:0; transform:translateY(40px) scale(0.92); } to { opacity:1; transform:translateY(0) scale(1); } }

    /* Fusion: two cards side by side */
    #catchupFusionRow {
      display: flex; align-items: center; gap: 24px;
      animation: cuFadeIn 0.5s ease forwards;
    }
    .cu-fusion-src {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      opacity: 0.6;
    }
    .cu-fusion-src img { width: 90px; height: 90px; object-fit: contain; border-radius: 14px; filter: drop-shadow(0 4px 12px rgba(255,255,255,0.15)); }
    .cu-fusion-src .cu-name { font-size: 13px; font-weight: 700; opacity: 0.8; color: white; }
    .cu-plus { font-size: 2rem; opacity: 0.5; color: white; }
    .cu-arrow { font-size: 2rem; opacity: 0.7; animation: cuArrow 1s ease-in-out infinite alternate; color: #FFD700; }
    @keyframes cuArrow { from{transform:translateX(-4px)} to{transform:translateX(4px)} }

    /* Sprite */
    #catchupSprite {
      width: 180px; height: 180px; object-fit: contain;
      border-radius: 20px;
      filter: drop-shadow(0 0 30px rgba(255,215,0,0.4));
      animation: cuFloat 3s ease-in-out infinite;
    }
    @keyframes cuFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }

    /* Shiny sparkle */
    #catchupSprite.shiny {
      filter: drop-shadow(0 0 30px rgba(255,215,0,0.8)) drop-shadow(0 0 60px rgba(255,150,0,0.5));
      animation: cuFloat 3s ease-in-out infinite, cuShinyPulse 1.5s ease-in-out infinite;
    }
    @keyframes cuShinyPulse { 0%,100%{filter:drop-shadow(0 0 30px rgba(255,215,0,0.8))} 50%{filter:drop-shadow(0 0 60px rgba(255,215,0,1)) drop-shadow(0 0 80px rgba(255,150,0,0.8))} }

    /* Flash for fusion */
    #catchupFlash {
      position: fixed; inset: 0; z-index: 9600;
      background: white; opacity: 0; pointer-events: none;
      animation: cuFlash 0.6s ease forwards;
    }
    @keyframes cuFlash { 0%{opacity:0} 30%{opacity:0.9} 100%{opacity:0} }

    /* Labels */
    #catchupLabel {
      font-size: clamp(1.6rem, 5vw, 2.8rem); font-weight: 900;
      color: white; letter-spacing: -1px; line-height: 1.1;
    }
    #catchupSub {
      font-size: 1rem; font-weight: 600; opacity: 0.6; color: white;
    }
    #catchupLevel {
      display: inline-block;
      font-size: 1rem; font-weight: 800;
      padding: 6px 18px; border-radius: 20px;
      background: rgba(255,215,0,0.2); border: 1.5px solid rgba(255,215,0,0.5);
      color: #FFD700;
    }
    #catchupRarity {
      display: inline-block; font-size: 12px; font-weight: 700;
      padding: 3px 12px; border-radius: 10px; margin-left: 8px;
    }
    .cu-rarity-common   { background:rgba(158,158,158,0.25); color:#e0e0e0; }
    .cu-rarity-starter  { background:rgba(76,175,80,0.25);   color:#81c784; }
    .cu-rarity-rare     { background:rgba(33,150,243,0.25);   color:#64b5f6; }
    .cu-rarity-legendary{ background:rgba(255,152,0,0.25);    color:#ffb74d; }
    .cu-rarity-mythical { background:rgba(156,39,176,0.25);   color:#ce93d8; }
    .cu-rarity-god      { background:rgba(128,0,128,0.25);    color:#ba68c8; }

    /* Type badge: NEW / FUSION */
    #catchupTypeBadge {
      font-size: 11px; font-weight: 800; letter-spacing: 2px;
      padding: 4px 14px; border-radius: 20px; text-transform: uppercase;
    }
    .cu-badge-new    { background: rgba(78,205,196,0.25); color: #4ECDC4; border: 1px solid rgba(78,205,196,0.4); }
    .cu-badge-fusion { background: rgba(255,152,0,0.25);  color: #ffb74d; border: 1px solid rgba(255,152,0,0.4); }

    /* Hint */
    #catchupHint {
      position: absolute; bottom: 70px; left: 50%; transform: translateX(-50%);
      font-size: 13px; opacity: 0.3; color: white; font-weight: 500;
      animation: cuHintPulse 2s ease-in-out infinite;
    }
    @keyframes cuHintPulse { 0%,100%{opacity:0.3} 50%{opacity:0.55} }

    /* Skip button */
    #catchupSkip {
      position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.4); padding: 9px 28px; border-radius: 20px;
      font-size: 13px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px;
      transition: all 0.2s ease; backdrop-filter: blur(5px);
    }
    #catchupSkip:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.25); }

    /* Progress dots */
    #catchupDots {
      position: absolute; bottom: 100px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 6px;
    }
    .cu-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.2); transition: all 0.3s ease; }
    .cu-dot.active { background: white; transform: scale(1.3); }
  `;
  document.head.appendChild(style);
}

// ── OVERLAY ───────────────────────────────────────────────────────────────────

function buildOverlay() {
  const el = document.createElement('div');
  el.id = 'catchupOverlay';
  el.innerHTML = `
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