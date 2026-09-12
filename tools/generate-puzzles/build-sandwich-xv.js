// Sandwich and XV aren't supported by lisudoku_solver's constraint schema
// (no sandwich-sum or XV field), so this uses a custom backtracking solver
// with incremental constraint pruning (an XV pair is checked the moment
// both its cells are filled; a row/column's sandwich sum is checked the
// moment that row/column is completely filled) to verify TRUE uniqueness
// -- not just "no conflicts on the stored solution" like the old bulk
// generator did. There's no real technique-tier classifier for these two
// (that's what lisudoku_solver gives the other categories), so stars here
// are a clue-density heuristic: fewer clues -> more stars.

const fs = require('fs');
const vm = require('vm');

const engineSrc = fs.readFileSync(__dirname + '/../../sudoku-engine.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(engineSrc, sandbox);
const { findConflicts, findVariantConflicts } = sandbox.window.SudokuEngine;

const BASE = [
  [5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],
  [8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],
  [9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9],
];
function transpose(g) { return g[0].map((_, c) => g.map(row => row[c])); }
function permute(arr, order) { return order.map(i => arr[i]); }
function relabelDigits(g, perm) { return g.map(row => row.map(v => perm[v - 1])); }
function permuteBandsAndRows(g, bandOrder, rowOrderPerBand) {
  const bands = [g.slice(0, 3), g.slice(3, 6), g.slice(6, 9)];
  return permute(bands, bandOrder).map((band, i) => permute(band, rowOrderPerBand[i])).flat();
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
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
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
const usedGrids = new Set();
function freshGrid(seed) {
  while (true) {
    const g = makeGrid(seed++);
    const key = JSON.stringify(g);
    if (!usedGrids.has(key)) { usedGrids.add(key); return g; }
  }
}

function isValidClassic(g, r, c, v) {
  for (let i = 0; i < 9; i++) {
    if (i !== c && g[r][i] === v) return false;
    if (i !== r && g[i][c] === v) return false;
  }
  const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
  for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) {
    const rr = br+dr, cc = bc+dc;
    if ((rr!==r||cc!==c) && g[rr][cc]===v) return false;
  }
  return true;
}

function sandwichBetweenSum(row, clue) {
  const idx1 = row.indexOf(1), idx9 = row.indexOf(9);
  if (idx1 === -1 || idx9 === -1) return true; // not both placed yet, can't check
  const lo = Math.min(idx1, idx9), hi = Math.max(idx1, idx9);
  let sum = 0;
  for (let i = lo + 1; i < hi; i++) sum += row[i];
  return sum === clue;
}

// Counts solutions (capped) for a partially-filled grid honoring classic
// rules + XV pairs (checked as soon as both cells are filled) + sandwich
// sums (checked as soon as the row/col is fully filled). Cell order is
// row-major so row sandwich checks fire early and prune hard; column
// checks only bite near the end, which is fine since we always supply all
// 9 row clues.
//
// With few givens, "all sandwich sums" is too weak a per-step constraint
// to prune a plain backtracking search -- it only rejects at row/column
// boundaries, so the search can blow up long before finding the one grid
// that also matches all 18 sums (verified empirically: a fully-empty grid
// didn't finish in 20+ seconds). maxNodes bounds worst-case runtime: if
// exceeded, the result is INCONCLUSIVE (aborted:true), which callers must
// treat as "not safe to remove this given" rather than "unique".
function countSolutions(givens, extra, cap, maxNodes = 300000) {
  const g = givens.map(row => row.slice());
  const xvByCell = extra.xv ? buildXvIndex(extra.xv) : null;
  const rowsClues = extra.sandwich ? extra.sandwich.rows : null;
  const colsClues = extra.sandwich ? extra.sandwich.cols : null;
  let count = 0;
  let firstSolution = null;
  let nodes = 0;
  let aborted = false;

  function xvOk(r, c, v) {
    if (!xvByCell) return true;
    const links = xvByCell[`${r},${c}`];
    if (!links) return true;
    for (const { or, oc, target } of links) {
      const ov = g[or][oc];
      if (ov !== 0 && ov + v !== target) return false;
    }
    return true;
  }
  function rowOk(r) {
    if (!rowsClues || rowsClues[r] == null) return true;
    if (g[r].includes(0)) return true;
    return sandwichBetweenSum(g[r], rowsClues[r]);
  }
  function colOk(c) {
    if (!colsClues || colsClues[c] == null) return true;
    const col = g.map(row => row[c]);
    if (col.includes(0)) return true;
    return sandwichBetweenSum(col, colsClues[c]);
  }

  function backtrack(pos) {
    if (aborted) return true;
    if (++nodes > maxNodes) { aborted = true; return true; }
    if (pos === 81) {
      count++;
      if (!firstSolution) firstSolution = g.map(row => row.slice());
      return count >= cap;
    }
    const r = Math.floor(pos / 9), c = pos % 9;
    if (g[r][c] !== 0) return backtrack(pos + 1);
    for (let v = 1; v <= 9; v++) {
      if (!isValidClassic(g, r, c, v)) continue;
      if (!xvOk(r, c, v)) continue;
      g[r][c] = v;
      if (rowOk(r) && (c < 8 || colOk(c))) {
        // Also opportunistically check any column that just got completed
        // (only truly complete on the last row, but re-checking cheaply
        // here doesn't hurt correctness).
        let allColsOk = true;
        if (r === 8) { for (let cc = 0; cc <= c; cc++) if (!colOk(cc)) { allColsOk = false; break; } }
        if (allColsOk && backtrack(pos + 1)) return true;
      }
      g[r][c] = 0;
    }
    return false;
  }
  backtrack(0);
  return { count, solution: firstSolution, aborted };
}
function buildXvIndex(xv) {
  const idx = {};
  for (const pair of xv) {
    const target = pair.kind === 'X' ? 10 : 5;
    const [ar, ac] = pair.a, [br, bc] = pair.b;
    (idx[`${ar},${ac}`] = idx[`${ar},${ac}`] || []).push({ or: br, oc: bc, target });
    (idx[`${br},${bc}`] = idx[`${br},${bc}`] || []).push({ or: ar, oc: ac, target });
  }
  return idx;
}

function assertOk(grid, constraints, label) {
  if (findConflicts(grid).size > 0) throw new Error(`${label}: classic conflicts`);
  const v = findVariantConflicts(grid, constraints);
  if (v.size > 0) throw new Error(`${label}: variant conflicts: ${[...v]}`);
}

const entries = [];

// ==================== SANDWICH ====================
// Greedy minimization from a FULL grid (all 81 cells given) down, keeping
// a removal only if it stays uniquely solvable -- the reverse of building
// up from empty, which is what timed out (see countSolutions' comment).
// Starting nearly-full keeps the search small at every step since there
// are few empty cells to reason about until deep into the process.
function sandwichSumsFor(grid) {
  function sumBetween(cells) {
    const idx1 = cells.findIndex(([r,c]) => grid[r][c] === 1);
    const idx9 = cells.findIndex(([r,c]) => grid[r][c] === 9);
    const lo = Math.min(idx1, idx9), hi = Math.max(idx1, idx9);
    return cells.slice(lo+1, hi).reduce((s,[r,c]) => s + grid[r][c], 0);
  }
  const rows = []; for (let r = 0; r < 9; r++) rows.push(sumBetween(Array.from({length:9},(_,c)=>[r,c])));
  const cols = []; for (let c = 0; c < 9; c++) cols.push(sumBetween(Array.from({length:9},(_,r)=>[r,c])));
  return { rows, cols };
}
function greedyMinimizeGivens(grid, extra, seed) {
  let givens = grid.map(row => row.slice());
  const positions = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) positions.push([r, c]);
  const order = shuffle(positions, mulberry32(seed));
  let removed = 0;
  for (const [r, c] of order) {
    if (givens[r][c] === 0) continue;
    const saved = givens[r][c];
    givens[r][c] = 0;
    const result = countSolutions(givens, extra, 2);
    if (!result.aborted && result.count === 1) {
      removed++;
    } else {
      givens[r][c] = saved; // put it back, removal wasn't safe
    }
  }
  return { givens, removed };
}
const SANDWICH_TITLES = ['Between the Bread', 'Filling Only'];
for (let i = 0; i < 2; i++) {
  const grid = freshGrid(51001 + i * 401);
  const sandwich = sandwichSumsFor(grid);
  console.time(`sandwich-${i}`);
  const { givens, removed } = greedyMinimizeGivens(grid, { sandwich }, 8001 + i);
  console.timeEnd(`sandwich-${i}`);
  const clueCount = 81 - removed;
  const finalCheck = countSolutions(givens, { sandwich }, 2);
  console.log('sandwich', i, 'final givens:', clueCount, 'solutions:', finalCheck.count);
  if (finalCheck.count !== 1) throw new Error(`sandwich-${i}: final state not unique`);
  assertOk(grid, { sandwich }, `sandwich-${i}`);
  entries.push({
    id: `sandwich-${i + 1}`,
    title: SANDWICH_TITLES[i],
    blurb: `${clueCount} givens, plus all 18 row and column sandwich sums.`,
    givens,
    solution: grid,
    sandwich,
    // Capped at 8, not 10: there's no real technique-tier classifier for
    // sandwich sums like there is for the solver-verified categories, so
    // this is a clue-density proxy -- it shouldn't claim to be harder than
    // a verified 9-10 star kropki/lines puzzle.
    stars: Math.max(2, Math.min(8, Math.round((28 - clueCount) / 3))),
    variants: ['sandwich'],
  });
}

// ==================== XV ====================
// Same greedy-minimize-from-full-grid approach as sandwich, with every
// valid X (sum 10) / V (sum 5) adjacent-pair marker present throughout.
function allXvPairs(grid) {
  const pairs = [];
  function check(r1,c1,r2,c2) {
    const sum = grid[r1][c1] + grid[r2][c2];
    if (sum === 10) pairs.push({ a: [r1,c1], b: [r2,c2], kind: 'X' });
    else if (sum === 5) pairs.push({ a: [r1,c1], b: [r2,c2], kind: 'V' });
  }
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (c < 8) check(r, c, r, c + 1);
    if (r < 8) check(r, c, r + 1, c);
  }
  return pairs;
}
const XV_TITLES = ['Tens and Fives', 'Roman Numerals'];
for (let i = 0; i < 2; i++) {
  const grid = freshGrid(61001 + i * 457);
  const xv = allXvPairs(grid);
  console.time(`xv-${i}`);
  const { givens, removed } = greedyMinimizeGivens(grid, { xv }, 9001 + i);
  console.timeEnd(`xv-${i}`);
  const clueCount = 81 - removed;
  const finalCheck = countSolutions(givens, { xv }, 2);
  console.log('xv', i, 'final givens:', clueCount, 'solutions:', finalCheck.count, 'pairs:', xv.length);
  if (finalCheck.count !== 1) throw new Error(`xv-${i}: final state not unique`);
  assertOk(grid, { xv }, `xv-${i}`);
  entries.push({
    id: `xv-${i + 1}`,
    title: XV_TITLES[i],
    blurb: `${clueCount} givens plus every X/V marker the grid supports — no marker means no information.`,
    givens,
    solution: grid,
    xv,
    stars: Math.max(2, Math.min(8, Math.round((22 - clueCount) / 2))),
    variants: ['xv'],
  });
}

fs.writeFileSync(__dirname + '/sandwich-xv.json', JSON.stringify(entries, null, 2));
console.log('\nWrote sandwich-xv.json,', entries.length, 'entries. Stars:', entries.map(e => `${e.id}:${e.stars}`).join(' '));
