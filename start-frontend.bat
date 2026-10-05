@echo off
REM ===== Synferrous frontend launcher (Windows, npm) =====
cd /d "%~dp0frontend"

echo Installing frontend dependencies (first run only, may take a few minutes)...
echo (Using --legacy-peer-deps to work around a known peer-dependency conflict.)
call npm install --legacy-peer-deps

echo.
echo ============================================================
echo  Synferrous frontend starting at http://localhost:3000
echo  Your browser should open automatically once it compiles.
echo  Leave this window open. Press Ctrl+C to stop.
echo ============================================================
echo.
call npm start
pause
