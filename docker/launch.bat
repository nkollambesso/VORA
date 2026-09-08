@echo off
title VORA - Docker Launcher
color 0B
cls

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║                                                          ║
echo  ║   VORA - Lanceur Docker (sans Node.js requis)           ║
echo  ║                                                          ║
echo  ║   Ce script lance VORA dans des conteneurs Docker.      ║
echo  ║   Vous n'avez PAS besoin d'installer Node.js.           ║
echo  ║                                                          ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
echo  Prerequis : Docker Desktop doit etre installe et en cours
echo  d'execution sur votre ordinateur.
echo.
echo  Telecharger Docker Desktop :
echo    https://www.docker.com/products/docker-desktop
echo.
echo  Appuyez sur une touche pour continuer...
pause >nul

echo.
echo  [1/4] Verification de Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ============================================================
    echo   ERREUR : Docker n'est pas installe ou n'est pas dans le PATH.
    echo.
    echo   1. Telechargez Docker Desktop depuis :
    echo      https://www.docker.com/products/docker-desktop
    echo.
    echo   2. Installez-le et redemarrez votre ordinateur.
    echo.
    echo   3. Relancez ce script.
    echo  ============================================================
    echo.
    pause
    exit /b 1
)

docker --version
echo  [OK] Docker detecte.
echo.

echo  [2/4] Verification de Docker Compose...
docker compose version >nul 2>&1
if %errorlevel% neq 0 (
    docker-compose --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo  ERREUR : Docker Compose n'est pas disponible.
        echo  Mettez a jour Docker Desktop.
        pause
        exit /b 1
    )
    set COMPOSE_CMD=docker-compose
) else (
    set COMPOSE_CMD=docker compose
)
echo  [OK] Docker Compose detecte.
echo.

echo  [3/4] Copie de la configuration d'environnement...
cd /d "%~dp0"
if not exist "backend\.env" (
    if exist "env-configs.zip" (
        echo  Extraction de env-configs.zip...
        powershell -command "Expand-Archive -Path 'env-configs.zip' -DestinationPath '.' -Force"
        if exist "backend.env" (
            copy /Y "backend.env" "backend\.env" >nul 2>&1
            echo  [OK] backend/.env cree depuis env-configs.zip
        )
    )
    if not exist "backend\.env" (
        echo  [INFO] Fichier backend/.env non trouve, creation d'un minimal...
        echo PORT=5000> backend\.env
        echo DATABASE_URL=postgresql://user:pass@host/neondb?sslmode=require>> backend\.env
        echo ADMIN_EMAIL=admin@vora.cm>> backend\.env
        echo ADMIN_PASSWORD=VoraAdmin2025!>> backend\.env
        echo ADMIN_COMMISSION_RATE=0.10>> backend\.env
    )
) else (
    echo  [OK] backend/.env deja existant.
)
echo.

echo  [4/4] Construction et demarrage des conteneurs Docker...
echo.
echo  ============================================================
echo   Construction des images Docker (peut prendre 5-10 min
echo   lors de la premiere execution)...
echo  ============================================================
echo.

%COMPOSE_CMD% up --build
