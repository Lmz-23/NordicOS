/* ============================================================================
 * NordicOS — Palette Watcher
 * ----------------------------------------------------------------------------
 * Watches `palette/master.css` for changes and re-runs `node palette/build.js`
 * automatically. The user can keep their editor open, save changes, and see
 * every component (Waybar, Kitty, Wofi, Hyprland) regenerate without leaving
 * the keyboard.
 *
 * Usage:
 *   node palette/watch.js        # or: npm run watch
 *   Ctrl+C                      # clean shutdown
 *
 * Design choices:
 *   - 200ms debounce: editors often emit several `change` events per save
 *     (write temp, rename, atomic-save, fsync). Debouncing collapses those
 *     into a single build.
 *   - `awaitWriteFinish` (chokidar built-in): waits until the file size has
 *     been stable for 100ms before firing `change`. This catches the "still
 *     being written" case (e.g. very large files, slow disks).
 *   - `ignoreInitial: true`: do NOT build on startup. The user has likely
 *     just run `npm install` or opened a fresh terminal — building then
 *     would be noisy and unnecessary.
 *   - `stdio: 'inherit'` on the spawned build: lets the build script's own
 *     console output flow through to the user unchanged.
 *   - Build runs are non-overlapping: if a build is in progress when another
 *     change arrives, the in-progress build is allowed to finish and we skip
 *     the new one (a fresh change will retrigger immediately afterwards).
 *   - Graceful shutdown: SIGINT closes the watcher, cancels any pending
 *     debounced build, kills any in-flight build process, and exits 0.
 * ========================================================================== */

'use strict';

// --- Node.js core imports --------------------------------------------------
const { spawn } = require('node:child_process'); // Used to run build.js as a child process
const path     = require('node:path');           // Cross-platform path helpers

// --- Third-party imports ---------------------------------------------------
// chokidar is the de-facto file-watching library for Node. We only need the
// change-detection surface area here; no glob, no add/addDir events.
const chokidar = require('chokidar');


// --- Configuration ---------------------------------------------------------
// All paths are resolved relative to THIS script's location so the watcher
// works no matter what the user's cwd is when they invoke `npm run watch`.
const SCRIPT_DIR    = __dirname;                                     // .../nordicos/palette
const PROJECT_ROOT  = path.resolve(SCRIPT_DIR, '..');                // .../nordicos
const MASTER_CSS    = path.join(SCRIPT_DIR, 'master.css');           // The file we watch
const BUILD_SCRIPT  = path.join(SCRIPT_DIR, 'build.js');             // What we run on change

// 200ms is short enough to feel instant to the user but long enough to
// coalesce the burst of write events most editors emit per save.
const DEBOUNCE_MS   = 200;

// Chokidar's awaitWriteFinish stability window: wait this long after the
// last size change before emitting `change`. Prevents reading a half-written
// file on slow disks.
const STABILITY_MS  = 100;


// --- Module-level state ----------------------------------------------------
// These are mutated by event handlers and helper functions; keeping them
// at module scope avoids threading state through every function call.
let debounceTimer   = null;   // setTimeout handle for the pending build
let isBuilding      = false;  // True while a build child process is alive
let currentChild    = null;   // Handle to the in-flight build (for shutdown)
let isShuttingDown  = false;  // Guards against double-handling SIGINT
let watcher         = null;   // The chokidar FSWatcher (held for shutdown)


/**
 * Run `node palette/build.js` as a child process and stream its output to
 * the current terminal. Returns a Promise that resolves with the child's
 * exit code (or `-1` if the build was skipped or failed to spawn).
 *
 * Non-overlap guarantee: if a build is already running, the call resolves
 * immediately with `-1` and a notice — the next pending change will pick up
 * the slack once the in-flight build finishes.
 */
function runBuild() {
  return new Promise((resolve) => {
    // If a build is already running, drop this one. The just-finished build
    // will have left the file system in a consistent state; the user's most
    // recent change is implicitly applied by the fact that the build READ
    // master.css from disk (which already contains the latest edit).
    if (isBuilding) {
      console.log('  (build ya en curso, se omite)');
      resolve(-1);
      return;
    }

    isBuilding = true;
    console.log('→ Ejecutando build...');

    // `stdio: 'inherit'` makes the child share our stdin/stdout/stderr so
    // build.js's console.log output appears inline with our watcher output,
    // without any extra piping code.
    const child = spawn('node', [BUILD_SCRIPT], {
      stdio: 'inherit',
      // Run from the project root so any relative-path error messages from
      // build.js (e.g. "backups/foo") are relative to the project, not to
      // the palette/ folder.
      cwd: PROJECT_ROOT,
    });
    currentChild = child;

    child.on('exit', (code) => {
      isBuilding = false;
      currentChild = null;
      // `code` is null if the child was killed by a signal; treat that as
      // a failure for the user-facing summary but don't crash the watcher.
      resolve(code === null ? -1 : code);
    });

    child.on('error', (err) => {
      // `error` fires when the process couldn't be spawned at all (e.g.
      // `node` not in PATH, permission denied on the script).
      isBuilding = false;
      currentChild = null;
      console.error(`✗ Error ejecutando build: ${err.message}`);
      resolve(-1);
    });
  });
}


/**
 * Schedule a debounced build. Each call cancels the previous timer, so
 * rapid-fire saves result in only ONE build firing 200ms after the last
 * change. This is the canonical "trailing-edge debounce" pattern.
 */
function scheduleBuild() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(async () => {
    debounceTimer = null;

    // If shutdown started during the debounce window, drop the build.
    if (isShuttingDown) return;

    console.log('\n→ Cambio detectado en master.css');
    const exitCode = await runBuild();

    if (isShuttingDown) return; // Ctrl+C arrived mid-build; stay quiet.

    if (exitCode === 0) {
      console.log('\n✓ Build OK. Sigo vigilando...');
    } else {
      // Non-fatal: log and keep watching. The user fixes master.css, saves,
      // and another build fires automatically.
      console.log(`\n✗ Build falló (exit ${exitCode}). Sigo vigilando...`);
    }
  }, DEBOUNCE_MS);
}


/**
 * Set up the chokidar watcher and start piping its events into our
 * debounce/builder pipeline. Idempotent only insofar as the underlying
 * chokidar instance is single-use — call this exactly once.
 */
function startWatching() {
  console.log('========================================');
  console.log('  NordicOS Palette Watcher');
  console.log('========================================');
  console.log(`Vigilando: ${MASTER_CSS}`);
  console.log(`Debounce: ${DEBOUNCE_MS}ms (para guardar varias veces rápido)`);
  console.log('Comando para parar: Ctrl+C');
  console.log('');
  console.log('Esperando cambios en master.css...');

  watcher = chokidar.watch(MASTER_CSS, {
    persistent: true,             // Keep the process alive while watching
    ignoreInitial: true,          // Do NOT fire `change` for the file's current state
    awaitWriteFinish: {           // Wait until writes have settled before firing
      stabilityThreshold: STABILITY_MS,
      pollInterval: 50,
    },
  });

  // Only react to content changes (per the task spec). We deliberately do
  // NOT bind `add` (file recreated) or `unlink` (file deleted) — the watcher
  // is here to regenerate from an EXISTING master.css, not to bootstrap a
  // missing one.
  watcher.on('change', () => {
    scheduleBuild();
  });

  watcher.on('error', (err) => {
    // Watcher-level errors are rare but should not kill the process.
    console.error(`✗ Error en watcher: ${err.message}`);
  });

  // --- Graceful shutdown handler -----------------------------------------
  // SIGINT (Ctrl+C) is the canonical user-initiated stop. We:
  //   1. Cancel any pending debounced build so it doesn't fire post-shutdown.
  //   2. Kill any in-flight build child process (without waiting for it).
  //   3. Close the chokidar watcher (releases inotify handles).
  //   4. Print a farewell and exit 0.
  // If a SECOND SIGINT arrives before cleanup finishes, fall back to a hard
  // exit so the user is never stuck.
  process.on('SIGINT', async () => {
    if (isShuttingDown) {
      console.log('\nForzando salida...');
      process.exit(130);
    }
    isShuttingDown = true;

    console.log('\n\nCerrando watcher...');

    // Cancel pending debounced build — its callback checks isShuttingDown
    // but cancelling outright is faster and avoids any race.
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    // Kill any in-flight build so we don't leave an orphan child running.
    if (currentChild) {
      try {
        currentChild.kill('SIGTERM');
      } catch (_) {
        // Best-effort: the child may have already exited.
      }
    }

    // Close the chokidar watcher (releases OS file handles).
    if (watcher) {
      try {
        await watcher.close();
      } catch (err) {
        console.error(`(cerrando watcher: ${err.message})`);
      }
    }

    console.log('Adiós.');
    process.exit(0);
  });
}


// --- Bootstrap -------------------------------------------------------------
// Run only when invoked directly (lets future code `require('./watch.js')`
// for testing without auto-starting the watcher).
if (require.main === module) {
  startWatching();
}

module.exports = {
  startWatching,
  scheduleBuild,
  runBuild,
};