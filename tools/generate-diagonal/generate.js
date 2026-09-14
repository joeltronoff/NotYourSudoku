// Generates Diagonal (X) Sudoku puzzles: classic rules plus both main
// diagonals must also contain every digit 1-9. Self-contained solver/
// generator since sudoku-engine.js's solve() doesn't know about diagonals.
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
  if (r === c) {
    for (let i = 0; i < 9; i++) if (i !== r && grid[i][i] === v) return false;
  }
  if (r + c === 8) {
    for (let i = 0; i < 9; i++) if (i !== r && grid[i][8 - i] === v) return false;
  }
  return true;
}

function solve(grid, { randomize = false, countLimit = null } = {}) {
  const g = cloneGrid(grid);
  let count = 0, first = null;
  function findEmpty() {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (g[r][c] === 0) return [r, c];
    return null;
  }
  function backtrack() {
    const spot = findEmpty();
    if (!spot) {
      count++;
      if (!first) first = cloneGrid(g);
      return countLimit !== null && count >= countLimit;
    }
    const [r, c] = spot;
    let cands = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    if (randomize) cands = shuffle(cands);
    for (const v of cands) {
      if (isValid(g, r, c, v)) {
        g[r][c] = v;
        if (backtrack()) return true;
        g[r][c] = 0;
      }
    }
    return false;
  }
  backtrack();
  return { count, solution: first };
}

function generateFullSolution() {
  const { solution } = solve(emptyGrid(), { randomize: true, countLimit: 1 });
  return solution;
}

function digHoles(solution, targetClues, attempts) {
  const puzzle = cloneGrid(solution);
  const cells = shuffle(Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9]));
  let clues = 81;
  for (const [r, c] of cells) {
    if (clues <= targetClues) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    const { count } = solve(puzzle, { countLimit: 2 });
    if (count !== 1) puzzle[r][c] = backup;
    else clues--;
  }
  return { puzzle, clues };
}

const specs = [
  { id: "diagonal-1", title: "Crossroads", clues: 32, stars: 3 },
  { id: "diagonal-2", title: "X Marks the Spot", clues: 28, stars: 5 },
  { id: "diagonal-3", title: "Both Ways", clues: 25, stars: 7 },
];

const results = [];
for (const spec of specs) {
  process.stdout.write(`Generating ${spec.id} (${spec.title})... `);
  const solution = generateFullSolution();
  const { puzzle, clues } = digHoles(solution, spec.clues, 81);
  console.log(`ok (${clues} givens)`);
  results.push({ id: spec.id, title: spec.title, stars: spec.stars, givens: puzzle, solution, diagonals: true });
}
fs.writeFileSync(__dirname + "/diagonal-puzzles.json", JSON.stringify(results, null, 2));
console.log(`Wrote ${results.length} puzzles to diagonal-puzzles.json`);
