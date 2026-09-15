// Converts a decoded SudokuPad (scl) or f-puzzles payload into a
// Solver's Notebook puzzle entry -- or explains why it can't.
//
// SudokuPad's native format is purely visual (coloured lines, circles,
// text), so constraint kinds are inferred from shape + colour + the rules
// text, and every inference that could go more than one way is settled
// against the setter's own solution when one is available. Anything this
// converter doesn't positively recognise rejects the whole puzzle rather
// than being silently dropped: a dropped clue usually means a broken puzzle.
//
// convertPayload({ format, puzzle }) -> { entry, meta } | { error }

const DIGITS = /^[1-9]$/;

class Reject extends Error {}
const reject = msg => { throw new Reject(msg); };

// ---------------------------------------------------------------- colours
function parseColor(str) {
  if (str == null) return null;
  str = String(str).trim().toLowerCase();
  if (str === 'transparent' || str === 'none' || str === '') return { r: 0, g: 0, b: 0, a: 0 };
  const named = { white: '#ffffff', black: '#000000', gray: '#808080', grey: '#808080', red: '#ff0000', green: '#00ff00', blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', purple: '#800080', pink: '#ffc0cb' };
  if (named[str]) str = named[str];
  let m = str.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map(ch => ch + ch).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return {
      r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }
  m = str.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(',').map(s => parseFloat(s));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }
  return null;
}

// Rough colour family, blending translucent colours over white paper.
function colorFamily(str) {
  const c = parseColor(str);
  if (!c) return 'unknown';
  if (c.a < 0.05) return 'none';
  const blend = v => v * c.a + 255 * (1 - c.a);
  const r = blend(c.r) / 255, g = blend(c.g) / 255, b = blend(c.b) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min));
  if (max - min < 0.12 || s < 0.15) {
    if (l > 0.93) return 'white';
    if (l < 0.2) return 'black';
    return 'gray';
  }
  let h;
  if (max === r) h = ((g - b) / (max - min)) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 345) return 'red';
  if (h < 45) return 'orange';
  if (h < 70) return 'yellow';
  if (h < 170) return 'green';
  if (h < 250) return 'blue';
  if (h < 290) return 'purple';
  return 'pink';
}

const COLOR_WORDS = {
  green: /green/, blue: /blue|cyan|teal|turquoise/, purple: /purple|violet|lilac|lavender|magenta/,
  pink: /pink|magenta|purple/, gray: /gr[ae]y|silver/, red: /\bred\b/, orange: /orange/, yellow: /yellow/,
};

// ---------------------------------------------------------------- rules text
const KIND_KEYWORDS = {
  killer: /cage/,
  kropkiWhite: /white dot|white circle|consecutive/,
  kropkiBlack: /black dot|black circle|double|twice|ratio/,
  thermo: /thermo/,
  whispers: /whisper|differ by (at least )?(5|five)|difference of (at least )?(5|five)/,
  renban: /renban|consecutive/,
  palindrome: /palindrom|read the same|same (forwards|backwards)/,
  arrow: /arrow/,
  littleKiller: /diagonal|little killer/,
  sandwich: /sandwich|between the 1 and (the )?9|between 1 and 9/,
  xv: /\bx\b|\bv\b|\bxv\b/,
  antiKnight: /knight/,
  diagonal: /diagonal/,
  odd: /\bodd\b/,
  even: /\beven\b/,
};

// Phrases that change the meaning of a constraint we'd otherwise recognise,
// or introduce a rule this app can't enforce at all.
const RULE_BLACKLIST = [
  /three times|triple|1:3|ratio of 3/, /wobbly/, /dutch/, /slow thermo|may repeat on (a|the) thermo|not necessarily (strictly )?increas/,
  /missing bulb|bulbs? (are|is) missing|thermo.*(no|without) bulb/, /fog/, /nabner/, /entropic|entropy/, /modular/,
  /parity line/, /region sum/, /between line/, /lockout/, /zipper/, /clone/, /anti-?king|king'?s move/,
  /disjoint/, /x-?sum/, /skyscraper/, /quadruple/, /index/, /doubler/, /negator/, /chaos/, /irregular/,
  /yin.?yang/, /\bloop\b/, /snake/, /sweeper/, /cipher|letter/, /product/, /10 lines|ten lines/, /equal sum/,
  /multiplied|multiplication/, /\bliar\b|\blie\b|lying/, /extra region/, /deconstruct/, /fill ?omino/,
  /windoku|hyper/, /non-?consecutive/, /anti-?kropki/, /max(imum)? cell|min(imum)? cell/,
  /\bgreater than\b|\bless than\b|inequality/, /numbered room/, /count(ing)? circle/, /magic square/,
  /\bsum(s)? of (the )?(digits )?(in )?(each|every) (row|column)/, /\bmean\b|\baverage\b/, /\bprime/,
  /can repeat in (a|the) cage|may repeat (with)?in (a|the) cage|digits may repeat in cages/,
  /(clue|dot|cage|arrow|line)s? (is|are|may be) (wrong|incorrect|false|lying)/,
  /unknown (digit|value|sum)|hidden (digit|value|sum)|missing (clue|sum|bulb|dot)/,
  /\b(6|six)x(6|six)|\b(4|four)x(4|four)/, /killer cages? (with|have) no (sum|total)/,
];

function rulesSentences(rules) {
  return rules.toLowerCase().split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------------- geometry
const EPS = 1e-6;
const inGrid = ([r, c]) => r >= 0 && r < 9 && c >= 0 && c < 9;
const isHalf = v => Math.abs(v - Math.floor(v) - 0.5) < 0.02;
const isInt = v => Math.abs(v - Math.round(v)) < 0.02;
const cellOfPoint = ([r, c]) => [Math.floor(r + EPS), Math.floor(c + EPS)];
const sameCell = (a, b) => a[0] === b[0] && a[1] === b[1];

// Converts waypoints into the ordered list of cells they pass through.
// Only axis-aligned and 45-degree runs are accepted.
function rasterize(wayPoints) {
  if (!Array.isArray(wayPoints) || wayPoints.length < 2) reject('line with fewer than 2 waypoints');
  const cells = [cellOfPoint(wayPoints[0])];
  for (let i = 1; i < wayPoints.length; i++) {
    const from = cells[cells.length - 1];
    const to = cellOfPoint(wayPoints[i]);
    const dr = to[0] - from[0], dc = to[1] - from[1];
    if (dr === 0 && dc === 0) continue;
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) reject('line segment that is not straight or 45-degree');
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    for (let k = 1; k <= steps; k++) cells.push([from[0] + Math.sign(dr) * k, from[1] + Math.sign(dc) * k]);
  }
  if (!cells.every(inGrid)) reject('line leaves the grid');
  return cells;
}

// ---------------------------------------------------------------- scl metadata
function sclMetadata(p) {
  const meta = { ...(p.metadata || {}) };
  const realCages = [];
  for (const cage of p.cages || []) {
    if (!cage || Object.keys(cage).length === 0) continue;
    if (typeof cage.value === 'string' && !cage.cells) {
      const m = cage.value.match(/^\s*([a-z]+)\s*:\s*([\s\S]*)$/i);
      if (m) { meta[m[1].toLowerCase()] = m[2].trim(); continue; }
    }
    if (!cage.cells || cage.cells.length === 0) continue; // e.g. {value: 0} placeholders
    realCages.push(cage);
  }
  return { meta, realCages };
}

function parseSolutionString(s) {
  if (typeof s !== 'string') return null;
  const digits = s.replace(/[^0-9]/g, '');
  if (digits.length !== 81 || /0/.test(digits)) return null;
  return Array.from({ length: 9 }, (_, r) => digits.slice(r * 9, r * 9 + 9).split('').map(Number));
}

// ---------------------------------------------------------------- checks vs solution
const holds = {
  whispers: (sol, cells) => cells.every((c, i) => i === 0 || Math.abs(sol[c[0]][c[1]] - sol[cells[i - 1][0]][cells[i - 1][1]]) >= 5),
  renban: (sol, cells) => {
    const vals = cells.map(([r, c]) => sol[r][c]);
    return new Set(vals).size === vals.length && Math.max(...vals) - Math.min(...vals) === vals.length - 1;
  },
  palindrome: (sol, cells) => cells.every((c, i) => sol[c[0]][c[1]] === sol[cells[cells.length - 1 - i][0]][cells[cells.length - 1 - i][1]]),
  thermo: (sol, cells) => cells.every((c, i) => i === 0 || sol[c[0]][c[1]] > sol[cells[i - 1][0]][cells[i - 1][1]]),
};

// Decides whether each colour group of plain lines is whispers, renban or
// palindrome, from the rules text (which colour it names for which rule),
// usual colour conventions, and -- decisively -- the setter's solution.
// `infos`: [{ cells, fam }]. Returns puzzle `lines` entries or rejects.
const DEFAULT_KIND = { green: 'whispers', pink: 'renban', purple: 'renban', gray: 'palindrome' };
function inferColouredLines(infos, { rules, solution, mentions }) {
  const endpointKey = cell => `${cell[0]},${cell[1]}`;
  const groups = new Map();
  for (const x of infos) {
    if (!groups.has(x.fam)) groups.set(x.fam, []);
    groups.get(x.fam).push(x);
  }
  const sentences = rules ? rulesSentences(rules) : [];
  const out = [];
  for (const [fam, members] of groups) {
    let options = ['whispers', 'renban', 'palindrome'].filter(k => mentions(k));
    if (sentences.length && COLOR_WORDS[fam]) {
      const named = options.filter(k => sentences.some(s => COLOR_WORDS[fam].test(s) && KIND_KEYWORDS[k].test(s)));
      if (named.length > 0) options = named;
      else if (sentences.some(s => COLOR_WORDS[fam].test(s) && /line/.test(s))) options = []; // colour named for some other rule
    }
    // A closed loop repeats its first cell at the end. Whispers keep the
    // closing pair; a renban is just its set of cells; palindromes can't loop.
    const cellsFor = (kind, x) => {
      const closed = x.cells.length > 2 && sameCell(x.cells[0], x.cells[x.cells.length - 1]);
      if (kind === 'renban' && closed) return x.cells.slice(0, -1);
      if (kind === 'palindrome' && closed) return null;
      return x.cells;
    };
    const valid = (kind, x) => {
      const cells = cellsFor(kind, x);
      if (!cells) return false;
      if (kind !== 'whispers' && new Set(cells.map(endpointKey)).size !== cells.length) return false;
      return !solution || holds[kind](solution, cells);
    };
    options = options.filter(k => members.every(x => valid(k, x)));
    if (options.length > 1 && DEFAULT_KIND[fam] && options.includes(DEFAULT_KIND[fam])) options = [DEFAULT_KIND[fam]];
    if (options.length !== 1) reject(`can't identify ${fam} line rule (${options.length} options)`);
    for (const x of members) out.push({ kind: options[0], cells: cellsFor(options[0], x) });
  }
  return out;
}

// ---------------------------------------------------------------- scl converter
function convertScl(p, ctx) {
  const { meta, realCages } = sclMetadata(p);
  const rules = String(meta.rules || '');
  const rulesLower = rules.toLowerCase();
  const solution = parseSolutionString(meta.solution);
  const mentions = kind => (rules ? KIND_KEYWORDS[kind].test(rulesLower) : ctx.tagAllows(kind));

  // Grid shape and regions.
  if (!Array.isArray(p.cells) || p.cells.length !== 9 || !p.cells.every(row => Array.isArray(row) && row.length === 9)) {
    reject('not a 9x9 grid');
  }
  if (p.regions) {
    const boxes = p.regions.map(reg => new Set(reg.map(([r, c]) => Math.floor(r / 3) * 3 + Math.floor(c / 3))));
    if (p.regions.length !== 9 || !boxes.every(s => s.size === 1) || p.regions.some(reg => reg.length !== 9)) {
      reject('irregular regions');
    }
  }

  const givens = Array.from({ length: 9 }, () => Array(9).fill(0));
  p.cells.forEach((row, r) => row.forEach((cell, c) => {
    if (cell && cell.value != null && cell.value !== '') {
      if (!DIGITS.test(String(cell.value))) reject(`non-digit given ${cell.value}`);
      givens[r][c] = Number(cell.value);
    }
  }));

  const entry = { givens };
  const used = { lines: new Set(), overlays: new Set(), underlays: new Set(), arrows: new Set() };

  // ---- killer cages
  const cages = [];
  const hiddenCages = [];
  for (const cage of realCages) {
    if (cage.hidden) { hiddenCages.push(cage); continue; }
    const cells = cage.cells.map(([r, c]) => [r, c]);
    if (!cells.every(inGrid)) reject('cage outside grid');
    let sum = null;
    if (cage.value != null && cage.value !== '') {
      if (!/^\d+$/.test(String(cage.value))) reject(`non-numeric cage value ${cage.value}`);
      sum = Number(cage.value);
    }
    if (sum === 0) sum = null;
    if (sum == null && !mentions('killer')) reject('unlabelled cage without cage rules');
    cages.push({ cells, sum });
  }
  if (cages.length > 0) {
    if (!mentions('killer')) reject('cages present but rules never mention cages');
    entry.cages = cages;
  }

  const overlays = [...(p.overlays || []).map((o, i) => ({ ...o, _list: 'overlays', _i: i })),
    ...(p.underlays || []).map((o, i) => ({ ...o, _list: 'underlays', _i: i }))];
  const markUsed = o => used[o._list].add(o._i);

  // Circles centred on a cell (thermo bulbs, arrow circles, odd markers).
  const centredCircles = overlays.filter(o => o.center && isHalf(o.center[0]) && isHalf(o.center[1])
    && inGrid(cellOfPoint(o.center)) && o.rounded && (o.width || 0) >= 0.55 && (o.width || 0) <= 1.05
    && Math.abs((o.width || 0) - (o.height || 0)) < 0.05 && !o.text);
  const circleAt = (cell, pred) => centredCircles.find(o => sameCell(cellOfPoint(o.center), cell) && pred(o));
  const filledGray = o => ['gray', 'black'].includes(colorFamily(o.backgroundColor));

  // ---- arrows (sum-into-circle), from the dedicated arrows list
  const arrows = [];
  const littleKillerArrows = [];
  (p.arrows || []).forEach((a, i) => {
    const wp = a.wayPoints || [];
    if (wp.length < 2) { used.arrows.add(i); return; } // draws nothing
    const outside = wp.length > 0 && wp.every(([r, c]) => r < 0 || r > 9 || c < 0 || c > 9);
    if (outside || (wp.length === 2 && wp.some(([r, c]) => r < 0 || r > 9 || c < 0 || c > 9))) {
      littleKillerArrows.push({ a, i });
      return;
    }
    const cells = rasterize(wp);
    const circleCell = cells[0];
    const circle = circleAt(circleCell, o => true);
    if (!circle) reject('arrow without a single-cell circle at its start');
    markUsed(circle);
    used.arrows.add(i);
    const shaft = cells.slice(1);
    if (shaft.length === 0) reject('arrow with empty shaft');
    arrows.push({ circle: circleCell, cells: shaft });
  });
  if (arrows.length > 0) {
    if (!mentions('arrow')) reject('arrows present but rules never mention arrows');
    // Merge arrows sharing a circle? Each shaft is its own sum in our engine;
    // multiple shafts from one circle each sum to it, which is also standard.
    entry.arrows = arrows;
  }

  // ---- lines
  const lineInfos = (p.lines || []).map((l, i) => {
    const fam = colorFamily(l.color);
    // Grid-corner-to-corner thin lines are diagonal markers, not cell lines.
    const wp = l.wayPoints || [];
    const cornerToCorner = wp.length === 2 && wp.every(([r, c]) => isInt(r) && isInt(c))
      && ((Math.abs(wp[0][0] - wp[0][1]) < 0.05 && Math.abs(wp[1][0] - wp[1][1]) < 0.05)
        || (Math.abs(wp[0][0] + wp[0][1] - 9) < 0.05 && Math.abs(wp[1][0] + wp[1][1] - 9) < 0.05))
      && Math.abs(Math.abs(wp[0][0] - wp[1][0]) - 9) < 0.05;
    // Thick black lines along box borders just redraw the grid.
    const gridRedraw = fam === 'black' && wp.length >= 2 && wp.every(([r, c]) => isInt(r) && isInt(c))
      && wp.every((pt, k) => k === 0 || ((pt[0] === wp[k - 1][0] && Math.round(pt[0]) % 3 === 0)
        || (pt[1] === wp[k - 1][1] && Math.round(pt[1]) % 3 === 0)));
    const degenerate = wp.length < 2;
    return { l, i, fam, cornerToCorner, gridRedraw, degenerate, thickness: l.thickness || 0 };
  });
  lineInfos.filter(x => x.gridRedraw || x.degenerate).forEach(x => used.lines.add(x.i));

  // Diagonals.
  const diagLines = lineInfos.filter(x => x.cornerToCorner);
  if (diagLines.length > 0) {
    const kinds = new Set(diagLines.map(x => (Math.abs(x.l.wayPoints[0][0] - x.l.wayPoints[0][1]) < 0.05 ? 'main' : 'anti')));
    if (!mentions('diagonal')) reject('diagonal lines but rules never mention diagonals');
    diagLines.forEach(x => used.lines.add(x.i));
    entry.diagonals = kinds.size === 2 ? true : [...kinds][0];
  }
  // SudokuPad enforces extra no-repeat regions with invisible cages; the
  // only kind we can represent is a marked diagonal.
  for (const cage of hiddenCages) {
    const cells = cage.cells;
    const isMain = cells.length === 9 && cells.every(([r, c]) => r === c);
    const isAnti = cells.length === 9 && cells.every(([r, c]) => r + c === 8);
    const marked = d => entry.diagonals === true || entry.diagonals === d;
    if (!((isMain && marked('main')) || (isAnti && marked('anti')))) reject('hidden cage that is not a marked diagonal');
  }

  // Thermometers: gray lines whose chain of pieces starts at a filled bulb.
  const cellLines = lineInfos.filter(x => !used.lines.has(x.i) && x.fam !== 'none');
  cellLines.forEach(x => { x.cells = rasterize(x.l.wayPoints); });
  const bulbAt = cell => circleAt(cell, filledGray);

  const grayLines = cellLines.filter(x => x.fam === 'gray');
  const thermoPieces = grayLines.filter(x => {
    // A gray line belongs to a thermo network if some chain of gray pieces
    // (joined at piece endpoints) reaches a bulb.
    return true;
  });
  const endpointKey = cell => `${cell[0]},${cell[1]}`;
  const byEndpoint = new Map();
  for (const x of thermoPieces) {
    for (const end of [x.cells[0], x.cells[x.cells.length - 1]]) {
      const k = endpointKey(end);
      if (!byEndpoint.has(k)) byEndpoint.set(k, []);
      byEndpoint.get(k).push(x);
    }
  }
  const thermos = [];
  const thermoUsed = new Set();
  const bulbCells = new Set(thermoPieces.flatMap(x => [x.cells[0], x.cells[x.cells.length - 1]])
    .filter(cell => bulbAt(cell)).map(endpointKey));
  for (const bk of bulbCells) {
    const [br, bc] = bk.split(',').map(Number);
    const bulb = bulbAt([br, bc]);
    // Walk every chain of pieces outward from this bulb.
    const walk = (path, atCell, visited) => {
      const nexts = (byEndpoint.get(endpointKey(atCell)) || []).filter(x => !visited.has(x));
      let extended = false;
      for (const x of nexts) {
        if (path.length > 1 && bulbCells.has(endpointKey(atCell))) continue; // another bulb: stop
        const forward = sameCell(x.cells[0], atCell) ? x.cells : x.cells.slice().reverse();
        const nextVisited = new Set(visited); nextVisited.add(x);
        thermoUsed.add(x);
        extended = true;
        walk(path.concat(forward.slice(1)), forward[forward.length - 1], nextVisited);
      }
      if (!extended && path.length > 1) thermos.push(path);
    };
    walk([[br, bc]], [br, bc], new Set());
    markUsed(bulb);
  }
  for (const t of thermos) {
    if (new Set(t.map(endpointKey)).size !== t.length) reject('self-intersecting thermometer');
  }
  thermoUsed.forEach(x => used.lines.add(x.i));

  const lines = [];
  if (thermos.length > 0) {
    if (!mentions('thermo')) reject('thermometers present but rules never mention thermometers');
    if (solution && !thermos.every(t => holds.thermo(solution, t))) reject('inferred thermometer fails setter solution');
    thermos.forEach(cells => lines.push({ kind: 'thermo', cells }));
  }

  // Remaining lines: whispers / renban / palindrome, grouped by colour.
  const rest = cellLines.filter(x => !used.lines.has(x.i));
  lines.push(...inferColouredLines(rest, { rules, solution, mentions }));
  rest.forEach(x => used.lines.add(x.i));
  const sentences = rules ? rulesSentences(rules) : [];
  if (lines.length > 0) entry.lines = lines;

  // ---- kropki dots, XV, odd/even, outside clues
  const kropki = [];
  const xv = [];
  const oddEven = [];
  const outsideText = [];
  for (const o of overlays) {
    if (used[o._list].has(o._i)) continue;
    const [r, c] = o.center || [NaN, NaN];
    const text = o.text == null ? '' : String(o.text).trim();
    const w = o.width || 0, h = o.height || 0;
    const onVerticalEdge = isHalf(r) && isInt(c) && c > 0 && c < 9 && r > 0 && r < 9; // between (r,c-1) and (r,c)
    const onHorizontalEdge = isInt(r) && isHalf(c) && r > 0 && r < 9 && c > 0 && c < 9;
    const outside = r < 0 || r > 9 || c < 0 || c > 9;

    // A plain white/transparent backdrop behind the whole grid.
    if (w >= 8.5 && h >= 8.5 && !text && ['white', 'none'].includes(colorFamily(o.backgroundColor))) { markUsed(o); continue; }

    if (outside && text !== '') { outsideText.push({ o, text }); markUsed(o); continue; }
    if (outside && text === '') { markUsed(o); continue; } // decorative (e.g. little-killer backing)

    if ((onVerticalEdge || onHorizontalEdge) && (text === '' || text === 'X' || text === 'V' || text === 'x' || text === 'v')) {
      const a = onVerticalEdge ? [Math.floor(r), c - 1] : [r - 1, Math.floor(c)];
      const b = onVerticalEdge ? [Math.floor(r), c] : [r, Math.floor(c)];
      if (text) {
        xv.push({ a, b, kind: text.toUpperCase() });
      } else if (o.rounded && w <= 0.5) {
        const fam = colorFamily(o.backgroundColor);
        if (fam === 'white' || fam === 'none') kropki.push({ a, b, kind: 'white' });
        else if (fam === 'black') kropki.push({ a, b, kind: 'black' });
        else reject(`kropki-like dot in colour ${o.backgroundColor}`);
      } else {
        reject('unrecognised edge marker');
      }
      markUsed(o);
      continue;
    }

    if (isHalf(r) && isHalf(c) && !text && w >= 0.5 && w <= 0.95 && Math.abs(w - h) < 0.05) {
      const fam = colorFamily(o.backgroundColor);
      if (['gray', 'black'].includes(fam) || (fam === 'white' && colorFamily(o.borderColor) === 'gray' && false)) {
        oddEven.push({ cell: [Math.floor(r), Math.floor(c)], parity: o.rounded ? 'odd' : 'even' });
        markUsed(o);
        continue;
      }
    }

    // Whole-cell colouring is decoration unless the rules talk about
    // colours or shading (then it's probably a rule we can't model).
    if (o._list === 'underlays' && isHalf(r) && isHalf(c) && !text && w >= 0.95 && h >= 0.95
      && !/shad|colou?r|highlight|\bgr[ae]y\b|\bblue\b|\bgreen\b|\byellow\b|\borange\b|\bpink\b|\bpurple\b|\bred\b/.test(
        rulesLower.replace(/(green|pink|purple|blue|gr[ae]y|red|orange|yellow|magenta)( \w+)? (line|dot|circle|arrow|cage)s?/g, ''))) {
      markUsed(o);
      continue;
    }

    // Given digits drawn as text? Cage labels as text? Too ambiguous.
    reject(`unrecognised ${o._list.slice(0, -1)} at [${r},${c}]${text ? ` text "${text}"` : ''}`);
  }

  if (kropki.length > 0) {
    if (kropki.some(d => d.kind === 'white') && !mentions('kropkiWhite')) reject('white dots but rules never mention them');
    if (kropki.some(d => d.kind === 'black') && !mentions('kropkiBlack')) reject('black dots but rules never mention them');
    entry.kropki = kropki;
  }
  if (xv.length > 0) {
    if (!mentions('xv')) reject('XV markers but rules never mention X/V');
    entry.xv = xv;
  }
  if (oddEven.length > 0) {
    if (oddEven.some(x => x.parity === 'odd') && !mentions('odd')) reject('odd markers but rules never mention odd');
    if (oddEven.some(x => x.parity === 'even') && !mentions('even')) reject('even markers but rules never mention even');
    entry.oddEven = oddEven;
  }

  // Outside-grid numbers: sandwich (orthogonal) or little killer (with a diagonal arrow).
  if (outsideText.length > 0) {
    const lkArrowDirs = littleKillerArrows.map(({ a, i }) => {
      used.arrows.add(i);
      const wp = a.wayPoints;
      const dr = wp[wp.length - 1][0] - wp[0][0], dc = wp[wp.length - 1][1] - wp[0][1];
      return { at: wp[0], dir: [Math.sign(dr), Math.sign(dc)], diagonal: Math.abs(Math.abs(dr) - Math.abs(dc)) < 0.05 && dr !== 0 };
    });
    const sandwichClues = { rows: Array(9).fill(null), cols: Array(9).fill(null) };
    const littleKiller = [];
    for (const { o, text } of outsideText) {
      if (!/^\d+$/.test(text)) reject(`non-numeric outside clue "${text}"`);
      const [r, c] = o.center;
      const near = lkArrowDirs.filter(x => Math.hypot(x.at[0] - r, x.at[1] - c) < 0.75);
      if (near.length > 0) {
        if (near.length > 1 || !near[0].diagonal) reject('ambiguous little killer arrow');
        const dir = near[0].dir;
        const cells = [];
        let cr = Math.floor(r + dir[0] + EPS), cc = Math.floor(c + dir[1] + EPS);
        while (inGrid([cr, cc])) { cells.push([cr, cc]); cr += dir[0]; cc += dir[1]; }
        if (cells.length === 0) reject('little killer clue pointing out of the grid');
        littleKiller.push({ cells, dir, sum: Number(text) });
      } else if (isHalf(r) && isHalf(c) && (r < 0 || c < 0 || r > 9 || c > 9)) {
        if (!mentions('sandwich')) reject('outside numbers without sandwich/little-killer rules');
        if ((r < 0 || r > 9) && c > 0 && c < 9) {
          const col = Math.floor(c);
          if (sandwichClues.cols[col] != null && sandwichClues.cols[col] !== Number(text)) reject('conflicting sandwich clues');
          sandwichClues.cols[col] = Number(text);
        } else if ((c < 0 || c > 9) && r > 0 && r < 9) {
          const row = Math.floor(r);
          if (sandwichClues.rows[row] != null && sandwichClues.rows[row] !== Number(text)) reject('conflicting sandwich clues');
          sandwichClues.rows[row] = Number(text);
        } else reject('corner outside clue without arrow');
        if (r > 9 || c > 9) reject('sandwich clue on bottom/right edge (app draws top/left only)');
      } else {
        reject('unplaced outside clue');
      }
    }
    if (littleKiller.length > 0) {
      if (!mentions('littleKiller')) reject('little killer clues but rules never mention diagonals');
      entry.littleKiller = littleKiller;
    }
    if (sandwichClues.rows.some(v => v != null) || sandwichClues.cols.some(v => v != null)) entry.sandwich = sandwichClues;
  }

  // Anything left in the drawing we didn't account for.
  const leftovers = [];
  (p.lines || []).forEach((l, i) => { if (!used.lines.has(i)) leftovers.push(`line ${l.color}`); });
  (p.arrows || []).forEach((a, i) => { if (!used.arrows.has(i)) leftovers.push('arrow'); });
  if (leftovers.length > 0) reject(`unrecognised elements: ${[...new Set(leftovers)].join(', ')}`);

  // Rule-only constraints.
  if ((meta.antiknight || /knight/.test(rulesLower))) {
    if (!/knight/.test(rulesLower) && !meta.antiknight) reject('ambiguous anti-knight');
    entry.antiKnight = true;
  }
  // "All possible dots are given" turns on the negative constraint; the far
  // more common "NOT all possible dots are given" must not.
  const negativeKropki = sentences.some(s => /all (possible |the )?(kropki )?dots (are|have been) (given|shown)|every (possible )?dot is (given|shown)/.test(s)
    && !/\bnot (all|every|necessarily)|\bnot\b.*\bgiven\b|n't/.test(s));
  if (negativeKropki) {
    if (!entry.kropki) reject('negative kropki rule without dots');
    entry.kropkiNegative = true;
  }
  if (sentences.some(s => /all (possible )?(x|v|xv|x's|xs|v's|vs)\b.*\bgiven/.test(s) && !/\bnot\b|n't/.test(s))) {
    reject('negative XV constraint (not supported)');
  }

  return { entry, rules, solution, title: meta.title || '', author: meta.author || '' };
}

// ---------------------------------------------------------------- f-puzzles converter
const FP_UNSUPPORTED = [
  'extraregion', 'clone', 'quadruple', 'betweenline', 'minimum', 'maximum', 'rowindexer', 'columnindexer',
  'boxindexer', 'xsum', 'skyscraper', 'entropicline', 'modularline', 'zipperline', 'nabner', 'doublearrow',
  'lockout', 'disjointgroups', 'fogofwar', 'foglight', 'cage', 'antiking', 'regionsumline', 'nonconsecutive',
  'slowthermometer', 'text', 'rectangle', 'circle', 'regionsum', 'parityline', 'dutchwhispers',
];

function parseFpCell(s) {
  const m = String(s).match(/^R(\d+)C(\d+)$/i);
  if (!m) reject(`bad cell ${s}`);
  return [Number(m[1]) - 1, Number(m[2]) - 1];
}

function convertFpuzzles(p, ctx) {
  if (p.size !== 9) reject(`grid size ${p.size}`);
  const present = FP_UNSUPPORTED.filter(f => {
    const v = p[f];
    return v !== undefined && v !== false && !(Array.isArray(v) && v.length === 0);
  });
  if (present.length) reject(`unsupported f-puzzles fields: ${present.join(', ')}`);
  const rules = String(p.ruleset || '');
  const rulesLower = rules.toLowerCase();

  const givens = Array.from({ length: 9 }, () => Array(9).fill(0));
  (p.grid || []).forEach((row, r) => row.forEach((cell, c) => {
    if (cell.region != null && cell.region !== Math.floor(r / 3) * 3 + Math.floor(c / 3)) reject('irregular regions');
    if (cell.given && cell.value) givens[r][c] = cell.value;
  }));
  const entry = { givens };

  if (p.killercage && p.killercage.length) {
    entry.cages = p.killercage.map(k => {
      if (k.value == null || k.value === '') return { cells: k.cells.map(parseFpCell), sum: null };
      if (!/^\d+$/.test(String(k.value))) reject('killer cage without numeric sum');
      return { cells: k.cells.map(parseFpCell), sum: Number(k.value) };
    });
  }
  const kropki = [];
  for (const d of p.difference || []) {
    if (d.value != null && d.value !== '' && Number(d.value) !== 1) reject(`difference dot value ${d.value}`);
    const [a, b] = d.cells.map(parseFpCell); kropki.push({ a, b, kind: 'white' });
  }
  for (const d of p.ratio || []) {
    if (d.value != null && d.value !== '' && Number(d.value) !== 2) reject(`ratio dot value ${d.value}`);
    const [a, b] = d.cells.map(parseFpCell); kropki.push({ a, b, kind: 'black' });
  }
  if (kropki.length) entry.kropki = kropki;
  const neg = p.negative || [];
  if (neg.length) {
    if (!(neg.includes('ratio') && neg.includes('difference')) || neg.some(n => !['ratio', 'difference'].includes(n))) {
      reject(`negative constraint on ${neg.join('/')} (app supports full kropki negative only)`);
    }
    entry.kropkiNegative = true;
  }

  const lines = [];
  for (const t of p.thermometer || []) for (const l of t.lines) lines.push({ kind: 'thermo', cells: l.map(parseFpCell) });
  for (const t of p.renban || []) for (const l of t.lines) lines.push({ kind: 'renban', cells: l.map(parseFpCell) });
  for (const t of p.palindrome || []) for (const l of t.lines) lines.push({ kind: 'palindrome', cells: l.map(parseFpCell) });
  for (const t of p.whispers || []) {
    if (t.value != null && t.value !== '' && Number(t.value) !== 5) reject(`whispers difference ${t.value}`);
    for (const l of t.lines) lines.push({ kind: 'whispers', cells: l.map(parseFpCell) });
  }
  // Cosmetic "line" objects: some exports carry constraints only as these
  // (sometimes tagged with the constraint they came from).
  const FROM_CONSTRAINT = { whispers: 'whispers', renban: 'renban', palindrome: 'palindrome' };
  const untagged = [];
  for (const l of p.line || []) {
    const tag = String(l.fromConstraint || '').toLowerCase().replace(/[^a-z]/g, '');
    const kind = FROM_CONSTRAINT[tag] || (tag.includes('whisper') ? 'whispers' : null);
    for (const cellsStr of l.lines || []) {
      const cells = cellsStr.map(parseFpCell);
      if (cells.length < 2) continue;
      for (let k = 1; k < cells.length; k++) {
        const dr = Math.abs(cells[k][0] - cells[k - 1][0]), dc = Math.abs(cells[k][1] - cells[k - 1][1]);
        if (dr > 1 || dc > 1) reject('cosmetic line skips cells');
      }
      if (kind) {
        if (!(p[kind === 'whispers' ? 'whispers' : kind] || []).length) lines.push({ kind, cells });
      } else if (tag) {
        reject(`cosmetic line from unsupported constraint ${l.fromConstraint}`);
      } else {
        untagged.push({ cells, fam: colorFamily(l.outlineC || l.color) });
      }
    }
  }
  if (untagged.length) {
    const solutionGrid = Array.isArray(p.solution) && p.solution.length === 81
      ? Array.from({ length: 9 }, (_, r) => p.solution.slice(r * 9, r * 9 + 9).map(Number)) : null;
    const mentions = kind => KIND_KEYWORDS[kind].test(rulesLower);
    lines.push(...inferColouredLines(untagged, { rules, solution: solutionGrid, mentions }));
  }
  if (lines.length) entry.lines = lines;

  if (p.arrow && p.arrow.length) {
    entry.arrows = p.arrow.map(a => {
      if (a.cells.length !== 1) reject('multi-cell arrow bulb');
      if (!a.lines || a.lines.length === 0) reject('arrow without shaft');
      const circle = parseFpCell(a.cells[0]);
      return a.lines.map(line => ({ circle, cells: line.map(parseFpCell).filter(c => !sameCell(c, circle)) }));
    }).flat();
  }
  if (p.antiknight) entry.antiKnight = true;
  // f-puzzles' "diagonal+" runs bottom-left to top-right (our "anti").
  if (p['diagonal+'] || p['diagonal-']) {
    entry.diagonals = p['diagonal+'] && p['diagonal-'] ? true : (p['diagonal+'] ? 'anti' : 'main');
  }
  const oddEven = [];
  for (const o of p.odd || []) oddEven.push({ cell: parseFpCell(o.cell), parity: 'odd' });
  for (const o of p.even || []) oddEven.push({ cell: parseFpCell(o.cell), parity: 'even' });
  if (oddEven.length) entry.oddEven = oddEven;

  if (p.sandwichsum && p.sandwichsum.length) {
    const rows = Array(9).fill(null), cols = Array(9).fill(null);
    for (const clue of p.sandwichsum) {
      const m = String(clue.cell).match(/^R(\d+)C(\d+)$/i);
      const r = Number(m[1]), c = Number(m[2]);
      if (clue.value == null || !/^\d+$/.test(String(clue.value))) reject('sandwich clue without value');
      if (r === 0 && c >= 1 && c <= 9) cols[c - 1] = Number(clue.value);
      else if (c === 0 && r >= 1 && r <= 9) rows[r - 1] = Number(clue.value);
      else reject('sandwich clue on bottom/right edge (app draws top/left only)');
    }
    entry.sandwich = { rows, cols };
  }
  if (p.xv && p.xv.length) {
    entry.xv = p.xv.map(x => {
      const kind = String(x.value || '').toUpperCase();
      if (kind !== 'X' && kind !== 'V') reject('XV marker without X/V');
      const [a, b] = x.cells.map(parseFpCell);
      return { a, b, kind };
    });
  }
  const LK_DIR = { UR: [-1, 1], UL: [-1, -1], DR: [1, 1], DL: [1, -1] };
  if (p.littlekillersum && p.littlekillersum.length) {
    entry.littleKiller = p.littlekillersum.map(k => {
      if (k.value == null || !/^\d+$/.test(String(k.value))) reject('little killer without value');
      const dir = LK_DIR[k.direction];
      if (!dir) reject(`little killer direction ${k.direction}`);
      return { cells: k.cells.map(parseFpCell), dir, sum: Number(k.value) };
    });
  }
  const solution = Array.isArray(p.solution) && p.solution.length === 81 && p.solution.every(v => v >= 1 && v <= 9)
    ? Array.from({ length: 9 }, (_, r) => p.solution.slice(r * 9, r * 9 + 9).map(Number))
    : null;
  return { entry, rules, solution, title: p.title || '', author: p.author || '' };
}

// ---------------------------------------------------------------- entry point
function convertPayload({ format, puzzle }, ctx = {}) {
  const context = { tagAllows: () => false, ...ctx };
  try {
    const out = format === 'fpuzzles' ? convertFpuzzles(puzzle, context) : convertScl(puzzle, context);
    const rulesLower = out.rules.toLowerCase();
    const bad = RULE_BLACKLIST.find(re => re.test(rulesLower));
    if (bad) reject(`rules mention something unsupported (${bad.source})`);
    return out;
  } catch (err) {
    if (err instanceof Reject) return { error: err.message };
    return { error: `converter crash: ${err.message}` };
  }
}

module.exports = { convertPayload, colorFamily };
