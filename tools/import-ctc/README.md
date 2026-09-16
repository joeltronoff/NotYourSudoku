# import-ctc

Bulk-imports puzzles featured on Cracking the Cryptic into
`/puzzles-ctc.js`, keeping only the ones this app can represent exactly and
that verify as uniquely solvable.

## How it works

| Step | Script | What it does |
| --- | --- | --- |
| 1 | `1-candidates.js` | Downloads the fan-maintained [CTC Catalogue](https://ctc-catalogue.com/) (a public Google Sheet, one row per video) and keeps sudoku videos whose constraint tags are all rules the app supports. → `candidates.json` |
| 2 | `2-links.js` | Reads each video's YouTube description and extracts the puzzle link CTC posts there. ~1 request per 1–2 s. → `links.json` |
| 3 | `3-fetch.js` | Follows short links and downloads each puzzle from SudokuPad's puzzle API (SudokuPad `scl`, zipped JSON, or f-puzzles formats). → `fetched.json` |
| 4 | `4-build.js` | Converts, verifies, de-duplicates, and writes `/puzzles-ctc.js`. → `report.json` |

Every download is cached under `cache/` (git-ignored), so any step can be
re-run or interrupted and resumed without re-fetching.

```sh
cd tools/import-ctc
npm install
node 1-candidates.js          # --refresh to re-download the catalogue
node 2-links.js               # slow the first time (~1 hour for ~2,000 videos)
node 3-fetch.js
node 4-build.js
```

To pick up newly catalogued videos later, run `node 1-candidates.js --refresh`
and then the other steps. Cached videos and puzzles are skipped.

## Rules the app can enforce

Killer cages (with or without a total), kropki dots (plus the full negative
rule), XV, sandwich sums, little killer, thermometers, arrows, German and
Dutch whispers, renban, palindromes, between lines, region sum lines,
entropic lines, modular lines, nabner lines, quadruples, odd/even cells,
extra regions, diagonals (one or both), anti-knight, anti-king,
non-consecutive, disjoint groups, and fog of war (including puzzles where
solving one cell uncovers a region elsewhere).

A video is only considered if every constraint the catalogue lists for it is
on that list; `1-candidates.js` holds the mapping.

## What gets imported

A puzzle only makes it into `puzzles-ctc.js` if **all** of these hold:

1. **Every drawn element is recognised** (`convert.js`). SudokuPad's format
   is visual: coloured lines, circles and text. Constraint kinds are inferred
   from shape, colour and the rules text. For example, "blue lines are
   renban" overrides the usual pink-means-renban convention. Anything
   unrecognised rejects the puzzle; nothing is silently dropped. Rules text
   mentioning something the app can't enforce (wobbly/Dutch whispers,
   triple-ratio dots, fog, extra regions and so on) also rejects it.
2. **Exactly one solution under this app's rules** (`solver.js`, a
   constraint-propagating solver with the same semantics as
   `sudoku-engine.js`). If the setter had an extra rule that the conversion
   missed, the app's version usually has several solutions and is rejected
   here.
3. **That solution matches the setter's published solution** (almost all
   SudokuPad puzzles include one). This catches misread rules that still
   happen to leave one solution.
4. **The app's own conflict checker accepts it** (`app-engine.js` loads the
   real `sudoku-engine.js` in Node).
5. **Not a duplicate** of a puzzle already in the library.

`report.json` lists every video with its outcome, and `4-build.js` prints a
tally of rejection reasons. The tally is the place to start when extending
the converter: `node inspect.js "<reason regex>" 5` dumps the raw puzzle
data behind a rejection reason.

GAS (Genuinely Approachable Sudoku) roundups in video descriptions are
imported too, each as its own puzzle, with stars from the posted target
time.

Verification results are cached in `cache/verify`, keyed by the payload and
a hash of `convert.js`, `solver.js` and `sudoku-engine.js`. A rebuild after
unrelated changes takes seconds, and editing the converter or solver
re-verifies everything automatically.

Star ratings come from the length of the CTC video (how long an expert
took), not from a technique analysis like `tools/verify-puzzle`.

## Attribution

Each puzzle belongs to its setter. Entries credit the setter in the blurb and
keep `source.video` / `source.puzzle` links. The in-game rules panel links
back to the CTC video, since the catalogue deliberately routes people through
YouTube to support the channel.
