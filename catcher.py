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

# Global Stats System - FIXED!
def load_global_stats():
    """Lädt die globalen Statistiken mit sicherer Fehlerbehandlung"""
    default_stats = {
        "total_likes_ever": 0,
        "total_spawns": 0,
        "total_catches": 0,
        "total_escapes": 0,
        "total_evolutions": 0,
        "session_start": time.time(),
        "highest_level_catchmon": {"name": "None", "level": 0, "catcher": "None"}
    }
    
    try:
        with open("global_stats.json", "r", encoding="utf-8") as f:
            stats = json.load(f)
        
        # Sicherstellen, dass alle Felder existieren
        for key, default_value in default_stats.items():
            if key not in stats:
                stats[key] = default_value
                print(f"🔧 Added missing field '{key}' to global_stats")
        
        # Spezialbehandlung für highest_level_catchmon
        if not isinstance(stats.get("highest_level_catchmon"), dict):
            stats["highest_level_catchmon"] = default_stats["highest_level_catchmon"]
        
        # Sicherstellen, dass highest_level_catchmon alle nötigen Felder hat
        required_fields = ["name", "level", "catcher"]
        for field in required_fields:
            if field not in stats["highest_level_catchmon"]:
                stats["highest_level_catchmon"][field] = default_stats["highest_level_catchmon"][field]
        
        return stats
        
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"🔧 Creating/fixing global_stats.json: {e}")
        return default_stats.copy()

def save_global_stats(stats):
    """Speichert die globalen Statistiken sicher"""
    try:
        with open("global_stats.json", "w", encoding="utf-8") as f:
            json.dump(stats, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"⚠️ Error saving global_stats.json: {e}")

def update_global_likes_file(current_spawn_likes, total_likes_ever):
    """Aktualisiert sowohl die aktuellen Spawn-Likes als auch die Gesamtlikes"""
    try:
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
            # print(f"🌟 Global Level aktualisiert: {total_likes_ever} Gesamtlikes")
    except Exception as e:
        print(f"⚠️ Error updating global likes: {e}")

# Evolution/Fusion System - FIXED!
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
        return True
        
    except Exception as e:
        print(f"❌ Fehler beim Auslösen der Fusion-Animation: {e}")
        return False

def get_evolution_line(name):
    try:
        if not os.path.exists("evolution_lines.json"):
            return None
        with open("evolution_lines.json", "r", encoding="utf-8") as f:
            lines = json.load(f)
        name_lower = name.lower()
        for base, line in lines.items():
            if name_lower in [n.lower() for n in line]:
                return line
        return None
    except Exception as e:
        print(f"⚠️ Error loading evolution lines: {e}")
        return None

def load_data():
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = {"catcher": {}}
        
        data.setdefault("encounters", {})
        data.setdefault("escaped", [])
        return data
    except Exception as e:
        print(f"⚠️ Error loading data, creating new: {e}")
        return {"catcher": {}, "encounters": {}, "escaped": []}

def save_data(data):
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"⚠️ Error saving data: {e}")

def count_encounter(data, catchmon_name):
    try:
        data["encounters"][catchmon_name] = data["encounters"].get(catchmon_name, 0) + 1
    except Exception as e:
        print(f"⚠️ Error counting encounter: {e}")

def log_escaped_catchmon(data, catchmon):
    try:
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
    except Exception as e:
        print(f"⚠️ Error logging escaped catchmon: {e}")

def add_coins(data, username, amount=1):
    try:
        user = data["catcher"].get(username, {"coins": 0, "team": []})
        user["coins"] = user.get("coins", 0) + amount
        data["catcher"][username] = user
    except Exception as e:
        print(f"⚠️ Error adding coins: {e}")

def update_seen_caught(data, output_file="seen_caught.json"):
    try:
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
    except Exception as e:
        print(f"⚠️ Error updating seen_caught: {e}")

def get_score_multiplier(rarity):
    return RARITY_SCORE_MULTIPLIERS.get(rarity, 1.0)

def calc_gesamtpunkte(p):
    try:
        base = (p.get("level", 1)) * 100
        stat_sum = sum(p.get("stats", {}).values())
        shiny_bonus = 10000 if p.get("shiny", False) else 0
        multiplier = get_score_multiplier(p.get("rarity", "Common"))
        return round((base + stat_sum + shiny_bonus) * multiplier)
    except Exception as e:
        print(f"⚠️ Error calculating points: {e}")
        return 100  # Fallback

def merge_stats(stats1, stats2):
    try:
        return {k: stats1.get(k, 0) + stats2.get(k, 0) for k in set(stats1.keys()) | set(stats2.keys())}
    except Exception as e:
        print(f"⚠️ Error merging stats: {e}")
        return stats1  # Fallback

def get_weighted_level():
    try:
        levels = list(range(1, 101))
        weights = [1 / (lvl ** 1) for lvl in levels]
        return random.choices(levels, weights=weights, k=1)[0]
    except Exception as e:
        print(f"⚠️ Error getting weighted level: {e}")
        return random.randint(1, 50)  # Fallback

def get_random_catchmon():
    try:
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
    except Exception as e:
        print(f"⚠️ Error generating random catchmon: {e}")
        return None

def calculate_effective_likes(real_likes, multiplier):
    return min(MAX_EFFECTIVE_LIKES, real_likes * multiplier)

def get_catch_rate_per_like(level, rarity):
    try:
        rarity_factor = RARITY_MULTIPLIERS.get(rarity, 1.0)
        level_penalty = np.exp(0.02 * (level - 1))
        return BASE_CATCH_RATE * rarity_factor / level_penalty
    except Exception as e:
        print(f"⚠️ Error calculating catch rate: {e}")
        return BASE_CATCH_RATE

def calculate_catch_chance(catchmon, like_data, global_likes):
    try:
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
    except Exception as e:
        print(f"⚠️ Error calculating catch chances: {e}")
        return {}

def roll_catch(catch_chances):
    try:
        winners = [user for user, chance in catch_chances.items() if random.random() <= chance]
        return random.choice(winners) if winners else None
    except Exception as e:
        print(f"⚠️ Error rolling catch: {e}")
        return None

def add_catchmon(data, username, catchmon):
    """KOMPLETT ÜBERARBEITETE add_catchmon Funktion mit sicherer Global Stats Behandlung"""
    try:
        # Global Stats SICHER laden
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
            return [p for p in team if p.get("name") == pname and p.get("stage", 1) == stage]

        RARITY_PRIORITY = {
            "Common": 1, "Rare": 2, "Starter": 3, "Legendary": 7,
            "Mythical": 8, "God": 9
        }

        evolutions_occurred = []  # Track evolutions for animation

        # Evolution Loop mit sicherer Fehlerbehandlung
        evolution_attempts = 0
        max_evolution_attempts = 10  # Verhindere Endlosschleifen
        
        while evolution_attempts < max_evolution_attempts:
            evolution_attempts += 1
            
            stage = catchmon.get("stage", 1)
            name = catchmon.get("name", "")
            matches = get_same_stage(name, stage)
            
            if len(matches) < 1 or name not in evo_line:
                break

            idx = evo_line.index(name) if name in evo_line else -1
            if idx == -1 or idx + 1 >= len(evo_line):
                break

            next_name = evo_line[idx + 1]
            next_stage = stage + 1
            mergee = matches[0]
            team.remove(mergee)

            # Store evolution data BEFORE changing catchmon
            evolution_data = {
                "from": {
                    "name": catchmon.get("name", ""),
                    "sprite": catchmon.get("sprite", ""),
                    "level": catchmon.get("level", 1),
                    "stage": catchmon.get("stage", 1)
                },
                "to": None  # Will be filled after evolution
            }

            new_stats = merge_stats(catchmon.get("stats", {}), mergee.get("stats", {}))
            new_level = max(catchmon.get("level", 1), mergee.get("level", 1))
            new_rarity = catchmon.get("rarity", "Common")
            mergee_rarity = mergee.get("rarity", "Common")
            
            if RARITY_PRIORITY.get(mergee_rarity, 0) > RARITY_PRIORITY.get(new_rarity, 0):
                new_rarity = mergee_rarity
                
            new_sprite = f"{BASE_FOLDER}/{new_rarity}/{next_name}.png".replace("\\", "/")
            
            # Update catchmon
            catchmon.update({
                "name": next_name,
                "level": new_level,
                "rarity": new_rarity,
                "shiny": catchmon.get("shiny", False) or mergee.get("shiny", False),
                "sprite": new_sprite,
                "stats": new_stats,
                "stage": next_stage,
                "evolution_line": evo_line,
                "gesamtpunkte": calc_gesamtpunkte({
                    "level": new_level,
                    "stats": new_stats,
                    "shiny": catchmon.get("shiny", False) or mergee.get("shiny", False),
                    "rarity": new_rarity
                })
            })

            # Complete evolution data
            evolution_data["to"] = {
                "name": catchmon.get("name", ""),
                "sprite": catchmon.get("sprite", ""),
                "level": catchmon.get("level", 1),
                "stage": catchmon.get("stage", 1)
            }
            
            evolutions_occurred.append(evolution_data)
            global_stats["total_evolutions"] = global_stats.get("total_evolutions", 0) + 1
            
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
        same_stage = get_same_stage(catchmon.get("name", ""), catchmon.get("stage", 1))
        if len(same_stage) >= 3:
            weakest = min(same_stage, key=calc_power)
            if calc_power(catchmon) > calc_power(weakest):
                team.remove(weakest)
            else:
                return  # Don't add if not strong enough

        team.append(catchmon)
        user["team"] = team
        data["catcher"][username] = user

        # Update global stats for highest level - SICHER!
        current_level = catchmon.get("level", 1)
        highest_level_data = global_stats.get("highest_level_catchmon", {"name": "None", "level": 0})
        
        if current_level > highest_level_data.get("level", 0):
            global_stats["highest_level_catchmon"] = {
                "name": catchmon.get("name", "Unknown"),
                "level": current_level,
                "catcher": username
            }
            print(f"🏆 NEW HIGHEST LEVEL: {username}'s {catchmon.get('name')} Level {current_level}!")

        save_global_stats(global_stats)

        # Trigger Evolution Animation if evolutions occurred
        if evolutions_occurred:
            trigger_fusion_animation(username, evolutions_occurred)
            
    except Exception as e:
        print(f"❌ CRITICAL ERROR in add_catchmon: {e}")
        print(f"   Username: {username}")
        print(f"   Catchmon: {catchmon.get('name', 'Unknown') if catchmon else 'None'}")
        # Trotzdem versuchen zu speichern
        if catchmon:
            try:
                user = data["catcher"].get(username, {"coins": 0, "team": []})
                team = user.get("team", [])
                team.append(catchmon)
                user["team"] = team
                data["catcher"][username] = user
                print(f"✅ Fallback: Added {catchmon.get('name', 'Unknown')} to {username}'s team")
            except:
                print(f"❌ Even fallback failed for {username}")

def get_top_catcher(data, top_n=3):
    try:
        catcher = data.get("catcher", {})
        sorted_catcher = sorted(catcher.items(), key=lambda x: len(x[1].get("team", [])), reverse=True)
        return sorted_catcher[:top_n]
    except Exception as e:
        print(f"⚠️ Error getting top catchers: {e}")
        return []

# Initialize fusion trigger file
def init_fusion_trigger():
    try:
        if not os.path.exists("fusion_trigger.json"):
            with open("fusion_trigger.json", "w", encoding="utf-8") as f:
                json.dump({
                    "catcher": None, 
                    "evolutions": [], 
                    "timestamp": 0, 
                    "total_evolutions": 0
                }, f)
            print("🔧 Created fusion_trigger.json")
    except Exception as e:
        print(f"⚠️ Error initializing fusion trigger: {e}")

# System initialisieren
init_fusion_trigger()

# Lade und prüfe Global Stats beim Start
startup_stats = load_global_stats()
save_global_stats(startup_stats)  # Stelle sicher, dass die Datei korrekt ist

print("🔥 Enhanced Catcher System loaded with FULL ERROR HANDLING!")
print(f"📊 Current Global Stats:")
print(f"   🌟 Total Likes Ever: {startup_stats.get('total_likes_ever', 0)}")
print(f"   🎯 Total Spawns: {startup_stats.get('total_spawns', 0)}")
print(f"   ✅ Total Catches: {startup_stats.get('total_catches', 0)}")
print(f"   💨 Total Escapes: {startup_stats.get('total_escapes', 0)}")
print(f"   🔥 Total Evolutions: {startup_stats.get('total_evolutions', 0)}")
highest = startup_stats.get('highest_level_catchmon', {})
print(f"   🏆 Highest Level: {highest.get('name', 'None')} Level {highest.get('level', 0)} ({highest.get('catcher', 'None')})")