function getStyledCatcherName(name, donation) {
  const badge = donation >= 2500 ? "👑" :
                donation >= 500  ? "🔥" :
                donation >= 250  ? "💎" :
                donation >= 100  ? "✨" : "";

  const tier = donation >= 2500 ? "king" :
               donation >= 500  ? "flame" :
               donation >= 250  ? "diamond" :
               donation >= 100  ? "shine" : "normal";

  return `<a href="catcher_detail.html?name=${encodeURIComponent(name)}" class="catcher-name ${tier}">${badge} ${name}</a>`;
}



function getDonationTier(donation) {
  if (donation >= 2500) return "king"; 
  if (donation >= 500)  return "flame";  
  if (donation >= 250)  return "diamond"; 
  if (donation >= 100)  return "shine";   
  return "normal";                   
}

RARITY_MULTIPLIERS = {
    "Common": 0.35,
    "Rare": 0.25,
    "Starter": 0.25,
    "Pseudo-Legendary": 0.15,
    "Paradox": 0.10,
    "Ultra Beast": 0.10,
    "Legendary": 0.125,
    "Mythical": 0.05,
    "God": 0.01
}

const RARITY_SCORE_MULTIPLIERS = {
  "Common": 1.0,
  "Starter": 1.5,
  "Rare": 2.0,
  "Mythical": 4.0,
  "Legendary": 5.0,
  "God": 10.0
};

function getScoreMultiplier(rarity) {
  return RARITY_SCORE_MULTIPLIERS[rarity] || 1.0;
}

// Manuelle Schwellen bis Level 100
const LEVEL_THRESHOLDS = [
  0,     // 1
  100,   // 2
  300,   // 3
  600,   // 4
  1000,  // 5
  1500, 2100, 2800, 3600, 5000,    // 10
  6500, 8500, 11000, 14000, 18000,
  23000, 29000, 36000, 45000, 55000, // 20
  66000, 78000, 91000, 105000, 120000,
  140000, 165000, 195000, 230000, 270000, // 30
  320000, 380000, 450000, 530000, 620000,
  720000, 830000, 950000, 1080000, 1220000, // 40
  1370000, 1530000, 1700000, 1880000, 2070000,
  2270000, 2480000, 2700000, 2930000, 3170000, // 50
  3400000, 3600000, 3800000, 4000000, 4200000,
  4400000, 4600000, 4800000, 5000000, 5200000, // 60
  5400000, 5600000, 5800000, 6000000, 6200000,
  6400000, 6600000, 6800000, 7000000, 7200000, // 70
  7400000, 7600000, 7800000, 8000000, 8200000,
  8400000, 8600000, 8800000, 9000000, 9200000, // 80
  9400000, 9600000, 9800000, 9900000, 9950000,
  9980000, 9990000, 9995000, 9998000, 10000000  // 100
];

// Level aus Coin-Wert berechnen
function getPlayerLevel(coins) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (coins >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

// Gibt die Level-Farbe oder CSS-Klasse zurück
function getLevelColor(level) {
  if (level >= 100) return "rainbow-glow";
  if (level >= 90) return "deepred-glow";
  if (level >= 80) return "red-glow";
  if (level >= 70) return "orange-glow";
  if (level >= 60) return "yellow-glow";
  if (level >= 50) return "blue-glow";
  if (level >= 40) return "cyan-glow";
  if (level >= 30) return "green-glow";
  if (level >= 20) return "lightgreen-glow";
  if (level >= 10) return "gray-glow";
  return "gray";
}

