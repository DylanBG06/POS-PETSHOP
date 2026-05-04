@echo off
REM ============================================================
REM Actualizar el frontend del POS
REM ============================================================

cd /d "%~dp0"

echo.
echo  ====================================================
echo   Actualizando interfaz Mascotitas Felices POS
echo  ====================================================
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git no esta instalado
    pause
    exit /b 1
)

echo [1/2] Descargando ultima version...
git pull

echo [2/2] Actualizando dependencias...
npm install

echo.
echo  ====================================================
echo   Actualizacion completada!
echo   Ejecuta iniciar.bat para arrancar.
echo  ====================================================
echo.
pause
