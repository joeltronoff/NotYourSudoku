// Converts an f-puzzles / SudokuPad self-contained puzzle link into a
// puzzles.js-compatible entry for Solver's Notebook.
//
// Usage: node convert.js "<url-or-raw-data-string>" [variant-override]
//
// Supports:
//   https://f-puzzles.com/?load=<data>
//   https://sudokupad.app/<anything>fpuzzles<data>   (long self-contained form)
//   a raw lz-string data blob
//
// Requires the puzzle to include a `solution` field (most setter-verified
// exports do) — Solver's Notebook uses the true solution for mistake
// tracking, not just for constraint validation, so we refuse to guess one.

const LZString = require('lz-string');

const UNSUPPORTED_FIELDS = [
  'extraregion', 'clone', 'quadruple', 'betweenline', 'minimum', 'maximum',
  'rowindexer', 'columnindexer', 'boxindexer', 'xsum', 'skyscraper',
  'entropicline', 'modularline', 'zipperline', 'nabner', 'doublearrow',
  'lockout', 'disjointgroups', 'fogofwar', 'foglight', 'cage',
  'diagonal+', 'diagonal-', 'antiking', 'regionsumline',
];

function extractDataString(input) {
  input = input.trim();
  let m = input.match(/f-puzzles\.com\/\?load=(.+)$/);
  if (m) return decodeURIComponent(m[1]);
  m = input.match(/sudokupad\.app\/(?:[^/]*?)fpuzzles(.+)$/i);
  if (m) return decodeURIComponent(m[1]);
  return input; // assume raw data string
}

function parseCell(cellStr) {
  const m = cellStr.match(/^R(\d+)C(\d+)$/);
  if (!m) throw new Error(`Bad cell string: ${cellStr}`);
  return [parseInt(m[1], 10) - 1, parseInt(m[2], 10) - 1];
}

function decode(input) {
  const dataString = extractDataString(input);
  const json = LZString.decompressFromBase64(dataString);
  if (!json) throw new Error('lz-string decompression failed — not a valid self-contained link/data string.');
  return JSON.parse(json);
}

function convert(puzzle, idOverride) {
  const warnings = [];
  const errors = [];

  if (puzzle.size !== 9) {
    errors.push(`Unsupported grid size ${puzzle.size} (only 9x9 supported).`);
  }

  const presentUnsupported = UNSUPPORTED_FIELDS.filter(f => {
    const v = puzzle[f];
    return v !== undefined && v !== false && !(Array.isArray(v) && v.length === 0);
  });
  if (presentUnsupported.length > 0) {
    errors.push(`Uses unsupported constraint(s): ${presentUnsupported.join(', ')}`);
  }

  if (!puzzle.solution || !Array.isArray(puzzle.solution) || puzzle.solution.length !== 81) {
    errors.push('No verified `solution` field in the export — Solver\'s Notebook needs a true solution for mistake tracking, not just a constraint-valid guess.');
  }

  if (errors.length > 0) {
    return { errors, warnings };
  }

  const solution = [];
  for (let r = 0; r < 9; r++) solution.push(puzzle.solution.slice(r * 9, r * 9 + 9));

  const givens = puzzle.grid.map(row => row.map(cell => (cell.given ? cell.value : 0)));

  const cages = (puzzle.killercage || []).map(cage => ({
    cells: cage.cells.map(parseCell),
    sum: parseInt(cage.value, 10),
  }));
  if ((puzzle.killercage || []).some(c => c.value === undefined)) {
    warnings.push('One or more killer cages had no sum — omitted sum will break validation, check manually.');
  }

  const kropki = [];
  for (const dot of puzzle.difference || []) {
    if (dot.value !== undefined && parseFloat(dot.value) !== 1) {
      warnings.push(`Non-default difference dot value (${dot.value}) — engine assumes 1, verify manually.`);
    }
    const [a, b] = dot.cells.map(parseCell);
    kropki.push({ a, b, kind: 'white' });
  }
  for (const dot of puzzle.ratio || []) {
    if (dot.value !== undefined && parseFloat(dot.value) !== 2) {
      warnings.push(`Non-default ratio dot value (${dot.value}) — engine assumes 2, verify manually.`);
    }
    const [a, b] = dot.cells.map(parseCell);
    kropki.push({ a, b, kind: 'black' });
  }

  const lines = [];
  for (const t of puzzle.thermometer || []) {
    for (const line of t.lines) lines.push({ kind: 'thermo', cells: line.map(parseCell) });
  }
  for (const t of puzzle.renban || []) {
    for (const line of t.lines) lines.push({ kind: 'renban', cells: line.map(parseCell) });
  }
  for (const t of puzzle.palindrome || []) {
    for (const line of t.lines) lines.push({ kind: 'palindrome', cells: line.map(parseCell) });
  }
  for (const t of puzzle.whispers || []) {
    if (t.value !== undefined && parseFloat(t.value) !== 5) {
      warnings.push(`Whispers line has non-standard difference (${t.value}), engine assumes >=5 (German whispers) — verify manually.`);
    }
    for (const line of t.lines) lines.push({ kind: 'whispers', cells: line.map(parseCell) });
  }

  const arrows = [];
  for (const a of puzzle.arrow || []) {
    if (a.cells.length !== 1) {
      warnings.push('Arrow with a multi-cell bulb — only single-cell circles supported, verify manually.');
    }
    const circle = parseCell(a.cells[0]);
    const bulbSet = new Set(a.cells);
    const pathCells = (a.lines[0] || []).filter(c => !bulbSet.has(c)).map(parseCell);
    arrows.push({ circle, cells: pathCells });
  }

  const antiKnight = !!puzzle.antiknight;

  let sandwich = null;
  if (puzzle.sandwichsum && puzzle.sandwichsum.length > 0) {
    const rows = Array(9).fill(null);
    const cols = Array(9).fill(null);
    for (const clue of puzzle.sandwichsum) {
      const m = clue.cell.match(/^R(\d+)C(\d+)$/);
      const r = parseInt(m[1], 10), c = parseInt(m[2], 10);
      const value = clue.value === undefined ? null : parseInt(clue.value, 10);
      if (r === 0 || r === 10) cols[c - 1] = value;
      else if (c === 0 || c === 10) rows[r - 1] = value;
      else warnings.push(`Sandwich clue with unexpected cell ${clue.cell}`);
    }
    sandwich = { rows, cols };
  }

  const xv = (puzzle.xv || []).map(pair => {
    if (!pair.value) warnings.push('XV pair with no X/V marker — skipping ambiguous pair.');
    const [a, b] = pair.cells.map(parseCell);
    return { a, b, kind: pair.value || 'X' };
  }).filter(p => p.kind === 'X' || p.kind === 'V');

  let variant = 'lines';
  if (cages.length > 0) variant = 'killer';
  else if (kropki.length > 0 && lines.length === 0 && arrows.length === 0) variant = 'kropki';
  else if (antiKnight) variant = 'antiknight';
  else if (sandwich) variant = 'sandwich';
  else if (xv.length > 0) variant = 'xv';

  const entry = {
    id: idOverride || `imported-${Date.now()}`,
    title: puzzle.title || 'Imported puzzle',
    variant,
    blurb: puzzle.ruleset ? puzzle.ruleset.slice(0, 140) : (puzzle.author ? `By ${puzzle.author}` : ''),
    givens,
    solution,
  };
  if (cages.length > 0) entry.cages = cages;
  if (kropki.length > 0) entry.kropki = kropki;
  if (lines.length > 0) entry.lines = lines;
  if (arrows.length > 0) entry.arrows = arrows;
  if (antiKnight) entry.antiKnight = true;
  if (sandwich) entry.sandwich = sandwich;
  if (xv.length > 0) entry.xv = xv;

  return { entry, warnings, errors: [] };
}

if (require.main === module) {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: node convert.js "<url-or-data-string>"');
    process.exit(1);
  }
  const puzzle = decode(input);
  console.log('--- Raw decoded puzzle (top-level keys) ---');
  console.log(Object.keys(puzzle));
  console.log('title:', puzzle.title, '| author:', puzzle.author);
  console.log('has solution field:', !!puzzle.solution);
  const result = convert(puzzle);
  console.log('--- Conversion result ---');
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { decode, convert, extractDataString, parseCell };
