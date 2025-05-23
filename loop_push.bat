@echo off
cd /d "C:\Users\nickj\Desktop\TikTok"

:: Sicherstellen, dass du im richtigen Branch bist
git checkout gh-pages 2>nul || git checkout -b gh-pages

:loop
:: Kurze Wartezeit, um Änderungen zu erfassen
timeout /t 2 >nul

:: Alle relevanten Dateien adden – keine Pfadspec-Fehler mehr
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
  if exist %%F git add %%F
)

:: Ganze Ordner checken
if exist catchmon git add catchmon
if exist sounds git add sounds

:: Nur committen, wenn sich was geändert hat
git diff --cached --quiet || (
    git commit -m "🔁 Auto-update %date% %time%"
)

:: Upstream holen und rebasen
git fetch origin gh-pages
git stash push -m "Auto stash"
git rebase origin/gh-pages
git stash pop || echo Nothing to pop

:: Pushen
git push origin gh-pages

:: Wiederholen nach 60 Sekunden
timeout /t 60 >nul
goto loop
