// Builds candidate multi-constraint puzzles (kropki+renban, kropki+thermo,
// kropki+arrow) as maximally-decorated, zero-given lisudoku_solver JSON
// files. Each is then fed through minimize.js (once per decoration field)
// to strip down to a near-minimal, still-uniquely-solvable set — the same
// pipeline used for antiknight-kropki-1, just producing more candidates at
// once. Run `node mv-gen.js`, then minimize each `mv-*-candidate.json` with
// minimize.js, then `node mv-format.js` to convert survivors to app format.

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

// ---- Load existing puzzle solutions (to dedupe grids against) ----
const puzzlesSrc = fs.readFileSync(__dirname + '/../../puzzles.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(puzzlesSrc, sandbox);
const existingSolutions = new Set(sandbox.window.PuzzleLibrary.map(p => JSON.stringify(p.solution)));

function transpose(g) { return g[0].map((_, c) => g.map(row => row[c])); }
function permute(arr, order) { return order.map(i => arr[i]); }
function relabelDigits(g, perm) { return g.map(row => row.map(v => perm[v - 1])); }
function permuteBandsAndRows(g, bandOrder, rowOrderPerBand) {
  const bands = [g.slice(0, 3), g.slice(3, 6), g.slice(6, 9)];
  const reordered = permute(bands, bandOrder).map((band, i) => permute(band, rowOrderPerBand[i]));
  return reordered.flat();
}
function permuteStacksAndCols(g, stackOrder, colOrderPerStack) {
  return transpose(permuteBandsAndRows(transpose(g), stackOrder, colOrderPerStack));
}
function cloneGrid(g) { return g.map(row => row.slice()); }
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
function makeGrid(seed) {
  const rand = mulberry32(seed);
  let g = cloneGrid(BASE);
  g = relabelDigits(g, shuffle([1,2,3,4,5,6,7,8,9], rand));
  const bandOrder = shuffle([0,1,2], rand);
  const rowOrderPerBand = [shuffle([0,1,2], rand), shuffle([0,1,2], rand), shuffle([0,1,2], rand)];
  const stackOrder = shuffle([0,1,2], rand);
  const colOrderPerStack = [shuffle([0,1,2], rand), shuffle([0,1,2], rand), shuffle([0,1,2], rand)];
  g = permuteBandsAndRows(g, bandOrder, rowOrderPerBand);
  g = permuteStacksAndCols(g, stackOrder, colOrderPerStack);
  if (rand() < 0.5) g = transpose(g);
  return g;
}
function freshGrid(startSeed) {
  let seed = startSeed;
  while (true) {
    const g = makeGrid(seed++);
    const key = JSON.stringify(g);
    if (!existingSolutions.has(key)) { existingSolutions.add(key); return g; }
  }
}

// ---- Decoration finders (exhaustive, over the WHOLE grid) ----
function allKropkiDots(grid) {
  const dots = [];
  function check(r1,c1,r2,c2) {
    const a = grid[r1][c1], b = grid[r2][c2];
    if (Math.abs(a - b) === 1) dots.push({ dotType: 'Consecutive', cell1: { row: r1, col: c1 }, cell2: { row: r2, col: c2 } });
    else if (a === b * 2 || b === a * 2) dots.push({ dotType: 'Double', cell1: { row: r1, col: c1 }, cell2: { row: r2, col: c2 } });
  }
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (c < 8) check(r, c, r, c + 1);
    if (r < 8) check(r, c, r + 1, c);
  }
  return dots;
}
function isRenban(vals) {
  const set = new Set(vals);
  if (set.size !== vals.length) return false;
  return Math.max(...vals) - Math.min(...vals) === vals.length - 1;
}
function allRenbans(grid, len) {
  const lines = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c <= 9 - len; c++) {
    const cells = Array.from({ length: len }, (_, k) => [r, c + k]);
    if (isRenban(cells.map(([rr,cc]) => grid[rr][cc]))) lines.push(cells);
  }
  for (let c = 0; c < 9; c++) for (let r = 0; r <= 9 - len; r++) {
    const cells = Array.from({ length: len }, (_, k) => [r + k, c]);
    if (isRenban(cells.map(([rr,cc]) => grid[rr][cc]))) lines.push(cells);
  }
  return lines;
}
function isThermo(vals) {
  for (let i = 1; i < vals.length; i++) if (vals[i] <= vals[i - 1]) return false;
  return true;
}
function allThermos(grid, len) {
  const lines = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c <= 9 - len; c++) {
    const cells = Array.from({ length: len }, (_, k) => [r, c + k]);
    const vals = cells.map(([rr,cc]) => grid[rr][cc]);
    if (isThermo(vals)) lines.push(cells);
    if (isThermo(vals.slice().reverse())) lines.push(cells.slice().reverse());
  }
  for (let c = 0; c < 9; c++) for (let r = 0; r <= 9 - len; r++) {
    const cells = Array.from({ length: len }, (_, k) => [r + k, c]);
    const vals = cells.map(([rr,cc]) => grid[rr][cc]);
    if (isThermo(vals)) lines.push(cells);
    if (isThermo(vals.slice().reverse())) lines.push(cells.slice().reverse());
  }
  return lines;
}
function allArrows(grid) {
  const arrows = [];
  // Circle + 2-cell straight arm, horizontal or vertical, either direction.
  function tryArrow(circle, arm) {
    const cv = grid[circle[0]][circle[1]];
    const sum = arm.reduce((s, [r,c]) => s + grid[r][c], 0);
    if (sum === cv) arrows.push({ circleCells: [{ row: circle[0], col: circle[1] }], arrowCells: arm.map(([r,c]) => ({ row: r, col: c })) });
  }
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (c + 2 <= 8) tryArrow([r,c], [[r,c+1],[r,c+2]]);
    if (c - 2 >= 0) tryArrow([r,c], [[r,c-1],[r,c-2]]);
    if (r + 2 <= 8) tryArrow([r,c], [[r+1,c],[r+2,c]]);
    if (r - 2 >= 0) tryArrow([r,c], [[r-1,c],[r-2,c]]);
  }
  return arrows;
}
function cellsToLine(cells) { return cells.map(([r,c]) => ({ row: r, col: c })); }

function writeCandidate(name, grid, extra) {
  const constraints = { gridSize: 9, fixedNumbers: [], ...extra };
  fs.writeFileSync(__dirname + `/mv-${name}-candidate.json`, JSON.stringify(constraints, null, 2));
  fs.writeFileSync(__dirname + `/mv-${name}-grid.json`, JSON.stringify(grid, null, 2));
  console.log(name, 'written. Decoration sizes:', Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'gridSize').map(([k,v]) => [k, Array.isArray(v) ? v.length : v])));
}

// ---- Puzzle 1: Kropki + Renban ----
// Try several grids: max-decoration kropki+renban is invariant under some
// digit symmetries on certain grids (multiple solutions even fully
// decorated), so pick the first seed whose max-decorated candidate is
// actually uniquely solvable.
{
  const { execFileSync } = require('child_process');
  const BIN = process.env.LISUDOKU_VERIFY_BIN || '/tmp/lisudoku_solver/target/debug/verify';
  let seed = 9001;
  let picked = null;
  for (let tries = 0; tries < 30 && !picked; tries++) {
    const grid = freshGrid(seed);
    seed += 137;
    const kropkiDots = allKropkiDots(grid);
    const renbans = [...allRenbans(grid, 3), ...allRenbans(grid, 4)].map(cellsToLine);
    const tmp = __dirname + '/_mv_probe.json';
    fs.writeFileSync(tmp, JSON.stringify({ gridSize: 9, fixedNumbers: [], kropkiDots, renbans }));
    const out = execFileSync(BIN, [tmp], { encoding: 'utf8' });
    const solutionCount = parseInt(out.match(/solution_count: (\d+)/)[1], 10);
    if (solutionCount === 1) picked = { grid, kropkiDots, renbans };
  }
  if (!picked) throw new Error('kropki-renban: no unique-at-max-decoration grid found');
  writeCandidate('kropki-renban', picked.grid, { kropkiDots: picked.kropkiDots, renbans: picked.renbans });
}

// ---- Puzzle 2: Kropki + Thermo ----
{
  const grid = freshGrid(9101);
  const kropkiDots = allKropkiDots(grid);
  const thermos = [...allThermos(grid, 4), ...allThermos(grid, 3)].map(cellsToLine);
  writeCandidate('kropki-thermo', grid, { kropkiDots, thermos });
}

// ---- Puzzle 3: Kropki + Arrow ----
{
  const grid = freshGrid(9201);
  const kropkiDots = allKropkiDots(grid);
  const arrows = allArrows(grid);
  writeCandidate('kropki-arrow', grid, { kropkiDots, arrows });
}
