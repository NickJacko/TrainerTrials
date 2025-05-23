import os
import json
import random
import numpy as np

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
        entry["stage"] = entry["evolution_line"].index(entry["name"]) + 1
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

        new_stats = merge_stats(catchmon["stats"], mergee["stats"])
        new_level = max(catchmon["level"], mergee["level"])
        new_rarity = catchmon["rarity"] if RARITY_PRIORITY.get(catchmon["rarity"], 0) >= RARITY_PRIORITY.get(mergee.get("rarity", ""), 0) else mergee.get("rarity", "Common")
        new_sprite = f"{BASE_FOLDER}/{new_rarity}/{next_name}.png".replace("\\", "/")
        evolved = {
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
        }

        next_matches = get_same_stage(next_name, next_stage)
        if len(next_matches) >= 3:
            weakest = min(next_matches, key=calc_power)
            if calc_power(evolved) > calc_power(weakest):
                team.remove(weakest)
                catchmon = evolved
            else:
                team.append(mergee)
                break
        else:
            catchmon = evolved

    same_stage = get_same_stage(catchmon["name"], catchmon["stage"])
    if len(same_stage) >= 3:
        weakest = min(same_stage, key=calc_power)
        if calc_power(catchmon) > calc_power(weakest):
            team.remove(weakest)
        else:
            return

    team.append(catchmon)
    user["team"] = team
    data["catcher"][username] = user

def get_top_catcher(data, top_n=3):
    catcher = data.get("catcher", {})
    sorted_catcher = sorted(catcher.items(), key=lambda x: len(x[1].get("team", [])), reverse=True)
    return sorted_catcher[:top_n]
