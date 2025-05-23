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
