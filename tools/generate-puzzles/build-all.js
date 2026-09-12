// Rebuilds the entire puzzle library (except the 3 kropki+lines combo
// puzzles from the previous pass, which stay put) with fresh,
// solver-verified, harder puzzles for killer / kropki / lines / antiknight,
// each rated 1-10 stars from the real technique tier the solver needed.
// Sandwich and XV aren't supported by lisudoku_solver's constraint schema,
// so build-sandwich-xv.js (a separate script, using a custom JS backtracking
// uniqueness checker) covers those two categories.
//
// Usage: node build-all.js   (takes a few minutes; writes solver-verified.json)

const fs = require('fs');
const vm = require('vm');
const { execFileSync } = require('child_process');

const BIN = process.env.LISUDOKU_VERIFY_BIN || '/tmp/lisudoku_solver/target/debug/verify';
const BANNED_TECHNIQUES = ['NishioForcingChains'];

const engineSrc = fs.readFileSync(__dirname + '/../../sudoku-engine.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(engineSrc, sandbox);
const { findConflicts, findVariantConflicts } = sandbox.window.SudokuEngine;

// ---- Star rating: max tier over techniques actually required ----
const TECHNIQUE_STAR = {
  NakedSingle: 1,
  HiddenSingle: 2, Thermo: 2, Kropki: 2, PalindromeValues: 2,
  Candidates: 3, ThermoCandidates: 3, KillerCandidates: 3, ArrowCandidates: 3, RenbanCandidates: 3, PalindromeCandidates: 3,
  LockedCandidatesPairs: 4, TopBottomCandidates: 4,
  NakedPairs: 5, HiddenPairs: 5, Killer45: 5, KropkiChainCandidates: 5,
  ArrowAdvancedCandidates: 6, KropkiAdvancedCandidates: 6,
  LockedCandidatesTriples: 7, NakedTriples: 7, HiddenTriples: 7,
  CommonPeerElimination: 7, CommonPeerEliminationKropki: 7, CommonPeerEliminationArrow: 7,
  XWing: 8, TurbotFish: 8, EmptyRectangles: 8,
  XYWing: 9, Swordfish: 9, AdhocNakedSet: 9, PhistomefelRing: 9,
  NishioForcingChains: 10,
};
function starRating(techniques) {
  let max = 1;
  for (const t of Object.keys(techniques)) if (TECHNIQUE_STAR[t] !== undefined) max = Math.max(max, TECHNIQUE_STAR[t]);
  return max;
}

let tmpCounter = 0;
function checkSolvable(constraints) {
  // Each call gets its own temp file: this is called from concurrent-ish
  // rapid retry loops and a shared fixed filename risked one call reading
  // another's half-written file.
  const tmp = __dirname + `/_ba_tmp_${process.pid}_${tmpCounter++}.json`;
  fs.writeFileSync(tmp, JSON.stringify(constraints));
  let out;
  try {
    // A weakly-constrained candidate (e.g. an early, not-yet-good killer
    // cage tiling) can make brute_solve's per-node logical_solve pass
    // (which tries every technique, including forcing chains, at every
    // recursive branch) pathologically slow -- observed one call running
    // 2.5+ minutes at 100% CPU with no end in sight. A timeout treats
    // "too slow to verify" the same as "rejected": move on and retry.
    out = execFileSync(BIN, [tmp], { encoding: 'utf8', timeout: 8000 });
  } catch (e) {
    return { ok: false };
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) {}
  }
  const solutionCount = parseInt(out.match(/solution_count: (\d+)/)[1], 10);
  const solutionType = out.match(/solution_type: (\w+)/)[1];
  const techniques = {};
  const techRegex = /^\s\s(\w+): (\d+)$/gm;
  let m;
  while ((m = techRegex.exec(out))) techniques[m[1]] = parseInt(m[2], 10);
  const usesBanned = BANNED_TECHNIQUES.some(t => techniques[t]);
  return { ok: solutionCount === 1 && solutionType === 'Full' && !usesBanned, solutionCount, solutionType, techniques };
}

function seededShuffle(arr, seed) {
  const a = arr.slice();
  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// Greedily strip entries from one field, keeping the removal only when
// still uniquely + fully-logically solvable without a banned technique.
function minimizeField(base, field, seed) {
  let items = (base[field] || []).slice();
  const order = seededShuffle([...items.keys()], seed);
  for (const idx of order) {
    const key = JSON.stringify(items[idx]);
    const candidate = items.filter(d => JSON.stringify(d) !== key);
    const result = checkSolvable({ ...base, [field]: candidate });
    if (result.ok) items = candidate;
  }
  return { ...base, [field]: items };
}

// ---- Grid generation (mulberry32-seeded, genuinely independent shuffles) ----
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
function antiKnightBase() {
  const g = [];
  for (let r = 0; r < 9; r++) { const row = []; for (let c = 0; c < 9; c++) row.push(((r * 3 + Math.floor(r / 3) + c) % 9) + 1); g.push(row); }
  return g;
}
function checkKnightSafe(g) {
  const OFFSETS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) for (const [dr, dc] of OFFSETS) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || rr > 8 || cc < 0 || cc > 8) continue;
    if (g[rr][cc] === g[r][c]) return false;
  }
  return true;
}
function makeAntiKnightGrid(seed) {
  const rand = mulberry32(seed * 7919 + 13);
  let g = antiKnightBase();
  g = relabelDigits(g, shuffle([1,2,3,4,5,6,7,8,9], rand));
  if (rand() < 0.5) g = transpose(g);
  return g;
}
const usedAKGrids = new Set();
function freshAntiKnightGrid(seed) {
  while (true) {
    const g = makeAntiKnightGrid(seed++);
    const key = JSON.stringify(g);
    if (!usedAKGrids.has(key) && checkKnightSafe(g)) { usedAKGrids.add(key); return g; }
  }
}

function assertOk(grid, constraints, label) {
  if (findConflicts(grid).size > 0) throw new Error(`${label}: classic conflicts`);
  const v = findVariantConflicts(grid, constraints);
  if (v.size > 0) throw new Error(`${label}: variant conflicts: ${[...v]}`);
}

const entries = [];

// ==================== KILLER ====================
// Small (2-3 cell) domino/tromino cages don't carry enough sum information
// to pin a unique grid on their own -- verified this the hard way (brute
// force found 2+ solutions on the very first attempt). Instead: randomized
// irregular tiling into 3-5 cell regions (BFS flood-fill from random
// seeds), full-grid coverage, zero givens, retried with fresh grids/tilings
// until the solver confirms a genuinely unique, chain-free solve.
function randomCageTiling(rand) {
  const covered = Array.from({ length: 9 }, () => Array(9).fill(false));
  const cages = [];
  const cellOrder = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) cellOrder.push([r, c]);
  const order = shuffle(cellOrder, rand);
  for (const [r, c] of order) {
    if (covered[r][c]) continue;
    const targetSize = 3 + Math.floor(rand() * 3); // 3-5
    const cage = [[r, c]];
    covered[r][c] = true;
    while (cage.length < targetSize) {
      // Candidate frontier cells adjacent to the current cage.
      const frontier = [];
      for (const [cr, cc] of cage) {
        for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
          const rr = cr + dr, cc2 = cc + dc;
          if (rr < 0 || rr > 8 || cc2 < 0 || cc2 > 8) continue;
          if (covered[rr][cc2]) continue;
          frontier.push([rr, cc2]);
        }
      }
      if (frontier.length === 0) break;
      const [nr, nc] = frontier[Math.floor(rand() * frontier.length)];
      cage.push([nr, nc]);
      covered[nr][nc] = true;
    }
    cages.push(cage);
  }
  // Any leftover singleton (frontier exhausted early) gets merged into a
  // orthogonally-adjacent existing cage so every cage stays >= 2 cells.
  for (let idx = 0; idx < cages.length; idx++) {
    if (cages[idx].length !== 1) continue;
    const [r, c] = cages[idx][0];
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr > 8 || cc < 0 || cc > 8) continue;
      const other = cages.find((cage, j) => j !== idx && cage.some(([or, oc]) => or === rr && oc === cc));
      if (other) { other.push([r, c]); cages.splice(idx, 1); idx--; break; }
    }
  }
  return cages;
}
const KILLER_TITLES = ['Broken Boxes', 'No Man\'s Sums', 'Fault Lines'];
for (let i = 0; i < 3; i++) {
  const rand = mulberry32(22001 + i * 613);
  let grid, cageCells, check;
  let seed = 20001 + i * 97;
  let attempts = 0;
  do {
    attempts++;
    grid = freshGrid(seed); seed += 89;
    cageCells = randomCageTiling(mulberry32(22001 + i * 613 + attempts * 31));
    const killerCages = cageCells.map(cells => ({ sum: cells.reduce((s, [r,c]) => s + grid[r][c], 0), region: cells.map(([row,col]) => ({ row, col })) }));
    check = checkSolvable({ gridSize: 9, fixedNumbers: [], killerCages });
  } while (!check.ok && attempts < 40);
  if (!check.ok) throw new Error(`killer-${i}: no unique chain-free tiling found after ${attempts} attempts`);
  console.log('killer', i, 'attempts:', attempts, 'cages:', cageCells.length, check.techniques);
  const cages = cageCells.map(cells => ({ cells, sum: cells.reduce((s, [r,c]) => s + grid[r][c], 0) }));
  assertOk(grid, { cages }, `killer-${i}`);
  entries.push({
    id: `killer-${i + 1}`,
    title: KILLER_TITLES[i],
    blurb: `No givens — ${cages.length} irregular cages carry the whole grid.`,
    givens: Array.from({ length: 9 }, () => Array(9).fill(0)),
    solution: grid,
    cages,
    stars: starRating(check.techniques),
    variants: ['killer'],
  });
}

// ==================== KROPKI (pure) ====================
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
const KROPKI_TITLES = ['Black and White', 'Ratio Lock', 'Domino Logic'];
for (let i = 0; i < 3; i++) {
  let grid, kropkiDots, probe;
  let seed = 21001 + i * 151;
  let attempts = 0;
  do {
    if (++attempts > 50) throw new Error(`kropki-${i}: no chain-free max-decoration grid found after 50 attempts`);
    grid = freshGrid(seed); seed += 211;
    kropkiDots = allKropkiDots(grid);
    probe = checkSolvable({ gridSize: 9, fixedNumbers: [], kropkiDots });
    // Require the MAX-decoration state itself to already be chain-free --
    // minimizeField only ever strips clues (which can't make a puzzle
    // need LESS deduction power), so if full decoration already needs
    // forcing chains, no amount of minimizing escapes that.
  } while (!probe.ok);
  let final = minimizeField({ gridSize: 9, fixedNumbers: [], kropkiDots }, 'kropkiDots', 5 + i);
  final = minimizeField(final, 'kropkiDots', 500 + i); // second pass, different order
  const check = checkSolvable(final);
  console.log('kropki', i, 'dots:', final.kropkiDots.length, check.techniques);
  const kropki = final.kropkiDots.map(d => ({ a: [d.cell1.row, d.cell1.col], b: [d.cell2.row, d.cell2.col], kind: d.dotType === 'Consecutive' ? 'white' : 'black' }));
  assertOk(grid, { kropki }, `kropki-${i}`);
  entries.push({
    id: `kropki-${i + 1}`,
    title: KROPKI_TITLES[i],
    blurb: `No givens — ${kropki.length} kropki dots are the only clues.`,
    givens: Array.from({ length: 9 }, () => Array(9).fill(0)),
    solution: grid,
    kropki,
    stars: starRating(check.techniques),
    variants: ['kropki'],
  });
}

// ==================== LINES (thermo + renban + palindrome + arrow) ====================
function isRenban(vals) { const s = new Set(vals); return s.size === vals.length && Math.max(...vals) - Math.min(...vals) === vals.length - 1; }
function isThermo(vals) { for (let i = 1; i < vals.length; i++) if (vals[i] <= vals[i-1]) return false; return true; }
function allRenbans(grid, len) {
  const lines = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c <= 9 - len; c++) { const cells = Array.from({length:len},(_,k)=>[r,c+k]); if (isRenban(cells.map(([rr,cc])=>grid[rr][cc]))) lines.push(cells); }
  for (let c = 0; c < 9; c++) for (let r = 0; r <= 9 - len; r++) { const cells = Array.from({length:len},(_,k)=>[r+k,c]); if (isRenban(cells.map(([rr,cc])=>grid[rr][cc]))) lines.push(cells); }
  return lines;
}
function allThermos(grid, len) {
  const lines = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c <= 9 - len; c++) { const cells = Array.from({length:len},(_,k)=>[r,c+k]); const v = cells.map(([rr,cc])=>grid[rr][cc]); if (isThermo(v)) lines.push(cells); if (isThermo(v.slice().reverse())) lines.push(cells.slice().reverse()); }
  for (let c = 0; c < 9; c++) for (let r = 0; r <= 9 - len; r++) { const cells = Array.from({length:len},(_,k)=>[r+k,c]); const v = cells.map(([rr,cc])=>grid[rr][cc]); if (isThermo(v)) lines.push(cells); if (isThermo(v.slice().reverse())) lines.push(cells.slice().reverse()); }
  return lines;
}
function allArrows(grid) {
  const arrows = [];
  function tryArrow(circle, arm) { const cv = grid[circle[0]][circle[1]]; const sum = arm.reduce((s,[r,c])=>s+grid[r][c],0); if (sum === cv) arrows.push({ circleCells: [{row:circle[0],col:circle[1]}], arrowCells: arm.map(([r,c])=>({row:r,col:c})) }); }
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (c+2<=8) tryArrow([r,c],[[r,c+1],[r,c+2]]);
    if (c-2>=0) tryArrow([r,c],[[r,c-1],[r,c-2]]);
    if (r+2<=8) tryArrow([r,c],[[r+1,c],[r+2,c]]);
    if (r-2>=0) tryArrow([r,c],[[r-1,c],[r-2,c]]);
  }
  return arrows;
}
function cellsToLine(cells) { return cells.map(([r,c]) => ({ row: r, col: c })); }

const LINES_TITLES = ['Rising Heat', 'Straight and Narrow', 'Sum Into the Circle'];
for (let i = 0; i < 3; i++) {
  let grid, thermos, renbans, arrows, probe;
  let seed = 31001 + i * 173;
  let attempts = 0;
  do {
    if (++attempts > 50) throw new Error(`lines-${i}: no chain-free max-decoration grid found after 50 attempts`);
    grid = freshGrid(seed); seed += 233;
    thermos = [...allThermos(grid, 4), ...allThermos(grid, 3)].map(cellsToLine);
    renbans = [...allRenbans(grid, 3), ...allRenbans(grid, 4)].map(cellsToLine);
    arrows = allArrows(grid);
    probe = checkSolvable({ gridSize: 9, fixedNumbers: [], thermos, renbans, arrows });
  } while (!probe.ok);
  let final = { gridSize: 9, fixedNumbers: [], thermos, renbans, arrows };
  final = minimizeField(final, 'thermos', 7 + i);
  final = minimizeField(final, 'renbans', 700 + i);
  final = minimizeField(final, 'arrows', 7000 + i);
  final = minimizeField(final, 'thermos', 70000 + i);
  const check = checkSolvable(final);
  console.log('lines', i, 'thermos:', final.thermos.length, 'renbans:', final.renbans.length, 'arrows:', final.arrows.length, check.techniques);
  const lines = [
    ...final.thermos.map(cells => ({ kind: 'thermo', cells: cellsFromLine(cells) })),
    ...final.renbans.map(cells => ({ kind: 'renban', cells: cellsFromLine(cells) })),
  ];
  const arrowsOut = final.arrows.map(a => ({ circle: [a.circleCells[0].row, a.circleCells[0].col], cells: cellsFromLine(a.arrowCells) }));
  function cellsFromLine(line) { return line.map(p => [p.row, p.col]); }
  assertOk(grid, { lines, arrows: arrowsOut }, `lines-${i}`);
  const kinds = [...new Set(lines.map(l => l.kind))].concat(arrowsOut.length ? ['arrow'] : []);
  entries.push({
    id: `lines-${i + 1}`,
    title: LINES_TITLES[i],
    blurb: `No givens — featuring ${kinds.join(', ')}.`,
    givens: Array.from({ length: 9 }, () => Array(9).fill(0)),
    solution: grid,
    lines,
    arrows: arrowsOut,
    stars: starRating(check.techniques),
    variants: ['lines'],
  });
}

// ==================== ANTI-KNIGHT (minimal givens) ====================
const ANTIKNIGHT_TITLES = ['Forbidden Leap', 'Knight\'s Shadow'];
for (let i = 0; i < 2; i++) {
  const grid = freshAntiKnightGrid(41001 + i * 311);
  const fullGivens = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) fullGivens.push({ position: { row: r, col: c }, value: grid[r][c] });
  let final = { gridSize: 9, fixedNumbers: fullGivens, antiKnight: true };
  final = minimizeField(final, 'fixedNumbers', 9 + i);
  const check = checkSolvable(final);
  console.log('antiknight', i, 'givens:', final.fixedNumbers.length, check.techniques);
  const givens = Array.from({ length: 9 }, () => Array(9).fill(0));
  for (const fn of final.fixedNumbers) givens[fn.position.row][fn.position.col] = fn.value;
  assertOk(grid, { antiKnight: true }, `antiknight-${i}`);
  entries.push({
    id: `antiknight-${i + 1}`,
    title: ANTIKNIGHT_TITLES[i],
    blurb: `${final.fixedNumbers.length} givens — ordinary sudoku rules plus: no two cells a knight's-move apart share a digit.`,
    givens,
    solution: grid,
    antiKnight: true,
    stars: starRating(check.techniques),
    variants: ['antiknight'],
  });
}

fs.writeFileSync(__dirname + '/solver-verified.json', JSON.stringify(entries, null, 2));
try { fs.unlinkSync(__dirname + '/_ba_tmp.json'); } catch (e) {}
console.log('\nWrote solver-verified.json,', entries.length, 'entries. Stars:', entries.map(e => `${e.id}:${e.stars}`).join(' '));
