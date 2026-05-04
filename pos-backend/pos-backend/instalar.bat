@echo off
REM ============================================================
REM Instalación inicial del sistema POS
REM Ejecutalo solo la primera vez
REM ============================================================

cd /d "%~dp0"

echo.
echo  ====================================================
echo   Instalacion Mascotitas Felices POS
echo  ====================================================
echo.

REM Verificar Python
where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python no esta instalado.
    echo Descarga Python 3.11+ desde https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/3] Creando entorno virtual...
if exist "venv" (
    echo     Ya existe, continuando...
) else (
    python -m venv venv
)

echo [2/3] Activando entorno virtual e instalando dependencias...
call venv\Scripts\activate.bat
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt

echo [3/3] Inicializando base de datos...
python migrar.py

echo.
echo  ====================================================
echo   Instalacion completada!
echo.
echo   Usuario por defecto:
echo       Usuario:    admin
echo       Contrasena: admin123
echo.
echo   IMPORTANTE: cambia la contrasena en el primer login.
echo.
echo   Ahora ejecuta iniciar.bat para arrancar el sistema.
echo  ====================================================
echo.
pause
