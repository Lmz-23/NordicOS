/* ============================================================================
 * NordicOS — Palette Build Script
 * ----------------------------------------------------------------------------
 * Reads the master palette file (palette/master.css), parses all
 * `@define-color` declarations and generates an HTML preview of the current
 * palette at `palette/preview.html`.
 *
 * This script is intentionally dependency-free (only Node.js built-ins).
 * It will be extended in later phases to also write generated theme files
 * for Waybar, Kitty, Wofi, Hyprland, etc.
 *
 * Usage:
 *   node palette/build.js
 * ========================================================================== */

'use strict';

// --- Node.js core imports --------------------------------------------------
// Using built-in modules to keep the script dependency-free.
// `fs/promises` powers the async preview.html write (kept async so the I/O
// stays non-blocking even when this script grows further). `fs` (sync) is
// pulled in additionally because the atomic-write + backup path benefits
// from deterministic, sequential execution in `main()`.
const fs = require('node:fs/promises');         // Async file operations
const fsSync = require('node:fs');              // Sync file ops (backup + atomicWrite)
const path = require('node:path');              // Cross-platform path helpers
const os = require('node:os');                  // User home directory lookup
const { execSync } = require('node:child_process'); // Sync shell-out (used by luac syntax check)

// --- Configuration ---------------------------------------------------------
// All paths are resolved relative to the project root, not the script
// location, to avoid surprises when the script is run from elsewhere.
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MASTER_CSS = path.join(PROJECT_ROOT, 'palette', 'master.css');
const PREVIEW_HTML = path.join(PROJECT_ROOT, 'palette', 'preview.html');
const HOME = os.homedir();                                        // ~/.config lives under HOME
const BACKUP_DIR = path.join(PROJECT_ROOT, 'backups');            // local, version-controlled backups

/* ============================================================================
 * Regex helpers
 * ----------------------------------------------------------------------------
 * We use two regular expressions:
 *   1. LINE_REGEX matches one valid `@define-color` declaration line
 *      (including its optional trailing `/* comment *\/`). It is applied
 *      per-line (no /g flag) so the parser can emit a structured warning
 *      for every line that contains `@define-color` but is malformed.
 *   2. HEX_REGEX validates a 6-digit hex color string (#RRGGBB).
 *
 * LINE_REGEX groups:
 *   - $1 → token name (e.g. "bg")
 *   - $2 → hex value   (e.g. "#0b0f14")
 *   - $3 → comment text (e.g. "hierro fundido — fondo principal"), if any
 * ========================================================================== */
const LINE_REGEX = /@define-color\s+(\S+)\s+(#[0-9a-fA-F]+)\s*;\s*(?:\/\*\s*(.+?)\s*\*\/)?/;
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

/* ============================================================================
 * WAYBAR_MAPPING — master token → waybar @define-color name
 * ----------------------------------------------------------------------------
 * Waybar's style.css references colors by Waybar-flavored names (e.g. @ice
 * instead of @accent, @danger instead of @error) and is missing @accent-soft
 * outright. This mapping is the single source of truth for the renames so
 * future theme generators (Kitty, Wofi, ...) can ship their own mappings
 * without touching buildWaybarTheme().
 *
 * Order is significant: it controls the order of @define-color lines in the
 * generated file, which in turn keeps diffs stable across regenerations.
 * ========================================================================== */
const WAYBAR_MAPPING = {
  'bg':          'bg',           // mismo
  'surface':     'surface',      // mismo
  'surface-alt': 'surface-alt',  // mismo
  'border':      'border',       // mismo
  'accent':      'ice',          // rename (semantic → Waybar term)
  'accent-soft': 'ice-soft',     // nuevo (waybar no lo tenía)
  'success':     'success',      // mismo
  'warning':     'warning',      // mismo
  'error':       'danger',       // rename (semantic → Waybar term)
  'text':        'text',         // mismo
  'text-muted':  'text-muted',   // mismo
};

/* ============================================================================
 * KITTY_MAPPING — master token → kitty theme.conf color name
 * ----------------------------------------------------------------------------
 * Kitty uses semantic-ish names that line up 1-to-1 with the master palette,
 * except for the "ice/ice-soft" Waybar quirk (kitty doesn't have it). Most
 * names pass through unchanged.
 *
 * The mapping only covers the 11 master tokens. Three additional ANSI colors
 * (magenta, magenta-bright, bright-white) are NOT derived from master.css —
 * they are ANSI-palette extensions specific to kitty and live as hardcoded
 * "extras" inside buildKittyTheme(). Documented in palette/README.md.
 *
 * Order is significant: keeps the generated file readable and diffs stable.
 * ========================================================================== */
const KITTY_MAPPING = {
  'bg':          'bg',
  'surface':     'surface',
  'surface-alt': 'surface-alt',
  'border':      'border',
  'accent':      'accent',       // kitty uses "accent" (no "ice" rename)
  'accent-soft': 'accent-soft',
  'text':        'text',
  'text-muted':  'text-muted',
  'success':     'success',
  'warning':     'warning',
  'error':       'error',
};

/* ============================================================================
 * WOFI_MAPPING — master token → wofi semantic role
 * ----------------------------------------------------------------------------
 * Wofi uses a flat CSS stylesheet (no @define-color), so the mapping just
 * names which master token should populate which wofi CSS property. Names
 * pass through 1-to-1; the actual values are interpolated at render time.
 *
 * Some wofi rules need alpha-blended variants (e.g. selection highlight at
 * 15% opacity). Those are produced at render time by hexToRgba() using the
 * token's hex value — no extra mapping entries needed.
 * ========================================================================== */
const WOFI_MAPPING = {
  'surface':    'surface',    // window background — hierro
  'accent':     'accent',     // borders, selection highlight — hielo glaciar
  'bg':         'bg',         // input background — hierro fundido
  'text':       'text',       // text — blanco hueso
  'border':     'border',     // borders — acero frío
  'text-muted': 'text-muted', // placeholder — texto secundario
};

/* ============================================================================
 * parseMaster(text)
 * ----------------------------------------------------------------------------
 * Parses the contents of master.css line-by-line and returns:
 *   - colors:   Array of valid entries in source order:
 *               { name, value, comment }
 *   - tokens:   Convenience lookup map (name → value) for downstream code.
 *   - warnings: Array of structured warning objects for lines that were
 *               skipped because they contain @define-color but are malformed.
 *               Each warning: { line, content, reason }.
 *
 * A line triggers a warning when ALL of the following hold:
 *   - It contains the substring `@define-color`, AND
 *   - It is not a comment line (not starting with `/*` or `*`), AND
 *   - It does not match LINE_REGEX (e.g. value is not a hex literal), OR
 *     the captured value fails the strict HEX_REGEX check (e.g. `#abc`).
 *
 * This is Fix #3: previously, such lines were silently dropped.
 * ========================================================================== */
function parseMaster(text) {
  const colors = [];
  const warnings = [];
  const lines = text.split('\n');

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    const lineNum = index + 1;

    // --- Skip empty lines and pure comment lines -------------------------
    // Comment lines never declare colors, even if they mention @define-color
    // in their prose (e.g. inside the file header).
    if (
      trimmed === '' ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*')
    ) {
      return;
    }

    // --- Only inspect lines that attempt to declare a color --------------
    if (!trimmed.includes('@define-color')) {
      return;
    }

    // --- Try to match the line against LINE_REGEX ------------------------
    // Defensive reset: LINE_REGEX no longer carries /g, but resetting is
    // cheap insurance and keeps the call idempotent.
    LINE_REGEX.lastIndex = 0;
    const match = LINE_REGEX.exec(trimmed);

    if (!match) {
      // Extract the attempted value (3rd whitespace-separated token) so the
      // warning can echo it back, e.g. "red" or "#xyz789".
      const parts = trimmed.split(/\s+/);
      const attempted = parts[2] ? parts[2].replace(/;$/, '') : '(ausente)';
      warnings.push({
        line: lineNum,
        content: trimmed,
        reason: `valor no es hex válido: "${attempted}"`,
      });
      return;
    }

    const [, name, value, rawComment] = match;

    // --- Strict hex validation: exactly 6 hex digits with leading # -----
    // LINE_REGEX would accept `#abc`; HEX_REGEX rejects it.
    if (!HEX_REGEX.test(value)) {
      warnings.push({
        line: lineNum,
        content: trimmed,
        reason: `valor no es hex válido: "${value}"`,
      });
      return;
    }

    // --- Clean up the comment (collapse whitespace, trim) ---------------
    const comment = rawComment ? rawComment.trim().replace(/\s+/g, ' ') : '';

    colors.push({ name, value, comment });
  });

  // Derive a name → value lookup for downstream consumers (buildPreviewHtml,
  // future theme generators, etc.).
  const tokens = Object.fromEntries(colors.map((c) => [c.name, c.value]));

  return { colors, tokens, warnings };
}

/* ============================================================================
 * escapeHtml(str)
 * ----------------------------------------------------------------------------
 * Minimal HTML entity escaping to keep user-controlled strings (color names,
 * comments) safe inside generated HTML.
 * ========================================================================== */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================================
 * buildPreviewHtml(colors)
 * ----------------------------------------------------------------------------
 * Renders a self-contained HTML preview page:
 *   - Inline CSS (no external assets)
 *   - One card per color (swatch + name + hex + description)
 *   - Responsive CSS Grid (1/2/3 columns)
 *   - Uses the current palette tokens for page chrome (all 11 vars in :root)
 *
 * Returns a string with the full HTML document.
 *
 * Determinism note (Fix #1): the output intentionally contains no dynamic
 * data — no timestamps, no build ids — so the file is byte-identical across
 * runs. This keeps `sha256sum palette/preview.html` stable for the verifier.
 * ========================================================================== */
function buildPreviewHtml(colors) {
  // Quick lookup so the page chrome can reference current palette tokens.
  const tokens = Object.fromEntries(colors.map((c) => [c.name, c.value]));

  // --- Generate the color cards ---------------------------------------------
  // Each card renders the swatch by referencing the matching CSS variable
  // declared in :root (Fix #2). This keeps the swatches in lock-step with
  // the page chrome: change a token in master.css and both update together.
  const cardsHtml = colors
    .map((c) => {
      // Background-ish tokens would otherwise blend into the page; add a
      // subtle border so the swatch remains visible against --bg.
      const isBackgroundish =
        c.name === 'bg' || c.name === 'surface' || c.name === 'surface-alt';
      const swatchStyle = [
        `background:var(--${c.name})`,
        isBackgroundish ? 'border:1px solid var(--border)' : '',
      ]
        .filter(Boolean)
        .join(';');

      return `
    <article class="card">
      <div class="swatch" style="${swatchStyle}" aria-label="${escapeHtml(c.name)} swatch"></div>
      <h3>${escapeHtml(c.name)}</h3>
      <p class="hex"><code>${escapeHtml(c.value)}</code></p>
      <p class="desc">${escapeHtml(c.comment || '(sin descripción)')}</p>
    </article>`;
    })
    .join('\n');

  // --- Inline CSS (uses palette tokens for page chrome) --------------------
  // :root now declares all 11 palette tokens (Fix #2): the 8 chrome vars
  // plus the 3 status vars (--success, --warning, --error). Status swatches
  // reference these variables instead of inline hex, so every swatch shares
  // a single source of truth with the page chrome.
  const css = `
    :root {
      --bg: ${tokens.bg || '#000'};
      --surface: ${tokens.surface || '#111'};
      --surface-alt: ${tokens['surface-alt'] || '#222'};
      --border: ${tokens.border || '#444'};
      --accent: ${tokens.accent || '#78c7ff'};
      --accent-soft: ${tokens['accent-soft'] || '#a0d4ff'};
      --text: ${tokens.text || '#eee'};
      --text-muted: ${tokens['text-muted'] || '#aaa'};
      --success: ${tokens.success || '#6fbf73'};
      --warning: ${tokens.warning || '#d89b3c'};
      --error: ${tokens.error || '#b84c4c'};
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 32px 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                   "Helvetica Neue", Arial, "Noto Sans", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }

    header { max-width: 1200px; margin: 0 auto 24px; }
    header h1 { margin: 0 0 4px; font-size: 28px; color: var(--accent); }
    header p  { margin: 0; color: var(--text-muted); font-size: 14px; }

    .grid {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      gap: 16px;
      grid-template-columns: 1fr;
    }
    @media (min-width: 640px) { .grid { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 960px) { .grid { grid-template-columns: repeat(3, 1fr); } }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .swatch {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      margin-bottom: 6px;
    }

    .card h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .hex {
      margin: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      color: var(--accent-soft);
    }

    .desc {
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--text-muted);
    }

    footer {
      max-width: 1200px;
      margin: 32px auto 0;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 12px;
      text-align: center;
    }

    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  `;

  // --- Assemble the final document -----------------------------------------
  // Header intentionally omits any dynamic timestamp (Fix #1) so the file
  // is byte-identical across runs (sha256-stable for the verifier).
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NordicOS — Palette Preview</title>
  <style>${css}</style>
</head>
<body>
  <header>
    <h1>NordicOS — Palette Preview</h1>
    <p>${colors.length} colores · paleta maestra de NordicOS</p>
  </header>

  <main class="grid">
${cardsHtml}
  </main>

  <footer>
    Generado por <code>palette/build.js</code> — edita <code>palette/master.css</code> para cambiar colores.
  </footer>
</body>
</html>
`;
}

/* ============================================================================
 * buildWaybarTheme(tokens)
 * ----------------------------------------------------------------------------
 * Renders the contents of `~/.config/waybar/themes/nordic.css` from the
 * token map produced by parseMaster(). Applies WAYBAR_MAPPING so that, e.g.,
 * the master token `accent` (semantic) becomes the Waybar-style `@ice` that
 * style.css actually references.
 *
 * Pure function — no I/O. Decoupling content generation from disk writes
 * lets us run the same code path for both dry-runs and real builds.
 *
 * Param:  tokens — { name: hex } lookup produced by parseMaster().tokens
 * Returns: string containing the full generated CSS (header + body + NL).
 * ========================================================================== */
function buildWaybarTheme(tokens) {
  // --- Header (warning, source provenance, regeneration instructions) ---
  // Deliberately timestamp-free so byte-diff vs git is meaningful: the only
  // thing that should change between regenerations is the color values
  // themselves.
  const header = [
    '/* GENERATED FILE — DO NOT EDIT',
    '   Source: /home/lmz/nordicos/palette/master.css',
    '   Generated by: palette/build.js',
    '   To change colors, edit master.css and run `npm run build`',
    '   See /home/lmz/nordicos/palette/README.md for details */',
    '',
  ];

  // --- Body: one @define-color per canonical token -----------------------
  // Names are padded to NAME_WIDTH so the trailing hex values form a tidy
  // column. GTK CSS ignores extra whitespace; this is purely for human
  // readability and stable diffs.
  const NAME_WIDTH = 14;
  const bodyLines = [];

  for (const [masterName, waybarName] of Object.entries(WAYBAR_MAPPING)) {
    const value = tokens[masterName];
    if (!value) {
      // Defensive: the canonical palette covers all 11 mappings, but if a
      // future master.css drops a token we fail loudly in the generated
      // file rather than silently masking the regression.
      bodyLines.push(`/* MISSING in master.css: ${masterName} -> ${waybarName} */`);
      continue;
    }
    const paddedName = waybarName.padEnd(NAME_WIDTH);
    bodyLines.push(`@define-color ${paddedName}${value};`);
  }

  // Trailing newline keeps POSIX tools (cat, diff, git) happy.
  return [...header, ...bodyLines].join('\n') + '\n';
}

/* ============================================================================
 * hexToRgba(hex, alpha)
 * ----------------------------------------------------------------------------
 * Converts a 6-digit hex color (with leading "#") into a CSS `rgba(...)`
 * string at the given alpha. Used by the Wofi renderer for translucent
 * variants (selection highlight, hover) where a flat hex cannot express
 * the desired opacity.
 *
 * Examples:
 *   hexToRgba('#78c7ff', 0.15) -> "rgba(120, 199, 255, 0.15)"
 *   hexToRgba('#3b556d', 0.25) -> "rgba(59, 85, 109, 0.25)"
 *
 * Defensive: silently returns the original hex if it doesn't match the
 * expected shape — callers interpolate the result into a stylesheet where
 * a broken value would fail silently anyway, but staying permissive avoids
 * cascading parse errors from a malformed master.css.
 * ========================================================================== */
function hexToRgba(hex, alpha) {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return hex; // passthrough on malformed input
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ============================================================================
 * hexToRgbaString(hex, alphaHex)
 * ----------------------------------------------------------------------------
 * Converts a 6-digit hex color into Hyprland's compact rgba notation, which
 * packs all four channels (R, G, B, A) into a single 8-digit hex string
 * inside parens — e.g. "rgba(78c7ffee)". This is the format Hyprland uses
 * for border colors and similar properties.
 *
 * `alphaHex` is the alpha channel as a 2-digit hex string (no "0x" prefix).
 * Default "ee" ≈ 93% opacity, matching Hyprland's "barely transparent" feel.
 *
 * Example:
 *   hexToRgbaString('#78c7ff', 'ee') -> "rgba(78c7ffee)"
 *   hexToRgbaString('#3b556d', 'aa') -> "rgba(3b556daa)"
 *
 * The 0x-prefixed shadow format (e.g. `0xee0b0f14`) is built by the caller
 * via simple string concatenation on the slice of `hex` — not by this
 * helper — to keep its responsibility narrow.
 * ========================================================================== */
function hexToRgbaString(hex, alphaHex = 'ee') {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return hex; // passthrough on malformed input
  }
  const to2 = (n) => n.toString(16).padStart(2, '0');
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${to2(r)}${to2(g)}${to2(b)}${alphaHex})`;
}

/* ============================================================================
 * KITTY_EXTRAS — hardcoded ANSI palette extensions
 * ----------------------------------------------------------------------------
 * Three colors live outside master.css because they are part of the 16-color
 * ANSI palette but have no semantic counterpart in the master palette (no
 * app ever refers to "magenta" by name). They are stable design tokens for
 * the kitty terminal palette.
 *
 * Documented in palette/README.md under "Hardcoded extras" so the operator
 * knows where to edit them if a redesign is needed.
 * ========================================================================== */
const KITTY_EXTRAS = {
  magenta:       '#8b7aa0',  // ANSI color5 — extra, no en master
  magentaBright: '#a898c8',  // ANSI color13 — extra, no en master
  brightWhite:   '#ffffff',  // ANSI color15 — extra, no en master
};

/* ============================================================================
 * buildKittyTheme(tokens)
 * ----------------------------------------------------------------------------
 * Renders the contents of `~/.config/kitty/theme.conf` from the master
 * tokens. The output includes:
 *   - Background / Foreground / Cursor / Selection / url_color
 *   - 16-color ANSI palette (color0..color15)
 *
 * The 11 master tokens map 1-to-1 onto their kitty counterparts (see
 * KITTY_MAPPING); the remaining 5 ANSI entries (color5, color13, color15)
 * come from KITTY_EXTRAS. The ANSI palette is intentionally emitted in
 * kitty's conventional color0..color15 order, NOT in KITTY_MAPPING order,
 * because operators eyeballing theme.conf expect the canonical layout.
 *
 * Pure function — no I/O. Param: tokens map from parseMaster().tokens.
 * Returns: string with the full generated theme.conf (header + body + NL).
 * ========================================================================== */
function buildKittyTheme(tokens) {
  // Header intentionally omits timestamps so byte-diff vs git is stable.
  const header = [
    '# GENERATED FILE — DO NOT EDIT',
    '# Source: /home/lmz/nordicos/palette/master.css',
    '# Generated by: palette/build.js',
    '# To change colors, edit master.css and run `npm run build`.',
    '# See /home/lmz/nordicos/palette/README.md for details.',
    '',
    '# Background / Foreground',
  ];

  // Resolve each top-level token via KITTY_MAPPING; fall back to a sane
  // default so a missing token doesn't produce an invalid config.
  const pick = (masterName, fallback) => tokens[masterName] || fallback;

  const bg           = pick('bg',          '#0b0f14');
  const fg           = pick('text',        '#d4dde3');
  const accent       = pick('accent',      '#78c7ff');
  const accentSoft   = pick('accent-soft', '#a0d4ff');
  const border       = pick('border',      '#3b556d');
  const errorColor   = pick('error',       '#b84c4c');
  const successColor = pick('success',     '#6fbf73');
  const warningColor = pick('warning',     '#d89b3c');

  // Top-level semantic lines (background, foreground, cursor, selection, url).
  // Padding keeps hex values in a tidy column for stable diffs. The width
  // is fixed (longest key "selection_foreground" is 20 chars; padEnd(23)
  // + 1 space gives a uniform "#" column regardless of key length).
  const TOP_PAD = 23;
  const topLine = (key, value) => key.padEnd(TOP_PAD) + ' ' + value;
  const topLines = [
    topLine('background',           bg),
    topLine('foreground',           fg),
    topLine('cursor',               accent),
    topLine('selection_foreground', fg),
    topLine('selection_background', border),
    topLine('url_color',            accentSoft),
    '',
    '# ANSI Palette',
  ];

  // Build the 16-color ANSI palette in canonical color0..color15 order.
  // Each entry has a trailing inline comment so the operator can see which
  // are master-derived and which are extras.
  //
  // Alignment strategy: `color${i}` is padded to width 7 (the longest
  // "color15" is 7 chars), then a single space, then the hex. This
  // yields 1 space for color0..color9 and 1 space for color10..color15
  // (padEnd adds nothing extra for the already-7-wide keys), keeping
  // every "#HEX" at the same column for tidy diffs.
  const PAD_KEY = 7;
  const ANSI_COMMENT_GAP = '    '; // 4 spaces between hex and inline comment
  const ansiEntries = [
    { i: 0,  hex: bg,                  tag: '# bg' },
    { i: 1,  hex: errorColor,          tag: '# error' },
    { i: 2,  hex: successColor,        tag: '# success' },
    { i: 3,  hex: warningColor,        tag: '# warning' },
    { i: 4,  hex: border,              tag: '# border' },
    { i: 5,  hex: KITTY_EXTRAS.magenta,       tag: '# magenta (extra, no en master)' },
    { i: 6,  hex: accent,              tag: '# accent' },
    { i: 7,  hex: fg,                  tag: '# text' },
    { i: 8,  hex: border,              tag: '# border (bright)' },
    { i: 9,  hex: errorColor,          tag: '# error (bright)' },
    { i: 10, hex: successColor,        tag: '# success (bright)' },
    { i: 11, hex: warningColor,        tag: '# warning (bright)' },
    { i: 12, hex: accent,              tag: '# accent (bright)' },
    { i: 13, hex: KITTY_EXTRAS.magentaBright, tag: '# magenta-bright (extra, no en master)' },
    { i: 14, hex: accentSoft,          tag: '# accent-soft' },
    { i: 15, hex: KITTY_EXTRAS.brightWhite,   tag: '# bright-white (extra, no en master)' },
  ];
  const ansiLines = ansiEntries.map(({ i, hex, tag }) =>
    `color${i}`.padEnd(PAD_KEY) + ' ' + hex + ANSI_COMMENT_GAP + tag
  );

  // Compose: header + top-level + ANSI + trailing newline.
  return [...header, ...topLines, ...ansiLines, ''].join('\n');
}

/* ============================================================================
 * buildWofiStyle(tokens)
 * ----------------------------------------------------------------------------
 * Renders the complete contents of `~/.config/wofi/style.css`. Wofi uses a
 * flat GTK CSS stylesheet (no @define-color indirection), so this function
 * inlines hex values directly into the rules.
 *
 * Style philosophy ("ornamentado" / nordic):
 *   - Window frame: 2px solid accent border (was 1px) + subtle 1px inner
 *     shadow tinted with accent @10% for depth.
 *   - Input: more generous padding/margin, 8px border-radius, and a vertical
 *     ice strip (`box-shadow: inset 3px 0 0`) that appears only on :focus.
 *   - Entries: more breathing room (8px 18px padding, 2px 8px margin), a
 *     reserved 2px transparent left border so the indicator on hover/selected
 *     can appear without shifting layout.
 *   - Hover vs selected are deliberately distinct: hover is a hint
 *     (accent @6% bg + @30% left border) and selected is a commit
 *     (accent @15% bg + solid accent text + full-intensity left border).
 *
 * Alpha-blended variants (selection highlight, hover, inner shadow) are
 * produced at render time via hexToRgba(), so changing `accent` in master.css
 * updates both the solid and translucent variants in lock-step.
 *
 * Non-color rules (font-family, padding, border-radius, box-shadow inset
 * geometry, icon spacing) are baked into the template and intentionally
 * preserved across regenerations — they are style decisions, not palette
 * decisions.
 *
 * NOTE: `image_size` (icon rendering size) is a wofi CONFIG setting, not a
 * CSS one. The build cannot influence it — users must set `image_size=28`
 * in `~/.config/wofi/config` themselves. The README's "Configuración manual
 * recomendada" section explains this.
 *
 * Pure function — no I/O. Param: tokens map. Returns full CSS string.
 * ========================================================================== */
function buildWofiStyle(tokens) {
  // Pull master tokens with fallbacks so a missing token can't produce an
  // invalid stylesheet (CSS would silently ignore broken hex literals).
  const t = {
    surface:    tokens.surface    || '#151c24',
    accent:     tokens.accent     || '#78c7ff',
    bg:         tokens.bg         || '#0b0f14',
    text:       tokens.text       || '#d4dde3',
    border:     tokens.border     || '#3b556d',
    textMuted:  tokens['text-muted'] || '#8a9bab',
  };

  // Alpha variants derived from accent. All four use the same source token,
  // so editing `accent` in master.css updates every translucent variant
  // in lock-step — no risk of "selection bright, hover dim" mismatches.
  //
  // Intensities are encoded as named constants here so the operator can
  // adjust the look without touching the body template.
  const accentSelectBg     = hexToRgba(t.accent, 0.15);  // :selected background
  const accentHoverBg       = hexToRgba(t.accent, 0.06);  // :hover background (very subtle)
  const accentBorderHover   = hexToRgba(t.accent, 0.30);  // :hover left-border indicator
  const accentInnerShadow   = hexToRgba(t.accent, 0.10);  // window inner-shadow depth tint

  // Header is timestamp-free for stable byte diffs. The trailing block
  // reminds the operator that `orientation` / `width` / `height` are
  // wofi config (NOT CSS) and have to be set in `~/.config/wofi/config`.
  const header = [
    '/* GENERATED FILE — DO NOT EDIT',
    '   Source: /home/lmz/nordicos/palette/master.css',
    '   Generated by: palette/build.js',
    '   To change colors, edit master.css and run `npm run build`.',
    '   See /home/lmz/nordicos/palette/README.md for details.',
    '   --',
    '   Sugerencia: en ~/.config/wofi/config usa:',
    '     orientation=vertical',
    '     width=500',
    '     height=600',
    '   (estos ajustes NO los maneja el build) */',
    '',
  ];

  // Body — full stylesheet. Non-color rules (font-family, padding,
  // border-radius, box-shadow geometry) are style decisions baked into
  // the template. Color values are interpolated from `t.*`; alpha
  // variants come from the hexToRgba() calls above.
  const body = [
    'window {',
    `    background-color: ${t.surface};`,
    // 2px border (was 1px) — sturdier frame, reads as a deliberate window
    // rather than a transient popup.
    `    border: 2px solid ${t.accent};`,
    '    border-radius: 12px;',
    '    font-family: "JetBrainsMono Nerd Font", sans-serif;',
    // 1px inset shadow tinted with accent @10% — adds depth without making
    // the window look "doubled". Reads as a subtle inner bevel.
    `    box-shadow: inset 0 0 0 1px ${accentInnerShadow};`,
    '}',
    '',
    '#input {',
    `    background-color: ${t.bg};`,
    `    color: ${t.text};`,
    `    border: 1px solid ${t.border};`,
    '    border-radius: 8px;',
    // 14px margin (was 10px) gives breathing room from the window border.
    // The 4px rhythm pairs with the 2px border for tidy alignment.
    '    margin: 14px;',
    // 10px 14px padding (was 8px 12px) so typed text doesn't crowd the
    // input border.
    '    padding: 10px 14px;',
    '    font-size: 14px;',
    '}',
    '',
    '#input:focus {',
    // Border switches to accent — primary "you have focus" cue.
    `    border-color: ${t.accent};`,
    // Decorative vertical ice line on the left edge (nordic motif):
    // `inset 3px 0 0` carves a 3px-wide accent strip just inside the
    // left border. Disappears when focus is lost because the rule only
    // matches :focus. Inspired by runestone inscriptions.
    `    box-shadow: inset 3px 0 0 ${t.accent};`,
    '}',
    '',
    '#entry {',
    `    color: ${t.text};`,
    // 8px 18px padding (was 6px 12px) for more comfortable reading of
    // entry labels, especially when images are 28px.
    '    padding: 8px 18px;',
    // 2px 8px margin so the visual rhythm reads as a list rather than a
    // wall of text.
    '    margin: 2px 8px;',
    '    border-radius: 6px;',
    // Reserved 2px transparent left border — keeps layout stable when
    // :hover / :selected light up the indicator. Without this, the
    // border-left appearance would cause a 2px horizontal jitter.
    '    border-left: 2px solid transparent;',
    '}',
    '',
    '#entry:hover {',
    // Distinct from :selected on purpose: same color family (accent) but
    // much lower intensity. The lower bg opacity + dimmer border-left
    // signal "you can click here" without committing to a selection.
    `    background-color: ${accentHoverBg};`,
    `    border-left-color: ${accentBorderHover};`,
    '}',
    '',
    '#entry:selected {',
    // Full selection: @15% bg + solid accent text + full-intensity
    // border-left. The border-left becomes a solid ice strip, clearly
    // marking the active row.
    `    background-color: ${accentSelectBg};`,
    `    color: ${t.accent};`,
    '    border-radius: 6px;',
    `    border-left-color: ${t.accent};`,
    '}',
    '',
    '#entry:selected #text {',
    // Belt-and-suspenders: explicit override so nested `#text` keeps
    // the accent color even when a parent rule changes. Matches the
    // pattern from the previous version.
    `    color: ${t.accent};`,
    '}',
    '',
    '#text {',
    `    color: ${t.text};`,
    '    font-size: 13px;',
    '}',
    '',
    '#img {',
    // Spacing between the app icon and the entry text. The actual icon
    // size is set by `image_size=28` in ~/.config/wofi/config — the
    // build cannot influence it. 28px reads more comfortably than the
    // default 24px next to a 13px label.
    '    margin-right: 10px;',
    '}',
    '',
    '#prompt {',
    // Subdued label above the input. Using text-muted keeps the prompt
    // visually de-emphasized so the typed query is the focal point.
    `    color: ${t.textMuted};`,
    '    padding: 0 14px;',
    '    font-size: 12px;',
    '}',
  ];

  return [...header, ...body, ''].join('\n');
}

/* ============================================================================
 * buildHyprlandColors(tokens)
 * ----------------------------------------------------------------------------
 * Renders the Hyprland color block that lives between the
 * `-- >>> NORDICOS PALETTE START >>>` and `-- <<< NORDICOS PALETTE END <<<`
 * markers inside `~/.config/hypr/hyprland.lua`.
 *
 * The block is designed to live INSIDE `general = { ... }` in the user's
 * hyprland.lua, so it must be a *valid Lua table assignment* — not a
 * Hyprland-shorthand function call. The output shape is:
 *
 *   col = {
 *       active_border   = { colors = {"<rgba>", "<rgba>"}, angle = 45 },
 *       inactive_border = "<rgba>",
 *   },
 *
 * CRITICAL FORMAT NOTE:
 *   Hyprland's Lua config parses `general.col` as a regular Lua table. In
 *   that context, gradients MUST be expressed as a *table* with the keys
 *   `colors` and `angle`. The legacy shorthand of cramming the gradient
 *   into a single string — `"rgba(...) rgba(...) 45deg"` — is only
 *   accepted by Hyprland's non-Lua config parser. In a `hyprland.lua`
 *   file the legacy syntax yields:
 *       error setting 'general.col.active_border': invalid color "..."
 *   and `hyprctl reload` is aborted. This was the source of the previous
 *   incident and is the format regression this function guards against
 *   (see validateHyprlandPattern below).
 *
 * Scope (intentionally narrow):
 *   - active_border   -> accent + accent-soft (gradient, ~93% opacity)
 *   - inactive_border -> border (~67% opacity)
 *   - NOT emitted: shadow / shadow_offset / blur / enabled. Those belong
 *     to `decoration.shadow` in Hyprland's config grammar, which the user
 *     maintains by hand. Mixing them into this block produced syntax errors
 *     in the previous build and is the regression we are avoiding here.
 *
 * Pure function — no I/O of its own. The two validation steps below are
 * read-only (luac `-p` = parse only, no codegen; pattern check is a pure
 * substring scan). Param: tokens map. Returns: Lua block string WITHOUT
 * a trailing newline — `replaceMarkerBlock` preserves the newline that
 * already follows the end marker in the target file, so appending our own
 * would duplicate it (and historically accumulated one extra blank line
 * per build, producing spurious mtime bumps + unnecessary backups).
 * Throws on validation failure.
 * ========================================================================== */
function buildHyprlandColors(tokens) {
  // Resolve master tokens with fallbacks so a missing token can't produce
  // an invalid Lua block (Hyprland would silently ignore broken rgba).
  const accent     = tokens.accent        || '#78c7ff';
  const accentSoft = tokens['accent-soft'] || '#a0d4ff';
  const border     = tokens.border        || '#3b556d';
  // bg is intentionally NOT used here — `decoration.shadow` settings are
  // user-maintained in hyprland.lua; this generator owns only `col`.

  // Compose Hyprland-style rgba strings of the shape "rgba(78c7ffee)".
  // hexToRgbaString() already wraps in rgba(...) AND packs the alpha into
  // the trailing two hex digits, so we embed its output verbatim — no
  // double wrap (which is precisely the mistake the previous bug made).
  //
  // active_border uses 'ee' (~93%) so the focused gradient reads as vivid;
  // inactive_border uses 'aa' (~67%) so unfocused windows are visibly
  // dimmer than focused ones — a deliberate visual hierarchy.
  const activeStart = hexToRgbaString(accent,     'ee');  // "rgba(78c7ffee)"
  const activeEnd   = hexToRgbaString(accentSoft, 'ee');  // "rgba(a0d4ffee)"
  const inactive    = hexToRgbaString(border,     'aa');  // "rgba(3b556daa)"

  // Gradient direction in degrees (top-left → bottom-right convention used
  // by Hyprland). Held as a local constant rather than a parameter because
  // the angle is a visual-identity decision, not a palette decision — if
  // you ever need it overridable per-theme, hoist this to a parameter or
  // a top-level constant alongside WAYBAR_MAPPING / KITTY_MAPPING etc.
  const ANGLE_DEGREES = 45;

  // Assemble the block. `active_border` is a TABLE (gradient), `inactive_border`
  // a plain STRING. Indentation uses 4 spaces to match Hyprland's style
  // guide for `general = { ... }`. The block is timestamp-free for stable
  // byte diffs against git.
  //
  // Trailing comma after the closing `},` is REQUIRED: this block lives
  // inside the user's `general = { ... }` table which contains more fields
  // after it (resize_on_border, allow_tearing, layout, ...). Lua's grammar
  // rejects a missing separator between table entries, so without that
  // comma `luac -p` fails with `'}' expected near 'layout'` — the exact
  // failure mode the validation below is here to catch.
  const block = [
    '-- >>> NORDICOS PALETTE START >>>',
    '-- GENERATED — DO NOT EDIT MANUALLY',
    '-- Source: /home/lmz/nordicos/palette/master.css',
    '-- Generated by: palette/build.js',
    '',
    'col = {',
    `    active_border   = { colors = {"${activeStart}", "${activeEnd}"}, angle = ${ANGLE_DEGREES} },`,
    `    inactive_border = "${inactive}",`,
    '},',
    '',
    '-- <<< NORDICOS PALETTE END <<<',
  ];

  // NOTE: do NOT append a trailing '\n' here.
  //
  // `replaceMarkerBlock` splices the result between the markers, preserving
  // whatever already follows the end marker in the target file (the file's
  // own newline after `-- <<< NORDICOS PALETTE END <<<`). Concatenating an
  // extra '\n' here produced a blank line post-marker AND — because each
  // build rewrote the file — caused the blank-line count to grow by one
  // every run (the previously-accumulated blank lines were re-sliced back
  // in). Net effect: mtime bumped on every build even with no real change,
  // backups filled up, and idempotency was broken.
  //
  // Removing the trailing newline restores idempotency: as long as the
  // tokens don't change, the spliced output is byte-identical to the
  // previous build.
  const content = block.join('\n');

  // --- Validation 1: luac syntax check ------------------------------------
  // If `luac` is installed, parse the block to catch any Lua syntax
  // regression before this content ever replaces the markers in
  // hyprland.lua. If luac is NOT installed, we silently skip — having it
  // is not a hard dependency of build.js. The previous incident (a
  // malformed block made it to disk and broke `hyprctl reload`) is the
  // reason this check exists; we'd rather fail loudly during
  // `npm run build` than leave the operator to discover the breakage by
  // visual inspection.
  try {
    // `-p` = parse only, no codegen, no execution → safe on any snippet.
    // `-` (after -p) tells luac to read from stdin. Without this, luac
    // defaults to writing the parsed bytecode to `./luac.out` in cwd,
    // which fails noisily on systems where cwd isn't writable.
    //
    // Wrap the block in a mock table so the *standalone* parse mimics
    // the real context (the block lives inside `general = { ... }`). This
    // is important because the block ends with a trailing `,` — required
    // by the surrounding context but a syntax error at top level.
    const wrapped = `local _ = {\n${content}\n}\n`;
    execSync('luac -p -', { input: wrapped, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    // Distinguish "luac missing" (ENOENT) from "luac rejected the syntax"
    // so the operator gets an actionable message either way.
    if (err.code === 'ENOENT') {
      // luac not installed — degraded validation, not a fatal error. The
      // pattern check below still runs, so we don't lose all protection.
    } else {
      // luac is installed but rejected the snippet. Surface the compiler
      // diagnostic plus the snippet itself so the operator can spot the
      // bad line immediately.
      const diagnostic = err.stderr
        ? err.stderr.toString().trim()
        : (err.message || '(sin diagnóstico)');
      throw new Error(
        `Hyprland block failed luac syntax check.\n` +
        `Diagnostic: ${diagnostic}\n` +
        `--- Generated content ---\n${content}`
      );
    }
  }

  // --- Validation 2: structural pattern check ----------------------------
  // Belt-and-suspenders guard against the legacy string-format bug: even
  // if luac is missing or accepts a degraded block, we verify the block
  // actually carries the structural pieces Hyprland's Lua bridge
  // requires. Catches regression where the buggy
  // `"<rgba> <rgba> 45deg"` shape silently ships because luac is
  // unavailable on the build host.
  //
  // Substrings to require (intentionally strict — false positives are
  // cheap to fix; false negatives ship a broken config to hyprland.lua):
  //   - 'active_border   = { colors = {'  → gradient is a table, not a string
  //   - 'angle = 45 }'                   → closing brace of gradient table
  //   - 'inactive_border = "rgba('       → valid inactive string (also serves
  //                                         as a canary that hexToRgbaString
  //                                         ran without returning a malformed
  //                                         value).
  const requiredSubstrings = [
    'active_border   = { colors = {',
    'angle = 45 }',
    'inactive_border = "rgba(',
  ];
  const missing = requiredSubstrings.filter((s) => !content.includes(s));
  if (missing.length > 0) {
    throw new Error(
      `Hyprland block failed pattern check.\n` +
      `Missing required substrings: ${missing.join('; ')}\n` +
      `--- Generated content ---\n${content}`
    );
  }

  return content;
}

/* ============================================================================
 * replaceMarkerBlock(filePath, startMarker, endMarker, newContent)
 * ----------------------------------------------------------------------------
 * Reads `filePath` and returns the file's new contents with the region
 * between `startMarker` and `endMarker` replaced by `newContent`.
 *
 * The markers are matched as plain strings (no regex), so they can contain
 * arbitrary characters without escaping. `endMarker` is only searched
 * AFTER the position of `startMarker`, so nested or repeated markers in
 * the same file behave predictably.
 *
 * Returns:
 *   { newContent, replaced, oldBlock }
 *     - newContent : full updated file (with new block in place)
 *     - replaced   : true (always, when markers are found)
 *     - oldBlock   : the original text that was replaced, including markers
 *
 *   null  when either marker is missing. The caller can then decide whether
 *         to warn, abort, or auto-inject (we choose to warn only).
 *
 * Pure read; does NOT write. The caller is responsible for backup +
 * atomicWrite so the policy stays in one place (main()).
 * ========================================================================== */
function replaceMarkerBlock(filePath, startMarker, endMarker, newContent) {
  // Defensive: missing file is a caller bug, but returning null keeps the
  // contract symmetric with "markers not found".
  if (!fsSync.existsSync(filePath)) {
    return null;
  }

  const original = fsSync.readFileSync(filePath, 'utf8');

  // Locate the start marker (first occurrence).
  const startIdx = original.indexOf(startMarker);
  if (startIdx === -1) {
    return null;
  }

  // Locate the end marker strictly AFTER the start, so we never match a
  // stray end marker that precedes the start in some other context.
  const searchFrom = startIdx + startMarker.length;
  const endIdx = original.indexOf(endMarker, searchFrom);
  if (endIdx === -1) {
    return null;
  }

  // The slice covers [startIdx .. endIdx + len(endMarker)) so the end
  // marker itself is consumed in the replacement.
  const oldBlock = original.slice(startIdx, endIdx + endMarker.length);

  // Splice: keep everything before the start marker, append the new
  // content, then keep everything after the end marker.
  const updated =
    original.slice(0, startIdx) +
    newContent +
    original.slice(endIdx + endMarker.length);

  return { newContent: updated, replaced: true, oldBlock };
}

/* ============================================================================
 * KITTY_COLOR_LINE_REGEX — identifies lines to strip during kitty.conf migration
 * ----------------------------------------------------------------------------
 * Anchored at start-of-line and matches kitty color-related directives:
 *   - background, foreground, cursor
 *   - selection_foreground, selection_background
 *   - url_color
 *   - color0..color15 (ANSI palette)
 *
 * The `\b` word boundary after each prefix is critical: it prevents
 * accidental matches on similar settings like `background_opacity` or
 * `cursor_shape`, which share prefixes but are NOT color directives.
 *
 * Note: comment lines and blank lines do NOT start with any of these
 * tokens (comments start with "#", blank with whitespace), so the regex
 * is naturally safe on those.
 * ========================================================================== */
const KITTY_COLOR_LINE_REGEX =
  /^(background|foreground|cursor|selection_foreground|selection_background|url_color|color\d+)\b/;

/* ============================================================================
 * migrateKittyConfig()
 * ----------------------------------------------------------------------------
 * One-shot migration: extracts color directives from `~/.config/kitty/kitty.conf`
 * and leaves only non-color settings (font, scrollback, behavior, etc.).
 * After migration, kitty.conf gains:
 *   - A trailing comment pointing to theme.conf
 *   - An `include theme.conf` directive (if not already present)
 *
 * Idempotency: returns false immediately when:
 *   - The source kitty.conf is missing, OR
 *   - kitty.conf already contains `include theme.conf`
 * The caller is expected to check theme.conf existence separately; this
 * function focuses on the structural migration of kitty.conf.
 *
 * Side effects: writes kitty.conf via atomicWrite (after backing up the
 * original to BACKUP_DIR). Does NOT touch theme.conf — that's the
 * buildKittyTheme() path.
 * ========================================================================== */
function migrateKittyConfig() {
  const kittyConfPath = path.join(HOME, '.config', 'kitty', 'kitty.conf');

  // Defensive: nothing to migrate if the file doesn't exist yet.
  if (!fsSync.existsSync(kittyConfPath)) {
    return false;
  }

  const original = fsSync.readFileSync(kittyConfPath, 'utf8');

  // Idempotency guard: if the include directive is already there, this
  // file has already been migrated. Bail without writing anything.
  if (original.includes('include theme.conf')) {
    return false;
  }

  // Split into lines and filter out color directives, preserving the
  // original order of everything else (comments, blank lines, settings).
  const lines = original.split('\n');
  const kept = lines.filter((line) => {
    // Trimmed view for the regex; we still pass the original line through
    // unchanged when it doesn't match.
    const trimmed = line.trim();
    if (trimmed === '') return true;            // keep blank lines
    if (trimmed.startsWith('#')) return true;   // keep comments
    return !KITTY_COLOR_LINE_REGEX.test(trimmed);
  });

  // Re-join, then ensure a single trailing newline before appending our
  // footer so the file always ends cleanly.
  let updated = kept.join('\n');
  if (!updated.endsWith('\n')) {
    updated += '\n';
  }

  // Footer: comment + include directive. Kept on separate lines for
  // readability and stable diffs.
  updated += '\n' +
    '# Color palette moved to theme.conf (auto-managed by palette/build.js)\n' +
    'include theme.conf\n';

  // Backup the original BEFORE writing — operator can roll back to the
  // pre-migration kitty.conf if anything goes wrong.
  const backupPath = backupFile(kittyConfPath, BACKUP_DIR);
  if (backupPath) {
    console.log(`✓ Backup saved: ${path.relative(PROJECT_ROOT, backupPath)}`);
  }

  // Atomic write so a crash mid-write never leaves kitty.conf half-migrated.
  atomicWrite(kittyConfPath, updated);
  console.log(`✓ Migrated kitty.conf (color lines moved to theme.conf)`);
  return true;
}

/* ============================================================================
 * backupFile(filePath, backupDir)
 * ----------------------------------------------------------------------------
 * Copies an existing file into `backupDir` under a timestamped name so
 * successive regenerations never overwrite earlier snapshots. Returns the
 * absolute path of the new backup, or `null` if there was nothing to copy.
 *
 * Naming: <stem>-<YYYYMMDD-HHMMSS>.<ext>
 *   e.g. /home/.../backups/nordic-20260705-2350.css
 *
 * Uses sync I/O deliberately: called only right before a destructive write,
 * where deterministic ordering is more valuable than micro-optimisation.
 *
 * Cleanup policy: we do NOT prune old backups here. Keeping a growing
 * history is safer for the operator (always able to roll back further); a
 * separate cleanup pass can be added later if disk usage becomes a concern.
 * ========================================================================== */
function backupFile(filePath, backupDir) {
  // Nothing to do if the source doesn't exist yet (first run on a fresh
  // machine). Returning null lets the caller branch the log message.
  if (!fsSync.existsSync(filePath)) {
    return null;
  }

  // Ensure the backup directory exists. recursive=true makes this a no-op
  // when the directory is already there.
  fsSync.mkdirSync(backupDir, { recursive: true });

  // Local-time timestamp is sufficient for a single-user workflow; no need
  // to pull in timezone-aware libraries.
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const ext = path.extname(filePath);            // ".css"
  const stem = path.basename(filePath, ext);     // "nordic"
  const backupPath = path.join(backupDir, `${stem}-${stamp}${ext}`);

  fsSync.copyFileSync(filePath, backupPath);
  return backupPath;
}

/* ============================================================================
 * atomicWrite(filePath, content)
 * ----------------------------------------------------------------------------
 * Writes `content` to `filePath` in a way that never leaves the destination
 * in a half-written state, even if the process is interrupted mid-write.
 *
 * POSIX-atomic strategy:
 *   1. mkdir -p the parent directory (no-op if it already exists).
 *   2. Write to a sibling temp file (same filesystem as the target).
 *   3. `fs.renameSync(tmp, target)` — atomic on POSIX when src/dst share a
 *      filesystem, which they always do here because the temp lives in the
 *      same directory.
 *   4. On failure, best-effort delete the .tmp so it doesn't accumulate.
 *
 * The temp name is intentionally not randomised: this script runs
 * sequentially per project. Switch to `fs.mkstempSync` if parallel runs
 * ever become a real possibility.
 * ========================================================================== */
function atomicWrite(filePath, content) {
  // Ensure parent exists. Recursive=true handles arbitrarily-nested targets
  // such as ~/.config/waybar/themes/ in a single call.
  fsSync.mkdirSync(path.dirname(filePath), { recursive: true });

  const tmpPath = filePath + '.tmp';
  try {
    // utf8 is Node's default; passed explicitly for clarity.
    fsSync.writeFileSync(tmpPath, content, 'utf8');
    // rename replaces the destination if it already exists. On POSIX the
    // kernel guarantees this is atomic w.r.t. concurrent readers.
    fsSync.renameSync(tmpPath, filePath);
  } catch (err) {
    // Best-effort cleanup. We swallow cleanup errors because the original
    // failure (the one we're about to rethrow) carries the actionable info.
    try {
      fsSync.unlinkSync(tmpPath);
    } catch (_cleanupErr) {
      // Intentional no-op: keeping a stale .tmp is preferable to losing
      // the original error context.
    }
    throw err;
  }
}

/* ============================================================================
 * generateDiff(oldContent, newContent, fileLabel)
 * ----------------------------------------------------------------------------
 * Returns a unified-diff-style report comparing two strings, or `null` if
 * they are byte-identical. Uses a textbook O(m·n) longest-common-subsequence
 * so output stays correct for interleaved changes (not just prefix/suffix).
 *
 * Why LCS instead of a simple set compare: the generated file is small
 * (~25 lines), so the cost is negligible (<1 ms) and we avoid the false
 * positives a naive line-by-line compare would emit when lines move.
 *
 * Output format (one operation per line):
 *   ' '   unchanged
 *   '-'   removed (in old only)
 *   '+'   added   (in new only)
 * Preceded by `--- <label> (previous)` / `+++ <label> (new)` headers, like
 * a minimal unified diff so the user can read it at a glance.
 * ========================================================================== */
function generateDiff(oldContent, newContent, fileLabel) {
  // Trivial fast path — skip the table build entirely when nothing changed.
  if (oldContent === newContent) return null;

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const m = oldLines.length;
  const n = newLines.length;

  // --- Build LCS length table -------------------------------------------
  // lcs[i][j] = length of LCS of oldLines[0..i-1] and newLines[0..j-1].
  // Allocated row-by-row (rather than as a single m*n init) because the
  // array is tiny and this reads more clearly.
  const lcs = new Array(m + 1);
  for (let i = 0; i <= m; i++) lcs[i] = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }

  // --- Backtrack to recover the edit script -----------------------------
  // ops is collected right-to-left, then reversed at the end for natural
  // top-to-bottom printing.
  const ops = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      ops.push(' ' + oldLines[i - 1]);
      i--; j--;
    } else if (lcs[i - 1][j] >= lcs[i][j - 1]) {
      ops.push('-' + oldLines[i - 1]);
      i--;
    } else {
      ops.push('+' + newLines[j - 1]);
      j--;
    }
  }
  // Drain leftover rows/cols — these are pure deletions or insertions that
  // happen at one edge of the file.
  while (i > 0) { ops.push('-' + oldLines[i - 1]); i--; }
  while (j > 0) { ops.push('+' + newLines[j - 1]); j--; }
  ops.reverse();

  const header = `--- ${fileLabel} (previous)\n+++ ${fileLabel} (new)`;
  return `${header}\n${ops.join('\n')}\n`;
}

/* ============================================================================
 * formatPrintList(colors)
 * ----------------------------------------------------------------------------
 * Returns a pretty-printed list of colors for stdout, with right-aligned
 * names so the hex values form a clean column.
 * ========================================================================== */
function formatPrintList(colors) {
  // Compute the longest name so we can align the colons nicely.
  const width = Math.max(...colors.map((c) => c.name.length));
  return colors.map((c) => `     - ${c.name.padEnd(width)}: ${c.value}`).join('\n');
}

/* ============================================================================
 * main()
 * ----------------------------------------------------------------------------
 * Orchestrates the script:
 *   1. Read master.css
 *   2. Parse and validate colors
 *   3. Print a summary to stdout
 *   4. Render preview.html (always written — lives inside the project)
 *   5. Render the theme content for each component (pure, no I/O):
 *        - waybar theme
 *        - kitty theme.conf
 *        - wofi style.css (full replacement)
 *        - hyprland color block (marker-based)
 *   6. Branch: --dry-run shows would-be content for every component and
 *      exits cleanly without writing. Otherwise, for each component:
 *        a. Backup if the on-disk file differs from what we are about to
 *           write (avoids polluting BACKUP_DIR with byte-identical copies).
 *        b. Atomic write.
 *        c. Diff vs previous (only when a backup was taken).
 *      Special cases:
 *        - kitty: one-shot migration of kitty.conf to extract color lines
 *          and append `include theme.conf` (runs only when needed).
 *        - hyprland: warns and skips when the marker block is absent;
 *          we never auto-inject markers (it's a user-driven setup).
 * ========================================================================== */
async function main() {
  // --dry-run short-circuits all writes to ~/.config/ so the script can be
  // exercised in safety on any machine without touching live component files.
  const isDryRun = process.argv.includes('--dry-run');

  try {
    // --- 1. Read master.css -----------------------------------------------
    // UTF-8 is the default in Node; here for explicitness.
    const css = await fs.readFile(MASTER_CSS, 'utf8');

    // --- 2. Parse & validate ---------------------------------------------
    // `tokens` is the name→value map used by every theme generator below.
    const { colors, tokens, warnings } = parseMaster(css);

    // Surface any parse warnings to the user (non-fatal by design).
    // Warnings are structured objects { line, content, reason } (Fix #3).
    for (const w of warnings) {
      console.warn(`⚠ Línea ${w.line} omitida (${w.reason})`);
      console.warn(`   ${w.content}`);
    }

    if (colors.length === 0) {
      throw new Error(
        'No valid @define-color declarations found in master.css. Aborting.'
      );
    }

    // --- 3. Print summary -------------------------------------------------
    console.log(`✓ Master palette parsed (${colors.length} colors)`);
    console.log(formatPrintList(colors));

    // --- 4. Render + write preview.html (always) --------------------------
    // No meta/timestamp argument: the preview is byte-stable across runs.
    const html = buildPreviewHtml(colors);
    await fs.writeFile(PREVIEW_HTML, html, 'utf8');
    console.log(`✓ Preview HTML written to ${path.relative(PROJECT_ROOT, PREVIEW_HTML)}`);

    // --- 5. Render all theme contents (pure) ------------------------------
    // All four generators are pure (no I/O), so we can compute everything
    // up-front and feed the same strings to either the dry-run display or
    // the real write path below.
    const waybarContent  = buildWaybarTheme(tokens);
    const kittyContent   = buildKittyTheme(tokens);
    const wofiContent    = buildWofiStyle(tokens);
    const hyprlandBlock  = buildHyprlandColors(tokens);

    // --- Resolve target paths once so every branch uses the same ones ---
    const waybarThemeFile  = path.join(HOME, '.config', 'waybar', 'themes', 'nordic.css');
    const kittyThemeFile   = path.join(HOME, '.config', 'kitty', 'theme.conf');
    const kittyConfFile    = path.join(HOME, '.config', 'kitty', 'kitty.conf');
    const wofiStyleFile    = path.join(HOME, '.config', 'wofi', 'style.css');
    const hyprlandConfFile = path.join(HOME, '.config', 'hypr', 'hyprland.lua');

    // --- 6. Dry-run branch -----------------------------------------------
    // For each component we either show its would-be content (full file or
    // diff vs current) or a warning explaining why no write would happen.
    // The end of the run is the same "DRY RUN — no se escribió" sentinel.
    if (isDryRun) {
      console.log('');
      console.log('[DRY RUN] Componentes que se escribirían:');
      console.log('  1. ' + waybarThemeFile);
      console.log('  2. ' + kittyThemeFile);
      console.log('  3. ' + kittyConfFile + ' (migración one-shot, solo si NO está migrado)');
      console.log('  4. ' + wofiStyleFile + ' (full replacement)');
      console.log('  5. ' + hyprlandConfFile + ' (solo si markers presentes)');
      console.log('');

      // --- 1. Waybar ---
      console.log('--- 1. waybar nordic.css ---');
      console.log(waybarContent.replace(/\n$/, ''));
      console.log('');

      // --- 2. Kitty theme.conf ---
      console.log('--- 2. kitty theme.conf ---');
      console.log(kittyContent.replace(/\n$/, ''));
      console.log('');

      // --- 3. Kitty migration preview --------------------------------
      // Recreate the migrated kitty.conf in-memory so we can show its
      // diff without touching the file.
      const kittyAlreadyMigrated =
        (fsSync.existsSync(kittyThemeFile) || false) ||
        (fsSync.existsSync(kittyConfFile) &&
         fsSync.readFileSync(kittyConfFile, 'utf8').includes('include theme.conf'));
      console.log('--- 3. kitty kitty.conf (migración) ---');
      if (kittyAlreadyMigrated) {
        console.log('(ya migrado — se omitiría)');
      } else if (!fsSync.existsSync(kittyConfFile)) {
        console.log('(kitty.conf no existe — se omitiría)');
      } else {
        const before = fsSync.readFileSync(kittyConfFile, 'utf8');
        // Re-run the migration logic on a memory-only copy.
        const lines = before.split('\n').filter((line) => {
          const trimmed = line.trim();
          if (trimmed === '' || trimmed.startsWith('#')) return true;
          return !KITTY_COLOR_LINE_REGEX.test(trimmed);
        });
        let simulated = lines.join('\n');
        if (!simulated.endsWith('\n')) simulated += '\n';
        simulated += '\n# Color palette moved to theme.conf (auto-managed by palette/build.js)\ninclude theme.conf\n';
        const diff = generateDiff(before, simulated, 'kitty.conf');
        if (diff) {
          console.log(diff);
        } else {
          console.log('(no changes)');
        }
      }
      console.log('');

      // --- 4. Wofi ---
      console.log('--- 4. wofi style.css ---');
      console.log(wofiContent.replace(/\n$/, ''));
      console.log('');

      // --- 5. Hyprland marker replacement ---
      console.log('--- 5. hyprland.lua (marker block) ---');
      if (!fsSync.existsSync(hyprlandConfFile)) {
        console.log('(hyprland.lua no existe — se omitiría)');
      } else {
        const result = replaceMarkerBlock(
          hyprlandConfFile,
          '-- >>> NORDICOS PALETTE START >>>',
          '-- <<< NORDICOS PALETTE END <<<',
          hyprlandBlock
        );
        if (result === null) {
          console.log('⚠ Hyprland: markers no encontrados. Añádelos manualmente:');
          console.log('  -- >>> NORDICOS PALETTE START >>>');
          console.log('  ... (bloque col { ... } existente) ...');
          console.log('  -- <<< NORDICOS PALETTE END <<<');
          console.log('  Ver palette/README.md para instrucciones.');
        } else {
          const before = fsSync.readFileSync(hyprlandConfFile, 'utf8');
          const diff = generateDiff(before, result.newContent, 'hyprland.lua');
          if (diff) {
            console.log(diff);
          } else {
            console.log('(no changes)');
          }
        }
      }

      console.log('─'.repeat(60));
      console.log('DRY RUN — no se escribió a ~/.config/');
      return;
    }

    // --- 7. Real write path -----------------------------------------------
    // Each component gets its own backup-then-write block. Failures are
    // logged but do not abort subsequent components — preview.html is
    // already on disk and is the visible source of truth.

    // === 7a. Waybar ========================================================
    writeComponentWithBackup({
      label: 'waybar nordic.css',
      target: waybarThemeFile,
      content: waybarContent,
      backupDir: BACKUP_DIR,
    });

    // === 7b. Kitty migration (one-shot) ====================================
    // Detection runs BEFORE we write theme.conf — otherwise the existence
    // check on theme.conf would always pass (we just created it) and the
    // migration would be skipped on the very first run, leaving the user's
    // kitty.conf full of stale color lines that now conflict with theme.conf.
    //
    // Idempotency: if kitty.conf already contains `include theme.conf`,
    // a previous run already migrated it. Skip silently. migrateKittyConfig()
    // itself has a defensive idempotency check too.
    const kittyConfIncludes = fsSync.existsSync(kittyConfFile) &&
      fsSync.readFileSync(kittyConfFile, 'utf8').includes('include theme.conf');
    if (!kittyConfIncludes) {
      console.log('→ Migrating kitty.conf (one-time) ...');
      try {
        migrateKittyConfig();
      } catch (err) {
        console.error(`✗ Failed to migrate kitty.conf: ${err.message}`);
      }
    } else {
      console.log('(kitty.conf ya migrado — se omite)');
    }

    // === 7c. Kitty theme.conf ==============================================
    writeComponentWithBackup({
      label: 'kitty theme.conf',
      target: kittyThemeFile,
      content: kittyContent,
      backupDir: BACKUP_DIR,
    });

    // === 7d. Wofi (full replacement) =======================================
    writeComponentWithBackup({
      label: 'wofi style.css',
      target: wofiStyleFile,
      content: wofiContent,
      backupDir: BACKUP_DIR,
    });

    // === 7e. Hyprland (marker block) =======================================
    if (!fsSync.existsSync(hyprlandConfFile)) {
      console.log('ℹ hyprland.lua no existe — se omite (Hyprland no instalado?)');
    } else {
      const result = replaceMarkerBlock(
        hyprlandConfFile,
        '-- >>> NORDICOS PALETTE START >>>',
        '-- <<< NORDICOS PALETTE END <<<',
        hyprlandBlock
      );
      if (result === null) {
        // Markers not found: warn loudly with manual-setup instructions.
        // We never auto-inject markers — that's a user-driven decision.
        console.log('⚠ Hyprland: markers no encontrados. Añádelos manualmente:');
        console.log('  1. Abre ~/.config/hypr/hyprland.lua');
        console.log('  2. Localiza el bloque `col { ... }` (líneas ~101-104)');
        console.log('  3. Envuélvelo con markers:');
        console.log('       -- >>> NORDICOS PALETTE START >>>');
        console.log('       col { ... }');
        console.log('       -- <<< NORDICOS PALETTE END <<<');
        console.log('  Ver palette/README.md para más detalles.');
      } else {
        // Markers found: backup + atomic write + diff.
        //
        // shouldBackup / shouldWrite gate on byte-equality so repeated
        // `npm run build` invocations with no real change produce ZERO
        // side effects: no backup file, no mtime bump, no log noise.
        // This is the idempotency guarantee documented in STATE.md and is
        // what the upstream buildHyprlandColors newline-accumulation bug
        // (now fixed) was violating.
        let shouldBackup = false;
        const currentContent = fsSync.readFileSync(hyprlandConfFile, 'utf8');
        shouldBackup = (currentContent !== result.newContent);

        let backupPath = null;
        if (shouldBackup) {
          backupPath = backupFile(hyprlandConfFile, BACKUP_DIR);
          if (backupPath) {
            console.log(`✓ Backup saved: ${path.relative(PROJECT_ROOT, backupPath)}`);
          }
        } else {
          console.log('(no backup — contenido idéntico al actual)');
        }

        // Skip the atomic write when content is unchanged. atomicWrite uses
        // writeFileSync + renameSync, which bumps mtime even for an
        // identical payload — and `hyprctl reload`/userspace tools that
        // key off mtime would otherwise re-process unchanged configs.
        if (shouldBackup) {
          try {
            atomicWrite(hyprlandConfFile, result.newContent);
            console.log(`✓ Hyprland block replaced: ${hyprlandConfFile}`);
          } catch (err) {
            console.error(`✗ Failed to write hyprland.lua: ${err.message}`);
          }
        } else {
          console.log('(no write — contenido idéntico al actual)');
        }

        if (backupPath) {
          const oldContent = fsSync.readFileSync(backupPath, 'utf8');
          const diff = generateDiff(oldContent, result.newContent, 'hyprland.lua');
          if (diff) {
            console.log('Diff vs previous:');
            console.log(diff);
          } else {
            console.log('(no changes — contenido idéntico al anterior)');
          }
        }
      }
    }
  } catch (err) {
    // Re-throw with context; process will exit non-zero via the await below.
    console.error('✗ Build failed:', err.message);
    process.exitCode = 1;
  }
}

/* ============================================================================
 * writeComponentWithBackup({ label, target, content, backupDir })
 * ----------------------------------------------------------------------------
 * Standard "diff-aware backup + atomic write" flow shared by every component
 * whose target is a fully-replaced file (waybar theme, kitty theme.conf,
 * wofi style.css). Hyprland uses its own flow because the change is a
 * marker-block splice, not a full replacement.
 *
 * Behavior:
 *   - If the target file exists and differs from `content`, snapshot the
 *     existing file into `backupDir` BEFORE writing. Diff is shown after.
 *   - If the target file is byte-identical, log "no changes" and skip the
 *     backup to avoid flooding BACKUP_DIR with redundant copies.
 *   - If the target file doesn't exist yet (first run), log "first run"
 *     and proceed without a backup.
 *
 * Errors from atomicWrite are caught and logged but do not abort the
 * caller — the rest of the build pipeline is still useful.
 * ========================================================================== */
function writeComponentWithBackup({ label, target, content, backupDir }) {
  // Diff-aware gate: only snapshot AND only write when the on-disk content
  // would actually change. This keeps BACKUP_DIR meaningful (one snapshot
  // per state transition) AND keeps mtime stable across `npm run build`
  // invocations that produce no real change — the latter matters because
  // (a) `hyprctl reload`/userspace tools that key off mtime don't re-process
  // unchanged configs, and (b) backups don't accumulate redundant copies.
  // Renamed `shouldBackup` → `hasChanges` for accuracy now that the same
  // flag also gates the write.
  let hasChanges = true;
  if (fsSync.existsSync(target)) {
    const currentContent = fsSync.readFileSync(target, 'utf8');
    hasChanges = (currentContent !== content);
  }

  let backupPath = null;
  if (hasChanges) {
    backupPath = backupFile(target, backupDir);
    if (backupPath) {
      // Log the repo-relative path so the message stays short and copy/paste-safe.
      console.log(`✓ Backup saved: ${path.relative(PROJECT_ROOT, backupPath)}`);
    }
  } else if (fsSync.existsSync(target)) {
    console.log(`(no backup — contenido idéntico al actual: ${label})`);
  } else {
    console.log(`ℹ No existing ${label} — skipped backup (first run)`);
  }

  // Skip the atomic write when content is unchanged. atomicWrite uses
  // writeFileSync + renameSync, which bumps mtime even for an identical
  // payload — and downstream userspace tools (hyprctl reload, waybar's
  // inotify watcher, etc.) react to mtime changes, not content equality.
  if (hasChanges) {
    try {
      atomicWrite(target, content);
      console.log(`✓ ${label} written: ${target}`);
    } catch (err) {
      // Non-fatal: other components and preview.html may still succeed.
      console.error(`✗ Failed to write ${label}: ${err.message}`);
      return;
    }
  } else {
    console.log(`(no write — contenido idéntico al actual: ${label})`);
  }

  // Diff vs previous — only meaningful when we took a backup.
  if (backupPath) {
    const oldContent = fsSync.readFileSync(backupPath, 'utf8');
    const diff = generateDiff(oldContent, content, label);
    if (diff) {
      console.log('Diff vs previous:');
      console.log(diff);
    } else {
      console.log('(no changes — contenido idéntico al anterior)');
    }
  }
}

// Run main() only when invoked directly (allows require()-ing for tests later).
if (require.main === module) {
  main();
}

// Export internals so future phases / tests can reuse them.
module.exports = {
  parseMaster,
  buildPreviewHtml,
  buildWaybarTheme,
  buildKittyTheme,
  buildWofiStyle,
  buildHyprlandColors,
  migrateKittyConfig,
  replaceMarkerBlock,
  hexToRgba,
  hexToRgbaString,
  backupFile,
  atomicWrite,
  generateDiff,
  LINE_REGEX,
  HEX_REGEX,
  WAYBAR_MAPPING,
  KITTY_MAPPING,
  WOFI_MAPPING,
  KITTY_EXTRAS,
  KITTY_COLOR_LINE_REGEX,
};
