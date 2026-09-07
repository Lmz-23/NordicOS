#!/usr/bin/env bash
# ============================================================================
# NordicOS — install.sh
# ----------------------------------------------------------------------------
# Restaura el escritorio vikingo completo desde el repo en una PC nueva o recién
# instalada. Crea symlinks de todos los archivos user-maintained a sus destinos
# en $HOME (espejo de home/ del repo), sincroniza archivos híbridos, instala
# deps, y regenera la paleta.
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
SRC_ROOT="$SCRIPT_DIR/home"
DST_ROOT="$HOME"

if [ ! -d "$SRC_ROOT" ]; then
  echo "ERROR: $SRC_ROOT no existe. ¿Hiciste git clone completo?" >&2
  exit 1
fi

echo "== NordicOS install =="
echo "Repo: $SCRIPT_DIR"
echo "Home: $HOME"
echo ""

# Archivos a linkear desde home/ (SRC_ROOT) a $HOME (DST_ROOT). Cada entrada es
# una ruta relativa a $HOME y puede vivir bajo cualquier subdirectorio (no solo
# .config/), por ejemplo .local/bin/.
# Las entradas ausentes en el repo se omiten para soportar instalaciones
# parciales (por ejemplo, cuando una aplicación no está instalada).
declare -a TRACKED=(
  ".config/waybar/config.jsonc"
  ".config/waybar/style.css"
  ".config/waybar/battery_detail.sh"
  ".config/waybar/idle_toggle.sh"
  ".config/waybar/logo.sh"
  ".config/waybar/power_menu.sh"
  ".config/waybar/icons"
  ".config/waybar/valknut.png"
  ".config/kitty/kitty.conf"
  ".config/wofi/config"
  ".config/ags/shell.tsx"
  ".config/ags/package.json"
  ".config/ags/tsconfig.json"
  ".config/ags/lib/theme-tokens.ts"
  ".config/ags/lib/battery-source.ts"
  ".config/ags/lib/network-source.ts"
  ".config/ags/lib/scale.ts"
  ".config/ags/lib/system-source.ts"
  ".config/ags/lib/theme-tokens-auto.ts"
  ".config/ags/widgets"
  ".config/ags/assets"
  ".config/fastfetch/config.jsonc"
  ".config/systemd/user/wallpaper-rotate.timer"
  ".config/systemd/user/wallpaper-rotate.service"
  ".config/autostart/blueman.desktop"
  ".local/bin/wallpaper-rotate.sh"
  ".config/waybar/docker_status.sh"
  ".config/waybar/docker_toggle.sh"
  ".config/waybar/workspace_status.sh"
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

  # Validación no fatal: scripts .sh deben ser ejecutables.
  if [[ "$src" == *.sh ]] && [ ! -x "$src" ]; then
    echo "  [warn] $rel no tiene bit ejecutable"
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
echo "== Generando hyprpaper.conf =="
BOOT_WALLPAPER="guerra.png"
WALLPAPERS_DIR="$SCRIPT_DIR/assets/wallpapers"
HYPRPAPER_TEMPLATE="$SCRIPT_DIR/templates/hyprpaper.conf.in"
HYPRPAPER_DST="$HOME/.config/hypr/hyprpaper.conf"
NORDICOS_MARKER="# NordicOS — archivo GENERADO por install.sh. No editar a mano."

if [ ! -d "$WALLPAPERS_DIR" ] || [ -z "$(ls -A "$WALLPAPERS_DIR"/*.png 2>/dev/null)" ]; then
  echo "  [warn] $WALLPAPERS_DIR no existe o no contiene .png; no se generará hyprpaper.conf"
else
  if [ ! -f "$WALLPAPERS_DIR/$BOOT_WALLPAPER" ]; then
    FALLBACK="$(ls -1 "$WALLPAPERS_DIR"/*.png 2>/dev/null | sort | head -n1)"
    echo "  [warn] $BOOT_WALLPAPER no existe en $WALLPAPERS_DIR; usando fallback $(basename "$FALLBACK")"
    BOOT_WALLPAPER="$(basename "$FALLBACK")"
  fi

  RENDERED="$(sed \
    -e "s#@WALLPAPER_DIR@#$WALLPAPERS_DIR#g" \
    -e "s#@BOOT_WALLPAPER@#$BOOT_WALLPAPER#g" \
    "$HYPRPAPER_TEMPLATE")"

  mkdir -p "$(dirname "$HYPRPAPER_DST")"

  if [ -f "$HYPRPAPER_DST" ]; then
    if ! head -n1 "$HYPRPAPER_DST" | grep -qF "$NORDICOS_MARKER"; then
      BACKUP="${HYPRPAPER_DST}.bak-install-$(date +%Y%m%d%H%M%S)"
      cp "$HYPRPAPER_DST" "$BACKUP"
      echo "  [mv]   hyprpaper.conf artesanal respaldado → $BACKUP"
    fi
  fi

  if [ -f "$HYPRPAPER_DST" ] && [ "$(cat "$HYPRPAPER_DST")" = "$RENDERED" ]; then
    echo "  [ok]   hyprpaper.conf (sin cambios)"
  else
    TMP="${HYPRPAPER_DST}.tmp"
    printf '%s\n' "$RENDERED" > "$TMP"
    mv "$TMP" "$HYPRPAPER_DST"
    echo "  [gen]  $HYPRPAPER_DST (wallpaper de arranque: $BOOT_WALLPAPER)"
  fi
fi

echo ""
echo "== Sincronizando archivos híbridos (hyprland.lua) =="
if [ -f "$SRC_ROOT/.config/hypr/hyprland.lua" ]; then
  "$SCRIPT_DIR/bin/sync-tracking.sh" pull
fi

echo ""
echo "== Instalando dependencias Node.js =="
(cd "$SCRIPT_DIR" && npm install)

echo ""
echo "== Regenerando paleta =="
(cd "$SCRIPT_DIR" && npm run build)

echo ""
echo "== Reconciliando systemd (user) =="
if command -v systemctl > /dev/null 2>&1; then
  if systemctl --user daemon-reload 2>/dev/null; then
    echo "  [ok]   systemctl --user daemon-reload"
  else
    echo "  [warn] no se pudo ejecutar 'systemctl --user daemon-reload' (¿sin bus de usuario?)"
  fi

  if systemctl --user enable hyprpaper.service 2>/dev/null; then
    echo "  [ok]   hyprpaper.service enabled"
  else
    echo "  [warn] no se pudo habilitar hyprpaper.service"
  fi

  if systemctl --user enable wallpaper-rotate.timer 2>/dev/null; then
    echo "  [ok]   wallpaper-rotate.timer enabled"
  else
    echo "  [warn] no se pudo habilitar wallpaper-rotate.timer"
  fi
else
  echo "  [warn] systemctl no está disponible; omitiendo reconciliación systemd"
fi

echo ""
echo "== Listo =="
echo "Para aplicar los cambios en caliente sin cerrar sesión, ejecuta:"
echo "  systemctl --user daemon-reload"
echo "  systemctl --user restart hyprpaper.service"
echo "  pkill waybar && waybar &"
echo "  hyprctl reload"
