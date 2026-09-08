#!/usr/bin/env bash
# ============================================================================
#  VORA — Démarrage Automatique (Linux + macOS + Windows Git Bash)
#  
#  Ce script installe toutes les dépendances et lance VORA sur le réseau
#  local. Il affiche un QR Code pour que les testeurs puissent accéder
#  à l'application directement depuis leur téléphone.
#
#  Utilisation :
#    chmod +x start.sh && ./start.sh        (Linux/macOS)
#    bash start.sh                           (Windows Git Bash)
# ============================================================================

set -euo pipefail

# ─── Flags ──────────────────────────────────────────────────────────────────
USE_TUNNEL=false
for arg in "$@"; do
    case $arg in
        --remote|-r|--tunnel) USE_TUNNEL=true ;;
        --help|-h)
            echo "Usage: ./start.sh [--remote|--tunnel]"
            echo "  --remote, -r, --tunnel   Activer un tunnel public (localtunnel)"
            echo "                          pour accéder depuis un téléphone hors du réseau local"
            exit 0
            ;;
    esac
done

# ─── Couleurs & style ───────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ─── Bannière ───────────────────────────────────────────────────────────────
show_banner() {
    clear
    echo ""
    cat <<'BANNER'
     ___      ___  ______     _______        __
    |"  \    /"  |/    " \   /"      \      /"\
     \   \  //  /// ____  \ |:        |    /    \
      \  \/. .//  /    ) :)|_____/   )   /' /\  \
       \.    // (: (____/ //  //      /   //  __'  \
        \   /  \        /  |:  __   \  /   /  \\  \
         \__/    "_____/   |__|  \___)(___/    \___)
BANNER
    echo -e "${BOLD}Plateforme de Mobilite Urbaine & VTC${RESET}"
    echo -e "${DIM}Cameroun${RESET}"
    echo ""
}

# ─── Helpers ────────────────────────────────────────────────────────────────
step()    { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"; echo -e "${BOLD}${BLUE}  ➤ $1${RESET}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"; }
ok()      { echo -e "  ${GREEN}✔ $1${RESET}"; }
warn()    { echo -e "  ${YELLOW}⚠ $1${RESET}"; }
fail()    { echo -e "  ${RED}✘ $1${RESET}"; }
info()    { echo -e "  ${DIM}$1${RESET}"; }
spinner() {
    local pid=$1 msg=$2
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r  ${CYAN}${spin:i++%${#spin}:1}${RESET} ${msg}  "
        sleep 0.1
    done
    printf "\r"
}

# ─── Détection du répertoire du script ──────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ─── Config ─────────────────────────────────────────────────────────────────
BACKEND_PORT=5000
FRONTEND_PORT=8081
BACKEND_DIR="$SCRIPT_DIR/backend"
MOBILE_DIR="$SCRIPT_DIR/mobile"
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

BACKEND_PID=""
FRONTEND_PID=""

# ─── Nettoyage à la sortie ──────────────────────────────────────────────────
cleanup() {
    echo ""
    echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "${YELLOW}  Arrêt de VORA...${RESET}"
    [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null && ok "Frontend arrêté (PID: $FRONTEND_PID)"
    [[ -n "$BACKEND_PID" ]]  && kill "$BACKEND_PID"  2>/dev/null && ok "Backend arrêté (PID: $BACKEND_PID)"
    echo -e "${GREEN}  VORA arrêté proprement.${RESET}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# ─── Vérification de Node.js ────────────────────────────────────────────────
check_node() {
    step "Vérification de Node.js"
    if ! command -v node &>/dev/null; then
        fail "Node.js n'est pas installé !"
        echo ""
        echo -e "  ${BOLD}Installez Node.js depuis :${RESET}"
        echo -e "  ${CYAN}https://nodejs.org${RESET}  (version 18+ recommandée)"
        echo ""
        exit 1
    fi
    local ver
    ver=$(node --version)
    ok "Node.js détecté : ${BOLD}$ver${RESET}"
}

# ─── Vérification de npm ────────────────────────────────────────────────────
check_npm() {
    if ! command -v npm &>/dev/null; then
        fail "npm n'est pas installé !"
        echo -e "  ${CYAN}Réinstallez Node.js depuis https://nodejs.org${RESET}"
        exit 1
    fi
    local ver
    ver=$(npm --version)
    ok "npm détecté : ${BOLD}$ver${RESET}"
}

# ─── Installation des dépendances Backend ────────────────────────────────────
install_backend_deps() {
    step "Installation des dépendances Backend (Express, Socket.io, NeonDB...)"
    if [ -d "$BACKEND_DIR/node_modules" ]; then
        warn "node_modules existant détecté, mise à jour des dépendances..."
        (cd "$BACKEND_DIR" && npm install --legacy-peer-deps) > "$LOG_DIR/backend-install.log" 2>&1 &
    else
        info "Première installation... cela peut prendre 1-2 minutes."
        (cd "$BACKEND_DIR" && npm install --legacy-peer-deps) > "$LOG_DIR/backend-install.log" 2>&1 &
    fi
    local pid=$!
    spinner $pid "Installation backend en cours..."
    wait $pid
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        fail "Erreur lors de l'installation backend."
        echo -e "  ${DIM}Voir les logs : $LOG_DIR/backend-install.log${RESET}"
        tail -10 "$LOG_DIR/backend-install.log"
        exit 1
    fi
    ok "Dépendances Backend installées !"
}

# ─── Installation des dépendances Frontend (Mobile/Web) ──────────────────────
install_frontend_deps() {
    step "Installation des dépendances Frontend (Expo, React Native, Maps...)"
    if [ -d "$MOBILE_DIR/node_modules" ]; then
        warn "node_modules existant détecté, mise à jour..."
        (cd "$MOBILE_DIR" && npm install --legacy-peer-deps) > "$LOG_DIR/frontend-install.log" 2>&1 &
    else
        info "Première installation... cela peut prendre 2-3 minutes."
        info "De nombreuses dépendances React Native, Maps, Expo sont nécessaires."
        (cd "$MOBILE_DIR" && npm install --legacy-peer-deps) > "$LOG_DIR/frontend-install.log" 2>&1 &
    fi
    local pid=$!
    spinner $pid "Installation frontend en cours..."
    wait $pid
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        fail "Erreur lors de l'installation frontend."
        echo -e "  ${DIM}Voir les logs : $LOG_DIR/frontend-install.log${RESET}"
        tail -10 "$LOG_DIR/frontend-install.log"
        exit 1
    fi
    ok "Dépendances Frontend installées !"
}

# ─── Détection de l'adresse IP locale ────────────────────────────────────────
detect_local_ip() {
    step "Détection de l'adresse IP locale (réseau Wi-Fi / Ethernet)"
    
    local local_ip=""
    
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
        # Windows (Git Bash / MSYS / Cygwin)
        local_ip=$(ipconfig 2>/dev/null | grep -A5 "Wi-Fi\|Wireless\|Wi-Fi\|Ethernet\|Adaptateur" \
            | grep -oP '(?:IPv4|IP)[^:]*:\s*\K[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' \
            | head -1)
        if [ -z "$local_ip" ]; then
            local_ip=$(ipconfig 2>/dev/null | grep -oP '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | grep -vE '^\s*127\.|^\s*0\.' | head -1)
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        local_ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
    else
        # Linux
        local_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
        if [ -z "$local_ip" ]; then
            local_ip=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[0-9.]+')
        fi
    fi
    
    if [ -z "$local_ip" ]; then
        warn "Impossible de détecter l'IP locale automatiquement."
        local_ip="127.0.0.1"
    fi
    
    LOCAL_IP="$local_ip"
    ok "IP locale détectée : ${BOLD}$LOCAL_IP${RESET}"
}

# ─── Configuration de l'URL Backend pour le Frontend ─────────────────────────
configure_backend_url() {
    step "Configuration de l'URL du Backend pour le réseau local"
    
    # Mettre à jour le fichier .env du mobile avec l'IP locale
    local env_file="$MOBILE_DIR/.env"
    local backend_url="http://$LOCAL_IP:$BACKEND_PORT"
    local socket_url="http://$LOCAL_IP:$BACKEND_PORT"
    
    if [ -f "$env_file" ]; then
        # Mettre à jour les URLs existantes
        if grep -q "EXPO_PUBLIC_BACKEND_URL" "$env_file"; then
            sed -i.bak "s|EXPO_PUBLIC_BACKEND_URL=.*|EXPO_PUBLIC_BACKEND_URL=$backend_url|g" "$env_file"
        else
            echo "EXPO_PUBLIC_BACKEND_URL=$backend_url" >> "$env_file"
        fi
        if grep -q "EXPO_PUBLIC_SOCKET_URL" "$env_file"; then
            sed -i.bak "s|EXPO_PUBLIC_SOCKET_URL=.*|EXPO_PUBLIC_SOCKET_URL=$socket_url|g" "$env_file"
        else
            echo "EXPO_PUBLIC_SOCKET_URL=$socket_url" >> "$env_file"
        fi
        # Nettoyer le backup
        rm -f "$env_file.bak"
    else
        # Créer le fichier .env
        cat > "$env_file" <<ENVEOF
# VORA — Configuration de développement local (auto-généré par start.sh)
EXPO_PUBLIC_BACKEND_URL=$backend_url
EXPO_PUBLIC_SOCKET_URL=$socket_url
EXPO_PUBLIC_GEMINI_API_KEY=your_key_here
ENVEOF
    fi
    
    ok "URL Backend configurée : ${BOLD}$backend_url${RESET}"
}

# ─── Démarrage du Backend ────────────────────────────────────────────────────
start_backend() {
    step "Démarrage du serveur Backend (port $BACKEND_PORT)"
    
    # Vérifier si le port est déjà utilisé
    if lsof -i ":$BACKEND_PORT" >/dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q ":$BACKEND_PORT"; then
        warn "Le port $BACKEND_PORT est déjà utilisé — tentative d'arrêt..."
        fuser -k "$BACKEND_PORT/tcp" 2>/dev/null || true
        sleep 1
    fi
    
    info "Démarrage du serveur Express + Socket.io..."
    (cd "$BACKEND_DIR" && npm run dev) > "$BACKEND_LOG" 2>&1 &
    BACKEND_PID=$!
    
    # Attendre que le serveur démarre
    info "Attente du démarrage du Backend..."
    local attempts=0
    local max_attempts=60  # 30 secondes max
    while [ $attempts -lt $max_attempts ]; do
        if curl -s "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
            ok "Backend démarré avec succès ! (PID: $BACKEND_PID)"
            return 0
        fi
        sleep 0.5
        attempts=$((attempts + 1))
        # Afficher un indicateur de progression
        printf "\r  ${CYAN}⠋${RESET} Démarrage backend... %2d/%ds " $((attempts/2)) $((max_attempts/2))
    done
    
    echo ""
    fail "Le Backend n'a pas démarré dans les 30 secondes."
    echo -e "  ${DIM}Voir les logs : $BACKEND_LOG${RESET}"
    tail -5 "$BACKEND_LOG"
    exit 1
}

# ─── Tunnel public (localtunnel) ────────────────────────────────────────────
TUNNEL_URL=""

install_localtunnel() {
    step "Installation de localtunnel (tunnel public)"
    if command -v lt &>/dev/null; then
        ok "localtunnel déjà installé"
        return 0
    fi
    info "Installation de localtunnel..."
    npm install -g localtunnel > /dev/null 2>&1
    if ! command -v lt &>/dev/null; then
        fail "Impossible d'installer localtunnel. Installation manuelle :"
        echo -e "  ${CYAN}npm install -g localtunnel${RESET}"
        return 1
    fi
    ok "localtunnel installé !"
}

start_tunnel() {
    step "Démarrage du tunnel public (localtunnel)"
    info "Création d'un tunnel HTTPS public vers le frontend..."
    
    # Démarrer lt en arrière-plan, capturer l'URL
    lt --port "$FRONTEND_PORT" --print-requests > "$LOG_DIR/tunnel.log" 2>&1 &
    TUNNEL_PID=$!
    
    # Attendre que l'URL du tunnel soit disponible
    local attempts=0
    while [ $attempts -lt 30 ]; do
        if grep -oE 'https://[a-z0-9-]+\.l\.tunnel\.dev' "$LOG_DIR/tunnel.log" >/dev/null 2>&1; then
            TUNNEL_URL=$(grep -oE 'https://[a-z0-9-]+\.l\.tunnel\.dev' "$LOG_DIR/tunnel.log" | head -1)
            ok "Tunnel public actif !"
            return 0
        fi
        sleep 1
        attempts=$((attempts + 1))
        printf "\r  ${CYAN}⠋${RESET} Création du tunnel... %ds " $attempts
    done
    
    echo ""
    warn "Le tunnel met du temps à démarrer. Essayez : lt --port $FRONTEND_PORT"
    return 0
}

# ─── Démarrage du Frontend ───────────────────────────────────────────────────
start_frontend() {
    step "Démarrage du Frontend Expo (port $FRONTEND_PORT)"
    
    info "Lancement du serveur de développement Expo en mode Web (LAN)..."
    
    # Déterminer le port available
    local port=$FRONTEND_PORT
    while lsof -i ":$port" >/dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q ":$port"; do
        port=$((port + 1))
    done
    
    FRONTEND_PORT=$port
    
    # Lancer Expo en mode LAN pour que les appareils mobiles puissent s'y connecter
    (cd "$MOBILE_DIR" && npx expo start --web --port "$FRONTEND_PORT" --lan) > "$FRONTEND_LOG" 2>&1 &
    FRONTEND_PID=$!
    
    # Attendre que le serveur démarre
    info "Attente du démarrage du Frontend..."
    local attempts=0
    local max_attempts=90  # 45 secondes max (Expo peut être lent au démarrage)
    while [ $attempts -lt $max_attempts ]; do
        if curl -s "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
            ok "Frontend démarré avec succès ! (PID: $FRONTEND_PID)"
            return 0
        fi
        sleep 0.5
        attempts=$((attempts + 1))
        printf "\r  ${CYAN}⠋${RESET} Démarrage frontend... %2d/%ds " $((attempts/2)) $((max_attempts/2))
    done
    
    echo ""
    warn "Le Frontend met du temps à démarrer, mais il devrait fonctionner."
    warn "Essayez d'ouvrir le lien dans votre navigateur."
    return 0
}

# ─── Affichage des liens d'accès ─────────────────────────────────────────────
show_links() {
    echo ""
    echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════╗${RESET}"
    echo -e "${GREEN}║                                                          ║${RESET}"
    echo -e "${GREEN}║           ${BOLD}  ✅  VORA EST PRÊT !  ✅${RESET}${GREEN}                    ║${RESET}"
    echo -e "${GREEN}║                                                          ║${RESET}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${RESET}"
    echo ""
    
    local lan_url="http://$LOCAL_IP:$FRONTEND_PORT"
    local localhost_url="http://localhost:$FRONTEND_PORT"
    
    echo -e "  ${BOLD}${CYAN}📱  OUVRIR SUR TÉLÉPHONE (même réseau Wi-Fi) :${RESET}"
    echo -e "  ┌─────────────────────────────────────────────────────────┐"
    echo -e "  │  ${BOLD}$lan_url${RESET}"
    echo -e "  └─────────────────────────────────────────────────────────┘"
    echo ""
    
    # Afficher l'URL du tunnel si disponible
    if [ -n "$TUNNEL_URL" ]; then
        echo -e "  ${BOLD}${CYAN}🌍  OUVRIR DEPUIS N'IMPORTE OÙ (tunnel public) :${RESET}"
        echo -e "  ┌─────────────────────────────────────────────────────────┐"
        echo -e "  │  ${BOLD}$TUNNEL_URL${RESET}"
        echo -e "  └─────────────────────────────────────────────────────────┘"
        echo ""
    fi
    
    echo -e "  ${BOLD}${CYAN}💻  OUVRIR SUR ORDINATEUR :${RESET}"
    echo -e "  ┌─────────────────────────────────────────────────────────┐"
    echo -e "  │  ${BOLD}$localhost_url${RESET}"
    echo -e "  └─────────────────────────────────────────────────────────┘"
    echo ""
    
    # Générer un QR code ASCII pour le lien téléphone
    echo -e "  ${BOLD}${CYAN}📷  QR CODE (scannez avec l'appareil photo de votre téléphone) :${RESET}"
    echo ""
    
    # Générer le QR code en utilisant un outil disponible
    if command -v qrencode &>/dev/null; then
        qrencode -t UTF8 "$lan_url"
    else
        # Fallback : afficher le lien en très gros pour qu'il soit facile à lire
        echo -e "  ┌─────────────────────────────────────────────────────────┐"
        echo -e "  │  ${BOLD}Copiez ce lien dans le navigateur de votre téléphone :${RESET}"
        echo -e "  │                                                         │"
        echo -e "  │  ${YELLOW}${BOLD}$lan_url${RESET}"
        echo -e "  │                                                         │"
        echo -e "  └─────────────────────────────────────────────────────────┘"
        echo ""
        info "Astuce : Si vous ne pouvez pas scanner, tapez simplement ce lien"
        info "         dans le navigateur Chrome/Safari de votre téléphone."
    fi
    
    echo ""
    echo -e "  ${BOLD}${CYAN}📊  INFOS SERVEUR :${RESET}"
    echo -e "  ├─ Backend  : ${BOLD}http://$LOCAL_IP:$BACKEND_PORT${RESET}"
    echo -e "  ├─ Frontend : ${BOLD}$lan_url${RESET}"
    echo -e "  ├─ WebSocket: ${BOLD}ws://$LOCAL_IP:$BACKEND_PORT${RESET}"
    echo -e "  └─ Logs     : ${DIM}$LOG_DIR/${RESET}"
    echo ""
    
    echo -e "  ${DIM}Appuyez sur Ctrl+C pour arrêter tous les serveurs.${RESET}"
    echo ""
}

# ─── Point d'entrée ─────────────────────────────────────────────────────────
main() {
    show_banner
    echo -e "  ${DIM}Script de démarrage automatique pour les testeurs${RESET}"
    echo -e "  ${DIM}Installe les dépendances et lance l'application sur le réseau local${RESET}"
    echo ""
    
    # 1. Vérifications
    step "Vérification de l'environnement"
    check_node
    check_npm
    
    # 2. Vérifier que les .env existent
    if [ ! -f "$BACKEND_DIR/.env" ]; then
        warn "Fichier backend/.env manquant !"
        if [ -f "$BACKEND_DIR/.env.example" ]; then
            cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
            ok "Fichier backend/.env créé depuis .env.example"
        else
            info "Création d'un fichier .env minimal..."
            cat > "$BACKEND_DIR/.env" <<'ENVEOF'
PORT=5000
DATABASE_URL=postgresql://user:pass@host/neondb?sslmode=require
CLERK_SECRET_KEY=your_key
ADMIN_EMAIL=admin@vora.cm
ADMIN_PASSWORD=VoraAdmin2025!
ADMIN_COMMISSION_RATE=0.10
ENVEOF
            ok "Fichier backend/.env créé (modifiez-le avec vos vraies clés API)"
        fi
    fi
    
    # 3. Installation des dépendances
    install_backend_deps
    install_frontend_deps
    
    # 4. Détection IP locale
    detect_local_ip
    
    # 5. Configuration Backend URL
    configure_backend_url
    
    # 6. Démarrage Backend
    start_backend
    
    # 7. Démarrage Frontend
    start_frontend
    
    # 8. Tunnel public (optionnel)
    if [ "$USE_TUNNEL" = true ]; then
        install_localtunnel
        start_tunnel
    fi
    
    # 9. Affichage des liens
    show_links
    
    # 10. Garder le script actif
    wait
}

main "$@"
