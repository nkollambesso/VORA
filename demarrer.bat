@echo off
title VORA - Demarrage
color 0B
cls

echo.
echo      ___      ___  ______     _______        __
echo     ^|"  \    /"  ^|^|/    " \   /"      \      /""\
echo      \   \  //  /// ____  \ ^|:        |    /    \
echo       \  \/. .//  /    ) :)^|_____/   )   /' /\  \
echo        \.    // (: (____/ //  //      /   //  __'  \
echo         \   /  \        /  ^|:  __   \  /   /  \\  \
echo          \__/    \"_____/   ^|__^|  \___)(___/    \___)
echo.
echo   Plateforme de Mobilite Urbaine ^& VTC - Cameroun
echo.
echo  Ce script va :
echo    1. Installer Node.js portable (pas besoin de l'installer soi-meme)
echo    2. Installer toutes les dependances automatiquement
echo    3. Demarrer le serveur Backend et Frontend
echo    4. Afficher le lien pour ouvrir sur votre telephone
echo.
echo  Appuyez sur une touche pour commencer...
pause >nul

REM ─── Chemin vers le repertoire du script ─────────────────────────────────
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM ─── Config Node portable ────────────────────────────────────────────────
set "NODE_VERSION=v20.18.1"
set "NODE_DIR=%SCRIPT_DIR%\node-win-x64"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_CMD=%NODE_DIR%\npm.cmd"

REM ─── Verification / Installation de Node.js portable ─────────────────────
echo.
echo  [1/5] Verification de Node.js...

if exist "%NODE_EXE%" (
    "%NODE_EXE%" --version >nul 2>&1
    if %errorlevel% equ 0 (
        echo  [OK] Node.js portable detecte.
        "%NODE_EXE%" --version
        goto :node_ok
    )
)

echo.
echo  ============================================================
echo   Node.js portable non detecte. Installation automatique...
echo   (Cela prendre 1-2 minutes, uniquement la premiere fois)
echo  ============================================================
echo.

REM Detecter l'architecture
set "ARCH=x64"
if "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ARCH=arm64"

set "NODE_URL=https://node.org/dist/%NODE_VERSION%/node-%NODE_VERSION%-win-%ARCH%.zip"
set "NODE_ZIP=%SCRIPT_DIR%\node-download.zip"

echo  Telechargement de Node.js %NODE_VERSION% (%ARCH%)...
echo  URL : %NODE_URL%
echo.

REM Telecharger avec curl (inclus dans Windows 10+)
curl -L -o "%NODE_ZIP%" "%NODE_URL%" --progress-bar
if %errorlevel% neq 0 (
    echo.
    echo  ============================================================
    echo   ERREUR : Le telechargement a echoue !
    echo.
    echo   Verifiez votre connexion internet.
    echo   Si curl n'est pas disponible, telechargez Node.js manuellement :
    echo   https://nodejs.org
    echo.
    echo   Ensuite, extrayez le zip dans : %NODE_DIR%
    echo  ============================================================
    echo.
    pause
    exit /b 1
)

echo.
echo  Extraction de Node.js...

REM Extraire avec PowerShell (disponible sur tous les Windows 10+)
powershell -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%SCRIPT_DIR%' -Force"
if %errorlevel% neq 0 (
    echo  ERREUR lors de l'extraction.
    pause
    exit /b 1
)

REM Renommer le dossier extrait
set "EXTRACTED_DIR=%SCRIPT_DIR%\node-%NODE_VERSION%-win-%ARCH%"
if exist "%EXTRACTED_DIR%" (
    if exist "%NODE_DIR%" rmdir /s /q "%NODE_DIR%"
    rename "%EXTRACTED_DIR%" "node-win-x64"
)

REM Supprimer le zip
del "%NODE_ZIP%" 2>nul

if not exist "%NODE_EXE%" (
    echo  ============================================================
    echo   ERREUR : L'installation a echoue.
    echo   Fichier introuvable : %NODE_EXE%
    echo  ============================================================
    pause
    exit /b 1
)

"%NODE_EXE%" --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ============================================================
    echo   ERREUR : Node.js ne demarre pas correctement.
    echo  ============================================================
    pause
    exit /b 1
)

echo  [OK] Node.js portable installe !
"%NODE_EXE%" --version
echo.

:node_ok

REM ─── Ajouter Node portable au PATH pour cette session ───────────────────
set "PATH=%NODE_DIR%;%NODE_DIR%\node_modules\.bin;%PATH%"
set "NPM_CONFIG_PREFIX=%NODE_DIR%"

REM ─── Verification npm ───────────────────────────────────────────────────
echo  [2/5] Verification de npm...
"%NODE_EXE%" "%NPM_CMD%" --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERREUR : npm n'est pas disponible !
    echo  Reinstallez le script.
    pause
    exit /b 1
)
"%NODE_EXE%" "%NPM_CMD%" --version
echo  [OK] npm detecte.
echo.

REM ─── Installation des dependances Backend ───────────────────────────────
echo  [3/5] Installation des dependances Backend...
echo         (Cela peut prendre 1-2 minutes)
echo.
cd /d "%SCRIPT_DIR%\backend"
"%NODE_EXE%" "%NPM_CMD%" install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo.
    echo  ERREUR lors de l'installation Backend.
    echo  Verifiez votre connexion internet.
    pause
    exit /b 1
)
echo.
echo  [OK] Dependances Backend installees !
echo.

REM ─── Installation des dependances Frontend ──────────────────────────────
echo  [4/5] Installation des dependances Frontend...
echo         (Cela peut prendre 2-3 minutes, de nombreuses dependances)
echo.
cd /d "%SCRIPT_DIR%\mobile"
"%NODE_EXE%" "%NPM_CMD%" install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo.
    echo  ERREUR lors de l'installation Frontend.
    echo  Verifiez votre connexion internet.
    pause
    exit /b 1
)
echo.
echo  [OK] Dependances Frontend installees !
echo.

REM ─── Choix du mode d'acces ──────────────────────────────────────────────
echo  [5/5] Demarrage des serveurs...
echo.
echo  ============================================================
echo   Choisissez le mode d'acces :
echo.
echo   [1] Reseau local (Wi-Fi)    - Accessible sur le meme reseau
echo   [2] Tunnel public            - Accessible depuis n'importe ou (internet)
echo.
echo   Entrez 1 ou 2 :
set /p TUNNEL_CHOICE=""
if "%TUNNEL_CHOICE%"=="2" (
    echo.
    echo  [INFO] Installation de localtunnel pour l'acces distant...
    "%NODE_EXE%" "%NPM_CMD%" install -g localtunnel
    echo  [OK] localtunnel installe.
)
echo.
echo  ============================================================
echo   Le serveur Backend va demarrer dans une nouvelle fenetre.
echo   Le serveur Frontend (Expo) va demarrer dans cette fenetre.
echo.
echo   Une fois tout demarre, vous verrez le lien a ouvrir
echo   sur votre telephone.
echo  ============================================================
echo.

REM ─── Demarrage Backend ──────────────────────────────────────────────────
cd /d "%SCRIPT_DIR%\backend"

REM Demarrer le backend dans une nouvelle fenetre cmd
start "VORA Backend" cmd /k "cd /d %SCRIPT_DIR%\backend && set PATH=%NODE_DIR%;%NODE_DIR%\node_modules\.bin;%PATH% && set NPM_CONFIG_PREFIX=%NODE_DIR% && echo Backend VORA en cours de demarrage... && "%NODE_EXE%" "%NPM_CMD%" run dev"

REM Attendre que le backend demarre
echo  Demarrage du Backend en cours...
timeout /t 8 /nobreak >nul

REM Verifier que le backend est accessible
curl -s http://localhost:5000/health >nul 2>&1
if %errorlevel% neq 0 (
    echo  [INFO] Le Backend met encore du temps a demarrer...
    timeout /t 5 /nobreak >nul
)

echo.
echo  [OK] Backend demarre sur http://localhost:5000
echo.

REM ─── Detection IP locale ────────────────────────────────────────────────
echo  Detection de votre adresse IP locale...
set "LOCAL_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /v "127.0.0.1"') do (
    set "LOCAL_IP=%%a"
)
REM Nettoyer les espaces
set "LOCAL_IP=%LOCAL_IP: =%"

if "%LOCAL_IP%"=="" (
    set "LOCAL_IP=127.0.0.1"
    echo  [INFO] IP locale non detectee, utilisation de localhost.
)

echo  [OK] IP Locale : %LOCAL_IP%
echo.

REM ─── Configuration .env mobile ──────────────────────────────────────────
cd /d "%SCRIPT_DIR%\mobile"
(
    echo EXPO_PUBLIC_BACKEND_URL=http://%LOCAL_IP%:5000
    echo EXPO_PUBLIC_SOCKET_URL=http://%LOCAL_IP%:5000
    echo EXPO_PUBLIC_GEMINI_API_KEY=your_key_here
) > .env

echo  Configuration du Backend URL : http://%LOCAL_IP%:5000
echo.

REM ─── Tunnel public (optionnel) ─────────────────────────────────────────
echo  Demarrage du Frontend Expo (cela peut prendre quelques secondes)...
echo.
if "%TUNNEL_CHOICE%"=="2" (
    echo  ============================================================
    echo.
    echo   Mode TUNNEL PUBLIC - accessible depuis n'importe ou :
    echo.
    echo   En attente du tunnel public...
    echo.
    start /b cmd /c "lt --port 8081 --print-requests > %SCRIPT_DIR%\logs\tunnel.log 2>&1"
    timeout /t 15 /nobreak >nul
    for /f "tokens=*" %%i in ('type %SCRIPT_DIR%\logs\tunnel.log ^| findstr /r "https://"') do set TUNNEL_URL=%%i
    echo   Copiez ce lien dans le navigateur de votre telephone :
    echo.
    echo     %TUNNEL_URL%
    echo.
) else (
    echo  ============================================================
    echo.
    echo   SUR VOTRE TELEPHONE :
    echo   Ouvrez le navigateur et tapez :
    echo.
    echo     http://%LOCAL_IP%:8081
    echo.
    echo   OU scannez le QR code qui va apparaitre ci-dessous.
    echo.
    echo  ============================================================
)

REM ─── Demarrage Frontend ────────────────────────────────────────────────
cd /d "%SCRIPT_DIR%\mobile"
"%NODE_EXE%" "%NPM_CMD%" exec expo start -- --web --port 8081 --lan

echo.
echo  ============================================================
echo   Serveurs arretes. Appuyez sur une touche pour fermer.
echo  ============================================================
pause >nul
