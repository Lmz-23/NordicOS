#!/usr/bin/env python3
"""
NordicOS Waybar — Docker status emitter.

Produces a JSON line for the `custom/docker` waybar module:
  - text: container count (string)
  - alt: container count (string, drives format-icons key)
  - tooltip: multi-line listing of running container names (newlines preserved
    as JSON \n escape sequences — waybar renders them as real newlines in
    the floating tooltip)

Outputs one line on stdout. Exit 0 always (errors → "0" containers with a
diagnostic tooltip so the bar stays quiet instead of crashing).

Click handler lives in a separate script (docker_toggle.sh) so this stays
read-only and can be polled at the waybar `interval` without side effects.
"""
from __future__ import annotations

import json
import subprocess
import sys


def list_running() -> list[str]:
    """Return names of running containers. Empty list on any error."""
    try:
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
            timeout=4,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return []
    if result.returncode != 0:
        return []
    return [name for name in result.stdout.splitlines() if name]


def main() -> int:
    containers = list_running()
    count = len(containers)

    if count == 0:
        tooltip = "Docker: 0 contenedores corriendo"
    else:
        bullets = "\n".join(f"  • {name}" for name in containers)
        tooltip = f"Docker ({count} corriendo):\n{bullets}"

    payload = {
        "text": str(count),
        "alt": str(count),
        "tooltip": tooltip,
    }
    # json.dumps handles all escaping (newlines → \n, quotes → \", etc.)
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
