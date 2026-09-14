# generate-oddeven

Generates Odd/Even Sudoku puzzles: classic rules, where some cells carry a
parity marker (odd/even) instead of — or as well as — a full given digit.

Starts from a full solved grid and greedily tries, for every cell, to drop
its full digit down to just a parity marker (or nothing at all), using a
parity-aware backtracking solver to confirm the puzzle stays uniquely
solvable at each step. Runs several full passes in different random
orders (`minimizePass`/`minimize`) since a single greedy pass is order-
dependent — a different cell order can shake loose reductions the first
pass missed.

```
node generate.js
```

Writes `oddeven-puzzles.json`; see `../generate-fog/enrich-and-format.js`
for turning that into pasteable `puzzles.js` entries.

Note: this is a much smaller search space reduction than some published
odd/even puzzles achieve (which can drop to zero digit givens, relying
entirely on parity) — the puzzles here settle around 19 digit givens plus
~7 parity markers. Getting meaningfully below that would need a smarter
(non-greedy) minimization strategy; noted here as a possible future
improvement rather than solved.
