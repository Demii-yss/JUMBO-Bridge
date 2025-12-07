@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo Starting JUMBO Bridge Game Hall...
start "JUMBO Bridge Game Hall" npm run dev

REM Wait a moment for network to be ready
timeout /t 2 >nul

REM Find IPv4 Address (Naive approach: gets the first IPv4 that isn't empty)
set "IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| find "IPv4"') do (
    if not defined IP (
        set "IP=%%a"
        REM Trim leading space
        set "IP=!IP:~1!"
    )
)

if "%IP%"=="" (
    echo Could not automatically detect IP address.
) else (
    set "URL=http://%IP%:3000"
    echo.
    echo ========================================================
    echo   Your LAN IP Address found: %IP%
    echo   Share this URL with your friends:
    echo.
    echo   !URL!
    echo.
    echo   (This URL has been copied to your clipboard)
    echo ========================================================
    echo.
    echo !URL!| clip
)

echo.
echo Server is running. Do not close this window if you want others to connect.
echo Press any key to assume server is stopped or to close this helper script...
pause
exit
