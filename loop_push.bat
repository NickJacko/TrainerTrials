@echo off
cd /d "C:\Users\nickj\Desktop\TikTok"

:: Sicherstellen, dass der Remote-Branch gh-pages korrekt verwendet wird
git fetch origin gh-pages
git checkout gh-pages || git checkout -b gh-pages origin/gh-pages

:loop
:: Kurze Wartezeit, um Dateisystemänderungen sicher zu erkennen
timeout /t 2 >nul

:: Einzelne gezielte Dateien hinzufügen (nur wenn sie existieren)
for %%F in (
  catchdex_live.html
  catcher.json
  catcher_detail.html
  catcher_ranking_live.html
  dex_detail.html
  dex_list.json
  donations.html
  evolution_lines.json
  gen_config.json
  howto.html
  imprint.html
  index.html
  privacy.html
  ranking_catchmon_live.html
  seen_caught.json
  utils.js
) do (
  if exist "%%F" git add "%%F"
)

:: Ganze Ordner hinzufügen, falls vorhanden
if exist "catchmon" git add catchmon
if exist "sounds" git add sounds

:: Commit nur, wenn sich etwas geändert hat
git diff --cached --quiet || (
  git commit -m "🔁 Auto-update %date% %time%"
)

:: Upstream aktualisieren und eventuelle lokale Änderungen kurz zurücklegen
git fetch origin gh-pages
git stash push -m "Auto stash"
git rebase origin/gh-pages
git stash pop || echo Nothing to pop

:: Änderungen pushen
git push origin gh-pages

:: Schleife wiederholen alle 60 Sekunden
timeout /t 60 >nul
goto loop
