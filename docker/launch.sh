#!/usr/bin/env bash
# ============================================================================
#  VORA — Lanceur Docker (Linux / macOS)
#
#  Utilisation :
#    chmod +x docker/launch.sh && ./docker/launch.sh
# ============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✔ $1${RESET}"; }
fail() { echo -e "  ${RED}✘ $1${RESET}"; }
info() { echo -e "  ${DIM}$1${RESET}"; }
step() { echo -e "\n${BOLD}${BLUE}  ➤ $1${RESET}"; }

# Aller dans le répertoire du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${CYAN}  ╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}  ║                                                          ║${RESET}"
echo -e "${CYAN}  ║   ${BOLD}VORA — Lanceur Docker (sans Node.js requis)${RESET}${CYAN}           ║${RESET}"
echo -e "${CYAN}  ║                                                          ║${RESET}"
echo -e "${CYAN}  ╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  Ce script lance VORA dans des conteneurs Docker."
echo -e "  ${BOLD}Vous n'avez PAS besoin d'installer Node.js.${RESET}"
echo ""

# ─── Vérification Docker ────────────────────────────────────────────────────
step "Vérification de Docker"
if ! command -v docker &>/dev/null; then
    fail "Docker n'est pas installé !"
    echo ""
    echo -e "  ${BOLD}Installez Docker Desktop :${RESET}"
    echo -e "  ${CYAN}https://www.docker.com/products/docker-desktop${RESET}"
    echo ""
    exit 1
fi
ok "Docker détecté : $(docker --version)"

# Vérifier que Docker tourne
if ! docker info &>/dev/null 2>&1; then
    fail "Docker n'est pas en cours d'exécution !"
    echo -e "  ${YELLOW}Lancez Docker Desktop puis relancez ce script.${RESET}"
    exit 1
fi
ok "Docker est actif."

# ─── Vérification Docker Compose ────────────────────────────────────────────
step "Vérification de Docker Compose"
COMPOSE_CMD=""
if docker compose version &>/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
    ok "Docker Compose (plugin v2) détecté."
elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
    ok "Docker Compose (standalone) détecté."
else
    fail "Docker Compose n'est pas disponible !"
    echo -e "  ${YELLOW}Mettez à jour Docker Desktop : https://www.docker.com/products/docker-desktop${RESET}"
    exit 1
fi

# ─── Copier .env si nécessaire ──────────────────────────────────────────────
step "Configuration de l'environnement"
if [ ! -f "backend/.env" ]; then
    if [ -f "env-configs.zip" ]; then
        info "Extraction de env-configs.zip..."
        if command -v unzip &>/dev/null; then
            unzip -o env-configs.zip -d . >/dev/null 2>&1 || true
            [ -f "backend.env" ] && cp backend.env backend/.env && ok "backend/.env créé depuis env-configs.zip"
        fi
    fi
    if [ ! -f "backend/.env" ]; then
        cat > backend/.env <<'EOF'
PORT=5000
DATABASE_URL=postgresql://user:pass@host/neondb?sslmode=require
ADMIN_EMAIL=admin@vora.cm
ADMIN_PASSWORD=VoraAdmin2025!
ADMIN_COMMISSION_RATE=0.10
EOF
        ok "backend/.env minimal créé."
    fi
else
    ok "backend/.env déjà existant."
fi

# ─── Lancer Docker Compose ──────────────────────────────────────────────────
step "Construction et démarrage des conteneurs Docker"
echo ""
echo -e "  ${YELLOW}Construction des images Docker...${RESET}"
echo -e "  ${DIM}Cela peut prendre 5-10 minutes lors de la première exécution.${RESET}"
echo ""

$COMPOSE_CMD up --build
