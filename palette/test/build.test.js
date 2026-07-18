/* ============================================================================
 * NordicOS — Palette Build Script Test Suite (Z.0)
 * ----------------------------------------------------------------------------
 * This suite covers the contract documented in docs/design-system.md against
 * the *current* implementation in palette/build.js. Every test here verifies
 * behavior that already exists; none project future functionality.
 *
 * Conventions:
 *   - Pure functions are tested directly. I/O-bound functions are tested via
 *     ephemeral fixtures inside `os.tmpdir()` with hard cleanup in `after()`
 *     + per-test `try/finally` so a failure mid-test cannot leak temp files.
 *   - The shared CANONICAL_TOKENS fixture is derived from palette/master.css
 *     so the tests stay in lock-step with the file the build actually reads.
 *
 * One minimal change was made to build.js: `escapeHtml` (previously internal)
 * was added to `module.exports` so its 5-entity mapping can be tested in
 * isolation. The function itself is unchanged. See the test below for the
 * justification comment.
 *
 * Run:  node --test palette/test/build.test.js
 * ========================================================================== */

'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const build = require('../build.js');
const {
  parseMaster,
  escapeHtml,            // see export note in build.js — added by Z.0 for testability
  buildPreviewHtml,
  buildWaybarTheme,
  buildKittyTheme,
  buildWofiStyle,
  buildHyprlandColors,
  buildHyprlandShadow,    // (A.1: shadow-color marker block — independent of PALETTE block)
  buildDunstConfig,      // (A.4: dunst is the 5th fully-generated destination)
  replaceMarkerBlock,
  hexToRgba,
  hexToRgbaString,
  hexToHyprlandNumber,   // (A.1: helper for shadow 0xAARRGGBB numeric form)
  atomicWrite,
  generateDiff,
  HEX_REGEX,
  WAYBAR_MAPPING,
  KITTY_MAPPING,
  WOFI_MAPPING,
  DUNST_MAPPING,         // (A.4: urgency_low/normal/critical → 3×{bg,fg,frame})
  FONT_STACK,            // (B.1: single source of truth for system font stack)
  KITTY_EXTRAS,
} = build;

// ---------------------------------------------------------------------------
// Canonical tokens — mirrors palette/master.css verbatim. Theme-renderer tests
// use this fixture so they exercise the real master.css → renderer pipeline.
// ---------------------------------------------------------------------------
const CANONICAL_TOKENS = Object.freeze({
  bg:           '#0b0f14',
  surface:      '#151c24',
  'surface-alt':'#1a2332',
  border:       '#3b556d',
  accent:       '#78c7ff',
  'accent-soft':'#a0d4ff',
  text:         '#d4dde3',
  'text-muted': '#8a9bab',
  success:      '#6fbf73',
  warning:      '#d89b3c',
  error:        '#b84c4c',
  shadow:       '#1a1a1a',  // (A.1: shadow de ventanas — alpha ee empaquetado por helper)
});

// ---------------------------------------------------------------------------
// tmpdir scaffolding — one root per test run, cleaned up at exit. Per-test
// fixtures use `freshDir(label)` to avoid name collisions when tests run in
// parallel.
// ---------------------------------------------------------------------------
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nordicos-test-'));
after(() => {
  try {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  } catch (_) {
    // best-effort — nothing actionable if cleanup itself fails
  }
});

function freshDir(label) {
  const dir = path.join(tmpRoot, `${label}-${crypto.randomBytes(6).toString('hex')}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function freshFile(label, dir, contents = '') {
  const filePath = path.join(dir, `${label}-${crypto.randomBytes(6).toString('hex')}.txt`);
  if (contents) fs.writeFileSync(filePath, contents, 'utf8');
  return filePath;
}

/** Best-effort check: does an executable live on PATH? (Used for conditional skip.) */
function commandExists(cmd) {
  const paths = (process.env.PATH || '').split(path.delimiter);
  for (const p of paths) {
    if (!p) continue;
    try {
      fs.accessSync(path.join(p, cmd), fs.constants.X_OK);
      return true;
    } catch (_) { /* continue */ }
  }
  return false;
}

// ===========================================================================
// 1. HEX_REGEX — strict 6-digit hex with leading '#'
// ===========================================================================
describe('HEX_REGEX', () => {
  it('accepts 6-digit hex with leading #', () => {
    assert.match('#0b0f14', HEX_REGEX);
    assert.match('#FFFFFF', HEX_REGEX);
    assert.match('#abcdef', HEX_REGEX);
  });

  it('accepts uppercase and lowercase variants', () => {
    assert.match('#aAbBcC', HEX_REGEX);
    assert.match('#AABBCC', HEX_REGEX);
    assert.match('#aabbcc', HEX_REGEX);
  });

  it('rejects 3-digit shorthand (e.g. #abc) — guarded separately by HEX_REGEX', () => {
    assert.doesNotMatch('#abc', HEX_REGEX);
    assert.doesNotMatch('#FFF', HEX_REGEX);
  });

  it('rejects hex without the leading #', () => {
    assert.doesNotMatch('0b0f14', HEX_REGEX);
  });

  it('rejects hex strings containing non-hex characters', () => {
    assert.doesNotMatch('#xyz789', HEX_REGEX);
    assert.doesNotMatch('#12345g', HEX_REGEX);
    assert.doesNotMatch('#hello!', HEX_REGEX);
  });

  it('rejects an empty string', () => {
    assert.doesNotMatch('', HEX_REGEX);
  });

  it('rejects hex with 7 or more digits (only 6 allowed)', () => {
    assert.doesNotMatch('#1234567', HEX_REGEX);
    assert.doesNotMatch('#12345678', HEX_REGEX);
  });
});

// ===========================================================================
// 2. parseMaster — @define-color line parser with structured warnings
// ===========================================================================
describe('parseMaster', () => {
  it('parses a valid line with a comment', () => {
    const css = '@define-color bg #0b0f14; /* fondo principal */';
    const { colors, tokens, warnings } = parseMaster(css);
    assert.equal(warnings.length, 0);
    assert.equal(colors.length, 1);
    assert.deepEqual(colors[0], { name: 'bg', value: '#0b0f14', comment: 'fondo principal' });
    assert.equal(tokens.bg, '#0b0f14');
  });

  it('parses a valid line without a trailing comment (comment === "")', () => {
    const css = '@define-color bg #0b0f14;';
    const { colors, tokens, warnings } = parseMaster(css);
    assert.equal(warnings.length, 0);
    assert.equal(colors.length, 1);
    assert.equal(colors[0].comment, '');
    assert.equal(tokens.bg, '#0b0f14');
  });

  it('ignores empty lines and pure comment lines (even if they mention @define-color in prose)', () => {
    const css = [
      '/* === HEADER === */',
      '',
      '/*',
      ' * Block comment spanning multiple lines mentioning',
      ' * the literal @define-color in prose.',
      ' */',
      '',
      '@define-color bg #0b0f14; /* bg */',
      '',
    ].join('\n');
    const { colors, warnings } = parseMaster(css);
    assert.equal(colors.length, 1, 'only the real declaration should be parsed');
    assert.equal(warnings.length, 0, 'pure-comment lines must not generate warnings');
  });

  it('ignores prose lines that mention tokens but do NOT contain @define-color', () => {
    const css = [
      'The bg color is a dark, foundry tone.',
      'See the surface entry for elevated panels.',
      '@define-color bg #0b0f14;',
    ].join('\n');
    const { colors, warnings } = parseMaster(css);
    assert.equal(colors.length, 1);
    assert.equal(warnings.length, 0);
  });

  it('emits a structured warning when @define-color value is not a hex literal (e.g. "red")', () => {
    const css = '@define-color bg red;';
    const { colors, warnings } = parseMaster(css);
    assert.equal(colors.length, 0);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].line, 1);
    assert.equal(warnings[0].content, '@define-color bg red;');
    assert.match(warnings[0].reason, /valor no es hex v.lido/);
    assert.match(warnings[0].reason, /red/);
  });

  it('emits a structured warning for #abc (3-digit shorthand — passes LINE_REGEX but fails HEX_REGEX, Bug #6)', () => {
    const css = '@define-color bg #abc;';
    const { colors, warnings } = parseMaster(css);
    assert.equal(colors.length, 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0].reason, /valor no es hex v.lido/);
    assert.match(warnings[0].reason, /#abc/);
  });

  it('preserves insertion order in colors[]', () => {
    const css = [
      '@define-color bg #0b0f14; /* first */',
      '@define-color surface #151c24; /* second */',
      '@define-color accent #78c7ff; /* third */',
    ].join('\n');
    const { colors } = parseMaster(css);
    assert.deepEqual(
      colors.map((c) => c.name),
      ['bg', 'surface', 'accent']
    );
  });

  it('preserves insertion order in tokens{} (string keys per ES2015)', () => {
    const css = [
      '@define-color bg #0b0f14;',
      '@define-color surface #151c24;',
      '@define-color accent #78c7ff;',
    ].join('\n');
    const { tokens } = parseMaster(css);
    assert.deepEqual(Object.keys(tokens), ['bg', 'surface', 'accent']);
  });

  it('builds a correct tokens lookup map (name → value)', () => {
    const css = '@define-color accent #78c7ff; /* ice */';
    const { tokens } = parseMaster(css);
    assert.equal(tokens.accent, '#78c7ff');
  });

  it('warns on a malformed line (missing trailing semicolon) instead of throwing', () => {
    const css = '@define-color bg #0b0f14';
    const { colors, warnings } = parseMaster(css);
    assert.equal(colors.length, 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0].reason, /valor no es hex v.lido/);
  });

  it('multi-line: parses every valid declaration and warns per malformed one', () => {
    const css = [
      '@define-color bg #0b0f14; /* bg */',            // valid
      '@define-color surface #151c24;',                  // valid, no comment
      '@define-color border not-a-hex;',                 // malformed → warn
      '@define-color accent #xyz789;',                   // malformed → warn
      '@define-color error #b84c4c; /* error */',        // valid
    ].join('\n');
    const { colors, warnings } = parseMaster(css);
    assert.equal(colors.length, 3, 'three valid declarations');
    assert.deepEqual(
      colors.map((c) => c.name),
      ['bg', 'surface', 'error']
    );
    assert.equal(warnings.length, 2, 'two warnings for malformed lines');
  });
});

// ===========================================================================
// 3. hexToRgba — converts 6-digit hex to CSS rgba(...) string
// ===========================================================================
describe('hexToRgba', () => {
  it('round-trip: #78c7ff @ 0.5 → rgba(120, 199, 255, 0.5)', () => {
    assert.equal(hexToRgba('#78c7ff', 0.5), 'rgba(120, 199, 255, 0.5)');
  });

  it('alpha 0 renders as "0" (not "0.0")', () => {
    assert.equal(hexToRgba('#78c7ff', 0), 'rgba(120, 199, 255, 0)');
  });

  it('alpha 1 renders as "1" (not "1.0")', () => {
    assert.equal(hexToRgba('#78c7ff', 1), 'rgba(120, 199, 255, 1)');
  });

  it('accepts uppercase hex input (case-insensitive)', () => {
    assert.equal(hexToRgba('#78C7FF', 0.5), 'rgba(120, 199, 255, 0.5)');
    assert.equal(hexToRgba('#AABBCC', 1), 'rgba(170, 187, 204, 1)');
  });

  it('passes malformed input through unchanged (no throw)', () => {
    assert.equal(hexToRgba('not-a-hex', 0.5), 'not-a-hex');
    assert.equal(hexToRgba('#xyz', 0.5), '#xyz');
    assert.equal(hexToRgba('', 0.5), '');
    assert.equal(hexToRgba('#abc', 0.5), '#abc'); // 3-digit fails the regex
  });

  it('palette case: #0b0f14 @ 0.5 → rgba(11, 15, 20, 0.5)', () => {
    assert.equal(hexToRgba('#0b0f14', 0.5), 'rgba(11, 15, 20, 0.5)');
  });
});

// ===========================================================================
// 4. hexToRgbaString — converts 6-digit hex to Hyprland rgba(8hex) notation
// ===========================================================================
describe('hexToRgbaString', () => {
  it('default alphaHex "ee" → rgba(78c7ffee)', () => {
    assert.equal(hexToRgbaString('#78c7ff'), 'rgba(78c7ffee)');
  });

  it('custom alphaHex "aa" on #3b556d → rgba(3b556daa)', () => {
    assert.equal(hexToRgbaString('#3b556d', 'aa'), 'rgba(3b556daa)');
  });

  it('alphaHex "00" produces fully transparent rgba(78c7ff00)', () => {
    assert.equal(hexToRgbaString('#78c7ff', '00'), 'rgba(78c7ff00)');
  });

  it('passes malformed input through unchanged (no throw)', () => {
    assert.equal(hexToRgbaString('not-a-hex', 'aa'), 'not-a-hex');
    assert.equal(hexToRgbaString('#xyz', 'aa'), '#xyz');
    assert.equal(hexToRgbaString('', 'aa'), '');
    assert.equal(hexToRgbaString('#abc', 'aa'), '#abc');
  });

  it('accepts uppercase hex input', () => {
    assert.equal(hexToRgbaString('#78C7FF', 'ee'), 'rgba(78c7ffee)');
    assert.equal(hexToRgbaString('#AABBCC', 'aa'), 'rgba(aabbccaa)');
  });
});

// ===========================================================================
// 5. escapeHtml — minimal HTML entity escaping for user-controlled strings
//
// NOTE: this function was internal to build.js until Z.0. Adding it to
// module.exports is a one-line change so its 5-entity mapping can be tested
// in isolation. The function itself is unchanged — same .replace() chain,
// same `&` first to avoid double-escaping. Documented in the export comment
// inside build.js.
// ===========================================================================
describe('escapeHtml', () => {
  it('escapes & to &amp; (must run first to avoid double-escaping later entities)', () => {
    assert.equal(escapeHtml('&'), '&amp;');
    assert.equal(escapeHtml('&lt;'), '&amp;lt;'); // & in input gets escaped, lt stays literal
  });

  it('escapes < to &lt;', () => {
    assert.equal(escapeHtml('<'), '&lt;');
  });

  it('escapes > to &gt;', () => {
    assert.equal(escapeHtml('>'), '&gt;');
  });

  it('escapes " to &quot;', () => {
    assert.equal(escapeHtml('"'), '&quot;');
  });

  it(`escapes ' to &#39;`, () => {
    assert.equal(escapeHtml("'"), '&#39;');
  });

  it('escapes a combined payload containing all five characters', () => {
    assert.equal(
      escapeHtml(`<a href="x" class='y'>&</a>`),
      '&lt;a href=&quot;x&quot; class=&#39;y&#39;&gt;&amp;&lt;/a&gt;'
    );
  });

  it('returns strings without special characters unchanged', () => {
    assert.equal(escapeHtml('plain-text'), 'plain-text');
    assert.equal(escapeHtml('color: red'), 'color: red');
    assert.equal(escapeHtml('accent'), 'accent');
    assert.equal(escapeHtml('hierro fundido'), 'hierro fundido');
  });

  it('coerces non-string input via String()', () => {
    assert.equal(escapeHtml(42), '42');
    assert.equal(escapeHtml(null), 'null');
    assert.equal(escapeHtml(undefined), 'undefined');
  });
});

// ===========================================================================
// 6. buildWaybarTheme — GTK CSS for Waybar with renames accent→ice, error→danger
// ===========================================================================
describe('buildWaybarTheme', () => {
  const out = buildWaybarTheme(CANONICAL_TOKENS);

  it('renames master `accent` to waybar `ice`', () => {
    assert.match(out, /@define-color\s+ice\s+#78c7ff;/);
  });

  it('renames master `accent-soft` to waybar `ice-soft`', () => {
    assert.match(out, /@define-color\s+ice-soft\s+#a0d4ff;/);
  });

  it('renames master `error` to waybar `danger`', () => {
    assert.match(out, /@define-color\s+danger\s+#b84c4c;/);
  });

  it('passes `bg` through unchanged (no rename)', () => {
    assert.match(out, /@define-color\s+bg\s+#0b0f14;/);
  });

  it('emits exactly 11 @define-color lines (one per canonical token)', () => {
    const matches = out.match(/@define-color/g) || [];
    assert.equal(matches.length, 11);
  });

  it('starts with the GENERATED FILE — DO NOT EDIT header', () => {
    assert.match(out, /GENERATED FILE — DO NOT EDIT/);
  });

  it('emits @define-color lines in WAYBAR_MAPPING order (stable diffs)', () => {
    // Strip the header (first 6 lines: 5 header comments + 1 blank), then
    // verify the @define-color line order matches WAYBAR_MAPPING values.
    const defineLines = out.split('\n').filter((l) => l.startsWith('@define-color'));
    const emittedNames = defineLines.map((l) => l.match(/@define-color\s+(\S+)/)[1]);
    const expected = Object.values(WAYBAR_MAPPING);
    assert.deepEqual(emittedNames, expected);
  });

  it('emits `accent` (master) only under the renamed name `ice`, not raw', () => {
    // Sanity check: the waybar-flavored name `accent` must NOT appear as a
    // @define-color target — only `ice` should.
    const defineLines = out.split('\n').filter((l) => l.startsWith('@define-color'));
    const waybarAccentLine = defineLines.find((l) => /@define-color\s+accent\s/.test(l));
    assert.equal(waybarAccentLine, undefined);
  });
});

// ===========================================================================
// 7. buildKittyTheme — ANSI palette (color0..15) + semantic top-level lines
// ===========================================================================
describe('buildKittyTheme', () => {
  const out = buildKittyTheme(CANONICAL_TOKENS);

  it('emits `background <hex>` from the `bg` token', () => {
    assert.match(out, /^background\s+#0b0f14/m);
  });

  it('emits `foreground <hex>` from the `text` token', () => {
    assert.match(out, /^foreground\s+#d4dde3/m);
  });

  it('emits all 16 ANSI directives (color0 through color15)', () => {
    for (let i = 0; i <= 15; i++) {
      assert.match(out, new RegExp(`^color${i}\\s+#`, 'm'), `missing color${i}`);
    }
  });

  it('emits KITTY_EXTRAS.magenta in the color5 slot', () => {
    const line = out.split('\n').find((l) => /^color5\s+/.test(l));
    assert.ok(line, 'color5 line not found');
    assert.match(line, /#8b7aa0/);
  });

  it('emits KITTY_EXTRAS.magentaBright in the color13 slot', () => {
    const line = out.split('\n').find((l) => /^color13\s+/.test(l));
    assert.ok(line, 'color13 line not found');
    assert.match(line, /#a898c8/);
  });

  it('emits KITTY_EXTRAS.brightWhite in the color15 slot', () => {
    const line = out.split('\n').find((l) => /^color15\s+/.test(l));
    assert.ok(line, 'color15 line not found');
    assert.match(line, /#ffffff/);
  });

  it('starts with the GENERATED FILE header', () => {
    assert.match(out, /GENERATED FILE — DO NOT EDIT/);
  });

  it('falls back to hardcoded hex when a token is missing (e.g. empty tokens {})', () => {
    const out2 = buildKittyTheme({});
    // bg defaults to #0b0f14
    assert.match(out2, /^background\s+#0b0f14/m);
    // foreground defaults to #d4dde3
    assert.match(out2, /^foreground\s+#d4dde3/m);
    // cursor defaults to #78c7ff (accent fallback)
    assert.match(out2, /^cursor\s+#78c7ff/m);
    // url_color defaults to #a0d4ff (accent-soft fallback)
    assert.match(out2, /^url_color\s+#a0d4ff/m);
  });
});

// ===========================================================================
// 8. buildWofiStyle — flat CSS for wofi with 4 alpha variants of accent
// ===========================================================================
describe('buildWofiStyle', () => {
  const out = buildWofiStyle(CANONICAL_TOKENS);

  it('emits the window { } selector with surface hex as background-color', () => {
    assert.match(out, /window\s*\{[^}]*background-color:\s*#151c24;/s);
  });

  it('emits a `2px solid <accent>` border on the window selector', () => {
    assert.match(out, /window\s*\{[^}]*border:\s*2px solid #78c7ff;/s);
  });

  it('emits all 4 alpha variants of accent: 0.06 / 0.10 / 0.15 / 0.30', () => {
    // `Number.prototype.toString()` strips trailing zeros, so 0.10 → "0.1"
    // and 0.30 → "0.3" in the output. The TEST reflects the ACTUAL contract,
    // not a "preferred" contract — this is documented JS behavior, the same
    // one documented by the 'alpha 0/1' test cases above.
    assert.match(out, /rgba\(120, 199, 255, 0\.06\)/, 'hover bg @ 0.06 (0.06 stays as-is)');
    assert.match(out, /rgba\(120, 199, 255, 0\.1\)/,  'inner shadow @ 0.10 (rendered as 0.1)');
    assert.match(out, /rgba\(120, 199, 255, 0\.15\)/, 'selected bg @ 0.15');
    assert.match(out, /rgba\(120, 199, 255, 0\.3\)/,  'hover border-left @ 0.30 (rendered as 0.3)');
  });

  it('emits #input { ... } with bg / text / border from the matching tokens', () => {
    const inputBlock = out.match(/#input\s*\{[\s\S]*?\}/);
    assert.ok(inputBlock, '#input block not found');
    assert.match(inputBlock[0], /background-color:\s*#0b0f14/);   // bg
    assert.match(inputBlock[0], /color:\s*#d4dde3/);              // text
    assert.match(inputBlock[0], /border:\s*1px solid #3b556d/);   // border
  });

  it('emits #entry:selected with rgba alpha-0.15 background', () => {
    assert.match(
      out,
      /#entry:selected\s*\{[^}]*background-color:\s*rgba\(120, 199, 255, 0\.15\)/s
    );
  });

  it('emits #entry:hover with rgba alpha-0.06 background', () => {
    assert.match(
      out,
      /#entry:hover\s*\{[^}]*background-color:\s*rgba\(120, 199, 255, 0\.06\)/s
    );
  });

  it('starts with the GENERATED FILE header', () => {
    assert.match(out, /GENERATED FILE — DO NOT EDIT/);
  });
});

// ===========================================================================
// 9. buildHyprlandColors — Lua block for `col = { ... }` inside general
//
// CRITICAL: guards against the six historical bugs documented in
// docs/design-system.md §4.4 (gradient-as-string, missing trailing comma,
// trailing-newline accumulation, etc.). Each test below pins one of them.
// ===========================================================================
describe('buildHyprlandColors', () => {
  // Run once; let any unexpected throw surface as a test failure rather than
  // being silently swallowed. ENOENT (no luac on host) is handled inside.
  const out = buildHyprlandColors(CANONICAL_TOKENS);

  it('does NOT end with a trailing newline (Bug #3 — prevents blank-line accumulation)', () => {
    assert.notEqual(out.slice(-1), '\n');
  });

  it('contains the table-form gradient marker `active_border   = { colors = {` (Bugs #1, #2)', () => {
    assert.match(out, /active_border\s+=\s\{\scolors\s=\s\{/);
  });

  it('contains `angle = 45 }` closing the gradient table', () => {
    assert.match(out, /angle\s*=\s*45\s*\}/);
  });

  it('contains `inactive_border = "rgba(` string-format marker (also a hexToRgbaString canary)', () => {
    assert.match(out, /inactive_border\s*=\s*"rgba\(/);
  });

  it('emits the closing `},` line for the col block (Bug #4 — required by surrounding general = { ... })', () => {
    // The col block's final line is literally `},`. Locate it via
    // structural anchor: it's the line directly before the empty separator
    // that precedes the end marker.
    const lines = out.split('\n');
    const endIdx = lines.indexOf('-- <<< NORDICOS PALETTE END <<<');
    assert.ok(endIdx > 1, 'end marker not found');
    assert.equal(lines[endIdx - 2], '},', 'expected `},` as the col block close');
  });

  it('starts with the start marker line', () => {
    assert.ok(out.startsWith('-- >>> NORDICOS PALETTE START >>>'));
  });

  it('ends with the end marker line (no trailing newline per Bug #3)', () => {
    assert.ok(out.endsWith('-- <<< NORDICOS PALETTE END <<<'));
  });

  it('contains the GENERATED — DO NOT EDIT MANUALLY comment', () => {
    assert.match(out, /-- GENERATED — DO NOT EDIT MANUALLY/);
  });

  it('uses hardcoded fallbacks when called with empty tokens {}', () => {
    const out2 = buildHyprlandColors({});
    // accent defaults to #78c7ff → activeStart = rgba(78c7ffee)
    assert.match(out2, /rgba\(78c7ffee\)/);
    // accent-soft defaults to #a0d4ff → activeEnd = rgba(a0d4ffee)
    assert.match(out2, /rgba\(a0d4ffee\)/);
    // border defaults to #3b556d → inactive = rgba(3b556daa)
    assert.match(out2, /rgba\(3b556daa\)/);
  });
});

describe('buildHyprlandColors — luac syntax check (only meaningful when luac is installed)', () => {
  it('produces a block that parses cleanly with `luac -p -`', { skip: !commandExists('luac') }, () => {
    // When luac IS installed, the block MUST pass `luac -p`. If it doesn't,
    // buildHyprlandColors throws — the test below asserts it doesn't.
    // Skipped on hosts without luac (function handles ENOENT gracefully).
    const out = buildHyprlandColors(CANONICAL_TOKENS);
    assert.ok(out.length > 0);
  });
});

// ===========================================================================
// 9b. buildHyprlandShadow — A.1: marker block for decoration.shadow.color
//
// This block lives INSIDE `decoration.shadow = { ... }` and emits ONLY the
// `color` field. It uses its OWN markers (SHADOW, not PALETTE) so the two
// blocks can evolve independently. The contract is narrower than the
// palette block — single assignment, no gradient, no string-form rgba.
// ===========================================================================
describe('buildHyprlandShadow', () => {
  const out = buildHyprlandShadow(CANONICAL_TOKENS);

  it('does NOT end with a trailing newline (idempotency contract — same as palette block)', () => {
    assert.notEqual(out.slice(-1), '\n');
  });

  it('starts with the SHADOW start marker (NOT the PALETTE one)', () => {
    assert.ok(out.startsWith('-- >>> NORDICOS SHADOW START >>>'));
    assert.ok(!out.startsWith('-- >>> NORDICOS PALETTE START >>>'));
  });

  it('ends with the SHADOW end marker (NOT the PALETTE one)', () => {
    assert.ok(out.endsWith('-- <<< NORDICOS SHADOW END <<<'));
    assert.ok(!out.endsWith('-- <<< NORDICOS PALETTE END <<<'));
  });

  it('emits `color = 0xee1a1a1a` with the canonical shadow token #1a1a1a + alpha ee', () => {
    assert.match(out, /color\s*=\s*0xee1a1a1a/);
  });

  it('does NOT contain string-form rgba(...) (must be the numeric 0x form)', () => {
    assert.doesNotMatch(out, /rgba\(/);
  });

  it('does NOT contain any of the user-owned shadow fields (range, render_power, enabled)', () => {
    assert.doesNotMatch(out, /range\s*=/);
    assert.doesNotMatch(out, /render_power\s*=/);
    assert.doesNotMatch(out, /enabled\s*=/);
  });

  it('contains the GENERATED — DO NOT EDIT MANUALLY comment', () => {
    assert.match(out, /-- GENERATED — DO NOT EDIT MANUALLY/);
  });

  it('uses the hardcoded fallback #1a1a1a when called with empty tokens {}', () => {
    const out2 = buildHyprlandShadow({});
    // Default fallback should still produce 0xee1a1a1a
    assert.match(out2, /color\s*=\s*0xee1a1a1a/);
  });

  it('changes the output when the shadow token changes', () => {
    const a = buildHyprlandShadow({ shadow: '#1a1a1a' });
    const b = buildHyprlandShadow({ shadow: '#222222' });
    assert.notEqual(a, b);
    assert.match(b, /0xee222222/);
  });

  it('is byte-stable across repeated calls (idempotent at the function level)', () => {
    const a = buildHyprlandShadow(CANONICAL_TOKENS);
    const b = buildHyprlandShadow(CANONICAL_TOKENS);
    assert.equal(a, b);
  });
});

describe('buildHyprlandShadow — luac syntax check (only meaningful when luac is installed)', () => {
  it('produces a block that parses cleanly with `luac -p -`', { skip: !commandExists('luac') }, () => {
    // buildHyprlandShadow throws if luac rejects the wrapped snippet;
    // reaching the next line means the syntax check passed.
    const out = buildHyprlandShadow(CANONICAL_TOKENS);
    assert.ok(out.length > 0);
  });
});

// ===========================================================================
// 9c. Marker independence — palette vs shadow blocks use distinct markers
//
// Critical: if either block accidentally used the other's markers,
// replaceMarkerBlock would splice them together and break both. Pinning
// the independence prevents silent cross-contamination.
// ===========================================================================
describe('Hyprland marker independence (palette vs shadow)', () => {
  const paletteBlock = buildHyprlandColors(CANONICAL_TOKENS);
  const shadowBlock  = buildHyprlandShadow(CANONICAL_TOKENS);

  it('palette block carries PALETTE markers and NOT SHADOW markers', () => {
    assert.ok(paletteBlock.includes('-- >>> NORDICOS PALETTE START >>>'));
    assert.ok(paletteBlock.includes('-- <<< NORDICOS PALETTE END <<<'));
    assert.ok(!paletteBlock.includes('-- >>> NORDICOS SHADOW START >>>'),
      'palette block NO debe contener shadow start marker');
    assert.ok(!paletteBlock.includes('-- <<< NORDICOS SHADOW END <<<'),
      'palette block NO debe contener shadow end marker');
  });

  it('shadow block carries SHADOW markers and NOT PALETTE markers', () => {
    assert.ok(shadowBlock.includes('-- >>> NORDICOS SHADOW START >>>'));
    assert.ok(shadowBlock.includes('-- <<< NORDICOS SHADOW END <<<'));
    assert.ok(!shadowBlock.includes('-- >>> NORDICOS PALETTE START >>>'),
      'shadow block NO debe contener palette start marker');
    assert.ok(!shadowBlock.includes('-- <<< NORDICOS PALETTE END <<<'),
      'shadow block NO debe contener palette end marker');
  });
});

// ===========================================================================
// 9d. hexToHyprlandNumber — A.1: helper that converts #RRGGBB + alphaHex
// to the JS number representing the 0xAARRGGBB value Hyprland's Lua bridge
// accepts for numeric color properties like decoration.shadow.color.
// ===========================================================================
describe('hexToHyprlandNumber', () => {
  it('convierte #1a1a1a + ee a 0xee1a1a1a (como número JS)', () => {
    assert.equal(hexToHyprlandNumber('#1a1a1a', 'ee'), 0xee1a1a1a);
  });

  it('acepta alpha default ee', () => {
    assert.equal(hexToHyprlandNumber('#1a1a1a'), 0xee1a1a1a);
  });

  it('convierte #3b556d + aa a 0xaa3b556d', () => {
    assert.equal(hexToHyprlandNumber('#3b556d', 'aa'), 0xaa3b556d);
  });

  it('retorna un número (no string, no rgba)', () => {
    const result = hexToHyprlandNumber('#1a1a1a', 'ee');
    assert.equal(typeof result, 'number');
    assert.ok(!String(result).includes('rgba'));
  });

  it('alpha 00 produce 0x00rrggbb', () => {
    assert.equal(hexToHyprlandNumber('#ffffff', '00'), 0x00ffffff);
  });

  it('passthrough en hex malformado (mismo contrato que hexToRgba*)', () => {
    assert.equal(hexToHyprlandNumber('not-a-hex', 'ee'), 'not-a-hex');
    assert.equal(hexToHyprlandNumber('#abc', 'ee'), '#abc');  // 3 dígitos no válidos
    assert.equal(hexToHyprlandNumber('', 'ee'), '');          // string vacía
  });

  it('mayúsculas y minúsculas son equivalentes', () => {
    assert.equal(hexToHyprlandNumber('#1A1A1A', 'EE'), 0xee1a1a1a);
    assert.equal(hexToHyprlandNumber('#1a1a1a', 'ee'), 0xee1a1a1a);
    assert.equal(hexToHyprlandNumber('#AaBbCc', 'Ff'), 0xffaabbcc);
  });

  it('preserva ceros a la izquierda en el alpha (padStart a 2 dígitos)', () => {
    // alphaHex "0e" debe producir 0x0e..., NO 0xe... (que sería solo 7 chars)
    assert.equal(hexToHyprlandNumber('#1a1a1a', '0e'), 0x0e1a1a1a);
  });
});

// ===========================================================================
// 10. replaceMarkerBlock — splice [startMarker, endMarker] with newContent
// ===========================================================================
describe('replaceMarkerBlock', () => {
  it('returns null when the target file does not exist', () => {
    const dir = freshDir('rmb');
    const missing = path.join(dir, 'does-not-exist.txt');
    const res = replaceMarkerBlock(missing, '>>>>> START >>>>>', '<<<<< END <<<<<', 'NEW');
    assert.equal(res, null);
  });

  it('returns null when the start marker is missing from the file', () => {
    const dir = freshDir('rmb');
    const f = freshFile(
      'rmb',
      dir,
      'before\nNO START HERE\nmiddle\n<<<<< END <<<<<\nafter\n'
    );
    const res = replaceMarkerBlock(f, '>>>>> START >>>>>', '<<<<< END <<<<<', 'NEW');
    assert.equal(res, null);
  });

  it('returns null when the end marker is missing from the file', () => {
    const dir = freshDir('rmb');
    const f = freshFile(
      'rmb',
      dir,
      'before\n>>>>> START >>>>>\nNO END HERE\nafter\n'
    );
    const res = replaceMarkerBlock(f, '>>>>> START >>>>>', '<<<<< END <<<<<', 'NEW');
    assert.equal(res, null);
  });

  it('returns null when the end marker appears strictly BEFORE the start marker', () => {
    // Only the pre-start end marker exists; indexOf(end, searchFrom) finds
    // nothing after the start → returns null. This is the contract documented
    // as Bug #5 — a stray end marker upstream must NOT cause a wrong splice.
    const dir = freshDir('rmb');
    const body = [
      'before',
      '<<<<< END <<<<<',          // end before start
      '>>>>> START >>>>>',          // start here
      'inner',
    ].join('\n');
    const f = freshFile('rmb', dir, body);
    const res = replaceMarkerBlock(f, '>>>>> START >>>>>', '<<<<< END <<<<<', 'NEW');
    assert.equal(res, null);
  });

  it('replaces the block correctly when both markers exist and newContent differs', () => {
    const dir = freshDir('rmb');
    const body = [
      'header line 1',
      'header line 2',
      '>>>>> START >>>>>',
      'OLD INNER CONTENT',
      '<<<<< END <<<<<',
      'footer line',
    ].join('\n');
    const f = freshFile('rmb', dir, body);
    const res = replaceMarkerBlock(f, '>>>>> START >>>>>', '<<<<< END <<<<<', 'NEW INNER');
    assert.ok(res);
    assert.equal(res.replaced, true);
    assert.match(res.newContent, /header line 1/);
    assert.match(res.newContent, /header line 2/);
    assert.match(res.newContent, /NEW INNER/);
    assert.match(res.newContent, /footer line/);
    assert.doesNotMatch(res.newContent, /OLD INNER CONTENT/);
  });

  it('returns oldBlock including both markers (caller can diff / log it)', () => {
    const dir = freshDir('rmb');
    const body = 'A\n>>>>> START >>>>>\nOLD\n<<<<< END <<<<<\nB\n';
    const f = freshFile('rmb', dir, body);
    const res = replaceMarkerBlock(f, '>>>>> START >>>>>', '<<<<< END <<<<<', 'NEW');
    assert.ok(res);
    assert.match(res.oldBlock, />>>>> START >>>>>/);
    assert.match(res.oldBlock, /<<<<< END <<<<</);
    assert.match(res.oldBlock, /OLD/);
  });

  it('returned newContent = original-before + newContent + original-after (exact splice)', () => {
    const dir = freshDir('rmb');
    const body = 'BEFORE\n>>>>> START >>>>>\nOLD\n<<<<< END <<<<<\nAFTER\n';
    const f = freshFile('rmb', dir, body);
    const res = replaceMarkerBlock(f, '>>>>> START >>>>>', '<<<<< END <<<<<', 'NEW');
    assert.ok(res);
    const expected = 'BEFORE\nNEW\nAFTER\n';
    assert.equal(res.newContent, expected);
  });

  it('does NOT touch the file on disk (pure read)', () => {
    // Per the contract: `replaceMarkerBlock` returns the updated content; the
    // caller (main()) decides when to write. Verifying that lets future
    // readers know the responsibility boundary stays in one place.
    const dir = freshDir('rmb');
    const body = 'before\n>>>>> START >>>>>\nOLD\n<<<<< END <<<<<\nafter\n';
    const f = freshFile('rmb', dir, body);
    replaceMarkerBlock(f, '>>>>> START >>>>>', '<<<<< END <<<<<', 'NEW');
    assert.equal(fs.readFileSync(f, 'utf8'), body);
  });
});

// ===========================================================================
// 11. atomicWrite — POSIX-atomic write via .tmp + rename
// ===========================================================================
describe('atomicWrite', () => {
  it('creates a file with the exact content passed', () => {
    const dir = freshDir('aw');
    const f = path.join(dir, 'out.txt');
    atomicWrite(f, 'hello world\n');
    assert.equal(fs.readFileSync(f, 'utf8'), 'hello world\n');
  });

  it('creates nested parent directories that do not yet exist', () => {
    const dir = freshDir('aw');
    const nested = path.join(dir, 'a', 'b', 'c', 'out.txt');
    atomicWrite(nested, 'nested\n');
    assert.equal(fs.readFileSync(nested, 'utf8'), 'nested\n');
    // Sanity: the parent chain exists.
    assert.equal(fs.existsSync(path.dirname(nested)), true);
  });

  it('overwrites an existing file with new content', () => {
    const dir = freshDir('aw');
    const f = path.join(dir, 'out.txt');
    atomicWrite(f, 'first\n');
    atomicWrite(f, 'second\n');
    assert.equal(fs.readFileSync(f, 'utf8'), 'second\n');
  });

  it('does not leave a .tmp file behind on success (POSIX-atomic rename)', () => {
    const dir = freshDir('aw');
    const f = path.join(dir, 'out.txt');
    atomicWrite(f, 'data\n');
    assert.equal(fs.existsSync(f + '.tmp'), false, '.tmp residual found after success');
  });

  it('writes UTF-8 content byte-for-byte (including multibyte chars)', () => {
    const dir = freshDir('aw');
    const f = path.join(dir, 'out.txt');
    const payload = 'línea con tildes — ñoño — ✓ — русский\n';
    atomicWrite(f, payload);
    assert.equal(fs.readFileSync(f, 'utf8'), payload);
  });
});

// ===========================================================================
// 12. generateDiff — unified-style LCS diff with ` ` / `-` / `+` line prefixes
// ===========================================================================
describe('generateDiff', () => {
  it('returns null when oldContent === newContent (byte-identical)', () => {
    const res = generateDiff('same\n', 'same\n', 'file.conf');
    assert.equal(res, null);
  });

  it('returns null when both oldContent and newContent are empty strings', () => {
    const res = generateDiff('', '', 'file.conf');
    assert.equal(res, null);
  });

  it('starts with `--- <fileLabel> (previous)` when there are differences', () => {
    const res = generateDiff('a\n', 'b\n', 'my-file.conf');
    assert.ok(res);
    assert.match(res, /^--- my-file\.conf \(previous\)/m);
  });

  it('contains `+++ <fileLabel> (new)` when there are differences', () => {
    const res = generateDiff('a\n', 'b\n', 'my-file.conf');
    assert.ok(res);
    assert.match(res, /\+\+\+ my-file\.conf \(new\)/);
  });

  it('unchanged lines carry a leading single space (glued to content)', () => {
    // Contract: prefix is always a SINGLE character (' '/'-'/'+') glued to
    // the content with no trailing space. So an unchanged line is ` a`,
    // not ` a `.
    const res = generateDiff('a\nx\nc\n', 'a\ny\nc\n', 'f');
    assert.ok(res);
    assert.match(res, / a(\n|$)/);
    assert.match(res, / c(\n|$)/);
  });

  it('removed lines carry a leading `-` (NO space between `-` and the content)', () => {
    // Documented contract: ops = [' ' + line, '-' + line, '+' + line]. The
    // single-char prefix is glued to the line text without a trailing space —
    // this differs from classic `diff -u` output but is what the function
    // actually emits (verified empirically). Test pins the current contract.
    const res = generateDiff('a\nb\nc\n', 'a\nc\n', 'f');
    assert.ok(res);
    assert.match(res, /^-b$/m);
  });

  it('added lines carry a leading `+` (NO space between `+` and the content)', () => {
    const res = generateDiff('a\nc\n', 'a\nb\nc\n', 'f');
    assert.ok(res);
    assert.match(res, /^\+b$/m);
  });

  it('unchanged lines carry a leading single space (glued, NO trailing space)', () => {
    // Same contract as `-`/`+`: the prefix is glued to the content. Verify
    // both that ` a` matches AND that ` a ` (with trailing space) does NOT.
    const res = generateDiff('a\nx\nc\n', 'a\nx\nc\n'.replace('x', 'y'), 'f');
    assert.match(res, /^ a$/m);
    assert.doesNotMatch(res, /^ a /m);
  });

  it('all-added case (old === "") generates only `+` data lines, no `-` data lines', () => {
    const res = generateDiff('', 'line1\nline2\n', 'f');
    assert.ok(res);
    // Positive: each line is emitted as a `+` data marker.
    assert.match(res, /^\+line1$/m);
    assert.match(res, /^\+line2$/m);
    // Negative: no `-` data markers at all (the `--- f (previous)` header is
    // excluded by requiring `[a-z]` immediately after the `-`, which the
    // header's `---` does not satisfy).
    assert.doesNotMatch(res, /^-[a-z]/m);
  });

  it('all-deleted case (new === "") generates only `-` data lines, no `+` data lines', () => {
    const res = generateDiff('line1\nline2\n', '', 'f');
    assert.ok(res);
    assert.match(res, /^-line1$/m);
    assert.match(res, /^-line2$/m);
    // Negative: no `+` data markers (the `+++ f (new)` header is excluded
    // by requiring `[a-z]` after `+`).
    assert.doesNotMatch(res, /^\+[a-z]/m);
  });
});

// ===========================================================================
// 13. WAYBAR_MAPPING — single source of truth for accent→ice, error→danger
// ===========================================================================
describe('WAYBAR_MAPPING', () => {
  it('has exactly 11 keys (one per canonical token)', () => {
    assert.equal(Object.keys(WAYBAR_MAPPING).length, 11);
  });

  it('contains every expected master-token key', () => {
    const expected = [
      'bg', 'surface', 'surface-alt', 'border',
      'accent', 'accent-soft',
      'success', 'warning', 'error',
      'text', 'text-muted',
    ];
    for (const key of expected) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(WAYBAR_MAPPING, key),
        `missing key: ${key}`
      );
    }
  });

  it('renames master `accent` to waybar `ice` (active rename)', () => {
    assert.equal(WAYBAR_MAPPING.accent, 'ice');
  });

  it('renames master `accent-soft` to waybar `ice-soft`', () => {
    assert.equal(WAYBAR_MAPPING['accent-soft'], 'ice-soft');
  });

  it('renames master `error` to waybar `danger` (active rename)', () => {
    assert.equal(WAYBAR_MAPPING.error, 'danger');
  });
});

// ===========================================================================
// 14. KITTY_MAPPING — 1-to-1 master-token → kitty-flavored name
// ===========================================================================
describe('KITTY_MAPPING', () => {
  it('has exactly 11 keys', () => {
    assert.equal(Object.keys(KITTY_MAPPING).length, 11);
  });

  it('contains every expected master-token key', () => {
    const expected = [
      'bg', 'surface', 'surface-alt', 'border',
      'accent', 'accent-soft',
      'text', 'text-muted',
      'success', 'warning', 'error',
    ];
    for (const key of expected) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(KITTY_MAPPING, key),
        `missing key: ${key}`
      );
    }
  });

  it('all mappings are 1-to-1 (no renames — kitty uses master names verbatim)', () => {
    for (const [master, kitty] of Object.entries(KITTY_MAPPING)) {
      assert.equal(master, kitty, `non-1:1 mapping at ${master} → ${kitty}`);
    }
  });
});

// ===========================================================================
// 15. WOFI_MAPPING — 1-to-1 master-token → wofi semantic role
// ===========================================================================
describe('WOFI_MAPPING', () => {
  it('contains surface, accent, bg, text, border, text-muted', () => {
    for (const key of ['surface', 'accent', 'bg', 'text', 'border', 'text-muted']) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(WOFI_MAPPING, key),
        `missing key: ${key}`
      );
    }
  });

  it('all mappings are 1-to-1 (no renames)', () => {
    for (const [master, wofi] of Object.entries(WOFI_MAPPING)) {
      assert.equal(master, wofi, `non-1:1 mapping at ${master} → ${wofi}`);
    }
  });
});

// ===========================================================================
// 16. KITTY_EXTRAS — 3 ANSI-only colors living outside master.css
// ===========================================================================
describe('KITTY_EXTRAS', () => {
  it('has magenta, magentaBright, and brightWhite', () => {
    assert.ok('magenta' in KITTY_EXTRAS, 'magenta missing');
    assert.ok('magentaBright' in KITTY_EXTRAS, 'magentaBright missing');
    assert.ok('brightWhite' in KITTY_EXTRAS, 'brightWhite missing');
  });

  it('every value is a 6-digit hex with leading # that passes HEX_REGEX', () => {
    assert.match(KITTY_EXTRAS.magenta, HEX_REGEX);
    assert.match(KITTY_EXTRAS.magentaBright, HEX_REGEX);
    assert.match(KITTY_EXTRAS.brightWhite, HEX_REGEX);
  });

  it('has only the three documented extras (no surprise entries)', () => {
    assert.deepEqual(
      Object.keys(KITTY_EXTRAS).sort(),
      ['brightWhite', 'magenta', 'magentaBright']
    );
  });
});

// ===========================================================================
// 17. buildPreviewHtml — self-contained HTML preview page (optional but valuable)
// ===========================================================================
describe('buildPreviewHtml', () => {
  const canonicalColors = [
    { name: 'bg',      value: '#0b0f14', comment: 'hierro fundido' },
    { name: 'accent',  value: '#78c7ff', comment: 'hielo glaciar' },
  ];
  const out = buildPreviewHtml(canonicalColors);

  it('emits a full HTML document starting with <!doctype html>', () => {
    assert.match(out, /^<!doctype html>/i);
  });

  it('emits a <title> element', () => {
    assert.match(out, /<title>[^<]+<\/title>/);
  });

  it('emits one card per color containing the color name and hex', () => {
    assert.match(out, /<h3>bg<\/h3>/);
    assert.match(out, /<h3>accent<\/h3>/);
    assert.match(out, /<code>#0b0f14<\/code>/);
    assert.match(out, /<code>#78c7ff<\/code>/);
  });

  it('uses escapeHtml for color names — characters like & < > " \' get escaped', () => {
    // Inject a color whose name contains every entity escape target. The
    // rendered HTML must escape them — otherwise escaping logic regressions
    // (e.g. escaping &amp; after other entities) slip into the preview.
    const evil = [{ name: 'a&b<c>d"e\'f', value: '#123456', comment: 'safe' }];
    const out2 = buildPreviewHtml(evil);
    assert.match(out2, /<h3>a&amp;b&lt;c&gt;d&quot;e&#39;f<\/h3>/);
  });

  it('contains inline CSS in a <style> element (no external assets)', () => {
    assert.match(out, /<style>[\s\S]+<\/style>/);
  });

  it('declares every palette token as a CSS variable in :root (using fallback when absent from colors[])', () => {
    // The :root block declares ALL 11 tokens with the value from `tokens`
    // (which itself uses sane fallbacks like `#111` for missing colors).
    // We assert every token's --<name>: declaration is present in :root.
    for (const name of Object.keys(CANONICAL_TOKENS)) {
      assert.match(
        out,
        new RegExp(`--${name.replace('-', '-')}:\\s*#`),
        `expected --${name}: declaration in :root`
      );
    }
  });

  it('renders the actual hex value when the color is present in colors[] (bg → #0b0f14)', () => {
    // When the color is explicitly passed, the actual hex is emitted (not
    // the fallback). Pin the bg case end-to-end.
    assert.match(out, /--bg:\s*#0b0f14\s*;/);
    assert.match(out, /--accent:\s*#78c7ff\s*;/);
    // And the fallback for a token NOT in colors[] is `#111` for surface:
    assert.match(out, /--surface:\s*#111\s*;/);
  });
});

// ===========================================================================
// 18. buildDunstConfig — full dunstrc file (header + [global] + [urgency_*])
//
// A.4 SPEC:
//   - 5th fully-generated destination, joining waybar/kitty/wofi/hyprland.
//   - Pure function: takes tokens map, returns full file string.
//   - [global] redeclares curated upstream defaults (NOT omitted — Dunst
//     does not merge system + user configs).
//   - [urgency_low], [urgency_normal], [urgency_critical] each emit the
//     3 directives Dunst accepts (background, foreground, frame_color)
//     populated from DUNST_MAPPING → master tokens.
//
// The tests below pin the contract end-to-end:
//   1. Structural assertions (header, 3 sections, 3 directives each)
//   2. Token-resolution assertions (each urgency section maps to its
//      declared master tokens, no cross-talk)
//   3. [global] preservation (upstream defaults survive verbatim)
//   4. Fallback assertions (empty tokens → sane hardcoded hex)
//   5. DUNST_MAPPING integrity (shape, key count, token names exist in
//      canonical palette)
// ===========================================================================
describe('buildDunstConfig', () => {
  // Run once per describe for the canonical-tokens cases. Tests that need
  // a different input (e.g. empty tokens) build their own output locally.
  const out = buildDunstConfig(CANONICAL_TOKENS);

  it('starts with the GENERATED FILE — DO NOT EDIT header', () => {
    assert.match(out, /^# GENERATED FILE — DO NOT EDIT/m);
  });

  it('emits a [global] section header', () => {
    assert.match(out, /^\[global\]$/m);
  });

  it('emits exactly three [urgency_*] sections in DUNST_MAPPING order', () => {
    const urgencySections = out.match(/^\[urgency_\w+\]$/gm) || [];
    assert.equal(urgencySections.length, 3, 'expected exactly 3 urgency sections');
    assert.deepEqual(urgencySections, [
      '[urgency_low]',
      '[urgency_normal]',
      '[urgency_critical]',
    ]);
  });

  it('emits the three required directives (background, foreground, frame_color) inside every urgency section', () => {
    // For each urgency section, verify all 3 directives are present in the
    // contiguous block until the next section header (or EOF).
    const expectedUrgencies = ['urgency_low', 'urgency_normal', 'urgency_critical'];
    for (const urgency of expectedUrgencies) {
      // Slice from the section header to the next [section] or EOF, so the
      // regex matches directives INSIDE this section, not in a later one.
      const startIdx = out.indexOf(`[${urgency}]`);
      assert.notEqual(startIdx, -1, `missing [${urgency}] section`);
      // Find the start of the NEXT [..] section, or end of file.
      const afterHeader = startIdx + `[${urgency}]`.length;
      const nextSectionIdx = out.slice(afterHeader).search(/^\[/m);
      const block = nextSectionIdx === -1
        ? out.slice(afterHeader)
        : out.slice(afterHeader, afterHeader + nextSectionIdx);
      assert.match(block, /^\s+background\s+=\s+"#\w{6}"\s*$/m, `${urgency} missing background`);
      assert.match(block, /^\s+foreground\s+=\s+"#\w{6}"\s*$/m, `${urgency} missing foreground`);
      assert.match(block, /^\s+frame_color\s+=\s+"#\w{6}"\s*$/m, `${urgency} missing frame_color`);
    }
  });

  it('maps urgency_low → surface (bg) + text-muted (fg) + border (frame)', () => {
    // The mapping is documented in DUNST_MAPPING; verify it survived the
    // round-trip from token names → hex values.
    const block = sliceUrgency(out, 'urgency_low');
    assert.match(block, /background\s+=\s+"#151c24"/, 'urgency_low bg should be surface #151c24');
    assert.match(block, /foreground\s+=\s+"#8a9bab"/, 'urgency_low fg should be text-muted #8a9bab');
    assert.match(block, /frame_color\s+=\s+"#3b556d"/, 'urgency_low frame should be border #3b556d');
  });

  it('maps urgency_normal → surface (bg) + text (fg) + accent (frame)', () => {
    const block = sliceUrgency(out, 'urgency_normal');
    assert.match(block, /background\s+=\s+"#151c24"/, 'urgency_normal bg should be surface #151c24');
    assert.match(block, /foreground\s+=\s+"#d4dde3"/, 'urgency_normal fg should be text #d4dde3');
    assert.match(block, /frame_color\s+=\s+"#78c7ff"/, 'urgency_normal frame should be accent #78c7ff');
  });

  it('maps urgency_critical → surface (bg) + error (fg) + error (frame)', () => {
    const block = sliceUrgency(out, 'urgency_critical');
    assert.match(block, /background\s+=\s+"#151c24"/, 'urgency_critical bg should be surface #151c24');
    assert.match(block, /foreground\s+=\s+"#b84c4c"/, 'urgency_critical fg should be error #b84c4c');
    assert.match(block, /frame_color\s+=\s+"#b84c4c"/, 'urgency_critical frame should be error #b84c4c');
  });

  it('every emitted hex value matches a token from the canonical palette (no hardcoded leaks)', () => {
    // Collect every quoted hex inside urgency_* sections and verify each one
    // is the value of a canonical token. This is the "no hardcoded colors in
    // the generated file" assertion from the A.4 spec.
    const canonicalHex = new Set(Object.values(CANONICAL_TOKENS));
    const hexRegex = /"#([0-9a-fA-F]{6})"/g;
    let m;
    while ((m = hexRegex.exec(out)) !== null) {
      const hex = '#' + m[1].toLowerCase();
      assert.ok(
        canonicalHex.has(hex),
        `generated file contains non-palette hex ${hex} — token-resolution leak?`
      );
    }
  });

  it('[global] preserves curated upstream defaults verbatim', () => {
    // The 9 curated [global] keys must appear with their EXACT upstream
    // values. If any of these regress, Dunst's behavior will change
    // (different format / alignment / mouse bindings / sort order).
    //
    // EXCEPTION: `follow` is intentionally set to `keyboard` instead of the
    // upstream default `none`. Rationale: on this multi-monitor Hyprland
    // host, `monitor = 0` (Dunst's fallback when [global] omits `monitor`)
    // binds to HDMI-A-1 (the first wl_output in the registry, workspace 2),
    // so `follow = none` causes every notification — regardless of where the
    // user clicks — to land on workspace 2. `follow = keyboard` routes each
    // notification to the monitor with keyboard focus, i.e. the active
    // workspace. See build.js header comment for buildDunstConfig.
    const globalBlock = out.slice(out.indexOf('[global]'), out.indexOf('[urgency_low]'));
    // The format string uses '\n' in source which renders as a literal
    // backslash-n in INI; Dunst's parser expands it to a newline at render
    // time. We pin the on-disk bytes here, which is what writeComponentWithBackup
    // sees for idempotency.
    assert.match(globalBlock, /format\s+=\s+"<b>%s<\/b>\\n%b"/);
    assert.match(globalBlock, /^\s+sort\s+=\s+yes\s*$/m);
    assert.match(globalBlock, /^\s+alignment\s+=\s+left\s*$/m);
    assert.match(globalBlock, /^\s+vertical_alignment\s+=\s+center\s*$/m);
    assert.match(globalBlock, /^\s+follow\s+=\s+keyboard\s*$/m);
    assert.match(globalBlock, /^\s+mouse_left_click\s+=\s+close_current\s*$/m);
    assert.match(globalBlock, /^\s+mouse_middle_click\s+=\s+do_action, close_current\s*$/m);
    assert.match(globalBlock, /^\s+mouse_right_click\s+=\s+close_all\s*$/m);
    assert.match(globalBlock, /^\s+transparency\s+=\s+0\s*$/m);
  });

  it('uses 4-space indentation inside every section (matches upstream dunstrc style)', () => {
    // The directive lines in both [global] and [urgency_*] sections must
    // start with exactly 4 spaces of indent. Catches accidental tabs / 2-space
    // regressions that would still parse but look out of place next to a
    // stock dunstrc.
    const directiveLines = out.split('\n').filter((l) =>
      /^\s+(background|foreground|frame_color|format|sort|alignment|vertical_alignment|follow|mouse_left_click|mouse_middle_click|mouse_right_click|transparency)\s+=/.test(l)
    );
    assert.ok(directiveLines.length >= 12, 'expected at least 12 directive lines (3 urgencies × 3 + 9 global)');
    for (const line of directiveLines) {
      // Either 4-space or 8-space indent is acceptable (a section inside a
      // hypothetical wrapper) — but at minimum, no tab characters.
      assert.doesNotMatch(line, /\t/, `directive line contains a tab: ${line}`);
      // The first non-whitespace character must come after 4 or more spaces.
      const leadingWs = line.match(/^(\s*)/)[1];
      assert.ok(
        leadingWs.length === 4 || leadingWs.length >= 8,
        `unexpected indent width ${leadingWs.length} on: ${line}`
      );
    }
  });

  it('falls back to hardcoded hex when called with empty tokens {}', () => {
    // Same defensive posture as buildKittyTheme / buildHyprlandColors: a
    // missing token must NOT produce an invalid hex literal (Dunst would
    // silently ignore broken quotes anyway, but staying permissive avoids
    // cascading errors from a malformed master.css).
    const out2 = buildDunstConfig({});
    // All three sections collapse to the surface/text/border fallback:
    assert.match(out2, /background\s+=\s+"#151c24"/);
    assert.match(out2, /foreground\s+=\s+"#d4dde3"/);
    assert.match(out2, /frame_color\s+=\s+"#3b556d"/);
  });

  it('partial tokens: a missing single role still falls back per-line, not per-section', () => {
    // If only `accent` is missing, only the urgency_normal frame should
    // fall back to its hardcoded value; other directives keep their
    // canonical hex. Pin the behavior so a future refactor that resolves
    // the whole section at once doesn't accidentally fall back ALL three
    // directives when only one token is missing.
    const partial = { ...CANONICAL_TOKENS };
    delete partial.accent;
    const out3 = buildDunstConfig(partial);
    // urgency_normal frame falls back to border (#3b556d), NOT accent.
    const block = sliceUrgency(out3, 'urgency_normal');
    assert.match(block, /frame_color\s+=\s+"#3b556d"/, 'urgency_normal frame should fall back to border when accent is missing');
    // urgency_normal fg still uses text (canonical, not missing).
    assert.match(block, /foreground\s+=\s+"#d4dde3"/);
    // urgency_low frame still uses border (canonical, unaffected).
    const lowBlock = sliceUrgency(out3, 'urgency_low');
    assert.match(lowBlock, /frame_color\s+=\s+"#3b556d"/);
  });

  it('output ends with exactly one trailing newline (no blank line at EOF)', () => {
    // Full-file replacements follow the POSIX text-file convention: every
    // body line is newline-terminated, the file ends with '\n' but does NOT
    // have a redundant blank line ('\n\n'). This matches the contract used
    // by buildWaybarTheme / buildKittyTheme / buildWofiStyle.
    assert.ok(out.endsWith('\n'), 'should end with newline');
    assert.ok(!out.endsWith('\n\n'), 'should NOT have a redundant blank line at EOF');
  });

  it('output is byte-stable across two consecutive calls with the same tokens (idempotent at the function level)', () => {
    // writeComponentWithBackup handles idempotency at the file level; this
    // test pins the same property at the function level for completeness.
    const a = buildDunstConfig(CANONICAL_TOKENS);
    const b = buildDunstConfig(CANONICAL_TOKENS);
    assert.equal(a, b);
  });
});

/**
 * Helper: extract the contiguous text of one urgency_* section.
 * Trims leading/trailing whitespace from the section slice so callers can
 * regex-match on directive lines without anchor noise from the header line.
 */
function sliceUrgency(text, urgency) {
  const startMarker = `[${urgency}]`;
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return '';
  const afterHeader = startIdx + startMarker.length;
  // Find the next [..] section at start-of-line, or end of file.
  const tail = text.slice(afterHeader);
  const nextSectionMatch = tail.match(/^\[/m);
  const endIdx = nextSectionMatch ? afterHeader + nextSectionMatch.index : text.length;
  return text.slice(startIdx, endIdx);
}

// ===========================================================================
// 19. DUNST_MAPPING — single source of truth for urgency → {bg,fg,frame}
// ===========================================================================
describe('DUNST_MAPPING', () => {
  it('has exactly 3 keys: urgency_low, urgency_normal, urgency_critical', () => {
    assert.equal(Object.keys(DUNST_MAPPING).length, 3);
    assert.ok('urgency_low' in DUNST_MAPPING);
    assert.ok('urgency_normal' in DUNST_MAPPING);
    assert.ok('urgency_critical' in DUNST_MAPPING);
  });

  it('every entry has exactly 3 properties: background, foreground, frame', () => {
    for (const [urgency, roles] of Object.entries(DUNST_MAPPING)) {
      const keys = Object.keys(roles).sort();
      assert.deepEqual(
        keys,
        ['background', 'foreground', 'frame'],
        `${urgency} should have exactly {background, foreground, frame}, got: ${keys.join(', ')}`
      );
    }
  });

  it('every role value is a name of a token that exists in the canonical palette', () => {
    // Closes the loop with master.css: a future DUNST_MAPPING entry that
    // references a typo'd token name (e.g. "accent-SoFT") would silently
    // fall back to a hardcoded hex at render time, masking the typo. This
    // test catches it BEFORE the build runs.
    for (const [urgency, roles] of Object.entries(DUNST_MAPPING)) {
      for (const [role, tokenName] of Object.entries(roles)) {
        assert.ok(
          Object.prototype.hasOwnProperty.call(CANONICAL_TOKENS, tokenName),
          `${urgency}.${role} references unknown master token "${tokenName}"`
        );
      }
    }
  });

  it('all three urgencies use `surface` as background (consistency with the spec rationale)', () => {
    // Pinning the A.4 rationale: bg would make notifications invisible
    // against the desktop, surface reads as "floating panel".
    assert.equal(DUNST_MAPPING.urgency_low.background, 'surface');
    assert.equal(DUNST_MAPPING.urgency_normal.background, 'surface');
    assert.equal(DUNST_MAPPING.urgency_critical.background, 'surface');
  });

  it('frame escalation matches urgency (low → border, normal → accent, critical → error)', () => {
    // The frame IS the urgency cue. Pin the escalation so a future change
    // can only land in one of three deliberate combinations.
    assert.equal(DUNST_MAPPING.urgency_low.frame, 'border');
    assert.equal(DUNST_MAPPING.urgency_normal.frame, 'accent');
    assert.equal(DUNST_MAPPING.urgency_critical.frame, 'error');
  });
});

// ===========================================================================
// 20. FONT_STACK — single source of truth for system font stack (B.1)
//
// B.1 SPEC:
//   - Font stack defined ONCE as a top-level const in palette/build.js
//     (instead of being duplicated across waybar/style.css, wofi/style.css,
//     and any future consumer).
//   - Consumers (e.g. buildWofiStyle) reference FONT_STACK via template
//     literal — they MUST NOT inline the string literal again.
//   - The canonical chain: JetBrainsMono Nerd Font (primary, Nerd Font
//     glyph coverage + monospace text) → Symbols Nerd Font → FontAwesome
//     → Roboto → Helvetica → Arial → sans-serif (generic last-resort).
//
// The four tests below pin the contract end-to-end:
//   1. Exact string match — guards against silent drift (a re-order, a
//      typo, a dropped fallback would all fail this test).
//   2. Starts with JetBrainsMono Nerd Font — the primary is non-negotiable;
//      any future change that removes it must come with an explicit test
//      update, not a silent drop.
//   3. Ends with sans-serif — last fallback MUST be the generic family so
//      the browser/toolkit picks something readable if every named font
//      is missing.
//   4. Single string — guards against accidentally changing the constant
//      to an array (which would silently break the template-literal
//      interpolation in buildWofiStyle — `${array}` calls .toString()).
// ===========================================================================
describe('FONT_STACK', () => {
  it('es la cadena esperada (stack completo)', () => {
    assert.equal(
      FONT_STACK,
      '"JetBrainsMono Nerd Font", "Symbols Nerd Font", FontAwesome, Roboto, Helvetica, Arial, sans-serif'
    );
  });

  it('empieza con JetBrainsMono Nerd Font', () => {
    assert.match(FONT_STACK, /JetBrainsMono Nerd Font/);
  });

  it('termina con sans-serif como último fallback', () => {
    assert.match(FONT_STACK, /sans-serif$/);
  });

  it('es un único string (no array, no objeto)', () => {
    // If somebody refactors FONT_STACK to an array, `${FONT_STACK}` would
    // silently call .toString() and produce "font1,font2,..." — wrong shape
    // for CSS (font names with spaces lose their quotes). Pin the type.
    assert.equal(typeof FONT_STACK, 'string');
  });
});

// ===========================================================================
// 21. buildWofiStyle — FONT_STACK integration (B.1)
//
// Verifies that the wofi stylesheet actually USES FONT_STACK (no inline
// literal). Without these two tests, a future change that re-inlines the
// old `"JetBrainsMono Nerd Font", sans-serif` string in buildWofiStyle
// would silently regress the consolidation without breaking anything
// visually.
//
//   1. window{} rule must reference the canonical FONT_STACK (positive).
//   2. The deprecated short stack `"JetBrainsMono Nerd Font", sans-serif`
//      MUST NOT appear anywhere in the output (negative) — guards against
//      the old hardcoded form creeping back in.
// ===========================================================================
describe('buildWofiStyle — FONT_STACK integration', () => {
  const css = buildWofiStyle(CANONICAL_TOKENS);

  it('usa FONT_STACK en la regla window', () => {
    // The canonical form `font-family: ${FONT_STACK};` must appear in the
    // generated stylesheet. The buildWofiStyle body interpolates the
    // constant via template literal — anything else is a regression.
    assert.ok(
      css.includes(`font-family: ${FONT_STACK};`),
      'window{} rule debe usar FONT_STACK (consolidated B.1)'
    );
  });

  it('NO contiene el stack corto deprecado "JetBrainsMono Nerd Font", sans-serif', () => {
    // The old form was: `font-family: "JetBrainsMono Nerd Font", sans-serif;`
    // — the build WIDE stack (`FONT_STACK`) MUST replace it everywhere. If
    // this test ever fails, the consolidation has regressed.
    assert.doesNotMatch(css, /"JetBrainsMono Nerd Font", sans-serif/);
  });
});
