#!/usr/bin/env bash
# NordicOS — Battery detail (capacity, cycles, degradation status).
# Usage:
#   battery_detail.sh detail  → multiline summary (for tooltip / quick check)
#   battery_detail.sh dialog  → full report (launched as notify-send on click)
#
# Output fields are pulled from upower -i against BAT0 (verified path on this
# host). We avoid /sys because:
#   * charge_types (Long_Life / conservation mode) requires ideapad_laptop or
#     vendor sysfs that is not always populated uniformly.
#   * upower already normalises decimals and units consistently.
#
# IMPORTANT: we do NOT mock `full-at: 98` — degraded batteries genuinely
# report < 100% as full charge; masking the percentage would hide the
# degradation symptom users complain about.

set -euo pipefail

BATTERY_DEV="${BATTERY_DEV:-/org/freedesktop/UPower/devices/battery_BAT0}"

case "${1:-detail}" in
    detail)
        # Compact summary suitable for a tooltip / `head -10` shell check.
        # Limit to 6 lines so the tooltip does not bloat the bar.
        # upower indents "battery.*" fields with 4 spaces (native-path etc.
        # are flush-left), so we accept optional leading whitespace.
        upower -i "$BATTERY_DEV" 2>/dev/null | awk '
            /^[[:space:]]*state:/                 {print "State:     " $2; next}
            /^[[:space:]]*charge-cycles:/         {print "Cycles:    " $2; next}
            /^[[:space:]]*capacity:/              {print "Health:    " $2; next}
            /^[[:space:]]*energy-full:/           {print "Energy:    " $2 " " $3; next}
            /^[[:space:]]*energy-full-design:/    {print "Design:    " $2 " " $3; next}
            # Match "charge-threshold:" but NOT "charge-threshold-supported:"
            /^[[:space:]]*charge-threshold:[^[:space:]]+[[:space:]]+[^s]/ {print "Threshold: " $2; next}
        ' | head -6
        ;;
    dialog)
        # Full report via libnotify. on-click from the waybar battery module
        # invokes this; the notification persists a few seconds so the user
        # has time to read it.
        DETAIL=$(upower -i "$BATTERY_DEV" 2>/dev/null | awk '
            /^[[:space:]]*native-path:/          {print "Path:       " $2; next}
            /^[[:space:]]*vendor:/               {print "Vendor:     " $2; next}
            /^[[:space:]]*model:/                {print "Model:      " $2; next}
            /^[[:space:]]*serial:/               {print "Serial:     " $2; next}
            /^[[:space:]]*state:/                {print "State:      " $2; next}
            /^[[:space:]]*charge-cycles:/        {print "Cycles:     " $2; next}
            /^[[:space:]]*capacity:/             {print "Health:     " $2; next}
            /^[[:space:]]*energy-full:/          {print "Energy:     " $2 " " $3; next}
            /^[[:space:]]*energy-full-design:/   {print "Design:     " $2 " " $3; next}
            /^[[:space:]]*energy-rate:/          {print "Rate:       " $2 " " $3; next}
            /^[[:space:]]*voltage:/              {print "Voltage:    " $2 " " $3; next}
            /^[[:space:]]*time-to-empty:/        {print "TTE:        " $2 " " $3; next}
            /^[[:space:]]*time-to-full:/         {print "TTF:        " $2 " " $3; next}
            /^[[:space:]]*percentage:/           {print "Charge:     " $2; next}
            /^[[:space:]]*temperature:/          {print "Temp:       " $2 " " $3; next}
            /^[[:space:]]*charge-threshold:[^[:space:]]+[[:space:]]+[^s]/ {print "Threshold:  " $2; next}
        ')
        # Fall back to a stderr message if upower returned nothing (headless,
        # no BAT0, etc.) so the click handler never silently fails.
        if [ -z "${DETAIL// }" ]; then
            notify-send -a "Battery" -u normal "Battery detail" \
                "Unable to read $BATTERY_DEV. Check upower -e."
            exit 1
        fi
        notify-send -a "Battery" -u low -t 15000 "Battery detail" "$DETAIL"
        ;;
    *)
        echo "Usage: $0 {detail|dialog}" >&2
        exit 2
        ;;
esac
