@echo off
:loop
call loop_push.bat
timeout /t 150 >nul
goto loop
