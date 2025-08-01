@echo off
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
