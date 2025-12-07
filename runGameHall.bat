@echo off
cd /d "%~dp0"
start "JUMBO Bridge Game Hall" /MIN npm run dev
echo Game Hall Server (JUMBO Bridge) has been started in a minimized window.
timeout /t 3
exit
