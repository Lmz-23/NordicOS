#!/usr/bin/env bash
# workspace_status.sh — Emite JSON {text, alt, tooltip} con info de
# workspaces de Hyprland para el módulo waybar `custom/workspaces`.
#
# Patrón: mismo enfoque que docker_status.sh (custom/docker).
#   · hyprctl workspaces -j      → lista de workspaces (windows = int).
#   · hyprctl clients    -j      → ventanas activas (para detalle del WS activo).
#   · hyprctl activeworkspace -j → workspace enfocado.
#   · tooltip con saltos de línea literales (waybar los respeta).
#
# Salida (return-type: json en waybar):
#   {"text":"3","alt":"3","tooltip":"<big>...</big>\n  · WS 1 ●: 2 ventanas\n  · ..."}
#
# Defensivo: si hyprctl falla (sesión cerrada, etc.) emite {} vacío.

set -euo pipefail

# --- Recolectar JSON de hyprctl (cada uno con fallback a []) ---
WS_JSON=$(hyprctl workspaces -j 2>/dev/null || echo "[]")
CLIENTS_JSON=$(hyprctl clients -j 2>/dev/null || echo "[]")
ACTIVE_WS_ID=$(hyprctl activeworkspace -j 2>/dev/null \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('id', 1))" 2>/dev/null \
    || echo "1")

# --- Procesar con python embebido (legible, robusto) ---
python3 << EOF
import json

try:
    ws_data = json.loads('''$WS_JSON''')
except Exception:
    ws_data = []
try:
    clients_data = json.loads('''$CLIENTS_JSON''')
except Exception:
    clients_data = []
try:
    active_ws_id = int('''$ACTIVE_WS_ID''') if '''$ACTIVE_WS_ID''' else 1
except Exception:
    active_ws_id = 1

total = len(ws_data)

# --- Mapa de apps por workspace ---
ws_clients = {}
for c in clients_data:
    ws_id = c.get('workspace', {}).get('id')
    if ws_id is None:
        continue
    cls = c.get('class', 'unknown')
    ws_clients.setdefault(ws_id, []).append(cls)

# --- Listado de workspaces (con apps abiertas por WS) ---
ws_lines = []
for w in sorted(ws_data, key=lambda x: x['id']):
    ws_id   = w['id']
    ws_name = w.get('name', str(ws_id))
    marker  = " ●" if ws_id == active_ws_id else ""
    apps    = ws_clients.get(ws_id, [])
    if apps:
        if len(apps) > 4:
            apps_display = ', '.join(apps[:4]) + f', +{len(apps) - 4}'
        else:
            apps_display = ', '.join(apps)
        line = f"  WS {ws_name}{marker}: {apps_display}"
    else:
        line = f"  WS {ws_name}{marker}: (vacío)"
    ws_lines.append(line)

tooltip = f"<big>Workspaces Hyprland</big>\n  {total} totales\n" + "\n".join(ws_lines)

# --- Salida JSON ---
print(json.dumps({
    "text":    str(total),
    "alt":     str(total),
    "tooltip": tooltip
}, ensure_ascii=False))
EOF