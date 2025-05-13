import json
import os

DATA_FILE = "trainers.json"

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = {"trainers": {}}

    if "encounters" not in data:
        data["encounters"] = {}

    if "seen" not in data:
        data["seen"] = []

    return data

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def count_encounter(data, pokemon_name):
    if "encounters" not in data:
        data["encounters"] = {}
    data["encounters"][pokemon_name] = data["encounters"].get(pokemon_name, 0) + 1

def log_seen_pokemon(data, pokemon):
    if "seen" not in data:
        data["seen"] = []

    # Kopiere Pokémon, füge "trainer": None hinzu, um "gesehen aber nicht gefangen" zu markieren
    entry = dict(pokemon)
    entry["trainer"] = None
    data["seen"].append(entry)

def add_coins(data, username, amount=1):
    if "trainers" not in data:
        data["trainers"] = {}
    user = data["trainers"].get(username, {"coins": 0, "team": []})
    user["coins"] = user.get("coins", 0) + amount
    data["trainers"][username] = user

def calc_strength(p):
    return p["level"] * 100 + sum(p["stats"].values()) + (10000 if p.get("shiny") else 0)

def merge_stats(stats1, stats2):
    return {k: stats1[k] + stats2[k] for k in stats1}  # kein Limit mehr


def add_pokemon(data, username, pokemon):
    if "trainers" not in data:
        data["trainers"] = {}

    user = data["trainers"].get(username, {"coins": 0, "team": []})
    team = user.get("team", [])

    name = pokemon["name"]
    stage = pokemon.get("stage", 1)
    evo_line = pokemon.get("evolution_line", [name])

    # Pokémon gleicher Name & Stufe
    same_stage = [p for p in team if p["name"] == name and p["stage"] == stage]

    if len(same_stage) == 1:
        # Fusion möglich
        other = same_stage[0]
        team.remove(other)

        # Fusion zu nächster Entwicklungsstufe
        next_stage = stage + 1
        if next_stage <= len(evo_line):
            evolved_name = evo_line[next_stage - 1]
            new_stats = merge_stats(pokemon["stats"], other["stats"])
            new_level = pokemon["level"] + other["level"]
            new_strength = calc_strength({
                "level": new_level,
                "stats": new_stats,
                "shiny": pokemon["shiny"],
            })

            # Finde alle Pokémon mit Zielname & Stage
            same_next = [p for p in team if p["name"] == evolved_name and p["stage"] == next_stage]

            if len(same_next) < 3:
                # Einfach hinzufügen
                team.append({
                    "name": evolved_name,
                    "level": new_level,
                    "rarity": "Fused",
                    "shiny": pokemon["shiny"],
                    "stats": new_stats,
                    "sprite": pokemon["sprite"],
                    "stage": next_stage,
                    "evolution_line": evo_line
                })
            else:
                # Ersetze das schwächste, falls neuer stärker ist
                weakest = min(same_next, key=calc_strength)
                if new_strength > calc_strength(weakest):
                    team.remove(weakest)
                    team.append({
                        "name": evolved_name,
                        "level": new_level,
                        "rarity": "Fused",
                        "shiny": pokemon["shiny"],
                        "stats": new_stats,
                        "sprite": pokemon["sprite"],
                        "stage": next_stage,
                        "evolution_line": evo_line
                    })
        else:
            # Keine höhere Entwicklung → zurück als einzelnes
            team.append(pokemon)

    elif len(same_stage) < 3:
        # Platz frei → hinzufügen
        team.append(pokemon)

    else:
        # Nur ersetzen wenn stärker
        weakest = min(same_stage, key=calc_strength)
        if calc_strength(pokemon) > calc_strength(weakest):
            team.remove(weakest)
            team.append(pokemon)

    user["team"] = team
    data["trainers"][username] = user

def get_top_trainers(data, top_n=3):
    trainers = data.get("trainers", {})
    sorted_trainers = sorted(trainers.items(), key=lambda x: len(x[1].get("team", [])), reverse=True)
    return sorted_trainers[:top_n]
