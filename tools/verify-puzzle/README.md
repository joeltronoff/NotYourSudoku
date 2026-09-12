# verify-puzzle

Tools for constructing genuinely elegant variant-sudoku puzzles: a real
logical solver to confirm a candidate puzzle is **uniquely** solvable
**by pure deduction** (no guessing), and to report exactly which solving
techniques it actually requires — the same taxonomy real setters use to
grade difficulty (Hidden Single → Locked Candidates → Naked Pairs →
X-Wing/XY-Wing/Swordfish → Forcing Chains).

This is a different job from `tools/generate-puzzles`, which only checks
that a puzzle's stored solution doesn't *conflict* with its own rules —
it says nothing about whether the puzzle is uniquely solvable or how hard
it really is. This tool answers both.

## One-time setup

Needs a Rust toolchain (`cargo`/`rustc`) and network access to
`index.crates.io` and `github.com` (not blocked in most sandboxes, unlike
actual puzzle-hosting sites).

```sh
git clone https://github.com/lisudoku/lisudoku_solver.git /tmp/lisudoku_solver
mkdir -p /tmp/lisudoku_solver/src/bin
cp verify.rs /tmp/lisudoku_solver/src/bin/verify.rs
cd /tmp/lisudoku_solver
cargo build --bin verify
```

## Checking one candidate puzzle

Write the puzzle as JSON in `lisudoku_solver`'s own `SudokuConstraints`
schema (camelCase; see `src/types/constraints.rs` in that repo for every
field — it supports killer cages, kropki dots, thermos, arrows, renbans,
palindromes, anti-knight, anti-king, diagonals, extra regions, odd/even,
and more). `gridSize` is required; everything else is optional. Example:

```json
{
  "gridSize": 9,
  "antiKnight": true,
  "kropkiDots": [
    { "dotType": "Consecutive", "cell1": { "row": 0, "col": 1 }, "cell2": { "row": 0, "col": 2 } },
    { "dotType": "Double", "cell1": { "row": 0, "col": 2 }, "cell2": { "row": 1, "col": 2 } }
  ]
}
```

Then:

```sh
cd /tmp/lisudoku_solver
cargo run --bin verify -- path/to/candidate.json
```

Prints `solution_count` (must be 1 for a real puzzle), `solution_type`
(`Full` means solvable by pure logic — `Partial`/`None` means it needs
guessing or is broken), and a breakdown of exactly which named techniques
were needed and how many times.

## Minimizing a puzzle (the actual design step)

The real construction workflow: start from a valid solution grid, decorate
it as richly as you like (every kropki dot the grid supports, every
thermo/arrow that happens to work, etc.), verify it's already uniquely
solvable with zero or few givens, then run:

```sh
node minimize.js candidate.json minimized.json kropkiDots
```

This greedily removes entries from the named field (one at a time, in a
shuffled order) and keeps each removal only if the puzzle is still
uniquely and fully logically solvable **without** using any technique in
`BANNED_TECHNIQUES` at the top of the script (defaults to just
`NishioForcingChains` — forcing chains are the one technique commonly
considered "not elegant," since it's effectively guess-and-backtrack
dressed up as logic; everything up through X-Wing/XY-Wing/Swordfish/Turbot
Fish/Empty Rectangles/Phistomefel Ring stays fair game). Edit that list to
raise or lower the difficulty ceiling for a specific puzzle.

The result is the minimal (locally — depends on removal order/seed, not
globally optimal) set of clues/decorations that still holds the puzzle
together, along with the exact technique list needed to crack it — your
real difficulty signal. Convert the surviving constraints into Solver's
Notebook's own `puzzles.js` schema by hand (cell coordinates and kropki
dot types map directly; see any existing multi-variant entry in
`puzzles.js` for the target shape) and cross-check with
`tools/generate-puzzles`' engine-validation approach before adding it.
