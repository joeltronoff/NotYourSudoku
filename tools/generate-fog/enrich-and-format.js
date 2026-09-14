"use strict";
const fs = require("fs");
const { execFileSync } = require("child_process");

// Extra per-id flavor text appended after the auto-computed clue-count
// sentence, so blurbs stay accurate even if a puzzle gets regenerated.
const FLAVOR = {
  "fog-1": " Fill a visible cell correctly and the fog burns off around it.",
  "fog-6": " Fewer clues, and less of the grid to see them by.",
  "diagonal-3": " The diagonal constraint is doing most of the heavy lifting here.",
  "oddeven-1": " Shaded circles must be odd, shaded squares even.",
  "oddeven-3": " The trickiest of the three.",
};

function givenCount(grid) { return grid.flat().filter(v => v !== 0).length; }

// How many cells are actually visible the instant the puzzle loads: the
// seed itself, plus the one-hop neighborhood of any seed cell that's
// already a given (mirrors app.js's computeFogRevealed at grid = givens).
function initialRevealedCount(givens, solution, seed, radius) {
  const revealed = new Set(seed.map(([r, c]) => `${r},${c}`));
  for (const [r, c] of seed) {
    if (givens[r][c] === 0 || givens[r][c] !== solution[r][c]) continue;
    for (let dr = -radius; dr <= radius; dr++)
      for (let dc = -radius; dc <= radius; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr > 8 || nc < 0 || nc > 8) continue;
        revealed.add(`${nr},${nc}`);
      }
  }
  return revealed.size;
}

function enrich(file, variantKey, blurbFn) {
  const entries = JSON.parse(fs.readFileSync(file, "utf8"));
  return entries.map(e => ({
    ...e,
    blurb: blurbFn(e) + (FLAVOR[e.id] || ""),
    variants: [variantKey],
  }));
}

const all = [
  ...enrich(__dirname + "/../generate-diagonal/diagonal-puzzles.json", "diagonal",
    e => `${givenCount(e.givens)} givens — both long diagonals also hold every digit 1–9, same as a row.`),
  ...enrich(__dirname + "/../generate-oddeven/oddeven-puzzles.json", "oddeven",
    e => `${givenCount(e.givens)} givens plus ${e.oddEven.length} parity clues.`),
  ...enrich(__dirname + "/fog-puzzles.json", "fog",
    e => `${givenCount(e.givens)} givens, only ${initialRevealedCount(e.givens, e.solution, e.fog.reveal, e.fog.radius)} cells visible at the start.`),
];

const tmp = __dirname + "/_enriched.json";
fs.writeFileSync(tmp, JSON.stringify(all, null, 2));

const out = execFileSync("node", [__dirname + "/format-entries.js", tmp], { encoding: "utf8" });
fs.writeFileSync(__dirname + "/formatted-entries.txt", out);
console.log("Wrote formatted-entries.txt (" + all.length + " entries)");
