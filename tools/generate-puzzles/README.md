# generate-puzzles

Generates additional verified puzzles for `puzzles.js` when no real
puzzle source is available (see `tools/import-fpuzzles` for importing
real ones from a self-contained f-puzzles/SudokuPad link instead).

Every grid is built by permuting the shared base solution (digit
relabeling + band/stack/row/column shuffles, or for anti-knight puzzles
only the subset of transforms that preserve knight-safety), then each
puzzle's constraints are derived directly from that grid's actual values
— never invented — and checked against `sudoku-engine.js`'s own
`findVariantConflicts`/`findConflicts` before being accepted. A puzzle
whose solution grid exactly duplicates an existing one (new or
hand-authored) is rejected and retried with a fresh grid.

## Usage

```
node gen.js       # writes generated.json (5 puzzles per category)
node format.js    # reads generated.json, writes snippet.js: puzzles.js-
                   # ready object literals, one section per category
```

`snippet.js`'s content can then be pasted into `window.PuzzleLibrary` in
`/puzzles.js` (before the closing `];`). Re-run the app's test suite
afterward — this only guarantees each puzzle is internally consistent,
not that it renders or plays well.
