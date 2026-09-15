# generate-diagonal

Generates Diagonal (X) Sudoku puzzles: classic rules plus both main
diagonals must also contain every digit 1-9. Self-contained solver and
hole-digger (sudoku-engine.js's `solve()` doesn't know about diagonals, so
this can't reuse it directly) — same digging-while-checking-uniqueness
approach as the main engine's `generatePuzzle`, just with the diagonal
constraint folded into `isValid`.

```
node generate.js
```

Writes `diagonal-puzzles.json`; see `../generate-fog/enrich-and-format.js`
for turning that into pasteable `puzzles.js` entries.
