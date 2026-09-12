const data = require('./generated.json');

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function fmt(value, indent) {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    // Array of numbers (and/or null, e.g. sandwich rows/cols) -> inline
    if (value.every(v => typeof v === 'number' || v === null)) {
      return '[' + value.map(v => fmt(v, indent)).join(', ') + ']';
    }
    // Array of coordinate pairs (e.g. cage/line cells) -> keep the whole
    // thing on one line, matching the hand-authored style.
    if (value.every(v => Array.isArray(v) && v.every(x => typeof x === 'number'))) {
      return '[' + value.map(v => '[' + v.join(', ') + ']').join(', ') + ']';
    }
    const items = value.map(v => padIn + fmt(v, indent + 1));
    return '[\n' + items.join(',\n') + '\n' + pad + ']';
  }
  if (value === null) return 'null';
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    // Small flat objects (a cage, a dot, an xv pair, a line) fit on one line.
    const inlineParts = keys.map(k => {
      const keyStr = IDENT_RE.test(k) ? k : JSON.stringify(k);
      return keyStr + ': ' + fmt(value[k], indent + 1);
    });
    const oneLine = '{ ' + inlineParts.join(', ') + ' }';
    if (keys.length <= 3 && !oneLine.includes('\n') && oneLine.length <= 100) {
      return oneLine;
    }
    const items = keys.map(k => {
      const keyStr = IDENT_RE.test(k) ? k : JSON.stringify(k);
      return padIn + keyStr + ': ' + fmt(value[k], indent + 1);
    });
    return '{\n' + items.join(',\n') + '\n' + pad + '}';
  }
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

// Special-case grid-shaped arrays (9 rows of 9 numbers) to print one row
// per line for readability, matching the hand-authored style.
function fmtGrid(grid, indent) {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);
  const rows = grid.map(row => padIn + '[' + row.join(', ') + ']');
  return '[\n' + rows.join(',\n') + '\n' + pad + ']';
}

function fmtEntry(entry, indent) {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);
  const lines = [];
  for (const key of Object.keys(entry)) {
    let valStr;
    if (key === 'givens' || key === 'solution') {
      valStr = fmtGrid(entry[key], indent + 1);
    } else {
      valStr = fmt(entry[key], indent + 1);
    }
    lines.push(padIn + key + ': ' + valStr);
  }
  return pad + '{\n' + lines.join(',\n') + '\n' + pad + '},';
}

let out = '';
for (const [category, entries] of Object.entries(data)) {
  out += `\n    // ---- Generated ${category} puzzles ----\n`;
  for (const entry of entries) {
    out += fmtEntry(entry, 2) + '\n';
  }
}

require('fs').writeFileSync(__dirname + '/snippet.js', out);
console.log('Wrote snippet.js, length', out.length);
