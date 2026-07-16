#!/usr/bin/env bash
# NordicOS — Waybar logo glyph (Valknut)
# Output: a single line with the Valknut approximation glyph.
#
# The Valknut (three interlaced triangles) has no dedicated Unicode code
# point nor a Nerd Font PUA glyph in JetBrainsMonoNL Nerd Font (verified via
# fc-list). Best stable rendering is therefore three white triangles
# `△△△` — these are guaranteed to render in any font with basic geometric
# coverage (which JetBrainsMonoNL NF and JetBrainsMono NF both provide).
#
# This script is invoked once per hour by waybar (`interval: 3600`); it
# stays cheap on purpose: no probes, no DBus, no FC calls in the hot path.
#
# If a future Nerd Font revision DOES ship a valknut PUA glyph, swap the
# GLYPH variable here (e.g., GLYPH=$'\uF0DD' for nf-pictographs) and the
# change propagates everywhere.

GLYPH="△△△"

printf '%s\n' "$GLYPH"
