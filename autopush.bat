@echo off
:loop
call loop_push.bat
timeout /t 160 >nul
goto loop
