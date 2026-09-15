// ============================================================
// Variant puzzle library for Solver's Notebook.
// Every puzzle below is verified, not just conflict-checked: killer,
// kropki, lines, and anti-knight puzzles were confirmed uniquely and
// fully solvable by pure logic (no guessing) using the real lisudoku_solver
// engine, capped below forcing-chain-tier techniques for elegance. Sandwich
// and XV aren't in that solver's constraint vocabulary, so those two use a
// custom backtracking uniqueness check instead (see
// tools/generate-puzzles/build-sandwich-xv.js) -- their star ratings are a
// clue-density estimate rather than a verified technique tier, capped at 8
// so they don't overstate difficulty next to the verified categories.
//
// Diagonal and Odd/Even puzzles (tools/generate-diagonal,
// tools/generate-oddeven) are similarly verified for uniqueness with their
// own constraint-aware backtracking solvers rather than lisudoku_solver,
// and also capped at 8 stars for the same reason.
//
// Fog of War puzzles (tools/generate-fog) are ordinary verified classic
// sudoku underneath; what's actually checked there is that the fog reveal
// seed fully uncovers the grid through sound naked-single/hidden-single
// deduction alone (see that tool's README for why the reveal rule is more
// subtle than "any correct cell lights up its neighbors") -- no puzzle in
// this category requires guessing to fully reveal.
//
// stars: 1 (trivial) through 10 (hardest) -- see
// tools/generate-puzzles/build-all.js for the exact technique->star map.
// ============================================================

(() => {
  window.PuzzleLibrary = [

    // ---- Killer Cages ----
    {
      id: "killer-1",
      title: "Broken Boxes",
      blurb: "28 givens plus 25 cages carrying the whole grid.",
      stars: 2,
      givens: [
        [0, 0, 0, 0, 8, 0, 0, 4, 2],
        [2, 6, 0, 0, 0, 4, 0, 0, 0],
        [5, 4, 0, 9, 0, 3, 6, 0, 0],
        [0, 0, 0, 0, 4, 0, 0, 6, 7],
        [3, 0, 0, 0, 7, 6, 0, 0, 0],
        [0, 0, 0, 0, 0, 2, 0, 0, 0],
        [0, 3, 0, 8, 5, 0, 1, 0, 0],
        [0, 0, 0, 0, 6, 7, 3, 0, 0],
        [9, 2, 0, 0, 0, 0, 0, 5, 0]
      ],
      solution: [
        [7, 1, 3, 6, 8, 5, 9, 4, 2],
        [2, 6, 9, 7, 1, 4, 5, 8, 3],
        [5, 4, 8, 9, 2, 3, 6, 7, 1],
        [1, 9, 5, 3, 4, 8, 2, 6, 7],
        [3, 8, 2, 5, 7, 6, 4, 1, 9],
        [6, 7, 4, 1, 9, 2, 8, 3, 5],
        [4, 3, 7, 8, 5, 9, 1, 2, 6],
        [8, 5, 1, 2, 6, 7, 3, 9, 4],
        [9, 2, 6, 4, 3, 1, 7, 5, 8]
      ],
      cages: [
        { cells: [[2, 0], [2, 1], [3, 1], [3, 0], [1, 0]], sum: 21 },
        { cells: [[7, 5], [8, 5], [8, 4], [7, 4], [6, 5]], sum: 26 },
        { cells: [[1, 2], [1, 3], [1, 1]], sum: 22 },
        { cells: [[3, 8], [2, 8], [3, 7], [3, 6], [4, 6]], sum: 20 },
        { cells: [[8, 1], [8, 0], [7, 1], [7, 0]], sum: 24 },
        { cells: [[5, 2], [6, 2], [5, 3], [4, 3], [3, 3]], sum: 20 },
        { cells: [[7, 2], [8, 2], [7, 3], [8, 3]], sum: 13 },
        { cells: [[7, 6], [6, 6], [6, 7], [7, 7]], sum: 15 },
        { cells: [[3, 5], [3, 4]], sum: 12 },
        { cells: [[0, 2], [0, 3]], sum: 9 },
        { cells: [[1, 6], [1, 7], [2, 6], [2, 5], [2, 7]], sum: 29 },
        { cells: [[5, 0], [5, 1]], sum: 13 },
        { cells: [[0, 0], [0, 1]], sum: 8 },
        { cells: [[8, 8], [8, 7], [8, 6]], sum: 20 },
        { cells: [[5, 8], [4, 8], [4, 7]], sum: 15 },
        { cells: [[5, 4], [4, 4]], sum: 16 },
        { cells: [[4, 5], [5, 5], [5, 6], [5, 7]], sum: 19 },
        { cells: [[6, 3], [6, 4]], sum: 13 },
        { cells: [[3, 2], [4, 2], [4, 1], [4, 0]], sum: 18 },
        { cells: [[6, 1], [6, 0]], sum: 7 },
        { cells: [[0, 7], [0, 6], [0, 8], [1, 8]], sum: 18 },
        { cells: [[0, 5], [0, 4]], sum: 13 },
        { cells: [[7, 8], [6, 8]], sum: 10 },
        { cells: [[1, 5], [1, 4]], sum: 5 },
        { cells: [[2, 2], [2, 3], [2, 4]], sum: 19 }
      ],
      variants: [
        "killer"
      ]
    },
    {
      id: "killer-2",
      title: "No Man's Sums",
      blurb: "29 givens plus 21 cages carrying the whole grid.",
      stars: 3,
      givens: [
        [0, 8, 0, 0, 0, 4, 0, 7, 0],
        [0, 2, 0, 5, 6, 0, 0, 3, 9],
        [0, 5, 0, 0, 0, 0, 0, 0, 0],
        [0, 6, 0, 3, 0, 2, 0, 0, 0],
        [7, 0, 0, 0, 5, 9, 0, 6, 0],
        [0, 0, 5, 4, 0, 0, 3, 0, 8],
        [0, 0, 0, 0, 3, 0, 9, 1, 0],
        [0, 0, 0, 0, 0, 0, 7, 0, 0],
        [5, 0, 0, 2, 9, 0, 6, 8, 0]
      ],
      solution: [
        [3, 8, 6, 9, 2, 4, 1, 7, 5],
        [4, 2, 7, 5, 6, 1, 8, 3, 9],
        [1, 5, 9, 7, 8, 3, 2, 4, 6],
        [8, 6, 4, 3, 1, 2, 5, 9, 7],
        [7, 3, 2, 8, 5, 9, 4, 6, 1],
        [9, 1, 5, 4, 7, 6, 3, 2, 8],
        [2, 7, 8, 6, 3, 5, 9, 1, 4],
        [6, 9, 3, 1, 4, 8, 7, 5, 2],
        [5, 4, 1, 2, 9, 7, 6, 8, 3]
      ],
      cages: [
        { cells: [[3, 5], [3, 4], [4, 5], [5, 5], [4, 6]], sum: 22 },
        { cells: [[4, 3], [3, 3], [4, 4], [5, 3], [5, 4]], sum: 27 },
        { cells: [[7, 4], [7, 5], [7, 6], [7, 7], [7, 8]], sum: 26 },
        { cells: [[8, 0], [8, 1], [7, 0], [7, 1], [6, 1]], sum: 31 },
        { cells: [[3, 7], [3, 6], [2, 6], [3, 8]], sum: 23 },
        { cells: [[6, 4], [6, 3], [7, 3], [8, 3], [6, 5]], sum: 17 },
        { cells: [[8, 6], [8, 5], [8, 7], [8, 8], [8, 4]], sum: 33 },
        { cells: [[4, 1], [4, 0], [3, 0], [3, 1], [5, 1]], sum: 25 },
        { cells: [[2, 0], [2, 1]], sum: 6 },
        { cells: [[4, 8], [5, 8], [5, 7], [4, 7]], sum: 17 },
        { cells: [[2, 7], [1, 7], [2, 8], [1, 6]], sum: 21 },
        { cells: [[5, 6], [6, 6], [6, 7], [6, 8]], sum: 17 },
        { cells: [[7, 2], [8, 2], [6, 2], [5, 2], [4, 2]], sum: 19 },
        { cells: [[0, 0], [0, 1], [0, 2]], sum: 17 },
        { cells: [[0, 6], [0, 7]], sum: 8 },
        { cells: [[0, 3], [1, 3], [0, 4], [1, 2]], sum: 23 },
        { cells: [[0, 8], [1, 8]], sum: 14 },
        { cells: [[2, 5], [1, 5], [0, 5], [1, 4], [2, 4]], sum: 22 },
        { cells: [[2, 3], [2, 2], [3, 2]], sum: 20 },
        { cells: [[1, 1], [1, 0]], sum: 6 },
        { cells: [[5, 0], [6, 0]], sum: 11 }
      ],
      variants: [
        "killer"
      ]
    },
    {
      id: "killer-3",
      title: "Fault Lines",
      blurb: "30 givens plus 26 cages carrying the whole grid.",
      stars: 3,
      givens: [
        [0, 0, 4, 0, 5, 0, 0, 6, 0],
        [6, 0, 0, 1, 9, 0, 0, 0, 8],
        [5, 0, 1, 0, 0, 0, 0, 0, 0],
        [0, 1, 5, 3, 6, 0, 9, 0, 0],
        [0, 6, 2, 0, 0, 0, 0, 0, 0],
        [7, 0, 0, 2, 0, 0, 0, 0, 0],
        [8, 3, 0, 0, 2, 1, 6, 0, 4],
        [0, 0, 0, 0, 0, 0, 8, 1, 0],
        [1, 4, 0, 7, 0, 9, 0, 0, 0]
      ],
      solution: [
        [9, 2, 4, 8, 5, 7, 1, 6, 3],
        [6, 7, 3, 1, 9, 2, 5, 4, 8],
        [5, 8, 1, 6, 4, 3, 7, 2, 9],
        [4, 1, 5, 3, 6, 8, 9, 7, 2],
        [3, 6, 2, 9, 7, 5, 4, 8, 1],
        [7, 9, 8, 2, 1, 4, 3, 5, 6],
        [8, 3, 7, 5, 2, 1, 6, 9, 4],
        [2, 5, 9, 4, 3, 6, 8, 1, 7],
        [1, 4, 6, 7, 8, 9, 2, 3, 5]
      ],
      cages: [
        { cells: [[5, 6], [6, 6]], sum: 9 },
        { cells: [[2, 1], [1, 1]], sum: 15 },
        { cells: [[7, 1], [8, 1], [7, 0], [7, 2], [8, 0]], sum: 21 },
        { cells: [[3, 3], [2, 3], [2, 2], [4, 3]], sum: 19 },
        { cells: [[4, 8], [3, 8], [5, 8], [2, 8], [3, 7]], sum: 25 },
        { cells: [[2, 6], [2, 5], [3, 5], [1, 5], [2, 4]], sum: 24 },
        { cells: [[0, 4], [1, 4], [0, 3], [1, 3], [1, 2]], sum: 26 },
        { cells: [[8, 6], [8, 7], [7, 7]], sum: 6 },
        { cells: [[8, 2], [8, 3], [8, 4]], sum: 21 },
        { cells: [[6, 7], [6, 8]], sum: 13 },
        { cells: [[3, 6], [4, 6], [4, 5]], sum: 18 },
        { cells: [[0, 1], [0, 2]], sum: 6 },
        { cells: [[5, 4], [4, 4], [3, 4], [5, 3]], sum: 16 },
        { cells: [[5, 0], [4, 0]], sum: 10 },
        { cells: [[5, 7], [4, 7]], sum: 13 },
        { cells: [[4, 1], [3, 1], [3, 2]], sum: 12 },
        { cells: [[8, 5], [7, 5], [6, 5], [5, 5], [7, 6]], sum: 28 },
        { cells: [[0, 8], [0, 7], [0, 6], [1, 6], [0, 5]], sum: 22 },
        { cells: [[2, 0], [3, 0]], sum: 9 },
        { cells: [[6, 3], [7, 3]], sum: 9 },
        { cells: [[1, 8], [1, 7], [2, 7]], sum: 14 },
        { cells: [[6, 1], [6, 2], [6, 0]], sum: 18 },
        { cells: [[6, 4], [7, 4]], sum: 5 },
        { cells: [[4, 2], [5, 2], [5, 1]], sum: 19 },
        { cells: [[7, 8], [8, 8]], sum: 12 },
        { cells: [[1, 0], [0, 0]], sum: 15 }
      ],
      variants: [
        "killer"
      ]
    },
    {
      id: "self-contained",
      title: "Self-Contained",
      blurb: "By Lavaloid, imported from the community.",
      stars: 9,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [6, 5, 3, 4, 1, 8, 2, 7, 9],
        [1, 7, 4, 2, 5, 9, 8, 6, 3],
        [9, 8, 2, 6, 7, 3, 4, 5, 1],
        [5, 2, 8, 9, 6, 1, 3, 4, 7],
        [3, 1, 7, 5, 4, 2, 9, 8, 6],
        [4, 9, 6, 3, 8, 7, 5, 1, 2],
        [7, 6, 9, 8, 3, 5, 1, 2, 4],
        [8, 3, 1, 7, 2, 4, 6, 9, 5],
        [2, 4, 5, 1, 9, 6, 7, 3, 8]
      ],
      cages: [
        { cells: [[5, 2], [6, 2], [6, 3]], sum: 23 },
        { cells: [[3, 2], [3, 3], [3, 4]], sum: 23 },
        { cells: [[2, 2], [2, 3]], sum: 8 },
        { cells: [[4, 2], [4, 3], [5, 3]], sum: 15 },
        { cells: [[4, 4], [5, 4], [5, 5]], sum: 19 },
        { cells: [[3, 6], [4, 5], [4, 6]], sum: 14 },
        { cells: [[2, 4], [2, 5], [2, 6], [3, 5]], sum: 15 },
        { cells: [[6, 4], [6, 5]], sum: 8 },
        { cells: [[5, 6], [6, 6]], sum: 6 }
      ],
      antiKnight: true,
      variants: [
        "killer",
        "antiknight"
      ]
    },
    {
      id: "killer-blister",
      title: "Killer Blister",
      blurb: "By Rangsk, imported from the community. Uses little killer clues our solver-checker doesn’t support, so this one rests on the community’s own testing rather than our verification.",
      stars: 8,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [2, 4, 9, 5, 1, 6, 8, 3, 7],
        [1, 8, 5, 3, 4, 7, 9, 6, 2],
        [3, 7, 6, 9, 8, 2, 1, 5, 4],
        [4, 2, 1, 6, 3, 9, 7, 8, 5],
        [7, 5, 8, 4, 2, 1, 3, 9, 6],
        [6, 9, 3, 8, 7, 5, 4, 2, 1],
        [9, 1, 7, 2, 6, 8, 5, 4, 3],
        [5, 6, 4, 7, 9, 3, 2, 1, 8],
        [8, 3, 2, 1, 5, 4, 6, 7, 9]
      ],
      cages: [
        { cells: [[2, 0], [3, 0]], sum: 7 },
        { cells: [[3, 1], [3, 2]], sum: 3 },
        { cells: [[4, 3], [4, 4], [4, 5]], sum: 7 },
        { cells: [[5, 6], [5, 7], [5, 8], [6, 8]], sum: 10 },
        { cells: [[1, 2], [2, 1], [2, 2]], sum: 18 },
        { cells: [[5, 0], [6, 0], [7, 0]], sum: 20 },
        { cells: [[6, 6], [6, 7], [7, 6], [7, 7]], sum: 12 },
        { cells: [[0, 4], [1, 4], [2, 4], [3, 4]], sum: 16 },
        { cells: [[5, 4], [5, 5], [6, 4], [6, 5], [7, 4], [7, 5]], sum: 38 },
        { cells: [[7, 1], [7, 2], [7, 3]], sum: 17 },
        { cells: [[0, 5], [0, 6], [0, 7], [1, 6]], sum: 26 },
        { cells: [[2, 5], [2, 6], [2, 7], [2, 8]], sum: 12 }
      ],
      littleKiller: [
        { cells: [[2, 0], [1, 1], [0, 2]], dir: [-1, 1], sum: 20 },
        { cells: [[6, 8], [5, 7], [4, 6], [3, 5], [2, 4], [1, 3], [0, 2]], dir: [-1, -1], sum: 37 },
        { cells: [[8, 3], [7, 2], [6, 1], [5, 0]], dir: [-1, -1], sum: 12 },
        {
          cells: [[8, 0], [7, 1], [6, 2], [5, 3], [4, 4], [3, 5], [2, 6], [1, 7], [0, 8]],
          dir: [-1, 1],
          sum: 54
        }
      ],
      variants: [
        "killer"
      ]
    },

    // ---- Kropki Dots ----
    {
      id: "kropki-1",
      title: "Black and White",
      blurb: "2 givens plus 26 kropki dots.",
      stars: 7,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 6, 0, 0, 8, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [9, 5, 4, 6, 7, 1, 8, 2, 3],
        [3, 6, 7, 9, 8, 2, 1, 5, 4],
        [1, 2, 8, 4, 3, 5, 7, 6, 9],
        [4, 1, 3, 5, 9, 8, 2, 7, 6],
        [8, 9, 6, 3, 2, 7, 5, 4, 1],
        [5, 7, 2, 1, 4, 6, 9, 3, 8],
        [7, 3, 5, 8, 1, 4, 6, 9, 2],
        [6, 8, 9, 2, 5, 3, 4, 1, 7],
        [2, 4, 1, 7, 6, 9, 3, 8, 5]
      ],
      kropki: [
        { a: [0, 1], b: [0, 2], kind: "white" },
        { a: [0, 1], b: [1, 1], kind: "white" },
        { a: [0, 4], b: [1, 4], kind: "white" },
        { a: [0, 5], b: [1, 5], kind: "white" },
        { a: [0, 8], b: [1, 8], kind: "white" },
        { a: [1, 0], b: [1, 1], kind: "black" },
        { a: [1, 1], b: [1, 2], kind: "white" },
        { a: [1, 2], b: [2, 2], kind: "white" },
        { a: [1, 3], b: [1, 4], kind: "white" },
        { a: [1, 7], b: [1, 8], kind: "white" },
        { a: [1, 7], b: [2, 7], kind: "white" },
        { a: [2, 0], b: [2, 1], kind: "white" },
        { a: [2, 1], b: [3, 1], kind: "white" },
        { a: [2, 6], b: [2, 7], kind: "white" },
        { a: [3, 0], b: [4, 0], kind: "black" },
        { a: [3, 2], b: [4, 2], kind: "black" },
        { a: [3, 4], b: [3, 5], kind: "white" },
        { a: [3, 7], b: [3, 8], kind: "white" },
        { a: [4, 4], b: [5, 4], kind: "black" },
        { a: [4, 7], b: [5, 7], kind: "white" },
        { a: [5, 2], b: [5, 3], kind: "white" },
        { a: [7, 1], b: [7, 2], kind: "white" },
        { a: [7, 1], b: [8, 1], kind: "black" },
        { a: [7, 4], b: [8, 4], kind: "white" },
        { a: [8, 0], b: [8, 1], kind: "black" },
        { a: [8, 3], b: [8, 4], kind: "white" }
      ],
      variants: [
        "kropki"
      ]
    },
    {
      id: "kropki-2",
      title: "Ratio Lock",
      blurb: "2 givens plus 28 kropki dots.",
      stars: 6,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [6, 0, 0, 0, 0, 4, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [8, 1, 2, 6, 3, 5, 4, 7, 9],
        [3, 9, 4, 1, 7, 2, 8, 6, 5],
        [6, 7, 5, 9, 8, 4, 2, 3, 1],
        [9, 3, 8, 4, 5, 6, 1, 2, 7],
        [5, 4, 1, 3, 2, 7, 6, 9, 8],
        [7, 2, 6, 8, 1, 9, 5, 4, 3],
        [2, 5, 9, 7, 4, 1, 3, 8, 6],
        [1, 6, 3, 2, 9, 8, 7, 5, 4],
        [4, 8, 7, 5, 6, 3, 9, 1, 2]
      ],
      kropki: [
        { a: [0, 2], b: [1, 2], kind: "black" },
        { a: [0, 3], b: [0, 4], kind: "black" },
        { a: [0, 6], b: [1, 6], kind: "black" },
        { a: [1, 0], b: [2, 0], kind: "black" },
        { a: [1, 5], b: [2, 5], kind: "black" },
        { a: [1, 7], b: [2, 7], kind: "black" },
        { a: [2, 0], b: [2, 1], kind: "white" },
        { a: [2, 3], b: [2, 4], kind: "white" },
        { a: [2, 4], b: [2, 5], kind: "black" },
        { a: [2, 5], b: [2, 6], kind: "black" },
        { a: [2, 6], b: [3, 6], kind: "white" },
        { a: [2, 7], b: [3, 7], kind: "white" },
        { a: [3, 3], b: [3, 4], kind: "white" },
        { a: [3, 3], b: [4, 3], kind: "white" },
        { a: [3, 4], b: [3, 5], kind: "white" },
        { a: [3, 5], b: [4, 5], kind: "white" },
        { a: [3, 6], b: [3, 7], kind: "white" },
        { a: [4, 0], b: [4, 1], kind: "white" },
        { a: [4, 1], b: [5, 1], kind: "black" },
        { a: [4, 3], b: [4, 4], kind: "white" },
        { a: [4, 4], b: [5, 4], kind: "white" },
        { a: [4, 5], b: [4, 6], kind: "white" },
        { a: [5, 3], b: [6, 3], kind: "white" },
        { a: [5, 6], b: [5, 7], kind: "white" },
        { a: [6, 0], b: [7, 0], kind: "white" },
        { a: [6, 1], b: [7, 1], kind: "white" },
        { a: [7, 1], b: [7, 2], kind: "black" },
        { a: [8, 7], b: [8, 8], kind: "white" }
      ],
      variants: [
        "kropki"
      ]
    },
    {
      id: "kropki-3",
      title: "Domino Logic",
      blurb: "2 givens plus 29 kropki dots.",
      stars: 7,
      givens: [
        [4, 0, 0, 0, 3, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [4, 8, 7, 6, 3, 2, 1, 5, 9],
        [3, 9, 5, 8, 7, 1, 6, 4, 2],
        [1, 6, 2, 9, 5, 4, 3, 8, 7],
        [9, 2, 1, 3, 4, 7, 8, 6, 5],
        [7, 4, 6, 2, 8, 5, 9, 1, 3],
        [5, 3, 8, 1, 9, 6, 2, 7, 4],
        [8, 7, 9, 5, 1, 3, 4, 2, 6],
        [6, 5, 3, 4, 2, 8, 7, 9, 1],
        [2, 1, 4, 7, 6, 9, 5, 3, 8]
      ],
      kropki: [
        { a: [0, 0], b: [0, 1], kind: "black" },
        { a: [0, 0], b: [1, 0], kind: "white" },
        { a: [0, 1], b: [1, 1], kind: "white" },
        { a: [0, 3], b: [0, 4], kind: "black" },
        { a: [0, 4], b: [0, 5], kind: "white" },
        { a: [0, 5], b: [0, 6], kind: "white" },
        { a: [1, 3], b: [1, 4], kind: "white" },
        { a: [1, 3], b: [2, 3], kind: "white" },
        { a: [1, 6], b: [2, 6], kind: "black" },
        { a: [1, 7], b: [1, 8], kind: "black" },
        { a: [1, 7], b: [2, 7], kind: "black" },
        { a: [2, 4], b: [3, 4], kind: "white" },
        { a: [2, 5], b: [2, 6], kind: "white" },
        { a: [3, 1], b: [4, 1], kind: "black" },
        { a: [3, 4], b: [4, 4], kind: "black" },
        { a: [3, 6], b: [4, 6], kind: "white" },
        { a: [3, 7], b: [3, 8], kind: "white" },
        { a: [4, 1], b: [5, 1], kind: "white" },
        { a: [4, 4], b: [5, 4], kind: "white" },
        { a: [4, 8], b: [5, 8], kind: "white" },
        { a: [5, 2], b: [6, 2], kind: "white" },
        { a: [6, 3], b: [7, 3], kind: "white" },
        { a: [6, 5], b: [6, 6], kind: "white" },
        { a: [6, 6], b: [6, 7], kind: "black" },
        { a: [7, 0], b: [7, 1], kind: "white" },
        { a: [7, 2], b: [8, 2], kind: "white" },
        { a: [7, 5], b: [8, 5], kind: "white" },
        { a: [8, 0], b: [8, 1], kind: "white" },
        { a: [8, 3], b: [8, 4], kind: "white" }
      ],
      variants: [
        "kropki"
      ]
    },
    {
      id: "kropki-renban-1",
      title: "Consecutive Chains",
      blurb: "No givens — 20 kropki dots and 9 renban lines are the only clues. Needs full kropki-chain deduction plus an XY-Wing to finish.",
      stars: 9,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [6, 7, 3, 2, 4, 1, 8, 9, 5],
        [9, 1, 8, 5, 7, 6, 3, 2, 4],
        [5, 4, 2, 9, 8, 3, 1, 7, 6],
        [1, 8, 5, 3, 6, 2, 9, 4, 7],
        [7, 9, 6, 4, 1, 8, 2, 5, 3],
        [3, 2, 4, 7, 5, 9, 6, 1, 8],
        [8, 5, 1, 6, 9, 4, 7, 3, 2],
        [2, 6, 7, 1, 3, 5, 4, 8, 9],
        [4, 3, 9, 8, 2, 7, 5, 6, 1]
      ],
      kropki: [
        { a: [0, 3], b: [0, 4], kind: "black" },
        { a: [1, 4], b: [2, 4], kind: "white" },
        { a: [1, 5], b: [1, 6], kind: "black" },
        { a: [1, 5], b: [2, 5], kind: "black" },
        { a: [1, 7], b: [1, 8], kind: "black" },
        { a: [2, 0], b: [2, 1], kind: "white" },
        { a: [2, 1], b: [3, 1], kind: "black" },
        { a: [2, 5], b: [3, 5], kind: "white" },
        { a: [2, 7], b: [2, 8], kind: "white" },
        { a: [3, 1], b: [4, 1], kind: "white" },
        { a: [3, 3], b: [4, 3], kind: "white" },
        { a: [3, 7], b: [4, 7], kind: "white" },
        { a: [5, 1], b: [5, 2], kind: "black" },
        { a: [6, 5], b: [7, 5], kind: "white" },
        { a: [7, 0], b: [8, 0], kind: "black" },
        { a: [7, 1], b: [7, 2], kind: "white" },
        { a: [7, 5], b: [7, 6], kind: "white" },
        { a: [7, 6], b: [7, 7], kind: "black" },
        { a: [7, 6], b: [8, 6], kind: "white" },
        { a: [8, 2], b: [8, 3], kind: "white" }
      ],
      lines: [
        { kind: "renban", cells: [[1, 6], [1, 7], [1, 8]] },
        { kind: "renban", cells: [[5, 0], [5, 1], [5, 2]] },
        { kind: "renban", cells: [[8, 5], [8, 6], [8, 7]] },
        { kind: "renban", cells: [[3, 2], [4, 2], [5, 2]] },
        { kind: "renban", cells: [[1, 4], [2, 4], [3, 4]] },
        { kind: "renban", cells: [[0, 8], [1, 8], [2, 8]] },
        { kind: "renban", cells: [[0, 2], [0, 3], [0, 4], [0, 5]] },
        { kind: "renban", cells: [[1, 2], [1, 3], [1, 4], [1, 5]] },
        { kind: "renban", cells: [[0, 8], [1, 8], [2, 8], [3, 8]] }
      ],
      variants: [
        "kropki",
        "lines"
      ]
    },
    {
      id: "kropki-thermo-1",
      title: "Dots and Bulbs",
      blurb: "No givens — 10 kropki dots and 23 thermometers do all the work. A steady chain of kropki and thermo deductions, no guessing.",
      stars: 7,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [4, 9, 8, 3, 2, 6, 1, 5, 7],
        [6, 3, 1, 5, 4, 7, 2, 8, 9],
        [2, 5, 7, 1, 9, 8, 4, 3, 6],
        [5, 7, 6, 9, 3, 2, 8, 4, 1],
        [8, 2, 9, 4, 7, 1, 5, 6, 3],
        [3, 1, 4, 6, 8, 5, 9, 7, 2],
        [9, 4, 2, 7, 5, 3, 6, 1, 8],
        [7, 6, 5, 8, 1, 9, 3, 2, 4],
        [1, 8, 3, 2, 6, 4, 7, 9, 5]
      ],
      kropki: [
        { a: [1, 0], b: [1, 1], kind: "black" },
        { a: [1, 3], b: [1, 4], kind: "white" },
        { a: [1, 6], b: [2, 6], kind: "black" },
        { a: [1, 7], b: [1, 8], kind: "white" },
        { a: [2, 6], b: [2, 7], kind: "white" },
        { a: [4, 1], b: [5, 1], kind: "white" },
        { a: [6, 5], b: [6, 6], kind: "black" },
        { a: [7, 1], b: [7, 2], kind: "white" },
        { a: [7, 6], b: [7, 7], kind: "white" },
        { a: [7, 8], b: [8, 8], kind: "white" }
      ],
      lines: [
        { kind: "thermo", cells: [[2, 7], [2, 6], [2, 5], [2, 4]] },
        { kind: "thermo", cells: [[4, 3], [5, 3], [6, 3], [7, 3]] },
        { kind: "thermo", cells: [[2, 7], [3, 7], [4, 7], [5, 7]] },
        { kind: "thermo", cells: [[0, 4], [0, 3], [0, 2]] },
        { kind: "thermo", cells: [[1, 6], [1, 7], [1, 8]] },
        { kind: "thermo", cells: [[2, 6], [2, 5], [2, 4]] },
        { kind: "thermo", cells: [[2, 7], [2, 6], [2, 5]] },
        { kind: "thermo", cells: [[4, 5], [4, 6], [4, 7]] },
        { kind: "thermo", cells: [[5, 2], [5, 3], [5, 4]] },
        { kind: "thermo", cells: [[5, 8], [5, 7], [5, 6]] },
        { kind: "thermo", cells: [[7, 2], [7, 1], [7, 0]] },
        { kind: "thermo", cells: [[8, 3], [8, 2], [8, 1]] },
        { kind: "thermo", cells: [[8, 5], [8, 6], [8, 7]] },
        { kind: "thermo", cells: [[1, 1], [2, 1], [3, 1]] },
        { kind: "thermo", cells: [[5, 1], [6, 1], [7, 1]] },
        { kind: "thermo", cells: [[4, 3], [5, 3], [6, 3]] },
        { kind: "thermo", cells: [[0, 4], [1, 4], [2, 4]] },
        { kind: "thermo", cells: [[3, 4], [4, 4], [5, 4]] },
        { kind: "thermo", cells: [[0, 5], [1, 5], [2, 5]] },
        { kind: "thermo", cells: [[4, 5], [3, 5], [2, 5]] },
        { kind: "thermo", cells: [[0, 6], [1, 6], [2, 6]] },
        { kind: "thermo", cells: [[7, 6], [6, 6], [5, 6]] },
        { kind: "thermo", cells: [[3, 8], [2, 8], [1, 8]] }
      ],
      variants: [
        "kropki",
        "lines"
      ]
    },
    {
      id: "kropki-arrow-1",
      title: "Circles and Dots",
      blurb: "No givens — 16 kropki dots and 12 arrows. Locked candidates and naked pairs unravel it one region at a time.",
      stars: 6,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [8, 5, 3, 7, 1, 2, 6, 9, 4],
        [6, 9, 7, 4, 8, 3, 2, 1, 5],
        [4, 1, 2, 5, 9, 6, 3, 7, 8],
        [3, 4, 1, 8, 5, 7, 9, 2, 6],
        [7, 8, 6, 3, 2, 9, 5, 4, 1],
        [5, 2, 9, 1, 6, 4, 8, 3, 7],
        [1, 7, 8, 9, 3, 5, 4, 6, 2],
        [2, 3, 5, 6, 4, 1, 7, 8, 9],
        [9, 6, 4, 2, 7, 8, 1, 5, 3]
      ],
      kropki: [
        { a: [0, 4], b: [0, 5], kind: "white" },
        { a: [1, 3], b: [1, 4], kind: "black" },
        { a: [1, 4], b: [2, 4], kind: "white" },
        { a: [1, 5], b: [1, 6], kind: "white" },
        { a: [1, 5], b: [2, 5], kind: "black" },
        { a: [1, 6], b: [1, 7], kind: "white" },
        { a: [1, 6], b: [2, 6], kind: "white" },
        { a: [2, 5], b: [3, 5], kind: "white" },
        { a: [3, 0], b: [3, 1], kind: "white" },
        { a: [5, 2], b: [6, 2], kind: "white" },
        { a: [6, 0], b: [7, 0], kind: "white" },
        { a: [6, 2], b: [6, 3], kind: "white" },
        { a: [7, 2], b: [8, 2], kind: "white" },
        { a: [7, 6], b: [7, 7], kind: "white" },
        { a: [7, 7], b: [7, 8], kind: "white" },
        { a: [8, 2], b: [8, 3], kind: "black" }
      ],
      arrows: [
        { circle: [0, 0], cells: [[0, 1], [0, 2]] },
        { circle: [1, 5], cells: [[1, 6], [1, 7]] },
        { circle: [2, 4], cells: [[2, 5], [2, 6]] },
        { circle: [4, 0], cells: [[3, 0], [2, 0]] },
        { circle: [4, 5], cells: [[4, 6], [4, 7]] },
        { circle: [4, 5], cells: [[5, 5], [6, 5]] },
        { circle: [4, 6], cells: [[4, 7], [4, 8]] },
        { circle: [6, 2], cells: [[6, 1], [6, 0]] },
        { circle: [7, 2], cells: [[7, 1], [7, 0]] },
        { circle: [7, 7], cells: [[7, 6], [7, 5]] },
        { circle: [7, 8], cells: [[6, 8], [5, 8]] },
        { circle: [8, 1], cells: [[8, 2], [8, 3]] }
      ],
      variants: [
        "kropki",
        "lines"
      ]
    },
    {
      id: "300-subs",
      title: "300 Subs",
      blurb: "By Rangsk, imported from the community.",
      stars: 7,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [1, 3, 5, 4, 6, 2, 8, 7, 9],
        [7, 2, 9, 8, 5, 3, 4, 6, 1],
        [6, 8, 4, 1, 9, 7, 5, 2, 3],
        [8, 5, 1, 2, 7, 6, 9, 3, 4],
        [2, 9, 6, 3, 4, 5, 1, 8, 7],
        [4, 7, 3, 9, 8, 1, 2, 5, 6],
        [9, 6, 2, 7, 1, 8, 3, 4, 5],
        [5, 4, 8, 6, 3, 9, 7, 1, 2],
        [3, 1, 7, 5, 2, 4, 6, 9, 8]
      ],
      kropki: [
        { a: [8, 3], b: [7, 3], kind: "white" },
        { a: [7, 4], b: [8, 4], kind: "white" },
        { a: [7, 6], b: [8, 6], kind: "white" },
        { a: [1, 6], b: [1, 5], kind: "white" },
        { a: [5, 4], b: [5, 3], kind: "white" },
        { a: [1, 3], b: [0, 3], kind: "black" },
        { a: [7, 7], b: [7, 8], kind: "black" },
        { a: [7, 1], b: [7, 2], kind: "black" },
        { a: [0, 6], b: [1, 6], kind: "black" },
        { a: [7, 3], b: [7, 4], kind: "black" }
      ],
      lines: [
        { kind: "thermo", cells: [[2, 3], [3, 3], [4, 3], [4, 4], [4, 5], [3, 5], [2, 5], [2, 4]] },
        { kind: "thermo", cells: [[4, 6], [5, 6], [6, 6], [6, 7], [6, 8], [5, 8], [4, 8], [4, 7]] },
        { kind: "thermo", cells: [[0, 0], [1, 1], [2, 2], [3, 1], [4, 2], [5, 1], [6, 0]] }
      ],
      variants: [
        "kropki",
        "lines"
      ]
    },
    {
      id: "159",
      title: "159",
      blurb: "By zetamath, imported from the community.",
      stars: 8,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [1, 5, 3, 4, 2, 8, 7, 9, 6],
        [2, 9, 8, 6, 7, 5, 4, 3, 1],
        [4, 6, 7, 9, 3, 1, 5, 8, 2],
        [3, 8, 6, 1, 5, 2, 9, 7, 4],
        [9, 7, 2, 8, 4, 3, 1, 6, 5],
        [5, 1, 4, 7, 6, 9, 8, 2, 3],
        [6, 3, 9, 5, 1, 7, 2, 4, 8],
        [7, 4, 5, 2, 8, 6, 3, 1, 9],
        [8, 2, 1, 3, 9, 4, 6, 5, 7]
      ],
      kropki: [
        { a: [4, 8], b: [4, 7], kind: "white" },
        { a: [6, 0], b: [6, 1], kind: "black" },
        { a: [7, 6], b: [8, 6], kind: "black" }
      ],
      lines: [
        { kind: "renban", cells: [[0, 1], [0, 2], [0, 3], [0, 4]] },
        { kind: "renban", cells: [[0, 5], [0, 6], [0, 7], [0, 8]] },
        { kind: "renban", cells: [[1, 7], [1, 8], [2, 8], [3, 8]] },
        { kind: "renban", cells: [[2, 6], [2, 7], [3, 7], [4, 7]] },
        { kind: "renban", cells: [[5, 6], [5, 5], [6, 5], [7, 5]] },
        { kind: "renban", cells: [[8, 5], [8, 6], [8, 7], [8, 8]] },
        { kind: "renban", cells: [[8, 1], [8, 2]] },
        { kind: "renban", cells: [[7, 1], [7, 2]] },
        { kind: "renban", cells: [[8, 0], [7, 0], [6, 0], [5, 0]] },
        { kind: "renban", cells: [[6, 1], [5, 1], [5, 2], [4, 2]] },
        { kind: "renban", cells: [[4, 0], [4, 1], [3, 1], [2, 1]] },
        { kind: "renban", cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
        { kind: "renban", cells: [[1, 1], [1, 2], [2, 2], [3, 2]] },
        { kind: "renban", cells: [[1, 3], [1, 4], [1, 5], [1, 6]] },
        { kind: "renban", cells: [[2, 5], [3, 5], [4, 5]] },
        { kind: "renban", cells: [[2, 4], [3, 4], [4, 4], [5, 4]] }
      ],
      variants: [
        "kropki",
        "lines"
      ]
    },

    // ---- Lines & Arrows ----
    {
      id: "lines-1",
      title: "Rising Heat",
      blurb: "2 givens — featuring thermo, renban, arrow.",
      stars: 6,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 5, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 5, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [2, 7, 3, 6, 8, 5, 4, 1, 9],
        [8, 9, 6, 4, 3, 1, 5, 2, 7],
        [1, 4, 5, 2, 7, 9, 8, 3, 6],
        [3, 5, 1, 7, 9, 2, 6, 8, 4],
        [9, 2, 4, 8, 1, 6, 7, 5, 3],
        [6, 8, 7, 5, 4, 3, 2, 9, 1],
        [7, 1, 2, 9, 5, 4, 3, 6, 8],
        [5, 3, 8, 1, 6, 7, 9, 4, 2],
        [4, 6, 9, 3, 2, 8, 1, 7, 5]
      ],
      lines: [
        { kind: "thermo", cells: [[1, 4], [1, 3], [1, 2], [1, 1]] },
        { kind: "thermo", cells: [[5, 6], [5, 5], [5, 4], [5, 3]] },
        { kind: "thermo", cells: [[3, 8], [2, 8], [1, 8], [0, 8]] },
        { kind: "thermo", cells: [[0, 7], [0, 6], [0, 5]] },
        { kind: "thermo", cells: [[1, 4], [1, 3], [1, 2]] },
        { kind: "thermo", cells: [[3, 5], [3, 6], [3, 7]] },
        { kind: "thermo", cells: [[4, 1], [4, 2], [4, 3]] },
        { kind: "thermo", cells: [[5, 3], [5, 2], [5, 1]] },
        { kind: "thermo", cells: [[5, 5], [5, 4], [5, 3]] },
        { kind: "thermo", cells: [[6, 1], [6, 2], [6, 3]] },
        { kind: "thermo", cells: [[6, 6], [6, 5], [6, 4]] },
        { kind: "thermo", cells: [[6, 6], [6, 7], [6, 8]] },
        { kind: "thermo", cells: [[2, 0], [3, 0], [4, 0]] },
        { kind: "thermo", cells: [[0, 7], [1, 7], [2, 7]] },
        { kind: "thermo", cells: [[5, 8], [4, 8], [3, 8]] },
        { kind: "renban", cells: [[2, 4], [2, 5], [2, 6]] },
        { kind: "renban", cells: [[5, 0], [5, 1], [5, 2]] },
        { kind: "renban", cells: [[5, 3], [5, 4], [5, 5]] },
        { kind: "renban", cells: [[6, 4], [6, 5], [6, 6]] },
        { kind: "renban", cells: [[5, 0], [6, 0], [7, 0]] },
        { kind: "renban", cells: [[0, 7], [1, 7], [2, 7]] },
        { kind: "renban", cells: [[5, 3], [5, 4], [5, 5], [5, 6]] },
        { kind: "renban", cells: [[6, 4], [6, 5], [6, 6], [6, 7]] },
        { kind: "renban", cells: [[5, 0], [6, 0], [7, 0], [8, 0]] },
        { kind: "renban", cells: [[1, 6], [2, 6], [3, 6], [4, 6]] }
      ],
      arrows: [
        { circle: [0, 5], cells: [[0, 6], [0, 7]] },
        { circle: [2, 2], cells: [[2, 1], [2, 0]] },
        { circle: [2, 4], cells: [[2, 3], [2, 2]] },
        { circle: [2, 5], cells: [[2, 4], [2, 3]] },
        { circle: [4, 6], cells: [[4, 5], [4, 4]] },
        { circle: [6, 3], cells: [[6, 4], [6, 5]] },
        { circle: [6, 4], cells: [[5, 4], [4, 4]] },
        { circle: [7, 5], cells: [[7, 4], [7, 3]] },
        { circle: [8, 5], cells: [[8, 6], [8, 7]] }
      ],
      variants: [
        "lines"
      ]
    },
    {
      id: "lines-2",
      title: "Straight and Narrow",
      blurb: "2 givens — featuring thermo, renban, arrow.",
      stars: 8,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 4, 0, 0, 0, 0, 0, 0, 9],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [1, 7, 9, 5, 3, 8, 2, 4, 6],
        [5, 8, 2, 9, 4, 6, 7, 1, 3],
        [4, 6, 3, 2, 1, 7, 5, 9, 8],
        [3, 5, 6, 8, 9, 4, 1, 7, 2],
        [8, 9, 1, 6, 7, 2, 4, 3, 5],
        [2, 4, 7, 1, 5, 3, 6, 8, 9],
        [6, 1, 8, 4, 2, 9, 3, 5, 7],
        [9, 3, 5, 7, 6, 1, 8, 2, 4],
        [7, 2, 4, 3, 8, 5, 9, 6, 1]
      ],
      lines: [
        { kind: "thermo", cells: [[2, 4], [2, 3], [2, 2], [2, 1]] },
        { kind: "thermo", cells: [[3, 0], [3, 1], [3, 2], [3, 3]] },
        { kind: "thermo", cells: [[5, 5], [5, 6], [5, 7], [5, 8]] },
        { kind: "thermo", cells: [[8, 8], [7, 8], [6, 8], [5, 8]] },
        { kind: "thermo", cells: [[0, 4], [0, 3], [0, 2]] },
        { kind: "thermo", cells: [[5, 0], [5, 1], [5, 2]] },
        { kind: "thermo", cells: [[6, 6], [6, 7], [6, 8]] },
        { kind: "thermo", cells: [[3, 0], [2, 0], [1, 0]] },
        { kind: "thermo", cells: [[6, 4], [5, 4], [4, 4]] },
        { kind: "thermo", cells: [[4, 5], [3, 5], [2, 5]] },
        { kind: "thermo", cells: [[4, 5], [5, 5], [6, 5]] },
        { kind: "thermo", cells: [[6, 6], [7, 6], [8, 6]] },
        { kind: "thermo", cells: [[7, 7], [6, 7], [5, 7]] },
        { kind: "thermo", cells: [[7, 8], [6, 8], [5, 8]] },
        { kind: "renban", cells: [[4, 6], [4, 7], [4, 8]] },
        { kind: "renban", cells: [[7, 2], [7, 3], [7, 4]] },
        { kind: "renban", cells: [[0, 1], [1, 1], [2, 1]] },
        { kind: "renban", cells: [[0, 5], [1, 5], [2, 5]] },
        { kind: "renban", cells: [[5, 1], [6, 1], [7, 1], [8, 1]] }
      ],
      arrows: [
        { circle: [0, 5], cells: [[0, 4], [0, 3]] },
        { circle: [2, 6], cells: [[3, 6], [4, 6]] },
        { circle: [4, 0], cells: [[5, 0], [6, 0]] },
        { circle: [5, 1], cells: [[6, 1], [7, 1]] },
        { circle: [5, 2], cells: [[4, 2], [3, 2]] },
        { circle: [6, 2], cells: [[5, 2], [4, 2]] },
        { circle: [7, 3], cells: [[7, 4], [7, 5]] },
        { circle: [8, 4], cells: [[7, 4], [6, 4]] }
      ],
      variants: [
        "lines"
      ]
    },
    {
      id: "lines-3",
      title: "Sum Into the Circle",
      blurb: "2 givens — featuring thermo, renban, arrow.",
      stars: 8,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 9, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 4, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [3, 4, 2, 8, 6, 5, 9, 1, 7],
        [6, 1, 9, 7, 2, 3, 5, 8, 4],
        [7, 8, 5, 9, 4, 1, 2, 3, 6],
        [9, 3, 7, 5, 1, 6, 8, 4, 2],
        [5, 2, 1, 4, 8, 9, 6, 7, 3],
        [4, 6, 8, 3, 7, 2, 1, 5, 9],
        [2, 5, 6, 1, 3, 7, 4, 9, 8],
        [1, 7, 4, 2, 9, 8, 3, 6, 5],
        [8, 9, 3, 6, 5, 4, 7, 2, 1]
      ],
      lines: [
        { kind: "thermo", cells: [[4, 2], [4, 3], [4, 4], [4, 5]] },
        { kind: "thermo", cells: [[8, 2], [7, 2], [6, 2], [5, 2]] },
        { kind: "thermo", cells: [[1, 4], [1, 3], [1, 2]] },
        { kind: "thermo", cells: [[2, 5], [2, 4], [2, 3]] },
        { kind: "thermo", cells: [[2, 6], [2, 7], [2, 8]] },
        { kind: "thermo", cells: [[4, 2], [4, 3], [4, 4]] },
        { kind: "thermo", cells: [[6, 0], [6, 1], [6, 2]] },
        { kind: "thermo", cells: [[8, 5], [8, 4], [8, 3]] },
        { kind: "thermo", cells: [[0, 0], [1, 0], [2, 0]] },
        { kind: "thermo", cells: [[6, 0], [5, 0], [4, 0]] },
        { kind: "thermo", cells: [[4, 3], [3, 3], [2, 3]] },
        { kind: "thermo", cells: [[6, 4], [5, 4], [4, 4]] },
        { kind: "thermo", cells: [[2, 5], [1, 5], [0, 5]] },
        { kind: "thermo", cells: [[5, 5], [6, 5], [7, 5]] },
        { kind: "thermo", cells: [[2, 7], [3, 7], [4, 7]] },
        { kind: "thermo", cells: [[3, 8], [4, 8], [5, 8]] },
        { kind: "thermo", cells: [[7, 8], [6, 8], [5, 8]] },
        { kind: "renban", cells: [[2, 5], [2, 6], [2, 7]] },
        { kind: "renban", cells: [[0, 3], [1, 3], [2, 3]] },
        { kind: "renban", cells: [[5, 3], [6, 3], [7, 3]] },
        { kind: "renban", cells: [[8, 3], [8, 4], [8, 5], [8, 6]] }
      ],
      arrows: [
        { circle: [0, 4], cells: [[1, 4], [2, 4]] },
        { circle: [1, 7], cells: [[1, 6], [1, 5]] },
        { circle: [2, 3], cells: [[3, 3], [4, 3]] },
        { circle: [3, 5], cells: [[3, 4], [3, 3]] },
        { circle: [4, 3], cells: [[5, 3], [6, 3]] },
        { circle: [4, 7], cells: [[3, 7], [2, 7]] },
        { circle: [5, 3], cells: [[6, 3], [7, 3]] },
        { circle: [8, 1], cells: [[8, 2], [8, 3]] }
      ],
      variants: [
        "lines"
      ]
    },
    {
      id: "orbit",
      title: "Orbit",
      blurb: "By Qodec, imported from the community. Uses little killer clues our solver-checker doesn’t support, so this one rests on the community’s own testing rather than our verification.",
      stars: 8,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [6, 5, 4, 8, 1, 7, 3, 2, 9],
        [1, 8, 9, 2, 6, 3, 4, 7, 5],
        [2, 3, 7, 5, 4, 9, 6, 8, 1],
        [9, 2, 5, 4, 7, 1, 8, 3, 6],
        [4, 7, 3, 6, 5, 8, 1, 9, 2],
        [8, 1, 6, 3, 9, 2, 5, 4, 7],
        [3, 6, 8, 7, 2, 5, 9, 1, 4],
        [5, 9, 2, 1, 8, 4, 7, 6, 3],
        [7, 4, 1, 9, 3, 6, 2, 5, 8]
      ],
      arrows: [
        { circle: [2, 6], cells: [[1, 5], [0, 4], [1, 3]] },
        { circle: [2, 2], cells: [[3, 1], [4, 0], [5, 1]] },
        { circle: [6, 2], cells: [[7, 3], [8, 4], [7, 5]] },
        { circle: [6, 6], cells: [[5, 7], [4, 8], [3, 7]] },
        { circle: [4, 6], cells: [[3, 5]] },
        { circle: [2, 4], cells: [[3, 3]] },
        { circle: [4, 2], cells: [[5, 3]] },
        { circle: [6, 4], cells: [[5, 5]] }
      ],
      littleKiller: [
        { cells: [[8, 7], [7, 8]], dir: [-1, 1], sum: 8 },
        { cells: [[1, 8], [0, 7]], dir: [-1, -1], sum: 7 },
        { cells: [[0, 1], [1, 0]], dir: [1, -1], sum: 6 },
        { cells: [[7, 0], [8, 1]], dir: [1, 1], sum: 9 },
        { cells: [[0, 5], [1, 4], [2, 3], [3, 2], [4, 1], [5, 0]], dir: [1, -1], sum: 38 },
        { cells: [[5, 8], [4, 7], [3, 6], [2, 5], [1, 4], [0, 3]], dir: [-1, -1], sum: 47 },
        { cells: [[8, 3], [7, 4], [6, 5], [5, 6], [4, 7], [3, 8]], dir: [-1, 1], sum: 42 },
        { cells: [[3, 0], [4, 1], [5, 2], [6, 3], [7, 4], [8, 5]], dir: [1, 1], sum: 43 }
      ],
      variants: [
        "lines"
      ]
    },
    {
      id: "compass",
      title: "Compass",
      blurb: "By Jonas Gleim, imported from GM Puzzles (a 2022 Sunday Stumper, their top difficulty tier). No givens — four corner arrows and six thermometers, arranged so the thermometers trace N/S/E/W around the center.",
      stars: 10,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [7, 1, 6, 4, 9, 8, 5, 2, 3],
        [2, 8, 4, 3, 5, 7, 9, 6, 1],
        [3, 9, 5, 2, 1, 6, 4, 7, 8],
        [6, 7, 8, 9, 3, 5, 1, 4, 2],
        [9, 2, 3, 8, 4, 1, 7, 5, 6],
        [4, 5, 1, 6, 7, 2, 3, 8, 9],
        [1, 4, 2, 5, 8, 9, 6, 3, 7],
        [5, 6, 7, 1, 2, 3, 8, 9, 4],
        [8, 3, 9, 7, 6, 4, 2, 1, 5]
      ],
      lines: [
        { kind: "thermo", cells: [[2, 3], [1, 3], [0, 3], [1, 4], [2, 5], [1, 5], [0, 5]] },
        { kind: "thermo", cells: [[5, 2], [4, 1], [5, 0], [4, 0]] },
        { kind: "thermo", cells: [[5, 2], [4, 2]] },
        { kind: "thermo", cells: [[3, 8], [3, 7], [4, 7], [4, 8], [5, 7], [5, 8]] },
        { kind: "thermo", cells: [[7, 3], [7, 4], [7, 5], [8, 5], [8, 4], [8, 3]] },
        { kind: "thermo", cells: [[7, 3], [6, 3], [6, 4], [6, 5]] }
      ],
      arrows: [
        { circle: [0, 2], cells: [[0, 1], [1, 0], [2, 0]] },
        { circle: [2, 8], cells: [[1, 8], [0, 7], [0, 6]] },
        { circle: [8, 2], cells: [[8, 1], [7, 0], [6, 0]] },
        { circle: [6, 8], cells: [[7, 8], [8, 7], [8, 6]] },
        { circle: [5, 4], cells: [[4, 4], [3, 4]] }
      ],
      variants: [
        "lines"
      ]
    },
    {
      id: "long-climb",
      title: "The Long Climb",
      blurb: "By Sam Cappleman-Lynes (\"Puzzle #1\"). No givens — six thermometers, including one nine-cell thermometer that climbs 1 through 9 in a single unbroken sequence.",
      stars: 9,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [8, 1, 2, 7, 9, 3, 4, 6, 5],
        [6, 4, 3, 2, 8, 5, 9, 7, 1],
        [7, 5, 9, 1, 4, 6, 2, 8, 3],
        [3, 6, 1, 4, 5, 7, 8, 9, 2],
        [5, 7, 8, 9, 6, 2, 3, 1, 4],
        [9, 2, 4, 3, 1, 8, 6, 5, 7],
        [2, 9, 6, 5, 3, 1, 7, 4, 8],
        [1, 8, 7, 6, 2, 4, 5, 3, 9],
        [4, 3, 5, 8, 7, 9, 1, 2, 6]
      ],
      lines: [
        { kind: "thermo", cells: [[0, 5], [0, 6], [0, 7], [1, 7], [2, 7], [3, 7]] },
        { kind: "thermo", cells: [[1, 5], [2, 5], [3, 5], [3, 6]] },
        { kind: "thermo", cells: [[2, 3], [1, 3], [1, 2], [1, 1], [2, 1], [3, 1], [4, 1], [4, 2], [4, 3]] },
        { kind: "thermo", cells: [[5, 3], [6, 3], [7, 3], [7, 2], [7, 1], [6, 1]] },
        { kind: "thermo", cells: [[6, 5], [7, 5], [8, 5]] },
        { kind: "thermo", cells: [[8, 6], [8, 7], [7, 7], [6, 7], [5, 7], [5, 6], [5, 5]] }
      ],
      variants: [
        "lines"
      ]
    },
    {
      id: "long-climb",
      title: "The Long Climb",
      blurb: "By Sam Cappleman-Lynes (\"Puzzle #1\"). No givens — six thermometers, including one nine-cell thermometer that climbs 1 through 9 in a single unbroken sequence.",
      stars: 9,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [8, 1, 2, 7, 9, 3, 4, 6, 5],
        [6, 4, 3, 2, 8, 5, 9, 7, 1],
        [7, 5, 9, 1, 4, 6, 2, 8, 3],
        [3, 6, 1, 4, 5, 7, 8, 9, 2],
        [5, 7, 8, 9, 6, 2, 3, 1, 4],
        [9, 2, 4, 3, 1, 8, 6, 5, 7],
        [2, 9, 6, 5, 3, 1, 7, 4, 8],
        [1, 8, 7, 6, 2, 4, 5, 3, 9],
        [4, 3, 5, 8, 7, 9, 1, 2, 6]
      ],
      lines: [
        { kind: "thermo", cells: [[0, 5], [0, 6], [0, 7], [1, 7], [2, 7], [3, 7]] },
        { kind: "thermo", cells: [[1, 5], [2, 5], [3, 5], [3, 6]] },
        { kind: "thermo", cells: [[2, 3], [1, 3], [1, 2], [1, 1], [2, 1], [3, 1], [4, 1], [4, 2], [4, 3]] },
        { kind: "thermo", cells: [[5, 3], [6, 3], [7, 3], [7, 2], [7, 1], [6, 1]] },
        { kind: "thermo", cells: [[6, 5], [7, 5], [8, 5]] },
        { kind: "thermo", cells: [[8, 6], [8, 7], [7, 7], [6, 7], [5, 7], [5, 6], [5, 5]] }
      ],
      variants: [
        "lines"
      ]
    },

    // ---- Anti-Knight ----
    {
      id: "antiknight-1",
      title: "Forbidden Leap",
      blurb: "30 givens — ordinary sudoku rules plus: no two cells a knight's-move apart share a digit.",
      stars: 2,
      givens: [
        [0, 0, 2, 0, 0, 4, 0, 6, 7],
        [0, 3, 0, 0, 6, 0, 0, 0, 0],
        [0, 6, 0, 9, 1, 2, 0, 3, 0],
        [0, 0, 0, 0, 0, 0, 6, 0, 0],
        [0, 0, 5, 6, 0, 0, 1, 2, 0],
        [0, 0, 0, 1, 2, 8, 0, 0, 0],
        [0, 8, 3, 0, 0, 6, 0, 0, 0],
        [4, 0, 6, 7, 0, 0, 2, 0, 0],
        [0, 9, 0, 2, 0, 3, 4, 0, 0]
      ],
      solution: [
        [9, 1, 2, 8, 3, 4, 5, 6, 7],
        [8, 3, 4, 5, 6, 7, 9, 1, 2],
        [5, 6, 7, 9, 1, 2, 8, 3, 4],
        [1, 2, 8, 3, 4, 5, 6, 7, 9],
        [3, 4, 5, 6, 7, 9, 1, 2, 8],
        [6, 7, 9, 1, 2, 8, 3, 4, 5],
        [2, 8, 3, 4, 5, 6, 7, 9, 1],
        [4, 5, 6, 7, 9, 1, 2, 8, 3],
        [7, 9, 1, 2, 8, 3, 4, 5, 6]
      ],
      antiKnight: true,
      variants: [
        "antiknight"
      ]
    },
    {
      id: "antiknight-2",
      title: "Knight's Shadow",
      blurb: "33 givens — ordinary sudoku rules plus: no two cells a knight's-move apart share a digit.",
      stars: 2,
      givens: [
        [0, 0, 9, 0, 0, 6, 0, 0, 8],
        [4, 0, 6, 0, 0, 0, 7, 9, 0],
        [0, 0, 8, 0, 0, 0, 1, 6, 0],
        [0, 9, 0, 0, 0, 0, 0, 0, 0],
        [1, 6, 4, 0, 8, 3, 9, 0, 0],
        [0, 0, 3, 0, 2, 0, 6, 4, 1],
        [0, 2, 0, 0, 0, 0, 0, 3, 5],
        [0, 4, 1, 0, 0, 5, 0, 7, 0],
        [8, 0, 5, 2, 0, 0, 0, 0, 6]
      ],
      solution: [
        [2, 7, 9, 4, 1, 6, 3, 5, 8],
        [4, 1, 6, 3, 5, 8, 7, 9, 2],
        [3, 5, 8, 7, 9, 2, 1, 6, 4],
        [7, 9, 2, 1, 6, 4, 5, 8, 3],
        [1, 6, 4, 5, 8, 3, 9, 2, 7],
        [5, 8, 3, 9, 2, 7, 6, 4, 1],
        [9, 2, 7, 6, 4, 1, 8, 3, 5],
        [6, 4, 1, 8, 3, 5, 2, 7, 9],
        [8, 3, 5, 2, 7, 9, 4, 1, 6]
      ],
      antiKnight: true,
      variants: [
        "antiknight"
      ]
    },

    // ---- Sandwich ----
    {
      id: "sandwich-1",
      title: "Between the Bread",
      blurb: "16 givens, plus all 18 row and column sandwich sums.",
      stars: 4,
      givens: [
        [0, 2, 0, 0, 0, 0, 0, 9, 0],
        [0, 0, 0, 0, 0, 8, 3, 0, 7],
        [0, 6, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0, 3, 0],
        [0, 0, 4, 0, 0, 0, 8, 0, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 5, 9, 7, 0, 0],
        [0, 0, 0, 2, 0, 0, 0, 0, 5]
      ],
      solution: [
        [3, 2, 5, 4, 1, 7, 6, 9, 8],
        [9, 4, 1, 5, 6, 8, 3, 2, 7],
        [8, 6, 7, 3, 9, 2, 1, 5, 4],
        [6, 9, 3, 1, 8, 5, 4, 7, 2],
        [2, 1, 8, 7, 4, 6, 5, 3, 9],
        [5, 7, 4, 9, 2, 3, 8, 6, 1],
        [4, 5, 9, 6, 7, 1, 2, 8, 3],
        [1, 3, 2, 8, 5, 9, 7, 4, 6],
        [7, 8, 6, 2, 3, 4, 9, 1, 5]
      ],
      sandwich: { rows: [13, 4, 2, 3, 33, 19, 13, 18, 0], cols: [25, 0, 22, 7, 6, 0, 26, 35, 0] },
      variants: [
        "sandwich"
      ]
    },
    {
      id: "sandwich-2",
      title: "Filling Only",
      blurb: "14 givens, plus all 18 row and column sandwich sums.",
      stars: 5,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 2, 6, 7, 0],
        [0, 9, 0, 0, 0, 0, 5, 0, 0],
        [0, 6, 3, 0, 0, 1, 4, 8, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 7, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 3, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 7, 0, 0]
      ],
      solution: [
        [7, 3, 5, 4, 1, 6, 9, 2, 8],
        [1, 8, 4, 9, 5, 2, 6, 7, 3],
        [6, 9, 2, 7, 8, 3, 5, 1, 4],
        [5, 6, 3, 2, 9, 1, 4, 8, 7],
        [2, 4, 9, 3, 7, 8, 1, 6, 5],
        [8, 1, 7, 5, 6, 4, 3, 9, 2],
        [3, 5, 1, 6, 2, 7, 8, 4, 9],
        [4, 7, 8, 1, 3, 9, 2, 5, 6],
        [9, 2, 6, 8, 4, 5, 7, 3, 1]
      ],
      sandwich: { rows: [6, 12, 25, 0, 18, 25, 27, 3, 35], cols: [28, 10, 7, 23, 13, 19, 15, 14, 6] },
      variants: [
        "sandwich"
      ]
    },

    // ---- XV ----
    {
      id: "xv-1",
      title: "Tens and Fives",
      blurb: "9 givens plus every X/V marker the grid supports — no marker means no information.",
      stars: 7,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 7, 0, 9, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 9, 0, 8, 0, 6, 0, 0],
        [0, 0, 0, 0, 0, 3, 0, 0, 0],
        [0, 0, 5, 0, 0, 0, 0, 7, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 6, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ],
      solution: [
        [5, 8, 6, 3, 4, 1, 9, 2, 7],
        [1, 7, 2, 9, 5, 8, 4, 3, 6],
        [3, 9, 4, 7, 2, 6, 1, 8, 5],
        [2, 4, 9, 5, 8, 7, 6, 1, 3],
        [7, 6, 1, 2, 9, 3, 8, 5, 4],
        [8, 3, 5, 1, 6, 4, 2, 7, 9],
        [9, 2, 3, 6, 1, 5, 7, 4, 8],
        [4, 1, 7, 8, 3, 9, 5, 6, 2],
        [6, 5, 8, 4, 7, 2, 3, 9, 1]
      ],
      xv: [
        { a: [0, 4], b: [0, 5], kind: "V" },
        { a: [0, 5], b: [0, 6], kind: "X" },
        { a: [0, 7], b: [1, 7], kind: "V" },
        { a: [1, 6], b: [2, 6], kind: "V" },
        { a: [2, 0], b: [3, 0], kind: "V" },
        { a: [2, 4], b: [3, 4], kind: "X" },
        { a: [3, 1], b: [4, 1], kind: "X" },
        { a: [3, 2], b: [4, 2], kind: "X" },
        { a: [3, 5], b: [4, 5], kind: "X" },
        { a: [4, 6], b: [5, 6], kind: "X" },
        { a: [5, 1], b: [6, 1], kind: "V" },
        { a: [5, 4], b: [5, 5], kind: "X" },
        { a: [6, 1], b: [6, 2], kind: "V" },
        { a: [6, 2], b: [7, 2], kind: "X" },
        { a: [6, 7], b: [7, 7], kind: "X" },
        { a: [6, 8], b: [7, 8], kind: "X" },
        { a: [7, 0], b: [7, 1], kind: "V" },
        { a: [7, 0], b: [8, 0], kind: "X" },
        { a: [7, 4], b: [8, 4], kind: "X" },
        { a: [8, 5], b: [8, 6], kind: "V" },
        { a: [8, 7], b: [8, 8], kind: "X" }
      ],
      variants: [
        "xv"
      ]
    },
    {
      id: "xv-2",
      title: "Roman Numerals",
      blurb: "8 givens plus every X/V marker the grid supports — no marker means no information.",
      stars: 7,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 3, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 8, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 8, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 9, 8, 0, 6, 0, 0, 0, 3]
      ],
      solution: [
        [8, 1, 7, 3, 2, 5, 4, 6, 9],
        [9, 3, 5, 6, 4, 1, 7, 8, 2],
        [4, 6, 2, 8, 9, 7, 5, 3, 1],
        [2, 7, 3, 4, 1, 6, 8, 9, 5],
        [6, 5, 9, 7, 8, 3, 2, 1, 4],
        [1, 8, 4, 2, 5, 9, 3, 7, 6],
        [5, 4, 1, 9, 3, 8, 6, 2, 7],
        [3, 2, 6, 1, 7, 4, 9, 5, 8],
        [7, 9, 8, 5, 6, 2, 1, 4, 3]
      ],
      xv: [
        { a: [0, 2], b: [0, 3], kind: "X" },
        { a: [0, 3], b: [0, 4], kind: "V" },
        { a: [0, 6], b: [0, 7], kind: "X" },
        { a: [1, 3], b: [1, 4], kind: "X" },
        { a: [1, 4], b: [1, 5], kind: "V" },
        { a: [1, 7], b: [1, 8], kind: "X" },
        { a: [2, 0], b: [2, 1], kind: "X" },
        { a: [2, 2], b: [2, 3], kind: "X" },
        { a: [2, 2], b: [3, 2], kind: "V" },
        { a: [2, 4], b: [3, 4], kind: "X" },
        { a: [3, 1], b: [3, 2], kind: "X" },
        { a: [3, 3], b: [3, 4], kind: "V" },
        { a: [3, 6], b: [4, 6], kind: "X" },
        { a: [3, 7], b: [4, 7], kind: "X" },
        { a: [4, 5], b: [4, 6], kind: "V" },
        { a: [4, 6], b: [5, 6], kind: "V" },
        { a: [4, 7], b: [4, 8], kind: "V" },
        { a: [4, 8], b: [5, 8], kind: "X" },
        { a: [5, 2], b: [6, 2], kind: "V" },
        { a: [5, 6], b: [5, 7], kind: "X" },
        { a: [6, 1], b: [6, 2], kind: "V" },
        { a: [6, 2], b: [6, 3], kind: "X" },
        { a: [6, 3], b: [7, 3], kind: "X" },
        { a: [6, 4], b: [7, 4], kind: "X" },
        { a: [7, 0], b: [7, 1], kind: "V" },
        { a: [7, 0], b: [8, 0], kind: "X" },
        { a: [7, 6], b: [8, 6], kind: "X" },
        { a: [8, 6], b: [8, 7], kind: "V" }
      ],
      variants: [
        "xv"
      ]
    },

    // ---- Diagonal (X) ----
    {
      id: "diagonal-1",
      title: "Crossroads",
      blurb: "32 givens — both long diagonals also hold every digit 1–9, same as a row.",
      stars: 3,
      givens: [
        [4, 0, 8, 0, 6, 0, 0, 0, 0],
        [3, 2, 0, 5, 7, 0, 0, 0, 0],
        [0, 0, 6, 2, 8, 0, 0, 5, 1],
        [0, 0, 0, 0, 0, 1, 6, 7, 2],
        [2, 6, 7, 9, 0, 0, 1, 4, 0],
        [1, 0, 4, 0, 0, 0, 0, 0, 0],
        [0, 0, 2, 7, 0, 6, 0, 0, 4],
        [0, 0, 3, 0, 9, 0, 0, 0, 0],
        [7, 0, 0, 0, 0, 5, 0, 0, 0]
      ],
      solution: [
        [4, 5, 8, 1, 6, 3, 7, 2, 9],
        [3, 2, 1, 5, 7, 9, 4, 8, 6],
        [9, 7, 6, 2, 8, 4, 3, 5, 1],
        [8, 9, 5, 3, 4, 1, 6, 7, 2],
        [2, 6, 7, 9, 5, 8, 1, 4, 3],
        [1, 3, 4, 6, 2, 7, 8, 9, 5],
        [5, 8, 2, 7, 1, 6, 9, 3, 4],
        [6, 4, 3, 8, 9, 2, 5, 1, 7],
        [7, 1, 9, 4, 3, 5, 2, 6, 8]
      ],
      diagonals: true,
      variants: [
        "diagonal"
      ]
    },
    {
      id: "diagonal-2",
      title: "X Marks the Spot",
      blurb: "28 givens — both long diagonals also hold every digit 1–9, same as a row.",
      stars: 5,
      givens: [
        [0, 0, 0, 6, 0, 0, 0, 0, 0],
        [0, 5, 0, 0, 4, 3, 0, 0, 0],
        [3, 0, 0, 5, 0, 0, 8, 0, 0],
        [2, 0, 5, 0, 0, 0, 0, 0, 1],
        [9, 7, 4, 0, 0, 0, 6, 8, 0],
        [0, 0, 0, 0, 2, 0, 0, 0, 3],
        [0, 0, 0, 3, 0, 1, 2, 0, 0],
        [7, 0, 2, 0, 9, 0, 0, 6, 0],
        [0, 8, 3, 2, 0, 0, 0, 1, 0]
      ],
      solution: [
        [1, 2, 9, 6, 8, 7, 5, 3, 4],
        [6, 5, 8, 9, 4, 3, 1, 2, 7],
        [3, 4, 7, 5, 1, 2, 8, 9, 6],
        [2, 3, 5, 8, 6, 9, 7, 4, 1],
        [9, 7, 4, 1, 3, 5, 6, 8, 2],
        [8, 6, 1, 7, 2, 4, 9, 5, 3],
        [4, 9, 6, 3, 5, 1, 2, 7, 8],
        [7, 1, 2, 4, 9, 8, 3, 6, 5],
        [5, 8, 3, 2, 7, 6, 4, 1, 9]
      ],
      diagonals: true,
      variants: [
        "diagonal"
      ]
    },
    {
      id: "diagonal-3",
      title: "Both Ways",
      blurb: "25 givens — both long diagonals also hold every digit 1–9, same as a row. The diagonal constraint is doing most of the heavy lifting here.",
      stars: 7,
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 8, 5],
        [0, 0, 0, 5, 0, 0, 0, 0, 2],
        [5, 2, 0, 0, 0, 0, 0, 0, 0],
        [2, 4, 0, 0, 0, 1, 0, 0, 7],
        [6, 0, 0, 0, 0, 4, 3, 2, 0],
        [8, 0, 0, 0, 5, 0, 0, 0, 0],
        [7, 8, 0, 0, 0, 9, 0, 0, 0],
        [0, 0, 4, 0, 1, 5, 0, 3, 0],
        [0, 0, 5, 0, 0, 0, 0, 9, 0]
      ],
      solution: [
        [1, 3, 6, 4, 2, 7, 9, 8, 5],
        [4, 9, 8, 5, 6, 3, 1, 7, 2],
        [5, 2, 7, 1, 9, 8, 4, 6, 3],
        [2, 4, 9, 6, 3, 1, 8, 5, 7],
        [6, 5, 1, 7, 8, 4, 3, 2, 9],
        [8, 7, 3, 9, 5, 2, 6, 4, 1],
        [7, 8, 2, 3, 4, 9, 5, 1, 6],
        [9, 6, 4, 2, 1, 5, 7, 3, 8],
        [3, 1, 5, 8, 7, 6, 2, 9, 4]
      ],
      diagonals: true,
      variants: [
        "diagonal"
      ]
    },

    // ---- Odd/Even ----
    {
      id: "oddeven-1",
      title: "Odds and Ends",
      blurb: "19 givens plus 7 parity clues. Shaded circles must be odd, shaded squares even.",
      stars: 5,
      givens: [
        [1, 0, 0, 0, 8, 0, 0, 0, 0],
        [0, 0, 5, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 6, 9, 2, 0],
        [0, 0, 0, 0, 0, 0, 0, 6, 0],
        [0, 0, 0, 6, 0, 0, 0, 0, 0],
        [0, 0, 0, 3, 0, 0, 0, 0, 0],
        [7, 0, 0, 1, 0, 0, 0, 0, 8],
        [6, 0, 0, 0, 5, 0, 1, 0, 0],
        [0, 8, 0, 0, 0, 0, 5, 9, 0]
      ],
      solution: [
        [1, 6, 2, 9, 8, 3, 7, 5, 4],
        [9, 7, 5, 2, 1, 4, 8, 3, 6],
        [3, 4, 8, 5, 7, 6, 9, 2, 1],
        [8, 2, 3, 7, 9, 1, 4, 6, 5],
        [4, 1, 7, 6, 2, 5, 3, 8, 9],
        [5, 9, 6, 3, 4, 8, 2, 1, 7],
        [7, 5, 9, 1, 3, 2, 6, 4, 8],
        [6, 3, 4, 8, 5, 9, 1, 7, 2],
        [2, 8, 1, 4, 6, 7, 5, 9, 3]
      ],
      oddEven: [
        { cell: [6, 5], parity: "even" },
        { cell: [4, 6], parity: "odd" },
        { cell: [7, 3], parity: "even" },
        { cell: [0, 8], parity: "even" },
        { cell: [8, 8], parity: "odd" },
        { cell: [3, 1], parity: "even" },
        { cell: [2, 0], parity: "odd" }
      ],
      variants: [
        "oddeven"
      ]
    },
    {
      id: "oddeven-2",
      title: "Parity Check",
      blurb: "19 givens plus 7 parity clues.",
      stars: 6,
      givens: [
        [5, 0, 0, 0, 0, 0, 0, 0, 6],
        [0, 2, 0, 9, 4, 0, 0, 0, 0],
        [0, 8, 0, 2, 0, 0, 3, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 8],
        [2, 0, 0, 3, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 7, 0, 5, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 1],
        [3, 0, 0, 0, 0, 8, 0, 0, 0],
        [4, 0, 7, 0, 1, 0, 0, 0, 0]
      ],
      solution: [
        [5, 4, 3, 1, 8, 7, 9, 2, 6],
        [7, 2, 6, 9, 4, 3, 8, 1, 5],
        [9, 8, 1, 2, 5, 6, 3, 7, 4],
        [1, 3, 5, 4, 9, 2, 7, 6, 8],
        [2, 7, 8, 3, 6, 5, 1, 4, 9],
        [6, 9, 4, 8, 7, 1, 5, 3, 2],
        [8, 5, 2, 7, 3, 4, 6, 9, 1],
        [3, 1, 9, 6, 2, 8, 4, 5, 7],
        [4, 6, 7, 5, 1, 9, 2, 8, 3]
      ],
      oddEven: [
        { cell: [0, 1], parity: "even" },
        { cell: [3, 4], parity: "odd" },
        { cell: [5, 0], parity: "even" },
        { cell: [7, 7], parity: "odd" },
        { cell: [6, 4], parity: "odd" },
        { cell: [4, 4], parity: "even" },
        { cell: [4, 7], parity: "even" }
      ],
      variants: [
        "oddeven"
      ]
    },
    {
      id: "oddeven-3",
      title: "Even Odder",
      blurb: "19 givens plus 7 parity clues. The trickiest of the three.",
      stars: 7,
      givens: [
        [0, 4, 0, 2, 0, 0, 1, 0, 0],
        [7, 0, 0, 0, 0, 0, 5, 0, 0],
        [0, 0, 0, 7, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 8, 0, 0, 0, 0],
        [0, 7, 0, 0, 1, 0, 9, 0, 0],
        [1, 0, 0, 0, 0, 7, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 8],
        [9, 1, 4, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 4, 0, 6, 0, 3]
      ],
      solution: [
        [5, 4, 8, 2, 9, 6, 1, 3, 7],
        [7, 2, 9, 8, 3, 1, 5, 6, 4],
        [3, 6, 1, 7, 5, 4, 2, 8, 9],
        [4, 9, 2, 6, 8, 5, 3, 7, 1],
        [8, 7, 5, 4, 1, 3, 9, 2, 6],
        [1, 3, 6, 9, 2, 7, 8, 4, 5],
        [6, 5, 3, 1, 7, 2, 4, 9, 8],
        [9, 1, 4, 3, 6, 8, 7, 5, 2],
        [2, 8, 7, 5, 4, 9, 6, 1, 3]
      ],
      oddEven: [
        { cell: [3, 1], parity: "odd" },
        { cell: [7, 3], parity: "odd" },
        { cell: [5, 6], parity: "even" },
        { cell: [2, 8], parity: "odd" },
        { cell: [5, 8], parity: "odd" },
        { cell: [6, 2], parity: "odd" },
        { cell: [4, 2], parity: "odd" }
      ],
      variants: [
        "oddeven"
      ]
    },

    // ---- Fog of War ----
    {
      id: "fog-1",
      title: "First Light",
      blurb: "40 givens, only 71 cells visible at the start. Fill a visible cell correctly and the fog burns off around it.",
      stars: 3,
      givens: [
        [0, 2, 0, 0, 7, 8, 0, 3, 0],
        [0, 0, 5, 0, 9, 3, 0, 0, 2],
        [0, 0, 3, 5, 0, 2, 7, 0, 9],
        [3, 0, 1, 0, 5, 0, 4, 0, 7],
        [0, 5, 7, 0, 0, 0, 0, 8, 0],
        [2, 6, 8, 9, 0, 7, 3, 5, 1],
        [0, 1, 0, 3, 0, 0, 0, 0, 8],
        [0, 3, 0, 0, 8, 0, 2, 0, 0],
        [5, 0, 2, 7, 0, 4, 1, 0, 0]
      ],
      solution: [
        [1, 2, 9, 6, 7, 8, 5, 3, 4],
        [6, 7, 5, 4, 9, 3, 8, 1, 2],
        [8, 4, 3, 5, 1, 2, 7, 6, 9],
        [3, 9, 1, 8, 5, 6, 4, 2, 7],
        [4, 5, 7, 2, 3, 1, 9, 8, 6],
        [2, 6, 8, 9, 4, 7, 3, 5, 1],
        [9, 1, 4, 3, 2, 5, 6, 7, 8],
        [7, 3, 6, 1, 8, 9, 2, 4, 5],
        [5, 8, 2, 7, 6, 4, 1, 9, 3]
      ],
      fog: {
        reveal: [[8, 3], [5, 1], [0, 2], [2, 6], [4, 8], [4, 5], [6, 6], [7, 2], [1, 5], [4, 1], [8, 5], [0, 1], [3, 2], [8, 6], [1, 3], [3, 1], [7, 3], [6, 8], [1, 1], [7, 0], [8, 8], [1, 8], [5, 6], [8, 2]],
        radius: 1
      },
      variants: [
        "fog"
      ]
    },
    {
      id: "fog-2",
      title: "Burning Off",
      blurb: "40 givens, only 70 cells visible at the start.",
      stars: 4,
      givens: [
        [3, 0, 5, 0, 1, 2, 0, 4, 7],
        [6, 0, 8, 0, 7, 0, 0, 0, 2],
        [4, 7, 0, 5, 0, 6, 9, 8, 0],
        [0, 6, 0, 0, 0, 0, 7, 0, 4],
        [7, 2, 4, 1, 5, 8, 0, 0, 9],
        [0, 3, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 6, 0, 0, 5, 2, 0, 0],
        [0, 4, 0, 6, 2, 0, 8, 7, 0],
        [0, 5, 0, 3, 8, 0, 4, 0, 0]
      ],
      solution: [
        [3, 9, 5, 8, 1, 2, 6, 4, 7],
        [6, 1, 8, 9, 7, 4, 5, 3, 2],
        [4, 7, 2, 5, 3, 6, 9, 8, 1],
        [8, 6, 1, 2, 9, 3, 7, 5, 4],
        [7, 2, 4, 1, 5, 8, 3, 6, 9],
        [5, 3, 9, 4, 6, 7, 1, 2, 8],
        [1, 8, 6, 7, 4, 5, 2, 9, 3],
        [9, 4, 3, 6, 2, 1, 8, 7, 5],
        [2, 5, 7, 3, 8, 9, 4, 1, 6]
      ],
      fog: {
        reveal: [[2, 8], [6, 6], [0, 0], [4, 2], [0, 3], [8, 4], [8, 1], [4, 5], [5, 6], [6, 7], [3, 1], [7, 6], [0, 6], [1, 4], [7, 7], [0, 8], [2, 7], [2, 4], [7, 5], [8, 2]],
        radius: 1
      },
      variants: [
        "fog"
      ]
    },
    {
      id: "fog-3",
      title: "Low Visibility",
      blurb: "40 givens, only 59 cells visible at the start.",
      stars: 5,
      givens: [
        [9, 0, 7, 3, 1, 6, 0, 0, 8],
        [8, 3, 0, 5, 7, 0, 1, 0, 9],
        [0, 1, 0, 0, 0, 0, 0, 0, 3],
        [0, 0, 0, 0, 5, 7, 2, 4, 0],
        [0, 0, 4, 1, 0, 2, 0, 0, 7],
        [2, 0, 0, 4, 9, 0, 0, 0, 0],
        [4, 2, 0, 8, 0, 9, 0, 0, 5],
        [7, 0, 8, 2, 0, 1, 0, 9, 4],
        [0, 9, 0, 7, 0, 0, 3, 8, 0]
      ],
      solution: [
        [9, 4, 7, 3, 1, 6, 5, 2, 8],
        [8, 3, 2, 5, 7, 4, 1, 6, 9],
        [6, 1, 5, 9, 2, 8, 4, 7, 3],
        [3, 8, 9, 6, 5, 7, 2, 4, 1],
        [5, 6, 4, 1, 8, 2, 9, 3, 7],
        [2, 7, 1, 4, 9, 3, 8, 5, 6],
        [4, 2, 3, 8, 6, 9, 7, 1, 5],
        [7, 5, 8, 2, 3, 1, 6, 9, 4],
        [1, 9, 6, 7, 4, 5, 3, 8, 2]
      ],
      fog: {
        reveal: [[5, 3], [6, 2], [0, 4], [1, 6], [7, 8], [4, 1], [8, 4], [5, 8], [1, 0], [4, 4], [1, 3], [8, 1], [2, 5], [8, 8], [5, 4], [6, 7], [4, 2], [8, 6]],
        radius: 1
      },
      variants: [
        "fog"
      ]
    },
    {
      id: "fog-4",
      title: "Whiteout",
      blurb: "40 givens, only 57 cells visible at the start.",
      stars: 6,
      givens: [
        [8, 0, 5, 0, 1, 0, 4, 7, 0],
        [2, 0, 4, 0, 0, 0, 0, 0, 1],
        [6, 0, 0, 0, 7, 5, 0, 0, 0],
        [9, 8, 0, 2, 0, 0, 7, 0, 0],
        [1, 2, 0, 9, 4, 0, 0, 8, 5],
        [5, 0, 0, 1, 0, 7, 6, 0, 0],
        [4, 0, 0, 7, 0, 0, 9, 0, 3],
        [0, 5, 9, 3, 2, 0, 8, 0, 6],
        [3, 0, 8, 0, 0, 0, 1, 2, 7]
      ],
      solution: [
        [8, 3, 5, 6, 1, 2, 4, 7, 9],
        [2, 7, 4, 8, 3, 9, 5, 6, 1],
        [6, 9, 1, 4, 7, 5, 2, 3, 8],
        [9, 8, 6, 2, 5, 3, 7, 1, 4],
        [1, 2, 7, 9, 4, 6, 3, 8, 5],
        [5, 4, 3, 1, 8, 7, 6, 9, 2],
        [4, 1, 2, 7, 6, 8, 9, 5, 3],
        [7, 5, 9, 3, 2, 1, 8, 4, 6],
        [3, 6, 8, 5, 9, 4, 1, 2, 7]
      ],
      fog: {
        reveal: [[7, 3], [3, 5], [0, 8], [1, 1], [5, 8], [8, 7], [8, 1], [2, 4], [5, 0], [0, 1], [1, 2], [3, 3], [4, 7], [2, 0], [0, 0], [8, 4]],
        radius: 1
      },
      variants: [
        "fog"
      ]
    },
    {
      id: "fog-5",
      title: "Zero Visibility",
      blurb: "40 givens, only 52 cells visible at the start.",
      stars: 7,
      givens: [
        [3, 2, 0, 8, 0, 5, 6, 0, 9],
        [4, 8, 9, 0, 0, 0, 1, 0, 2],
        [0, 7, 6, 0, 0, 9, 0, 8, 0],
        [6, 0, 0, 9, 8, 3, 7, 0, 0],
        [0, 0, 7, 0, 0, 4, 0, 9, 0],
        [0, 3, 0, 1, 7, 2, 0, 4, 6],
        [0, 0, 0, 0, 0, 6, 9, 0, 0],
        [8, 6, 4, 5, 0, 0, 2, 0, 0],
        [1, 0, 0, 7, 2, 0, 0, 0, 5]
      ],
      solution: [
        [3, 2, 1, 8, 4, 5, 6, 7, 9],
        [4, 8, 9, 3, 6, 7, 1, 5, 2],
        [5, 7, 6, 2, 1, 9, 3, 8, 4],
        [6, 4, 5, 9, 8, 3, 7, 2, 1],
        [2, 1, 7, 6, 5, 4, 8, 9, 3],
        [9, 3, 8, 1, 7, 2, 5, 4, 6],
        [7, 5, 2, 4, 3, 6, 9, 1, 8],
        [8, 6, 4, 5, 9, 1, 2, 3, 7],
        [1, 9, 3, 7, 2, 8, 4, 6, 5]
      ],
      fog: {
        reveal: [[0, 5], [8, 8], [0, 6], [8, 5], [7, 0], [3, 4], [3, 8], [1, 1], [3, 1], [1, 8], [3, 3], [5, 5], [7, 8], [4, 3]],
        radius: 1
      },
      variants: [
        "fog"
      ]
    },
    {
      id: "fog-6",
      title: "Blind Spot",
      blurb: "40 givens, only 57 cells visible at the start. Fewer clues, and less of the grid to see them by.",
      stars: 8,
      givens: [
        [6, 9, 8, 5, 1, 0, 0, 7, 0],
        [0, 0, 1, 0, 7, 0, 0, 0, 5],
        [0, 0, 0, 4, 0, 9, 0, 8, 3],
        [1, 7, 2, 9, 0, 0, 8, 0, 0],
        [0, 0, 0, 8, 3, 0, 9, 2, 1],
        [0, 0, 9, 0, 2, 0, 5, 0, 7],
        [9, 0, 3, 0, 8, 2, 0, 5, 4],
        [0, 0, 7, 0, 0, 0, 0, 6, 0],
        [2, 0, 6, 7, 0, 4, 0, 0, 9]
      ],
      solution: [
        [6, 9, 8, 5, 1, 3, 4, 7, 2],
        [3, 4, 1, 2, 7, 8, 6, 9, 5],
        [7, 2, 5, 4, 6, 9, 1, 8, 3],
        [1, 7, 2, 9, 4, 5, 8, 3, 6],
        [5, 6, 4, 8, 3, 7, 9, 2, 1],
        [8, 3, 9, 1, 2, 6, 5, 4, 7],
        [9, 1, 3, 6, 8, 2, 7, 5, 4],
        [4, 5, 7, 3, 9, 1, 2, 6, 8],
        [2, 8, 6, 7, 5, 4, 3, 1, 9]
      ],
      fog: {
        reveal: [[3, 8], [1, 2], [1, 3], [3, 0], [6, 1], [3, 4], [6, 8], [8, 5], [1, 8], [3, 6], [0, 1], [5, 4], [2, 5]],
        radius: 1
      },
      variants: [
        "fog"
      ]
    },
  ];
})();
