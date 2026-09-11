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
  ];
})();
