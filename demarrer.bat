@echo off
title VORA - Demarrage
color 0B
cls

REM === GARDE : garder la fenetre ouverte en cas d'erreur ===
if "%~1"=="" (
    cmd /k "%~f0" KEEP_OPEN
    goto :eof
)

echo.
echo  ============================================================
echo.
echo     V V V     VORA
echo      V O R A
echo.
echo     Plateforme de Mobilite Urbaine et VTC
echo.
echo  ============================================================
echo.
echo  Ce script va :
echo    1. Installer Node.js portable si besoin
echo    2. Installer toutes les dependances
echo    3. Demarrer Backend + Frontend
echo    4. Afficher le lien pour ouvrir sur votre telephone
echo.
echo  Appuyez sur une touche pour commencer...
pause >nul

REM === Log ===
set "LOGFILE=%~dp0logs\vora-start.log"
if not exist "%~dp0logs" mkdir "%~dp0logs"
echo === VORA Demarrage %date% %time% === > "%LOGFILE%"

REM === Repertoire du script ===
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM === Config Node ===
set "NODE_VERSION=v20.18.1"
set "NODE_DIR=%SCRIPT_DIR%\node-win-x64"
set "NODE_EXE=%NODE_DIR%\node.exe"

echo [DEBUG] SCRIPT_DIR=%SCRIPT_DIR% >> "%LOGFILE%"

REM === [1/5] Node.js ===
echo.
echo  [1/5] Verification de Node.js...

set "USE_PORTABLE=0"

REM Test Node portable
if exist "%NODE_EXE%" (
    "%NODE_EXE%" --version >nul 2>&1
    if %errorlevel% equ 0 (
        echo  [OK] Node.js portable detecte.
        "%NODE_EXE%" --version
        goto node_ok
    )
)

REM Test Node systeme
where node >nul 2>&1
if %errorlevel% equ 0 (
    echo  [OK] Node.js systeme detecte.
    node --version
    set "NODE_EXE=node"
    set "NODE_DIR="
    goto node_ok
)

REM Telecharger Node portable
echo.
echo  ============================================================
echo   Node.js non detecte. Installation automatique...
echo   (1-2 minutes, premiere fois uniquement)
echo  ============================================================
echo.

set "ARCH=x64"
if "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ARCH=arm64"

set "NODE_URL=https://node.org/dist/%NODE_VERSION%/node-%NODE_VERSION%-win-%ARCH%.zip"
set "NODE_ZIP=%SCRIPT_DIR%\node-download.zip"

echo  Telechargement de Node.js %NODE_VERSION% (%ARCH%)...
echo.

where curl >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERREUR : curl non disponible.
    echo  Telechargez Node.js depuis : https://nodejs.org
    echo  Extracez dans : %NODE_DIR%
    goto error_exit
)

curl -L -o "%NODE_ZIP%" "%NODE_URL%" --progress-bar
if %errorlevel% neq 0 (
    echo  ERREUR : Telechargement echoue. Verifiez internet.
    goto error_exit
)

echo.
echo  Extraction...

powershell -NoProfile -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%SCRIPT_DIR%' -Force" 2>>"%LOGFILE%"
if %errorlevel% neq 0 (
    echo  ERREUR extraction. Voir : %LOGFILE%
    goto error_exit
)

set "EXTRACTED_DIR=%SCRIPT_DIR%\node-%NODE_VERSION%-win-%ARCH%"
if exist "%EXTRACTED_DIR%" (
    if exist "%NODE_DIR%" rmdir /s /q "%NODE_DIR%" 2>nul
    rename "%EXTRACTED_DIR%" "node-win-x64"
)

del "%NODE_ZIP%" 2>nul

if not exist "%NODE_EXE%" (
    echo  ERREUR : Fichier introuvable : %NODE_EXE%
    goto error_exit
)

"%NODE_EXE%" --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERREUR : Node.js ne demarre pas.
    goto error_exit
)

echo  [OK] Node.js portable installe !
"%NODE_EXE%" --version
echo.
set "USE_PORTABLE=1"

:node_ok

REM === PATH pour Node portable ===
if "%USE_PORTABLE%"=="1" (
    set "PATH=%NODE_DIR%;%NODE_DIR%\node_modules\.bin;%PATH%"
    set "NPM_CONFIG_PREFIX=%NODE_DIR%"
)
set "NPM_CMD=npm"
set "NPX_CMD=npx"
if "%USE_PORTABLE%"=="1" (
    set "NPM_CMD=%NODE_DIR%\npm.cmd"
    set "NPX_CMD=%NODE_DIR%\npx.cmd"
)

REM === [2/5] npm ===
echo  [2/5] Verification de npm...
"%NPM_CMD%" --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERREUR : npm indisponible.
    goto error_exit
)
"%NPM_CMD%" --version
echo  [OK] npm detecte.
echo.

REM === [3/5] Backend deps ===
echo  [3/5] Installation dependances Backend...
echo         (1-2 minutes)
echo.
cd /d "%SCRIPT_DIR%\backend"
"%NPM_CMD%" install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo  ERREUR installation Backend. Verifiez internet.
    goto error_exit
)
echo.
echo  [OK] Backend installe !
echo.

REM === [4/5] Frontend deps ===
echo  [4/5] Installation dependances Frontend...
echo         (2-3 minutes)
echo.
cd /d "%SCRIPT_DIR%\mobile"
"%NPM_CMD%" install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo  ERREUR installation Frontend. Verifiez internet.
    goto error_exit
)
echo.
echo  [OK] Frontend installe !
echo.

REM === [5/5] Lancement ===
echo  [5/5] Demarrage des serveurs...
echo.
echo  ============================================================
echo   Mode d'acces :
echo.
echo   [1] Reseau local (Wi-Fi)
echo   [2] Tunnel public (internet)
echo.
set /p TUNNEL_CHOICE="  Entrez 1 ou 2 : "
if "%TUNNEL_CHOICE%"=="2" (
    echo  Installation de localtunnel...
    "%NPM_CMD%" install -g localtunnel
    echo  [OK] localtunnel installe.
)

REM === Backend ===
echo.
echo  ============================================================
echo   Backend dans une nouvelle fenetre.
echo   Frontend dans cette fenetre.
echo  ============================================================
echo.

cd /d "%SCRIPT_DIR%\backend"
if "%USE_PORTABLE%"=="1" (
    start "VORA Backend" cmd /k "cd /d "%SCRIPT_DIR%\backend" && set "PATH=%NODE_DIR%;%NODE_DIR%\node_modules\.bin;%PATH%" && set "NPM_CONFIG_PREFIX=%NODE_DIR%" && echo Backend en cours... && "%NODE_EXE%" "%NPM_CMD%" run dev"
) else (
    start "VORA Backend" cmd /k "cd /d "%SCRIPT_DIR%\backend" && echo Backend en cours... && npm run dev"
)

echo  Demarrage Backend...
timeout /t 8 /nobreak >nul

curl -s http://localhost:5000/health >nul 2>&1
if %errorlevel% neq 0 (
    echo  [INFO] Backend en retard...
    timeout /t 5 /nobreak >nul
)

echo  [OK] Backend sur http://localhost:5000
echo.

REM === IP locale ===
echo  Detection IP locale...
set "LOCAL_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /v "127.0.0.1"') do (
    set "LOCAL_IP=%%a"
)
set "LOCAL_IP=%LOCAL_IP: =%"
if "%LOCAL_IP%"=="" set "LOCAL_IP=127.0.0.1"
echo  [OK] IP : %LOCAL_IP%
echo.

REM === .env mobile ===
cd /d "%SCRIPT_DIR%\mobile"
> .env (
    echo EXPO_PUBLIC_BACKEND_URL=http://%LOCAL_IP%:5000
    echo EXPO_PUBLIC_SOCKET_URL=http://%LOCAL_IP%:5000
    echo EXPO_PUBLIC_GEMINI_API_KEY=your_key_here
)
echo  Backend URL : http://%LOCAL_IP%:5000
echo.

REM === Tunnel ===
if "%TUNNEL_CHOICE%"=="2" (
    echo  Tunnel PUBLIC en cours...
    start /b cmd /c "lt --port 8081 --print-requests > %SCRIPT_DIR%\logs\tunnel.log 2>&1"
    timeout /t 15 /nobreak >nul
    for /f "tokens=*" %%i in ('type %SCRIPT_DIR%\logs\tunnel.log ^| findstr /r "https://"') do set "TUNNEL_URL=%%i"
    echo.
    echo   Lien telephone (tunnel) :
    echo   %TUNNEL_URL%
    echo.
) else (
    echo  ============================================================
    echo.
    echo   SUR VOTRE TELEPHONE :
    echo   Ouvrez le navigateur et tapez :
    echo.
    echo     http://%LOCAL_IP%:8081
    echo.
    echo  ============================================================
)

REM === Frontend ===
cd /d "%SCRIPT_DIR%\mobile"
"%NPX_CMD%" expo start --web --port 8081 --lan

echo.
echo  Serveurs arretes.
echo.
pause
goto :eof

:error_exit
echo.
echo  ============================================================
echo   ERREUR - Consultez : %LOGFILE%
echo  ============================================================
echo.
pause
