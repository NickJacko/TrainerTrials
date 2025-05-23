import os
import json

BASE_FOLDER = "catchmon"
dex = []
id_counter = 1

for rarity in os.listdir(BASE_FOLDER):
    folder = os.path.join(BASE_FOLDER, rarity)
    if not os.path.isdir(folder):
        continue
    for file in os.listdir(folder):
        if file.endswith(".png"):
            name = os.path.splitext(file)[0]
            dex.append({
                "id": id_counter,
                "name": name,
                "sprite": f"{BASE_FOLDER}/{rarity}/{file}".replace("\\", "/"),
                "gen": 1
            })
            id_counter += 1

with open("dex_list.json", "w", encoding="utf-8") as f:
    json.dump(dex, f, indent=2)
