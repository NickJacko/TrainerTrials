// assets/js/pages/index_fx.js
// Visual FX layer for index page — non-module, runs alongside index.js
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Hero holo tilt ─────────────────────────────────────────────
  const hero = document.getElementById('heroCard');
  if (hero && !reduced) {
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      hero.style.transform =
        `perspective(1200px) rotateX(${(0.5 - y) * 5}deg) rotateY(${(x - 0.5) * 6}deg)`;
      hero.style.setProperty('--mx', `${x * 100}%`);
      hero.style.setProperty('--my', `${y * 100}%`);
    });
    hero.addEventListener('pointerleave', () => {
      hero.style.transform = '';
      hero.style.setProperty('--mx', '50%');
      hero.style.setProperty('--my', '50%');
    });
  }

  // ── Atmosphere particles ───────────────────────────────────────
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
})();
