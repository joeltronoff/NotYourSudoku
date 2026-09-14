# generate-fog

Generates Fog of War puzzles for Solver's Notebook: a classic sudoku plus
a `fog: { reveal, radius }` field naming which cells are visible from the
start. Everything else stays covered until the player fills a cell
correctly, at which point its neighborhood (within `radius`, Chebyshev
distance) becomes visible too.

## The one thing that isn't obvious: why givens don't light each other up

The natural first implementation treats any visible cell holding its
correct value as a light source — a given trivially qualifies, since it
already equals the solution. That's wrong in practice: `state.grid` holds
every given from the moment a puzzle loads, fog or not, so the instant one
given becomes visible it "solves" itself for free and lights its
neighbors — which may contain more givens, which light their own
neighbors, and so on. Givens are dense enough in a normal sudoku (even a
sparse 20-clue one) that this cascades across nearly the entire grid
before the player has done anything at all. Measured directly: a 40-given
puzzle with this naive rule revealed 80/81 cells on load.

The fix (implemented in both `app.js`'s `computeFogRevealed` and this
generator's `simulate`/`growReveal`): only a cell the player has actually
solved — i.e. a **non-given** cell holding its correct value — propagates
the reveal further. A given, once visible, still helps deduce its
neighbors (it's a real, known value for candidate elimination) but does
not by itself spread the fog any further. The one exception is the
initial reveal seed: those cells' neighborhoods light up once,
unconditionally, as the puzzle's starting condition — otherwise nothing
would ever get started.

## Why the seed has to be fairly large

With that fix in place, small seeds (single digits) mostly fail to fully
uncover the grid — deduction can only ever propagate outward from actual
solves, and too few starting threads dead-end before they connect. All
six shipped puzzles use an "easy" (40-given) base grid with a seed of
13–24 cells; the seed size is the difficulty lever (fewer seed cells means
more of the grid depends on genuine deduction), not the underlying
puzzle's clue count.

## Soundness of the deduction check

`simulate()` verifies a candidate seed by replaying what a player could
deduce using only currently-visible information — never anything hidden:

- **Naked single**: a visible blank cell whose visible peers already rule
  out 8 digits. Hidden peers could only rule out more, never fewer, so a
  single surviving candidate is always the true value.
- **Hidden single, restricted to units that are entirely visible**: within
  such a unit, if a digit's visible-peer-candidate check clears every
  blank cell but one, every other cell in the unit is already excluded by
  a visible constraint, so the digit is forced into the remaining cell —
  regardless of anything still hidden outside the unit.

If a seed doesn't fully cascade the grid this way, it's rejected — no
Fog of War puzzle in the library requires guessing.

## Usage

```
node generate.js
```

Writes `fog-puzzles.json`. Then enrich with blurbs and format for
`puzzles.js` (also produces the diagonal/odd-even sections from their own
sibling tool directories):

```
node enrich-and-format.js
```

Writes `formatted-entries.txt`, ready to paste into `puzzles.js`'s
`window.PuzzleLibrary` array — playtest before committing.
