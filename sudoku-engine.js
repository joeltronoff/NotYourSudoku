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

  // Negative kropki: every adjacent pair WITHOUT a dot must be confirmed
  // neither consecutive nor a 2:1 ratio (absence of a dot is itself
  // information, unlike the default "no dot = no info" convention above).
  if (constraints.kropkiNegative) {
    const dotted = new Set();
    for (const dot of constraints.kropki || []) {
      dotted.add(`${dot.a[0]},${dot.a[1]}-${dot.b[0]},${dot.b[1]}`);
      dotted.add(`${dot.b[0]},${dot.b[1]}-${dot.a[0]},${dot.a[1]}`);
    }
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const av = grid[r][c];
        if (av === 0) continue;
        const neighbors = [[r, c + 1], [r + 1, c]];
        for (const [nr, nc] of neighbors) {
          if (nr >= SIZE || nc >= SIZE) continue;
          const bv = grid[nr][nc];
          if (bv === 0) continue;
          if (dotted.has(`${r},${c}-${nr},${nc}`)) continue;
          const isConsecutive = Math.abs(av - bv) === 1;
          const isDouble = av === bv * 2 || bv === av * 2;
          if (isConsecutive || isDouble) {
            conflicts.add(`${r},${c}`);
            conflicts.add(`${nr},${nc}`);
          }
        }
      }
    }
  }

  if (constraints.littleKiller) {
    for (const clue of constraints.littleKiller) {
      const filled = clue.cells.filter(([r, c]) => grid[r][c] !== 0);
      const sum = filled.reduce((s, [r, c]) => s + grid[r][c], 0);
      const allFilled = filled.length === clue.cells.length;
      const over = sum > clue.sum;
      const wrongTotal = allFilled && sum !== clue.sum;
      if (over || wrongTotal) {
        for (const [r, c] of filled) conflicts.add(`${r},${c}`);
      }
    }
  }

  if (constraints.lines) {
    for (const line of constraints.lines) {
      const cells = line.cells;
      if (line.kind === "thermo") {
        for (let i = 1; i < cells.length; i++) {
          const [r1, c1] = cells[i - 1], [r2, c2] = cells[i];
          const v1 = grid[r1][c1], v2 = grid[r2][c2];
          if (v1 !== 0 && v2 !== 0 && v1 >= v2) {
            conflicts.add(`${r1},${c1}`);
            conflicts.add(`${r2},${c2}`);
          }
        }
      } else if (line.kind === "whispers") {
        // German whispers by default; Dutch whispers set diff to 4.
        const minDiff = line.diff || 5;
        for (let i = 1; i < cells.length; i++) {
          const [r1, c1] = cells[i - 1], [r2, c2] = cells[i];
          const v1 = grid[r1][c1], v2 = grid[r2][c2];
          if (v1 !== 0 && v2 !== 0 && Math.abs(v1 - v2) < minDiff) {
            conflicts.add(`${r1},${c1}`);
            conflicts.add(`${r2},${c2}`);
          }
        }
      } else if (line.kind === "between") {
        // Digits between the two circled ends lie strictly between them.
        const [ar, ac] = cells[0], [br, bc] = cells[cells.length - 1];
        const a = grid[ar][ac], b = grid[br][bc];
        if (a !== 0 && b !== 0) {
          const lo = Math.min(a, b), hi = Math.max(a, b);
          for (const [r, c] of cells.slice(1, -1)) {
            const v = grid[r][c];
            if (v !== 0 && (v <= lo || v >= hi)) {
              conflicts.add(`${r},${c}`);
              conflicts.add(`${ar},${ac}`);
              conflicts.add(`${br},${bc}`);
            }
          }
        }
      } else if (line.kind === "regionsum") {
        // Every box the line passes through holds the same total.
        const segments = [];
        for (const [r, c] of cells) {
          const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
          const last = segments[segments.length - 1];
          if (last && last.box === box) last.cells.push([r, c]);
          else segments.push({ box, cells: [[r, c]] });
        }
        const totals = segments
          .filter(s => s.cells.every(([r, c]) => grid[r][c] !== 0))
          .map(s => s.cells.reduce((sum, [r, c]) => sum + grid[r][c], 0));
        if (totals.length > 1 && new Set(totals).size > 1) {
          for (const [r, c] of cells) if (grid[r][c] !== 0) conflicts.add(`${r},${c}`);
        }
      } else if (line.kind === "entropic" || line.kind === "modular") {
        // Any three cells in a row along the line cover all three groups:
        // low/middle/high for entropic, the three remainders mod 3 for
        // modular. Equivalently, cells one or two apart differ in group.
        const groupOf = v => (line.kind === "entropic" ? Math.floor((v - 1) / 3) : v % 3);
        for (let i = 0; i < cells.length; i++) {
          for (const j of [i + 1, i + 2]) {
            if (j >= cells.length) continue;
            const [r1, c1] = cells[i], [r2, c2] = cells[j];
            const v1 = grid[r1][c1], v2 = grid[r2][c2];
            if (v1 !== 0 && v2 !== 0 && groupOf(v1) === groupOf(v2)) {
              conflicts.add(`${r1},${c1}`);
              conflicts.add(`${r2},${c2}`);
            }
          }
        }
      } else if (line.kind === "nabner") {
        // No two digits on the line repeat or are consecutive.
        for (let i = 0; i < cells.length; i++) {
          for (let j = i + 1; j < cells.length; j++) {
            const [r1, c1] = cells[i], [r2, c2] = cells[j];
            const v1 = grid[r1][c1], v2 = grid[r2][c2];
            if (v1 !== 0 && v2 !== 0 && Math.abs(v1 - v2) <= 1) {
              conflicts.add(`${r1},${c1}`);
              conflicts.add(`${r2},${c2}`);
            }
          }
        }
      } else if (line.kind === "palindrome") {
        for (let i = 0; i < Math.floor(cells.length / 2); i++) {
          const [r1, c1] = cells[i], [r2, c2] = cells[cells.length - 1 - i];
          const v1 = grid[r1][c1], v2 = grid[r2][c2];
          if (v1 !== 0 && v2 !== 0 && v1 !== v2) {
            conflicts.add(`${r1},${c1}`);
            conflicts.add(`${r2},${c2}`);
          }
        }
      } else if (line.kind === "renban") {
        const filled = cells.filter(([r, c]) => grid[r][c] !== 0);
        const seen = new Set();
        for (const [r, c] of filled) {
          const v = grid[r][c];
          if (seen.has(v)) {
            for (const [rr, cc] of cells) {
              if (grid[rr][cc] === v) conflicts.add(`${rr},${cc}`);
            }
          }
          seen.add(v);
        }
        if (filled.length === cells.length) {
          const values = filled.map(([r, c]) => grid[r][c]);
          const span = Math.max(...values) - Math.min(...values);
          if (span !== cells.length - 1) {
            for (const [r, c] of cells) conflicts.add(`${r},${c}`);
          }
        }
      }
    }
  }

  if (constraints.arrows) {
    for (const arrow of constraints.arrows) {
      const [cr, cc] = arrow.circle;
      const circleVal = grid[cr][cc];
      if (circleVal === 0) continue;
      let sum = 0;
      let allFilled = true;
      for (const [r, c] of arrow.cells) {
        const v = grid[r][c];
        if (v === 0) { allFilled = false; continue; }
        sum += v;
      }
      const over = sum > circleVal;
      const wrongTotal = allFilled && sum !== circleVal;
      if (over || wrongTotal) {
        conflicts.add(`${cr},${cc}`);
        for (const [r, c] of arrow.cells) {
          if (grid[r][c] !== 0) conflicts.add(`${r},${c}`);
        }
      }
    }
  }

  if (constraints.antiKnight) {
    const KNIGHT_OFFSETS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = grid[r][c];
        if (v === 0) continue;
        for (const [dr, dc] of KNIGHT_OFFSETS) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr > 8 || cc < 0 || cc > 8) continue;
          if (grid[rr][cc] === v) {
            conflicts.add(`${r},${c}`);
            conflicts.add(`${rr},${cc}`);
          }
        }
      }
    }
  }

  if (constraints.antiKing) {
    const KING_OFFSETS = [[-1, -1], [-1, 1], [1, -1], [1, 1]]; // diagonals; orthogonal pairs already share a house
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = grid[r][c];
        if (v === 0) continue;
        for (const [dr, dc] of KING_OFFSETS) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr > 8 || cc < 0 || cc > 8) continue;
          if (grid[rr][cc] === v) {
            conflicts.add(`${r},${c}`);
            conflicts.add(`${rr},${cc}`);
          }
        }
      }
    }
  }

  if (constraints.nonConsecutive) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = grid[r][c];
        if (v === 0) continue;
        for (const [nr, nc] of [[r, c + 1], [r + 1, c]]) {
          if (nr > 8 || nc > 8) continue;
          const nv = grid[nr][nc];
          if (nv !== 0 && Math.abs(v - nv) === 1) {
            conflicts.add(`${r},${c}`);
            conflicts.add(`${nr},${nc}`);
          }
        }
      }
    }
  }

  // Disjoint groups: cells in the same position within their box form a
  // group that holds each digit once (top-left cells of all nine boxes, etc).
  if (constraints.disjointGroups) {
    for (let pos = 0; pos < 9; pos++) {
      const seen = new Map();
      for (let box = 0; box < 9; box++) {
        const r = Math.floor(box / 3) * 3 + Math.floor(pos / 3);
        const c = (box % 3) * 3 + (pos % 3);
        const v = grid[r][c];
        if (v === 0) continue;
        if (seen.has(v)) {
          conflicts.add(`${r},${c}`);
          const [pr, pc] = seen.get(v);
          conflicts.add(`${pr},${pc}`);
        }
        seen.set(v, [r, c]);
      }
    }
  }

  if (constraints.extraRegions) {
    for (const region of constraints.extraRegions) {
      const seen = new Map();
      for (const [r, c] of region) {
        const v = grid[r][c];
        if (v === 0) continue;
        if (seen.has(v)) {
          conflicts.add(`${r},${c}`);
          const [pr, pc] = seen.get(v);
          conflicts.add(`${pr},${pc}`);
        }
        seen.set(v, [r, c]);
      }
    }
  }

  // Quadruple: the digits shown in the little circle all appear in the four
  // cells around it (repeated digits must appear that many times).
  if (constraints.quadruples) {
    for (const quad of constraints.quadruples) {
      const values = quad.cells.map(([r, c]) => grid[r][c]);
      const blanks = values.filter(v => v === 0).length;
      const pool = values.filter(v => v !== 0);
      let short = 0;
      for (const need of new Set(quad.values)) {
        const required = quad.values.filter(v => v === need).length;
        const have = pool.filter(v => v === need).length;
        if (have < required) short += required - have;
      }
      if (short > blanks) {
        for (const [r, c] of quad.cells) if (grid[r][c] !== 0) conflicts.add(`${r},${c}`);
      }
    }
  }

  if (constraints.sandwich) {
    const sandwichSum = (cells) => {
      const idx1 = cells.findIndex(([r, c]) => grid[r][c] === 1);
      const idx9 = cells.findIndex(([r, c]) => grid[r][c] === 9);
      if (idx1 === -1 || idx9 === -1) return null;
      const lo = Math.min(idx1, idx9), hi = Math.max(idx1, idx9);
      const between = cells.slice(lo + 1, hi);
      const filled = between.filter(([r, c]) => grid[r][c] !== 0);
      const sum = filled.reduce((s, [r, c]) => s + grid[r][c], 0);
      const allFilled = filled.length === between.length;
      return { between, sum, allFilled };
    };
    const checkLine = (cells, clue) => {
      if (clue == null) return;
      const result = sandwichSum(cells);
      if (!result) return;
      const { between, sum, allFilled } = result;
      const over = sum > clue;
      const wrongTotal = allFilled && sum !== clue;
      if (over || wrongTotal) {
        for (const [r, c] of between) {
          if (grid[r][c] !== 0) conflicts.add(`${r},${c}`);
        }
      }
    };
    const rowsClues = constraints.sandwich.rows || [];
    for (let r = 0; r < 9; r++) {
      checkLine(Array.from({ length: 9 }, (_, c) => [r, c]), rowsClues[r]);
    }
    const colsClues = constraints.sandwich.cols || [];
    for (let c = 0; c < 9; c++) {
      checkLine(Array.from({ length: 9 }, (_, r) => [r, c]), colsClues[c]);
    }
  }

  if (constraints.xv) {
    for (const pair of constraints.xv) {
      const [ar, ac] = pair.a;
      const [br, bc] = pair.b;
      const av = grid[ar][ac], bv = grid[br][bc];
      if (av === 0 || bv === 0) continue;
      const target = pair.kind === "X" ? 10 : 5;
      if (av + bv !== target) {
        conflicts.add(`${ar},${ac}`);
        conflicts.add(`${br},${bc}`);
      }
    }
  }

  // diagonals: true for both long diagonals, or "main" (top-left to
  // bottom-right) / "anti" (top-right to bottom-left) for just one.
  if (constraints.diagonals) {
    const diag1 = Array.from({ length: 9 }, (_, i) => [i, i]);
    const diag2 = Array.from({ length: 9 }, (_, i) => [i, 8 - i]);
    const marked = [];
    if (constraints.diagonals !== "anti") marked.push(diag1);
    if (constraints.diagonals !== "main") marked.push(diag2);
    for (const diag of marked) {
      const seen = new Map();
      for (const [r, c] of diag) {
        const v = grid[r][c];
        if (v === 0) continue;
        if (seen.has(v)) {
          conflicts.add(`${r},${c}`);
          const [pr, pc] = seen.get(v);
          conflicts.add(`${pr},${pc}`);
        }
        seen.set(v, [r, c]);
      }
    }
  }

  if (constraints.oddEven) {
    for (const clue of constraints.oddEven) {
      const [r, c] = clue.cell;
      const v = grid[r][c];
      if (v === 0) continue;
      const isOdd = v % 2 === 1;
      if ((clue.parity === "odd") !== isOdd) conflicts.add(`${r},${c}`);
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
