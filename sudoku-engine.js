// ============================================================
// Sudoku Engine — generation, solving, and logical hint deduction
// Classic 9x9 sudoku. No external dependencies.
// ============================================================

const SIZE = 9;
const BOX = 3;

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function cloneGrid(g) {
  return g.map(row => row.slice());
}

function boxIndex(r, c) {
  return Math.floor(r / BOX) * BOX + Math.floor(c / BOX);
}

function peersOf(r, c) {
  // returns list of [r,c] that share row, col, or box (excluding self)
  const peers = new Set();
  for (let i = 0; i < SIZE; i++) {
    if (i !== c) peers.add(r * 9 + i);
    if (i !== r) peers.add(i * 9 + c);
  }
  const br = Math.floor(r / BOX) * BOX;
  const bc = Math.floor(c / BOX) * BOX;
  for (let dr = 0; dr < BOX; dr++) {
    for (let dc = 0; dc < BOX; dc++) {
      const rr = br + dr, cc = bc + dc;
      if (rr !== r || cc !== c) peers.add(rr * 9 + cc);
    }
  }
  return Array.from(peers).map(v => [Math.floor(v / 9), v % 9]);
}

function isValidPlacement(grid, r, c, val) {
  for (let i = 0; i < SIZE; i++) {
    if (i !== c && grid[r][i] === val) return false;
    if (i !== r && grid[i][c] === val) return false;
  }
  const br = Math.floor(r / BOX) * BOX;
  const bc = Math.floor(c / BOX) * BOX;
  for (let dr = 0; dr < BOX; dr++) {
    for (let dc = 0; dc < BOX; dc++) {
      const rr = br + dr, cc = bc + dc;
      if ((rr !== r || cc !== c) && grid[rr][cc] === val) return false;
    }
  }
  return true;
}

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Backtracking solver. If countLimit is set, stops early once that many
// solutions are found (used for uniqueness checking).
function solve(grid, { randomize = false, countLimit = null } = {}) {
  const g = cloneGrid(grid);
  let solutionCount = 0;
  let firstSolution = null;

  function findEmpty() {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (g[r][c] === 0) return [r, c];
    return null;
  }

  function backtrack() {
    const spot = findEmpty();
    if (!spot) {
      solutionCount++;
      if (!firstSolution) firstSolution = cloneGrid(g);
      return countLimit !== null && solutionCount >= countLimit;
    }
    const [r, c] = spot;
    let candidates = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    if (randomize) candidates = shuffled(candidates);
    for (const val of candidates) {
      if (isValidPlacement(g, r, c, val)) {
        g[r][c] = val;
        if (backtrack()) return true;
        g[r][c] = 0;
      }
    }
    return false;
  }

  backtrack();
  return { count: solutionCount, solution: firstSolution };
}

function generateFullSolution() {
  const result = solve(emptyGrid(), { randomize: true, countLimit: 1 });
  return result.solution;
}

const DIFFICULTY_CLUES = {
  easy: 40,
  medium: 33,
  hard: 28,
  expert: 24,
};

// Generates a puzzle by digging holes from a full solution while
// preserving a unique solution.
function generatePuzzle(difficulty = "medium") {
  const solution = generateFullSolution();
  const puzzle = cloneGrid(solution);
  const targetClues = DIFFICULTY_CLUES[difficulty] ?? 33;

  const cells = shuffled(
    Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9])
  );

  let clues = 81;
  for (const [r, c] of cells) {
    if (clues <= targetClues) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    const { count } = solve(puzzle, { countLimit: 2 });
    if (count !== 1) {
      puzzle[r][c] = backup; // restore, removal broke uniqueness
    } else {
      clues--;
    }
  }

  return { puzzle, solution, clues };
}

// ------------------------------------------------------------
// Candidate computation
// ------------------------------------------------------------
function computeCandidates(grid) {
  const cands = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => new Set())
  );
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== 0) continue;
      for (let v = 1; v <= 9; v++) {
        if (isValidPlacement(grid, r, c, v)) cands[r][c].add(v);
      }
    }
  }
  return cands;
}

function unitsFor() {
  const units = [];
  for (let r = 0; r < SIZE; r++) units.push(Array.from({ length: 9 }, (_, c) => [r, c]));
  for (let c = 0; c < SIZE; c++) units.push(Array.from({ length: 9 }, (_, r) => [r, c]));
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const box = [];
      for (let dr = 0; dr < 3; dr++)
        for (let dc = 0; dc < 3; dc++) box.push([br * 3 + dr, bc * 3 + dc]);
      units.push(box);
    }
  }
  return units;
}
const ALL_UNITS = unitsFor();
function unitLabel(unit) {
  const rows = new Set(unit.map(([r]) => r));
  const cols = new Set(unit.map(([, c]) => c));
  if (rows.size === 1) return `row ${[...rows][0] + 1}`;
  if (cols.size === 1) return `column ${[...cols][0] + 1}`;
  return "box " + (Math.floor(unit[0][0] / 3) * 3 + Math.floor(unit[0][1] / 3) + 1);
}

// ------------------------------------------------------------
// Logical hint techniques, in increasing order of difficulty.
// Each returns a hint object or null if not applicable right now.
// ------------------------------------------------------------

function findNakedSingle(grid, cands) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0 && cands[r][c].size === 1) {
        const val = [...cands[r][c]][0];
        return {
          technique: "Naked Single",
          cell: [r, c],
          value: val,
          explanation: `Row ${r + 1}, column ${c + 1} only has one possible candidate left: ${val}. Every other number is already blocked by that row, column, or box.`,
        };
      }
    }
  }
  return null;
}

function findHiddenSingle(grid, cands) {
  for (const unit of ALL_UNITS) {
    for (let v = 1; v <= 9; v++) {
      const spots = unit.filter(([r, c]) => grid[r][c] === 0 && cands[r][c].has(v));
      if (spots.length === 1) {
        const [r, c] = spots[0];
        return {
          technique: "Hidden Single",
          cell: [r, c],
          value: v,
          explanation: `Look at ${unitLabel(unit)}: the number ${v} can only go in one cell there — row ${r + 1}, column ${c + 1} — even though that cell has other candidates too.`,
        };
      }
    }
  }
  return null;
}

function findPointingPair(grid, cands) {
  // If in a box, all candidates for value v lie in one row/col,
  // that value can be eliminated from the rest of that row/col.
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const boxCells = [];
      for (let dr = 0; dr < 3; dr++)
        for (let dc = 0; dc < 3; dc++) boxCells.push([br * 3 + dr, bc * 3 + dc]);
      for (let v = 1; v <= 9; v++) {
        const spots = boxCells.filter(([r, c]) => grid[r][c] === 0 && cands[r][c].has(v));
        if (spots.length < 2) continue;
        const rows = new Set(spots.map(([r]) => r));
        const cols = new Set(spots.map(([, c]) => c));
        if (rows.size === 1) {
          const r = [...rows][0];
          const affected = Array.from({ length: 9 }, (_, c) => [r, c])
            .filter(([, c]) => (Math.floor(c / 3) !== bc) && grid[r][c] === 0 && cands[r][c].has(v));
          if (affected.length > 0) {
            return {
              technique: "Pointing Pair",
              cell: affected[0],
              eliminateOnly: v,
              explanation: `In box ${br * 3 + bc + 1}, the number ${v} can only sit in row ${r + 1}. That means ${v} can be eliminated from the rest of row ${r + 1} outside this box — try cell row ${affected[0][0] + 1}, column ${affected[0][1] + 1}.`,
            };
          }
        } else if (cols.size === 1) {
          const c = [...cols][0];
          const affected = Array.from({ length: 9 }, (_, r) => [r, c])
            .filter(([r]) => (Math.floor(r / 3) !== br) && grid[r][c] === 0 && cands[r][c].has(v));
          if (affected.length > 0) {
            return {
              technique: "Pointing Pair",
              cell: affected[0],
              eliminateOnly: v,
              explanation: `In box ${br * 3 + bc + 1}, the number ${v} can only sit in column ${c + 1}. That means ${v} can be eliminated from the rest of column ${c + 1} outside this box — try cell row ${affected[0][0] + 1}, column ${affected[0][1] + 1}.`,
            };
          }
        }
      }
    }
  }
  return null;
}

function findNakedPair(grid, cands) {
  for (const unit of ALL_UNITS) {
    const twoCandCells = unit.filter(([r, c]) => grid[r][c] === 0 && cands[r][c].size === 2);
    for (let i = 0; i < twoCandCells.length; i++) {
      for (let j = i + 1; j < twoCandCells.length; j++) {
        const [r1, c1] = twoCandCells[i];
        const [r2, c2] = twoCandCells[j];
        const a = cands[r1][c1], b = cands[r2][c2];
        if (a.size === 2 && b.size === 2 && [...a].every(v => b.has(v))) {
          // found a naked pair — check if it eliminates anything elsewhere in unit
          const pairVals = [...a];
          const others = unit.filter(
            ([r, c]) => !(r === r1 && c === c1) && !(r === r2 && c === c2) && grid[r][c] === 0
          );
          for (const [r, c] of others) {
            if (pairVals.some(v => cands[r][c].has(v))) {
              return {
                technique: "Naked Pair",
                cell: [r, c],
                explanation: `Cells (${r1 + 1},${c1 + 1}) and (${r2 + 1},${c2 + 1}) in ${unitLabel(unit)} can only be ${pairVals.join(" or ")} between them. That rules those numbers out of the other cells in that same ${unitLabel(unit).split(" ")[0]} — look at row ${r + 1}, column ${c + 1}.`,
              };
            }
          }
        }
      }
    }
  }
  return null;
}

// Returns a tiered hint: a gentle nudge first, full reveal if requested.
function getHint(grid, revealLevel = "nudge") {
  const cands = computeCandidates(grid);
  const finders = [findNakedSingle, findHiddenSingle, findPointingPair, findNakedPair];
  let found = null;
  for (const fn of finders) {
    found = fn(grid, cands);
    if (found) break;
  }
  if (!found) {
    // fall back to brute-force solved value for the first empty cell
    const { solution } = solve(grid, { countLimit: 1 });
    if (!solution) return { technique: "None", explanation: "No hint available — check for mistakes on the board." };
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] === 0)
          return {
            technique: "Direct Reveal",
            cell: [r, c],
            value: solution[r][c],
            explanation: `This one needs a more advanced technique to explain simply. Row ${r + 1}, column ${c + 1} should be ${solution[r][c]}.`,
          };
  }

  if (revealLevel === "nudge") {
    return {
      technique: found.technique,
      cell: found.cell,
      explanation: `Try focusing on row ${found.cell[0] + 1}, column ${found.cell[1] + 1}. Technique: ${found.technique}.`,
      nudgeOnly: true,
    };
  }
  return found;
}

function isBoardComplete(grid) {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (grid[r][c] === 0) return false;
  return true;
}

function findConflicts(grid) {
  const conflicts = new Set();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (v === 0) continue;
      if (!isValidPlacement(grid, r, c, v)) conflicts.add(`${r},${c}`);
    }
  }
  return conflicts;
}

// ------------------------------------------------------------
// Variant constraints (killer cages, kropki dots). Classic row/col/box
// rules are unaffected by these — findConflicts still applies on top.
// ------------------------------------------------------------
function findVariantConflicts(grid, constraints) {
  const conflicts = new Set();
  if (!constraints) return conflicts;

  if (constraints.cages) {
    for (const cage of constraints.cages) {
      const seen = new Set();
      let sum = 0;
      let filledCount = 0;
      for (const [r, c] of cage.cells) {
        const v = grid[r][c];
        if (v === 0) continue;
        filledCount++;
        sum += v;
        if (seen.has(v)) {
          // duplicate digit within one cage — every cell holding that
          // digit in this cage is in conflict
          for (const [rr, cc] of cage.cells) {
            if (grid[rr][cc] === v) conflicts.add(`${rr},${cc}`);
          }
        }
        seen.add(v);
      }
      if (cage.sum != null) {
        const over = sum > cage.sum;
        const wrongTotal = filledCount === cage.cells.length && sum !== cage.sum;
        if (over || wrongTotal) {
          for (const [r, c] of cage.cells) {
            if (grid[r][c] !== 0) conflicts.add(`${r},${c}`);
          }
        }
      }
    }
  }

  if (constraints.kropki) {
    for (const dot of constraints.kropki) {
      const [ar, ac] = dot.a;
      const [br, bc] = dot.b;
      const av = grid[ar][ac];
      const bv = grid[br][bc];
      if (av === 0 || bv === 0) continue;
      const isConsecutive = Math.abs(av - bv) === 1;
      const isDouble = av === bv * 2 || bv === av * 2;
      const ok = dot.kind === "white" ? isConsecutive : isDouble;
      if (!ok) {
        conflicts.add(`${ar},${ac}`);
        conflicts.add(`${br},${bc}`);
      }
    }
  }

  return conflicts;
}

// Exported API
window.SudokuEngine = {
  generatePuzzle,
  solve,
  computeCandidates,
  getHint,
  isBoardComplete,
  findConflicts,
  findVariantConflicts,
  isValidPlacement,
  cloneGrid,
};
