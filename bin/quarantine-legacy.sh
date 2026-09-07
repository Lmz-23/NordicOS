#!/usr/bin/env bash
# ============================================================================
# NordicOS — quarantine-legacy.sh
# ----------------------------------------------------------------------------
# Limpia por CUARENTENA (nunca borrado) los archivos de basura sueltos que
# quedaron en ~/.config tras migraciones/backups históricos: patrones
# *.bak, *.bak-*, *.disabled, *.broken, *.orig.
#
# Solo escanea directorios conocidos y gestionados por NordicOS. Nunca sigue
# symlinks (se saltan siempre, incluso si están rotos) — un symlink roto no es
# basura huérfana, es una consecuencia de la migración de rutas que ya
# resuelve install.sh.
#
# Uso:
#   ./bin/quarantine-legacy.sh            # Fase 1: inventario (solo lectura)
#   ./bin/quarantine-legacy.sh --apply    # Fase 2: mueve el manifiesto a backups/
#
# Idempotencia:
#   Tras --apply, una nueva corrida en modo inventario debe reportar 0
#   archivos encontrados.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUPS_ROOT="$SCRIPT_DIR/backups"

declare -a SCAN_DIRS=(
  "$HOME/.config/waybar"
  "$HOME/.config/ags"
  "$HOME/.config/hypr"
  "$HOME/.config/wofi"
  "$HOME/.config/kitty"
  "$HOME/.config/fastfetch"
  "$HOME/.config/systemd/user"
  "$HOME/.config/autostart"
  "$HOME/.config/dunst"
)

declare -a PATTERNS=(
  "*.bak"
  "*.bak-*"
  "*.disabled"
  "*.broken"
  "*.orig"
)

# --- build_manifest -----------------------------------------------------
# Rellena el array global MANIFEST (rutas absolutas) escaneando SCAN_DIRS
# con los PATTERNS definidos. Nunca sigue symlinks (find -type f los excluye
# automáticamente; los symlinks rotos NO son de tipo f).
MANIFEST=()
build_manifest() {
  MANIFEST=()
  for dir in "${SCAN_DIRS[@]}"; do
    [ -d "$dir" ] || continue
    local find_args=()
    for i in "${!PATTERNS[@]}"; do
      if [ "$i" -gt 0 ]; then
        find_args+=(-o)
      fi
      find_args+=(-name "${PATTERNS[$i]}")
    done
    while IFS= read -r -d '' f; do
      MANIFEST+=("$f")
    done < <(find "$dir" -type f \( "${find_args[@]}" \) -print0 2>/dev/null)
  done
}

print_manifest() {
  if [ ${#MANIFEST[@]} -eq 0 ]; then
    echo "== Inventario de cuarentena =="
    echo "0 archivos encontrados."
    return 0
  fi

  echo "== Inventario de cuarentena =="
  printf '%-10s %-20s %s\n' "SIZE" "MTIME" "RUTA"
  for f in "${MANIFEST[@]}"; do
    local size mtime
    size=$(stat -c '%s' "$f" 2>/dev/null || echo "?")
    mtime=$(stat -c '%y' "$f" 2>/dev/null | cut -d. -f1 || echo "?")
    printf '%-10s %-20s %s\n' "$size" "$mtime" "$f"
  done
  echo ""
  echo "Total: ${#MANIFEST[@]} archivo(s)."
}

apply_quarantine() {
  if [ ${#MANIFEST[@]} -eq 0 ]; then
    echo "Nada que poner en cuarentena. 0 archivos."
    return 0
  fi

  local timestamp
  timestamp="$(date +%Y%m%d%H%M%S)"
  local quarantine_dir="$BACKUPS_ROOT/quarantine-$timestamp"

  if [ -e "$quarantine_dir" ]; then
    echo "ERROR: el directorio de cuarentena ya existe: $quarantine_dir" >&2
    exit 1
  fi

  mkdir -p "$quarantine_dir"

  local manifest_txt="$quarantine_dir/MANIFEST.txt"
  {
    echo "NordicOS — cuarentena de legacy junk"
    echo "Generado: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "Para restaurar un archivo a su ubicación original:"
    echo "  cp \"<ruta-en-esta-carpeta>\" \"<ruta-original>\""
    echo ""
    echo "Archivos movidos (ruta original -> ruta relativa dentro de esta carpeta):"
  } > "$manifest_txt"

  for f in "${MANIFEST[@]}"; do
    # Ruta relativa preservada desde ~/.config
    local rel="${f#"$HOME"/.config/}"
    local dst="$quarantine_dir/$rel"
    mkdir -p "$(dirname "$dst")"
    mv "$f" "$dst"
    echo "  [mv] $f -> $dst"
    echo "$f -> $rel" >> "$manifest_txt"
  done

  echo ""
  echo "Cuarentena aplicada en: $quarantine_dir"
  echo "Manifiesto: $manifest_txt"
}

main() {
  build_manifest

  if [ "${1:-}" = "--apply" ]; then
    print_manifest
    echo ""
    apply_quarantine
  else
    print_manifest
  fi
}

main "$@"
