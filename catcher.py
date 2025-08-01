#!/usr/bin/env python3
"""
🔥 Catchmon Firebase Integration - catcher.py
==============================================

Diese Datei ersetzt die alten JSON-basierten Operationen und arbeitet
direkt mit Firebase Realtime Database.

Erfordert: pip install firebase-admin
"""

import firebase_admin
from firebase_admin import credentials, db
import json
import time
import random
import os
from datetime import datetime
from typing import Dict, List, Optional, Any

class CatchmonFirebase:
    def __init__(self, service_account_path: str = None, database_url: str = None):
        """
        Firebase-Verbindung initialisieren
        
        Args:
            service_account_path: Pfad zur Service Account JSON-Datei
            database_url: Firebase Realtime Database URL
        """
        try:
            # Prüfen ob Firebase bereits initialisiert ist
            firebase_admin.get_app()
            print("🔥 Firebase bereits initialisiert")
        except ValueError:
            # Firebase initialisieren
            if service_account_path and os.path.exists(service_account_path):
                cred = credentials.Certificate(service_account_path)
                firebase_admin.initialize_app(cred, {
                    'databaseURL': database_url
                })
                print(f"🔥 Firebase initialisiert mit Service Account")
            else:
                print("❌ Service Account Key nicht gefunden!")
                print(f"   Erstelle eine Datei: {service_account_path}")
                print("   Anleitung: Firebase Console → Project Settings → Service Accounts → Generate new private key")
                raise Exception("Service Account Key erforderlich für Firebase Admin SDK")
        
        self.db_ref = db.reference()
        print(f"✅ Verbunden mit Firebase Database: {database_url}")
    
    # 🎯 SPAWN SYSTEM
    
    def get_current_spawn(self) -> Dict[str, Any]:
        """Aktuellen Spawn aus Firebase laden"""
        try:
            spawn_data = self.db_ref.child('spawn/current').get()
            if spawn_data:
                print(f"📡 Loaded spawn: {spawn_data.get('name', 'Unknown')}")
                return spawn_data
            return {}
        except Exception as e:
            print(f"❌ Fehler beim Laden des Spawns: {e}")
            return {}
    
    def set_current_spawn(self, spawn_data: Dict[str, Any]) -> bool:
        """Neuen Spawn in Firebase setzen"""
        try:
            spawn_with_timestamp = {
                **spawn_data,
                'timestamp': int(time.time() * 1000),  # Milliseconds
                'result': None,
                'winner': None
            }
            
            self.db_ref.child('spawn/current').set(spawn_with_timestamp)
            print(f"🎯 Spawn gesetzt: {spawn_data.get('name', 'Unknown')} (Level {spawn_data.get('level', '?')})")
            
            # Global Stats updaten
            self.increment_global_stat('total_spawns')
            
            return True
        except Exception as e:
            print(f"❌ Fehler beim Setzen des Spawns: {e}")
            return False
    
    def set_spawn_result(self, result: str, winner: str = None) -> bool:
        """
        Spawn-Ergebnis setzen
        
        Args:
            result: 'caught' oder 'escaped'
            winner: Name des Gewinners (bei 'caught')
        """
        try:
            updates = {
                'result': result,
                'winner': winner,
                'timestamp_result': int(time.time() * 1000)
            }
            
            self.db_ref.child('spawn/current').update(updates)
            print(f"🎉 Spawn-Ergebnis: {result}" + (f" von {winner}" if winner else ""))
            
            # Global Stats updaten
            if result == 'caught':
                self.increment_global_stat('total_catches')
            elif result == 'escaped':
                self.increment_global_stat('total_escapes')
                self.add_to_escaped_list()
            
            return True
        except Exception as e:
            print(f"❌ Fehler beim Setzen des Ergebnisses: {e}")
            return False
    
    # 👥 TRAINER SYSTEM
    
    def get_all_trainers(self) -> Dict[str, Any]:
        """Alle Trainer aus Firebase laden"""
        try:
            trainers = self.db_ref.child('trainers').get() or {}
            print(f"👥 {len(trainers)} Trainer geladen")
            return trainers
        except Exception as e:
            print(f"❌ Fehler beim Laden der Trainer: {e}")
            return {}
    
    def get_trainer(self, username: str) -> Dict[str, Any]:
        """Einzelnen Trainer laden"""
        try:
            trainer = self.db_ref.child('trainers').child(username).get() or {}
            return trainer
        except Exception as e:
            print(f"❌ Fehler beim Laden von Trainer {username}: {e}")
            return {}
    
    def add_catch_to_trainer(self, username: str, catchmon_data: Dict[str, Any]) -> bool:
        """Catchmon zu Trainer hinzufügen"""
        try:
            trainer_ref = self.db_ref.child('trainers').child(username)
            trainer = trainer_ref.get() or {'catches': [], 'stats': {}}
            
            # Catch-Daten erweitern
            catch_data = {
                **catchmon_data,
                'caught_at': int(time.time() * 1000),
                'caught_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            
            # Zu Catches hinzufügen
            catches = trainer.get('catches', [])
            catches.append(catch_data)
            
            # Stats aktualisieren
            stats = trainer.get('stats', {})
            stats['total_catches'] = len(catches)
            stats['highest_level'] = max([c.get('level', 0) for c in catches] + [0])
            
            # Rarity stats
            rarity_counts = {}
            for catch in catches:
                rarity = catch.get('rarity', 'Common')
                rarity_counts[rarity] = rarity_counts.get(rarity, 0) + 1
            stats['rarity_counts'] = rarity_counts
            
            # Update in Firebase
            trainer_ref.update({
                'catches': catches,
                'stats': stats,
                'last_active': int(time.time() * 1000)
            })
            
            print(f"✅ {catchmon_data.get('name')} zu {username} hinzugefügt")
            
            # Highest Level Global Stat prüfen
            self.check_and_update_highest_level(catchmon_data, username)
            
            return True
        except Exception as e:
            print(f"❌ Fehler beim Hinzufügen zu Trainer {username}: {e}")
            return False
    
    # 📊 GLOBAL STATS
    
    def get_global_stats(self) -> Dict[str, Any]:
        """Globale Statistiken laden"""
        try:
            stats = self.db_ref.child('global').get() or {}
            return stats
        except Exception as e:
            print(f"❌ Fehler beim Laden der Global Stats: {e}")
            return {}
    
    def increment_global_stat(self, stat_name: str, amount: int = 1) -> bool:
        """Globale Statistik erhöhen"""
        try:
            global_ref = self.db_ref.child('global').child(stat_name)
            current_value = global_ref.get() or 0
            global_ref.set(current_value + amount)
            return True
        except Exception as e:
            print(f"❌ Fehler beim Aktualisieren von {stat_name}: {e}")
            return False
    
    def check_and_update_highest_level(self, catchmon_data: Dict[str, Any], catcher: str):
        """Prüfen und aktualisieren des höchsten Level Catchmons"""
        try:
            current_highest = self.db_ref.child('global/highest_level_catchmon').get() or {}
            current_level = current_highest.get('level', 0)
            new_level = catchmon_data.get('level', 0)
            
            if new_level > current_level:
                new_highest = {
                    'name': catchmon_data.get('name', 'Unknown'),
                    'level': new_level,
                    'catcher': catcher,
                    'timestamp': int(time.time() * 1000)
                }
                self.db_ref.child('global/highest_level_catchmon').set(new_highest)
                print(f"🏆 Neues höchstes Level: {new_highest['name']} Level {new_level} von {catcher}")
        except Exception as e:
            print(f"❌ Fehler beim Prüfen des höchsten Levels: {e}")
    
    # ❤️ LIKES SYSTEM
    
    def get_user_likes(self, username: str) -> int:
        """Likes für einen User laden"""
        try:
            likes = self.db_ref.child('likes').child(username).get() or 0
            return likes
        except Exception as e:
            print(f"❌ Fehler beim Laden der Likes für {username}: {e}")
            return 0
    
    def increment_user_likes(self, username: str, amount: int = 1) -> bool:
        """Likes für einen User erhöhen"""
        try:
            likes_ref = self.db_ref.child('likes').child(username)
            current_likes = likes_ref.get() or 0
            new_likes = current_likes + amount
            likes_ref.set(new_likes)
            
            # Total Likes Ever aktualisieren
            self.increment_global_stat('total_likes_ever', amount)
            
            print(f"❤️ {username} hat jetzt {new_likes} Likes (+{amount})")
            return True
        except Exception as e:
            print(f"❌ Fehler beim Aktualisieren der Likes für {username}: {e}")
            return False
    
    def get_likes_leaderboard(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Top Likes Leaderboard"""
        try:
            all_likes = self.db_ref.child('likes').get() or {}
            
            # Sortieren nach Likes
            sorted_likes = sorted(all_likes.items(), key=lambda x: x[1], reverse=True)
            
            leaderboard = []
            for i, (username, likes) in enumerate(sorted_likes[:limit]):
                leaderboard.append({
                    'rank': i + 1,
                    'username': username,
                    'likes': likes
                })
            
            return leaderboard
        except Exception as e:
            print(f"❌ Fehler beim Laden des Likes Leaderboards: {e}")
            return []
    
    # 💨 ESCAPED SYSTEM
    
    def add_to_escaped_list(self):
        """Aktuellen Spawn zur Escaped-Liste hinzufügen"""
        try:
            current_spawn = self.get_current_spawn()
            if current_spawn:
                escaped_data = {
                    **current_spawn,
                    'escaped_at': int(time.time() * 1000)
                }
                
                escaped_ref = self.db_ref.child('escaped')
                escaped_ref.push(escaped_data)
                print(f"💨 {current_spawn.get('name', 'Unknown')} ist entkommen")
        except Exception as e:
            print(f"❌ Fehler beim Hinzufügen zur Escaped-Liste: {e}")
    
    def get_escaped_list(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Letzte entkommen Catchmons"""
        try:
            escaped = self.db_ref.child('escaped').order_by_child('escaped_at').limit_to_last(limit).get() or {}
            return list(escaped.values())
        except Exception as e:
            print(f"❌ Fehler beim Laden der Escaped-Liste: {e}")
            return []
    
    # 🔧 UTILITY FUNCTIONS
    
    def initialize_database_structure(self):
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
    
    def migrate_from_json_files(self, json_dir: str = '.'):
        """
        Migration von alten JSON-Dateien zu Firebase
        
        Args:
            json_dir: Verzeichnis mit den JSON-Dateien
        """
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
    
    def debug_database(self):
        """Debug: Aktuelle Datenbankstruktur anzeigen"""
        try:
            data = self.db_ref.get()
            print("🔍 Aktuelle Datenbank-Struktur:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            return data
        except Exception as e:
            print(f"❌ Fehler beim Debug: {e}")
            return None

# 🎮 HAUPTFUNKTIONEN FÜR CATCHMON GAME

def main():
    """Hauptfunktion für Tests und Setup"""
    print("🔥 Catchmon Firebase Integration")
    print("=" * 50)
    
    # Firebase-Konfiguration (Ihre echten Daten!)
    DATABASE_URL = "https://trainertrials-default-rtdb.europe-west1.firebasedatabase.app/"
    SERVICE_ACCOUNT_PATH = "serviceAccountKey.json"  # Ihr tatsächlicher Dateiname
    
    try:
        # Firebase initialisieren
        if SERVICE_ACCOUNT_PATH and os.path.exists(SERVICE_ACCOUNT_PATH):
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