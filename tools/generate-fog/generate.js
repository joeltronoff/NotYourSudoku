// Generates Fog of War puzzles: a classic sudoku, plus a small "seed" of
// initially-revealed cells such that pure naked-single / fully-visible-unit
// hidden-single deduction fully uncovers the whole grid with no guessing.
// This exactly mirrors the app's computeFogRevealed(): only a cell the
// PLAYER has actually solved lights its own neighborhood further -- a
// given just sits there once revealed, still useful for deducing its
// neighbors but not itself spreading the reveal any further. Only the
// initial seed's neighborhoods light up unconditionally, as the puzzle's
// starting condition. (See the comment above computeFogRevealed in app.js
// for why: without that rule, two givens near each other reveal one
// another for free, and givens are normally dense enough that this
// cascades across nearly the whole grid before the player does anything.)
"use strict";
global.window = {};
require("../../sudoku-engine.js");
const { generatePuzzle } = global.window.SudokuEngine;

function peersOf(r, c) {
  const list = [];
  for (let i = 0; i < 9; i++) {
    if (i !== c) list.push([r, i]);
    if (i !== r) list.push([i, c]);
  }
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++)
    for (let dc = 0; dc < 3; dc++) {
      const rr = br + dr, cc = bc + dc;
      if (rr !== r || cc !== c) list.push([rr, cc]);
    }
  return list;
}
const UNITS = (() => {
  const units = [];
  for (let r = 0; r < 9; r++) units.push(Array.from({ length: 9 }, (_, c) => [r, c]));
  for (let c = 0; c < 9; c++) units.push(Array.from({ length: 9 }, (_, r) => [r, c]));
  for (let br = 0; br < 3; br++)
    for (let bc = 0; bc < 3; bc++) {
      const box = [];
      for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) box.push([br * 3 + dr, bc * 3 + dc]);
      units.push(box);
    }
  return units;
})();
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function boxOf(r, c) { return Math.floor(r / 3) * 3 + Math.floor(c / 3); }

// Mirrors app.js's computeFogRevealed exactly: the seed's neighborhoods
// light up unconditionally (the puzzle's starting condition); after that,
// only a solved NON-given cell propagates further.
function growReveal(givens, grid, solution, seed, radius) {
  const revealed = new Set(seed.map(([r, c]) => `${r},${c}`));
  function lightNeighbors(r, c) {
    for (let dr = -radius; dr <= radius; dr++)
      for (let dc = -radius; dc <= radius; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr > 8 || nc < 0 || nc > 8) continue;
        revealed.add(`${nr},${nc}`);
      }
  }
  for (const [r, c] of seed) {
    if (grid[r][c] !== 0 && grid[r][c] === solution[r][c]) lightNeighbors(r, c);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of [...revealed]) {
      const [r, c] = key.split(",").map(Number);
      if (givens[r][c] !== 0) continue;
      if (grid[r][c] === 0 || grid[r][c] !== solution[r][c]) continue;
      const before = revealed.size;
      lightNeighbors(r, c);
      if (revealed.size !== before) changed = true;
    }
  }
  return revealed;
}

// A full player-side simulation: starts knowing only the seed, then
// alternates (a) the reveal-growth rule above, using "known" (deduced or
// given) values as the current grid, and (b) sound deductions -- naked
// singles from visible peers, plus hidden singles within units that are
// entirely visible -- until nothing changes.
function simulate(solution, givens, seed, radius) {
  const known = new Map(); // "r,c" -> value, for cells the "player" has pinned down
  let visible = new Set();

  function candidatesFromVisiblePeers(r, c) {
    const used = new Set();
    for (const [pr, pc] of peersOf(r, c)) {
      const pk = `${pr},${pc}`;
      if (visible.has(pk) && known.has(pk)) used.add(known.get(pk));
    }
    const cands = [];
    for (let v = 1; v <= 9; v++) if (!used.has(v)) cands.push(v);
    return cands;
  }
  function commit(r, c, v) {
    if (v !== solution[r][c]) throw new Error(`unsound deduction at ${r},${c}`);
    known.set(`${r},${c}`, v);
  }

  let progress = true;
  while (progress) {
    progress = false;

    // Rebuild the "grid" the reveal rule sees: known values only (givens
    // the player hasn't deduced yet are NOT assumed known, even though
    // they're baked into the real puzzle -- fog hides them until visible).
    const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
    for (const [key, v] of known) {
      const [r, c] = key.split(",").map(Number);
      grid[r][c] = v;
    }
    const newVisible = growReveal(givens, grid, solution, seed, radius);
    for (const key of newVisible) {
      if (!visible.has(key)) {
        progress = true;
        const [r, c] = key.split(",").map(Number);
        if (givens[r][c] !== 0 && !known.has(key)) commit(r, c, givens[r][c]);
      }
    }
    visible = newVisible;

    // Naked singles.
    for (const key of [...visible]) {
      if (known.has(key)) continue;
      const [r, c] = key.split(",").map(Number);
      const cands = candidatesFromVisiblePeers(r, c);
      if (cands.length === 1) { commit(r, c, cands[0]); progress = true; }
    }
    // Hidden singles, restricted to units that are entirely visible (sound
    // even with partial global visibility -- see the file-level comment).
    for (const unit of UNITS) {
      if (!unit.every(([r, c]) => visible.has(`${r},${c}`))) continue;
      const blanks = unit.filter(([r, c]) => !known.has(`${r},${c}`));
      for (let v = 1; v <= 9; v++) {
        if (unit.some(([r, c]) => known.get(`${r},${c}`) === v)) continue;
        const spots = blanks.filter(([r, c]) => candidatesFromVisiblePeers(r, c).includes(v));
        if (spots.length === 1) { commit(spots[0][0], spots[0][1], v); progress = true; }
      }
    }
  }
  return { visible, known, fullySolved: known.size === 81 };
}

function allCells() { return Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9]); }

// Picks a seed of `targetSize` cells (mixing givens and blanks, spread
// across distinct boxes where possible) and checks it fully cascades.
function findSeed(solution, givens, targetSize, attempts) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const shuffled = shuffle(allCells());
    const usedBoxes = new Set();
    const spread = [];
    for (const cell of shuffled) {
      if (spread.length >= targetSize) break;
      const b = boxOf(cell[0], cell[1]);
      if (!usedBoxes.has(b)) { usedBoxes.add(b); spread.push(cell); }
    }
    for (const cell of shuffled) {
      if (spread.length >= targetSize) break;
      if (!spread.some(([r, c]) => r === cell[0] && c === cell[1])) spread.push(cell);
    }
    const seed = spread.slice(0, targetSize);
    // A seed needs at least one given in it, or there's nothing to deduce from.
    if (!seed.some(([r, c]) => givens[r][c] !== 0)) continue;
    const result = simulate(solution, givens, seed, 1);
    if (result.fullySolved) return seed;
  }
  return null;
}

function generateOne(difficulty, seedSize, seedAttempts, puzzleAttempts) {
  for (let p = 0; p < puzzleAttempts; p++) {
    const { puzzle, solution } = generatePuzzle(difficulty);
    const seed = findSeed(solution, puzzle, seedSize, seedAttempts);
    if (seed) return { givens: puzzle, solution, seed };
  }
  return null;
}

// All six use an "easy" (40-given) base grid -- empirically, this reveal
// rule needs a real double-digit seed to have enough independent starting
// threads for naked/hidden singles to ever connect them all, and sparser
// bases (medium/hard) push that minimum seed size up high enough to leave
// little room for a difficulty ladder. Seed size is the difficulty lever
// instead: fewer initially-visible cells means more of the grid has to
// come from genuine deduction rather than just being handed to you.
const specs = [
  { id: "fog-1", title: "First Light", difficulty: "easy", seedSize: 24, stars: 3 },
  { id: "fog-2", title: "Burning Off", difficulty: "easy", seedSize: 20, stars: 4 },
  { id: "fog-3", title: "Low Visibility", difficulty: "easy", seedSize: 18, stars: 5 },
  { id: "fog-4", title: "Whiteout", difficulty: "easy", seedSize: 16, stars: 6 },
  { id: "fog-5", title: "Zero Visibility", difficulty: "easy", seedSize: 14, stars: 7 },
  { id: "fog-6", title: "Blind Spot", difficulty: "easy", seedSize: 13, stars: 8 },
];

const results = [];
for (const spec of specs) {
  process.stdout.write(`Generating ${spec.id} (${spec.title})... `);
  const out = generateOne(spec.difficulty, spec.seedSize, 400, 20);
  if (!out) {
    console.log("FAILED — no cascading seed found");
    continue;
  }
  const clueCount = out.givens.flat().filter(v => v !== 0).length;
  console.log(`ok (${clueCount} givens, seed of ${out.seed.length})`);
  results.push({
    id: spec.id,
    title: spec.title,
    stars: spec.stars,
    givens: out.givens,
    solution: out.solution,
    fog: { reveal: out.seed.map(([r, c]) => [r, c]), radius: 1 },
  });
}

require("fs").writeFileSync(
  __dirname + "/fog-puzzles.json",
  JSON.stringify(results, null, 2)
);
console.log(`\nWrote ${results.length}/${specs.length} puzzles to fog-puzzles.json`);
