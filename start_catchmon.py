#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🚀 Catchmon System Starter
Startet das komplette Firebase-basierte Catchmon System

Startet automatisch:
1. Firebase Catchmon Game (tiktok_catcher.py)
2. JSON Bridge für OBS-Kompatibilität (firebase_json_bridge.py)
3. Optional: HTTP Server für HTML-Overlays
"""

import subprocess
import threading
import time
import sys
import os
from firebase_json_bridge import FirebaseJSONBridge, start_http_server

def start_catchmon_game():
    """Startet das Catchmon Game in separatem Prozess"""
    try:
        print("🎮 Starte Catchmon Game...")
        
        # tiktok_catcher.py als subprocess starten
        process = subprocess.Popen([
            sys.executable, "tiktok_catcher.py"
        ], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, 
           universal_newlines=True, bufsize=1)
        
        # Output weiterleiten
        for line in process.stdout:
            print(f"[GAME] {line.rstrip()}")
            
    except Exception as e:
        print(f"❌ Fehler beim Starten des Games: {e}")

def main():
    """Hauptfunktion - Startet komplettes System"""
    print("🚀 Catchmon System Starter")
    print("=" * 50)
    
    # Prüfen ob alle benötigten Dateien vorhanden sind
    required_files = [
        "serviceAccountKey.json",
        "catcher.py", 
        "firebase_json_bridge.py"
    ]
    
    missing_files = []
    for file in required_files:
        if not os.path.exists(file):
            missing_files.append(file)
    
    if missing_files:
        print("❌ Fehlende Dateien:")
        for file in missing_files:
            print(f"   - {file}")
        print("\nBitte stelle sicher, dass alle Dateien vorhanden sind.")
        return
    
    try:
        # JSON Bridge initialisieren
        print("🌉 Initialisiere Firebase JSON Bridge...")
        bridge = FirebaseJSONBridge()
        
        # JSON Bridge starten (kontinuierliche Updates)
        bridge.start_bridge(update_interval=0.5)  # Jede 0.5 Sekunden
        
        # HTTP Server optional starten
        start_server = input("🌐 HTTP Server für HTML-Overlays starten? (j/n): ").lower().startswith('j')
        
        if start_server:
            server_thread = threading.Thread(
                target=start_http_server,
                args=(bridge, 8000),
                daemon=True
            )
            server_thread.start()
            print("✅ HTTP Server gestartet auf Port 8000")
        
        # Kurz warten damit Bridge läuft
        time.sleep(2)
        
        # Catchmon Game starten
        print("🎮 Starte Catchmon Game...")
        
        # Statt subprocess: direkt importieren und starten
        try:
            import tiktok_catcher
            # Das Game läuft bereits wenn importiert
        except Exception as e:
            print(f"❌ Fehler beim Starten des Games: {e}")
            print("Versuche als subprocess...")
            start_catchmon_game()
        
    except KeyboardInterrupt:
        print("\n🛑 System wird beendet...")
        if 'bridge' in locals():
            bridge.stop_bridge()
        print("👋 System beendet!")
    
    except Exception as e:
        print(f"❌ Systemfehler: {e}")

if __name__ == "__main__":
    main()