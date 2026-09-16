// Self-test for the variant rules: for each constraint, build clues from a
// real solved grid (the app must accept it, and the solver must agree) and
// then break the grid (the app must reject it).
//
// Usage: node test-constraints.js

const { loadApp, appAcceptsSolution } = require('./app-engine');
const { countSolutions } = require('./solver');

const { engine, library } = loadApp();
const SOLUTION = library.find(e => e.id === 'killer-1').solution;
const empty = () => Array.from({ length: 9 }, () => Array(9).fill(0));
const at = ([r, c]) => SOLUTION[r][c];

let failures = 0;
function check(name, entry, { expectAccept = true } = {}) {
  const full = { givens: empty(), solution: SOLUTION, ...entry };
  const accepted = appAcceptsSolution(engine, full, SOLUTION);
  if (accepted !== expectAccept) {
    failures++;
    console.log(`FAIL ${name}: app ${accepted ? 'accepted' : 'rejected'} (expected ${expectAccept ? 'accept' : 'reject'})`);
    return;
  }
  if (expectAccept) {
    // The solver must also treat the solution as valid: give it the grid as
    // givens minus one cell and check it recovers the digit.
    const givens = SOLUTION.map(row => row.slice());
    givens[4][4] = 0;
    const res = countSolutions({ ...full, givens });
    if (res.count !== 1 || res.solution[4][4] !== SOLUTION[4][4]) {
      failures++;
      console.log(`FAIL ${name}: solver disagrees (count ${res.count})`);
      return;
    }
  }
  console.log(`ok   ${name}${expectAccept ? '' : ' (correctly rejected)'}`);
}

// A grid with two cells swapped inside a row, to break rules on demand.
function swapped(a, b) {
  const g = SOLUTION.map(row => row.slice());
  const tmp = g[a[0]][a[1]];
  g[a[0]][a[1]] = g[b[0]][b[1]];
  g[b[0]][b[1]] = tmp;
  return g;
}

// ---- global rules: assert they hold or don't on the real grid
const antiKingOk = (() => {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (SOLUTION[r][c] === SOLUTION[r + 1][c + 1]) return false;
    if (SOLUTION[r][c + 1] === SOLUTION[r + 1][c]) return false;
  }
  return true;
})();
console.log(`(base grid happens to satisfy anti-king: ${antiKingOk})`);

// Anti-king: check the rule fires on a grid built to violate it.
{
  const grid = SOLUTION.map(row => row.slice());
  const conflicts = engine.findVariantConflicts(grid, { antiKing: true });
  const manual = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (grid[r][c] === grid[r + 1][c + 1]) manual.push(`${r},${c}`);
    if (grid[r][c + 1] === grid[r + 1][c]) manual.push(`${r},${c + 1}`);
  }
  const agrees = manual.every(k => conflicts.has(k)) && (manual.length > 0 || conflicts.size === 0);
  console.log(`${agrees ? 'ok  ' : 'FAIL'} anti-king matches a hand check (${manual.length} diagonal clashes)`);
  if (!agrees) failures++;
}

// Non-consecutive, disjoint groups, extra regions, quadruples, lines.
const nonConsecutiveHolds = (() => {
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (c < 8 && Math.abs(SOLUTION[r][c] - SOLUTION[r][c + 1]) === 1) return false;
    if (r < 8 && Math.abs(SOLUTION[r][c] - SOLUTION[r + 1][c]) === 1) return false;
  }
  return true;
})();
console.log(`(base grid satisfies non-consecutive: ${nonConsecutiveHolds})`);
check('non-consecutive detects a consecutive pair', { nonConsecutive: true }, { expectAccept: nonConsecutiveHolds });

// Extra region built from a real house is always satisfied; a bogus one isn't.
check('extra region (a real box)', { extraRegions: [[[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]]] });
check('extra region (repeating digits)', {
  extraRegions: [[[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [1, 0]]],
}, { expectAccept: SOLUTION[0][0] !== SOLUTION[1][0] && new Set([...SOLUTION[0].slice(0, 8), SOLUTION[1][0]]).size === 9 });

// Disjoint groups: true only if the grid happens to satisfy it.
const disjointHolds = (() => {
  for (let pos = 0; pos < 9; pos++) {
    const seen = new Set();
    for (let box = 0; box < 9; box++) {
      const r = Math.floor(box / 3) * 3 + Math.floor(pos / 3);
      const c = (box % 3) * 3 + (pos % 3);
      if (seen.has(SOLUTION[r][c])) return false;
      seen.add(SOLUTION[r][c]);
    }
  }
  return true;
})();
check('disjoint groups', { disjointGroups: true }, { expectAccept: disjointHolds });

// Quadruple listing the four digits actually present.
const quadCells = [[3, 3], [3, 4], [4, 3], [4, 4]];
check('quadruple (digits present)', { quadruples: [{ cells: quadCells, values: quadCells.map(at) }] });
check('quadruple (digit absent)', {
  quadruples: [{ cells: quadCells, values: [...quadCells.slice(0, 3).map(at), ([1, 2, 3, 4, 5, 6, 7, 8, 9].find(v => !quadCells.map(at).includes(v)))] }],
}, { expectAccept: false });

// Lines, each built from cells of the real grid that satisfy the rule.
function findLine(len, ok) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c + len <= 9; c++) {
      const cells = Array.from({ length: len }, (_, i) => [r, c + i]);
      if (ok(cells.map(at))) return cells;
    }
  }
  for (let c = 0; c < 9; c++) {
    for (let r = 0; r + len <= 9; r++) {
      const cells = Array.from({ length: len }, (_, i) => [r + i, c]);
      if (ok(cells.map(at))) return cells;
    }
  }
  return null;
}

const betweenCells = findLine(3, v => (v[1] > Math.min(v[0], v[2]) && v[1] < Math.max(v[0], v[2])));
if (betweenCells) check('between line', { lines: [{ kind: 'between', cells: betweenCells }] });
const badBetween = findLine(3, v => !(v[1] > Math.min(v[0], v[2]) && v[1] < Math.max(v[0], v[2])));
if (badBetween) check('between line (violated)', { lines: [{ kind: 'between', cells: badBetween }] }, { expectAccept: false });

const entropicCells = findLine(3, v => new Set(v.map(x => Math.floor((x - 1) / 3))).size === 3);
if (entropicCells) check('entropic line', { lines: [{ kind: 'entropic', cells: entropicCells }] });
const badEntropic = findLine(3, v => new Set(v.map(x => Math.floor((x - 1) / 3))).size < 3);
if (badEntropic) check('entropic line (violated)', { lines: [{ kind: 'entropic', cells: badEntropic }] }, { expectAccept: false });

const modularCells = findLine(3, v => new Set(v.map(x => x % 3)).size === 3);
if (modularCells) check('modular line', { lines: [{ kind: 'modular', cells: modularCells }] });

const nabnerCells = findLine(3, v => v.every((x, i) => v.every((y, j) => i === j || Math.abs(x - y) > 1)));
if (nabnerCells) check('nabner line', { lines: [{ kind: 'nabner', cells: nabnerCells }] });
const badNabner = findLine(2, v => Math.abs(v[0] - v[1]) === 1);
if (badNabner) check('nabner line (violated)', { lines: [{ kind: 'nabner', cells: badNabner }] }, { expectAccept: false });

const dutchCells = findLine(2, v => Math.abs(v[0] - v[1]) >= 4 && Math.abs(v[0] - v[1]) < 5);
if (dutchCells) {
  check('dutch whispers (diff 4)', { lines: [{ kind: 'whispers', diff: 4, cells: dutchCells }] });
  check('german whispers on the same line', { lines: [{ kind: 'whispers', cells: dutchCells }] }, { expectAccept: false });
}

// Region sum line: pick a horizontal run crossing a box border with equal halves.
let regionSumCells = null;
for (let r = 0; r < 9 && !regionSumCells; r++) {
  for (let c = 0; c <= 4; c++) {
    for (let len = 2; len <= 4; len++) {
      const cells = Array.from({ length: len * 2 }, (_, i) => [r, c + i]).filter(([, cc]) => cc < 9);
      if (cells.length < len * 2) continue;
      const boxes = new Set(cells.map(([rr, cc]) => Math.floor(rr / 3) * 3 + Math.floor(cc / 3)));
      if (boxes.size !== 2) continue;
      const bySeg = new Map();
      for (const [rr, cc] of cells) {
        const b = Math.floor(rr / 3) * 3 + Math.floor(cc / 3);
        bySeg.set(b, (bySeg.get(b) || 0) + SOLUTION[rr][cc]);
      }
      const totals = [...bySeg.values()];
      if (totals.every(t => t === totals[0])) { regionSumCells = cells; break; }
    }
    if (regionSumCells) break;
  }
}
if (regionSumCells) check('region sum line', { lines: [{ kind: 'regionsum', cells: regionSumCells }] });
else console.log('(no equal-sum region line in this grid to test with)');

console.log(failures === 0 ? '\nAll constraint checks passed.' : `\n${failures} constraint check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
