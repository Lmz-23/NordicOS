// NordicOS — tokens de color (TEMPORAL).
// TODO Fase 6: sustituir este archivo por import desde ~/.config/ags/theme.css
// generado por palette/build.js (nuevo AGS_MAPPING + buildAgsTheme()).
// Mientras tanto, hardcoded para que el widget compile sin dependencias externas.
//
// Mapeo actual (mantener sincronizado con palette/master.css hasta Fase 6):
//   accent      ↔  @ice
//   accentSoft  ↔  @ice-light
//   text        ↔  @text
//   textMuted   ↔  @text-muted
//   surface     ↔  @bg-1
//   surfaceAlt  ↔  @bg-2
//   border      ↔  @bg-4
//   bg          ↔  @bg-0
//   success     ↔  @green
//   warning     ↔  @yellow
//   error       ↔  @red
//   shadow      ↔  @shadow (Hyprland shadow)

export const theme = {
  bg: "#0b0f14",
  surface: "#151c24",
  surfaceAlt: "#1a2332",
  border: "#3b556d",
  accent: "#78c7ff", // aka @ice en waybar
  accentSoft: "#a0d4ff",
  text: "#d4dde3",
  textMuted: "#8a9bab",
  success: "#6fbf73",
  warning: "#d89b3c",
  error: "#b84c4c",
  shadow: "#1a1a1a", // alias para Hyprland shadow color
} as const
