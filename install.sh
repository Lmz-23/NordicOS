#!/usr/bin/env bash
# ============================================================================
# NordicOS — install.sh
# ----------------------------------------------------------------------------
# Restaura el escritorio vikingo completo desde el repo en una PC nueva o recién
# instalada. Crea symlinks de todos los archivos user-maintained a sus destinos
# en ~/.config/, sincroniza archivos híbridos, instala deps, y regenera la
# paleta.
#
# Uso:
#   ./install.sh
#
# Idempotencia:
#   - Si un destino ya es symlink apuntando a este repo, no se hace nada.
#   - Si es un archivo regular, se respalda con timestamp y se reemplaza por
#     symlink.
#   - Si no existe, se crea el symlink y los directorios padre.
#
# Asume: Node.js ≥18, `npm`, `luac` opcional para validación Lua.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_ROOT="$SCRIPT_DIR/home/.config"
DST_ROOT="$HOME/.config"

if [ ! -d "$SRC_ROOT" ]; then
  echo "ERROR: $SRC_ROOT no existe. ¿Hiciste git clone completo?" >&2
  exit 1
fi

echo "== NordicOS install =="
echo "Repo: $SCRIPT_DIR"
echo "Home: $HOME"
echo ""

# Archivos a linkear desde home/.config/ a ~/.config/.
# Las entradas ausentes en el repo se omiten para soportar instalaciones
# parciales (por ejemplo, cuando una aplicación no está instalada).
declare -a TRACKED=(
  "waybar/config.jsonc"
  "waybar/style.css"
  "waybar/battery_detail.sh"
  "waybar/idle_toggle.sh"
  "waybar/logo.sh"
  "waybar/power_menu.sh"
  "waybar/icons"
  "waybar/valknut.png"
  "kitty/kitty.conf"
  "wofi/config"
  "ags/shell.tsx"
  "ags/package.json"
  "ags/tsconfig.json"
  "ags/lib/theme-tokens.ts"
  "ags/lib/battery-source.ts"
  "ags/lib/network-source.ts"
  "ags/lib/scale.ts"
  "ags/lib/system-source.ts"
  "ags/lib/theme-tokens-auto.ts"
  "ags/widgets"
  "ags/assets"
  "fastfetch/config.jsonc"
)

link_file() {
  local rel="$1"
  local src="$SRC_ROOT/$rel"
  local dst="$DST_ROOT/$rel"

  # Si no existe en el repo, skip silencioso.
  if [ ! -e "$src" ] && [ ! -L "$src" ]; then
    echo "  [skip] $rel (no existe en el repo)"
    return 0
  fi

  # Crear directorio padre.
  mkdir -p "$(dirname "$dst")"

  # Si ya es symlink apuntando a este repo, OK.
  if [ -L "$dst" ]; then
    local current
    current=$(readlink "$dst")
    if [ "$current" = "$src" ]; then
      echo "  [ok]   $rel (ya linkeado)"
      return 0
    fi
    echo "  [warn] $rel (symlink apunta a $current, reemplazando)"
    rm "$dst"
  elif [ -e "$dst" ]; then
    # Archivo o directorio regular existente → backup + symlink.
    local backup="${dst}.bak-install-$(date +%Y%m%d%H%M%S)"
    mv "$dst" "$backup"
    echo "  [mv]   $rel → $backup"
  fi

  # Crear el symlink.
  ln -s "$src" "$dst"
  echo "  [ln]   $dst → $src"
}

echo "== Vinculando archivos user-maintained =="
for rel in "${TRACKED[@]}"; do
  link_file "$rel"
done

echo ""
echo "== Sincronizando archivos híbridos (hyprland.lua) =="
if [ -f "$SRC_ROOT/hypr/hyprland.lua" ]; then
  "$SCRIPT_DIR/bin/sync-tracking.sh" pull
fi

echo ""
echo "== Instalando dependencias Node.js =="
(cd "$SCRIPT_DIR" && npm install)

echo ""
echo "== Regenerando paleta =="
(cd "$SCRIPT_DIR" && npm run build)

echo ""
echo "== Listo =="
echo "Para recargar waybar después: systemctl --user reload waybar"
echo "Para recargar hyprland: hyprctl reload"
