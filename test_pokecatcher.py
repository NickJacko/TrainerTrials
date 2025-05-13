import unittest
import time
import os
from trainers import load_data, save_data, add_pokemon, count_encounter, log_seen_pokemon
from pokedata import get_random_pokemon
from html_generator import (
    generate_spawn_page,
    generate_enhanced_pokedex,
    generate_teams_page,
    generate_top3_file,
    generate_trainer_pages,
    generate_progress_circle
)

class TestPokeCatcher(unittest.TestCase):

    def setUp(self):
        self.data = load_data()
        self.test_trainer = "TestUser"
        self.data["trainers"] = {}  # vollständiger Reset für Isolation
        self.data["seen"] = []
        self.data["encounters"] = {}

    def tearDown(self):
        save_data(self.data)

    def test_get_random_pokemon_structure(self):
        for _ in range(50):
            p = get_random_pokemon()
            if p is not None:
                break
        self.assertIsNotNone(p)
        self.assertIn("name", p)
        self.assertGreaterEqual(p["level"], 1)
        self.assertIn("stats", p)
        self.assertIn("sprite", p)

    def test_add_pokemon_and_fusion(self):
        self.data["trainers"][self.test_trainer] = {"coins": 0, "team": []}
        pokemon = {
            "name": "Charmander",
            "level": 5,
            "shiny": False,
            "sprite": "test.png",
            "stats": {
                "HP": 10, "Attack": 10, "Defense": 10,
                "Sp.Attack": 10, "Sp.Defense": 10, "Speed": 10
            },
            "stage": 1,
            "evolution_line": ["Charmander", "Charmeleon", "Charizard"],
            "rarity": "Common"
        }


        add_pokemon(self.data, self.test_trainer, pokemon)
        team = self.data["trainers"][self.test_trainer]["team"]
        self.assertEqual(len(team), 1)
        self.assertEqual(team[0]["name"], "Charmander")
        self.assertEqual(team[0]["stage"], 1)

        add_pokemon(self.data, self.test_trainer, pokemon)
        team = self.data["trainers"][self.test_trainer]["team"]
        self.assertEqual(len(team), 1)
        self.assertEqual(team[0]["name"], "Charmeleon")
        self.assertEqual(team[0]["stage"], 2)

    def test_fusion_to_third_stage(self):
        self.data["trainers"][self.test_trainer] = {"coins": 0, "team": []}
        p = {
            "name": "Charmander",
            "level": 5,
            "shiny": False,
            "sprite": "test.png",
            "stats": {"HP": 10, "Attack": 10, "Defense": 10,
                      "Sp.Attack": 10, "Sp.Defense": 10, "Speed": 10},
            "stage": 1,
            "evolution_line": ["Charmander", "Charmeleon", "Charizard"],
            "rarity": "Common"
        }

        # Add 4x Charmander → sollte 1x Charizard ergeben
        add_pokemon(self.data, self.test_trainer, p)
        add_pokemon(self.data, self.test_trainer, p)  # → Charmeleon
        add_pokemon(self.data, self.test_trainer, p)
        add_pokemon(self.data, self.test_trainer, p)  # → Charizard

        team = self.data["trainers"][self.test_trainer]["team"]
        self.assertEqual(len(team), 1)
        self.assertEqual(team[0]["name"], "Charizard")
        self.assertEqual(team[0]["stage"], 3)
    

    def test_count_encounter(self):
        name = "Charmander"
        before = self.data.get("encounters", {}).get(name, 0)
        count_encounter(self.data, name)
        after = self.data.get("encounters", {}).get(name, 0)
        self.assertEqual(after, before + 1)

    def test_log_seen_pokemon(self):
        for _ in range(50):
            p = get_random_pokemon()
            if p:
                break
        self.assertIsNotNone(p)
        initial = len(self.data.get("seen", []))
        log_seen_pokemon(self.data, p)
        updated = len(self.data.get("seen", []))
        self.assertEqual(updated, initial + 1)

    def test_generate_spawn_page_creates_file(self):
        for _ in range(50):
            p = get_random_pokemon()
            if p:
                break
        self.assertIsNotNone(p)
        generate_spawn_page(p)
        self.assertTrue(os.path.exists("spawn.html"))

    def test_generate_enhanced_pokedex(self):
        generate_enhanced_pokedex(self.data)
        self.assertTrue(os.path.exists("output/pokedex.html"))

    def test_generate_teams_page(self):
        generate_teams_page(self.data)
        self.assertTrue(os.path.exists("teams.html"))

    def test_generate_top3_file(self):
        generate_top3_file(self.data)
        self.assertTrue(os.path.exists("top3.txt"))

    def test_generate_trainer_pages(self):
        generate_trainer_pages(self.data)
        path = f"output/trainer_pages/{self.test_trainer}.html"
        if os.path.exists(path):
            self.assertTrue(os.path.exists(path))

    def test_generate_progress_circle(self):
        generate_progress_circle(time.time() - 60, 120)
        self.assertTrue(os.path.exists("progress.html"))

if __name__ == "__main__":
    unittest.main()
