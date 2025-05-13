@echo off
cd /d "C:\Users\nickj\Desktop\TikTok"

:loop
:: Warten bis Schreibvorgänge abgeschlossen sind
timeout /t 2 >nul

:: Force Add alle HTMLs rekursiv
git add *.html
git add output\*.html
git add output\dex_detail\*.html
git add output\trainer_pages\*.html

:: Commit
git commit -m "🔁 Auto-update %date% %time%" >nul 2>&1

:: Remote Änderungen holen
git fetch origin gh-pages

:: Stash Änderungen (zwingend notwendig für rebase)
git stash push -m "Auto stash"

:: Rebase gegen remote
git rebase origin/gh-pages

:: Änderungen wiederherstellen (falls noch was da ist)
git stash pop || echo Nothing to pop

:: Push
git push origin gh-pages

:: Wiederholen nach 60 Sekunden
timeout /t 60 >nul
goto loop
