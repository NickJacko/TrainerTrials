import os
import json
import random
import numpy as np
import time

BASE_FOLDER = "catchmon"
DATA_FILE = "catcher.json"

RARITY_SPAWN_CHANCES = {
    "Common": 70, "Rare": 10, "Starter": 15,
    "Legendary": 2, "Mythical": 2, "God": 1
}

RARITY_MULTIPLIERS = {
    "Common": 0.3, "Rare": 0.25, "Starter": 0.3,
    "Mythical": 0.15, "Legendary": 0.15, "God": 0.1
}

RARITY_SCORE_MULTIPLIERS = {
    "Common": 1.0, "Starter": 1.5, "Rare": 2.0,
    "Mythical": 4.0, "Legendary": 5.0, "God": 10.0
}

MAX_EFFECTIVE_LIKES = 1000
BASE_CATCH_RATE = 0.01

# Global Stats System - NEU!
def load_global_stats():
    """Lädt die globalen Statistiken"""
    try:
        with open("global_stats.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {
            "total_likes_ever": 0,
            "total_spawns": 0,
            "total_catches": 0,
            "total_escapes": 0,
            "total_evolutions": 0,
            "session_start": time.time(),
            "highest_level_catchmon": {"name": "None", "level": 0}
        }

def save_global_stats(stats):
    """Speichert die globalen Statistiken"""
    with open("global_stats.json", "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)

def update_global_likes_file(current_spawn_likes, total_likes_ever):
    """Aktualisiert sowohl die aktuellen Spawn-Likes als auch die Gesamtlikes"""
    # Für die aktuelle Spawn-Anzeige
    spawn_data = {"global_likes": current_spawn_likes}
    with open("global_likes.json", "w", encoding="utf-8") as f:
        json.dump(spawn_data, f)
    
    # Für die Global Level Bar - ALLE Likes ever (NUR wenn sich was ändert!)
    try:
        with open("global_level.json", "r", encoding="utf-8") as f:
            current_level_data = json.load(f)
            current_total = current_level_data.get("global_likes", 0)
    except FileNotFoundError:
        current_total = 0
    
    # Nur aktualisieren wenn sich die Gesamtlikes geändert haben
    if total_likes_ever != current_total:
        level_data = {"global_likes": total_likes_ever}
        with open("global_level.json", "w", encoding="utf-8") as f:
            json.dump(level_data, f)
        print(f"🌟 Global Level aktualisiert: {total_likes_ever} Gesamtlikes")

# Evolution/Fusion System - NEU!
def generate_evolution_html(username, from_catchmon, to_catchmon):
    """Erstellt eine Evolution HTML-Datei"""
    timestamp = int(time.time())
    evolution_dir = "evolutions"
    os.makedirs(evolution_dir, exist_ok=True)
    
    # Evolution Data für externe Nutzung
    evolution_data = {
        "catcher": username,
        "from_name": from_catchmon["name"],
        "to_name": to_catchmon["name"],
        "from_sprite": from_catchmon["sprite"],
        "to_sprite": to_catchmon["sprite"],
        "from_level": from_catchmon["level"],
        "to_level": to_catchmon["level"],
        "timestamp": timestamp,
        "evolution_type": "fusion"
    }
    
    # JSON speichern
    json_file = f"{evolution_dir}/evolution_{timestamp}.json"
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(evolution_data, f, indent=2)
    
    # HTML für OBS erstellen
    html_file = f"{evolution_dir}/evolution_{timestamp}.html"
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Evolution!</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {{
      margin: 0;
      background: radial-gradient(ellipse at center, #1a1a2e 0%, #16213e 30%, #0f0f23 70%, #000000 100%);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      text-align: center;
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }}

    .evolution-container {{
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(20px);
      border-radius: 30px;
      padding: 40px;
      border: 2px solid rgba(255,255,255,0.2);
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      position: relative;
      overflow: hidden;
    }}

    .evolution-container::before {{
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: linear-gradient(45deg, 
        transparent, 
        rgba(255, 215, 0, 0.1), 
        transparent, 
        rgba(255, 215, 0, 0.1), 
        transparent);
      animation: shine 4s linear infinite;
    }}

    @keyframes shine {{
      0% {{ transform: rotate(0deg); }}
      100% {{ transform: rotate(360deg); }}
    }}

    .title {{
      font-size: 3rem;
      font-weight: 900;
      margin-bottom: 30px;
      background: linear-gradient(45deg, #FFD700, #FF6B6B, #4ECDC4, #45B7D1, #FFD700);
      background-size: 300% 300%;
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: titleGradient 3s ease-in-out infinite;
      position: relative;
      z-index: 2;
    }}

    @keyframes titleGradient {{
      0%, 100% {{ background-position: 0% 50%; }}
      50% {{ background-position: 100% 50%; }}
    }}

    .evolution-display {{
      display: flex;
      align-items: center;
      gap: 40px;
      margin: 30px 0;
      position: relative;
      z-index: 2;
    }}

    .catchmon-card {{
      text-align: center;
      transition: all 1s ease;
    }}

    .catchmon-image {{
      width: 180px;
      height: 180px;
      object-fit: contain;
      border-radius: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      border: 3px solid rgba(255,255,255,0.3);
      transition: all 1s ease;
    }}

    .evolution-arrow {{
      font-size: 4rem;
      animation: pulse 2s ease-in-out infinite;
      filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.8));
    }}

    @keyframes pulse {{
      0%, 100% {{ transform: scale(1); }}
      50% {{ transform: scale(1.2); }}
    }}

    .catchmon-name {{
      font-size: 1.5rem;
      font-weight: 700;
      margin-top: 15px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.5);
    }}

    .catcher-info {{
      font-size: 1.8rem;
      font-weight: 600;
      margin-top: 30px;
      color: #4ECDC4;
      text-shadow: 0 2px 10px rgba(0,0,0,0.5);
      position: relative;
      z-index: 2;
    }}

    .fusion-particles {{
      position: absolute;
      width: 6px;
      height: 6px;
      background: radial-gradient(circle, #FFD700, #FFA500);
      border-radius: 50%;
      animation: particleFloat 3s ease-out infinite;
      pointer-events: none;
    }}

    @keyframes particleFloat {{
      0% {{
        opacity: 1;
        transform: translateY(0) scale(1);
      }}
      100% {{
        opacity: 0;
        transform: translateY(-150px) scale(0.3);
      }}
    }}
  </style>
</head>
<body>
  <div class="evolution-container">
    <h1 class="title">🔥 FUSION EVOLUTION! 🔥</h1>
    
    <div class="evolution-display">
      <div class="catchmon-card">
        <img class="catchmon-image" src="{from_catchmon['sprite']}" alt="{from_catchmon['name']}">
        <div class="catchmon-name">{from_catchmon['name']}</div>
      </div>
      
      <div class="evolution-arrow">⚡</div>
      
      <div class="catchmon-card">
        <img class="catchmon-image" src="{to_catchmon['sprite']}" alt="{to_catchmon['name']}">
        <div class="catchmon-name">{to_catchmon['name']}</div>
      </div>
    </div>
    
    <div class="catcher-info">{username}'s {from_catchmon['name']} evolved into {to_catchmon['name']}!</div>
  </div>

  <script>
    // Create floating particles
    function createParticle() {{
      const particle = document.createElement('div');
      particle.className = 'fusion-particles';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = '80%';
      particle.style.animationDelay = Math.random() * 2 + 's';
      document.body.appendChild(particle);
      
      setTimeout(() => {{
        particle.remove();
      }}, 3000);
    }}

    // Create particles continuously
    setInterval(createParticle, 200);
    for (let i = 0; i < 20; i++) {{
      setTimeout(createParticle, i * 100);
    }}

    // Auto-remove after 8 seconds
    setTimeout(() => {{
      document.body.style.opacity = '0';
      setTimeout(() => {{
        window.close();
      }}, 1000);
    }}, 8000);
  </script>
</body>
</html>"""
    
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    print(f"🔥 Evolution HTML erstellt: {html_file}")
    return html_file, evolution_data

def trigger_fusion_animation(username, evolutions):
    """Löst die Fusion-Animation aus für OBS"""
    try:
        fusion_data = {
            "catcher": username,
            "evolutions": evolutions,
            "timestamp": time.time(),
            "total_evolutions": len(evolutions)
        }
        
        with open("fusion_trigger.json", "w", encoding="utf-8") as f:
            json.dump(fusion_data, f, ensure_ascii=False, indent=2)
        
        print(f"🎬 Fusion-Animation für {username} ausgelöst! ({len(evolutions)} Evolutionen)")
        
        # Für jede Evolution einzelne HTML erstellen
        for evolution in evolutions:
            generate_evolution_html(username, evolution["from"], evolution["to"])
            
        return True
        
    except Exception as e:
        print(f"❌ Fehler beim Auslösen der Fusion-Animation: {e}")
        return False

def get_evolution_line(name):
    if not os.path.exists("evolution_lines.json"):
        return None
    with open("evolution_lines.json", "r", encoding="utf-8") as f:
        lines = json.load(f)
    name_lower = name.lower()
    for base, line in lines.items():
        if name_lower in [n.lower() for n in line]:
            return line
    return None

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = {"catcher": {}}
    data.setdefault("encounters", {})
    data.setdefault("escaped", [])
    return data

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def count_encounter(data, catchmon_name):
    data["encounters"][catchmon_name] = data["encounters"].get(catchmon_name, 0) + 1

def log_escaped_catchmon(data, catchmon):
    entry = dict(catchmon)
    entry["catcher"] = None
    if "sprite" not in entry:
        entry["sprite"] = f"{BASE_FOLDER}/unknown.png"
    if "evolution_line" not in entry:
        entry["evolution_line"] = get_evolution_line(entry["name"])
    if "stage" not in entry:
        entry["stage"] = entry["evolution_line"].index(entry["name"]) + 1 if entry["evolution_line"] else 1
    data["escaped"].append(entry)
    update_seen_caught(data)

def add_coins(data, username, amount=1):
    user = data["catcher"].get(username, {"coins": 0, "team": []})
    user["coins"] = user.get("coins", 0) + amount
    data["catcher"][username] = user

def update_seen_caught(data, output_file="seen_caught.json"):
    result = {}
    for catcher in data.get("catcher", {}).values():
        for catch in catcher.get("team", []):
            name = catch.get("name", "").lower()
            if name not in result:
                result[name] = {"escaped": 0, "caught": 0}
            result[name]["caught"] += 1
    for entry in data.get("escaped", []):
        name = entry.get("name", "").lower()
        if name not in result:
            result[name] = {"escaped": 0, "caught": 0}
        result[name]["escaped"] += 1
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

def get_score_multiplier(rarity):
    return RARITY_SCORE_MULTIPLIERS.get(rarity, 1.0)

def calc_gesamtpunkte(p):
    base = (p["level"] or 1) * 100
    stat_sum = sum(p["stats"].values())
    shiny_bonus = 10000 if p.get("shiny") else 0
    multiplier = get_score_multiplier(p["rarity"])
    return round((base + stat_sum + shiny_bonus) * multiplier)

def merge_stats(stats1, stats2):
    return {k: stats1[k] + stats2[k] for k in stats1}

def get_weighted_level():
    levels = list(range(1, 101))
    weights = [1 / (lvl ** 1) for lvl in levels]
    return random.choices(levels, weights=weights, k=1)[0]

def get_random_catchmon():
    entries = []
    for rarity in os.listdir(BASE_FOLDER):
        r_folder = os.path.join(BASE_FOLDER, rarity)
        if not os.path.isdir(r_folder):
            continue
        for file in os.listdir(r_folder):
            if file.endswith(".png"):
                name = os.path.splitext(file)[0]
                sprite = f"{BASE_FOLDER}/{rarity}/{file}".replace("\\", "/")
                entries.append({
                    "name": name,
                    "sprite": sprite,
                    "rarity": rarity
                })

    if not entries:
        return None

    base_candidates = []
    for e in entries:
        evo_line = get_evolution_line(e["name"])
        if not evo_line or e["name"].lower() != evo_line[0].lower():
            continue
        base_candidates.append(e)

    if not base_candidates:
        return None

    while True:
        chosen = random.choice(base_candidates)
        rarity = chosen["rarity"]
        if random.randint(1, 100) <= RARITY_SPAWN_CHANCES.get(rarity, 1):
            shiny = (random.randint(1, 10000000) == 1)
            stats = {k: random.randint(0, 31) for k in ["ATK", "DEF", "SPD", "WIS", "CHA", "LUK"]}
            level = get_weighted_level()
            evo_line = get_evolution_line(chosen["name"])
            gesamtpunkte = calc_gesamtpunkte({
                "level": level,
                "stats": stats,
                "shiny": shiny,
                "rarity": rarity
            })

            return {
                "name": chosen["name"],
                "level": level,
                "rarity": rarity,
                "shiny": shiny,
                "stats": stats,
                "sprite": chosen["sprite"],
                "stage": 1,
                "evolution_line": evo_line,
                "categories": [rarity],
                "gesamtpunkte": gesamtpunkte
            }

def calculate_effective_likes(real_likes, multiplier):
    return min(MAX_EFFECTIVE_LIKES, real_likes * multiplier)

def get_catch_rate_per_like(level, rarity):
    rarity_factor = RARITY_MULTIPLIERS.get(rarity, 1.0)
    level_penalty = np.exp(0.02 * (level - 1))
    return BASE_CATCH_RATE * rarity_factor / level_penalty

def calculate_catch_chance(catchmon, like_data, global_likes):
    level = catchmon.get("level", 1)
    rarity = catchmon.get("rarity", "Common")
    rate_per_like = get_catch_rate_per_like(level, rarity)
    global_bonus_percent = min(global_likes / 10000 * 10, 10)

    chances = {}
    for user, entry in like_data.items():
        real_likes = entry.get("likes", 0)
        multiplier = entry.get("multiplier", 1.0)
        effective = calculate_effective_likes(real_likes, multiplier)
        base_chance = effective * rate_per_like
        total_chance = base_chance * (1 + global_bonus_percent / 100)
        chances[user] = round(min(total_chance, 1.0), 4)

    return chances

def roll_catch(catch_chances):
    winners = [user for user, chance in catch_chances.items() if random.random() <= chance]
    return random.choice(winners) if winners else None

def add_catchmon(data, username, catchmon):
    """Verbesserte add_catchmon Funktion mit Evolution-Tracking"""
    global_stats = load_global_stats()
    
    user = data["catcher"].get(username, {"coins": 0, "team": []})
    team = user.get("team", [])
    evo_line = catchmon.get("evolution_line", [catchmon["name"]])
    catchmon["evolution_line"] = evo_line
    catchmon["stage"] = evo_line.index(catchmon["name"]) + 1 if catchmon["name"] in evo_line else 1
    catchmon["gesamtpunkte"] = calc_gesamtpunkte(catchmon)

    def calc_power(p):
        return p.get("gesamtpunkte") or calc_gesamtpunkte(p)

    def get_same_stage(pname, stage):
        return [p for p in team if p["name"] == pname and p.get("stage", 1) == stage]

    RARITY_PRIORITY = {
        "Common": 1, "Rare": 2, "Starter": 3, "Legendary": 7,
        "Mythical": 8, "God": 9
    }

    evolutions_occurred = []  # Track evolutions for animation

    # Evolution Loop mit Tracking
    while True:
        stage = catchmon["stage"]
        name = catchmon["name"]
        matches = get_same_stage(name, stage)
        if len(matches) < 1 or name not in evo_line:
            break

        idx = evo_line.index(name)
        if idx + 1 >= len(evo_line):
            break

        next_name = evo_line[idx + 1]
        next_stage = stage + 1
        mergee = matches[0]
        team.remove(mergee)

        # Store evolution data BEFORE changing catchmon
        evolution_data = {
            "from": {
                "name": catchmon["name"],
                "sprite": catchmon["sprite"],
                "level": catchmon["level"],
                "stage": catchmon["stage"]
            },
            "to": None  # Will be filled after evolution
        }

        new_stats = merge_stats(catchmon["stats"], mergee["stats"])
        new_level = max(catchmon["level"], mergee["level"])
        new_rarity = catchmon["rarity"] if RARITY_PRIORITY.get(catchmon["rarity"], 0) >= RARITY_PRIORITY.get(mergee.get("rarity", ""), 0) else mergee.get("rarity", "Common")
        new_sprite = f"{BASE_FOLDER}/{new_rarity}/{next_name}.png".replace("\\", "/")
        
        # Update catchmon
        catchmon.update({
            "name": next_name,
            "level": new_level,
            "rarity": new_rarity,
            "shiny": catchmon["shiny"] or mergee.get("shiny", False),
            "sprite": new_sprite,
            "stats": new_stats,
            "stage": next_stage,
            "evolution_line": evo_line,
            "gesamtpunkte": calc_gesamtpunkte({
                "level": new_level,
                "stats": new_stats,
                "shiny": catchmon["shiny"] or mergee.get("shiny", False),
                "rarity": new_rarity
            })
        })

        # Complete evolution data
        evolution_data["to"] = {
            "name": catchmon["name"],
            "sprite": catchmon["sprite"],
            "level": catchmon["level"],
            "stage": catchmon["stage"]
        }
        
        evolutions_occurred.append(evolution_data)
        global_stats["total_evolutions"] += 1
        
        print(f"🔥 EVOLUTION! {evolution_data['from']['name']} → {evolution_data['to']['name']}")

        next_matches = get_same_stage(next_name, next_stage)
        if len(next_matches) >= 3:
            weakest = min(next_matches, key=calc_power)
            if calc_power(catchmon) > calc_power(weakest):
                team.remove(weakest)
            else:
                team.append(mergee)
                break
        # Continue evolution loop if possible

    # Final team addition logic
    same_stage = get_same_stage(catchmon["name"], catchmon["stage"])
    if len(same_stage) >= 3:
        weakest = min(same_stage, key=calc_power)
        if calc_power(catchmon) > calc_power(weakest):
            team.remove(weakest)
        else:
            return  # Don't add if not strong enough

    team.append(catchmon)
    user["team"] = team
    data["catcher"][username] = user

    # Update global stats for highest level
    if catchmon["level"] > global_stats["highest_level_catchmon"]["level"]:
        global_stats["highest_level_catchmon"] = {
            "name": catchmon["name"],
            "level": catchmon["level"],
            "catcher": username
        }

    save_global_stats(global_stats)

    # Trigger Evolution Animation if evolutions occurred
    if evolutions_occurred:
        trigger_fusion_animation(username, evolutions_occurred)

def get_top_catcher(data, top_n=3):
    catcher = data.get("catcher", {})
    sorted_catcher = sorted(catcher.items(), key=lambda x: len(x[1].get("team", [])), reverse=True)
    return sorted_catcher[:top_n]

# Initialize fusion trigger file
def init_fusion_trigger():
    try:
        with open("fusion_trigger.json", "r", encoding="utf-8") as f:
            pass  # File exists
    except FileNotFoundError:
        with open("fusion_trigger.json", "w", encoding="utf-8") as f:
            json.dump({
                "catcher": None, 
                "evolutions": [], 
                "timestamp": 0, 
                "total_evolutions": 0
            }, f)

# TEST FUNCTIONS - NEU!
def test_single_evolution():
    """Testet eine einzelne Evolution"""
    test_data = {
        "catcher": "TestUser",
        "evolutions": [{
            "from": {
                "name": "Flaumi",
                "sprite": "catchmon/Starter/Flaumi.png",
                "level": 25,
                "stage": 1
            },
            "to": {
                "name": "Flamarox", 
                "sprite": "catchmon/Starter/Flamarox.png",
                "level": 25,
                "stage": 2
            }
        }],
        "timestamp": time.time(),
        "total_evolutions": 1
    }
    
    with open("fusion_trigger.json", "w", encoding="utf-8") as f:
        json.dump(test_data, f, ensure_ascii=False, indent=2)
    
    print("🧪 Single Evolution Test ausgelöst!")
    return test_data

def test_chain_evolution():
    """Testet eine Kettenfusion (A→B→C)"""
    test_data = {
        "catcher": "ChainTester",
        "evolutions": [{
            "from": {
                "name": "Flaumi",
                "sprite": "catchmon/Starter/Flaumi.png", 
                "level": 30,
                "stage": 1
            },
            "to": {
                "name": "Flamarox",
                "sprite": "catchmon/Starter/Flamarox.png",
                "level": 30,
                "stage": 2
            }
        }, {
            "from": {
                "name": "Flamarox",
                "sprite": "catchmon/Starter/Flamarox.png",
                "level": 30, 
                "stage": 2
            },
            "to": {
                "name": "Flameron",
                "sprite": "catchmon/Starter/Flameron.png",
                "level": 30,
                "stage": 3
            }
        }],
        "timestamp": time.time(),
        "total_evolutions": 2
    }
    
    with open("fusion_trigger.json", "w", encoding="utf-8") as f:
        json.dump(test_data, f, ensure_ascii=False, indent=2)
    
    print("🧪 Chain Evolution Test ausgelöst!")
    return test_data

def test_multi_evolution():
    """Testet mehrere verschiedene Evolutionen gleichzeitig"""
    test_data = {
        "catcher": "MultiTester",
        "evolutions": [{
            "from": {
                "name": "Flaumi",
                "sprite": "catchmon/Starter/Flaumi.png",
                "level": 20,
                "stage": 1
            },
            "to": {
                "name": "Flamarox",
                "sprite": "catchmon/Starter/Flamarox.png", 
                "level": 20,
                "stage": 2
            }
        }, {
            "from": {
                "name": "Plipsy",
                "sprite": "catchmon/Starter/Plipsy.png",
                "level": 18,
                "stage": 1
            },
            "to": {
                "name": "Aquilor",
                "sprite": "catchmon/Starter/Aquilor.png",
                "level": 18,
                "stage": 2
            }
        }, {
            "from": {
                "name": "Geckon", 
                "sprite": "catchmon/Starter/Geckon.png",
                "level": 22,
                "stage": 1
            },
            "to": {
                "name": "Reptorax",
                "sprite": "catchmon/Starter/Reptorax.png",
                "level": 22,
                "stage": 2
            }
        }],
        "timestamp": time.time(),
        "total_evolutions": 3
    }
    
    with open("fusion_trigger.json", "w", encoding="utf-8") as f:
        json.dump(test_data, f, ensure_ascii=False, indent=2)
    
    print("🧪 Multi Evolution Test ausgelöst!")
    return test_data

# Initialize system
init_fusion_trigger()
print("🔥 Enhanced Catcher System loaded with Evolution/Fusion support!")
print("🧪 TEST COMMANDS:")
print("   test_single_evolution() - Testet eine Evolution")
print("   test_chain_evolution() - Testet Kettenfusion")  
print("   test_multi_evolution() - Testet multiple Evolutionen")