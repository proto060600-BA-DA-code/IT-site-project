@echo off
REM ===== RK AI Labs backend launcher (Windows) =====
cd /d "%~dp0backend"

if not exist venv (
  echo Creating Python virtual environment...
  python -m venv venv
)

call venv\Scripts\activate.bat

echo Installing backend dependencies (first run only, may take a few minutes)...
python -m pip install --upgrade pip >nul
pip install -r requirements-local.txt

echo.
echo ============================================================
echo  RK AI Labs backend starting at http://localhost:8001
echo  API base: http://localhost:8001/api   (health: /api/health)
echo  Leave this window open. Press Ctrl+C to stop.
echo ============================================================
echo.
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
pause
