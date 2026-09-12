// Assembles the final puzzles.js from solver-verified.json (killer, kropki,
// lines, antiknight) + sandwich-xv.json (sandwich, xv) + the 3 existing
// kropki+lines combo puzzles (Consecutive Chains / Dots and Bulbs / Circles
// and Dots, kept as-is from the previous pass, re-read from the current
// puzzles.js so their exact verified data isn't retyped by hand).
const fs = require('fs');
const vm = require('vm');

const engineSrc = fs.readFileSync(__dirname + '/../../sudoku-engine.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(engineSrc, sandbox);

const currentPuzzlesSrc = fs.readFileSync(__dirname + '/../../puzzles.js', 'utf8');
const puzzleSandbox = { window: {} };
vm.createContext(puzzleSandbox);
vm.runInContext(currentPuzzlesSrc, puzzleSandbox);
const KEEP_IDS = ['kropki-renban-1', 'kropki-thermo-1', 'kropki-arrow-1'];
const kept = puzzleSandbox.window.PuzzleLibrary.filter(p => KEEP_IDS.includes(p.id));
if (kept.length !== KEEP_IDS.length) throw new Error('Could not find all combo puzzles to keep: ' + kept.map(k => k.id));
// These were built pre-star-rating; give them the same technique-tier
// stars established when they were built (see conversation record):
// Consecutive Chains needed XY-Wing (9), Dots and Bulbs topped out at
// Locked Candidates Triples (7), Circles and Dots at Kropki Advanced
// Candidates (6).
const KEPT_STARS = { 'kropki-renban-1': 9, 'kropki-thermo-1': 7, 'kropki-arrow-1': 6 };
kept.forEach(p => { p.stars = KEPT_STARS[p.id]; });

const solverVerified = JSON.parse(fs.readFileSync(__dirname + '/solver-verified.json', 'utf8'));
const sandwichXv = JSON.parse(fs.readFileSync(__dirname + '/sandwich-xv.json', 'utf8'));

const all = [...solverVerified, ...kept, ...sandwichXv];

// Final sanity pass against the app's own engine.
const { findConflicts, findVariantConflicts } = sandbox.window.SudokuEngine;
for (const p of all) {
  if (findConflicts(p.solution).size > 0) throw new Error(`${p.id}: classic conflicts on solution`);
  const constraints = {
    cages: p.cages, kropki: p.kropki, lines: p.lines, arrows: p.arrows,
    antiKnight: p.antiKnight, sandwich: p.sandwich, xv: p.xv,
  };
  const conflicts = findVariantConflicts(p.solution, constraints);
  if (conflicts.size > 0) throw new Error(`${p.id}: variant conflicts: ${[...conflicts]}`);
  if (!p.stars || p.stars < 1 || p.stars > 10) throw new Error(`${p.id}: bad stars value ${p.stars}`);
  if (!p.variants || p.variants.length === 0) throw new Error(`${p.id}: missing variants`);
}

// ---- Pretty-print in the house style ----
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
// Field order for readability, matching the existing house style.
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
  const inCategory = all.filter(p => p.variants[0] === key && !emitted.has(p.id));
  if (inCategory.length === 0) continue;
  body += `\n    // ---- ${label} ----\n`;
  for (const p of inCategory) { body += fmtEntry(p); emitted.add(p.id); }
}
// Anything tagged into a category as a SECONDARY variant only (shouldn't
// happen with this batch, but keep the assembler honest) goes at the end.
const leftover = all.filter(p => !emitted.has(p.id));
if (leftover.length > 0) {
  body += '\n    // ---- Multi-variant ----\n';
  for (const p of leftover) body += fmtEntry(p);
}

const output = `// ============================================================
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
// stars: 1 (trivial) through 10 (hardest) -- see
// tools/generate-puzzles/build-all.js for the exact technique->star map.
// ============================================================

(() => {
  window.PuzzleLibrary = [
${body}  ];
})();
`;
fs.writeFileSync(__dirname + '/../../puzzles.js', output);
console.log('Wrote puzzles.js:', all.length, 'puzzles.');
console.log(all.map(p => `${p.id} (${p.variants.join('+')}) ${p.stars}★`).join('\n'));
