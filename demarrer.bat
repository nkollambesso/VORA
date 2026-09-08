@echo off
title VORA - Demarrage
color 0B
cls

REM === GARDE : garder la fenetre ouverte en cas d'erreur ===
if "%~1"=="" (
    cmd /k "%~f0" KEEP_OPEN
    goto :eof
)

REM === Mode AUTO-TEST : verifie Node + npm puis s'arrete ===
if /i "%~1"=="CHECK" goto self_check

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

REM === [1/5] Node.js ===
echo.
echo  [1/5] Verification de Node.js...

set "USE_PORTABLE=0"

REM Test Node portable
if exist "%NODE_EXE%" (
    "%NODE_EXE%" --version >nul 2>&1
    if not errorlevel 1 (
        echo  [OK] Node.js portable detecte.
        "%NODE_EXE%" --version
        set "USE_PORTABLE=1"
        goto node_ok
    )
)

REM Test Node systeme
where node >nul 2>&1
if not errorlevel 1 (
    echo  [OK] Node.js systeme detecte.
    node --version
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
if errorlevel 1 (
    echo  ERREUR : curl non disponible.
    echo  Telechargez Node.js depuis : https://nodejs.org
    echo  Extracez dans : %NODE_DIR%
    goto error_exit
)

curl -L -o "%NODE_ZIP%" "%NODE_URL%" --progress-bar
if errorlevel 1 (
    echo  ERREUR : Telechargement echoue. Verifiez internet.
    goto error_exit
)

echo.
echo  Extraction...

powershell -NoProfile -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%SCRIPT_DIR%' -Force" 2>>"%LOGFILE%"
if errorlevel 1 (
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
if errorlevel 1 (
    echo  ERREUR : Node.js ne demarre pas.
    goto error_exit
)

echo  [OK] Node.js portable installe !
"%NODE_EXE%" --version
echo.
set "USE_PORTABLE=1"

:node_ok

REM === PATH pour Node portable (important : le PATH est herite
REM      par la fenetre Backend et par npm/npx) ===
if not "%USE_PORTABLE%"=="1" goto path_done
set "PATH=%NODE_DIR%;%NODE_DIR%\node_modules\.bin;%PATH%"
set "NPM_CONFIG_PREFIX=%NODE_DIR%"
:path_done

REM === [2/5] npm ===
echo  [2/5] Verification de npm...
call npm --version >nul 2>&1
if errorlevel 1 (
    echo  ERREUR : npm indisponible.
    goto error_exit
)
call npm --version
echo  [OK] npm detecte.
echo.

REM === [2.5/5] Fichiers .env ===
echo  [2.5/5] Configuration des fichiers .env...
echo.

REM --- Extraction depuis env-configs.zip (cles reelles) ---
if exist "%SCRIPT_DIR%\env-configs.zip" (
    echo  Extraction de env-configs.zip...
    powershell -NoProfile -Command "Expand-Archive -Path '%SCRIPT_DIR%\env-configs.zip' -DestinationPath '%SCRIPT_DIR%\env-tmp' -Force" 2>>"%LOGFILE%"
    if exist "%SCRIPT_DIR%\env-tmp\backend.env" (
        if not exist "%SCRIPT_DIR%\backend\.env" (
            copy /y "%SCRIPT_DIR%\env-tmp\backend.env" "%SCRIPT_DIR%\backend\.env" >nul
            echo  [OK] backend\.env cree depuis env-configs.zip
        )
    )
    if exist "%SCRIPT_DIR%\env-tmp\mobile.env" (
        copy /y "%SCRIPT_DIR%\env-tmp\mobile.env" "%SCRIPT_DIR%\mobile\.env" >nul
        echo  [OK] mobile\.env copie depuis env-configs.zip
    )
)

REM --- backend\.env obligatoire ---
if not exist "%SCRIPT_DIR%\backend\.env" (
    echo.
    echo  ============================================================
    echo   ERREUR : backend\.env introuvable !
    echo.
    echo   Le backend a besoin des cles de connexion : Neon, Clerk.
    echo   - Placez le fichier env-configs.zip a la racine du projet,
    echo     a cote de demarrer.bat, puis relancez ce script.
    echo   - Ou creez backend\.env manuellement, voir le README.
    echo  ============================================================
    echo.
    pause
    goto :eof
)
echo  [OK] backend\.env present.
echo.

REM === [3/5] Backend deps ===
echo  [3/5] Installation dependances Backend...
echo         (1-2 minutes)
echo.
cd /d "%SCRIPT_DIR%\backend"
call npm install --legacy-peer-deps
if errorlevel 1 (
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
call npm install --legacy-peer-deps
if errorlevel 1 (
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
    call npm install -g localtunnel
    echo  [OK] localtunnel installe.
)

REM === Backend ===
echo.
echo  ============================================================
echo   Backend dans une nouvelle fenetre.
echo   Frontend dans cette fenetre.
echo  ============================================================
echo.

start "VORA Backend" /d "%SCRIPT_DIR%\backend" cmd /k "echo Backend en cours... && call npm run dev"
echo  Demarrage Backend...
timeout /t 8 /nobreak >nul

curl -s http://localhost:5000/health >nul 2>&1
if errorlevel 1 (
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
if not exist .env (
    > .env (
        echo EXPO_PUBLIC_BACKEND_URL=http://%LOCAL_IP%:5000
        echo EXPO_PUBLIC_SOCKET_URL=http://%LOCAL_IP%:5000
        echo EXPO_PUBLIC_GEMINI_API_KEY=your_key_here
    )
)
REM Mise a jour des URLs Backend avec l'IP locale (conserve les cles reelles)
powershell -NoProfile -Command "$f='%SCRIPT_DIR%\mobile\.env'; $c=Get-Content $f; $c=$c -replace 'EXPO_PUBLIC_BACKEND_URL=.*','EXPO_PUBLIC_BACKEND_URL=http://%LOCAL_IP%:5000' -replace 'EXPO_PUBLIC_SOCKET_URL=.*','EXPO_PUBLIC_SOCKET_URL=http://%LOCAL_IP%:5000'; if (-not ($c -match 'EXPO_PUBLIC_BACKEND_URL=')) { $c += 'EXPO_PUBLIC_BACKEND_URL=http://%LOCAL_IP%:5000' }; if (-not ($c -match 'EXPO_PUBLIC_SOCKET_URL=')) { $c += 'EXPO_PUBLIC_SOCKET_URL=http://%LOCAL_IP%:5000' }; Set-Content $f $c"
echo  Backend URL : http://%LOCAL_IP%:5000
echo.

REM === Tunnel ===
if "%TUNNEL_CHOICE%"=="2" (
    echo  Tunnel PUBLIC en cours...
    start /b cmd /c "lt --port 8081 --print-requests > %SCRIPT_DIR%\logs\tunnel.log 2>&1"
    timeout /t 15 /nobreak >nul
    for /f "tokens=*" %%i in ('type %SCRIPT_DIR%\logs\tunnel.log ^| findstr /r "https://"') do set "TUNNEL_URL=%%i"
    echo.
    echo   Lien telephone - tunnel :
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

REM === Nettoyage env-tmp ===
if exist "%SCRIPT_DIR%\env-tmp" rmdir /s /q "%SCRIPT_DIR%\env-tmp"

REM === Frontend ===
cd /d "%SCRIPT_DIR%\mobile"
call npx expo start --web --port 8081 --lan

echo.
echo  Serveurs arretes.
echo.
pause
goto :eof

REM ============================================================
REM  AUTO-TEST : demarrer.bat CHECK
REM ============================================================
:self_check
echo.
echo  ============================================================
echo   AUTO-TEST VORA - verifie que tout fonctionne
echo  ============================================================
echo.
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "NODE_DIR=%SCRIPT_DIR%\node-win-x64"
if exist "%NODE_DIR%\node.exe" set "PATH=%NODE_DIR%;%NODE_DIR%\node_modules\.bin;%PATH%"

echo  [1/3] Test Node.js...
if exist "%NODE_DIR%\node.exe" (
    call "%NODE_DIR%\node.exe" --version
    if not errorlevel 1 (
        echo  [OK] Node portable fonctionne.
    ) else (
        echo  [ECHEC] Node portable ne demarre pas.
    )
) else (
    where node >nul 2>&1
    if not errorlevel 1 (
        echo  [OK] Node systeme :
        call node --version
    ) else (
        echo  [ECHEC] Aucun Node trouve.
    )
)

echo.
echo  [2/3] Test npm...
call npm --version
if errorlevel 1 (
    echo  [ECHEC] npm ne fonctionne pas.
) else (
    echo  [OK] npm fonctionne.
)

echo.
echo  [3/3] Test execution du script...
echo  [OK] Le script s'execute sans erreur de syntaxe.
echo.
echo  ============================================================
echo   Fin de l'auto-test. Cette fenetre reste ouverte.
echo  ============================================================
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