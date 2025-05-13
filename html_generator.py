import json
import os
import requests
from collections import defaultdict

def generate_spawn_page(pokemon, output_file="spawn.html"):
    name = pokemon["name"].capitalize()
    level = pokemon["level"]
    rarity = pokemon["rarity"]
    shiny = pokemon["shiny"]
    sprite = pokemon["sprite"]
    stats = pokemon["stats"]

    def get_stat_color(val):
        if val == 0:
            return "#ff69b4"  # pink
        elif val == 31:
            return "#8e44ad"  # purple
        elif val > 25:
            return "#e74c3c"  # red
        elif val < 10:
            return "#2ecc71"  # green
        else:
            return "#f1c40f"  # yellow

    glitter_div = """
    <div class="glitter"></div>
    """ if shiny else ""

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Wild Pokémon Spawn</title>
<script>
  setTimeout(() => location.reload(), 1000);
</script>
  <style>
    html, body {{
      margin: 0;
      padding: 0;
      background: transparent;
      font-family: 'Segoe UI', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }}
    .pokemon {{
      position: relative;
      text-align: center;
    }}
    .pokemon img {{
      width: 200px;
      height: auto;
      z-index: 2;
      position: relative;
    }}
    .glitter {{
      position: absolute;
      top: -30px;
      left: -30px;
      width: 260px;
      height: 260px;
      background: radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%);
      border-radius: 50%;
      animation: shimmer 2s infinite;
      z-index: 1;
    }}
    @keyframes shimmer {{
      0% {{ transform: rotate(0deg) scale(1); opacity: 0.6; }}
      50% {{ transform: rotate(180deg) scale(1.1); opacity: 1; }}
      100% {{ transform: rotate(360deg) scale(1); opacity: 0.6; }}
    }}
    .info {{
      font-size: 20px;
      margin-top: 40px;
      font-weight: bold;
      color: white;
      text-shadow: 0 0 4px black;
    }}
    .stat-table {{
      margin-top: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      color: white;
    }}
    .stat-row {{
      display: flex;
      gap: 20px;
      font-weight: bold;
      font-size: 16px;
    }}
  </style>
</head>
<body>
  <div class="pokemon">
    {glitter_div}
    <img src="{sprite}" alt="{name}">
  </div>
  <div class="info">✨ Wild {name} appeared!<br>Level: {level} &nbsp;&nbsp; Rarity: {rarity}</div>
  <div class="stat-table">
    <div class="stat-row">
""")
        for stat in stats.keys():
            f.write(f"<div>{stat}</div>")
        f.write("</div><div class=\"stat-row\">")
        for val in stats.values():
            color = get_stat_color(val)
            f.write(f"<div style='color:{color}'>{val}</div>")
        f.write("""</div></div>
</body>
</html>""")


def generate_teams_page(data, output_file="teams.html"):
    trainers = data.get("trainers", {})
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Trainer Teams</title>
  <style>
    body {{ font-family: Arial, sans-serif; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ padding: 8px; border: 1px solid #ddd; text-align: left; }}
    th {{ background-color: #f2f2f2; cursor: pointer; }}
  </style>
</head>
<body>
  <h2>Trainer Teams</h2>
  <input type="text" id="searchInput" placeholder="Search by trainer name..." onkeyup="filterTable()">
  <table id="teamsTable">
    <thead><tr>
      <th onclick="sortTable(0)">Trainer</th>
      <th onclick="sortTable(1)">Coins</th>
      <th>Team (Caught Pok\u00e9mon)</th>
    </tr></thead>
    <tbody>
""")
        for name, info in trainers.items():
            coins = info.get("coins", 0)
            team_names = ", ".join([p["name"] for p in info.get("team", [])])
            f.write(f"      <tr><td>{name}</td><td>{coins}</td><td>{team_names}</td></tr>\n")
        f.write("""    </tbody>
  </table>
  <script>
    function filterTable() {
      var input = document.getElementById("searchInput");
      var filter = input.value.toUpperCase();
      var table = document.getElementById("teamsTable");
      var tr = table.getElementsByTagName("tr");
      for (var i = 1; i < tr.length; i++) {
        var td = tr[i].getElementsByTagName("td")[0];
        tr[i].style.display = (td && td.innerHTML.toUpperCase().indexOf(filter) > -1) ? "" : "none";
      }
    }
    function sortTable(n) {
      var table = document.getElementById("teamsTable");
      var switching = true;
      var dir = "asc";
      while (switching) {
        switching = false;
        var rows = table.rows;
        for (var i = 1; i < (rows.length - 1); i++) {
          var shouldSwitch = false;
          var x = rows[i].getElementsByTagName("TD")[n];
          var y = rows[i+1].getElementsByTagName("TD")[n];
          if (!x || !y) continue;
          var cmpX = (n==1) ? parseInt(x.innerHTML) : x.innerHTML.toUpperCase();
          var cmpY = (n==1) ? parseInt(y.innerHTML) : y.innerHTML.toUpperCase();
          if ((dir == "asc" && cmpX > cmpY) || (dir == "desc" && cmpX < cmpY)) {
            shouldSwitch = true;
            break;
          }
        }
        if (shouldSwitch) {
          rows[i].parentNode.insertBefore(rows[i+1], rows[i]);
          switching = true;
        } else {
          if (dir == "asc") {
            dir = "desc";
            switching = true;
          }
        }
      }
    }
  </script>
</body>
</html>""")

def generate_top3_file(data, output_file="top3.txt"):
    top = sorted(data.get("trainers", {}).items(), key=lambda x: len(x[1].get("team", [])), reverse=True)[:3]
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("Top 3 Trainers:\n")
        for i, (name, info) in enumerate(top, 1):
            count = len(info.get("team", []))
            f.write(f"{i}. {name} - {count} caught Pok\u00e9mon\n")

import time

def generate_progress_page(last_spawn, interval, output_file="progress.html"):
    import time
    elapsed = time.time() - last_spawn
    progress = min(100, int((elapsed / interval) * 100))

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Next Pokémon Progress</title>
  <meta http-equiv="refresh" content="1">
  <style>
    body {{
      background-color: #fff;
      font-family: Arial, sans-serif;
      text-align: center;
      padding-top: 40px;
    }}
    .bar-container {{
      width: 80%;
      background-color: #ddd;
      border-radius: 25px;
      margin: auto;
    }}
    .bar-fill {{
      width: {progress}%;
      height: 30px;
      background: linear-gradient(to right, #4CAF50, #8BC34A);
      border-radius: 25px;
      transition: width 1s ease-in-out;
    }}
    p {{
      font-size: 18px;
      margin-top: 10px;
    }}
  </style>
</head>
<body>
  <div class="bar-container">
    <div class="bar-fill"></div>
  </div>
  <p>Next Pokémon in {max(0, int(interval - elapsed))} seconds</p>
</body>
</html>""")

def generate_progress_circle(last_spawn, interval, output_file="progress.html"):
    import time
    elapsed = time.time() - last_spawn
    progress = min(1.0, elapsed / interval)

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f'''<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Spawn Timer Ring</title>
  <meta http-equiv="refresh" content="1">
  <style>
    html, body {{
      margin: 0;
      padding: 0;
      background: transparent;
    }}
    .container {{
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 220px;
      height: 220px;
      pointer-events: none;
      z-index: 10;
    }}
    .base-ring, .progress-ring {{
      position: absolute;
      top: 0;
      left: 0;
      width: 220px;
      height: 220px;
      border-radius: 50%;
      mask-image: radial-gradient(circle, transparent 78px, black 79px);
      -webkit-mask-image: radial-gradient(circle, transparent 78px, black 79px);
    }}
    .base-ring {{
      background: #999;
    }}
    .progress-ring {{
      background: conic-gradient(
        #00cc66 {progress * 360}deg,
        transparent {progress * 360}deg
      );
      transition: background 0.2s linear;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="base-ring"></div>
    <div class="progress-ring"></div>
  </div>
</body>
</html>''')

import os
import requests
from collections import defaultdict

def generate_enhanced_pokedex(data, output_dir="."):
    import os
    from collections import defaultdict
    import requests

    os.makedirs(f"{output_dir}/dex_detail", exist_ok=True)

    response = requests.get("https://pokeapi.co/api/v2/pokemon?limit=1010")
    all_pokemon = [p["name"].capitalize() for p in response.json()["results"]]

    caught = defaultdict(list)
    encounter_count = defaultdict(int)
    caught_by_trainer = defaultdict(set)

    for p in data.get("seen", []):
        name = p["name"]
        caught[name].append(p)
        encounter_count[name] += 1

    for trainer, info in data.get("trainers", {}).items():
        for p in info.get("team", []):
            entry = dict(p)
            entry["trainer"] = trainer
            caught[p["name"]].append(entry)
            caught_by_trainer[p["name"]].add(trainer)
            encounter_count[p["name"]] += 1

    # Hauptseite pokedex.html
    with open(f"{output_dir}/pokedex.html", "w", encoding="utf-8") as f:
        f.write("""<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Pokédex</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body { font-family: Arial; background: #f2f2f2; padding: 20px; margin: 0; }
h1 { text-align: center; }
input { width: 90%; max-width: 400px; margin: 10px auto; padding: 10px; font-size: 16px; display: block; }
.grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
.card {
  background: white; border-radius: 8px; width: 130px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1); padding: 10px;
  text-align: center; transition: transform 0.2s ease;
}
.card:hover { transform: scale(1.05); background: #e6f7ff; }
.card img { width: 96px; height: auto; }
.card a { text-decoration: none; color: black; font-weight: bold; }
.small { font-size: 12px; color: #777; }
</style>
</head><body>
<h1>📘 National Pokédex</h1>
<input type="text" id="searchInput" onkeyup="filterDex()" placeholder="Search Pokémon...">
<div class="grid" id="dexGrid">
""")
        for i, name in enumerate(all_pokemon, 1):
            safe_name = name.replace(" ", "_")
            sprite = caught[name][0]["sprite"] if name in caught else f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{i}.png"
            caught_n = len(caught_by_trainer.get(name, []))
            encounter_n = encounter_count.get(name, 0)
            f.write(f"""
<div class="card">
  <a href="dex_detail/poke_{i:03d}_{safe_name}.html">
    <img src="{sprite}" alt="{name}">
    <div>#{i:03d}<br>{name}</div>
    <div class="small">{encounter_n} seen / {caught_n} caught</div>
  </a>
</div>""")
        f.write("""
</div>
<script>
function filterDex() {
  const input = document.getElementById("searchInput").value.toLowerCase();
  const cards = document.querySelectorAll(".card");
  cards.forEach(card => {
    card.style.display = card.innerText.toLowerCase().includes(input) ? "" : "none";
  });
}
</script>
<div style="text-align: center; margin-top: 40px;">
<a href="index.html" style="position: absolute; top: 20px; left: 20px; font-size: 18px; text-decoration: none;">🏠 Home</a>
</body></html>

""")

    # Detailseiten
    for i, name in enumerate(all_pokemon, 1):
        entries = caught.get(name, [])
        safe_name = name.replace(" ", "_")

        def calc_pokepoints(e):
            stats = e["stats"]
            level = e["level"]
            shiny_bonus = 10000 if e["shiny"] else 0
            return (level * 100) + sum(stats.values()) + shiny_bonus

        sorted_entries = sorted(entries, key=calc_pokepoints, reverse=True)
        unique_trainers = set(e["trainer"] for e in sorted_entries if e.get("trainer"))

        sprite = sorted_entries[0]["sprite"] if sorted_entries else f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{i}.png"

        with open(f"{output_dir}/dex_detail/{safe_name}.html", "w", encoding="utf-8") as f:

            f.write(f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{name} Detail</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {{ font-family: Arial; background: #fff; padding: 20px; }}
    .container {{ max-width: 600px; margin: auto; }}
    img {{ width: 200px; display: block; margin: auto; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
    th, td {{ border: 1px solid #ccc; padding: 6px; text-align: center; }}
    #filterBox {{ margin-top: 20px; }}
  </style>
</head>
<body>
  <div class="container">
    <h1>#{i:03d} {name}</h1>
    <img src="{sprite}" alt="{name}">
    <p><b>Encounters:</b> {len(entries)}<br><b>Trainers Caught:</b> {len(unique_trainers)}</p>
    <div id="filterBox">
      <label><input type="checkbox" id="caughtOnly" onchange="filterRows()"> Nur Gefangene anzeigen</label>
    </div>
    <table id="dataTable">
      <thead>
        <tr><th>Trainer</th><th>Punkte</th><th>Level</th><th>Shiny</th><th>Sum</th><th>HP</th><th>Atk</th><th>Def</th><th>SpA</th><th>SpD</th><th>Speed</th></tr>
      </thead>
      <tbody>
""")
            for e in sorted_entries:
                stats = e["stats"]
                total = sum(stats.values())
                poke_points = calc_pokepoints(e)
                trainer = e.get("trainer", "❌") or "❌"
                shiny = "✨" if e["shiny"] else ""
                css_class = "caught" if e.get("trainer") else "seen"
                f.write(f"""<tr class="{css_class}">
  <td><a href="trainer_pages/{trainer}.html">{trainer}</a></td><td>{poke_points}</td><td>{e['level']}</td><td>{shiny}</td><td>{total}</td>
  <td>{stats['HP']}</td><td>{stats['Attack']}</td><td>{stats['Defense']}</td>
  <td>{stats['Sp.Attack']}</td><td>{stats['Sp.Defense']}</td><td>{stats['Speed']}</td>
</tr>
""")

            f.write("""</tbody>
    </table>
    <div style="text-align:center; margin-top:20px;">
      <a href="../pokedex.html">← Back to Pokédex</a>
    </div>
  </div>
  <script>
    function filterRows() {
      const showCaughtOnly = document.getElementById("caughtOnly").checked;
      const rows = document.querySelectorAll("#dataTable tbody tr");
      rows.forEach(row => {
        row.style.display = (!showCaughtOnly || row.classList.contains("caught")) ? "" : "none";
      });
    }
  </script>
</body>
</html>
""")


def generate_trainer_pages(data, output_dir="."):

    import os
    os.makedirs(f"{output_dir}/trainer_pages", exist_ok=True)

    def calc_pokepoints(p):
        return (p["level"] * 100) + sum(p["stats"].values()) + (10000 if p["shiny"] else 0)

    for trainer, info in data.get("trainers", {}).items():
        team = info.get("team", [])
        if not team:
            continue

        team_sorted = sorted(team, key=calc_pokepoints, reverse=True)
        total_points = sum(calc_pokepoints(p) for p in team_sorted)

        with open(f"{output_dir}/trainer_pages/{trainer}.html", "w", encoding="utf-8") as f:

            f.write(f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{trainer}'s Pokémon</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {{ font-family: Arial; background: #f0f0f0; padding: 20px; }}
    h1 {{ text-align: center; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
    th, td {{ border: 1px solid #ccc; padding: 8px; text-align: center; }}
    th {{ background-color: #ddd; }}
    img {{ width: 64px; }}
    a {{ text-decoration: none; color: black; font-weight: bold; }}
  </style>
</head>
<body>
  <h1>{trainer}'s Pokémon</h1>
  <h2>Gesamtpunkte: {total_points}</h2>
  <table>
    <thead>
      <tr><th>Sprite</th><th>Name</th><th>Level</th><th>Sum</th><th>Punkte</th></tr>
    </thead>
    <tbody>
""")
            for p in team_sorted:
                sprite = p["sprite"]
                name = p["name"]
                level = p["level"]
                stats = p["stats"]
                stat_sum = sum(stats.values())
                points = calc_pokepoints(p)
                pokedex_link = f"../dex_detail/{name.replace(' ', '_')}.html"
                f.write(f"<tr><td><a href='{pokedex_link}'><img src='{sprite}'></a></td><td><a href='{pokedex_link}'>{name}</a></td><td>{level}</td><td>{stat_sum}</td><td>{points}</td></tr>\n")

            f.write("""
    </tbody>
  </table>
  <p><a href="../pokedex.html">← Zurück zum Pokédex</a></p>
</body>
</html>
""")



def generate_strongest_pokemon_ranking(data, output_file="ranking_pokemon.html"):

    os.makedirs("output", exist_ok=True)

    def calc_points(p):
        return (p["level"] * 100) + sum(p["stats"].values()) + (10000 if p["shiny"] else 0)

    seen = sorted(data.get("seen", []), key=calc_points, reverse=True)
    caught = []
    for trainer in data.get("trainers", {}):
        for p in data["trainers"][trainer]["team"]:
            p = p.copy()
            p["trainer"] = trainer
            caught.append(p)
    caught = sorted(caught, key=calc_points, reverse=True)

    with open(output_file, "w", encoding="utf-8") as f:
        f.write("""<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Stärkste Pokémon</title>
<style>
body { font-family: Arial; background: #fff; padding: 20px; }
h1, h2 { text-align: center; }
table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
th, td { border: 1px solid #ccc; padding: 6px; text-align: center; }
th { background-color: #eee; }
</style></head><body>
<h1>🏆 Ranking der stärksten Pokémon</h1>
<h2>Gefangen</h2>
<table><tr><th>Trainer</th><th>Name</th><th>Level</th><th>Shiny</th><th>Stats</th><th>Punkte</th></tr>
""")
        for p in caught[:100]:
            stats = sum(p["stats"].values())
            shiny = "✨" if p["shiny"] else ""
            f.write(f"<tr><td>{p['trainer']}</td><td>{p['name']}</td><td>{p['level']}</td><td>{shiny}</td><td>{stats}</td><td>{calc_points(p)}</td></tr>\n")
        f.write("</table><h2>Nur gesehen</h2><table><tr><th>Name</th><th>Level</th><th>Shiny</th><th>Stats</th><th>Punkte</th></tr>\n")
        for p in seen[:100]:
            shiny = "✨" if p["shiny"] else ""
            f.write(f"<tr><td>{p['name']}</td><td>{p['level']}</td><td>{shiny}</td><td>{sum(p['stats'].values())}</td><td>{calc_points(p)}</td></tr>\n")
        f.write("</table><a href=\"index.html\">← Zurück</a></body></html>")


def generate_trainer_ranking_page(data, output_file="trainer_ranking.html"):

    os.makedirs("output", exist_ok=True)

    def calc_points(p):
        return (p["level"] * 100) + sum(p["stats"].values()) + (10000 if p["shiny"] else 0)

    rows = []
    for trainer, info in data.get("trainers", {}).items():
        team = info.get("team", [])
        points = sum(calc_points(p) for p in team)
        unique_pokemon = len(set(p["name"] for p in team))
        rows.append((trainer, points, unique_pokemon, len(team)))

    with open(output_file, "w", encoding="utf-8") as f:
        f.write("""<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Trainer Ranking</title>
<style>
body { font-family: Arial; background: #fff; padding: 20px; }
h1 { text-align: center; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #ccc; padding: 6px; text-align: center; }
th { background-color: #eee; cursor: pointer; }
</style></head><body>
<h1>🏅 Trainer Rangliste</h1>
<table id="rankingTable"><thead><tr>
<th onclick="sortTable(0)">Name</th>
<th onclick="sortTable(1)">Gesamtpunkte</th>
<th onclick="sortTable(2)">Einzigartige Pokémon</th>
<th onclick="sortTable(3)">Gesamtanzahl</th>
</tr></thead><tbody>
""")
        for row in rows:
            f.write(f"<tr><td><a href=\"trainer_pages/{row[0]}.html\">{row[0]}</a></td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td></tr>\n")
        f.write("""</tbody></table>
<script>
function sortTable(n) {
  var table = document.getElementById("rankingTable"), rows, switching = true, dir = "desc", switchcount = 0;
  while (switching) {
    switching = false;
    rows = table.rows;
    for (var i = 1; i < (rows.length - 1); i++) {
      var x = rows[i].getElementsByTagName("TD")[n];
      var y = rows[i + 1].getElementsByTagName("TD")[n];
      var cmpX = isNaN(x.innerHTML) ? x.innerHTML.toLowerCase() : parseFloat(x.innerHTML);
      var cmpY = isNaN(y.innerHTML) ? y.innerHTML.toLowerCase() : parseFloat(y.innerHTML);
      if ((dir == "asc" && cmpX > cmpY) || (dir == "desc" && cmpX < cmpY)) {
        rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
        switching = true; switchcount++;
        break;
      }
    }
    if (switchcount == 0 && dir == "desc") { dir = "asc"; switching = true; }
  }
}
</script><a href="index.html">← Zurück</a>
</body></html>""")


def generate_pokedex_with_filter(data):
    # Ersetzt die normale pokedex.html-Generierung
    generate_enhanced_pokedex(data)  # nutzt bereits rarity = Mythical / Legendary / etc.
    # → Du kannst manuell z. B. `data-rarity="Legendary"` an jedes `.card`-Div anhängen und über Dropdown filtern.

def generate_homepage(output_file="index.html"):

    os.makedirs("output", exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Pokémon Hub</title>
  <style>
    body { font-family: Arial; background: #f0f0f0; text-align: center; padding-top: 100px; }
    h1 { font-size: 32px; }
    .button {
      display: inline-block; padding: 20px 40px; margin: 20px;
      font-size: 24px; text-decoration: none; background: #4CAF50;
      color: white; border-radius: 12px;
      transition: background 0.3s ease;
    }
    .button:hover { background: #45a049; }
  </style>
                
</head>
<body>
  <h1>🎮 Welcome to the Pokémon Hub</h1>
  <a href="pokedex.html" class="button">📘 Pokédex</a>
  <a href="trainer_ranking.html" class="button">🏆 Trainer Ranking</a>
  <a href="howto.html" class="button">🧠 How To Play</a>
</body>
</html>""")

def generate_evolution_announcement(username, from_name, to_name, output_file="evolution_announce.html"):
    def sprite_url(name):
        return f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{name.lower().replace(' ', '-')}.png"

    from_sprite = sprite_url(from_name)
    to_sprite = sprite_url(to_name)

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Evolution!</title>
  <meta http-equiv="refresh" content="6">
  <style>
    body {{
      background: transparent;
      font-family: 'Segoe UI', sans-serif;
      color: white;
      font-size: 26px;
      text-align: center;
      text-shadow: 0 0 5px black;
      padding-top: 30px;
    }}
    .highlight {{
      color: #00ccff;
      font-weight: bold;
    }}
    .sprites {{
      position: relative;
      width: 200px;
      height: 200px;
      margin: 30px auto;
    }}
    .sprites img {{
      position: absolute;
      top: 0;
      left: 0;
      width: 200px;
      height: 200px;
      transition: opacity 2s ease-in-out;
    }}
    .from {{
      z-index: 1;
      opacity: 1;
      animation: fadeOut 2s forwards;
      animation-delay: 1s;
    }}
    .to {{
      z-index: 2;
      opacity: 0;
      animation: fadeIn 2s forwards;
      animation-delay: 3s;
    }}
    @keyframes fadeOut {{
      to {{ opacity: 0; }}
    }}
    @keyframes fadeIn {{
      to {{ opacity: 1; }}
    }}
  </style>
</head>
<body>
  <div><span class="highlight">@{username}</span>'s <span class="highlight">{from_name}</span> is evolving...</div>
  <div class="sprites">
    <img class="from" src="{from_sprite}" alt="{from_name}">
    <img class="to" src="{to_sprite}" alt="{to_name}">
  </div>
  <div><span class="highlight">{from_name}</span> evolved into <span class="highlight">{to_name}</span>!</div>
</body>
</html>""")
def generate_howto_page(output_file="howto.html"):
    os.makedirs("output", exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>How To Play – Pokémon Catcher</title>
  <style>
    body {
      font-family: 'Segoe UI', sans-serif;
      background: #f9f9ff;
      margin: 0;
      padding: 40px;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
      color: #333;
    }
    h1 {
      text-align: center;
      color: #2c3e50;
    }
    ul {
      margin-top: 20px;
      padding-left: 20px;
      line-height: 1.6;
    }
    li {
      margin-bottom: 12px;
    }
    .sprite {
      float: right;
      width: 120px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 14px;
      color: #777;
    }
  </style>
</head>
<body>
  <h1>🧠 How to Play Pokémon Catcher</h1>
  <img class="sprite" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png" alt="Bulbasaur">

  <ul>
    <li><strong>Live Spawns:</strong> A wild Pokémon spawns every 3 minutes. It has random stats, level and rarity.</li>
    <li><strong>Catch Mechanism:</strong> Viewers like the stream – every like acts as a ticket. The more likes you send, the higher your chance to catch the Pokémon!</li>
    <li><strong>Fusion Evolution:</strong> When you catch two of the same Pokémon, they automatically evolve to the next stage.</li>
    <li><strong>Stats & Power:</strong> Stats of both Pokémon are added together. There's no 31 cap – evolved Pokémon can be very strong!</li>
    <li><strong>Stage Limit:</strong> You can only hold 3 Pokémon per evolution stage. New ones won't be added unless they trigger an evolution.</li>
    <li><strong>Shiny Pokémon:</strong> Rare and powerful! Catching one is a badge of honor (and bonus points!).</li>
    <li><strong>Climb the Rankings:</strong> Evolve strategically, collect the strongest team, and dominate the leaderboard.</li>
  </ul>

  <div class="footer">
    💡 Tip: Stay active and watch for shiny opportunities – only the best catchers rise to the top!
  </div>
</body>
</html>""")
