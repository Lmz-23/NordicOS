#!/usr/bin/env bash
# NordicOS Waybar — Docker click toggle.
#
# Behaviour:
#   · Click on the docker module → opens a kitty window running
#     `watch -n 2 docker ps -a` so the user can see live status / ports /
#     images without leaving the bar.
#   · Click again → closes that kitty window.
#
# No TUI like lazydocker/ctop is installed on this system, so we fall back
# to `watch docker ps` — same pattern as blueman-manager / pavucontrol.
#
# State is tracked via a PID file under XDG_RUNTIME_DIR (falls back to
# /tmp). This is more reliable than `pgrep -f "kitty … docker ps"` because
# the pattern can collide with the user's own manual kitty sessions.

set -euo pipefail

LOCK_DIR="${XDG_RUNTIME_DIR:-/tmp}"
LOCK_FILE="${LOCK_DIR}/waybar-docker-viewer.pid"
TERMINAL_BIN="${TERMINAL_BIN:-kitty}"

# If we have a tracked PID and it's still alive → close it.
if [[ -f "${LOCK_FILE}" ]]; then
    pid="$(cat "${LOCK_FILE}" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
        kill "${pid}" 2>/dev/null || true
        rm -f "${LOCK_FILE}"
        exit 0
    fi
    rm -f "${LOCK_FILE}"
fi

# Open a new live viewer. Detach so waybar's exec doesn't block.
# `setsid` puts the kitty in its own session so a stray Ctrl-C in the
# parent doesn't kill it.
setsid "${TERMINAL_BIN}" \
    -e watch -n 2 'docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"' \
    >/dev/null 2>&1 &
viewer_pid=$!

# Record the PID for next click. Use short-lived race-safe write.
( umask 077 && echo "${viewer_pid}" > "${LOCK_FILE}" ) &
wait $! 2>/dev/null || true

exit 0
