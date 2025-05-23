import json
import os
import requests
from collections import defaultdict
import time

def save_spawn_data(catchmon, result=None, winner=None, donation=0, duration=3.0, output_file="spawn_data.json"):
    data = {
        "name": catchmon["name"],
        "level": catchmon["level"],
        "rarity": catchmon["rarity"],
        "shiny": catchmon["shiny"],
        "sprite": catchmon["sprite"],
        "stats": catchmon["stats"],
        "result": result,
        "winner": winner,
        "donation": donation,
        "duration": duration,
        "timestamp": int(time.time()),
        "spawn_start": int(time.time()) if result is None else None
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
