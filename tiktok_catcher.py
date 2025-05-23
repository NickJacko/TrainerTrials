import time
import random
import threading
import asyncio
import json
from collections import deque
from TikTokLive import TikTokLiveClient
from TikTokLive.events import LikeEvent, ConnectEvent

from catcher import get_random_catchmon, calculate_catch_chance, roll_catch

from catcher import (
    load_data, save_data, add_coins,
    add_catchmon, count_encounter, log_escaped_catchmon
)

from html_generator import (
    save_spawn_data,
)

TESTMODE = True  # False = TikTok Live aktiv

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

def simulate_like():
    while True:
        user_input = input("🧪 Eingabe (!donate <Name> <Betrag>, !like <Name> <Anzahl>, oder Name für Like): ").strip()
        if user_input.startswith("!donate "):
            try:
                _, name, amount = user_input.split()
                amount = int(amount)
                add_donation(data, name, amount)
                print(f"💸 {name} hat {amount} Coins gespendet.")
                
                # Spenden-Animation auslösen
                trigger_donation_animation(name, amount)
            except:
                print("❌ Falsches Format. Nutze: !donate Nick 50")
        elif user_input.startswith("!like "):
            try:
                _, name, count = user_input.split()
                count = int(count)
                for _ in range(count):
                    on_like_event(name)
                print(f"👍 {name} hat {count} Likes simuliert.")
            except:
                print("❌ Falsches Format. Nutze: !like Nick 5")
        else:
            on_like_event(user_input)

def trigger_donation_animation(donor_name, amount):
    """Löst die Spenden-Animation aus"""
    try:
        # Aktuelle Gesamtspende des Nutzers abrufen
        total_donation = data["catcher"].get(donor_name, {}).get("donation", 0)
        
        animation_data = {
            "donor": donor_name,
            "amount": amount,
            "total_donation": total_donation,
            "timestamp": time.time()
        }
        
        with open("donation_trigger.json", "w", encoding="utf-8") as f:
            json.dump(animation_data, f, ensure_ascii=False, indent=2)
        
        print(f"🎬 Spenden-Animation für {donor_name} ({amount} Coins) ausgelöst!")
        
    except Exception as e:
        print(f"❌ Fehler beim Auslösen der Animation: {e}")

COINS_PER_LIKE = 1
SPAWN_INTERVAL = 15
DEFAULT_ANIMATION_DURATION = 5.0

user_like_counts = {}
data = load_data()
likes_since_spawn = 0
active_participants = set()
current_catchmon = None
last_spawn_time = time.time()
evaluated = False
animation_end_time = 0

def add_donation(data, username, amount):
    if username not in data["catcher"]:
        data["catcher"][username] = {"coins": 0, "team": [], "donation": 0}
    data["catcher"][username]["donation"] += amount
    save_data(data)

def update_global_likes_file(global_likes):
    with open("global_likes.json", "w", encoding="utf-8") as f:
        json.dump({"global_likes": global_likes}, f)

def update_catch_chances_live():
    if not current_catchmon or not active_participants:
        with open("catch_chances.json", "w", encoding="utf-8") as f:
            json.dump({}, f)
        return

    like_data = {}
    for user in active_participants:
        catcher = data["catcher"].get(user, {})
        donation = catcher.get("donation", 0)
        multiplier = 4 if donation >= 100 else 3 if donation >= 50 else 2 if donation >= 10 else 1
        like_data[user] = {
            "likes": user_like_counts.get(user, 0),
            "multiplier": multiplier
        }

    global_likes = sum(entry["likes"] * entry["multiplier"] for entry in like_data.values())
    chances = calculate_catch_chance(current_catchmon, like_data, global_likes)

    with open("catch_chances.json", "w", encoding="utf-8") as f:
        json.dump(chances, f, indent=2)

def calculate_total_effective_likes():
    total = 0
    for user in active_participants:
        likes = user_like_counts.get(user, 0)
        donation = data["catcher"].get(user, {}).get("donation", 0)
        multiplier = 5 if donation >= 2500 else 4 if donation >= 500 else 3 if donation >= 250 else 2 if donation >= 100 else 1
        total += likes * multiplier
    return total

def on_like_event(username):
    global likes_since_spawn
    add_coins(data, username, COINS_PER_LIKE)
    user_like_counts[username] = user_like_counts.get(username, 0) + 1
    active_participants.add(username)
    likes_since_spawn += 1
    save_data(data)
    update_global_likes_file(calculate_total_effective_likes())

def start_tiktok_listener():
    asyncio.run(client.run())

# Initialisiere donation_trigger.json falls sie nicht existiert
def init_donation_trigger():
    try:
        with open("donation_trigger.json", "r", encoding="utf-8") as f:
            pass  # Datei existiert bereits
    except FileNotFoundError:
        # Erstelle leere Trigger-Datei
        with open("donation_trigger.json", "w", encoding="utf-8") as f:
            json.dump({"donor": None, "amount": 0, "total_donation": 0, "timestamp": 0}, f)

# Initialisiere die Trigger-Datei
init_donation_trigger()

if TESTMODE:
    threading.Thread(target=simulate_like, daemon=True).start()
else:
    threading.Thread(target=start_tiktok_listener, daemon=True).start()

try:
    while True:
        current_time = time.time()

        if current_catchmon is None:
            while True:
                current_catchmon = get_random_catchmon()
                if current_catchmon:
                    break
            last_spawn_time = time.time()
            evaluated = False
            save_spawn_data(current_catchmon, result=None, winner=None)
            update_global_likes_file(0)
            with open("catch_chances.json", "w", encoding="utf-8") as f:
                json.dump({}, f)

        if not evaluated and current_time - last_spawn_time >= SPAWN_INTERVAL:
            if active_participants:
                like_data = {}
                for user in active_participants:
                    catcher = data["catcher"].get(user, {})
                    donation = catcher.get("donation", 0)
                    multiplier = 4 if donation >= 100 else 3 if donation >= 50 else 2 if donation >= 10 else 1
                    like_data[user] = {
                        "likes": user_like_counts.get(user, 0),
                        "multiplier": multiplier
                    }

                global_likes = sum(entry["likes"] * entry["multiplier"] for entry in like_data.values())
                chances = calculate_catch_chance(current_catchmon, like_data, global_likes)

                with open("catch_chances.json", "w", encoding="utf-8") as f:
                    json.dump(chances, f, indent=2)

                winner = roll_catch(chances)

                if winner:
                    add_catchmon(data, winner, current_catchmon)
                    donation = data["catcher"].get(winner, {}).get("donation", 0)
                else:
                    donation = 0

                # Dynamische Animationsdauer
                if donation >= 2500:
                    animation_duration = 11.0
                elif donation >= 500:
                    animation_duration = 9.0
                elif donation >= 250:
                    animation_duration = 9.0
                elif donation >= 100:
                    animation_duration = 7.5
                else:
                    animation_duration = DEFAULT_ANIMATION_DURATION

                if winner:
                    def delayed_write():
                        time.sleep(0.3)
                        save_spawn_data(current_catchmon, result="caught", winner=winner, donation=donation, duration=animation_duration)
                    threading.Thread(target=delayed_write).start()
                    print(f"🎉 {winner} caught {current_catchmon['name']}!")
                else:
                    def delayed_escape():
                        time.sleep(0.3)
                        save_spawn_data(current_catchmon, result="escaped", duration=animation_duration)
                    threading.Thread(target=delayed_escape).start()
                    log_escaped_catchmon(data, current_catchmon)
                    print(f"{current_catchmon['name']} escaped...")

                count_encounter(data, current_catchmon["name"])
                save_data(data)
                update_global_likes_file(0)

                with open("catch_chances.json", "w", encoding="utf-8") as f:
                    json.dump({}, f)

            else:
                def delayed_escape():
                    time.sleep(0.3)
                    save_spawn_data(current_catchmon, result="escaped", duration=DEFAULT_ANIMATION_DURATION)
                threading.Thread(target=delayed_escape).start()
                log_escaped_catchmon(data, current_catchmon)
                print(f"{current_catchmon['name']} escaped (keine Teilnehmer)")
                update_global_likes_file(0)
                with open("catch_chances.json", "w", encoding="utf-8") as f:
                    json.dump({}, f)
                animation_duration = DEFAULT_ANIMATION_DURATION

            evaluated = True
            animation_end_time = current_time + animation_duration

        if evaluated and current_time >= animation_end_time:
            current_catchmon = None
            evaluated = False
            likes_since_spawn = 0
            user_like_counts.clear()
            active_participants.clear()

        update_catch_chances_live()
        time.sleep(1)

except KeyboardInterrupt:
    print("⛔ Bot gestoppt.")