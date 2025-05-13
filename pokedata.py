import requests
import random

POKEAPI_URL = "https://pokeapi.co/api/v2/pokemon/"

def get_random_pokemon():
    max_id = 1010
    pokemon_id = random.randint(1, max_id)

    r = requests.get(f"{POKEAPI_URL}{pokemon_id}")
    if r.status_code != 200:
        return None
    data = r.json()
    name = data["name"].capitalize()

    species_data = requests.get(data["species"]["url"]).json()
    is_legendary = species_data.get("is_legendary", False)
    is_mythical = species_data.get("is_mythical", False)

    # Rarity
    if is_mythical:
        if random.random() > 0.001: return None
        rarity = "Mythical"
    elif is_legendary:
        if random.random() > 0.005: return None
        rarity = "Legendary"
    else:
        rarity = "Rare" if random.random() < 0.05 else "Common"

    # Level-Verteilung mit exponentiell abfallender Wahrscheinlichkeit
    levels = list(range(1, 101))
    alpha = 1.5
    weights = [1 / (lvl ** alpha) for lvl in levels]
    total = sum(weights)
    probs = [w / total for w in weights]
    level = random.choices(levels, weights=probs, k=1)[0]

    shiny = (random.randint(1, 8192) == 1)

    stats_names = ["HP", "Attack", "Defense", "Sp.Attack", "Sp.Defense", "Speed"]
    stats = {stat: random.randint(0, 31) for stat in stats_names}

    sprite = data["sprites"]["other"]["official-artwork"]["front_default"]
    if shiny:
        shiny_sprite = data["sprites"]["other"]["official-artwork"]["front_shiny"]
        if shiny_sprite:
            sprite = shiny_sprite

    # Evolution line extrahieren
    try:
        evolution_chain_url = species_data["evolution_chain"]["url"]
        chain_data = requests.get(evolution_chain_url).json()["chain"]

        evolution_line = []
        current = chain_data
        while current:
            evo_name = current["species"]["name"].capitalize()
            evolution_line.append(evo_name)
            if current["evolves_to"]:
                current = current["evolves_to"][0]
            else:
                break

        # Nur erste Entwicklungsstufe erlauben
        if name != evolution_line[0]:
            return None
    except Exception as e:
        print(f"Failed to fetch evolution chain: {e}")
        evolution_line = [name]

    return {
        "name": name,
        "level": level,
        "rarity": rarity,
        "shiny": shiny,
        "stats": stats,
        "sprite": sprite,
        "stage": 1,
        "evolution_line": evolution_line
    }
