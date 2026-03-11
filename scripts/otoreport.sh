#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  OtoReport - Centro de Control de Builds
#  Tauri 2.0 | React 19 | Rust
# ═══════════════════════════════════════════════════════════════

set -eo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

REPO="TecMedHub/OtoReport"
BUNDLE_DIR="$PROJECT_DIR/src-tauri/target/release/bundle"
ANDROID_DIR="$PROJECT_DIR/src-tauri/gen/android"

# ── Colores ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── Utilidades ───────────────────────────────────────────────
print_header() {
    clear
    echo -e "${CYAN}${BOLD}"
    echo "  ╔═══════════════════════════════════════════════╗"
    echo "  ║         OtoReport - Centro de Control        ║"
    echo "  ╚═══════════════════════════════════════════════╝${NC}"
    echo ""
}

print_status() {
    local branch commits_ahead commits_behind dirty untracked version

    branch=$(git branch --show-current 2>/dev/null || echo "???")
    version=$(grep '"version"' package.json | head -1 | sed 's/.*: *"//;s/".*//')

    # Cambios sin commit
    dirty=$(git diff --stat 2>/dev/null | tail -1)
    untracked=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l)

    # Commits ahead/behind del remote
    git fetch origin --quiet 2>/dev/null || true
    commits_ahead=$(git rev-list --count origin/"$branch"..HEAD 2>/dev/null || echo "?")
    commits_behind=$(git rev-list --count HEAD..origin/"$branch" 2>/dev/null || echo "?")

    echo -e "  ${DIM}───────────────────────────────────────────────${NC}"
    echo -e "  ${BOLD}Versión:${NC} ${GREEN}$version${NC}  ${BOLD}Rama:${NC} ${MAGENTA}$branch${NC}"

    # Estado de cambios
    if [ -n "$dirty" ] || [ "$untracked" -gt 0 ]; then
        echo -e "  ${BOLD}Estado:${NC}  ${YELLOW}● Cambios sin commit${NC} ($untracked sin rastrear)"
    else
        echo -e "  ${BOLD}Estado:${NC}  ${GREEN}● Limpio${NC}"
    fi

    # Estado del push
    if [ "$commits_ahead" != "0" ] && [ "$commits_ahead" != "?" ]; then
        echo -e "  ${BOLD}Push:${NC}    ${YELLOW}● $commits_ahead commit(s) sin push${NC}"
    elif [ "$commits_behind" != "0" ] && [ "$commits_behind" != "?" ]; then
        echo -e "  ${BOLD}Push:${NC}    ${BLUE}● $commits_behind commit(s) detrás del remoto${NC}"
    else
        echo -e "  ${BOLD}Push:${NC}    ${GREEN}● Sincronizado con remoto${NC}"
    fi
    echo -e "  ${DIM}───────────────────────────────────────────────${NC}"
    echo ""
}

check_clean_and_pushed() {
    local dirty untracked ahead

    dirty=$(git status --porcelain 2>/dev/null)
    ahead=$(git rev-list --count origin/"$(git branch --show-current)"..HEAD 2>/dev/null || echo "0")

    if [ -n "$dirty" ]; then
        echo -e "  ${RED}✗ Hay cambios sin commit. Haz commit primero (opción 1).${NC}"
        return 1
    fi
    if [ "$ahead" != "0" ]; then
        echo -e "  ${RED}✗ Hay $ahead commit(s) sin push. Haz push primero (opción 2).${NC}"
        return 1
    fi
    return 0
}

check_committed() {
    local dirty
    dirty=$(git status --porcelain 2>/dev/null)
    if [ -n "$dirty" ]; then
        echo -e "  ${RED}✗ Hay cambios sin commit. Haz commit primero (opción 1).${NC}"
        return 1
    fi
    return 0
}

check_pushed() {
    local ahead
    ahead=$(git rev-list --count origin/"$(git branch --show-current)"..HEAD 2>/dev/null || echo "0")
    if [ "$ahead" != "0" ]; then
        echo -e "  ${RED}✗ Hay $ahead commit(s) sin push. Haz push primero (opción 2).${NC}"
        return 1
    fi
    return 0
}

pause() {
    echo ""
    echo -e "  ${DIM}Presiona Enter para volver al menú...${NC}"
    read -r
}

# ── 1. Commit con IA ────────────────────────────────────────
do_commit() {
    echo -e "\n  ${BOLD}${CYAN}── Commit con IA ──${NC}\n"

    local dirty
    dirty=$(git status --porcelain 2>/dev/null)
    if [ -z "$dirty" ]; then
        echo -e "  ${GREEN}No hay cambios para hacer commit.${NC}"
        pause
        return
    fi

    echo -e "  ${BOLD}Cambios actuales:${NC}"
    git status --short
    echo ""
    echo -e "  ${BOLD}Diff resumido:${NC}"
    git diff --stat
    git diff --cached --stat 2>/dev/null
    echo ""

    # Preparar contexto para la IA
    local diff_content status_content
    status_content=$(git status --short 2>/dev/null)
    diff_content=$(git diff 2>/dev/null; git diff --cached 2>/dev/null)

    # Limitar el diff a ~4000 chars para no exceder límites de API
    if [ ${#diff_content} -gt 4000 ]; then
        diff_content="${diff_content:0:4000}... (truncado)"
    fi

    local prompt="Genera un mensaje de commit conciso en español para estos cambios de un proyecto Tauri (React+Rust). Solo responde con el mensaje de commit, sin explicaciones ni formato extra. No uses prefijos como 'feat:' ni 'fix:'. El mensaje debe ser una línea descriptiva.

Estado:
$status_content

Diff:
$diff_content"

    echo -e "  ${BOLD}Selecciona el modelo de IA:${NC}"
    echo -e "  ${CYAN}1)${NC} Claude (claude-sonnet-4-20250514)"
    echo -e "  ${CYAN}2)${NC} Gemini (gemini-2.5-flash)"
    echo -e "  ${CYAN}3)${NC} Qwen (qwen3-235b-a22b)"
    echo -e "  ${CYAN}4)${NC} Escribir manualmente"
    echo ""
    read -rp "  Opción: " ai_choice

    local commit_msg=""

    case "$ai_choice" in
        1)
            echo -e "\n  ${DIM}Consultando a Claude...${NC}"
            if ! command -v claude &>/dev/null; then
                echo -e "  ${RED}claude CLI no encontrado.${NC}"
                pause
                return
            fi
            commit_msg=$(claude -p "$prompt" --model claude-sonnet-4-20250514 2>/dev/null | tr -d '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            ;;
        2)
            echo -e "\n  ${DIM}Consultando a Gemini...${NC}"
            if ! command -v gemini &>/dev/null; then
                echo -e "  ${RED}gemini CLI no encontrado.${NC}"
                pause
                return
            fi
            commit_msg=$(gemini -p "$prompt" --model gemini-2.5-flash 2>/dev/null | tr -d '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            ;;
        3)
            echo -e "\n  ${DIM}Consultando a Qwen...${NC}"
            if ! command -v ollama &>/dev/null; then
                echo -e "  ${RED}ollama no encontrado.${NC}"
                pause
                return
            fi
            commit_msg=$(ollama run qwen3-235b-a22b "$prompt" 2>/dev/null | tr -d '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            ;;
        4)
            read -rp "  Mensaje de commit: " commit_msg
            ;;
        *)
            echo -e "  ${RED}Opción inválida.${NC}"
            pause
            return
            ;;
    esac

    if [ -z "$commit_msg" ]; then
        echo -e "  ${RED}No se obtuvo mensaje de commit.${NC}"
        pause
        return
    fi

    echo -e "\n  ${BOLD}Mensaje propuesto:${NC}"
    echo -e "  ${GREEN}\"$commit_msg\"${NC}\n"
    echo -e "  ${CYAN}1)${NC} Aceptar y hacer commit"
    echo -e "  ${CYAN}2)${NC} Editar mensaje"
    echo -e "  ${CYAN}3)${NC} Cancelar"
    read -rp "  Opción: " confirm

    case "$confirm" in
        1) ;;
        2)
            read -rp "  Nuevo mensaje: " commit_msg
            if [ -z "$commit_msg" ]; then
                echo -e "  ${RED}Mensaje vacío, cancelando.${NC}"
                pause
                return
            fi
            ;;
        *)
            echo -e "  ${YELLOW}Cancelado.${NC}"
            pause
            return
            ;;
    esac

    git add -A
    git commit -m "$commit_msg"
    echo -e "\n  ${GREEN}✓ Commit creado exitosamente.${NC}"
    pause
}

# ── 2. Push ─────────────────────────────────────────────────
do_push() {
    echo -e "\n  ${BOLD}${CYAN}── Push al remoto ──${NC}\n"

    local branch ahead
    branch=$(git branch --show-current)
    ahead=$(git rev-list --count origin/"$branch"..HEAD 2>/dev/null || echo "0")

    if [ "$ahead" = "0" ]; then
        echo -e "  ${GREEN}Ya estás sincronizado con el remoto.${NC}"
        pause
        return
    fi

    echo -e "  ${BOLD}Commits por enviar ($ahead):${NC}"
    git log --oneline origin/"$branch"..HEAD
    echo ""
    read -rp "  ¿Hacer push a origin/$branch? (s/n): " confirm
    if [ "$confirm" = "s" ] || [ "$confirm" = "S" ]; then
        git push origin "$branch"
        echo -e "\n  ${GREEN}✓ Push completado.${NC}"
    else
        echo -e "  ${YELLOW}Cancelado.${NC}"
    fi
    pause
}

# ── 3. Dev ──────────────────────────────────────────────────
do_dev() {
    echo -e "\n  ${BOLD}${CYAN}── Modo Desarrollo ──${NC}\n"
    echo -e "  ${DIM}Ctrl+C para detener el servidor de desarrollo${NC}\n"
    npx tauri dev
    pause
}

# ── 4. Build AppImage ───────────────────────────────────────
do_build_appimage() {
    echo -e "\n  ${BOLD}${CYAN}── Build AppImage ──${NC}\n"
    check_committed || { pause; return; }
    check_pushed || { pause; return; }

    echo -e "  ${DIM}Compilando AppImage...${NC}\n"
    npx tauri build --bundles appimage

    echo -e "\n  ${GREEN}✓ AppImage generado:${NC}"
    ls -lh "$BUNDLE_DIR"/appimage/*.AppImage 2>/dev/null || echo -e "  ${RED}No se encontró el archivo.${NC}"
    pause
}

# ── 5. Build DEB ────────────────────────────────────────────
do_build_deb() {
    echo -e "\n  ${BOLD}${CYAN}── Build DEB ──${NC}\n"
    check_committed || { pause; return; }
    check_pushed || { pause; return; }

    echo -e "  ${DIM}Compilando paquete DEB...${NC}\n"
    npx tauri build --bundles deb

    echo -e "\n  ${GREEN}✓ DEB generado:${NC}"
    ls -lh "$BUNDLE_DIR"/deb/*.deb 2>/dev/null || echo -e "  ${RED}No se encontró el archivo.${NC}"
    pause
}

# ── 6. Build RPM ────────────────────────────────────────────
do_build_rpm() {
    echo -e "\n  ${BOLD}${CYAN}── Build RPM ──${NC}\n"
    check_committed || { pause; return; }
    check_pushed || { pause; return; }

    echo -e "  ${DIM}Compilando paquete RPM...${NC}\n"
    npx tauri build --bundles rpm

    echo -e "\n  ${GREEN}✓ RPM generado:${NC}"
    ls -lh "$BUNDLE_DIR"/rpm/*.rpm 2>/dev/null || echo -e "  ${RED}No se encontró el archivo.${NC}"
    pause
}

# ── 7. Build binario ────────────────────────────────────────
do_build_binary() {
    echo -e "\n  ${BOLD}${CYAN}── Build Binario (sin bundle) ──${NC}\n"
    check_committed || { pause; return; }
    check_pushed || { pause; return; }

    echo -e "  ${DIM}Compilando binario...${NC}\n"
    npx tauri build --no-bundle

    echo -e "\n  ${GREEN}✓ Binario generado:${NC}"
    ls -lh "$PROJECT_DIR/src-tauri/target/release/otoreport" 2>/dev/null || echo -e "  ${RED}No se encontró el archivo.${NC}"
    pause
}

# ── 8. Build Android ───────────────────────────────────────
do_build_android() {
    echo -e "\n  ${BOLD}${CYAN}── Build Android (APK) ──${NC}\n"
    check_committed || { pause; return; }
    check_pushed || { pause; return; }

    if [ ! -d "$ANDROID_DIR" ]; then
        echo -e "  ${RED}No se encontró el directorio Android.${NC}"
        echo -e "  ${DIM}Ejecuta: npx tauri android init${NC}"
        pause
        return
    fi

    echo -e "  ${BOLD}Tipo de build:${NC}"
    echo -e "  ${CYAN}1)${NC} Debug (sin firmar)"
    echo -e "  ${CYAN}2)${NC} Release (para firmar)"
    read -rp "  Opción: " android_type

    case "$android_type" in
        1)
            echo -e "\n  ${DIM}Compilando APK debug...${NC}\n"
            npx tauri android build --apk
            echo -e "\n  ${GREEN}✓ APK debug generado.${NC}"
            find "$PROJECT_DIR/src-tauri/gen/android" -name "*.apk" -exec ls -lh {} \; 2>/dev/null
            ;;
        2)
            echo -e "\n  ${BOLD}Configuración de firma:${NC}"

            local keystore_path=""
            if [ -f "$PROJECT_DIR/keystore.jks" ]; then
                keystore_path="$PROJECT_DIR/keystore.jks"
                echo -e "  ${GREEN}Keystore encontrado:${NC} $keystore_path"
            else
                read -rp "  Ruta al keystore (.jks): " keystore_path
                if [ ! -f "$keystore_path" ]; then
                    echo -e "\n  ${YELLOW}¿Generar un nuevo keystore? (s/n):${NC}"
                    read -rp "  " gen_ks
                    if [ "$gen_ks" = "s" ] || [ "$gen_ks" = "S" ]; then
                        keystore_path="$PROJECT_DIR/keystore.jks"
                        read -rp "  Alias de la clave: " ks_alias
                        keytool -genkeypair -v \
                            -keystore "$keystore_path" \
                            -keyalg RSA -keysize 2048 \
                            -validity 10000 \
                            -alias "${ks_alias:-otoreport}"
                        echo -e "  ${GREEN}✓ Keystore generado en:${NC} $keystore_path"
                    else
                        echo -e "  ${RED}Se necesita un keystore para firmar.${NC}"
                        pause
                        return
                    fi
                fi
            fi

            echo -e "\n  ${DIM}Compilando APK release...${NC}\n"
            npx tauri android build --apk

            # Firmar APK
            local unsigned_apk
            unsigned_apk=$(find "$PROJECT_DIR/src-tauri/gen/android" -name "*-unsigned.apk" -o -name "*-release.apk" 2>/dev/null | head -1)

            if [ -z "$unsigned_apk" ]; then
                unsigned_apk=$(find "$PROJECT_DIR/src-tauri/gen/android" -name "*.apk" -not -name "*debug*" 2>/dev/null | head -1)
            fi

            if [ -n "$unsigned_apk" ]; then
                local signed_apk="${unsigned_apk/-unsigned/}"
                signed_apk="${signed_apk%.apk}-signed.apk"

                read -rp "  Alias de la clave (default: otoreport): " ks_alias
                ks_alias="${ks_alias:-otoreport}"

                echo -e "\n  ${DIM}Firmando APK...${NC}"

                if command -v apksigner &>/dev/null; then
                    apksigner sign --ks "$keystore_path" --ks-key-alias "$ks_alias" --out "$signed_apk" "$unsigned_apk"
                elif command -v jarsigner &>/dev/null; then
                    cp "$unsigned_apk" "$signed_apk"
                    jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
                        -keystore "$keystore_path" "$signed_apk" "$ks_alias"
                    # Zipalign si está disponible
                    if command -v zipalign &>/dev/null; then
                        local aligned="${signed_apk%.apk}-aligned.apk"
                        zipalign -v 4 "$signed_apk" "$aligned"
                        mv "$aligned" "$signed_apk"
                    fi
                else
                    echo -e "  ${RED}No se encontró apksigner ni jarsigner.${NC}"
                    pause
                    return
                fi

                echo -e "\n  ${GREEN}✓ APK firmado:${NC}"
                ls -lh "$signed_apk"
            else
                echo -e "  ${RED}No se encontró APK para firmar.${NC}"
            fi
            ;;
        *)
            echo -e "  ${RED}Opción inválida.${NC}"
            ;;
    esac
    pause
}

# ── 9. Build Windows (GitHub Actions) ──────────────────────
do_build_windows() {
    echo -e "\n  ${BOLD}${CYAN}── Build Windows (GitHub Actions) ──${NC}\n"
    check_clean_and_pushed || { pause; return; }

    if ! command -v gh &>/dev/null; then
        echo -e "  ${RED}gh CLI no encontrado. Instálalo: https://cli.github.com${NC}"
        pause
        return
    fi

    echo -e "  ${DIM}Disparando workflow 'Build Windows'...${NC}\n"
    gh workflow run "Build Windows" --repo "$REPO"

    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✓ Workflow disparado exitosamente.${NC}"
        echo -e "  ${DIM}Puedes ver el progreso con la opción 'Estado de builds remotos'.${NC}"
    else
        echo -e "  ${RED}✗ Error al disparar el workflow.${NC}"
    fi
    pause
}

# ── 10. Build todos Linux ──────────────────────────────────
do_build_all_linux() {
    echo -e "\n  ${BOLD}${CYAN}── Build Todos (Linux) ──${NC}\n"
    check_committed || { pause; return; }
    check_pushed || { pause; return; }

    echo -e "  ${DIM}Compilando todos los bundles Linux...${NC}\n"
    npx tauri build --bundles appimage,deb,rpm

    echo -e "\n  ${GREEN}✓ Builds completados:${NC}"
    echo -e "\n  ${BOLD}AppImage:${NC}"
    ls -lh "$BUNDLE_DIR"/appimage/*.AppImage 2>/dev/null || echo "  No encontrado"
    echo -e "  ${BOLD}DEB:${NC}"
    ls -lh "$BUNDLE_DIR"/deb/*.deb 2>/dev/null || echo "  No encontrado"
    echo -e "  ${BOLD}RPM:${NC}"
    ls -lh "$BUNDLE_DIR"/rpm/*.rpm 2>/dev/null || echo "  No encontrado"
    pause
}

# ── 11. Estado builds remotos ──────────────────────────────
do_check_remote_builds() {
    echo -e "\n  ${BOLD}${CYAN}── Estado de Builds Remotos ──${NC}\n"

    if ! command -v gh &>/dev/null; then
        echo -e "  ${RED}gh CLI no encontrado.${NC}"
        pause
        return
    fi

    gh run list --repo "$REPO" --limit 10
    echo ""
    read -rp "  ¿Ver detalles de un run? Ingresa el ID (Enter para saltar): " run_id
    if [ -n "$run_id" ]; then
        gh run view "$run_id" --repo "$REPO"
        echo ""
        echo -e "  ${BOLD}¿Descargar artefactos? (s/n):${NC}"
        read -rp "  " dl
        if [ "$dl" = "s" ] || [ "$dl" = "S" ]; then
            local dl_dir="$PROJECT_DIR/builds"
            mkdir -p "$dl_dir"
            gh run download "$run_id" --repo "$REPO" --dir "$dl_dir"
            echo -e "  ${GREEN}✓ Descargados en:${NC} $dl_dir"
        fi
    fi
    pause
}

# ── 12. Limpiar builds ─────────────────────────────────────
do_clean() {
    echo -e "\n  ${BOLD}${CYAN}── Limpiar Builds ──${NC}\n"
    echo -e "  ${BOLD}¿Qué limpiar?${NC}"
    echo -e "  ${CYAN}1)${NC} Solo bundles (bundle/)"
    echo -e "  ${CYAN}2)${NC} Todo target/ (compilación completa)"
    echo -e "  ${CYAN}3)${NC} Cancelar"
    read -rp "  Opción: " clean_choice

    case "$clean_choice" in
        1)
            rm -rf "$BUNDLE_DIR"
            echo -e "  ${GREEN}✓ Bundles limpiados.${NC}"
            ;;
        2)
            echo -e "  ${YELLOW}Esto borrará toda la compilación de Rust (~GB).${NC}"
            read -rp "  ¿Confirmar? (s/n): " confirm
            if [ "$confirm" = "s" ] || [ "$confirm" = "S" ]; then
                cd "$PROJECT_DIR/src-tauri" && cargo clean
                cd "$PROJECT_DIR"
                echo -e "  ${GREEN}✓ Target limpiado.${NC}"
            fi
            ;;
        *)
            echo -e "  ${YELLOW}Cancelado.${NC}"
            ;;
    esac
    pause
}

# ── 13. Verificar proyecto ─────────────────────────────────
do_check() {
    echo -e "\n  ${BOLD}${CYAN}── Verificar Proyecto ──${NC}\n"
    local errors=0

    echo -e "  ${DIM}[1/3] Verificando TypeScript...${NC}"
    if npx tsc --noEmit 2>&1; then
        echo -e "  ${GREEN}✓ TypeScript OK${NC}\n"
    else
        echo -e "  ${RED}✗ Errores en TypeScript${NC}\n"
        errors=$((errors + 1))
    fi

    echo -e "  ${DIM}[2/3] Verificando Rust...${NC}"
    if (cd "$PROJECT_DIR/src-tauri" && cargo check 2>&1); then
        echo -e "  ${GREEN}✓ Rust OK${NC}\n"
    else
        echo -e "  ${RED}✗ Errores en Rust${NC}\n"
        errors=$((errors + 1))
    fi

    echo -e "  ${DIM}[3/3] Verificando dependencias...${NC}"
    if npm ls --depth=0 >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Dependencias npm OK${NC}"
    else
        echo -e "  ${YELLOW}⚠ Algunas dependencias tienen warnings${NC}"
    fi

    echo ""
    if [ $errors -eq 0 ]; then
        echo -e "  ${GREEN}${BOLD}✓ Todo en orden para compilar.${NC}"
    else
        echo -e "  ${RED}${BOLD}✗ Se encontraron $errors error(es).${NC}"
    fi
    pause
}

# ── 14. Pull remoto ─────────────────────────────────────────
do_pull() {
    echo -e "\n  ${BOLD}${CYAN}── Pull desde remoto ──${NC}\n"
    local branch
    branch=$(git branch --show-current)
    git pull origin "$branch"
    echo -e "\n  ${GREEN}✓ Pull completado.${NC}"
    pause
}

# ── 15. Git log ─────────────────────────────────────────────
do_log() {
    echo -e "\n  ${BOLD}${CYAN}── Historial de Commits ──${NC}\n"
    git log --oneline --graph --decorate -20
    pause
}

# ── Menú Principal ──────────────────────────────────────────
main_menu() {
    while true; do
        print_header
        print_status

        echo -e "  ${BOLD}${YELLOW}  GIT${NC}"
        echo -e "  ${CYAN} 1)${NC} Commit con IA            ${CYAN} 2)${NC} Push al remoto"
        echo -e "  ${CYAN} 3)${NC} Pull desde remoto        ${CYAN} 4)${NC} Log de commits"
        echo ""
        echo -e "  ${BOLD}${YELLOW}  DESARROLLO${NC}"
        echo -e "  ${CYAN} 5)${NC} Lanzar dev server        ${CYAN} 6)${NC} Verificar proyecto (TS+Rust)"
        echo ""
        echo -e "  ${BOLD}${YELLOW}  BUILDS LINUX${NC}"
        echo -e "  ${CYAN} 7)${NC} AppImage                 ${CYAN} 8)${NC} DEB"
        echo -e "  ${CYAN} 9)${NC} RPM                      ${CYAN}10)${NC} Binario (sin bundle)"
        echo -e "  ${CYAN}11)${NC} Todos los Linux"
        echo ""
        echo -e "  ${BOLD}${YELLOW}  BUILDS MÓVIL / REMOTO${NC}"
        echo -e "  ${CYAN}12)${NC} Android (APK + firma)    ${CYAN}13)${NC} Windows (GitHub Actions)"
        echo -e "  ${CYAN}14)${NC} Estado builds remotos"
        echo ""
        echo -e "  ${BOLD}${YELLOW}  HERRAMIENTAS${NC}"
        echo -e "  ${CYAN}15)${NC} Limpiar builds           ${CYAN} 0)${NC} Salir"
        echo ""
        read -rp "  Opción: " choice

        case "$choice" in
            1)  do_commit ;;
            2)  do_push ;;
            3)  do_pull ;;
            4)  do_log ;;
            5)  do_dev ;;
            6)  do_check ;;
            7)  do_build_appimage ;;
            8)  do_build_deb ;;
            9)  do_build_rpm ;;
            10) do_build_binary ;;
            11) do_build_all_linux ;;
            12) do_build_android ;;
            13) do_build_windows ;;
            14) do_check_remote_builds ;;
            15) do_clean ;;
            0|q|Q)
                echo -e "\n  ${GREEN}¡Hasta luego!${NC}\n"
                exit 0
                ;;
            *)
                echo -e "  ${RED}Opción inválida.${NC}"
                sleep 1
                ;;
        esac
    done
}

# ── Arranque ────────────────────────────────────────────────
main_menu
