// ============================================================
// Hand-authored variant puzzle library.
// Each entry's `solution` is a valid completed grid consistent with its
// own constraints (classic rules + cages/kropki) — not necessarily the
// only such grid, since win-checking validates constraints directly
// rather than comparing against this answer key.
// ============================================================

(() => {
  const SOLUTION = [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9],
  ];

  const EMPTY_GRID = Array.from({ length: 9 }, () => Array(9).fill(0));

  // Killer sudoku: no givens at all — every digit is deduced from cage
  // sums plus ordinary row/column/box rules. Cages tile the whole board
  // (row-pair dominoes, with the last column split into column triples
  // so every cage's cells share a row or column and are automatically
  // digit-distinct).
  const killerCages = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 8; c += 2) {
      killerCages.push({
        cells: [[r, c], [r, c + 1]],
        sum: SOLUTION[r][c] + SOLUTION[r][c + 1],
      });
    }
  }
  for (const startRow of [0, 3, 6]) {
    const cells = [[startRow, 8], [startRow + 1, 8], [startRow + 2, 8]];
    killerCages.push({
      cells,
      sum: cells.reduce((sum, [r, c]) => sum + SOLUTION[r][c], 0),
    });
  }

  // Kropki sudoku: generous givens (checkerboard-ish holes) plus white
  // (consecutive) / black (2:1 ratio) dots wherever the true solution
  // happens to satisfy that relation between two adjacent holes.
  const kropkiHoles = [
    [0, 2], [0, 6], [1, 4], [1, 8], [2, 0], [2, 5],
    [3, 3], [3, 7], [4, 1], [4, 5],
    [5, 2], [5, 6], [6, 0], [6, 4], [6, 8],
    [7, 3], [7, 7], [8, 1], [8, 5], [8, 8],
  ];
  const kropkiGivens = SOLUTION.map(row => row.slice());
  for (const [r, c] of kropkiHoles) kropkiGivens[r][c] = 0;

  const kropkiDots = [
    { a: [0, 1], b: [0, 2], kind: "white" },
    { a: [0, 2], b: [1, 2], kind: "black" },
    { a: [0, 5], b: [0, 6], kind: "white" },
    { a: [1, 7], b: [1, 8], kind: "black" },
    { a: [1, 8], b: [2, 8], kind: "white" },
    { a: [2, 4], b: [2, 5], kind: "black" },
    { a: [2, 5], b: [3, 5], kind: "white" },
    { a: [3, 3], b: [3, 4], kind: "white" },
    { a: [3, 3], b: [4, 3], kind: "white" },
    { a: [3, 6], b: [3, 7], kind: "black" },
    { a: [3, 7], b: [3, 8], kind: "white" },
    { a: [4, 0], b: [4, 1], kind: "black" },
    { a: [4, 1], b: [5, 1], kind: "white" },
    { a: [4, 5], b: [5, 5], kind: "white" },
    { a: [4, 2], b: [5, 2], kind: "black" },
    { a: [5, 5], b: [5, 6], kind: "black" },
    { a: [4, 6], b: [5, 6], kind: "white" },
    { a: [5, 4], b: [6, 4], kind: "white" },
    { a: [6, 7], b: [6, 8], kind: "black" },
    { a: [6, 8], b: [7, 8], kind: "white" },
    { a: [6, 3], b: [7, 3], kind: "white" },
    { a: [7, 3], b: [8, 3], kind: "black" },
    { a: [7, 6], b: [7, 7], kind: "black" },
    { a: [8, 0], b: [8, 1], kind: "white" },
    { a: [8, 1], b: [8, 2], kind: "white" },
    { a: [7, 1], b: [8, 1], kind: "black" },
  ];

  // Lines & arrows sample: a thermometer (strictly increasing from the
  // bulb), a German whispers line (adjacent digits differ by >= 5), a
  // renban line (adjacent digits, any order, form a consecutive run),
  // and an arrow (sum of the line cells equals the circled digit) — all
  // verified against the true solution above. Holes sit on exactly the
  // cells each constraint touches; everything else is given.
  const linesHoles = [
    [2, 5], [2, 6], [2, 7], [2, 8],
    [0, 3], [1, 3], [1, 4],
    [3, 7], [3, 8], [4, 8],
    [8, 8], [7, 8], [6, 8],
  ];
  const linesGivens = SOLUTION.map(row => row.slice());
  for (const [r, c] of linesHoles) linesGivens[r][c] = 0;

  // Anti-knight sudoku needs its own solution grid — the shared SOLUTION
  // above happens to place the same digit a knight's-move apart in a few
  // spots (e.g. the two 9s at (0,6) and (1,4)), so it can't be reused
  // here. This grid is a cyclic band-shift (row r = shift the digits
  // 1-9 by 3*floor(r/3)+r), which is simultaneously a valid classic
  // sudoku solution and knight-move-safe everywhere on the board.
  const ANTIKNIGHT_SOLUTION = [];
  for (let r = 0; r < 9; r++) {
    const row = [];
    for (let c = 0; c < 9; c++) row.push(((r * 3 + Math.floor(r / 3) + c) % 9) + 1);
    ANTIKNIGHT_SOLUTION.push(row);
  }
  const antiKnightGivens = ANTIKNIGHT_SOLUTION.map((row, r) =>
    row.map((v, c) => ((r + c) % 2 === 0 ? v : 0))
  );

  // Sandwich sudoku: each clue is the sum of the digits strictly between
  // the 1 and the 9 in that row/column. Clue values below were computed
  // directly from the shared SOLUTION grid; only a subset of rows/cols
  // carry a clue (the rest are left ambiguous, same as a real puzzle
  // that doesn't clue every line).
  const sandwichHoles = [
    [0, 6], [0, 7], [3, 3], [3, 4], [5, 2], [6, 1], [8, 7],
    [2, 1], [5, 1], [1, 3], [5, 3], [8, 6], [3, 6], [6, 6], [4, 8], [6, 8],
  ];
  const sandwichGivens = SOLUTION.map(row => row.slice());
  for (const [r, c] of sandwichHoles) sandwichGivens[r][c] = 0;

  // XV sudoku: an "X" between two adjacent cells means they sum to 10, a
  // "V" means they sum to 5. Absence of a marker means no information
  // (same convention as kropki dots). Pairs verified against SOLUTION.
  const xvPairs = [
    { a: [0, 2], b: [0, 3], kind: "X" },
    { a: [0, 6], b: [0, 7], kind: "X" },
    { a: [1, 3], b: [1, 4], kind: "X" },
    { a: [3, 5], b: [3, 6], kind: "V" },
    { a: [3, 7], b: [3, 8], kind: "V" },
    { a: [4, 5], b: [4, 6], kind: "X" },
    { a: [4, 7], b: [4, 8], kind: "X" },
    { a: [6, 4], b: [6, 5], kind: "X" },
    { a: [6, 6], b: [6, 7], kind: "X" },
    { a: [7, 0], b: [7, 1], kind: "X" },
    { a: [7, 3], b: [7, 4], kind: "V" },
    { a: [7, 0], b: [8, 0], kind: "V" },
    { a: [2, 4], b: [3, 4], kind: "X" },
    { a: [5, 4], b: [6, 4], kind: "V" },
  ];
  const xvHoles = new Set();
  xvPairs.forEach(p => { xvHoles.add(p.a.join(",")); xvHoles.add(p.b.join(",")); });
  const xvGivens = SOLUTION.map((row, r) =>
    row.map((v, c) => (xvHoles.has(`${r},${c}`) ? 0 : v))
  );

  window.PuzzleLibrary = [
    {
      id: "killer-sample-1",
      title: "Killer Sample",
      variant: "killer",
      blurb: "No givens — deduce every digit from the cage sums and ordinary sudoku rules.",
      givens: EMPTY_GRID.map(row => row.slice()),
      solution: SOLUTION.map(row => row.slice()),
      cages: killerCages,
    },
    {
      id: "kropki-sample-1",
      title: "Kropki Sample",
      variant: "kropki",
      blurb: "White dots mark consecutive neighbors, black dots mark a 2:1 ratio.",
      givens: kropkiGivens,
      solution: SOLUTION.map(row => row.slice()),
      kropki: kropkiDots,
    },
    {
      id: "lines-sample-1",
      title: "Lines & Arrows Sample",
      variant: "lines",
      blurb: "Thermometer (low→high), whispers (green, differ by 5+), renban (purple, consecutive), and an arrow (sum into the circle).",
      givens: linesGivens,
      solution: SOLUTION.map(row => row.slice()),
      lines: [
        { kind: "thermo", cells: [[2, 5], [2, 6], [2, 7], [2, 8]] },
        { kind: "whispers", cells: [[0, 3], [1, 3], [1, 4]] },
        { kind: "renban", cells: [[3, 7], [3, 8], [4, 8]] },
      ],
      arrows: [
        { circle: [8, 8], cells: [[7, 8], [6, 8]] },
      ],
    },
    {
      id: "antiknight-sample-1",
      title: "Anti-Knight Sample",
      variant: "antiknight",
      blurb: "Ordinary sudoku rules, plus: no two cells a knight's-move apart may share a digit.",
      givens: antiKnightGivens,
      solution: ANTIKNIGHT_SOLUTION.map(row => row.slice()),
      antiKnight: true,
    },
    {
      id: "sandwich-sample-1",
      title: "Sandwich Sample",
      variant: "sandwich",
      blurb: "Clues outside the grid give the sum of the digits sandwiched between the 1 and the 9 in that row/column.",
      givens: sandwichGivens,
      solution: SOLUTION.map(row => row.slice()),
      sandwich: {
        rows: [0, null, null, 13, null, 3, 6, null, 7],
        cols: [null, 7, null, 18, null, null, 35, null, 15],
      },
    },
    {
      id: "xv-sample-1",
      title: "XV Sample",
      variant: "xv",
      blurb: "An X between two cells means they sum to 10, a V means they sum to 5. No marker means no information.",
      givens: xvGivens,
      solution: SOLUTION.map(row => row.slice()),
      xv: xvPairs,
    },

    // ---- Generated killer puzzles ----
    {
      id: "killer-gen-1",
      title: "Killer Variation 1",
      variant: "killer",
      blurb: "No givens — deduce every digit from the cage sums and ordinary sudoku rules.",
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
        [5, 4, 9, 6, 1, 8, 2, 3, 7],
        [6, 3, 8, 7, 2, 5, 4, 1, 9],
        [7, 1, 2, 4, 3, 9, 6, 5, 8],
        [9, 5, 7, 1, 4, 3, 8, 6, 2],
        [8, 6, 4, 2, 5, 7, 1, 9, 3],
        [3, 2, 1, 9, 8, 6, 7, 4, 5],
        [4, 8, 6, 3, 9, 2, 5, 7, 1],
        [1, 9, 5, 8, 7, 4, 3, 2, 6],
        [2, 7, 3, 5, 6, 1, 9, 8, 4]
      ],
      cages: [
        { cells: [[0, 0], [0, 1]], sum: 9 },
        { cells: [[0, 2], [0, 3]], sum: 15 },
        { cells: [[0, 4], [0, 5]], sum: 9 },
        { cells: [[0, 6], [0, 7]], sum: 5 },
        { cells: [[1, 0], [1, 1]], sum: 9 },
        { cells: [[1, 2], [1, 3]], sum: 15 },
        { cells: [[1, 4], [1, 5]], sum: 7 },
        { cells: [[1, 6], [1, 7]], sum: 5 },
        { cells: [[2, 0], [2, 1]], sum: 8 },
        { cells: [[2, 2], [2, 3]], sum: 6 },
        { cells: [[2, 4], [2, 5]], sum: 12 },
        { cells: [[2, 6], [2, 7]], sum: 11 },
        { cells: [[3, 0], [3, 1]], sum: 14 },
        { cells: [[3, 2], [3, 3]], sum: 8 },
        { cells: [[3, 4], [3, 5]], sum: 7 },
        { cells: [[3, 6], [3, 7]], sum: 14 },
        { cells: [[4, 0], [4, 1]], sum: 14 },
        { cells: [[4, 2], [4, 3]], sum: 6 },
        { cells: [[4, 4], [4, 5]], sum: 12 },
        { cells: [[4, 6], [4, 7]], sum: 10 },
        { cells: [[5, 0], [5, 1]], sum: 5 },
        { cells: [[5, 2], [5, 3]], sum: 10 },
        { cells: [[5, 4], [5, 5]], sum: 14 },
        { cells: [[5, 6], [5, 7]], sum: 11 },
        { cells: [[6, 0], [6, 1]], sum: 12 },
        { cells: [[6, 2], [6, 3]], sum: 9 },
        { cells: [[6, 4], [6, 5]], sum: 11 },
        { cells: [[6, 6], [6, 7]], sum: 12 },
        { cells: [[7, 0], [7, 1]], sum: 10 },
        { cells: [[7, 2], [7, 3]], sum: 13 },
        { cells: [[7, 4], [7, 5]], sum: 11 },
        { cells: [[7, 6], [7, 7]], sum: 5 },
        { cells: [[8, 0], [8, 1]], sum: 9 },
        { cells: [[8, 2], [8, 3]], sum: 8 },
        { cells: [[8, 4], [8, 5]], sum: 7 },
        { cells: [[8, 6], [8, 7]], sum: 17 },
        { cells: [[0, 8], [1, 8], [2, 8]], sum: 24 },
        { cells: [[3, 8], [4, 8], [5, 8]], sum: 10 },
        { cells: [[6, 8], [7, 8], [8, 8]], sum: 11 }
      ]
    },
    {
      id: "killer-gen-2",
      title: "Killer Variation 2",
      variant: "killer",
      blurb: "No givens — deduce every digit from the cage sums and ordinary sudoku rules.",
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
        [5, 4, 1, 2, 8, 7, 3, 9, 6],
        [3, 2, 7, 4, 9, 6, 1, 5, 8],
        [9, 6, 8, 3, 1, 5, 4, 2, 7],
        [1, 5, 6, 9, 7, 2, 8, 4, 3],
        [8, 3, 2, 5, 6, 4, 9, 7, 1],
        [4, 7, 9, 8, 3, 1, 5, 6, 2],
        [7, 1, 5, 6, 4, 8, 2, 3, 9],
        [6, 9, 4, 1, 2, 3, 7, 8, 5],
        [2, 8, 3, 7, 5, 9, 6, 1, 4]
      ],
      cages: [
        { cells: [[0, 0], [1, 0]], sum: 8 },
        { cells: [[2, 0], [3, 0]], sum: 10 },
        { cells: [[4, 0], [5, 0]], sum: 12 },
        { cells: [[6, 0], [7, 0]], sum: 13 },
        { cells: [[0, 1], [1, 1]], sum: 6 },
        { cells: [[2, 1], [3, 1]], sum: 11 },
        { cells: [[4, 1], [5, 1]], sum: 10 },
        { cells: [[6, 1], [7, 1]], sum: 10 },
        { cells: [[0, 2], [1, 2]], sum: 8 },
        { cells: [[2, 2], [3, 2]], sum: 14 },
        { cells: [[4, 2], [5, 2]], sum: 11 },
        { cells: [[6, 2], [7, 2]], sum: 9 },
        { cells: [[0, 3], [1, 3]], sum: 6 },
        { cells: [[2, 3], [3, 3]], sum: 12 },
        { cells: [[4, 3], [5, 3]], sum: 13 },
        { cells: [[6, 3], [7, 3]], sum: 7 },
        { cells: [[0, 4], [1, 4]], sum: 17 },
        { cells: [[2, 4], [3, 4]], sum: 8 },
        { cells: [[4, 4], [5, 4]], sum: 9 },
        { cells: [[6, 4], [7, 4]], sum: 6 },
        { cells: [[0, 5], [1, 5]], sum: 13 },
        { cells: [[2, 5], [3, 5]], sum: 7 },
        { cells: [[4, 5], [5, 5]], sum: 5 },
        { cells: [[6, 5], [7, 5]], sum: 11 },
        { cells: [[0, 6], [1, 6]], sum: 4 },
        { cells: [[2, 6], [3, 6]], sum: 12 },
        { cells: [[4, 6], [5, 6]], sum: 14 },
        { cells: [[6, 6], [7, 6]], sum: 9 },
        { cells: [[0, 7], [1, 7]], sum: 14 },
        { cells: [[2, 7], [3, 7]], sum: 6 },
        { cells: [[4, 7], [5, 7]], sum: 13 },
        { cells: [[6, 7], [7, 7]], sum: 11 },
        { cells: [[0, 8], [1, 8]], sum: 14 },
        { cells: [[2, 8], [3, 8]], sum: 10 },
        { cells: [[4, 8], [5, 8]], sum: 3 },
        { cells: [[6, 8], [7, 8]], sum: 14 },
        { cells: [[8, 0], [8, 1], [8, 2]], sum: 13 },
        { cells: [[8, 3], [8, 4], [8, 5]], sum: 21 },
        { cells: [[8, 6], [8, 7], [8, 8]], sum: 11 }
      ]
    },
    {
      id: "killer-gen-3",
      title: "Killer Variation 3",
      variant: "killer",
      blurb: "No givens — deduce every digit from the cage sums and ordinary sudoku rules.",
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
        [9, 5, 8, 2, 7, 3, 4, 6, 1],
        [7, 4, 3, 6, 8, 1, 9, 5, 2],
        [2, 1, 6, 9, 4, 5, 3, 7, 8],
        [3, 7, 4, 1, 5, 9, 8, 2, 6],
        [5, 6, 2, 4, 3, 8, 7, 1, 9],
        [8, 9, 1, 7, 2, 6, 5, 4, 3],
        [6, 3, 7, 8, 1, 4, 2, 9, 5],
        [1, 2, 5, 3, 9, 7, 6, 8, 4],
        [4, 8, 9, 5, 6, 2, 1, 3, 7]
      ],
      cages: [
        { cells: [[0, 0], [0, 1], [1, 0]], sum: 21 },
        { cells: [[0, 2], [1, 1], [1, 2]], sum: 15 },
        { cells: [[2, 0], [2, 1], [2, 2]], sum: 9 },
        { cells: [[0, 3], [0, 4], [1, 3]], sum: 15 },
        { cells: [[0, 5], [1, 4], [1, 5]], sum: 12 },
        { cells: [[2, 3], [2, 4], [2, 5]], sum: 18 },
        { cells: [[0, 6], [0, 7], [1, 6]], sum: 19 },
        { cells: [[0, 8], [1, 7], [1, 8]], sum: 8 },
        { cells: [[2, 6], [2, 7], [2, 8]], sum: 18 },
        { cells: [[3, 0], [3, 1], [4, 0]], sum: 15 },
        { cells: [[3, 2], [4, 1], [4, 2]], sum: 12 },
        { cells: [[5, 0], [5, 1], [5, 2]], sum: 18 },
        { cells: [[3, 3], [3, 4], [4, 3]], sum: 10 },
        { cells: [[3, 5], [4, 4], [4, 5]], sum: 20 },
        { cells: [[5, 3], [5, 4], [5, 5]], sum: 15 },
        { cells: [[3, 6], [3, 7], [4, 6]], sum: 17 },
        { cells: [[3, 8], [4, 7], [4, 8]], sum: 16 },
        { cells: [[5, 6], [5, 7], [5, 8]], sum: 12 },
        { cells: [[6, 0], [6, 1], [7, 0]], sum: 10 },
        { cells: [[6, 2], [7, 1], [7, 2]], sum: 14 },
        { cells: [[8, 0], [8, 1], [8, 2]], sum: 21 },
        { cells: [[6, 3], [6, 4], [7, 3]], sum: 12 },
        { cells: [[6, 5], [7, 4], [7, 5]], sum: 20 },
        { cells: [[8, 3], [8, 4], [8, 5]], sum: 13 },
        { cells: [[6, 6], [6, 7], [7, 6]], sum: 17 },
        { cells: [[6, 8], [7, 7], [7, 8]], sum: 17 },
        { cells: [[8, 6], [8, 7], [8, 8]], sum: 11 }
      ]
    },
    {
      id: "killer-gen-4",
      title: "Killer Variation 4",
      variant: "killer",
      blurb: "No givens — deduce every digit from the cage sums and ordinary sudoku rules.",
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
        [6, 9, 7, 5, 1, 4, 8, 3, 2],
        [8, 4, 1, 3, 6, 2, 5, 7, 9],
        [3, 5, 2, 8, 7, 9, 6, 1, 4],
        [2, 6, 9, 1, 3, 8, 7, 4, 5],
        [1, 7, 4, 9, 5, 6, 3, 2, 8],
        [5, 8, 3, 4, 2, 7, 9, 6, 1],
        [4, 1, 6, 7, 8, 5, 2, 9, 3],
        [7, 3, 5, 2, 9, 1, 4, 8, 6],
        [9, 2, 8, 6, 4, 3, 1, 5, 7]
      ],
      cages: [
        { cells: [[0, 0], [0, 1]], sum: 15 },
        { cells: [[0, 2], [0, 3]], sum: 12 },
        { cells: [[0, 4], [0, 5]], sum: 5 },
        { cells: [[0, 6], [0, 7]], sum: 11 },
        { cells: [[1, 0], [1, 1]], sum: 12 },
        { cells: [[1, 2], [1, 3]], sum: 4 },
        { cells: [[1, 4], [1, 5]], sum: 8 },
        { cells: [[1, 6], [1, 7]], sum: 12 },
        { cells: [[2, 0], [2, 1]], sum: 8 },
        { cells: [[2, 2], [2, 3]], sum: 10 },
        { cells: [[2, 4], [2, 5]], sum: 16 },
        { cells: [[2, 6], [2, 7]], sum: 7 },
        { cells: [[3, 0], [3, 1]], sum: 8 },
        { cells: [[3, 2], [3, 3]], sum: 10 },
        { cells: [[3, 4], [3, 5]], sum: 11 },
        { cells: [[3, 6], [3, 7]], sum: 11 },
        { cells: [[4, 0], [4, 1]], sum: 8 },
        { cells: [[4, 2], [4, 3]], sum: 13 },
        { cells: [[4, 4], [4, 5]], sum: 11 },
        { cells: [[4, 6], [4, 7]], sum: 5 },
        { cells: [[5, 0], [5, 1]], sum: 13 },
        { cells: [[5, 2], [5, 3]], sum: 7 },
        { cells: [[5, 4], [5, 5]], sum: 9 },
        { cells: [[5, 6], [5, 7]], sum: 15 },
        { cells: [[6, 0], [6, 1]], sum: 5 },
        { cells: [[6, 2], [6, 3]], sum: 13 },
        { cells: [[6, 4], [6, 5]], sum: 13 },
        { cells: [[6, 6], [6, 7]], sum: 11 },
        { cells: [[7, 0], [7, 1]], sum: 10 },
        { cells: [[7, 2], [7, 3]], sum: 7 },
        { cells: [[7, 4], [7, 5]], sum: 10 },
        { cells: [[7, 6], [7, 7]], sum: 12 },
        { cells: [[8, 0], [8, 1]], sum: 11 },
        { cells: [[8, 2], [8, 3]], sum: 14 },
        { cells: [[8, 4], [8, 5]], sum: 7 },
        { cells: [[8, 6], [8, 7]], sum: 6 },
        { cells: [[0, 8], [1, 8], [2, 8]], sum: 15 },
        { cells: [[3, 8], [4, 8], [5, 8]], sum: 14 },
        { cells: [[6, 8], [7, 8], [8, 8]], sum: 16 }
      ]
    },
    {
      id: "killer-gen-5",
      title: "Killer Variation 5",
      variant: "killer",
      blurb: "No givens — deduce every digit from the cage sums and ordinary sudoku rules.",
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
        [2, 9, 7, 6, 4, 8, 5, 1, 3],
        [4, 1, 5, 3, 2, 7, 9, 6, 8],
        [8, 6, 3, 5, 9, 1, 4, 2, 7],
        [1, 5, 8, 7, 6, 2, 3, 4, 9],
        [7, 4, 6, 9, 3, 5, 1, 8, 2],
        [9, 3, 2, 8, 1, 4, 6, 7, 5],
        [5, 7, 1, 4, 8, 3, 2, 9, 6],
        [3, 2, 9, 1, 7, 6, 8, 5, 4],
        [6, 8, 4, 2, 5, 9, 7, 3, 1]
      ],
      cages: [
        { cells: [[0, 0], [1, 0]], sum: 6 },
        { cells: [[2, 0], [3, 0]], sum: 9 },
        { cells: [[4, 0], [5, 0]], sum: 16 },
        { cells: [[6, 0], [7, 0]], sum: 8 },
        { cells: [[0, 1], [1, 1]], sum: 10 },
        { cells: [[2, 1], [3, 1]], sum: 11 },
        { cells: [[4, 1], [5, 1]], sum: 7 },
        { cells: [[6, 1], [7, 1]], sum: 9 },
        { cells: [[0, 2], [1, 2]], sum: 12 },
        { cells: [[2, 2], [3, 2]], sum: 11 },
        { cells: [[4, 2], [5, 2]], sum: 8 },
        { cells: [[6, 2], [7, 2]], sum: 10 },
        { cells: [[0, 3], [1, 3]], sum: 9 },
        { cells: [[2, 3], [3, 3]], sum: 12 },
        { cells: [[4, 3], [5, 3]], sum: 17 },
        { cells: [[6, 3], [7, 3]], sum: 5 },
        { cells: [[0, 4], [1, 4]], sum: 6 },
        { cells: [[2, 4], [3, 4]], sum: 15 },
        { cells: [[4, 4], [5, 4]], sum: 4 },
        { cells: [[6, 4], [7, 4]], sum: 15 },
        { cells: [[0, 5], [1, 5]], sum: 15 },
        { cells: [[2, 5], [3, 5]], sum: 3 },
        { cells: [[4, 5], [5, 5]], sum: 9 },
        { cells: [[6, 5], [7, 5]], sum: 9 },
        { cells: [[0, 6], [1, 6]], sum: 14 },
        { cells: [[2, 6], [3, 6]], sum: 7 },
        { cells: [[4, 6], [5, 6]], sum: 7 },
        { cells: [[6, 6], [7, 6]], sum: 10 },
        { cells: [[0, 7], [1, 7]], sum: 7 },
        { cells: [[2, 7], [3, 7]], sum: 6 },
        { cells: [[4, 7], [5, 7]], sum: 15 },
        { cells: [[6, 7], [7, 7]], sum: 14 },
        { cells: [[0, 8], [1, 8]], sum: 11 },
        { cells: [[2, 8], [3, 8]], sum: 16 },
        { cells: [[4, 8], [5, 8]], sum: 7 },
        { cells: [[6, 8], [7, 8]], sum: 10 },
        { cells: [[8, 0], [8, 1], [8, 2]], sum: 18 },
        { cells: [[8, 3], [8, 4], [8, 5]], sum: 16 },
        { cells: [[8, 6], [8, 7], [8, 8]], sum: 11 }
      ]
    },

    // ---- Generated kropki puzzles ----
    {
      id: "kropki-gen-1",
      title: "Kropki Variation 1",
      variant: "kropki",
      blurb: "White dots mark consecutive neighbors, black dots mark a 2:1 ratio.",
      givens: [
        [7, 9, 0, 8, 6, 2, 0, 3, 1],
        [4, 8, 6, 1, 0, 5, 7, 2, 0],
        [0, 1, 3, 9, 7, 0, 8, 6, 5],
        [1, 4, 8, 0, 9, 6, 3, 0, 7],
        [9, 0, 2, 7, 5, 0, 6, 8, 4],
        [6, 5, 0, 3, 4, 8, 0, 9, 2],
        [0, 6, 1, 5, 0, 7, 9, 4, 0],
        [5, 7, 9, 0, 8, 3, 2, 0, 6],
        [3, 0, 4, 6, 1, 0, 5, 7, 0]
      ],
      solution: [
        [7, 9, 5, 8, 6, 2, 4, 3, 1],
        [4, 8, 6, 1, 3, 5, 7, 2, 9],
        [2, 1, 3, 9, 7, 4, 8, 6, 5],
        [1, 4, 8, 2, 9, 6, 3, 5, 7],
        [9, 3, 2, 7, 5, 1, 6, 8, 4],
        [6, 5, 7, 3, 4, 8, 1, 9, 2],
        [8, 6, 1, 5, 2, 7, 9, 4, 3],
        [5, 7, 9, 4, 8, 3, 2, 1, 6],
        [3, 2, 4, 6, 1, 9, 5, 7, 8]
      ],
      kropki: [
        { a: [0, 2], b: [1, 2], kind: "white" },
        { a: [0, 4], b: [1, 4], kind: "black" },
        { a: [0, 5], b: [0, 6], kind: "black" },
        { a: [0, 6], b: [0, 7], kind: "white" },
        { a: [1, 0], b: [2, 0], kind: "black" },
        { a: [1, 5], b: [2, 5], kind: "white" },
        { a: [2, 0], b: [2, 1], kind: "white" },
        { a: [2, 0], b: [3, 0], kind: "white" },
        { a: [2, 5], b: [2, 6], kind: "black" },
        { a: [2, 7], b: [3, 7], kind: "white" },
        { a: [3, 1], b: [4, 1], kind: "white" },
        { a: [4, 1], b: [4, 2], kind: "white" },
        { a: [5, 4], b: [6, 4], kind: "black" },
        { a: [5, 8], b: [6, 8], kind: "white" },
        { a: [6, 3], b: [7, 3], kind: "white" },
        { a: [6, 7], b: [6, 8], kind: "white" },
        { a: [6, 8], b: [7, 8], kind: "black" },
        { a: [7, 3], b: [7, 4], kind: "black" },
        { a: [7, 6], b: [7, 7], kind: "white" },
        { a: [8, 0], b: [8, 1], kind: "white" },
        { a: [8, 1], b: [8, 2], kind: "black" },
        { a: [8, 7], b: [8, 8], kind: "white" }
      ]
    },
    {
      id: "kropki-gen-2",
      title: "Kropki Variation 2",
      variant: "kropki",
      blurb: "White dots mark consecutive neighbors, black dots mark a 2:1 ratio.",
      givens: [
        [9, 7, 0, 2, 3, 1, 0, 5, 4],
        [2, 5, 6, 9, 0, 7, 1, 3, 0],
        [0, 3, 1, 8, 5, 0, 7, 9, 2],
        [3, 8, 9, 0, 1, 5, 4, 0, 6],
        [1, 0, 7, 4, 6, 0, 3, 8, 5],
        [6, 4, 0, 3, 2, 8, 0, 1, 7],
        [0, 1, 4, 5, 0, 2, 8, 6, 0],
        [8, 9, 2, 0, 7, 3, 5, 0, 1],
        [5, 0, 3, 1, 8, 0, 2, 7, 0]
      ],
      solution: [
        [9, 7, 8, 2, 3, 1, 6, 5, 4],
        [2, 5, 6, 9, 4, 7, 1, 3, 8],
        [4, 3, 1, 8, 5, 6, 7, 9, 2],
        [3, 8, 9, 7, 1, 5, 4, 2, 6],
        [1, 2, 7, 4, 6, 9, 3, 8, 5],
        [6, 4, 5, 3, 2, 8, 9, 1, 7],
        [7, 1, 4, 5, 9, 2, 8, 6, 3],
        [8, 9, 2, 6, 7, 3, 5, 4, 1],
        [5, 6, 3, 1, 8, 4, 2, 7, 9]
      ],
      kropki: [
        { a: [0, 1], b: [0, 2], kind: "white" },
        { a: [0, 4], b: [1, 4], kind: "white" },
        { a: [0, 6], b: [0, 7], kind: "white" },
        { a: [0, 8], b: [1, 8], kind: "black" },
        { a: [1, 0], b: [2, 0], kind: "black" },
        { a: [1, 4], b: [2, 4], kind: "white" },
        { a: [1, 5], b: [2, 5], kind: "white" },
        { a: [2, 0], b: [2, 1], kind: "white" },
        { a: [2, 0], b: [3, 0], kind: "white" },
        { a: [2, 3], b: [3, 3], kind: "white" },
        { a: [2, 4], b: [2, 5], kind: "white" },
        { a: [2, 5], b: [2, 6], kind: "white" },
        { a: [2, 5], b: [3, 5], kind: "white" },
        { a: [3, 6], b: [3, 7], kind: "black" },
        { a: [4, 0], b: [4, 1], kind: "white" },
        { a: [4, 1], b: [5, 1], kind: "black" },
        { a: [4, 5], b: [5, 5], kind: "white" },
        { a: [5, 0], b: [6, 0], kind: "white" },
        { a: [5, 1], b: [5, 2], kind: "white" },
        { a: [5, 2], b: [6, 2], kind: "white" },
        { a: [5, 5], b: [5, 6], kind: "white" },
        { a: [5, 6], b: [6, 6], kind: "white" },
        { a: [6, 0], b: [7, 0], kind: "white" },
        { a: [6, 3], b: [7, 3], kind: "white" },
        { a: [6, 7], b: [6, 8], kind: "black" },
        { a: [7, 3], b: [7, 4], kind: "white" },
        { a: [7, 5], b: [8, 5], kind: "white" },
        { a: [7, 6], b: [7, 7], kind: "white" },
        { a: [8, 0], b: [8, 1], kind: "white" },
        { a: [8, 1], b: [8, 2], kind: "black" },
        { a: [8, 4], b: [8, 5], kind: "black" },
        { a: [8, 5], b: [8, 6], kind: "black" }
      ]
    },
    {
      id: "kropki-gen-3",
      title: "Kropki Variation 3",
      variant: "kropki",
      blurb: "White dots mark consecutive neighbors, black dots mark a 2:1 ratio.",
      givens: [
        [6, 8, 0, 9, 3, 2, 0, 7, 5],
        [5, 3, 2, 1, 0, 7, 9, 8, 0],
        [0, 7, 9, 8, 5, 0, 2, 6, 3],
        [7, 4, 3, 0, 9, 1, 8, 0, 2],
        [8, 0, 1, 4, 7, 0, 3, 9, 6],
        [9, 5, 0, 2, 8, 3, 0, 1, 7],
        [0, 1, 5, 7, 0, 8, 6, 3, 0],
        [3, 6, 8, 0, 4, 9, 7, 0, 1],
        [2, 0, 7, 3, 1, 0, 5, 4, 0]
      ],
      solution: [
        [6, 8, 4, 9, 3, 2, 1, 7, 5],
        [5, 3, 2, 1, 6, 7, 9, 8, 4],
        [1, 7, 9, 8, 5, 4, 2, 6, 3],
        [7, 4, 3, 6, 9, 1, 8, 5, 2],
        [8, 2, 1, 4, 7, 5, 3, 9, 6],
        [9, 5, 6, 2, 8, 3, 4, 1, 7],
        [4, 1, 5, 7, 2, 8, 6, 3, 9],
        [3, 6, 8, 5, 4, 9, 7, 2, 1],
        [2, 9, 7, 3, 1, 6, 5, 4, 8]
      ],
      kropki: [
        { a: [0, 1], b: [0, 2], kind: "black" },
        { a: [0, 2], b: [1, 2], kind: "black" },
        { a: [0, 4], b: [1, 4], kind: "black" },
        { a: [0, 5], b: [0, 6], kind: "white" },
        { a: [0, 8], b: [1, 8], kind: "white" },
        { a: [1, 4], b: [1, 5], kind: "white" },
        { a: [1, 4], b: [2, 4], kind: "white" },
        { a: [1, 7], b: [1, 8], kind: "black" },
        { a: [1, 8], b: [2, 8], kind: "white" },
        { a: [2, 4], b: [2, 5], kind: "white" },
        { a: [2, 5], b: [2, 6], kind: "black" },
        { a: [2, 7], b: [3, 7], kind: "white" },
        { a: [3, 1], b: [4, 1], kind: "black" },
        { a: [3, 2], b: [3, 3], kind: "black" },
        { a: [4, 1], b: [4, 2], kind: "white" },
        { a: [4, 6], b: [5, 6], kind: "white" },
        { a: [5, 1], b: [5, 2], kind: "white" },
        { a: [5, 2], b: [6, 2], kind: "white" },
        { a: [5, 5], b: [5, 6], kind: "white" },
        { a: [6, 0], b: [7, 0], kind: "white" },
        { a: [6, 4], b: [7, 4], kind: "black" },
        { a: [6, 7], b: [7, 7], kind: "white" },
        { a: [7, 3], b: [7, 4], kind: "white" },
        { a: [7, 7], b: [7, 8], kind: "white" },
        { a: [7, 7], b: [8, 7], kind: "black" },
        { a: [8, 5], b: [8, 6], kind: "white" },
        { a: [8, 7], b: [8, 8], kind: "black" }
      ]
    },
    {
      id: "kropki-gen-4",
      title: "Kropki Variation 4",
      variant: "kropki",
      blurb: "White dots mark consecutive neighbors, black dots mark a 2:1 ratio.",
      givens: [
        [9, 3, 0, 5, 2, 6, 0, 4, 1],
        [5, 4, 8, 7, 0, 1, 6, 3, 0],
        [0, 2, 1, 3, 8, 0, 7, 9, 5],
        [7, 5, 4, 0, 1, 8, 9, 0, 3],
        [1, 0, 2, 9, 3, 0, 4, 7, 8],
        [3, 8, 0, 4, 7, 2, 0, 1, 6],
        [0, 1, 5, 2, 0, 7, 3, 8, 0],
        [8, 7, 3, 0, 5, 9, 2, 0, 4],
        [2, 0, 6, 8, 4, 0, 1, 5, 0]
      ],
      solution: [
        [9, 3, 7, 5, 2, 6, 8, 4, 1],
        [5, 4, 8, 7, 9, 1, 6, 3, 2],
        [6, 2, 1, 3, 8, 4, 7, 9, 5],
        [7, 5, 4, 6, 1, 8, 9, 2, 3],
        [1, 6, 2, 9, 3, 5, 4, 7, 8],
        [3, 8, 9, 4, 7, 2, 5, 1, 6],
        [4, 1, 5, 2, 6, 7, 3, 8, 9],
        [8, 7, 3, 1, 5, 9, 2, 6, 4],
        [2, 9, 6, 8, 4, 3, 1, 5, 7]
      ],
      kropki: [
        { a: [0, 2], b: [1, 2], kind: "white" },
        { a: [0, 6], b: [0, 7], kind: "black" },
        { a: [0, 8], b: [1, 8], kind: "white" },
        { a: [1, 0], b: [2, 0], kind: "white" },
        { a: [1, 4], b: [2, 4], kind: "white" },
        { a: [1, 7], b: [1, 8], kind: "white" },
        { a: [2, 0], b: [3, 0], kind: "white" },
        { a: [2, 3], b: [3, 3], kind: "black" },
        { a: [2, 4], b: [2, 5], kind: "black" },
        { a: [2, 5], b: [3, 5], kind: "black" },
        { a: [3, 1], b: [4, 1], kind: "white" },
        { a: [3, 7], b: [3, 8], kind: "white" },
        { a: [4, 5], b: [4, 6], kind: "white" },
        { a: [4, 6], b: [5, 6], kind: "white" },
        { a: [5, 0], b: [6, 0], kind: "white" },
        { a: [5, 1], b: [5, 2], kind: "white" },
        { a: [5, 4], b: [6, 4], kind: "white" },
        { a: [6, 0], b: [7, 0], kind: "black" },
        { a: [6, 3], b: [7, 3], kind: "white" },
        { a: [6, 4], b: [6, 5], kind: "white" },
        { a: [6, 4], b: [7, 4], kind: "white" },
        { a: [6, 7], b: [6, 8], kind: "white" },
        { a: [7, 7], b: [8, 7], kind: "white" },
        { a: [8, 4], b: [8, 5], kind: "white" }
      ]
    },
    {
      id: "kropki-gen-5",
      title: "Kropki Variation 5",
      variant: "kropki",
      blurb: "White dots mark consecutive neighbors, black dots mark a 2:1 ratio.",
      givens: [
        [1, 8, 0, 3, 6, 5, 0, 7, 2],
        [7, 6, 4, 8, 0, 9, 5, 3, 0],
        [0, 2, 5, 7, 1, 0, 6, 9, 8],
        [2, 3, 6, 0, 9, 8, 7, 0, 4],
        [5, 0, 7, 2, 4, 0, 8, 6, 3],
        [4, 1, 0, 6, 7, 3, 0, 2, 5],
        [0, 4, 3, 1, 0, 7, 2, 8, 0],
        [6, 5, 1, 0, 8, 2, 3, 0, 7],
        [8, 0, 2, 4, 3, 0, 1, 5, 0]
      ],
      solution: [
        [1, 8, 9, 3, 6, 5, 4, 7, 2],
        [7, 6, 4, 8, 2, 9, 5, 3, 1],
        [3, 2, 5, 7, 1, 4, 6, 9, 8],
        [2, 3, 6, 5, 9, 8, 7, 1, 4],
        [5, 9, 7, 2, 4, 1, 8, 6, 3],
        [4, 1, 8, 6, 7, 3, 9, 2, 5],
        [9, 4, 3, 1, 5, 7, 2, 8, 6],
        [6, 5, 1, 9, 8, 2, 3, 4, 7],
        [8, 7, 2, 4, 3, 6, 1, 5, 9]
      ],
      kropki: [
        { a: [0, 1], b: [0, 2], kind: "white" },
        { a: [0, 5], b: [0, 6], kind: "white" },
        { a: [0, 6], b: [1, 6], kind: "white" },
        { a: [0, 8], b: [1, 8], kind: "white" },
        { a: [1, 4], b: [2, 4], kind: "white" },
        { a: [2, 0], b: [2, 1], kind: "white" },
        { a: [2, 0], b: [3, 0], kind: "white" },
        { a: [2, 5], b: [3, 5], kind: "black" },
        { a: [3, 2], b: [3, 3], kind: "white" },
        { a: [4, 2], b: [5, 2], kind: "white" },
        { a: [4, 6], b: [5, 6], kind: "white" },
        { a: [5, 8], b: [6, 8], kind: "white" },
        { a: [6, 7], b: [7, 7], kind: "black" },
        { a: [6, 8], b: [7, 8], kind: "white" },
        { a: [7, 3], b: [7, 4], kind: "white" },
        { a: [7, 6], b: [7, 7], kind: "white" },
        { a: [7, 7], b: [8, 7], kind: "white" },
        { a: [8, 0], b: [8, 1], kind: "white" },
        { a: [8, 4], b: [8, 5], kind: "black" }
      ]
    },

    // ---- Generated lines puzzles ----
    {
      id: "lines-gen-1",
      title: "Lines & Arrows Variation 1",
      variant: "lines",
      blurb: "Featuring: thermo, whispers, renban, arrow.",
      givens: [
        [8, 4, 5, 0, 0, 0, 1, 6, 3],
        [7, 0, 0, 0, 1, 6, 9, 8, 5],
        [1, 9, 6, 8, 3, 5, 7, 4, 2],
        [3, 5, 7, 2, 8, 9, 6, 1, 4],
        [2, 6, 4, 5, 7, 1, 8, 3, 9],
        [9, 8, 0, 6, 4, 3, 5, 2, 7],
        [5, 1, 0, 7, 6, 4, 3, 9, 8],
        [6, 7, 0, 3, 9, 2, 4, 5, 1],
        [4, 3, 0, 1, 5, 8, 2, 7, 6]
      ],
      solution: [
        [8, 4, 5, 9, 2, 7, 1, 6, 3],
        [7, 2, 3, 4, 1, 6, 9, 8, 5],
        [1, 9, 6, 8, 3, 5, 7, 4, 2],
        [3, 5, 7, 2, 8, 9, 6, 1, 4],
        [2, 6, 4, 5, 7, 1, 8, 3, 9],
        [9, 8, 1, 6, 4, 3, 5, 2, 7],
        [5, 1, 2, 7, 6, 4, 3, 9, 8],
        [6, 7, 8, 3, 9, 2, 4, 5, 1],
        [4, 3, 9, 1, 5, 8, 2, 7, 6]
      ],
      lines: [
        { kind: "thermo", cells: [[5, 2], [6, 2], [7, 2], [8, 2]] },
        { kind: "whispers", cells: [[0, 3], [0, 4], [0, 5]] },
        { kind: "renban", cells: [[1, 1], [1, 2], [1, 3]] }
      ],
      arrows: [
        { circle: [0, 3], cells: [[0, 4], [0, 5]] }
      ]
    },
    {
      id: "lines-gen-2",
      title: "Lines & Arrows Variation 2",
      variant: "lines",
      blurb: "Featuring: thermo, whispers, renban, arrow.",
      givens: [
        [3, 5, 9, 0, 0, 0, 8, 2, 4],
        [0, 0, 0, 0, 0, 0, 0, 7, 5],
        [1, 2, 7, 8, 5, 4, 3, 6, 9],
        [5, 1, 2, 3, 8, 7, 9, 4, 6],
        [6, 7, 4, 5, 9, 1, 2, 3, 8],
        [8, 9, 3, 4, 6, 2, 7, 5, 1],
        [2, 8, 1, 6, 3, 5, 4, 9, 7],
        [9, 4, 6, 2, 7, 8, 5, 1, 3],
        [7, 3, 5, 1, 4, 9, 6, 8, 2]
      ],
      solution: [
        [3, 5, 9, 7, 1, 6, 8, 2, 4],
        [4, 6, 8, 9, 2, 3, 1, 7, 5],
        [1, 2, 7, 8, 5, 4, 3, 6, 9],
        [5, 1, 2, 3, 8, 7, 9, 4, 6],
        [6, 7, 4, 5, 9, 1, 2, 3, 8],
        [8, 9, 3, 4, 6, 2, 7, 5, 1],
        [2, 8, 1, 6, 3, 5, 4, 9, 7],
        [9, 4, 6, 2, 7, 8, 5, 1, 3],
        [7, 3, 5, 1, 4, 9, 6, 8, 2]
      ],
      lines: [
        { kind: "thermo", cells: [[1, 0], [1, 1], [1, 2], [1, 3]] },
        { kind: "whispers", cells: [[0, 3], [0, 4], [0, 5]] },
        { kind: "renban", cells: [[1, 4], [1, 5], [1, 6]] }
      ],
      arrows: [
        { circle: [0, 3], cells: [[0, 4], [0, 5]] }
      ]
    },
    {
      id: "lines-gen-3",
      title: "Lines & Arrows Variation 3",
      variant: "lines",
      blurb: "Featuring: thermo, whispers, renban, arrow.",
      givens: [
        [5, 4, 9, 6, 8, 2, 3, 7, 1],
        [3, 6, 0, 0, 0, 7, 8, 4, 5],
        [0, 0, 0, 0, 0, 0, 9, 2, 6],
        [1, 3, 8, 7, 9, 4, 6, 5, 2],
        [9, 5, 4, 2, 6, 1, 7, 8, 3],
        [2, 7, 6, 8, 5, 3, 1, 9, 4],
        [4, 2, 0, 0, 0, 0, 5, 6, 8],
        [6, 9, 3, 5, 4, 8, 2, 1, 7],
        [7, 8, 5, 1, 2, 6, 4, 3, 9]
      ],
      solution: [
        [5, 4, 9, 6, 8, 2, 3, 7, 1],
        [3, 6, 2, 9, 1, 7, 8, 4, 5],
        [8, 1, 7, 4, 3, 5, 9, 2, 6],
        [1, 3, 8, 7, 9, 4, 6, 5, 2],
        [9, 5, 4, 2, 6, 1, 7, 8, 3],
        [2, 7, 6, 8, 5, 3, 1, 9, 4],
        [4, 2, 1, 3, 7, 9, 5, 6, 8],
        [6, 9, 3, 5, 4, 8, 2, 1, 7],
        [7, 8, 5, 1, 2, 6, 4, 3, 9]
      ],
      lines: [
        { kind: "thermo", cells: [[6, 2], [6, 3], [6, 4], [6, 5]] },
        { kind: "whispers", cells: [[1, 2], [1, 3], [1, 4]] },
        { kind: "renban", cells: [[2, 3], [2, 4], [2, 5]] }
      ],
      arrows: [
        { circle: [2, 0], cells: [[2, 1], [2, 2]] }
      ]
    },
    {
      id: "lines-gen-4",
      title: "Lines & Arrows Variation 4",
      variant: "lines",
      blurb: "Featuring: thermo, whispers, renban, arrow.",
      givens: [
        [0, 0, 0, 0, 3, 1, 6, 9, 2],
        [2, 0, 0, 0, 7, 0, 0, 0, 8],
        [9, 8, 3, 4, 2, 6, 7, 1, 5],
        [3, 0, 0, 0, 5, 8, 4, 6, 1],
        [5, 1, 4, 6, 9, 2, 8, 7, 3],
        [6, 7, 8, 3, 1, 4, 5, 2, 9],
        [8, 4, 9, 1, 6, 3, 2, 5, 7],
        [1, 2, 6, 5, 8, 7, 9, 3, 4],
        [7, 3, 5, 2, 4, 9, 1, 8, 6]
      ],
      solution: [
        [4, 5, 7, 8, 3, 1, 6, 9, 2],
        [2, 6, 1, 9, 7, 5, 3, 4, 8],
        [9, 8, 3, 4, 2, 6, 7, 1, 5],
        [3, 9, 2, 7, 5, 8, 4, 6, 1],
        [5, 1, 4, 6, 9, 2, 8, 7, 3],
        [6, 7, 8, 3, 1, 4, 5, 2, 9],
        [8, 4, 9, 1, 6, 3, 2, 5, 7],
        [1, 2, 6, 5, 8, 7, 9, 3, 4],
        [7, 3, 5, 2, 4, 9, 1, 8, 6]
      ],
      lines: [
        { kind: "thermo", cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
        { kind: "whispers", cells: [[1, 1], [1, 2], [1, 3]] },
        { kind: "renban", cells: [[1, 5], [1, 6], [1, 7]] }
      ],
      arrows: [
        { circle: [3, 1], cells: [[3, 2], [3, 3]] }
      ]
    },
    {
      id: "lines-gen-5",
      title: "Lines & Arrows Variation 5",
      variant: "lines",
      blurb: "Featuring: thermo, whispers, renban, arrow.",
      givens: [
        [4, 6, 9, 5, 0, 0, 0, 2, 3],
        [0, 0, 0, 9, 8, 4, 6, 7, 5],
        [7, 0, 0, 0, 2, 6, 4, 9, 1],
        [6, 5, 8, 7, 3, 9, 2, 1, 4],
        [3, 9, 4, 1, 6, 2, 5, 8, 7],
        [1, 7, 0, 0, 0, 0, 3, 6, 9],
        [8, 3, 7, 2, 9, 5, 1, 4, 6],
        [9, 4, 6, 8, 1, 3, 7, 5, 2],
        [5, 2, 1, 6, 4, 7, 9, 3, 8]
      ],
      solution: [
        [4, 6, 9, 5, 7, 1, 8, 2, 3],
        [2, 1, 3, 9, 8, 4, 6, 7, 5],
        [7, 8, 5, 3, 2, 6, 4, 9, 1],
        [6, 5, 8, 7, 3, 9, 2, 1, 4],
        [3, 9, 4, 1, 6, 2, 5, 8, 7],
        [1, 7, 2, 4, 5, 8, 3, 6, 9],
        [8, 3, 7, 2, 9, 5, 1, 4, 6],
        [9, 4, 6, 8, 1, 3, 7, 5, 2],
        [5, 2, 1, 6, 4, 7, 9, 3, 8]
      ],
      lines: [
        { kind: "thermo", cells: [[5, 2], [5, 3], [5, 4], [5, 5]] },
        { kind: "whispers", cells: [[0, 4], [0, 5], [0, 6]] },
        { kind: "renban", cells: [[1, 0], [1, 1], [1, 2]] }
      ],
      arrows: [
        { circle: [2, 1], cells: [[2, 2], [2, 3]] }
      ]
    },

    // ---- Generated antiknight puzzles ----
    {
      id: "antiknight-gen-1",
      title: "Anti-Knight Variation 1",
      variant: "antiknight",
      blurb: "Ordinary sudoku rules, plus: no two cells a knight's-move apart may share a digit.",
      givens: [
        [6, 0, 3, 0, 4, 0, 7, 0, 5],
        [0, 9, 0, 6, 0, 3, 0, 4, 0],
        [2, 0, 1, 0, 9, 0, 6, 0, 3],
        [0, 6, 0, 3, 0, 4, 0, 7, 0],
        [1, 0, 9, 0, 6, 0, 3, 0, 4],
        [0, 2, 0, 1, 0, 9, 0, 6, 0],
        [9, 0, 6, 0, 3, 0, 4, 0, 7],
        [0, 1, 0, 9, 0, 6, 0, 3, 0],
        [8, 0, 2, 0, 1, 0, 9, 0, 6]
      ],
      solution: [
        [6, 8, 3, 2, 4, 1, 7, 9, 5],
        [7, 9, 5, 6, 8, 3, 2, 4, 1],
        [2, 4, 1, 7, 9, 5, 6, 8, 3],
        [5, 6, 8, 3, 2, 4, 1, 7, 9],
        [1, 7, 9, 5, 6, 8, 3, 2, 4],
        [3, 2, 4, 1, 7, 9, 5, 6, 8],
        [9, 5, 6, 8, 3, 2, 4, 1, 7],
        [4, 1, 7, 9, 5, 6, 8, 3, 2],
        [8, 3, 2, 4, 1, 7, 9, 5, 6]
      ],
      antiKnight: true
    },
    {
      id: "antiknight-gen-2",
      title: "Anti-Knight Variation 2",
      variant: "antiknight",
      blurb: "Ordinary sudoku rules, plus: no two cells a knight's-move apart may share a digit.",
      givens: [
        [0, 5, 0, 9, 0, 1, 0, 7, 0],
        [9, 0, 1, 0, 7, 0, 6, 0, 8],
        [0, 7, 0, 6, 0, 8, 0, 2, 0],
        [5, 0, 9, 0, 1, 0, 7, 0, 6],
        [0, 1, 0, 7, 0, 6, 0, 8, 0],
        [7, 0, 6, 0, 8, 0, 2, 0, 3],
        [0, 9, 0, 1, 0, 7, 0, 6, 0],
        [1, 0, 7, 0, 6, 0, 8, 0, 2],
        [0, 6, 0, 8, 0, 2, 0, 3, 0]
      ],
      solution: [
        [6, 5, 8, 9, 2, 1, 3, 7, 4],
        [9, 2, 1, 3, 7, 4, 6, 5, 8],
        [3, 7, 4, 6, 5, 8, 9, 2, 1],
        [5, 8, 9, 2, 1, 3, 7, 4, 6],
        [2, 1, 3, 7, 4, 6, 5, 8, 9],
        [7, 4, 6, 5, 8, 9, 2, 1, 3],
        [8, 9, 2, 1, 3, 7, 4, 6, 5],
        [1, 3, 7, 4, 6, 5, 8, 9, 2],
        [4, 6, 5, 8, 9, 2, 1, 3, 7]
      ],
      antiKnight: true
    },
    {
      id: "antiknight-gen-3",
      title: "Anti-Knight Variation 3",
      variant: "antiknight",
      blurb: "Ordinary sudoku rules, plus: no two cells a knight's-move apart may share a digit.",
      givens: [
        [8, 0, 1, 0, 7, 0, 6, 0, 4],
        [0, 6, 0, 8, 0, 1, 0, 7, 0],
        [5, 0, 7, 0, 6, 0, 8, 0, 1],
        [0, 8, 0, 5, 0, 7, 0, 6, 0],
        [3, 0, 6, 0, 8, 0, 5, 0, 7],
        [0, 5, 0, 3, 0, 6, 0, 8, 0],
        [9, 0, 8, 0, 5, 0, 3, 0, 6],
        [0, 3, 0, 9, 0, 8, 0, 5, 0],
        [2, 0, 5, 0, 3, 0, 9, 0, 8]
      ],
      solution: [
        [8, 9, 1, 2, 7, 5, 6, 3, 4],
        [4, 6, 3, 8, 9, 1, 2, 7, 5],
        [5, 2, 7, 4, 6, 3, 8, 9, 1],
        [1, 8, 9, 5, 2, 7, 4, 6, 3],
        [3, 4, 6, 1, 8, 9, 5, 2, 7],
        [7, 5, 2, 3, 4, 6, 1, 8, 9],
        [9, 1, 8, 7, 5, 2, 3, 4, 6],
        [6, 3, 4, 9, 1, 8, 7, 5, 2],
        [2, 7, 5, 6, 3, 4, 9, 1, 8]
      ],
      antiKnight: true
    },
    {
      id: "antiknight-gen-4",
      title: "Anti-Knight Variation 4",
      variant: "antiknight",
      blurb: "Ordinary sudoku rules, plus: no two cells a knight's-move apart may share a digit.",
      givens: [
        [0, 8, 0, 4, 0, 2, 0, 7, 0],
        [6, 0, 7, 0, 8, 0, 4, 0, 2],
        [0, 4, 0, 6, 0, 7, 0, 8, 0],
        [5, 0, 8, 0, 4, 0, 6, 0, 7],
        [0, 6, 0, 5, 0, 8, 0, 4, 0],
        [3, 0, 4, 0, 6, 0, 5, 0, 8],
        [0, 5, 0, 3, 0, 4, 0, 6, 0],
        [9, 0, 6, 0, 5, 0, 3, 0, 4],
        [0, 3, 0, 9, 0, 6, 0, 5, 0]
      ],
      solution: [
        [1, 8, 5, 4, 3, 2, 9, 7, 6],
        [6, 9, 7, 1, 8, 5, 4, 3, 2],
        [2, 4, 3, 6, 9, 7, 1, 8, 5],
        [5, 1, 8, 2, 4, 3, 6, 9, 7],
        [7, 6, 9, 5, 1, 8, 2, 4, 3],
        [3, 2, 4, 7, 6, 9, 5, 1, 8],
        [8, 5, 1, 3, 2, 4, 7, 6, 9],
        [9, 7, 6, 8, 5, 1, 3, 2, 4],
        [4, 3, 2, 9, 7, 6, 8, 5, 1]
      ],
      antiKnight: true
    },
    {
      id: "antiknight-gen-5",
      title: "Anti-Knight Variation 5",
      variant: "antiknight",
      blurb: "Ordinary sudoku rules, plus: no two cells a knight's-move apart may share a digit.",
      givens: [
        [3, 0, 4, 0, 1, 0, 8, 0, 2],
        [0, 5, 0, 3, 0, 4, 0, 1, 0],
        [9, 0, 7, 0, 5, 0, 3, 0, 4],
        [0, 3, 0, 4, 0, 1, 0, 8, 0],
        [7, 0, 5, 0, 3, 0, 4, 0, 1],
        [0, 9, 0, 7, 0, 5, 0, 3, 0],
        [5, 0, 3, 0, 4, 0, 1, 0, 8],
        [0, 7, 0, 5, 0, 3, 0, 4, 0],
        [6, 0, 9, 0, 7, 0, 5, 0, 3]
      ],
      solution: [
        [3, 6, 4, 9, 1, 7, 8, 5, 2],
        [8, 5, 2, 3, 6, 4, 9, 1, 7],
        [9, 1, 7, 8, 5, 2, 3, 6, 4],
        [2, 3, 6, 4, 9, 1, 7, 8, 5],
        [7, 8, 5, 2, 3, 6, 4, 9, 1],
        [4, 9, 1, 7, 8, 5, 2, 3, 6],
        [5, 2, 3, 6, 4, 9, 1, 7, 8],
        [1, 7, 8, 5, 2, 3, 6, 4, 9],
        [6, 4, 9, 1, 7, 8, 5, 2, 3]
      ],
      antiKnight: true
    },

    // ---- Multi-variant puzzles (tagged into more than one folder) ----
    {
      id: "antiknight-kropki-1",
      title: "Antiknight Kropki (No Givens)",
      blurb: "Anti-knight + kropki dots, zero givens. Needs locked triples and careful peer elimination — pure deduction, no guessing.",
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
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
        [4, 5, 6, 7, 8, 9, 1, 2, 3],
        [7, 8, 9, 1, 2, 3, 4, 5, 6],
        [2, 3, 4, 5, 6, 7, 8, 9, 1],
        [5, 6, 7, 8, 9, 1, 2, 3, 4],
        [8, 9, 1, 2, 3, 4, 5, 6, 7],
        [3, 4, 5, 6, 7, 8, 9, 1, 2],
        [6, 7, 8, 9, 1, 2, 3, 4, 5],
        [9, 1, 2, 3, 4, 5, 6, 7, 8]
      ],
      antiKnight: true,
      kropki: [
        { a: [0, 2], b: [0, 3], kind: "white" },
        { a: [0, 2], b: [1, 2], kind: "black" },
        { a: [0, 3], b: [0, 4], kind: "white" },
        { a: [0, 6], b: [0, 7], kind: "white" },
        { a: [1, 2], b: [1, 3], kind: "white" },
        { a: [1, 3], b: [1, 4], kind: "white" },
        { a: [1, 6], b: [1, 7], kind: "white" },
        { a: [1, 7], b: [1, 8], kind: "white" },
        { a: [2, 1], b: [2, 2], kind: "white" },
        { a: [2, 4], b: [2, 5], kind: "white" },
        { a: [2, 5], b: [2, 6], kind: "white" },
        { a: [2, 6], b: [2, 7], kind: "white" },
        { a: [2, 7], b: [2, 8], kind: "white" },
        { a: [3, 0], b: [3, 1], kind: "white" },
        { a: [3, 1], b: [3, 2], kind: "white" },
        { a: [3, 2], b: [3, 3], kind: "white" },
        { a: [3, 3], b: [3, 4], kind: "white" },
        { a: [3, 4], b: [3, 5], kind: "white" },
        { a: [4, 1], b: [4, 2], kind: "white" },
        { a: [4, 3], b: [4, 4], kind: "white" },
        { a: [4, 7], b: [5, 7], kind: "black" },
        { a: [5, 3], b: [5, 4], kind: "white" },
        { a: [5, 4], b: [5, 5], kind: "white" },
        { a: [5, 5], b: [6, 5], kind: "black" },
        { a: [5, 6], b: [5, 7], kind: "white" },
        { a: [5, 7], b: [5, 8], kind: "white" },
        { a: [6, 1], b: [6, 2], kind: "white" },
        { a: [6, 5], b: [6, 6], kind: "white" },
        { a: [6, 7], b: [6, 8], kind: "white" },
        { a: [7, 0], b: [7, 1], kind: "white" },
        { a: [7, 2], b: [7, 3], kind: "white" },
        { a: [7, 4], b: [7, 5], kind: "white" },
        { a: [7, 5], b: [7, 6], kind: "white" },
        { a: [7, 6], b: [7, 7], kind: "white" },
        { a: [7, 6], b: [8, 6], kind: "black" },
        { a: [7, 7], b: [7, 8], kind: "white" },
        { a: [8, 4], b: [8, 5], kind: "white" },
        { a: [8, 5], b: [8, 6], kind: "white" },
        { a: [8, 7], b: [8, 8], kind: "white" }
      ],
      variants: ["antiknight", "kropki"]
    },
    {
      id: "kropki-renban-1",
      title: "Consecutive Chains",
      blurb: "No givens — 20 kropki dots and 9 renban lines are the only clues. Needs full kropki-chain deduction plus an XY-Wing to finish.",
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
      variants: ["kropki", "lines"]
    },
    {
      id: "kropki-thermo-1",
      title: "Dots and Bulbs",
      blurb: "No givens — 10 kropki dots and 23 thermometers do all the work. A steady chain of kropki and thermo deductions, no guessing.",
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
      variants: ["kropki", "lines"]
    },
    {
      id: "kropki-arrow-1",
      title: "Circles and Dots",
      blurb: "No givens — 16 kropki dots and 12 arrows. Locked candidates and naked pairs unravel it one region at a time.",
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
      variants: ["kropki", "lines"]
    },

    // ---- Generated sandwich puzzles ----
    {
      id: "sandwich-gen-1",
      title: "Sandwich Variation 1",
      variant: "sandwich",
      blurb: "Clues outside the grid give the sum of the digits sandwiched between the 1 and the 9 in that row/column.",
      givens: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [4, 5, 3, 9, 2, 1, 6, 8, 7],
        [6, 0, 8, 4, 3, 7, 5, 0, 2],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [7, 0, 5, 1, 0, 2, 8, 0, 3],
        [8, 0, 9, 3, 0, 6, 1, 0, 5],
        [5, 0, 0, 0, 0, 0, 3, 0, 4],
        [3, 0, 6, 7, 0, 4, 2, 0, 8],
        [2, 7, 4, 8, 5, 3, 9, 0, 6]
      ],
      solution: [
        [9, 2, 7, 6, 8, 5, 4, 3, 1],
        [4, 5, 3, 9, 2, 1, 6, 8, 7],
        [6, 1, 8, 4, 3, 7, 5, 9, 2],
        [1, 3, 2, 5, 4, 8, 7, 6, 9],
        [7, 6, 5, 1, 9, 2, 8, 4, 3],
        [8, 4, 9, 3, 7, 6, 1, 2, 5],
        [5, 8, 1, 2, 6, 9, 3, 7, 4],
        [3, 9, 6, 7, 1, 4, 2, 5, 8],
        [2, 7, 4, 8, 5, 3, 9, 1, 6]
      ],
      sandwich: {
        rows: [35, null, null, 35, null, null, 8, null, null],
        cols: [null, 21, null, null, 13, null, null, 24, null]
      }
    },
    {
      id: "sandwich-gen-2",
      title: "Sandwich Variation 2",
      variant: "sandwich",
      blurb: "Clues outside the grid give the sum of the digits sandwiched between the 1 and the 9 in that row/column.",
      givens: [
        [9, 6, 8, 2, 7, 4, 1, 5, 3],
        [3, 5, 2, 6, 8, 0, 0, 0, 7],
        [7, 4, 0, 5, 9, 0, 2, 8, 6],
        [1, 8, 0, 4, 2, 0, 7, 6, 5],
        [6, 0, 0, 0, 0, 5, 8, 4, 2],
        [5, 2, 0, 7, 6, 8, 3, 1, 0],
        [4, 3, 0, 1, 5, 7, 9, 2, 0],
        [8, 7, 0, 0, 0, 0, 0, 0, 0],
        [2, 1, 0, 8, 3, 6, 5, 7, 4]
      ],
      solution: [
        [9, 6, 8, 2, 7, 4, 1, 5, 3],
        [3, 5, 2, 6, 8, 1, 4, 9, 7],
        [7, 4, 1, 5, 9, 3, 2, 8, 6],
        [1, 8, 3, 4, 2, 9, 7, 6, 5],
        [6, 9, 7, 3, 1, 5, 8, 4, 2],
        [5, 2, 4, 7, 6, 8, 3, 1, 9],
        [4, 3, 6, 1, 5, 7, 9, 2, 8],
        [8, 7, 5, 9, 4, 2, 6, 3, 1],
        [2, 1, 9, 8, 3, 6, 5, 7, 4]
      ],
      sandwich: {
        rows: [null, 4, null, null, 10, null, null, 15, null],
        cols: [null, null, 25, null, null, 3, null, null, 8]
      }
    },
    {
      id: "sandwich-gen-3",
      title: "Sandwich Variation 3",
      variant: "sandwich",
      blurb: "Clues outside the grid give the sum of the digits sandwiched between the 1 and the 9 in that row/column.",
      givens: [
        [2, 3, 5, 0, 6, 8, 4, 7, 9],
        [4, 7, 1, 0, 9, 5, 6, 8, 2],
        [6, 8, 0, 0, 0, 0, 0, 0, 0],
        [0, 2, 4, 0, 3, 6, 0, 5, 8],
        [0, 5, 6, 0, 1, 2, 0, 9, 4],
        [0, 0, 0, 0, 0, 0, 0, 2, 6],
        [0, 4, 8, 0, 2, 7, 0, 1, 5],
        [0, 9, 7, 0, 8, 1, 2, 6, 3],
        [0, 0, 0, 0, 5, 3, 8, 4, 7]
      ],
      solution: [
        [2, 3, 5, 1, 6, 8, 4, 7, 9],
        [4, 7, 1, 3, 9, 5, 6, 8, 2],
        [6, 8, 9, 2, 7, 4, 5, 3, 1],
        [9, 2, 4, 7, 3, 6, 1, 5, 8],
        [7, 5, 6, 8, 1, 2, 3, 9, 4],
        [8, 1, 3, 5, 4, 9, 7, 2, 6],
        [3, 4, 8, 6, 2, 7, 9, 1, 5],
        [5, 9, 7, 4, 8, 1, 2, 6, 3],
        [1, 6, 2, 9, 5, 3, 8, 4, 7]
      ],
      sandwich: {
        rows: [null, null, 21, null, null, 12, null, null, 8],
        cols: [23, null, null, 35, null, null, 10, null, null]
      }
    },
    {
      id: "sandwich-gen-4",
      title: "Sandwich Variation 4",
      variant: "sandwich",
      blurb: "Clues outside the grid give the sum of the digits sandwiched between the 1 and the 9 in that row/column.",
      givens: [
        [7, 2, 3, 6, 0, 0, 4, 8, 5],
        [6, 5, 4, 8, 0, 2, 1, 3, 9],
        [1, 0, 8, 3, 0, 4, 7, 2, 6],
        [0, 0, 0, 5, 0, 3, 2, 6, 7],
        [8, 0, 2, 4, 0, 7, 5, 0, 1],
        [5, 0, 6, 1, 0, 9, 3, 0, 8],
        [3, 0, 5, 2, 0, 0, 0, 0, 4],
        [2, 0, 7, 9, 4, 5, 6, 0, 3],
        [4, 0, 9, 7, 3, 6, 8, 5, 2]
      ],
      solution: [
        [7, 2, 3, 6, 9, 1, 4, 8, 5],
        [6, 5, 4, 8, 7, 2, 1, 3, 9],
        [1, 9, 8, 3, 5, 4, 7, 2, 6],
        [9, 4, 1, 5, 8, 3, 2, 6, 7],
        [8, 3, 2, 4, 6, 7, 5, 9, 1],
        [5, 7, 6, 1, 2, 9, 3, 4, 8],
        [3, 6, 5, 2, 1, 8, 9, 7, 4],
        [2, 8, 7, 9, 4, 5, 6, 1, 3],
        [4, 1, 9, 7, 3, 6, 8, 5, 2]
      ],
      sandwich: {
        rows: [0, null, null, 4, null, null, 8, null, null],
        cols: [null, 28, null, null, 28, null, null, 11, null]
      }
    },
    {
      id: "sandwich-gen-5",
      title: "Sandwich Variation 5",
      variant: "sandwich",
      blurb: "Clues outside the grid give the sum of the digits sandwiched between the 1 and the 9 in that row/column.",
      givens: [
        [7, 3, 8, 5, 6, 2, 9, 4, 0],
        [0, 0, 0, 7, 4, 8, 3, 5, 0],
        [5, 4, 0, 9, 1, 3, 7, 6, 0],
        [4, 2, 0, 1, 3, 0, 8, 7, 0],
        [8, 7, 0, 0, 0, 0, 0, 0, 0],
        [9, 5, 3, 2, 8, 0, 6, 1, 4],
        [3, 9, 4, 6, 2, 0, 5, 8, 7],
        [6, 0, 0, 0, 0, 5, 4, 2, 3],
        [2, 8, 5, 3, 7, 4, 1, 9, 6]
      ],
      solution: [
        [7, 3, 8, 5, 6, 2, 9, 4, 1],
        [1, 6, 9, 7, 4, 8, 3, 5, 2],
        [5, 4, 2, 9, 1, 3, 7, 6, 8],
        [4, 2, 6, 1, 3, 9, 8, 7, 5],
        [8, 7, 1, 4, 5, 6, 2, 3, 9],
        [9, 5, 3, 2, 8, 7, 6, 1, 4],
        [3, 9, 4, 6, 2, 1, 5, 8, 7],
        [6, 1, 7, 8, 9, 5, 4, 2, 3],
        [2, 8, 5, 3, 7, 4, 1, 9, 6]
      ],
      sandwich: {
        rows: [null, 6, null, null, 20, null, null, 15, null],
        cols: [null, null, 8, null, null, 13, null, null, 15]
      }
    },

    // ---- Generated xv puzzles ----
    {
      id: "xv-gen-1",
      title: "XV Variation 1",
      variant: "xv",
      blurb: "An X between two cells means they sum to 10, a V means they sum to 5. No marker means no information.",
      givens: [
        [8, 0, 0, 2, 0, 5, 0, 0, 1],
        [5, 0, 0, 7, 0, 3, 9, 0, 0],
        [9, 2, 0, 0, 8, 0, 0, 0, 5],
        [6, 0, 0, 0, 0, 0, 8, 5, 7],
        [7, 5, 3, 0, 6, 8, 4, 9, 2],
        [4, 0, 0, 0, 5, 7, 1, 6, 3],
        [0, 0, 8, 6, 7, 2, 5, 3, 4],
        [0, 7, 6, 5, 4, 1, 2, 8, 9],
        [0, 4, 5, 8, 3, 9, 7, 1, 6]
      ],
      solution: [
        [8, 3, 7, 2, 9, 5, 6, 4, 1],
        [5, 6, 4, 7, 1, 3, 9, 2, 8],
        [9, 2, 1, 4, 8, 6, 3, 7, 5],
        [6, 1, 9, 3, 2, 4, 8, 5, 7],
        [7, 5, 3, 1, 6, 8, 4, 9, 2],
        [4, 8, 2, 9, 5, 7, 1, 6, 3],
        [1, 9, 8, 6, 7, 2, 5, 3, 4],
        [3, 7, 6, 5, 4, 1, 2, 8, 9],
        [2, 4, 5, 8, 3, 9, 7, 1, 6]
      ],
      xv: [
        { a: [0, 1], b: [0, 2], kind: "X" },
        { a: [0, 6], b: [0, 7], kind: "X" },
        { a: [1, 1], b: [1, 2], kind: "X" },
        { a: [1, 7], b: [1, 8], kind: "X" },
        { a: [2, 2], b: [2, 3], kind: "V" },
        { a: [2, 6], b: [2, 7], kind: "X" },
        { a: [3, 1], b: [3, 2], kind: "X" },
        { a: [3, 3], b: [3, 4], kind: "V" },
        { a: [5, 1], b: [5, 2], kind: "X" },
        { a: [6, 0], b: [6, 1], kind: "X" },
        { a: [7, 0], b: [8, 0], kind: "V" },
        { a: [4, 3], b: [5, 3], kind: "X" },
        { a: [0, 4], b: [1, 4], kind: "X" },
        { a: [2, 5], b: [3, 5], kind: "X" }
      ]
    },
    {
      id: "xv-gen-2",
      title: "XV Variation 2",
      variant: "xv",
      blurb: "An X between two cells means they sum to 10, a V means they sum to 5. No marker means no information.",
      givens: [
        [0, 0, 4, 5, 9, 6, 1, 0, 0],
        [6, 9, 3, 4, 7, 1, 8, 5, 2],
        [0, 7, 5, 0, 0, 3, 6, 0, 4],
        [0, 0, 0, 0, 0, 0, 0, 0, 5],
        [2, 6, 8, 0, 5, 0, 0, 0, 9],
        [5, 0, 0, 0, 0, 0, 7, 0, 8],
        [7, 5, 6, 0, 0, 4, 9, 8, 1],
        [4, 8, 2, 7, 1, 9, 5, 3, 6],
        [3, 1, 9, 8, 6, 5, 4, 2, 7]
      ],
      solution: [
        [8, 2, 4, 5, 9, 6, 1, 7, 3],
        [6, 9, 3, 4, 7, 1, 8, 5, 2],
        [1, 7, 5, 2, 8, 3, 6, 9, 4],
        [9, 3, 7, 6, 4, 8, 2, 1, 5],
        [2, 6, 8, 1, 5, 7, 3, 4, 9],
        [5, 4, 1, 9, 3, 2, 7, 6, 8],
        [7, 5, 6, 3, 2, 4, 9, 8, 1],
        [4, 8, 2, 7, 1, 9, 5, 3, 6],
        [3, 1, 9, 8, 6, 5, 4, 2, 7]
      ],
      xv: [
        { a: [0, 0], b: [0, 1], kind: "X" },
        { a: [0, 7], b: [0, 8], kind: "X" },
        { a: [2, 3], b: [2, 4], kind: "X" },
        { a: [3, 1], b: [3, 2], kind: "X" },
        { a: [3, 3], b: [3, 4], kind: "X" },
        { a: [3, 5], b: [3, 6], kind: "X" },
        { a: [4, 5], b: [4, 6], kind: "X" },
        { a: [5, 1], b: [5, 2], kind: "V" },
        { a: [5, 4], b: [5, 5], kind: "V" },
        { a: [6, 3], b: [6, 4], kind: "V" },
        { a: [2, 0], b: [3, 0], kind: "X" },
        { a: [4, 3], b: [5, 3], kind: "X" },
        { a: [2, 7], b: [3, 7], kind: "X" },
        { a: [4, 7], b: [5, 7], kind: "X" }
      ]
    },
    {
      id: "xv-gen-3",
      title: "XV Variation 3",
      variant: "xv",
      blurb: "An X between two cells means they sum to 10, a V means they sum to 5. No marker means no information.",
      givens: [
        [9, 5, 1, 0, 0, 0, 0, 6, 3],
        [7, 4, 8, 0, 0, 0, 0, 5, 2],
        [6, 0, 0, 8, 1, 5, 4, 7, 9],
        [3, 0, 0, 0, 5, 7, 9, 0, 0],
        [0, 0, 5, 0, 0, 6, 3, 1, 7],
        [0, 0, 7, 9, 0, 8, 5, 0, 0],
        [1, 3, 6, 0, 0, 4, 7, 9, 5],
        [5, 8, 9, 6, 7, 1, 0, 0, 4],
        [4, 7, 2, 5, 9, 3, 6, 8, 1]
      ],
      solution: [
        [9, 5, 1, 7, 4, 2, 8, 6, 3],
        [7, 4, 8, 3, 6, 9, 1, 5, 2],
        [6, 2, 3, 8, 1, 5, 4, 7, 9],
        [3, 6, 4, 1, 5, 7, 9, 2, 8],
        [8, 9, 5, 4, 2, 6, 3, 1, 7],
        [2, 1, 7, 9, 3, 8, 5, 4, 6],
        [1, 3, 6, 2, 8, 4, 7, 9, 5],
        [5, 8, 9, 6, 7, 1, 2, 3, 4],
        [4, 7, 2, 5, 9, 3, 6, 8, 1]
      ],
      xv: [
        { a: [0, 5], b: [0, 6], kind: "X" },
        { a: [1, 5], b: [1, 6], kind: "X" },
        { a: [2, 1], b: [2, 2], kind: "V" },
        { a: [3, 1], b: [3, 2], kind: "X" },
        { a: [3, 7], b: [3, 8], kind: "X" },
        { a: [5, 7], b: [5, 8], kind: "X" },
        { a: [6, 3], b: [6, 4], kind: "X" },
        { a: [7, 6], b: [7, 7], kind: "V" },
        { a: [4, 0], b: [5, 0], kind: "X" },
        { a: [4, 1], b: [5, 1], kind: "X" },
        { a: [0, 3], b: [1, 3], kind: "X" },
        { a: [3, 3], b: [4, 3], kind: "V" },
        { a: [0, 4], b: [1, 4], kind: "X" },
        { a: [4, 4], b: [5, 4], kind: "V" }
      ]
    },
    {
      id: "xv-gen-4",
      title: "XV Variation 4",
      variant: "xv",
      blurb: "An X between two cells means they sum to 10, a V means they sum to 5. No marker means no information.",
      givens: [
        [0, 0, 3, 0, 0, 5, 7, 0, 0],
        [6, 7, 4, 0, 0, 8, 0, 0, 5],
        [5, 0, 0, 0, 0, 7, 0, 0, 8],
        [0, 6, 5, 7, 8, 0, 9, 0, 0],
        [0, 9, 2, 5, 3, 0, 8, 7, 1],
        [3, 8, 7, 0, 0, 0, 6, 5, 4],
        [9, 5, 8, 2, 6, 0, 1, 4, 7],
        [2, 3, 1, 4, 7, 0, 5, 8, 6],
        [7, 4, 6, 8, 5, 0, 2, 9, 3]
      ],
      solution: [
        [8, 2, 3, 6, 4, 5, 7, 1, 9],
        [6, 7, 4, 9, 1, 8, 3, 2, 5],
        [5, 1, 9, 3, 2, 7, 4, 6, 8],
        [1, 6, 5, 7, 8, 4, 9, 3, 2],
        [4, 9, 2, 5, 3, 6, 8, 7, 1],
        [3, 8, 7, 1, 9, 2, 6, 5, 4],
        [9, 5, 8, 2, 6, 3, 1, 4, 7],
        [2, 3, 1, 4, 7, 9, 5, 8, 6],
        [7, 4, 6, 8, 5, 1, 2, 9, 3]
      ],
      xv: [
        { a: [0, 0], b: [0, 1], kind: "X" },
        { a: [0, 3], b: [0, 4], kind: "X" },
        { a: [0, 7], b: [0, 8], kind: "X" },
        { a: [1, 3], b: [1, 4], kind: "X" },
        { a: [1, 6], b: [1, 7], kind: "V" },
        { a: [2, 1], b: [2, 2], kind: "X" },
        { a: [2, 3], b: [2, 4], kind: "V" },
        { a: [2, 6], b: [2, 7], kind: "X" },
        { a: [3, 7], b: [3, 8], kind: "V" },
        { a: [5, 3], b: [5, 4], kind: "X" },
        { a: [3, 0], b: [4, 0], kind: "V" },
        { a: [3, 5], b: [4, 5], kind: "X" },
        { a: [5, 5], b: [6, 5], kind: "V" },
        { a: [7, 5], b: [8, 5], kind: "X" }
      ]
    },
    {
      id: "xv-gen-5",
      title: "XV Variation 5",
      variant: "xv",
      blurb: "An X between two cells means they sum to 10, a V means they sum to 5. No marker means no information.",
      givens: [
        [0, 0, 2, 9, 8, 0, 0, 5, 6],
        [6, 8, 5, 4, 7, 2, 9, 3, 1],
        [0, 0, 0, 0, 5, 6, 0, 0, 4],
        [8, 3, 4, 0, 6, 0, 5, 1, 7],
        [9, 5, 7, 0, 3, 0, 0, 0, 2],
        [2, 6, 1, 5, 4, 0, 0, 9, 8],
        [4, 0, 6, 0, 0, 8, 1, 7, 5],
        [7, 0, 8, 6, 0, 5, 4, 0, 0],
        [5, 0, 0, 7, 0, 4, 8, 6, 9]
      ],
      solution: [
        [1, 4, 2, 9, 8, 3, 7, 5, 6],
        [6, 8, 5, 4, 7, 2, 9, 3, 1],
        [3, 7, 9, 1, 5, 6, 2, 8, 4],
        [8, 3, 4, 2, 6, 9, 5, 1, 7],
        [9, 5, 7, 8, 3, 1, 6, 4, 2],
        [2, 6, 1, 5, 4, 7, 3, 9, 8],
        [4, 9, 6, 3, 2, 8, 1, 7, 5],
        [7, 1, 8, 6, 9, 5, 4, 2, 3],
        [5, 2, 3, 7, 1, 4, 8, 6, 9]
      ],
      xv: [
        { a: [0, 0], b: [0, 1], kind: "V" },
        { a: [0, 5], b: [0, 6], kind: "X" },
        { a: [2, 0], b: [2, 1], kind: "X" },
        { a: [2, 2], b: [2, 3], kind: "X" },
        { a: [2, 6], b: [2, 7], kind: "X" },
        { a: [4, 6], b: [4, 7], kind: "X" },
        { a: [5, 5], b: [5, 6], kind: "X" },
        { a: [6, 3], b: [6, 4], kind: "V" },
        { a: [7, 7], b: [7, 8], kind: "V" },
        { a: [8, 1], b: [8, 2], kind: "V" },
        { a: [6, 1], b: [7, 1], kind: "X" },
        { a: [3, 3], b: [4, 3], kind: "X" },
        { a: [7, 4], b: [8, 4], kind: "X" },
        { a: [3, 5], b: [4, 5], kind: "X" }
      ]
    },
  ];
})();
