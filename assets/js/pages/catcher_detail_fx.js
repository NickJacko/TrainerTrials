// assets/js/pages/catcher_detail_fx.js
// Visual FX layer for the v2 trainer profile page.
// Runs alongside the original catcher_detail.js — no functional changes.

(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Smart back button ────────────────────────────────────────────────────
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', e => {
      e.preventDefault();
      if (document.referrer && history.length > 1) history.back();
      else location.href = 'catcher_ranking_live.html';
    });
  }

  // ── Hero holo tilt ───────────────────────────────────────────────────────
  const hero = document.getElementById('heroCard');
  if (hero && !reduced) {
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      hero.style.transform =
        `perspective(1000px) rotateX(${(0.5 - y) * 8}deg) rotateY(${(x - 0.5) * 10}deg)`;
      hero.style.setProperty('--mx', `${x * 100}%`);
      hero.style.setProperty('--my', `${y * 100}%`);
    });
    hero.addEventListener('pointerleave', () => {
      hero.style.transform = '';
      hero.style.setProperty('--mx', '50%');
      hero.style.setProperty('--my', '50%');
    });
  }

  // ── Atmosphere particles ─────────────────────────────────────────────────
  const cv = document.getElementById('bgCanvas');
  if (cv && !reduced) {
    const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      cv.width = innerWidth * dpr;
      cv.height = innerHeight * dpr;
      cv.style.width = innerWidth + 'px';
      cv.style.height = innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    addEventListener('resize', resize);

    const parts = [];
    for (let i = 0; i < 50; i++) parts.push({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: 0.6 + Math.random() * 1.4,
      vx: (Math.random() - 0.5) * 0.15,
      vy: -0.05 - Math.random() * 0.22,
      ph: Math.random() * Math.PI * 2,
      sp: 0.012 + Math.random() * 0.02,
      hue: Math.random() < 0.5 ? 175 : (Math.random() < 0.5 ? 48 : 340)
    });

    function loop() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.ph += p.sp;
        if (p.y < -10) { p.y = innerHeight + 10; p.x = Math.random() * innerWidth; }
        if (p.x < -10) p.x = innerWidth + 10;
        if (p.x > innerWidth + 10) p.x = -10;
        const a = 0.25 + Math.sin(p.ph) * 0.25;
        ctx.fillStyle = `hsla(${p.hue},80%,65%,${a})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `hsl(${p.hue},80%,65%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // ── Reveal observer (in addition to the one in catcher_detail.js) ───────
  // (already handled by main JS, but harmless if duplicated)

  // ── Sparkles on gold/secret achievements once they render ───────────────
  const grid = document.getElementById('achGrid');
  if (grid && !reduced) {
    const obs = new MutationObserver(() => {
      grid.querySelectorAll('.ach-badge.unlocked.ach-gold:not([data-spk]), .ach-badge.unlocked.ach-secret:not([data-spk])')
        .forEach(b => {
          b.dataset.spk = '1';
          for (let i = 0; i < 3; i++) {
            const sp = document.createElement('span');
            sp.className = 'ach-sparkle';
            sp.style.left = (20 + Math.random() * 60) + '%';
            sp.style.top = (60 + Math.random() * 30) + '%';
            sp.style.setProperty('--sx', ((Math.random() - 0.5) * 16) + 'px');
            sp.style.animationDelay = (Math.random() * 3) + 's';
            b.appendChild(sp);
          }
        });
    });
    obs.observe(grid, { childList: true, subtree: true });
  }
})();
