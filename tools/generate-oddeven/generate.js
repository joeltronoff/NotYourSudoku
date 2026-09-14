// Generates Odd/Even Sudoku puzzles: classic rules, where some cells carry
// a parity marker (odd/even) instead of -- or as well as -- a full given
// digit. Greedy minimization tries dropping each cell's full digit down to
// "just its parity" (or nothing) while a custom parity-aware solver
// confirms the puzzle is still uniquely solvable.
"use strict";
const fs = require("fs");

function emptyGrid() { return Array.from({ length: 9 }, () => Array(9).fill(0)); }
function cloneGrid(g) { return g.map(row => row.slice()); }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function isValid(grid, r, c, v) {
  for (let i = 0; i < 9; i++) {
    if (i !== c && grid[r][i] === v) return false;
    if (i !== r && grid[i][c] === v) return false;
  }
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++)
    for (let dc = 0; dc < 3; dc++) {
      const rr = br + dr, cc = bc + dc;
      if ((rr !== r || cc !== c) && grid[rr][cc] === v) return false;
    }
  return true;
}
function solveFull(grid, { randomize = false, countLimit = null } = {}) {
  const g = cloneGrid(grid);
  let count = 0, first = null;
  function findEmpty() {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (g[r][c] === 0) return [r, c];
    return null;
  }
  function backtrack() {
    const spot = findEmpty();
    if (!spot) { count++; if (!first) first = cloneGrid(g); return countLimit !== null && count >= countLimit; }
    const [r, c] = spot;
    let cands = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    if (randomize) cands = shuffle(cands);
    for (const v of cands) {
      if (isValid(g, r, c, v)) { g[r][c] = v; if (backtrack()) return true; g[r][c] = 0; }
    }
    return false;
  }
  backtrack();
  return { count, solution: first };
}
function generateFullSolution() { return solveFull(emptyGrid(), { randomize: true, countLimit: 1 }).solution; }

// Parity-aware uniqueness check: `parity` maps "r,c" -> "odd"|"even" for
// blank cells that carry a marker instead of a digit.
function solveWithParity(grid, parity, countLimit) {
  const g = cloneGrid(grid);
  let count = 0;
  function findEmpty() {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (g[r][c] === 0) return [r, c];
    return null;
  }
  function backtrack() {
    const spot = findEmpty();
    if (!spot) { count++; return count >= countLimit; }
    const [r, c] = spot;
    const key = `${r},${c}`;
    const parityReq = parity.get(key);
    for (let v = 1; v <= 9; v++) {
      if (parityReq === "odd" && v % 2 !== 1) continue;
      if (parityReq === "even" && v % 2 !== 0) continue;
      if (isValid(g, r, c, v)) { g[r][c] = v; if (backtrack()) return true; g[r][c] = 0; }
    }
    return false;
  }
  backtrack();
  return count;
}

// A single greedy pass, in a random cell order, over whatever state
// (puzzle, parity) it's handed -- so repeated passes can shake loose
// reductions a different order would have caught the first time.
function minimizePass(puzzle, parity, solution) {
  let changed = false;
  const cells = shuffle(Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9]));
  for (const [r, c] of cells) {
    const key = `${r},${c}`;
    const hadDigit = puzzle[r][c] !== 0;
    const hadParity = parity.has(key);
    if (!hadDigit && !hadParity) continue; // already fully free

    const backupDigit = puzzle[r][c];
    const backupParity = parity.get(key);
    puzzle[r][c] = 0;
    parity.delete(key);
    if (solveWithParity(puzzle, parity, 2) === 1) { changed = true; continue; }

    const trueParity = solution[r][c] % 2 === 1 ? "odd" : "even";
    parity.set(key, trueParity);
    if (solveWithParity(puzzle, parity, 2) === 1) {
      if (!hadParity || hadDigit) changed = true;
      continue;
    }

    parity.delete(key);
    if (backupParity) parity.set(key, backupParity);
    puzzle[r][c] = backupDigit;
  }
  return changed;
}

function minimize(solution, maxPasses) {
  const puzzle = cloneGrid(solution);
  const parity = new Map();
  for (let pass = 0; pass < maxPasses; pass++) {
    if (!minimizePass(puzzle, parity, solution)) break;
  }
  return { puzzle, parity };
}

function toOddEvenClues(parity) {
  return [...parity.entries()].map(([key, p]) => {
    const [r, c] = key.split(",").map(Number);
    return { cell: [r, c], parity: p };
  });
}

const specs = [
  { id: "oddeven-1", title: "Odds and Ends", stars: 5 },
  { id: "oddeven-2", title: "Parity Check", stars: 6 },
  { id: "oddeven-3", title: "Even Odder", stars: 7 },
];

const results = [];
for (const spec of specs) {
  process.stdout.write(`Generating ${spec.id} (${spec.title})... `);
  const solution = generateFullSolution();
  const { puzzle, parity } = minimize(solution, 15);
  const digitGivens = puzzle.flat().filter(v => v !== 0).length;
  console.log(`ok (${digitGivens} digit givens, ${parity.size} parity markers)`);
  results.push({
    id: spec.id, title: spec.title, stars: spec.stars,
    givens: puzzle, solution, oddEven: toOddEvenClues(parity),
  });
}
fs.writeFileSync(__dirname + "/oddeven-puzzles.json", JSON.stringify(results, null, 2));
console.log(`Wrote ${results.length} puzzles to oddeven-puzzles.json`);
