#!/bin/bash
opcion=$(echo -e "Apagar\nReiniciar\nSuspender" | wofi --dmenu --prompt "Energía")

case $opcion in
    Apagar) systemctl poweroff ;;
    Reiniciar) systemctl reboot ;;
    Suspender) systemctl suspend ;;
esac
