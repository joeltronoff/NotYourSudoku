# import-fpuzzles

A one-off maintenance script (not shipped with the app) that decodes a
self-contained f-puzzles / SudokuPad puzzle link and converts it into a
`puzzles.js`-compatible entry for Solver's Notebook.

## Setup

```
cd tools/import-fpuzzles
npm install
```

## Usage

```
node convert.js "https://f-puzzles.com/?load=<data>"
node convert.js "https://sudokupad.app/<slug>fpuzzles<data>"
node convert.js "<raw-lz-string-data>"
```

Prints the decoded raw puzzle plus a converted `puzzles.js` entry (or a
list of errors if the puzzle can't be imported).

## What it needs to succeed

- **A self-contained link.** Short SudokuPad IDs (e.g. `sudokupad.app/abc123`)
  aren't decodable this way — they reference SudokuPad's own database. Look
  for the long encoded kind, or an `f-puzzles.com/?load=...` link specifically.
- **A verified `solution` field in the export.** Solver's Notebook uses the
  true solution for mistake tracking, not just constraint validation, so the
  script refuses to import a puzzle without one rather than guess.
- **Only supported constraint types**: killer cages, kropki dots (default
  1/2 values only), thermometers, German whispers (diff ≥ 5 only), renban,
  palindrome, arrows (single-cell circle only), anti-knight, sandwich sums,
  and XV. Anything else (extra regions, quadruples, little killer, clones,
  diagonals, anti-king, etc.) makes the script reject the puzzle rather than
  silently drop a rule — those need new engine support first.

## After converting

The script only prints the entry — it doesn't touch `puzzles.js` itself.
Copy the printed `entry` object into `window.PuzzleLibrary` in
`/puzzles.js`, double-check the `blurb`, and playtest it in the app before
committing.
