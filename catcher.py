#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🔥 Catchmon Firebase Integration
Ersetzt alle JSON-Dateien durch Firebase Realtime Database

Abhängigkeiten:
pip install firebase-admin

Setup:
1. Firebase Console → Projekt Settings → Service Accounts
2. "Generate new private key" → serviceAccountKey.json herunterladen
3. DATABASE_URL in dieser Datei anpassen
"""

import json
import os
import time
import random
from typing import Dict, List, Any, Optional
import firebase_admin
from firebase_admin import credentials, db

# 🔧 FIREBASE KONFIGURATION
DATABASE_URL = "https://trainertrials-default-rtdb.europe-west1.firebasedatabase.app/"
SERVICE_ACCOUNT_PATH = "serviceAccountKey.json"

class CatchmonFirebase:
    """Firebase Realtime Database Integration für Catchmon Game"""
    
    def __init__(self, service_account_path: str = None, database_url: str = None):
        """
        Firebase initialisieren
        
        Args:
            service_account_path: Pfad zum Service Account Key
            database_url: Firebase Realtime Database URL
        """
        self.service_account_path = service_account_path or SERVICE_ACCOUNT_PATH
        self.database_url = database_url or DATABASE_URL
        self.db_ref = None
        
        if not self._initialize_firebase():
            raise Exception("Firebase-Initialisierung fehlgeschlagen!")
    
    def _initialize_firebase(self) -> bool:
        """Firebase Admin SDK initialisieren"""
        try:
            # Prüfen ob Firebase bereits initialisiert ist
            if firebase_admin._apps:
                print("🔥 Firebase bereits initialisiert")
                self.db_ref = db.reference()
                return True
            
            # Service Account Key laden
            if not os.path.exists(self.service_account_path):
                print(f"❌ Service Account Key nicht gefunden: {self.service_account_path}")
                return False
            
            # Firebase initialisieren
            cred = credentials.Certificate(self.service_account_path)
            firebase_admin.initialize_app(cred, {
                'databaseURL': self.database_url
            })
            
            self.db_ref = db.reference()
            print(f"🔥 Firebase erfolgreich initialisiert!")
            print(f"   📁 Service Account: {self.service_account_path}")
            print(f"   🌐 Database URL: {self.database_url}")
            return True
            
        except Exception as e:
            print(f"❌ Fehler beim Initialisieren von Firebase: {e}")
            return False
    
    # 🎯 SPAWN MANAGEMENT
    
    def set_current_spawn(self, catchmon_data: Dict[str, Any]) -> bool:
        """Neuen Spawn setzen"""
        try:
            spawn_data = {
                **catchmon_data,
                'timestamp': int(time.time() * 1000),
                'result': None,
                'winner': None
            }
            self.db_ref.child('spawn/current').set(spawn_data)
            print(f"🎯 Spawn gesetzt: {catchmon_data['name']} Level {catchmon_data['level']}")
            return True
        except Exception as e:
            print(f"❌ Fehler beim Setzen des Spawns: {e}")
            return False
    
    def get_current_spawn(self) -> Optional[Dict[str, Any]]:
        """Aktuellen Spawn abrufen"""
        try:
            spawn_data = self.db_ref.child('spawn/current').get()
            return spawn_data
        except Exception as e:
            print(f"❌ Fehler beim Laden des Spawns: {e}")
            return None
    
    def set_spawn_result(self, result: str, winner: str = None, donation: int = 0, duration: float = 5.0) -> bool:
        """Spawn-Ergebnis setzen (caught/escaped)"""
        try:
            result_data = {
                'result': result,
                'winner': winner,
                'donation': donation,
                'duration': duration,
                'result_timestamp': int(time.time() * 1000)
            }
            self.db_ref.child('spawn/current').update(result_data)
            print(f"✅ Spawn-Ergebnis: {result}" + (f" von {winner}" if winner else ""))
            return True
        except Exception as e:
            print(f"❌ Fehler beim Setzen des Spawn-Ergebnisses: {e}")
            return False
    
    # 👥 TRAINER MANAGEMENT
    
    def get_trainer_data(self, username: str) -> Dict[str, Any]:
        """Trainer-Daten laden (mit Standardwerten wenn nicht vorhanden)"""
        try:
            trainer_data = self.db_ref.child(f'trainers/{username}').get()
            if not trainer_data:
                # Neuen Trainer mit Standardwerten erstellen
                default_trainer = {
                    'coins': 0,
                    'team': [],
                    'donation': 0,
                    'stats': {
                        'total_catches': 0,
                        'highest_level': 0,
                        'total_encounters': 0,
                        'evolutions': 0
                    },
                    'created_at': int(time.time() * 1000)
                }
                self.db_ref.child(f'trainers/{username}').set(default_trainer)
                return default_trainer
            return trainer_data
        except Exception as e:
            print(f"❌ Fehler beim Laden der Trainer-Daten für {username}: {e}")
            return {
                'coins': 0,
                'team': [],
                'donation': 0,
                'stats': {'total_catches': 0, 'highest_level': 0, 'total_encounters': 0, 'evolutions': 0}
            }
    
    def update_trainer_data(self, username: str, data: Dict[str, Any]) -> bool:
        """Trainer-Daten aktualisieren"""
        try:
            self.db_ref.child(f'trainers/{username}').update(data)
            return True
        except Exception as e:
            print(f"❌ Fehler beim Aktualisieren der Trainer-Daten für {username}: {e}")
            return False
    
    def add_coins(self, username: str, amount: int) -> bool:
        """Coins zu Trainer hinzufügen"""
        try:
            trainer_data = self.get_trainer_data(username)
            new_coins = trainer_data.get('coins', 0) + amount
            self.db_ref.child(f'trainers/{username}/coins').set(new_coins)
            return True
        except Exception as e:
            print(f"❌ Fehler beim Hinzufügen von Coins für {username}: {e}")
            return False
    
    def add_donation(self, username: str, amount: int) -> bool:
        """Spende zu Trainer hinzufügen"""
        try:
            trainer_data = self.get_trainer_data(username)
            new_donation = trainer_data.get('donation', 0) + amount
            self.db_ref.child(f'trainers/{username}/donation').set(new_donation)
            print(f"💸 {username} hat {amount} Coins gespendet (Total: {new_donation})")
            return True
        except Exception as e:
            print(f"❌ Fehler beim Hinzufügen der Spende für {username}: {e}")
            return False
    
    def add_catch_to_trainer(self, username: str, catchmon: Dict[str, Any]) -> bool:
        """ERWEITERTE Version mit ORIGINAL Evolution-System aus paste.txt"""
        try:
            trainer_data = self.get_trainer_data(username)
            team = trainer_data.get('team', [])
            
            # Catchmon mit zusätzlichen Daten versehen
            evo_line = catchmon.get("evolution_line", [catchmon["name"]])
            catchmon["evolution_line"] = evo_line
            catchmon["stage"] = evo_line.index(catchmon["name"]) + 1 if catchmon["name"] in evo_line else 1
            catchmon["gesamtpunkte"] = calc_gesamtpunkte(catchmon)
            catchmon['caught_at'] = int(time.time() * 1000)
            catchmon['catcher'] = username
            catchmon['id'] = f"{username}_{int(time.time() * 1000)}"

            def calc_power(p):
                return p.get("gesamtpunkte") or calc_gesamtpunkte(p)

            def get_same_stage(pname, stage):
                return [p for p in team if p.get("name") == pname and p.get("stage", 1) == stage]

            RARITY_PRIORITY = {
                "Common": 1, "Rare": 2, "Starter": 3, "Legendary": 7,
                "Mythical": 8, "God": 9
            }

            evolutions_occurred = []

            # ORIGINAL Evolution Loop aus paste.txt
            evolution_attempts = 0
            max_evolution_attempts = 10
            
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

                # Evolution-Daten für Animation speichern
                evolution_data = {
                    "from": {
                        "name": catchmon.get("name", ""),
                        "sprite": catchmon.get("sprite", ""),
                        "level": catchmon.get("level", 1),
                        "stage": catchmon.get("stage", 1)
                    },
                    "to": None
                }

                new_stats = merge_stats(catchmon.get("stats", {}), mergee.get("stats", {}))
                new_level = max(catchmon.get("level", 1), mergee.get("level", 1))
                new_rarity = catchmon.get("rarity", "Common")
                mergee_rarity = mergee.get("rarity", "Common")
                
                if RARITY_PRIORITY.get(mergee_rarity, 0) > RARITY_PRIORITY.get(new_rarity, 0):
                    new_rarity = mergee_rarity
                    
                new_sprite = f"{BASE_FOLDER}/{new_rarity}/{next_name}.png".replace("\\", "/")
                
                # Catchmon aktualisieren
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

                # Evolution-Daten vervollständigen
                evolution_data["to"] = {
                    "name": catchmon.get("name", ""),
                    "sprite": catchmon.get("sprite", ""),
                    "level": catchmon.get("level", 1),
                    "stage": catchmon.get("stage", 1)
                }
                
                evolutions_occurred.append(evolution_data)
                self.increment_global_stat('total_evolutions')
                
                print(f"🔥 EVOLUTION! {evolution_data['from']['name']} → {evolution_data['to']['name']}")

                next_matches = get_same_stage(next_name, next_stage)
                if len(next_matches) >= 3:
                    weakest = min(next_matches, key=calc_power)
                    if calc_power(catchmon) > calc_power(weakest):
                        team.remove(weakest)
                    else:
                        team.append(mergee)
                        break

            # Final team addition logic
            same_stage = get_same_stage(catchmon.get("name", ""), catchmon.get("stage", 1))
            if len(same_stage) >= 3:
                weakest = min(same_stage, key=calc_power)
                if calc_power(catchmon) > calc_power(weakest):
                    team.remove(weakest)
                else:
                    print(f"⚠️ {catchmon.get('name')} nicht stark genug für Team von {username}")
                    return False

            team.append(catchmon)

            # Statistiken aktualisieren
            stats = trainer_data.get('stats', {})
            stats['total_catches'] = stats.get('total_catches', 0) + 1
            stats['highest_level'] = max(stats.get('highest_level', 0), catchmon['level'])
            if evolutions_occurred:
                stats['evolutions'] = stats.get('evolutions', 0) + len(evolutions_occurred)

            # Alles in Firebase speichern
            updates = {
                f'trainers/{username}/team': team,
                f'trainers/{username}/stats': stats
            }
            self.db_ref.update(updates)

            # Global Stats aktualisieren
            self._update_highest_level_global(catchmon, username)

            # Evolution-Animation auslösen wenn Evolutionen aufgetreten sind
            if evolutions_occurred:
                self._trigger_fusion_animation(username, evolutions_occurred)

            print(f"🎉 {username} hat {catchmon['name']} Level {catchmon['level']} gefangen!")
            if evolutions_occurred:
                print(f"🌟 {len(evolutions_occurred)} Evolution(en) aufgetreten!")
            
            return True
            
        except Exception as e:
            print(f"❌ Fehler beim Hinzufügen des Catchmons für {username}: {e}")
            return False
    
    def _trigger_fusion_animation(self, username: str, evolutions: List[Dict[str, Any]]):
        """Löst Fusion-Animation für OBS aus"""
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
            
        except Exception as e:
            print(f"❌ Fehler beim Auslösen der Fusion-Animation: {e}")
    
    def count_encounter(self, username: str, catchmon_name: str) -> bool:
        """Encounter für einen Trainer zählen"""
        try:
            self.db_ref.child(f'trainers/{username}/stats/total_encounters').transaction(
                lambda x: (x or 0) + 1
            )
            return True
        except Exception as e:
            print(f"❌ Fehler beim Zählen der Encounters für {username}: {e}")
            return False
    
    # 📊 GLOBAL STATS
    
    def get_global_stats(self) -> Dict[str, Any]:
        """Globale Statistiken abrufen"""
        try:
            stats = self.db_ref.child('global').get()
            if not stats:
                default_stats = {
                    'total_likes_ever': 0,
                    'total_spawns': 0,
                    'total_catches': 0,
                    'total_escapes': 0,
                    'total_evolutions': 0,
                    'highest_level_catchmon': {
                        'name': 'None',
                        'level': 0,
                        'catcher': 'None'
                    }
                }
                self.db_ref.child('global').set(default_stats)
                return default_stats
            return stats
        except Exception as e:
            print(f"❌ Fehler beim Laden der globalen Statistiken: {e}")
            return {}
    
    def increment_global_stat(self, stat_name: str, amount: int = 1) -> bool:
        """Globale Statistik erhöhen"""
        try:
            self.db_ref.child(f'global/{stat_name}').transaction(
                lambda x: (x or 0) + amount
            )
            return True
        except Exception as e:
            print(f"❌ Fehler beim Erhöhen der globalen Statistik {stat_name}: {e}")
            return False
    
    def _update_highest_level_global(self, catchmon: Dict[str, Any], catcher: str) -> bool:
        """Höchstes Level global aktualisieren"""
        try:
            current_highest = self.db_ref.child('global/highest_level_catchmon').get()
            if not current_highest or catchmon['level'] > current_highest.get('level', 0):
                new_highest = {
                    'name': catchmon['name'],
                    'level': catchmon['level'],
                    'catcher': catcher,
                    'timestamp': int(time.time() * 1000)
                }
                self.db_ref.child('global/highest_level_catchmon').set(new_highest)
                print(f"🏆 Neues höchstes Level: {catchmon['name']} Level {catchmon['level']} von {catcher}!")
            return True
        except Exception as e:
            print(f"❌ Fehler beim Aktualisieren des höchsten Levels: {e}")
            return False
    
    # ❤️ LIKES MANAGEMENT
    
    def increment_user_likes(self, username: str, amount: int = 1) -> int:
        """User-Likes erhöhen und neue Anzahl zurückgeben"""
        try:
            new_likes = self.db_ref.child(f'likes/{username}').transaction(
                lambda x: (x or 0) + amount
            )
            return new_likes
        except Exception as e:
            print(f"❌ Fehler beim Erhöhen der Likes für {username}: {e}")
            return 0
    
    def get_user_likes(self, username: str) -> int:
        """User-Likes abrufen"""
        try:
            likes = self.db_ref.child(f'likes/{username}').get()
            return likes or 0
        except Exception as e:
            print(f"❌ Fehler beim Laden der Likes für {username}: {e}")
            return 0
    
    def get_likes_leaderboard(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Top Likes Leaderboard"""
        try:
            likes_data = self.db_ref.child('likes').order_by_value().limit_to_last(limit).get()
            if not likes_data:
                return []
            
            # In Liste umwandeln und sortieren
            leaderboard = []
            for username, likes in likes_data.items():
                leaderboard.append({'username': username, 'likes': likes})
            
            return sorted(leaderboard, key=lambda x: x['likes'], reverse=True)
        except Exception as e:
            print(f"❌ Fehler beim Laden des Likes Leaderboards: {e}")
            return []
    
    def reset_all_likes(self) -> bool:
        """Alle User-Likes zurücksetzen (z.B. nach Spawn)"""
        try:
            self.db_ref.child('likes').set({})
            return True
        except Exception as e:
            print(f"❌ Fehler beim Zurücksetzen der Likes: {e}")
            return False
    
    # 💨 ESCAPED CATCHMONS
    
    def log_escaped_catchmon(self, catchmon: Dict[str, Any]) -> bool:
        """Entkommen Catchmon in Escaped-Liste speichern"""
        try:
            escaped_data = {
                **catchmon,
                'escaped_at': int(time.time() * 1000),
                'total_likes': self.get_global_stats().get('total_likes_ever', 0)
            }
            self.db_ref.child('escaped').push(escaped_data)
            print(f"💨 {catchmon['name']} ist entkommen und wurde geloggt")
            return True
        except Exception as e:
            print(f"❌ Fehler beim Hinzufügen zur Escaped-Liste: {e}")
            return False
    
    def get_escaped_list(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Letzte entkommen Catchmons"""
        try:
            escaped = self.db_ref.child('escaped').order_by_child('escaped_at').limit_to_last(limit).get()
            if not escaped:
                return []
            return list(escaped.values())
        except Exception as e:
            print(f"❌ Fehler beim Laden der Escaped-Liste: {e}")
            return []
    
    # 🔧 UTILITY & MIGRATION
    
    def initialize_database_structure(self) -> bool:
        """Datenbank-Struktur initialisieren (nur einmal ausführen)"""
        try:
            initial_data = {
                'spawn': {
                    'current': {
                        'name': 'Pikachu',
                        'sprite': 'catchmon/Starter/Pikachu.png',
                        'level': 1,
                        'rarity': 'Starter',
                        'shiny': False,
                        'timestamp': int(time.time() * 1000),
                        'result': None,
                        'winner': None,
                        'stats': {
                            'hp': 35,
                            'attack': 55,
                            'defense': 40,
                            'speed': 90
                        }
                    }
                },
                'trainers': {},
                'global': {
                    'total_likes_ever': 0,
                    'total_spawns': 1,
                    'total_catches': 0,
                    'total_escapes': 0,
                    'total_evolutions': 0,
                    'highest_level_catchmon': {
                        'name': 'None',
                        'level': 0,
                        'catcher': 'None'
                    }
                },
                'likes': {},
                'escaped': {}
            }
            
            self.db_ref.set(initial_data)
            print("🔥 Datenbank-Struktur initialisiert!")
            return True
        except Exception as e:
            print(f"❌ Fehler beim Initialisieren der Datenbank: {e}")
            return False
    
    def migrate_from_json_files(self, json_dir: str = '.') -> Dict[str, Any]:
        """Migration von alten JSON-Dateien zu Firebase"""
        print("🔄 Starte JSON-Migration zu Firebase...")
        
        migration_results = {
            'success': [],
            'failed': [],
            'migrated_data': {}
        }
        
        # spawn_data.json migrieren
        try:
            spawn_file = os.path.join(json_dir, 'spawn_data.json')
            if os.path.exists(spawn_file):
                with open(spawn_file, 'r', encoding='utf-8') as f:
                    spawn_data = json.load(f)
                self.db_ref.child('spawn/current').set(spawn_data)
                migration_results['success'].append('spawn_data.json')
                print("✅ spawn_data.json migriert")
        except Exception as e:
            migration_results['failed'].append(f'spawn_data.json: {e}')
        
        # catcher.json migrieren
        try:
            catcher_file = os.path.join(json_dir, 'catcher.json')
            if os.path.exists(catcher_file):
                with open(catcher_file, 'r', encoding='utf-8') as f:
                    catcher_data = json.load(f)
                
                # Trainers migrieren
                if 'catcher' in catcher_data:
                    self.db_ref.child('trainers').set(catcher_data['catcher'])
                
                # Escaped migrieren
                if 'escaped' in catcher_data:
                    for escaped_item in catcher_data['escaped']:
                        self.db_ref.child('escaped').push(escaped_item)
                
                migration_results['success'].append('catcher.json')
                print("✅ catcher.json migriert")
        except Exception as e:
            migration_results['failed'].append(f'catcher.json: {e}')
        
        # global_stats.json migrieren
        try:
            global_file = os.path.join(json_dir, 'global_stats.json')
            if os.path.exists(global_file):
                with open(global_file, 'r', encoding='utf-8') as f:
                    global_data = json.load(f)
                self.db_ref.child('global').set(global_data)
                migration_results['success'].append('global_stats.json')
                print("✅ global_stats.json migriert")
        except Exception as e:
            migration_results['failed'].append(f'global_stats.json: {e}')
        
        print(f"\n📊 Migration abgeschlossen:")
        print(f"   ✅ Erfolgreich: {len(migration_results['success'])} Dateien")
        print(f"   ❌ Fehlgeschlagen: {len(migration_results['failed'])} Dateien")
        
        if migration_results['failed']:
            print("   Fehler:")
            for error in migration_results['failed']:
                print(f"     - {error}")
        
        return migration_results
    
    def debug_database(self) -> Optional[Dict[str, Any]]:
        """Debug: Aktuelle Datenbankstruktur anzeigen"""
        try:
            data = self.db_ref.get()
            print("🔍 Aktuelle Datenbank-Struktur:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            return data
        except Exception as e:
            print(f"❌ Fehler beim Debug: {e}")
            return None

# 🎮 ORIGINAL CATCHMON GAME LOGIC (aus deiner paste.txt)

import numpy as np

BASE_FOLDER = "catchmon"

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
    """Lädt Evolution Lines"""
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

def get_score_multiplier(rarity):
    """Holt Score-Multiplier basierend auf Rarity"""
    return RARITY_SCORE_MULTIPLIERS.get(rarity, 1.0)

def calc_gesamtpunkte(p):
    """Berechnet Gesamtpunkte eines Catchmons"""
    try:
        base = (p.get("level", 1)) * 100
        stat_sum = sum(p.get("stats", {}).values())
        shiny_bonus = 10000 if p.get("shiny", False) else 0
        multiplier = get_score_multiplier(p.get("rarity", "Common"))
        return round((base + stat_sum + shiny_bonus) * multiplier)
    except Exception as e:
        print(f"⚠️ Error calculating points: {e}")
        return 100

def get_weighted_level():
    """Generiert gewichtetes Level (niedrigere Level häufiger)"""
    try:
        levels = list(range(1, 101))
        weights = [1 / (lvl ** 1) for lvl in levels]
        return random.choices(levels, weights=weights, k=1)[0]
    except Exception as e:
        print(f"⚠️ Error getting weighted level: {e}")
        return random.randint(1, 50)

def get_random_catchmon():
    """ORIGINAL Catchmon-Generator aus deiner paste.txt"""
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
            print("❌ Keine Catchmon-Bilder gefunden!")
            return None

        base_candidates = []
        for e in entries:
            evo_line = get_evolution_line(e["name"])
            if not evo_line or e["name"].lower() != evo_line[0].lower():
                continue
            base_candidates.append(e)

        if not base_candidates:
            print("❌ Keine Base-Evolutionen gefunden!")
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
    """Berechnet effektive Likes mit Max-Cap"""
    return min(MAX_EFFECTIVE_LIKES, real_likes * multiplier)

def get_catch_rate_per_like(level, rarity):
    """Berechnet Fangrate pro Like"""
    try:
        rarity_factor = RARITY_MULTIPLIERS.get(rarity, 1.0)
        level_penalty = np.exp(0.02 * (level - 1))
        return BASE_CATCH_RATE * rarity_factor / level_penalty
    except Exception as e:
        print(f"⚠️ Error calculating catch rate: {e}")
        return BASE_CATCH_RATE

def calculate_catch_chance(catchmon, like_data, global_likes):
    """ORIGINAL Fangchancen-Berechnung aus deiner paste.txt"""
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

def roll_catch(chances):
    """ORIGINAL Roll-System aus deiner paste.txt"""
    try:
        winners = [user for user, chance in chances.items() if random.random() <= chance]
        return random.choice(winners) if winners else None
    except Exception as e:
        print(f"⚠️ Error rolling catch: {e}")
        return None

def merge_stats(stats1, stats2):
    """Merged zwei Stat-Dictionaries"""
    try:
        return {k: stats1.get(k, 0) + stats2.get(k, 0) for k in set(stats1.keys()) | set(stats2.keys())}
    except Exception as e:
        print(f"⚠️ Error merging stats: {e}")
        return stats1

# 🔧 LEGACY FUNCTIONS FÜR KOMPATIBILITÄT
# Diese Funktionen sind für die Umstellung von tiktok_catcher.py gedacht

# Globale Firebase-Instanz
_firebase = None

def init_firebase(service_account_path: str = None, database_url: str = None) -> CatchmonFirebase:
    """Firebase initialisieren und globale Instanz setzen"""
    global _firebase
    if not _firebase:
        _firebase = CatchmonFirebase(service_account_path, database_url)
    return _firebase

def get_firebase() -> CatchmonFirebase:
    """Globale Firebase-Instanz abrufen"""
    global _firebase
    if not _firebase:
        _firebase = init_firebase()
    return _firebase

# Legacy-Funktionen für Kompatibilität mit tiktok_catcher.py
def load_data():
    """Legacy: Lädt alle Trainer-Daten (für Kompatibilität)"""
    try:
        fb = get_firebase()
        trainers = fb.db_ref.child('trainers').get() or {}
        escaped = fb.get_escaped_list()
        return {
            "catcher": trainers,
            "escaped": escaped
        }
    except Exception as e:
        print(f"❌ Fehler beim Laden der Legacy-Daten: {e}")
        return {"catcher": {}, "escaped": []}

def save_data(data):
    """Legacy: Speichert Daten (für Kompatibilität - macht nichts, da Firebase auto-sync)"""
    pass  # Firebase aktualisiert automatisch

def add_coins(data, username, amount):
    """Legacy: Coins hinzufügen"""
    fb = get_firebase()
    fb.add_coins(username, amount)

def add_catchmon(data, username, catchmon):
    """Legacy: Catchmon hinzufügen"""
    fb = get_firebase()
    fb.add_catch_to_trainer(username, catchmon)

def count_encounter(data, catchmon_name):
    """Legacy: Encounter zählen (vereinfacht)"""
    pass  # Wird jetzt in add_catch_to_trainer behandelt

def log_escaped_catchmon(data, catchmon):
    """Legacy: Escaped Catchmon loggen"""
    fb = get_firebase()
    fb.log_escaped_catchmon(catchmon)

# 🎮 HAUPTFUNKTION

def main():
    """Hauptfunktion für Tests und Setup"""
    print("🔥 Catchmon Firebase Integration")
    print("=" * 50)
    
    try:
        # Firebase initialisieren
        if os.path.exists(SERVICE_ACCOUNT_PATH):
            catchmon_db = CatchmonFirebase(SERVICE_ACCOUNT_PATH, DATABASE_URL)
        else:
            print("❌ Service Account Key nicht gefunden!")
            print(f"   Suche nach: {SERVICE_ACCOUNT_PATH}")
            print(f"   Im Ordner: {os.getcwd()}")
            print("   Vorhandene JSON-Dateien:")
            for file in os.listdir('.'):
                if file.endswith('.json'):
                    print(f"     - {file}")
            print("\n   Anleitung: Firebase Console → Project Settings → Service Accounts → Generate new private key")
            return None
        
        # Startup-Informationen anzeigen
        print("\n📊 Startup Informationen:")
        global_stats = catchmon_db.get_global_stats()
        print(f"   🌟 Total Likes Ever: {global_stats.get('total_likes_ever', 0)}")
        print(f"   🎯 Total Spawns: {global_stats.get('total_spawns', 0)}")
        print(f"   ✅ Total Catches: {global_stats.get('total_catches', 0)}")
        print(f"   💨 Total Escapes: {global_stats.get('total_escapes', 0)}")
        print(f"   🌟 Total Evolutions: {global_stats.get('total_evolutions', 0)}")
        
        highest = global_stats.get('highest_level_catchmon', {})
        print(f"   🏆 Highest Level: {highest.get('name', 'None')} Level {highest.get('level', 0)} ({highest.get('catcher', 'None')})")
        
        # Aktuellen Spawn anzeigen
        current_spawn = catchmon_db.get_current_spawn()
        if current_spawn:
            print(f"\n🎯 Aktueller Spawn: {current_spawn.get('name', 'Unknown')} (Level {current_spawn.get('level', '?')})")
            print(f"   Rarity: {current_spawn.get('rarity', 'Unknown')}")
            print(f"   Shiny: {'✨ Ja' if current_spawn.get('shiny') else '❌ Nein'}")
            if current_spawn.get('result'):
                print(f"   Status: {current_spawn['result']}" + (f" von {current_spawn.get('winner', 'Unknown')}" if current_spawn.get('winner') else ""))
        
        print(f"\n🔥 Firebase-Verbindung erfolgreich! Bereit für Catchmon-Action!")
        
        return catchmon_db
        
    except Exception as e:
        print(f"❌ Fehler beim Starten: {e}")
        return None

if __name__ == "__main__":
    # Beispiel-Usage
    db = main()
    
    if db:
        print("\n🎮 Beispiel-Aktionen verfügbar:")
        print("   db.debug_database()                    # Datenbank-Struktur anzeigen")
        print("   db.initialize_database_structure()     # Struktur initialisieren")
        print("   db.migrate_from_json_files('.')        # JSON-Dateien migrieren")
        print("   db.get_likes_leaderboard()             # Top Likes anzeigen")