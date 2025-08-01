#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🌉 Firebase JSON Bridge
Erstellt JSON-Dateien aus Firebase für OBS/HTML-Kompatibilität

Diese Datei überwacht Firebase und erstellt lokale JSON-Dateien,
die von bestehenden HTML-Overlays gelesen werden können.
"""

import json
import time
import threading
from typing import Dict, Any
from catcher import get_firebase

class FirebaseJSONBridge:
    """Bridge zwischen Firebase und lokalen JSON-Dateien für OBS"""
    
    def __init__(self):
        self.firebase = get_firebase()
        self.running = False
        self.update_thread = None
        print("🌉 Firebase JSON Bridge initialisiert")
    
    def start_bridge(self, update_interval: float = 1.0):
        """Startet die Bridge mit regelmäßigen Updates"""
        if self.running:
            print("⚠️ Bridge läuft bereits!")
            return
        
        self.running = True
        self.update_thread = threading.Thread(target=self._update_loop, args=(update_interval,))
        self.update_thread.daemon = True
        self.update_thread.start()
        print(f"🚀 Firebase JSON Bridge gestartet (Update alle {update_interval}s)")
    
    def stop_bridge(self):
        """Stoppt die Bridge"""
        self.running = False
        if self.update_thread:
            self.update_thread.join()
        print("🛑 Firebase JSON Bridge gestoppt")
    
    def _update_loop(self, interval: float):
        """Haupt-Update-Schleife"""
        while self.running:
            try:
                self.update_all_json_files()
                time.sleep(interval)
            except Exception as e:
                print(f"❌ Fehler im Bridge Update Loop: {e}")
                time.sleep(interval)
    
    def update_all_json_files(self):
        """Aktualisiert alle JSON-Dateien basierend auf Firebase"""
        try:
            # spawn_data.json für OBS Overlays
            self.update_spawn_data_json()
            
            # global_stats.json für Statistik-Overlays
            self.update_global_stats_json()
            
            # catch_chances.json für Fangchance-Overlays
            self.update_catch_chances_json()
            
            # global_level.json für Global Level Overlay
            self.update_global_level_json()
            
            # donation_trigger.json wird bereits von tiktok_catcher.py geschrieben
            
        except Exception as e:
            print(f"❌ Fehler beim Update der JSON-Dateien: {e}")
    
    def update_spawn_data_json(self):
        """Aktualisiert spawn_data.json aus Firebase"""
        try:
            spawn_data = self.firebase.get_current_spawn()
            if spawn_data:
                with open("spawn_data.json", "w", encoding="utf-8") as f:
                    json.dump(spawn_data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"❌ Fehler beim Update von spawn_data.json: {e}")
    
    def update_global_stats_json(self):
        """Aktualisiert global_stats.json aus Firebase"""
        try:
            global_stats = self.firebase.get_global_stats()
            if global_stats:
                # Zusätzliche session_start Zeit für Kompatibilität
                global_stats['session_start'] = time.time()
                
                with open("global_stats.json", "w", encoding="utf-8") as f:
                    json.dump(global_stats, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"❌ Fehler beim Update von global_stats.json: {e}")
    
    def update_catch_chances_json(self):
        """Erstellt catch_chances.json basierend auf aktuellen Likes"""
        try:
            # Diese Datei wird primär von tiktok_catcher.py geschrieben
            # Hier nur Fallback falls sie nicht existiert
            try:
                with open("catch_chances.json", "r") as f:
                    pass  # Datei existiert bereits
            except FileNotFoundError:
                # Leere Datei erstellen
                with open("catch_chances.json", "w", encoding="utf-8") as f:
                    json.dump({}, f)
        except Exception as e:
            print(f"❌ Fehler beim Update von catch_chances.json: {e}")
    
    def update_global_level_json(self):
        """Aktualisiert global_level.json aus Firebase"""
        try:
            global_stats = self.firebase.get_global_stats()
            if global_stats:
                level_data = {
                    "global_likes": global_stats.get("total_likes_ever", 0)
                }
                
                with open("global_level.json", "w", encoding="utf-8") as f:
                    json.dump(level_data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"❌ Fehler beim Update von global_level.json: {e}")
    
    def manual_update(self):
        """Manuelles Update aller JSON-Dateien"""
        print("🔄 Manuelles Update der JSON-Dateien...")
        self.update_all_json_files()
        print("✅ JSON-Dateien aktualisiert")
    
    def create_html_endpoint_data(self) -> Dict[str, Any]:
        """Erstellt Daten für mögliche HTML-Endpoints"""
        try:
            return {
                "spawn": self.firebase.get_current_spawn(),
                "global_stats": self.firebase.get_global_stats(),
                "likes_leaderboard": self.firebase.get_likes_leaderboard(10),
                "escaped_recent": self.firebase.get_escaped_list(20),
                "timestamp": int(time.time() * 1000)
            }
        except Exception as e:
            print(f"❌ Fehler beim Erstellen der HTML-Endpoint-Daten: {e}")
            return {}

# 🌐 OPTIONAL: Mini HTTP Server für Firebase-Daten
import http.server
import socketserver
from urllib.parse import urlparse

class FirebaseHTTPHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP Handler der Firebase-Daten als JSON bereitstellt"""
    
    def __init__(self, bridge: FirebaseJSONBridge):
        self.bridge = bridge
        super().__init__()
    
    def do_GET(self):
        """GET-Anfragen bearbeiten"""
        path = urlparse(self.path).path
        
        try:
            if path == '/api/spawn':
                self._send_json(self.bridge.firebase.get_current_spawn())
            elif path == '/api/global':
                self._send_json(self.bridge.firebase.get_global_stats())
            elif path == '/api/likes':
                self._send_json(self.bridge.firebase.get_likes_leaderboard(10))
            elif path == '/api/escaped':
                self._send_json(self.bridge.firebase.get_escaped_list(20))
            elif path == '/api/all':
                self._send_json(self.bridge.create_html_endpoint_data())
            else:
                # Normale Datei-Handler für HTML/CSS/JS
                super().do_GET()
        except Exception as e:
            self._send_error(500, f"Server Error: {e}")
    
    def _send_json(self, data):
        """JSON-Antwort senden"""
        json_data = json.dumps(data, ensure_ascii=False, indent=2)
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json_data.encode('utf-8'))
    
    def _send_error(self, code, message):
        """Fehler-Antwort senden"""
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        error_data = json.dumps({"error": message}, ensure_ascii=False)
        self.wfile.write(error_data.encode('utf-8'))

def start_http_server(bridge: FirebaseJSONBridge, port: int = 8000):
    """Startet HTTP Server für Firebase-API"""
    try:
        handler = lambda *args: FirebaseHTTPHandler(bridge, *args)
        with socketserver.TCPServer(("", port), handler) as httpd:
            print(f"🌐 HTTP Server gestartet auf Port {port}")
            print(f"   API Endpoints:")
            print(f"   http://localhost:{port}/api/spawn     - Aktueller Spawn")
            print(f"   http://localhost:{port}/api/global    - Globale Stats")
            print(f"   http://localhost:{port}/api/likes     - Likes Leaderboard")
            print(f"   http://localhost:{port}/api/escaped   - Escaped Catchmons")
            print(f"   http://localhost:{port}/api/all       - Alle Daten")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("🛑 HTTP Server gestoppt")
    except Exception as e:
        print(f"❌ Fehler beim Starten des HTTP Servers: {e}")

# 🎮 HAUPTFUNKTION

def main():
    """Hauptfunktion für Bridge-Tests"""
    print("🌉 Firebase JSON Bridge")
    print("=" * 40)
    
    try:
        # Bridge initialisieren
        bridge = FirebaseJSONBridge()
        
        # Einmaliges Update zum Testen
        bridge.manual_update()
        
        print("\n📁 Erstellte JSON-Dateien:")
        json_files = ["spawn_data.json", "global_stats.json", "catch_chances.json", "global_level.json"]
        for filename in json_files:
            try:
                with open(filename, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                print(f"   ✅ {filename} - {len(str(data))} Zeichen")
            except FileNotFoundError:
                print(f"   ❌ {filename} - Nicht gefunden")
            except Exception as e:
                print(f"   ⚠️ {filename} - Fehler: {e}")
        
        # Option für kontinuierliches Update
        print(f"\n🎮 Optionen:")
        print(f"   bridge.start_bridge()     # Kontinuierliche Updates starten")
        print(f"   bridge.manual_update()    # Einmaliges Update")
        print(f"   bridge.stop_bridge()      # Updates stoppen")
        
        return bridge
        
    except Exception as e:
        print(f"❌ Fehler beim Starten der Bridge: {e}")
        return None

if __name__ == "__main__":
    bridge = main()
    
    if bridge:
        # Für Tests: Bridge starten und HTTP Server optional
        import sys
        
        if len(sys.argv) > 1 and sys.argv[1] == "--server":
            # HTTP Server in separatem Thread starten
            server_thread = threading.Thread(
                target=start_http_server, 
                args=(bridge, 8000), 
                daemon=True
            )
            server_thread.start()
        
        # Bridge starten
        bridge.start_bridge(1.0)  # Update jede Sekunde
        
        try:
            print("\n🚀 Bridge läuft! Drücke Ctrl+C zum Beenden...")
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            bridge.stop_bridge()
            print("\n👋 Bridge beendet!")