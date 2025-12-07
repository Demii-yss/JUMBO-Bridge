@echo off
echo Stopping JUMBO Bridge Server...

REM Find the PID listening on port 3000 and kill it
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM Force close the specific window by title
taskkill /FI "WINDOWTITLE eq JUMBO Bridge Game Hall*" /T /F >nul 2>&1

exit
