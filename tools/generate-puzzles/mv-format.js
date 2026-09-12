// Converts the minimized lisudoku_solver JSON survivors back into
// Solver's Notebook's puzzles.js entry format, double-checks them against
// the app's own sudoku-engine.js conflict checker, and writes a snippet
// ready to paste into puzzles.js.
const fs = require('fs');
const vm = require('vm');

const engineSrc = fs.readFileSync(__dirname + '/../../sudoku-engine.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(engineSrc, sandbox);
const { findConflicts, findVariantConflicts } = sandbox.window.SudokuEngine;

function cellsFromLine(line) { return line.map(p => [p.row, p.col]); }
function emptyGrid() { return Array.from({ length: 9 }, () => Array(9).fill(0)); }

function loadFinal(name) {
  const grid = JSON.parse(fs.readFileSync(__dirname + `/mv-${name}-grid.json`, 'utf8'));
  const files = fs.readdirSync(__dirname).filter(f => f.startsWith(`mv-${name}-final`));
  // Pick the highest-numbered final file (final, final2, final3, ...).
  files.sort((a, b) => a.length - b.length || a.localeCompare(b));
  const chosen = files[files.length - 1];
  const constraints = JSON.parse(fs.readFileSync(__dirname + '/' + chosen, 'utf8'));
  return { grid, constraints, file: chosen };
}

function buildKropki(constraints) {
  return (constraints.kropkiDots || []).map(d => ({
    a: [d.cell1.row, d.cell1.col],
    b: [d.cell2.row, d.cell2.col],
    kind: d.dotType === 'Consecutive' ? 'white' : 'black',
  }));
}

const entries = [];

// ---- kropki-renban ----
{
  const { grid, constraints, file } = loadFinal('kropki-renban');
  console.log('kropki-renban using', file);
  const kropki = buildKropki(constraints);
  const lines = (constraints.renbans || []).map(line => ({ kind: 'renban', cells: cellsFromLine(line) }));
  assertOk(grid, { kropki, lines }, 'kropki-renban');
  entries.push({
    id: 'kropki-renban-1',
    title: 'Consecutive Chains',
    blurb: `No givens — ${kropki.length} kropki dots and ${lines.length} renban lines are the only clues. Needs full kropki-chain deduction plus an XY-Wing to finish.`,
    givens: emptyGrid(),
    solution: grid,
    kropki,
    lines,
    variants: ['kropki', 'lines'],
  });
}

// ---- kropki-thermo ----
{
  const { grid, constraints, file } = loadFinal('kropki-thermo');
  console.log('kropki-thermo using', file);
  const kropki = buildKropki(constraints);
  const lines = (constraints.thermos || []).map(line => ({ kind: 'thermo', cells: cellsFromLine(line) }));
  assertOk(grid, { kropki, lines }, 'kropki-thermo');
  entries.push({
    id: 'kropki-thermo-1',
    title: 'Dots and Bulbs',
    blurb: `No givens — ${kropki.length} kropki dots and ${lines.length} thermometers do all the work. A steady chain of kropki and thermo deductions, no guessing.`,
    givens: emptyGrid(),
    solution: grid,
    kropki,
    lines,
    variants: ['kropki', 'lines'],
  });
}

// ---- kropki-arrow ----
{
  const { grid, constraints, file } = loadFinal('kropki-arrow');
  console.log('kropki-arrow using', file);
  const kropki = buildKropki(constraints);
  const arrows = (constraints.arrows || []).map(a => ({
    circle: [a.circleCells[0].row, a.circleCells[0].col],
    cells: cellsFromLine(a.arrowCells),
  }));
  assertOk(grid, { kropki, arrows }, 'kropki-arrow');
  entries.push({
    id: 'kropki-arrow-1',
    title: 'Circles and Dots',
    blurb: `No givens — ${kropki.length} kropki dots and ${arrows.length} arrows. Locked candidates and naked pairs unravel it one region at a time.`,
    givens: emptyGrid(),
    solution: grid,
    kropki,
    arrows,
    variants: ['kropki', 'lines'],
  });
}

function assertOk(grid, constraints, label) {
  const classic = findConflicts(grid);
  if (classic.size > 0) throw new Error(`${label}: classic conflicts on solution`);
  const variant = findVariantConflicts(grid, constraints);
  if (variant.size > 0) throw new Error(`${label}: variant conflicts on solution: ${[...variant]}`);
}

// ---- Emit as a puzzles.js-ready snippet ----
const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function fmt(value, indent) {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every(v => typeof v === 'number')) return '[' + value.join(', ') + ']';
    if (value.every(v => Array.isArray(v) && v.every(x => typeof x === 'number'))) {
      return '[' + value.map(v => '[' + v.join(', ') + ']').join(', ') + ']';
    }
    const items = value.map(v => padIn + fmt(v, indent + 1));
    return '[\n' + items.join(',\n') + '\n' + pad + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    const inlineParts = keys.map(k => (IDENT_RE.test(k) ? k : JSON.stringify(k)) + ': ' + fmt(value[k], indent + 1));
    const oneLine = '{ ' + inlineParts.join(', ') + ' }';
    if (oneLine.length <= 100 && !oneLine.includes('\n')) return oneLine;
    const items = keys.map(k => padIn + (IDENT_RE.test(k) ? k : JSON.stringify(k)) + ': ' + fmt(value[k], indent + 1));
    return '{\n' + items.join(',\n') + '\n' + pad + '}';
  }
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}
function fmtGrid(grid, indent) {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);
  return '[\n' + grid.map(row => padIn + '[' + row.join(', ') + ']').join(',\n') + '\n' + pad + ']';
}
let out = '\n    // ---- Multi-variant puzzles (tagged into more than one folder) ----\n';
for (const entry of entries) {
  const pad = '  '.repeat(2), padIn = '  '.repeat(3);
  out += pad + '{\n';
  for (const key of Object.keys(entry)) {
    const valStr = (key === 'givens' || key === 'solution') ? fmtGrid(entry[key], 3) : fmt(entry[key], 3);
    out += padIn + key + ': ' + valStr + ',\n';
  }
  out += pad + '},\n';
}
fs.writeFileSync(__dirname + '/mv-snippet.js', out);
console.log('\nWrote mv-snippet.js, length', out.length);
