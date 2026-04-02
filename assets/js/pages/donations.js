// assets/js/pages/donations.js
import { db } from '../firebase.client.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Floating particles
const emojis = ['💰','💎','✨','👑','🔥','⭐','🎁'];
const pc = document.getElementById('particles');
for (let i = 0; i < 20; i++) {
  const p = document.createElement('div');
  p.className = 'particle';
  p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
  p.style.left             = Math.random() * 100 + '%';
  p.style.animationDuration = (7 + Math.random() * 9) + 's';
  p.style.animationDelay    = (Math.random() * 10) + 's';
  p.style.fontSize          = (0.9 + Math.random() * 1.1) + 'rem';
  pc.appendChild(p);
}

// Scroll reveal
const obs = new IntersectionObserver(entries => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('in'), i * 80);
      obs.unobserve(e.target);
    }
  });
}, { threshold: 0.06 });
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// Helpers
function getDonationTier(d) {
  if (d >= 2500) return 'king';
  if (d >= 500)  return 'flame';
  if (d >= 100)  return 'diamond';
  if (d >= 50)   return 'shine';
  return 'normal';
}
function fmt(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1)+'M';
  if (n >= 1000)    return (n/1000).toFixed(1)+'K';
  return String(n);
}
function capitalize(s) { return String(s??'').charAt(0).toUpperCase()+String(s??'').slice(1); }

// Firebase — global stats
onValue(ref(db, 'global'), snap => {
  const d = snap.val() || {};
  document.getElementById('statTotalCatches').textContent = fmt(d.total_catches || 0);
});

// Firebase — trainers → donors
onValue(ref(db, 'trainers'), snap => {
  const data   = snap.val() || {};
  const donors = Object.entries(data)
    .map(([name, info]) => ({ name, donation: info.donation || 0 }))
    .filter(d => d.donation > 0)
    .sort((a, b) => b.donation - a.donation);

  document.getElementById('statTotalDonations').textContent = fmt(donors.reduce((s, d) => s + d.donation, 0));
  document.getElementById('statActiveDonors').textContent   = fmt(donors.length);

  const grid = document.getElementById('donorsGrid');
  if (donors.length === 0) {
    grid.innerHTML = '<div class="no-donors">No supporters yet — be the first! 🎉</div>';
    return;
  }

  grid.innerHTML = '';
  donors.slice(0, 12).forEach((d, i) => {
    const tier = getDonationTier(d.donation);
    const card = document.createElement('div');
    card.className = `supporter-card sc-${tier} ${i < 3 ? 'rank-'+(i+1) : ''}`;
    card.addEventListener('click', () => {
      window.location.href = `catcher_detail.html?name=${encodeURIComponent(d.name)}`;
    });

    const rankEl = document.createElement('div');
    rankEl.className = 'sc-rank';
    rankEl.textContent = i + 1;

    const nameEl = document.createElement('div');
    nameEl.className = 'sc-name';
    if (tier !== 'normal') {
      const span = document.createElement('span');
      span.className = `cn-name cn-${tier}`;
      span.textContent = capitalize(d.name);
      nameEl.appendChild(span);
    } else {
      nameEl.textContent = capitalize(d.name);
    }

    const amtEl = document.createElement('div');
    amtEl.className = 'sc-amount';
    amtEl.textContent = fmt(d.donation) + ' Coins';

    const tierEl = document.createElement('div');
    tierEl.className = 'sc-tier';
    const labels = { king:'👑 King', flame:'🔥 Flame', diamond:'💎 Diamond', shine:'✨ Shine', normal:'Standard' };
    tierEl.textContent = labels[tier] || '—';

    card.append(rankEl, nameEl, amtEl, tierEl);
    grid.appendChild(card);
  });
});

console.log('💎 Donations loaded');