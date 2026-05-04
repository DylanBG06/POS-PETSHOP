@echo off
REM ============================================================
REM Iniciar el frontend del POS
REM ============================================================

cd /d "%~dp0"

echo.
echo  ====================================================
echo   Iniciando interfaz Mascotitas Felices POS
echo  ====================================================
echo.

REM Verificar Node.js
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado.
    echo Descarga Node.js LTS desde https://nodejs.org/
    pause
    exit /b 1
)

REM Verificar dependencias
if not exist "node_modules" (
    echo [INFO] Instalando dependencias por primera vez...
    npm install
)

echo.
echo  ====================================================
echo   Abriendo en http://localhost:5173
echo   El backend tiene que estar corriendo en otra ventana.
echo  ====================================================
echo.

npm run dev

pause
