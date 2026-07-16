#!/usr/bin/env bash
# ============================================================================
# NordicOS — sync-tracking.sh
# ----------------------------------------------------------------------------
# Sincroniza archivos "híbridos" entre el repo y ~/.config/. Solo aplica a
# archivos que NO pueden ser symlinks (porque el build hace atomic write
# sobre ellos y un rename reemplazaría el symlink). Por ahora uno solo:
# ~/.config/hypr/hyprland.lua.
#
# Uso:
#   ./bin/sync-tracking.sh pull   # repo → ~/.config/ (fresh install o sync)
#   ./bin/sync-tracking.sh push   # ~/.config/ → repo (después de editar)
#
# Sin argumentos → alias de `pull` (caso común).
#
# Backups automáticos:
#   - pull: si el destino difiere del source, respalda a `<dst>.bak-sync-<ts>`
#     ANTES de sobrescribir. Así nunca se pierden cambios sin aviso.
#   - push: idem, simétrico.
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO_ROOT/home/.config"
DST="$HOME/.config"

# Lista de archivos híbridos. Si en el futuro hay más, agrégalos aquí.
HYBRID_FILES=(
  "hypr/hyprland.lua"
)

mode="${1:-pull}"

# Backup si difiere. Devuelve 0 si el dst ya coincide (no hace falta cp).
sync_one() {
  local rel="$1"
  local src="$SRC/$rel"
  local dst="$DST/$rel"
  
  if [ ! -e "$src" ] && [ ! -L "$src" ]; then
    echo "  [error] $rel no existe en repo ($src)" >&2
    return 1
  fi
  
  mkdir -p "$(dirname "$dst")"
  
  # Si destino no existe, copiar directamente.
  if [ ! -e "$dst" ] && [ ! -L "$dst" ]; then
    cp "$src" "$dst"
    echo "  [new] $rel (creado desde repo)"
    return 0
  fi
  
  # Si destino y source son byte-identical, no hacer nada.
  if cmp -s "$src" "$dst"; then
    echo "  [ok]   $rel (idéntico, no hace falta copiar)"
    return 0
  fi
  
  # Difieren → backup del dst + cp
  local backup="${dst}.bak-sync-$(date +%Y%m%d%H%M%S)"
  cp "$dst" "$backup"
  cp "$src" "$dst"
  echo "  [sync] $rel (dst respaldado a $(basename "$backup"))"
  return 0
}

case "$mode" in
  pull)
    echo "[pull] repo → ~/.config/"
    for rel in "${HYBRID_FILES[@]}"; do
      sync_one "$rel"
    done
    ;;
  push)
    echo "[push] ~/.config/ → repo"
    # Para push el source/dst están invertidos
    push_one() {
      local rel="$1"
      local dst="$SRC/$rel"   # en push, destino = repo
      local src="$DST/$rel"   # source = home
      
      if [ ! -e "$src" ] && [ ! -L "$src" ]; then
        echo "  [error] $rel no existe en home ($src)" >&2
        return 1
      fi
      mkdir -p "$(dirname "$dst")"
      if [ ! -e "$dst" ] && [ ! -L "$dst" ]; then
        cp "$src" "$dst"
        echo "  [new] $rel (creado desde home)"
        return 0
      fi
      if cmp -s "$src" "$dst"; then
        echo "  [ok]   $rel (idéntico, no hace falta copiar)"
        return 0
      fi
      local backup="${dst}.bak-sync-$(date +%Y%m%d%H%M%S)"
      cp "$dst" "$backup"
      cp "$src" "$dst"
      echo "  [sync] $rel (dst respaldado a $(basename "$backup"))"
      return 0
    }
    for rel in "${HYBRID_FILES[@]}"; do
      push_one "$rel"
    done
    ;;
  *)
    echo "ERROR: subcomando inválido '$mode'" >&2
    echo "Uso: $0 {pull|push}" >&2
    exit 1
    ;;
esac

echo "OK"
