@echo off
REM ============================================================
REM Iniciar el sistema POS - Mascotitas Felices
REM ============================================================

cd /d "%~dp0"

echo.
echo  ====================================================
echo   Iniciando Mascotitas Felices POS
echo  ====================================================
echo.

REM Verificar que existe el venv
if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] No se encuentra el entorno virtual.
    echo Ejecuta primero la instalacion con instalar.bat
    pause
    exit /b 1
)

REM Activar venv
call venv\Scripts\activate.bat

REM Verificar dependencias
echo [1/3] Verificando dependencias...
python -c "import fastapi, uvicorn, jose, passlib" 2>nul
if errorlevel 1 (
    echo [INFO] Instalando dependencias faltantes...
    pip install -q -r requirements.txt
)

REM Migrar BD si es necesario
echo [2/3] Verificando base de datos...
python migrar.py

REM Iniciar servidor
echo [3/3] Iniciando servidor en http://localhost:8000
echo.
echo  ====================================================
echo   El sistema esta corriendo. NO CIERRES esta ventana.
echo   Para usarlo: abre el navegador en
echo       http://localhost:8000/docs   (API)
echo       http://localhost:5173        (interfaz)
echo  ====================================================
echo.

uvicorn main:app --host 0.0.0.0 --port 8000

pause
