import time
import random
import threading
import asyncio
from collections import deque
from TikTokLive import TikTokLiveClient
from TikTokLive.events import LikeEvent, ConnectEvent

from pokedata import get_random_pokemon
from trainers import (
    load_data, save_data, add_coins,
    add_pokemon, count_encounter, log_seen_pokemon
)
from html_generator import (
    generate_spawn_page,
    generate_teams_page,
    generate_top3_file,
    generate_progress_circle,
    generate_enhanced_pokedex,
    generate_trainer_pages,
    generate_homepage,
    generate_strongest_pokemon_ranking,
    generate_trainer_ranking_page,
    generate_pokedex_with_filter,
    generate_howto_page
)
TESTMODE = True  # False = TikTok Live aktiv, True = Testmodus

if not TESTMODE:
    client = TikTokLiveClient(unique_id="@trainertrial")

    @client.on(ConnectEvent)
    async def on_connect(event: ConnectEvent):
        print(f"✅ Verbunden mit @{event.unique_id}")

    @client.on(LikeEvent)
    async def on_like(event: LikeEvent):
        username = event.user.nickname
        print(f"❤️ @{username} hat geliked!")
        on_like_event(username)
else:
    def simulate_like():
        while True:
            username = input("Simulierter Like von (Benutzername): ")
            on_like_event(username)


# Globale Variablen
COINS_PER_LIKE = 1
SPAWN_INTERVAL = 15  # 3 Minuten
LIKE_CAP_WINDOW = 180
LIKE_CAP_MAX = 1400

like_timestamps = deque()
user_like_counts = {}
data = load_data()
last_spawn_time = time.time()
likes_since_spawn = 0
active_participants = []
current_pokemon = None

def on_like_event(username):
    global likes_since_spawn
    now = time.time()
    like_timestamps.append(now)
    while like_timestamps and now - like_timestamps[0] > LIKE_CAP_WINDOW:
        like_timestamps.popleft()

    if len(like_timestamps) <= LIKE_CAP_MAX:
        add_coins(data, username, COINS_PER_LIKE)
        user_like_counts[username] = user_like_counts.get(username, 0) + 1
        active_participants.append(username)
        likes_since_spawn += 1
        save_data(data)
    else:
        print(f"❌ Like von {username} verworfen (Like-Cap erreicht)")

def generate_catch_result_html(username, pokemon_name, caught, output_file="catch_result.html"):
    message = f"🎉 @{username} caught {pokemon_name}!" if caught else f"💨 {pokemon_name} broke free and escaped…"
    color = "#2ecc71" if caught else "#e74c3c"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f"""<!DOCTYPE html>
<html>
<head>
  <meta charset=\"UTF-8\">
  <title>Catch Result</title>
  <meta http-equiv=\"refresh\" content=\"5\">
  <style>
    body {{ background: transparent; font-family: 'Segoe UI', sans-serif; text-align: center; color: white; text-shadow: 0 0 5px black; }}
    .pokeball {{ width: 100px; height: 100px; background: linear-gradient(to bottom, red 50%, white 50%); border: 5px solid black; border-radius: 50%; margin: 50px auto 20px; position: relative; animation: bounce 1s ease-in-out; }}
    .pokeball-center {{ width: 20px; height: 20px; background: white; border: 5px solid black; border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }}
    @keyframes bounce {{ 0% {{ transform: translateY(0); }} 30% {{ transform: translateY(-30px); }} 60% {{ transform: translateY(0); }} 80% {{ transform: translateY(-10px); }} 100% {{ transform: translateY(0); }} }}
    .message {{ font-size: 24px; font-weight: bold; color: {color}; }}
  </style>
</head>
<body>
  <div class=\"pokeball\"><div class=\"pokeball-center\"></div></div>
  <div class=\"message\">{message}</div>
</body>
</html>""")

def update_html_loop():
    global last_spawn_time
    while True:
        if current_pokemon:
            generate_spawn_page(current_pokemon)
        generate_progress_circle(last_spawn_time, SPAWN_INTERVAL)
        time.sleep(1)

def clear_catch_result():
    time.sleep(1)
    with open("catch_result.html", "w", encoding="utf-8") as f:
        f.write("""<!DOCTYPE html><html><head><meta http-equiv=\"refresh\" content=\"0\"><style>body{background:transparent;}</style></head><body></body></html>""")

def start_tiktok_listener():
    asyncio.run(client.run())

# Threads starten
threading.Thread(target=update_html_loop, daemon=True).start()
if TESTMODE:
    threading.Thread(target=simulate_like, daemon=True).start()
else:
    threading.Thread(target=start_tiktok_listener, daemon=True).start()


# Hauptfang-Loop
try:
    while True:
        current_time = time.time()

        if current_time - last_spawn_time >= SPAWN_INTERVAL:
            if current_pokemon and active_participants:
                rarity = current_pokemon.get("rarity", "Common")
                base = {
                    "Common": 0.5,
                    "Rare": 0.2,
                    "Legendary": 0.05,
                    "Mythical": 0.01
                }.get(rarity, 0.5)

                level_penalty = max(current_pokemon["level"] - 5, 0) * 0.01
                like_bonus = min(len(active_participants) * 0.002, 0.3)

                chance = max(0.005, min(0.95, base - level_penalty + like_bonus))

                print(f"🎯 Fangchance für {current_pokemon['name']} ({rarity}) – Level {current_pokemon['level']}")
                print(f"Likes: {len(active_participants)} → +{like_bonus:.3f}")
                print(f"➡️ Gesamte Fangchance: {chance*100:.1f}%")

                if random.random() < chance:
                    weighted_pool = []
                    for user in user_like_counts:
                        weighted_pool.extend([user] * user_like_counts[user])
                    winner = random.choice(weighted_pool)
                    add_pokemon(data, winner, current_pokemon)
                    generate_catch_result_html(winner, current_pokemon["name"], caught=True)
                    print(f"{winner} caught {current_pokemon['name']}!")
                else:
                    generate_catch_result_html("Nobody", current_pokemon["name"], caught=False)
                    print(f"{current_pokemon['name']} escaped...")
            else:
                if current_pokemon:
                    generate_catch_result_html("Nobody", current_pokemon["name"], caught=False)
                    log_seen_pokemon(data, current_pokemon)
                    print(f"{current_pokemon['name']} escaped (no participants)...")
                else:
                    print("⚠️ Kein Pokémon vorhanden – übersprungen.")


            threading.Thread(target=clear_catch_result).start()
            generate_teams_page(data)
            generate_top3_file(data)
            generate_enhanced_pokedex(data)
            generate_trainer_pages(data)
            generate_homepage()
            generate_strongest_pokemon_ranking(data)
            generate_trainer_ranking_page(data)
            generate_pokedex_with_filter(data)
            generate_howto_page()
            save_data(data)
            active_participants.clear()
            user_like_counts.clear()
            like_timestamps.clear()

            new_pokemon = None
            for _ in range(10):
                candidate = get_random_pokemon()
                if candidate:
                    new_pokemon = candidate
                    break
                else:
                    print("⏭️ Pokémon übersprungen (nicht erste Entwicklung).")

            if new_pokemon:
                current_pokemon = new_pokemon
                count_encounter(data, current_pokemon["name"])
                save_data(data)
                generate_spawn_page(current_pokemon)
                generate_enhanced_pokedex(data)
                generate_trainer_pages(data)
                print(f"✨ A wild {current_pokemon['name']} (Level {current_pokemon['level']}) has appeared!")
            else:
                current_pokemon = None
                print("⚠️ Kein geeignetes Pokémon gefunden – übersprungen.")

            last_spawn_time = time.time()

        time.sleep(1)

except KeyboardInterrupt:
    save_data(data)
    print("🛑 Stopping the catcher system.")