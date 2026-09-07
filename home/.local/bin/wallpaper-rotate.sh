#!/bin/bash
# Rotación de wallpapers nórdicos NordicOS
# Rota TODOS los wallpapers disponibles en el directorio de wallpapers del repo.
# Aplica el mismo wallpaper a TODOS los monitores conectados
# Vía hyprpaper IPC (solo "wallpaper" — preload/unload no soportados en v0.8.4)
# + systemd user timer (cada 20 min)

set -euo pipefail

STATE_FILE="${XDG_STATE_HOME:-$HOME/.local/state}/wallpaper-rotate-state"
LOG_FILE="${XDG_STATE_HOME:-$HOME/.local/state}/wallpaper-rotate.log"

# Directorio de estado
mkdir -p "$(dirname "$STATE_FILE")" "$(dirname "$LOG_FILE")"

# --- Resolución de WALLPAPER_DIR --------------------------------------------
# 1. Override explícito vía variable de entorno (nadie la define por defecto).
# 2. Auto-localización: ascender desde la ubicación real de este script
#    buscando la raíz del repo (marcador: install.sh + assets/wallpapers),
#    con límite de profundidad de 5 niveles y parada en "/".
# 3. Si no se resuelve ninguna, error claro en el log y exit 1 (sin fallback
#    silencioso a una ruta adivinada).
if [ -n "${NORDICOS_WALLPAPER_DIR:-}" ] && [ -d "${NORDICOS_WALLPAPER_DIR:-}" ]; then
    WALLPAPER_DIR="$NORDICOS_WALLPAPER_DIR"
else
    SELF="$(readlink -f "${BASH_SOURCE[0]}")"
    SEARCH_DIR="$(dirname "$SELF")"
    WALLPAPER_DIR=""
    DEPTH=0
    while [ "$DEPTH" -lt 5 ] && [ "$SEARCH_DIR" != "/" ]; do
        if [ -f "$SEARCH_DIR/install.sh" ] && [ -d "$SEARCH_DIR/assets/wallpapers" ]; then
            WALLPAPER_DIR="$SEARCH_DIR/assets/wallpapers"
            break
        fi
        SEARCH_DIR="$(dirname "$SEARCH_DIR")"
        DEPTH=$((DEPTH + 1))
    done

    if [ -z "$WALLPAPER_DIR" ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') ERROR: no se pudo resolver WALLPAPER_DIR (ni NORDICOS_WALLPAPER_DIR ni auto-localización desde $SELF encontraron la raíz del repo NordicOS)" >> "$LOG_FILE"
        exit 1
    fi
fi

# Verificar que hyprpaper está corriendo
if ! pgrep -x hyprpaper > /dev/null; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') ERROR: hyprpaper no está corriendo" >> "$LOG_FILE"
    exit 1
fi

# Listar wallpapers (orden determinista por nombre)
mapfile -t WALLPAPERS < <(ls -1 "$WALLPAPER_DIR"/*.png 2>/dev/null | sort)
NUM=${#WALLPAPERS[@]}

if [ "$NUM" -eq 0 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') ERROR: no hay wallpapers en $WALLPAPER_DIR" >> "$LOG_FILE"
    exit 1
fi

# Obtener índice actual (persiste entre ejecuciones)
if [ -f "$STATE_FILE" ]; then
    IDX=$(cat "$STATE_FILE")
else
    IDX=0
fi

# Avanzar al siguiente (rotación circular)
NEXT_IDX=$(( (IDX + 1) % NUM ))
SELECTED="${WALLPAPERS[$NEXT_IDX]}"

# Detectar todos los monitores conectados
mapfile -t MONITORS < <(hyprctl monitors -j | python3 -c "
import json, sys
for m in json.load(sys.stdin):
    print(m['name'])
")

if [ ${#MONITORS[@]} -eq 0 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') ERROR: no hay monitores conectados" >> "$LOG_FILE"
    exit 1
fi

# Aplicar a cada monitor (hyprpaper v0.8.4 auto-preloada al aplicar)
for MON in "${MONITORS[@]}"; do
    hyprctl hyprpaper wallpaper "$MON","$SELECTED" > /dev/null 2>&1
done

# Guardar nuevo índice
echo "$NEXT_IDX" > "$STATE_FILE"

# Log
MON_LIST=$(printf '%s ' "${MONITORS[@]}")
echo "$(date '+%Y-%m-%d %H:%M:%S') Rotado a #$NEXT_IDX: $(basename "$SELECTED") → monitores: $MON_LIST" >> "$LOG_FILE"
