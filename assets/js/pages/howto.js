// assets/js/pages/howto.js

// Staggered scroll reveal
const revealEls = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver(entries => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('in'), i * 80);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.06 });
revealEls.forEach(el => observer.observe(el));

// Animate like meter
let dir = 1, val = 68;
setInterval(() => {
  val += dir * (Math.random() * 2.5);
  if (val > 90) dir = -1;
  if (val < 25) dir = 1;
  val = Math.max(5, Math.min(98, val));
  const fill   = document.getElementById('lmFill');
  const pct    = document.getElementById('lmPct');
  if (fill) fill.style.width = val + '%';
  if (pct)  pct.textContent  = (val * 0.18).toFixed(1) + '%';
}, 900);

console.log('🧠 How to Play loaded');