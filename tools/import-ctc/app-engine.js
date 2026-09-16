// Loads the app's own sudoku-engine.js and puzzles.js into Node (they
// attach to `window`), so imports are cross-checked against the exact
// conflict rules the app will enforce at play time.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

function loadBrowserScript(file, context) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
}

function loadApp(extraFiles = []) {
  const context = vm.createContext({ window: {}, console });
  loadBrowserScript('sudoku-engine.js', context);
  loadBrowserScript('puzzles.js', context);
  for (const f of extraFiles) {
    if (fs.existsSync(path.join(ROOT, f))) loadBrowserScript(f, context);
  }
  return { engine: context.window.SudokuEngine, library: context.window.PuzzleLibrary };
}

// True if `grid` is a complete, conflict-free solution of `entry` under the
// app's own rules.
function appAcceptsSolution(engine, entry, grid) {
  if (!engine.isBoardComplete(grid)) return false;
  if (engine.findConflicts(grid).size > 0) return false;
  const conflicts = engine.findVariantConflicts(grid, {
    cages: entry.cages, kropki: entry.kropki, kropkiNegative: entry.kropkiNegative,
    lines: entry.lines, arrows: entry.arrows, antiKnight: entry.antiKnight,
    antiKing: entry.antiKing, nonConsecutive: entry.nonConsecutive,
    disjointGroups: entry.disjointGroups, extraRegions: entry.extraRegions,
    quadruples: entry.quadruples,
    sandwich: entry.sandwich, xv: entry.xv, littleKiller: entry.littleKiller,
    diagonals: entry.diagonals, oddEven: entry.oddEven,
  });
  if (conflicts.size > 0) return false;
  // Givens must match too.
  return entry.givens.every((row, r) => row.every((v, c) => v === 0 || grid[r][c] === v));
}

module.exports = { loadApp, appAcceptsSolution, ROOT };
