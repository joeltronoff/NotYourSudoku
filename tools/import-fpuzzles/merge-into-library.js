// Merges imported-final.json (real, credited community puzzles) into the
// existing puzzles.js, re-emitting the whole file in the same pretty style
// assemble.js used originally.
const fs = require('fs');
const vm = require('vm');

const currentSrc = fs.readFileSync(__dirname + '/../../puzzles.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(currentSrc, sandbox);
const existing = sandbox.window.PuzzleLibrary;

const engineSrc = fs.readFileSync(__dirname + '/../../sudoku-engine.js', 'utf8');
const engineSandbox = { window: {} };
vm.createContext(engineSandbox);
vm.runInContext(engineSrc, engineSandbox);
const { findConflicts, findVariantConflicts } = engineSandbox.window.SudokuEngine;

const imported = JSON.parse(fs.readFileSync(__dirname + '/imported-final.json', 'utf8'));
for (const p of imported) {
  if (findConflicts(p.solution).size > 0) throw new Error(`${p.id}: classic conflicts`);
  const conflicts = findVariantConflicts(p.solution, p);
  if (conflicts.size > 0) throw new Error(`${p.id}: variant conflicts: ${[...conflicts]}`);
}

const all = [...existing, ...imported];

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
const FIELD_ORDER = ['id', 'title', 'blurb', 'stars', 'givens', 'solution', 'cages', 'kropki', 'lines', 'arrows', 'antiKnight', 'sandwich', 'xv', 'variants'];
function fmtEntry(entry) {
  const pad = '    ', padIn = '      ';
  let out = pad + '{\n';
  for (const key of FIELD_ORDER) {
    if (!(key in entry)) continue;
    const valStr = (key === 'givens' || key === 'solution') ? fmtGrid(entry[key], 3) : fmt(entry[key], 3);
    out += padIn + key + ': ' + valStr + ',\n';
  }
  out = out.replace(/,\n$/, '\n');
  out += pad + '},\n';
  return out;
}

const CATEGORY_ORDER = [
  ['killer', 'Killer Cages'],
  ['kropki', 'Kropki Dots'],
  ['lines', 'Lines & Arrows'],
  ['antiknight', 'Anti-Knight'],
  ['sandwich', 'Sandwich'],
  ['xv', 'XV'],
];
let body = '';
const emitted = new Set();
for (const [key, label] of CATEGORY_ORDER) {
  const inCategory = all.filter(p => (p.variants ? p.variants[0] : p.variant) === key && !emitted.has(p.id));
  if (inCategory.length === 0) continue;
  body += `\n    // ---- ${label} ----\n`;
  for (const p of inCategory) { body += fmtEntry(p); emitted.add(p.id); }
}
const leftover = all.filter(p => !emitted.has(p.id));
if (leftover.length > 0) {
  body += '\n    // ---- Multi-variant ----\n';
  for (const p of leftover) body += fmtEntry(p);
}

const header = currentSrc.slice(0, currentSrc.indexOf('(() => {'));
const output = header + `(() => {
  window.PuzzleLibrary = [
${body}  ];
})();
`;
fs.writeFileSync(__dirname + '/../../puzzles.js', output);
console.log('Wrote puzzles.js:', all.length, 'total puzzles (', imported.length, 'newly imported).');
