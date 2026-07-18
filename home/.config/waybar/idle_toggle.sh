#!/usr/bin/env bash
# NordicOS — Idle inhibitor toggle via systemd-inhibit.
# Toggle real sleep/screen lock prevention, not just screensaver blocking.
# State stored in /tmp/nordicos-idle-inhibit.pid for persistence across reloads.
# status emits a JSON object with the "state" field so waybar can map it
# to Nerd Font glyphs via format-icons in config.jsonc.

PIDFILE="/tmp/nordicos-idle-inhibit.pid"

is_active() {
    [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null
}

emit_state() {
    if is_active; then
        printf '{"state":"activated","tooltip":"Idle inhibitor ON (click → desactivar)"}\n'
    else
        printf '{"state":"deactivated","tooltip":"Idle inhibitor OFF (click → activar)"}\n'
    fi
}

case "${1:-status}" in
    toggle)
        if is_active; then
            # Currently active → deactivate
            kill "$(cat "$PIDFILE")" && rm -f "$PIDFILE"
        else
            # Cleanup stale pidfile before re-activating
            [ -f "$PIDFILE" ] && rm -f "$PIDFILE"
            # Currently inactive → activate
            systemd-inhibit \
                --what=idle:sleep \
                --who='NordicOS Waybar' \
                --why='User requested via waybar toggle' \
                sleep infinity &
            INHIBIT_PID=$!
            disown
            echo "$INHIBIT_PID" > "$PIDFILE"
        fi
        emit_state
        ;;
    status)
        # Cleanup stale pidfile if process is dead
        if is_active; then
            :
        else
            [ -f "$PIDFILE" ] && rm -f "$PIDFILE"
        fi
        emit_state
        ;;
esac