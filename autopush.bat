@echo off
:loop
call loop_push.bat
timeout /t 30 >nul
goto loop
