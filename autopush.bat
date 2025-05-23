@echo off
:loop
call loop_push.bat
timeout /t 100 >nul
goto loop
