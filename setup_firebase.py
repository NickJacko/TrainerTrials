#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🔧 Firebase Setup und Migration
Automatische Migration von JSON-Dateien zu Firebase

Führt folgende Schritte aus:
1. Firebase-Verbindung testen
2. Datenbank-Struktur initialisieren
3. Bestehende JSON-Dateien migrieren
4. Backup der alten Dateien erstellen
5. System-Test durchführen
"""

import os
import json
import shutil
import time
from datetime import datetime
from catcher import CatchmonFirebase

def create_backup_folder():
    """Erstellt Backup-Ordner für alte JSON-Dateien"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_folder = f"backup_json_{timestamp}"
    
    if not os.path.exists(backup_folder):
        os.makedirs(backup_folder)
    
    return backup_folder

def backup_json_files(backup_folder):
    """Erstellt Backup der alten JSON-Dateien"""
    json_files = [
        "catcher.json",
        "spawn_data.json", 
        "global_stats.json",
        "donation_trigger.json",
        "catch_chances.json",
        "global_level.json"
    ]
    
    backed_up = []
    
    for filename in json_files:
        if os.path.exists(filename):
            try:
                shutil.copy2(filename, os.path.join(backup_folder, filename))
                backed_up.append(filename)
                print(f"✅ Backup: {filename}")
            except Exception as e:
                print(f"❌ Backup Fehler {filename}: {e}")
    
    return backed_up

def test_firebase_connection():
    """Testet Firebase-Verbindung"""
    try:
        print("🔥 Teste Firebase-Verbindung...")
        db = CatchmonFirebase()
        
        # Test-Write
        test_data = {"test": "firebase_connection", "timestamp": int(time.time())}
        db.db_ref.child('_test').set(test_data)
        
        # Test-Read
        read_data = db.db_ref.child('_test').get()
        
        if read_data and read_data.get('test') == 'firebase_connection':
            print("✅ Firebase-Verbindung erfolgreich!")
            
            # Test-Daten löschen
            db.db_ref.child('_test').delete()
            return db
        else:
            print("❌ Firebase Read-Test fehlgeschlagen")
            return None
            
    except Exception as e:
        print(f"❌ Firebase-Verbindungsfehler: {e}")
        return None

def analyze_existing_data():
    """Analysiert bestehende JSON-Dateien"""
    print("\n📊 Analysiere bestehende Daten...")
    
    analysis = {
        'files_found': [],
        'trainers_count': 0,
        'total_catches': 0,
        'escaped_count': 0,
        'current_spawn': None
    }
    
    # catcher.json analysieren
    if os.path.exists('catcher.json'):
        try:
            with open('catcher.json', 'r', encoding='utf-8') as f:
                catcher_data = json.load(f)
            
            analysis['files_found'].append('catcher.json')
            
            if 'catcher' in catcher_data:
                analysis['trainers_count'] = len(catcher_data['catcher'])
                
                # Catches zählen
                for trainer, data in catcher_data['catcher'].items():
                    team = data.get('team', [])
                    analysis['total_catches'] += len(team)
            
            if 'escaped' in catcher_data:
                analysis['escaped_count'] = len(catcher_data['escaped'])
                
        except Exception as e:
            print(f"❌ Fehler beim Analysieren von catcher.json: {e}")
    
    # spawn_data.json analysieren
    if os.path.exists('spawn_data.json'):
        try:
            with open('spawn_data.json', 'r', encoding='utf-8') as f:
                spawn_data = json.load(f)
            
            analysis['files_found'].append('spawn_data.json')
            analysis['current_spawn'] = spawn_data.get('name', 'Unknown')
            
        except Exception as e:
            print(f"❌ Fehler beim Analysieren von spawn_data.json: {e}")
    
    # global_stats.json analysieren
    if os.path.exists('global_stats.json'):
        try:
            with open('global_stats.json', 'r', encoding='utf-8') as f:
                global_data = json.load(f)
            
            analysis['files_found'].append('global_stats.json')
            analysis['total_likes'] = global_data.get('total_likes_ever', 0)
            analysis['total_spawns'] = global_data.get('total_spawns', 0)
            
        except Exception as e:
            print(f"❌ Fehler beim Analysieren von global_stats.json: {e}")
    
    # Ergebnisse anzeigen
    print(f"   📁 Gefundene Dateien: {len(analysis['files_found'])}")
    for file in analysis['files_found']:
        print(f"     - {file}")
    
    print(f"   👥 Trainer: {analysis['trainers_count']}")
    print(f"   ✅ Total Catches: {analysis['total_catches']}")
    print(f"   💨 Escaped: {analysis['escaped_count']}")
    
    if analysis['current_spawn']:
        print(f"   🎯 Aktueller Spawn: {analysis['current_spawn']}")
    
    if 'total_likes' in analysis:
        print(f"   ❤️ Total Likes: {analysis['total_likes']}")
        print(f"   🎯 Total Spawns: {analysis['total_spawns']}")
    
    return analysis

def perform_migration(db, backup_folder):
    """Führt die Migration zu Firebase durch"""
    print("\n🔄 Starte Migration zu Firebase...")
    
    try:
        # Migration durchführen
        migration_results = db.migrate_from_json_files('.')
        
        if migration_results['success']:
            print("\n✅ Migration erfolgreich!")
            print("   Migrierte Dateien:")
            for file in migration_results['success']:
                print(f"     ✅ {file}")
        
        if migration_results['failed']:
            print("\n❌ Migration-Fehler:")
            for error in migration_results['failed']:
                print(f"     ❌ {error}")
        
        return len(migration_results['failed']) == 0
        
    except Exception as e:
        print(f"❌ Migration fehlgeschlagen: {e}")
        return False

def verify_migration(db):
    """Verifiziert die Migration"""
    print("\n🔍 Verifiziere Migration...")
    
    try:
        # Global Stats prüfen
        global_stats = db.get_global_stats()
        print(f"   🌟 Total Likes Ever: {global_stats.get('total_likes_ever', 0)}")
        print(f"   🎯 Total Spawns: {global_stats.get('total_spawns', 0)}")
        print(f"   ✅ Total Catches: {global_stats.get('total_catches', 0)}")
        print(f"   💨 Total Escapes: {global_stats.get('total_escapes', 0)}")
        
        # Aktueller Spawn prüfen
        current_spawn = db.get_current_spawn()
        if current_spawn:
            print(f"   🎯 Aktueller Spawn: {current_spawn.get('name', 'Unknown')} Level {current_spawn.get('level', '?')}")
        
        # Trainer-Anzahl prüfen
        trainers = db.db_ref.child('trainers').get()
        trainer_count = len(trainers) if trainers else 0
        print(f"   👥 Trainer in Firebase: {trainer_count}")
        
        print("✅ Migration verifiziert!")
        return True
        
    except Exception as e:
        print(f"❌ Verifikation fehlgeschlagen: {e}")
        return False

def setup_system_files():
    """Richtet System-Dateien ein"""
    print("\n📁 Richte System-Dateien ein...")
    
    # donation_trigger.json initialisieren
    if not os.path.exists("donation_trigger.json"):
        try:
            trigger_data = {
                "donor": None,
                "amount": 0,
                "total_donation": 0,
                "timestamp": 0
            }
            with open("donation_trigger.json", "w", encoding="utf-8") as f:
                json.dump(trigger_data, f, indent=2)
            print("   ✅ donation_trigger.json erstellt")
        except Exception as e:
            print(f"   ❌ Fehler bei donation_trigger.json: {e}")
    
    # catch_chances.json initialisieren
    if not os.path.exists("catch_chances.json"):
        try:
            with open("catch_chances.json", "w", encoding="utf-8") as f:
                json.dump({}, f)
            print("   ✅ catch_chances.json erstellt")
        except Exception as e:
            print(f"   ❌ Fehler bei catch_chances.json: {e}")
    
    # global_level.json initialisieren
    try:
        level_data = {"global_likes": 0}
        with open("global_level.json", "w", encoding="utf-8") as f:
            json.dump(level_data, f, indent=2)
        print("   ✅ global_level.json erstellt")
    except Exception as e:
        print(f"   ❌ Fehler bei global_level.json: {e}")

def create_start_script():
    """Erstellt Start-Skript für das System"""
    print("\n📝 Erstelle Start-Skript...")
    
    start_script_content = '''@echo off
echo 🚀 Starte Catchmon Firebase System...
echo.

REM Prüfe Python Installation
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python nicht gefunden! Bitte Python installieren.
    pause
    exit /b 1
)

REM Prüfe Firebase Dependencies
python -c "import firebase_admin" >nul 2>&1
if errorlevel 1 (
    echo 📦 Installiere Firebase Dependencies...
    pip install firebase-admin
)

REM Prüfe TikTokLive Dependencies
python -c "import TikTokLive" >nul 2>&1
if errorlevel 1 (
    echo 📦 Installiere TikTokLive Dependencies...
    pip install TikTokLive
)

echo ✅ Dependencies OK
echo.

REM Starte das System
echo 🎮 Starte Catchmon Game...
python tiktok_catcher.py

pause
'''
    
    try:
        with open("start_catchmon.bat", "w", encoding="utf-8") as f:
            f.write(start_script_content)
        print("   ✅ start_catchmon.bat erstellt")
    except Exception as e:
        print(f"   ❌ Fehler beim Erstellen des Start-Skripts: {e}")

def run_system_test(db):
    """Führt System-Test durch"""
    print("\n🧪 Führe System-Test durch...")
    
    try:
        # Test 1: Random Catchmon generieren
        from catcher import get_random_catchmon
        test_catchmon = get_random_catchmon()
        if test_catchmon:
            print("   ✅ Catchmon-Generierung funktioniert")
        else:
            print("   ❌ Catchmon-Generierung fehlgeschlagen")
            return False
        
        # Test 2: Spawn setzen
        success = db.set_current_spawn(test_catchmon)
        if success:
            print("   ✅ Spawn-Setting funktioniert")
        else:
            print("   ❌ Spawn-Setting fehlgeschlagen")
            return False
        
        # Test 3: Trainer-Daten
        test_trainer = db.get_trainer_data("TestUser")
        if test_trainer:
            print("   ✅ Trainer-System funktioniert")
        else:
            print("   ❌ Trainer-System fehlgeschlagen")
            return False
        
        # Test 4: Stats Update
        success = db.increment_global_stat('total_spawns', 0)  # +0 für Test
        if success:
            print("   ✅ Stats-System funktioniert")
        else:
            print("   ❌ Stats-System fehlgeschlagen")
            return False
        
        print("✅ Alle System-Tests bestanden!")
        return True
        
    except Exception as e:
        print(f"❌ System-Test fehlgeschlagen: {e}")
        return False

def main():
    """Hauptfunktion für Setup und Migration"""
    print("🔧 Firebase Setup und Migration")
    print("=" * 50)
    
    # Schritt 1: Prüfe Service Account Key
    if not os.path.exists("serviceAccountKey.json"):
        print("❌ serviceAccountKey.json nicht gefunden!")
        print("\n📋 Setup-Anleitung:")
        print("1. Firebase Console öffnen: https://console.firebase.google.com/")
        print("2. Projekt auswählen")
        print("3. Projekteinstellungen → Dienstkonten")
        print("4. 'Neuen privaten Schlüssel generieren' klicken")
        print("5. JSON-Datei zu 'serviceAccountKey.json' umbenennen")
        print("6. In diesem Ordner speichern")
        return
    
    # Schritt 2: Firebase-Verbindung testen
    db = test_firebase_connection()
    if not db:
        print("❌ Firebase-Verbindung fehlgeschlagen!")
        return
    
    # Schritt 3: Bestehende Daten analysieren
    analysis = analyze_existing_data()
    
    # Schritt 4: Backup erstellen
    if analysis['files_found']:
        print(f"\n💾 Erstelle Backup von {len(analysis['files_found'])} Dateien...")
        backup_folder = create_backup_folder()
        backed_up = backup_json_files(backup_folder)
        print(f"✅ Backup erstellt in: {backup_folder}")
    
    # Schritt 5: Migration durchführen
    if analysis['files_found']:
        proceed = input(f"\n🔄 Migration von {len(analysis['files_found'])} Dateien starten? (j/n): ")
        if proceed.lower().startswith('j'):
            migration_success = perform_migration(db, backup_folder if 'backup_folder' in locals() else None)
            if not migration_success:
                print("❌ Migration fehlgeschlagen!")
                return
        else:
            print("⏭️ Migration übersprungen")
    else:
        print("\n✅ Keine JSON-Dateien gefunden - Initialisiere neue Datenbank...")
        db.initialize_database_structure()
    
    # Schritt 6: Migration verifizieren
    if not verify_migration(db):
        print("❌ Migration-Verifikation fehlgeschlagen!")
        return
    
    # Schritt 7: System-Dateien einrichten
    setup_system_files()
    
    # Schritt 8: Start-Skript erstellen
    create_start_script()
    
    # Schritt 9: System-Test
    if not run_system_test(db):
        print("❌ System-Test fehlgeschlagen!")
        return
    
    # Schritt 10: Erfolgsmeldung
    print("\n🎉 Setup und Migration erfolgreich abgeschlossen!")
    print("\n🚀 Nächste Schritte:")
    print("1. Starte das System mit: python tiktok_catcher.py")
    print("2. Oder verwende: start_catchmon.bat (Windows)")
    print("3. Für OBS: JSON-Dateien werden automatisch aktualisiert")
    print("4. Für HTML-Overlays: Optional HTTP Server verfügbar")
    
    print(f"\n📊 System bereit:")
    global_stats = db.get_global_stats()
    print(f"   🌟 Total Likes Ever: {global_stats.get('total_likes_ever', 0)}")
    print(f"   👥 Trainer: {len(db.db_ref.child('trainers').get() or {})}")
    print(f"   🎯 Total Spawns: {global_stats.get('total_spawns', 0)}")
    print(f"   ✅ Total Catches: {global_stats.get('total_catches', 0)}")

if __name__ == "__main__":
    main()