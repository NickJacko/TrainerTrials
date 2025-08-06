#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🎯 TikTok Catchmon Game - Firebase Version (Anti-Flicker Fixed)
Vollständig auf Firebase Realtime Database umgestellt
FIXED: Atomic JSON writing verhindert Flackern in OBS Overlays

Abhängigkeiten:
pip install firebase-admin TikTokLive

Setup:
1. serviceAccountKey.json in Projekt-Ordner
2. Firebase Realtime Database URL konfigurieren
3. TikTok Unique ID anpassen (@trainertrial)
"""

import time
import random
import threading
import asyncio
import json
import os
import tempfile
from collections import deque
from TikTokLive import TikTokLiveClient
from TikTokLive.events import LikeEvent, ConnectEvent

# Firebase Integration
from catcher import CatchmonFirebase, get_random_catchmon, calculate_catch_chance, roll_catch

# 🔧 KONFIGURATION
TESTMODE = True  # False = TikTok Live aktiv
COINS_PER_LIKE = 1
SPAWN_INTERVAL = 15
DEFAULT_ANIMATION_DURATION = 5.0

# Firebase-Konfiguration
DATABASE_URL = "https://trainertrials-default-rtdb.europe-west1.firebasedatabase.app/"
SERVICE_ACCOUNT_PATH = "serviceAccountKey.json"

# TikTok-Konfiguration
TIKTOK_USERNAME = "@trainertrial"

# 🔥 FIREBASE INITIALISIERUNG
print("🔥 Initialisiere Firebase...")
try:
    db = CatchmonFirebase(SERVICE_ACCOUNT_PATH, DATABASE_URL)
    print("✅ Firebase erfolgreich verbunden!")
except Exception as e:
    print(f"❌ Firebase-Fehler: {e}")
    exit(1)

# 🎮 SPIEL-VARIABLEN
user_like_counts = {}  # Session-Likes (werden nach Spawn zurückgesetzt)
active_participants = set()
current_catchmon = None
last_spawn_time = time.time()
evaluated = False
animation_end_time = 0

# 📱 TIKTOK LIVE INTEGRATION
if not TESTMODE:
    client = TikTokLiveClient(unique_id=TIKTOK_USERNAME)

    @client.on(ConnectEvent)
    async def on_connect(event: ConnectEvent):
        print(f"✅ Verbunden mit {event.unique_id}")

    @client.on(LikeEvent)
    async def on_like(event: LikeEvent):
        username = event.user.nickname
        print(f"❤️ @{username} hat geliked!")
        on_like_event(username)

# 🛡️ ATOMIC FILE WRITING - Verhindert Flackern
def atomic_write_json(filename: str, data: dict, indent: int = 2):
    """
    Schreibt JSON atomic - Datei ist niemals leer/korrupt
    Verhindert Flackern in OBS Overlays
    """
    try:
        # Erstelle temporäre Datei im gleichen Verzeichnis
        temp_dir = os.path.dirname(os.path.abspath(filename))
        temp_fd, temp_path = tempfile.mkstemp(dir=temp_dir, suffix='.tmp')
        
        try:
            with os.fdopen(temp_fd, 'w', encoding='utf-8') as temp_file:
                json.dump(data, temp_file, indent=indent, ensure_ascii=False)
            
            # Atomic rename - garantiert keine leere/korrupte Datei
            if os.name == 'nt':  # Windows
                try:
                    os.remove(filename)
                except FileNotFoundError:
                    pass
            os.rename(temp_path, filename)
            
        except Exception:
            # Cleanup bei Fehler
            try:
                os.unlink(temp_path)
            except:
                pass
            raise
            
    except Exception as e:
        print(f"❌ Fehler beim atomic write von {filename}: {e}")
        # Fallback zu normalem write
        try:
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=indent, ensure_ascii=False)
        except Exception as e2:
            print(f"❌ Auch Fallback-Write fehlgeschlagen: {e2}")

# 🧪 TEST-MODUS SIMULATION
def simulate_like():
    """Simuliert Likes und Spenden für Test-Zwecke"""
    while True:
        try:
            user_input = input("🧪 Eingabe (!donate <name> <betrag>, !like <name> <anzahl>, oder name für like): ").strip()
            
            if user_input.startswith("!donate "):
                try:
                    parts = user_input.split()
                    name = parts[1]
                    amount = int(parts[2])
                    handle_donation(name, amount)
                    print(f"💸 {name} hat {amount} Coins gespendet.")
                except (IndexError, ValueError):
                    print("❌ Format: !donate Nick 50")
                    
            elif user_input.startswith("!like "):
                try:
                    parts = user_input.split()
                    name = parts[1]
                    count = int(parts[2])
                    for _ in range(count):
                        on_like_event(name)
                    print(f"👍 {name} hat {count} Likes simuliert.")
                except (IndexError, ValueError):
                    print("❌ Format: !like Nick 5")
                    
            elif user_input.startswith("!debug"):
                print_debug_info()
                
            elif user_input.startswith("!stats"):
                print_global_stats()
                
            elif user_input.startswith("!reset"):
                reset_session_data()
                
            else:
                # Einzelner Like
                if user_input:
                    on_like_event(user_input)
                    
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"❌ Fehler in simulate_like: {e}")

def handle_donation(username: str, amount: int):
    """Behandelt Spenden"""
    try:
        # Spende in Firebase speichern
        success = db.add_donation(username, amount)
        if success:
            # Spenden-Animation auslösen
            trigger_donation_animation(username, amount)
        return success
    except Exception as e:
        print(f"❌ Fehler bei Spende von {username}: {e}")
        return False

def trigger_donation_animation(donor_name: str, amount: int):
    """Löst die Spenden-Animation für OBS aus"""
    try:
        # Aktuelle Spenden-Summe des Trainers abrufen
        trainer_data = db.get_trainer_data(donor_name)
        total_donation = trainer_data.get('donation', 0)
        
        # Animation-Trigger-Datei für OBS erstellen - ATOMIC WRITE
        animation_data = {
            "donor": donor_name,
            "amount": amount,
            "total_donation": total_donation,
            "timestamp": time.time()
        }
        
        atomic_write_json("donation_trigger.json", animation_data)
        
        print(f"🎬 Spenden-Animation für {donor_name} ({amount} Coins, Total: {total_donation}) ausgelöst!")
        
    except Exception as e:
        print(f"❌ Fehler beim Auslösen der Animation: {e}")

def on_like_event(username: str):
    """Behandelt Like-Events - Session-basiert"""
    try:
        # Coins zu Trainer hinzufügen (Firebase)
        db.add_coins(username, COINS_PER_LIKE)
        
        # SESSION-LIKES erhöhen (NUR in-memory!)
        user_like_counts[username] = user_like_counts.get(username, 0) + 1
        active_participants.add(username)
        
        # Global Stats aktualisieren (Firebase - für Lifetime Stats)
        db.increment_global_stat('total_likes_ever')
        
        # Global Level JSON für OBS aktualisieren - ATOMIC WRITE
        update_global_level_json()
        
        # FANGCHANCEN SOFORT AKTUALISIEREN - ATOMIC WRITE
        update_catch_chances_live()
        
        print(f"👍 {username}: +{COINS_PER_LIKE} Coins | Session-Likes: {user_like_counts[username]} | Total Participants: {len(active_participants)}")
        
    except Exception as e:
        print(f"❌ Fehler beim Like-Event für {username}: {e}")

def update_global_level_json():
    """Aktualisiert global_level.json für OBS - ATOMIC WRITE"""
    try:
        global_stats = db.get_global_stats()
        level_data = {"global_likes": global_stats.get("total_likes_ever", 0)}
        
        atomic_write_json("global_level.json", level_data)
        
    except Exception as e:
        print(f"❌ Fehler beim Update von global_level.json: {e}")

def update_catch_chances_live():
    """
    🛡️ ANTI-FLICKER VERSION
    Aktualisiert Fangchancen in Echtzeit für aktuelle Session
    Verwendet atomic writing um Flackern zu verhindern
    """
    try:
        if not current_catchmon or not active_participants:
            # Leere Fangchancen wenn kein Spawn oder keine Teilnehmer - ATOMIC WRITE
            atomic_write_json("catch_chances.json", {})
            return

        # Like-Daten mit Multiplikatoren sammeln (NUR Session-Likes!)
        like_data = {}
        for user in active_participants:
            trainer_data = db.get_trainer_data(user)
            donation = trainer_data.get("donation", 0)
            
            # Multiplier basierend auf Spenden (genau wie vorher)
            if donation >= 2500:
                multiplier = 5
            elif donation >= 500:
                multiplier = 4
            elif donation >= 250:
                multiplier = 3
            elif donation >= 100:
                multiplier = 2
            else:
                multiplier = 1
            
            session_likes = user_like_counts.get(user, 0)  # NUR Session-Likes!
            
            like_data[user] = {
                "likes": session_likes,
                "multiplier": multiplier
            }

        # Gewichtete Likes berechnen (für diese Session)
        global_likes = sum(entry["likes"] * entry["multiplier"] for entry in like_data.values())
        
        # Fangchancen mit ORIGINAL Formel berechnen
        chances = calculate_catch_chance(current_catchmon, like_data, global_likes)

        # Erweiterte Daten für top3_catch.html Overlay
        detailed_chances = {}
        for user, chance in chances.items():
            trainer_data = db.get_trainer_data(user)
            donation = trainer_data.get("donation", 0)
            
            detailed_chances[user] = {
                "chance": chance,
                "likes": user_like_counts.get(user, 0),  # Session-Likes
                "multiplier": like_data[user]["multiplier"],
                "weighted_likes": like_data[user]["likes"] * like_data[user]["multiplier"],
                "donation": donation,
                "level": trainer_data.get("stats", {}).get("highest_level", 1),
                "total_catches": trainer_data.get("stats", {}).get("total_catches", 0),
                "coins": trainer_data.get("coins", 0)  # Für Level-Berechnung
            }

        # 🛡️ ATOMIC WRITE - Verhindert Flackern in top3_catch.html
        atomic_write_json("catch_chances.json", detailed_chances)
            
        print(f"📊 Fangchancen atomic aktualisiert: {len(detailed_chances)} Teilnehmer, {global_likes} gewichtete Likes")
            
    except Exception as e:
        print(f"❌ Fehler beim Update der Fangchancen: {e}")
        # Fallback: Leere Datei erstellen - ATOMIC WRITE
        try:
            atomic_write_json("catch_chances.json", {})
        except:
            pass

def save_spawn_data_to_json(catchmon: dict, result: str = None, winner: str = None, donation: int = 0, duration: float = DEFAULT_ANIMATION_DURATION):
    """Speichert Spawn-Daten als JSON für OBS-Kompatibilität - ATOMIC WRITE"""
    try:
        current_time_ms = int(time.time() * 1000)
        current_time_s = int(time.time())
        
        spawn_data = {
            **catchmon,
            "result": result,
            "winner": winner,
            "donation": donation,
            "duration": duration,
            "timestamp": current_time_ms,  # Für allgemeine Verwendung (Millisekunden)
            "spawn_start": current_time_s,  # Für Timer-Berechnung in spawn.html (Sekunden)
            "spawn_interval": SPAWN_INTERVAL,  # WICHTIG: Korrekter Interval (15 statt 120)
            "SPAWN_INTERVAL": SPAWN_INTERVAL   # Zusätzlich für Kompatibilität
        }
        
        # ATOMIC WRITE
        atomic_write_json("spawn_data.json", spawn_data)
            
        print(f"📄 spawn_data.json atomic aktualisiert: {catchmon['name']} (spawn_start: {current_time_s}, interval: {SPAWN_INTERVAL}s)")
            
    except Exception as e:
        print(f"❌ Fehler beim Speichern der Spawn-Daten: {e}")

def process_spawn_result():
    """Verarbeitet das Ergebnis eines Spawns nach dem Timer"""
    try:
        if not active_participants:
            # Kein Teilnehmer - automatisch entkommen
            print(f"💨 {current_catchmon['name']} ist entkommen (keine Teilnehmer)")
            
            # In Firebase als escaped loggen
            db.log_escaped_catchmon(current_catchmon)
            db.increment_global_stat('total_escapes')
            
            # Firebase Spawn-Ergebnis setzen
            db.set_spawn_result("escaped", duration=DEFAULT_ANIMATION_DURATION)
            
            # JSON für OBS - ATOMIC UPDATE
            try:
                # Bestehende Daten lesen
                with open("spawn_data.json", "r", encoding="utf-8") as f:
                    existing_data = json.load(f)
                existing_data.update({
                    "result": "escaped",
                    "duration": DEFAULT_ANIMATION_DURATION
                })
                # ATOMIC WRITE
                atomic_write_json("spawn_data.json", existing_data)
                print(f"📄 spawn_data.json atomic aktualisiert: escaped (keine Teilnehmer)")
            except Exception as e:
                print(f"❌ Fehler beim Aktualisieren der spawn_data.json: {e}")
                # Fallback
                save_spawn_data_to_json(current_catchmon, result="escaped", duration=DEFAULT_ANIMATION_DURATION)
            
            # Leere Fangchancen für Overlay - ATOMIC WRITE
            atomic_write_json("catch_chances.json", {})
            
            return DEFAULT_ANIMATION_DURATION
        
        # Like-Daten sammeln
        like_data = {}
        for user in active_participants:
            trainer_data = db.get_trainer_data(user)
            donation = trainer_data.get("donation", 0)
            
            # Multiplier basierend auf Spenden
            if donation >= 2500:
                multiplier = 5
            elif donation >= 500:
                multiplier = 4
            elif donation >= 250:
                multiplier = 3
            elif donation >= 100:
                multiplier = 2
            else:
                multiplier = 1
            
            like_data[user] = {
                "likes": user_like_counts.get(user, 0),
                "multiplier": multiplier
            }

        # Gewichtete Likes und Fangchancen berechnen
        global_likes = sum(entry["likes"] * entry["multiplier"] for entry in like_data.values())
        chances = calculate_catch_chance(current_catchmon, like_data, global_likes)

        # Fangchancen für OBS speichern - ATOMIC WRITE
        atomic_write_json("catch_chances.json", chances)

        # Gewinner ermitteln
        winner = roll_catch(chances)

        if winner:
            # GEFANGEN!
            trainer_data = db.get_trainer_data(winner)
            donation = trainer_data.get("donation", 0)
            
            # Catchmon zu Trainer hinzufügen (mit Auto-Evolution)
            db.add_catch_to_trainer(winner, current_catchmon)
            
            # Global Stats aktualisieren
            db.increment_global_stat('total_catches')
            
            print(f"🎉 {winner} hat {current_catchmon['name']} Level {current_catchmon['level']} gefangen!")
            
            # Dynamische Animationsdauer basierend auf Spenden
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
            
            return animation_duration
            
        else:
            # ENTKOMMEN!
            print(f"💨 {current_catchmon['name']} ist entkommen...")
            
            # In Firebase als escaped loggen
            db.log_escaped_catchmon(current_catchmon)
            db.increment_global_stat('total_escapes')
            
            # Firebase Spawn-Ergebnis setzen
            db.set_spawn_result("escaped", duration=DEFAULT_ANIMATION_DURATION)
            
            # JSON für OBS (mit Verzögerung für Animation) - ATOMIC WRITE
            def delayed_escape():
                time.sleep(0.3)
                try:
                    with open("spawn_data.json", "r", encoding="utf-8") as f:
                        existing_data = json.load(f)
                    existing_data.update({
                        "result": "escaped",
                        "duration": DEFAULT_ANIMATION_DURATION
                    })
                    # ATOMIC WRITE
                    atomic_write_json("spawn_data.json", existing_data)
                    print(f"📄 spawn_data.json atomic aktualisiert: escaped")
                except Exception as e:
                    print(f"❌ Fehler beim Aktualisieren der spawn_data.json: {e}")
                    # Fallback
                    save_spawn_data_to_json(current_catchmon, result="escaped", duration=DEFAULT_ANIMATION_DURATION)
            threading.Thread(target=delayed_escape, daemon=True).start()
            
            return DEFAULT_ANIMATION_DURATION
            
    except Exception as e:
        print(f"❌ Fehler bei der Spawn-Verarbeitung: {e}")
        return DEFAULT_ANIMATION_DURATION

def reset_session_data():
    """Setzt Session-Daten zurück (nach Spawn-Ende)"""
    global user_like_counts, active_participants
    
    print(f"🔄 Session-Reset: {len(active_participants)} Teilnehmer, {sum(user_like_counts.values())} Session-Likes")
    
    # Session-Daten zurücksetzen
    user_like_counts.clear()
    active_participants.clear()
    
    # Fangchancen-Datei leeren - ATOMIC WRITE
    try:
        atomic_write_json("catch_chances.json", {})
        print("✅ catch_chances.json atomic geleert")
    except Exception as e:
        print(f"❌ Fehler beim Leeren der catch_chances.json: {e}")
    
    print("✅ Session-Daten zurückgesetzt für nächsten Spawn")

def print_debug_info():
    """Debug-Informationen ausgeben"""
    print("\n🔍 DEBUG INFO:")
    print(f"   Current Catchmon: {current_catchmon['name'] if current_catchmon else 'None'}")
    print(f"   Active Participants: {len(active_participants)}")
    print(f"   Session Likes: {dict(user_like_counts)}")
    print(f"   Evaluated: {evaluated}")
    print(f"   Last Spawn: {time.time() - last_spawn_time:.1f}s ago")
    
    if current_catchmon:
        print(f"   Spawn Details: Level {current_catchmon['level']}, Rarity {current_catchmon['rarity']}")

def print_global_stats():
    """Globale Statistiken ausgeben"""
    try:
        stats = db.get_global_stats()
        print("\n📊 GLOBAL STATS:")
        print(f"   🌟 Total Likes Ever: {stats.get('total_likes_ever', 0)}")
        print(f"   🎯 Total Spawns: {stats.get('total_spawns', 0)}")
        print(f"   ✅ Total Catches: {stats.get('total_catches', 0)}")
        print(f"   💨 Total Escapes: {stats.get('total_escapes', 0)}")
        print(f"   🌟 Total Evolutions: {stats.get('total_evolutions', 0)}")
        
        highest = stats.get('highest_level_catchmon', {})
        print(f"   🏆 Highest Level: {highest.get('name', 'None')} Level {highest.get('level', 0)} ({highest.get('catcher', 'None')})")
    except Exception as e:
        print(f"❌ Fehler beim Laden der Statistiken: {e}")

def start_tiktok_listener():
    """Startet TikTok Live Listener"""
    asyncio.run(client.run())

def init_donation_trigger():
    """Initialisiert donation_trigger.json falls nicht vorhanden - ATOMIC WRITE"""
    try:
        with open("donation_trigger.json", "r", encoding="utf-8") as f:
            pass  # Datei existiert bereits
    except FileNotFoundError:
        initial_data = {"donor": None, "amount": 0, "total_donation": 0, "timestamp": 0}
        atomic_write_json("donation_trigger.json", initial_data)

# 🚀 HAUPTPROGRAMM

def main():
    """Hauptprogramm"""
    global current_catchmon, last_spawn_time, evaluated, animation_end_time
    
    print("🛡️ ANTI-FLICKER VERSION - Atomic JSON Writing aktiv!")
    
    # Initialisierung
    init_donation_trigger()
    update_global_level_json()
    
    # Global Stats beim Start anzeigen
    print_global_stats()
    
    # TikTok Listener oder Test-Modus starten
    if TESTMODE:
        print("\n🧪 TEST-MODUS AKTIV")
        print("Verfügbare Befehle:")
        print("  !donate Nick 50    - Spende simulieren")
        print("  !like Nick 5       - Multiple Likes simulieren")
        print("  Nick               - Einzelner Like")
        print("  !debug             - Debug-Info anzeigen")
        print("  !stats             - Global Stats anzeigen")
        print("  !reset             - Session zurücksetzen")
        threading.Thread(target=simulate_like, daemon=True).start()
    else:
        print(f"\n📱 TikTok Live Modus - Verbinde mit {TIKTOK_USERNAME}...")
        threading.Thread(target=start_tiktok_listener, daemon=True).start()

    print(f"🚀 Catchmon Game gestartet!")
    
    # Haupt-Game-Loop
    try:
        while True:
            current_time = time.time()

            # Neuen Spawn erstellen wenn keiner aktiv
            if current_catchmon is None:
                # Neues Catchmon generieren
                while True:
                    new_catchmon = get_random_catchmon()
                    if new_catchmon:
                        current_catchmon = new_catchmon
                        break
                
                last_spawn_time = current_time
                evaluated = False
                
                # In Firebase speichern
                db.set_current_spawn(current_catchmon)
                db.increment_global_stat('total_spawns')
                
                # JSON für OBS erstellen - ATOMIC WRITE
                save_spawn_data_to_json(current_catchmon)
                
                # Session-Likes zurücksetzen
                reset_session_data()
                
                print(f"\n🎯 Neuer Spawn: {current_catchmon['name']} Level {current_catchmon['level']} ({current_catchmon['rarity']})")
                if current_catchmon.get('shiny'):
                    print("   ✨ SHINY!")

            # Spawn-Timer abgelaufen - Auswertung
            if not evaluated and (current_time - last_spawn_time >= SPAWN_INTERVAL):
                print(f"\n⏰ Spawn-Timer abgelaufen! Werte aus...")
                print(f"📊 Session-Stats: {len(active_participants)} Teilnehmer, {sum(user_like_counts.values())} Session-Likes")
                
                # Finale Fangchancen berechnen und anzeigen - ATOMIC WRITE
                update_catch_chances_live()
                
                # Top 3 Teilnehmer anzeigen
                if active_participants:
                    sorted_participants = sorted(
                        [(user, user_like_counts.get(user, 0)) for user in active_participants],
                        key=lambda x: x[1], reverse=True
                    )[:3]
                    print("🏆 Top 3 Session-Teilnehmer:")
                    for i, (user, likes) in enumerate(sorted_participants, 1):
                        trainer_data = db.get_trainer_data(user)
                        donation = trainer_data.get("donation", 0)
                        multiplier = 5 if donation >= 2500 else 4 if donation >= 500 else 3 if donation >= 250 else 2 if donation >= 100 else 1
                        weighted = likes * multiplier
                        print(f"   {i}. {user}: {likes} Likes × {multiplier} = {weighted} gewichtet")
                
                # Spawn-Ergebnis verarbeiten
                animation_duration = process_spawn_result()
                evaluated = True
                animation_end_time = current_time + animation_duration

            # Animation beendet - nächster Spawn vorbereiten
            if evaluated and (current_time >= animation_end_time):
                print(f"\n🔄 Animation beendet - bereite nächsten Spawn vor...")
                
                # SESSION-DATEN ZURÜCKSETZEN (nicht Firebase!)
                reset_session_data()
                
                current_catchmon = None
                evaluated = False

            # Fangchancen live aktualisieren - ATOMIC WRITE
            update_catch_chances_live()
            
            time.sleep(1)

    except KeyboardInterrupt:
        print(f"\n⛔ Game gestoppt!")
        print_global_stats()

if __name__ == "__main__":
    main()