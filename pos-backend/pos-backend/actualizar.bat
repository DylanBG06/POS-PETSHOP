@echo off
REM ============================================================
REM Actualizar el sistema POS desde Git
REM ============================================================

cd /d "%~dp0"

echo.
echo  ====================================================
echo   Actualizando Mascotitas Felices POS
echo  ====================================================
echo.

REM Verificar que git existe
where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git no esta instalado o no esta en el PATH
    echo Descarga Git desde https://git-scm.com/download/win
    pause
    exit /b 1
)

REM Hacer backup de la BD por si acaso
if exist "pos.db" (
    echo [1/4] Respaldando base de datos...
    if not exist "backups" mkdir backups
    set "TIMESTAMP=%date:~6,4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%"
    set "TIMESTAMP=%TIMESTAMP: =0%"
    copy /Y pos.db "backups\pos_backup_%TIMESTAMP%.db" >nul
    echo     Backup en: backups\pos_backup_%TIMESTAMP%.db
)

REM Actualizar codigo
echo [2/4] Descargando ultima version...
git pull
if errorlevel 1 (
    echo [ERROR] Fallo el git pull. Revisa tu conexion o credenciales.
    pause
    exit /b 1
)

REM Actualizar dependencias
echo [3/4] Actualizando dependencias...
call venv\Scripts\activate.bat
pip install -q -r requirements.txt

REM Migrar BD
echo [4/4] Migrando base de datos...
python migrar.py

echo.
echo  ====================================================
echo   Actualizacion completada!
echo   Ejecuta iniciar.bat para arrancar el sistema.
echo  ====================================================
echo.
pause
