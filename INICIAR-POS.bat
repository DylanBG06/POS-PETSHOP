@echo off
title Mascotitas Felices POS
cd /d "%~dp0"

echo Iniciando Mascotitas Felices POS...

REM --- Backend ---
start "Backend POS" /min cmd /k "cd /d "%~dp0pos-backend\pos-backend" && venv\Scripts\activate && python -m uvicorn main:app --host 0.0.0.0 --port 8000"

REM --- Esperar que el backend levante ---
timeout /t 5 /nobreak >nul

REM --- Frontend ---
start "Frontend POS" /min cmd /k "cd /d "%~dp0pos-frontend-v2\pos-frontend-v2" && npm run dev"

REM --- Esperar que el frontend levante ---
timeout /t 6 /nobreak >nul

REM --- Abrir navegador UNA SOLA VEZ ---
start "" "http://localhost:5173"

exit
