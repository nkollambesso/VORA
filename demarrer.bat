@echo off
title VORA - Demarrage
color 0B
cls

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║                                                          ║
echo  ║       ██╗   ██╗ █████╗  ██████╗ █████╗                  ║
echo  ║       ██║   ██║██╔══██╗██╔════╝██╔══██╗                 ║
echo  ║       ██║   ██║███████║██║     ███████║                 ║
echo  ║       ╚██╗ ██╔╝██╔══██║██║     ██╔══██║                 ║
echo  ║        ╚████╔╝ ██║  ██║╚██████╗██║  ██║                 ║
echo  ║         ╚═══╝  ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝                 ║
echo  ║                                                          ║
echo  ║       Plateforme de Mobilite Urbaine ^& VTC              ║
echo  ║                                                          ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
echo  Ce script va :
echo    1. Installer toutes les dependances automatiquement
echo    2. Demarrer le serveur Backend et Frontend
echo    3. Afficher le lien pour ouvrir sur votre telephone
echo.
echo  Appuyez sur une touche pour commencer...
pause >nul

echo.
echo  [1/5] Verification de Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ============================================================
    echo   ERREUR : Node.js n'est pas installe !
    echo.
    echo   Telechargez Node.js depuis :
    echo   https://nodejs.org
    echo.
    echo   Choisissez la version LTS (recommandee).
    echo   Apres l'installation, relancez ce script.
    echo  ============================================================
    echo.
    pause
    exit /b 1
)

echo  [OK] Node.js detecte.
node --version
echo.

echo  [2/5] Verification de npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERREUR : npm n'est pas installe !
    echo  Reinstallez Node.js depuis https://nodejs.org
    pause
    exit /b 1
)
echo  [OK] npm detecte.
npm --version
echo.

echo  [3/5] Installation des dependances Backend...
echo         (Cela peut prendre 1-2 minutes)
echo.
cd /d "%~dp0backend"
call npm install --legacy-peer-deps
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

echo  [4/5] Installation des dependances Frontend...
echo         (Cela peut prendre 2-3 minutes, de nombreuses dependances)
echo.
cd /d "%~dp0mobile"
call npm install --legacy-peer-deps
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

echo  [5/5] Demarrage des serveurs...
echo.
echo  ============================================================
echo   Le serveur Backend va demarrer dans une nouvelle fenetre.
echo   Le serveur Frontend (Expo) va demarrer dans cette fenetre.
echo.
echo   Une fois tout demarre, vous verrez le lien a ouvrir
echo   sur votre telephone.
echo  ============================================================
echo.

cd /d "%~dp0backend"

REM Demarrer le backend dans une nouvelle fenetre cmd
start "VORA Backend" cmd /k "cd /d %~dp0backend && echo Backend VORA en cours de demarrage... && npm run dev"

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

REM Detecter l'IP locale
echo  Detection de votre adresse IP locale...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /v "127.0.0.1"') do (
    set LOCAL_IP=%%a
)
REM Nettoyer les espaces
set LOCAL_IP=%LOCAL_IP: =%

if "%LOCAL_IP%"=="" (
    set LOCAL_IP=127.0.0.1
    echo  [INFO] IP locale non detectee, utilisation de localhost.
)

echo  [OK] IP Locale : %LOCAL_IP%
echo.

REM Mettre a jour le .env du mobile avec l'IP locale
cd /d "%~dp0mobile"
(
    echo EXPO_PUBLIC_BACKEND_URL=http://%LOCAL_IP%:5000
    echo EXPO_PUBLIC_SOCKET_URL=http://%LOCAL_IP%:5000
    echo EXPO_PUBLIC_GEMINI_API_KEY=your_key_here
) > .env

echo  Configuration du Backend URL : http://%LOCAL_IP%:5000
echo.

echo  Demarrage du Frontend Expo (cela peut prendre quelques secondes)...
echo.
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
echo.

cd /d "%~dp0mobile"
call npx expo start --web --port 8081 --lan

echo.
echo  ============================================================
echo   Serveurs arretes. Appuyez sur une touche pour fermer.
echo  ============================================================
pause >nul
