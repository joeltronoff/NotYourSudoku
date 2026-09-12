// Generates 5 new, verified puzzles per variant category for Solver's
// Notebook. Every puzzle is validated against the app's own
// sudoku-engine.js (zero conflicts on the true solution) before being
// accepted.

const fs = require('fs');
const vm = require('vm');

const BASE = [
  [5,3,4,6,7,8,9,1,2],
  [6,7,2,1,9,5,3,4,8],
  [1,9,8,3,4,2,5,6,7],
  [8,5,9,7,6,1,4,2,3],
  [4,2,6,8,5,3,7,9,1],
  [7,1,3,9,2,4,8,5,6],
  [9,6,1,5,3,7,2,8,4],
  [2,8,7,4,1,9,6,3,5],
  [3,4,5,2,8,6,1,7,9],
];

// ---- Engine loading (for self-validation) ----
const engineSrc = fs.readFileSync(__dirname + '/../../sudoku-engine.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(engineSrc, sandbox);
const { findConflicts, findVariantConflicts } = sandbox.window.SudokuEngine;

function assertValidGrid(grid, label) {
  const conflicts = findConflicts(grid);
  if (conflicts.size > 0) throw new Error(`${label}: base grid has classic conflicts: ${[...conflicts]}`);
}

function assertNoVariantConflicts(grid, constraints, label) {
  const conflicts = findVariantConflicts(grid, constraints);
  if (conflicts.size > 0) throw new Error(`${label}: variant conflicts on solution: ${[...conflicts]}`);
}

// ---- Grid transforms (each preserves classic-Sudoku validity) ----
function permute(arr, order) { return order.map(i => arr[i]); }
function transpose(g) { return g[0].map((_, c) => g.map(row => row[c])); }
function reverseRows(g) { return g.slice().reverse(); }
function reverseCols(g) { return g.map(row => row.slice().reverse()); }
function relabelDigits(g, perm) { return g.map(row => row.map(v => perm[v - 1])); }
// Permute the 3 bands (row-groups) among themselves, and independently
// permute the 3 rows within each band -- both preserve validity.
function permuteBandsAndRows(g, bandOrder, rowOrderPerBand) {
  const bands = [g.slice(0, 3), g.slice(3, 6), g.slice(6, 9)];
  const reordered = permute(bands, bandOrder).map((band, i) => permute(band, rowOrderPerBand[i]));
  return reordered.flat();
}
function permuteStacksAndCols(g, stackOrder, colOrderPerStack) {
  return transpose(permuteBandsAndRows(transpose(g), stackOrder, colOrderPerStack));
}

function cloneGrid(g) { return g.map(row => row.slice()); }

// Small deterministic PRNG (mulberry32) so each seed drives a genuinely
// independent shuffle of everything (full digit permutation, not just a
// rotation; independent row/column orderings, not a handful of fixed
// cycling tables) -- with a small fixed set of cycling tables, most of
// the 9x9 grid's own internal symmetry collapsed many seeds onto the same
// resulting grid, which starved freshVariantGrid's retry loop.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A pool of distinct, validity-preserving general transforms (for
// categories with no extra structural constraint to protect).
function makeVariantGrid(seed) {
  const rand = mulberry32(seed);
  let g = cloneGrid(BASE);
  const digitPerm = shuffle([1,2,3,4,5,6,7,8,9], rand);
  g = relabelDigits(g, digitPerm);
  const bandOrder = shuffle([0,1,2], rand);
  const rowOrderPerBand = [shuffle([0,1,2], rand), shuffle([0,1,2], rand), shuffle([0,1,2], rand)];
  const stackOrder = shuffle([0,1,2], rand);
  const colOrderPerStack = [shuffle([0,1,2], rand), shuffle([0,1,2], rand), shuffle([0,1,2], rand)];
  g = permuteBandsAndRows(g, bandOrder, rowOrderPerBand);
  g = permuteStacksAndCols(g, stackOrder, colOrderPerStack);
  if (rand() < 0.5) g = transpose(g);
  assertValidGrid(g, `variant-grid-seed-${seed}`);
  return g;
}

// Anti-knight-safe base (band-shift formula) + only knight-safety-
// preserving transforms (digit relabel / transpose / global row-reverse /
// global col-reverse).
function antiKnightBase() {
  const g = [];
  for (let r = 0; r < 9; r++) {
    const row = [];
    for (let c = 0; c < 9; c++) row.push(((r * 3 + Math.floor(r / 3) + c) % 9) + 1);
    g.push(row);
  }
  return g;
}
function checkKnightSafe(g) {
  const OFFSETS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    for (const [dr, dc] of OFFSETS) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr > 8 || cc < 0 || cc > 8) continue;
      if (g[rr][cc] === g[r][c]) return false;
    }
  }
  return true;
}
function makeAntiKnightGrid(seed) {
  const rand = mulberry32(seed * 7919 + 13);
  let g = antiKnightBase();
  g = relabelDigits(g, shuffle([1,2,3,4,5,6,7,8,9], rand));
  if (rand() < 0.5) g = transpose(g);
  if (rand() < 0.5) g = reverseRows(g);
  if (rand() < 0.5) g = reverseCols(g);
  assertValidGrid(g, `antiknight-grid-seed-${seed}`);
  if (!checkKnightSafe(g)) throw new Error(`antiknight-grid-seed-${seed} not knight-safe!`);
  return g;
}

const results = { killer: [], kropki: [], lines: [], antiknight: [], sandwich: [], xv: [] };

// makeVariantGrid's transforms cycle with period 18 in the seed (lcm of the
// digit-rotation period 9, the band/stack-order period 3, and the transpose
// period 2), so naively spacing out seed ranges per category still collides.
// Rather than reason about the period, just retry with the next seed
// whenever the resulting grid has already been used anywhere (checked
// against the existing hand-authored samples too).
const usedGridKeys = new Set([JSON.stringify(BASE)]);
let nextSeed = 1;
function freshVariantGrid() {
  let attempts = 0;
  while (true) {
    if (++attempts > 500) throw new Error('freshVariantGrid: too many attempts, seed=' + nextSeed);
    const grid = makeVariantGrid(nextSeed++);
    const key = JSON.stringify(grid);
    if (!usedGridKeys.has(key)) {
      usedGridKeys.add(key);
      return grid;
    }
  }
}
const usedAntiKnightKeys = new Set([JSON.stringify(antiKnightBase())]);
let nextAntiKnightSeed = 1;
function freshAntiKnightGrid() {
  while (true) {
    const grid = makeAntiKnightGrid(nextAntiKnightSeed++);
    const key = JSON.stringify(grid);
    if (!usedAntiKnightKeys.has(key)) {
      usedAntiKnightKeys.add(key);
      return grid;
    }
  }
}

// ==================== KILLER (5) ====================
// Cage shape templates (row,col deltas from a top-left anchor), a mix of
// dominoes/trominoes/L-shapes for visual variety across puzzles.
const CAGE_SHAPE_SETS = [
  // dominoes tiling by rows, pairs of two
  (size) => {
    const cages = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 8; c += 2) cages.push([[r,c],[r,c+1]]);
    for (const startRow of [0,3,6]) cages.push([[startRow,8],[startRow+1,8],[startRow+2,8]]);
    return cages;
  },
  // vertical dominoes tiling by columns
  (size) => {
    const cages = [];
    for (let c = 0; c < 9; c++) for (let r = 0; r < 8; r += 2) cages.push([[r,c],[r+1,c]]);
    for (const startCol of [0,3,6]) cages.push([[8,startCol],[8,startCol+1],[8,startCol+2]]);
    return cages;
  },
  // L-trominoes tiling a 3x3 block pattern (simple, deterministic)
  (size) => {
    const cages = [];
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const r0 = br*3, c0 = bc*3;
        cages.push([[r0,c0],[r0,c0+1],[r0+1,c0]]);
        cages.push([[r0,c0+2],[r0+1,c0+1],[r0+1,c0+2]]);
        cages.push([[r0+2,c0],[r0+2,c0+1],[r0+2,c0+2]]);
      }
    }
    return cages;
  },
];

for (let i = 0; i < 5; i++) {
  const grid = freshVariantGrid();
  const shapeFn = CAGE_SHAPE_SETS[i % CAGE_SHAPE_SETS.length];
  const cageCells = shapeFn(9);
  const cages = cageCells.map(cells => ({
    cells,
    sum: cells.reduce((s, [r,c]) => s + grid[r][c], 0),
  }));
  assertNoVariantConflicts(grid, { cages }, `killer-${i}`);
  results.killer.push({
    id: `killer-gen-${i + 1}`,
    title: `Killer Variation ${i + 1}`,
    variant: 'killer',
    blurb: 'No givens — deduce every digit from the cage sums and ordinary sudoku rules.',
    givens: Array.from({ length: 9 }, () => Array(9).fill(0)),
    solution: grid,
    cages,
  });
}

// ==================== KROPKI (5) ====================
// Reuse the existing sample's proven hole layout (kropki dots need adjacent
// holes, or a hole next to a given, to be informative -- a hole pattern
// with no two holes ever adjacent, like a strict checkerboard, can never
// produce a dot at all). Holes are just positions, independent of which
// solution grid fills them.
const KROPKI_HOLES = [
  [0,2],[0,6],[1,4],[1,8],[2,0],[2,5],
  [3,3],[3,7],[4,1],[4,5],
  [5,2],[5,6],[6,0],[6,4],[6,8],
  [7,3],[7,7],[8,1],[8,5],[8,8],
];
for (let i = 0; i < 5; i++) {
  const grid = freshVariantGrid();
  const holeSet = new Set(KROPKI_HOLES.map(([r,c]) => `${r},${c}`));
  const givens = grid.map((row, r) => row.map((v, c) => (holeSet.has(`${r},${c}`) ? 0 : v)));
  // A dot is placed on every adjacent pair touching at least one hole
  // (matching the hand-made sample's convention) whose true values satisfy
  // the relation. Given-given pairs are skipped even when the relation
  // holds, since that dot would carry no deducible information and just
  // clutters the board. Absence of a dot elsewhere means no information,
  // not "definitely not related".
  const dots = [];
  function maybeAddDot(r1, c1, r2, c2) {
    const key1 = `${r1},${c1}`, key2 = `${r2},${c2}`;
    if (!holeSet.has(key1) && !holeSet.has(key2)) return;
    const a = grid[r1][c1], b = grid[r2][c2];
    if (Math.abs(a - b) === 1) dots.push({ a: [r1,c1], b: [r2,c2], kind: 'white' });
    else if (a === b * 2 || b === a * 2) dots.push({ a: [r1,c1], b: [r2,c2], kind: 'black' });
  }
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (c < 8) maybeAddDot(r, c, r, c + 1);
    if (r < 8) maybeAddDot(r, c, r + 1, c);
  }
  assertNoVariantConflicts(grid, { kropki: dots }, `kropki-${i}`);
  results.kropki.push({
    id: `kropki-gen-${i + 1}`,
    title: `Kropki Variation ${i + 1}`,
    variant: 'kropki',
    blurb: 'White dots mark consecutive neighbors, black dots mark a 2:1 ratio.',
    givens,
    solution: grid,
    kropki: dots,
  });
}

// ==================== LINES & ARROWS (5) ====================
// Each entry mixes a couple of line/arrow constraints placed on
// deterministic diagonals/paths that are then checked for validity against
// the actual solution (thermo must be increasing, whispers differ by >=5,
// etc.) -- paths that don't satisfy the target relation are skipped.
function tryThermoPath(grid, cells) {
  for (let i = 1; i < cells.length; i++) {
    const [r1,c1] = cells[i-1], [r2,c2] = cells[i];
    if (grid[r1][c1] >= grid[r2][c2]) return false;
  }
  return true;
}
function tryWhispersPath(grid, cells) {
  for (let i = 1; i < cells.length; i++) {
    const [r1,c1] = cells[i-1], [r2,c2] = cells[i];
    if (Math.abs(grid[r1][c1] - grid[r2][c2]) < 5) return false;
  }
  return true;
}
function isRenbanPath(grid, cells) {
  const vals = cells.map(([r,c]) => grid[r][c]);
  const set = new Set(vals);
  if (set.size !== vals.length) return false;
  return Math.max(...vals) - Math.min(...vals) === vals.length - 1;
}

for (let i = 0; i < 5; i++) {
  const grid = freshVariantGrid();
  const lines = [];
  const arrows = [];
  const holes = new Set();

  // Look along each row and each column for a run of length 3-4 cells that
  // happens to already satisfy thermo / whispers / renban, deterministically
  // scanning left-to-right / top-to-bottom.
  // Scan both rows and columns (and, failing that, a shorter length) so a
  // grid that happens to have no valid horizontal run of the target length
  // still yields a line instead of silently skipping that constraint type.
  function scanForLine(kind, checker, lens) {
    for (const len of lens) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c <= 9 - len; c++) {
          const cells = Array.from({ length: len }, (_, k) => [r, c + k]);
          if (checker(grid, cells)) { lines.push({ kind, cells }); cells.forEach(([rr,cc]) => holes.add(`${rr},${cc}`)); return; }
        }
      }
      for (let c = 0; c < 9; c++) {
        for (let r = 0; r <= 9 - len; r++) {
          const cells = Array.from({ length: len }, (_, k) => [r + k, c]);
          if (checker(grid, cells)) { lines.push({ kind, cells }); cells.forEach(([rr,cc]) => holes.add(`${rr},${cc}`)); return; }
        }
      }
    }
  }
  scanForLine('thermo', tryThermoPath, [4, 3]);
  scanForLine('whispers', tryWhispersPath, [3]);
  scanForLine('renban', isRenbanPath, [3]);

  // One arrow: circle cell whose value equals the sum of the next 2 cells
  // in its row or column (search deterministically, row first).
  outer:
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 7; c++) {
      const circleVal = grid[r][c];
      const p1 = grid[r][c+1], p2 = grid[r][c+2];
      if (p1 + p2 === circleVal) {
        arrows.push({ circle: [r,c], cells: [[r,c+1],[r,c+2]] });
        holes.add(`${r},${c}`); holes.add(`${r},${c+1}`); holes.add(`${r},${c+2}`);
        break outer;
      }
    }
  }
  if (arrows.length === 0) {
    outer2:
    for (let c = 0; c < 9; c++) {
      for (let r = 0; r < 7; r++) {
        const circleVal = grid[r][c];
        const p1 = grid[r+1][c], p2 = grid[r+2][c];
        if (p1 + p2 === circleVal) {
          arrows.push({ circle: [r,c], cells: [[r+1,c],[r+2,c]] });
          holes.add(`${r},${c}`); holes.add(`${r+1},${c}`); holes.add(`${r+2},${c}`);
          break outer2;
        }
      }
    }
  }

  const givens = grid.map((row, r) => row.map((v, c) => (holes.has(`${r},${c}`) ? 0 : v)));
  assertNoVariantConflicts(grid, { lines, arrows }, `lines-${i}`);
  const kindsUsed = [...new Set(lines.map(l => l.kind))].concat(arrows.length ? ['arrow'] : []);
  results.lines.push({
    id: `lines-gen-${i + 1}`,
    title: `Lines & Arrows Variation ${i + 1}`,
    variant: 'lines',
    blurb: `Featuring: ${kindsUsed.join(', ')}.`,
    givens,
    solution: grid,
    lines,
    arrows,
  });
}

// ==================== ANTI-KNIGHT (5) ====================
// seed starts at 1, not 0: seed 0 is the identity transform of the base
// grid, which is exactly the solution already used by antiknight-sample-1.
for (let i = 0; i < 5; i++) {
  const grid = freshAntiKnightGrid();
  const givens = grid.map((row, r) => row.map((v, c) => ((r + c + i) % 2 === 0 ? v : 0)));
  assertNoVariantConflicts(grid, { antiKnight: true }, `antiknight-${i}`);
  results.antiknight.push({
    id: `antiknight-gen-${i + 1}`,
    title: `Anti-Knight Variation ${i + 1}`,
    variant: 'antiknight',
    blurb: "Ordinary sudoku rules, plus: no two cells a knight's-move apart may share a digit.",
    givens,
    solution: grid,
    antiKnight: true,
  });
}

// ==================== SANDWICH (5) ====================
function sandwichSum(grid, cells) {
  const idx1 = cells.findIndex(([r,c]) => grid[r][c] === 1);
  const idx9 = cells.findIndex(([r,c]) => grid[r][c] === 9);
  const lo = Math.min(idx1, idx9), hi = Math.max(idx1, idx9);
  const between = cells.slice(lo + 1, hi);
  return between.reduce((s, [r,c]) => s + grid[r][c], 0);
}
for (let i = 0; i < 5; i++) {
  const grid = freshVariantGrid();
  const rowSums = [], colSums = [];
  for (let r = 0; r < 9; r++) rowSums.push(sandwichSum(grid, Array.from({length:9},(_,c)=>[r,c])));
  for (let c = 0; c < 9; c++) colSums.push(sandwichSum(grid, Array.from({length:9},(_,r)=>[r,c])));
  // Use a deterministic subset of clues (rotate which rows/cols are shown)
  const rows = rowSums.map((v, idx) => (idx % 3 === i % 3 ? v : null));
  const cols = colSums.map((v, idx) => (idx % 3 === (i + 1) % 3 ? v : null));
  // Holes: for each shown clue's row/col, blank out a handful of cells
  // strictly between the clue's own 1 and 9 plus the 1/9 themselves, so the
  // puzzle actually has something to deduce.
  const holes = new Set();
  function addHolesForLine(cells) {
    const idx1 = cells.findIndex(([r,c]) => grid[r][c] === 1);
    const idx9 = cells.findIndex(([r,c]) => grid[r][c] === 9);
    const lo = Math.min(idx1, idx9), hi = Math.max(idx1, idx9);
    cells.slice(lo, hi + 1).forEach(([r,c]) => holes.add(`${r},${c}`));
  }
  rows.forEach((v, r) => { if (v !== null) addHolesForLine(Array.from({length:9},(_,c)=>[r,c])); });
  cols.forEach((v, c) => { if (v !== null) addHolesForLine(Array.from({length:9},(_,r)=>[r,c])); });
  const givens = grid.map((row, r) => row.map((v, c) => (holes.has(`${r},${c}`) ? 0 : v)));
  const sandwich = { rows, cols };
  assertNoVariantConflicts(grid, { sandwich }, `sandwich-${i}`);
  results.sandwich.push({
    id: `sandwich-gen-${i + 1}`,
    title: `Sandwich Variation ${i + 1}`,
    variant: 'sandwich',
    blurb: 'Clues outside the grid give the sum of the digits sandwiched between the 1 and the 9 in that row/column.',
    givens,
    solution: grid,
    sandwich,
  });
}

// ==================== XV (5) ====================
for (let i = 0; i < 5; i++) {
  const grid = freshVariantGrid();
  const pairs = [];
  const holes = new Set();
  // Deterministically scan horizontal and vertical adjacent pairs for X (10)
  // or V (5) sums, collecting up to 10 pairs, spaced out a bit.
  const used = new Set();
  function tryPair(r1,c1,r2,c2) {
    const key1 = `${r1},${c1}`, key2 = `${r2},${c2}`;
    if (used.has(key1) || used.has(key2)) return false;
    const sum = grid[r1][c1] + grid[r2][c2];
    if (sum !== 10 && sum !== 5) return false;
    pairs.push({ a: [r1,c1], b: [r2,c2], kind: sum === 10 ? 'X' : 'V' });
    used.add(key1); used.add(key2);
    holes.add(key1); holes.add(key2);
    return true;
  }
  for (let r = 0; r < 9 && pairs.length < 10; r++) {
    for (let c = 0; c < 8 && pairs.length < 10; c++) {
      tryPair(r, c, r, c + 1);
    }
  }
  for (let c = 0; c < 9 && pairs.length < 14; c++) {
    for (let r = 0; r < 8 && pairs.length < 14; r++) {
      tryPair(r, c, r + 1, c);
    }
  }
  const givens = grid.map((row, r) => row.map((v, c) => (holes.has(`${r},${c}`) ? 0 : v)));
  assertNoVariantConflicts(grid, { xv: pairs }, `xv-${i}`);
  results.xv.push({
    id: `xv-gen-${i + 1}`,
    title: `XV Variation ${i + 1}`,
    variant: 'xv',
    blurb: 'An X between two cells means they sum to 10, a V means they sum to 5. No marker means no information.',
    givens,
    solution: grid,
    xv: pairs,
  });
}

// ---- Duplicate-solution safety net (against each other AND the existing
// 6 hand-authored samples) ----
const EXISTING_SOLUTIONS = {
  'killer-sample-1': BASE,
  'kropki-sample-1': BASE,
  'lines-sample-1': BASE,
  'sandwich-sample-1': BASE,
  'xv-sample-1': BASE,
  'antiknight-sample-1': antiKnightBase(),
};
const seen = Object.entries(EXISTING_SOLUTIONS).map(([id, g]) => ({ id, key: JSON.stringify(g) }));
for (const list of Object.values(results)) {
  for (const entry of list) {
    const key = JSON.stringify(entry.solution);
    const dupe = seen.find(s => s.key === key);
    if (dupe) throw new Error(`${entry.id} has the exact same solution grid as ${dupe.id}!`);
    seen.push({ id: entry.id, key });
  }
}

fs.writeFileSync(__dirname + '/generated.json', JSON.stringify(results, null, 2));
console.log('OK, no duplicate solution grids. Counts:', Object.fromEntries(Object.entries(results).map(([k,v]) => [k, v.length])));
