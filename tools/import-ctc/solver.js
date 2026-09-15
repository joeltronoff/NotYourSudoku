// Constraint-propagating solution counter covering every rule Solver's
// Notebook enforces (see findVariantConflicts in sudoku-engine.js), with the
// same semantics. Used to prove an imported puzzle has exactly one solution
// under OUR rules -- which is what matters for the app, whatever extra
// rules the original setter may have had.
//
// countSolutions(entry, { limit = 2, nodeLimit }) -> { count, solution, aborted }

const ALL = 0x3fe; // bits 1..9
const bit = v => 1 << v;
const popcount = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
const lowestDigit = m => 31 - Math.clz32(m & -m);
const digitsOf = m => { const out = []; for (let v = 1; v <= 9; v++) if (m & bit(v)) out.push(v); return out; };
const idx = ([r, c]) => r * 9 + c;

function maskMin(m) { return lowestDigit(m); }
function maskMax(m) { return 31 - Math.clz32(m); }
// Mask of digits in [lo, hi].
function rangeMask(lo, hi) {
  lo = Math.max(1, lo); hi = Math.min(9, hi);
  if (lo > hi) return 0;
  return ((1 << (hi + 1)) - 1) & ~((1 << lo) - 1);
}

// Every set of `n` distinct digits summing to `sum`, as bitmasks.
const comboCache = new Map();
function cageCombos(n, sum) {
  const key = `${n},${sum}`;
  if (comboCache.has(key)) return comboCache.get(key);
  const out = [];
  (function rec(start, left, count, mask) {
    if (count === n) { if (left === 0) out.push(mask); return; }
    for (let d = start; d <= 9 && d <= left; d++) rec(d + 1, left - d, count + 1, mask | bit(d));
  })(1, sum, 0, 0);
  comboCache.set(key, out);
  return out;
}

function buildModel(entry) {
  const houses = [];
  for (let r = 0; r < 9; r++) houses.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) houses.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const br = Math.floor(b / 3) * 3, bc = (b % 3) * 3;
    const h = [];
    for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) h.push((br + dr) * 9 + bc + dc);
    houses.push(h);
  }
  // diagonals: true (both), "main" (top-left to bottom-right) or "anti".
  if (entry.diagonals === true || entry.diagonals === 'main') houses.push(Array.from({ length: 9 }, (_, i) => i * 9 + i));
  if (entry.diagonals === true || entry.diagonals === 'anti') houses.push(Array.from({ length: 9 }, (_, i) => i * 9 + 8 - i));
  // Cages act as extra "all different" groups too.
  const cages = (entry.cages || []).map(c => ({ cells: c.cells.map(idx), sum: c.sum == null ? null : c.sum }));

  const peers = Array.from({ length: 81 }, () => new Set());
  const addGroup = cells => {
    for (const a of cells) for (const b of cells) if (a !== b) peers[a].add(b);
  };
  houses.forEach(addGroup);
  cages.forEach(c => addGroup(c.cells));
  if (entry.antiKnight) {
    const K = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      for (const [dr, dc] of K) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < 9 && cc >= 0 && cc < 9) peers[r * 9 + c].add(rr * 9 + cc);
      }
    }
  }

  // Pairwise relations: fn(a, b) -> allowed. Stored as a 10x10 table.
  const pairs = [];
  const addPair = (a, b, ok) => {
    const table = [];
    for (let x = 0; x <= 9; x++) { table.push([]); for (let y = 0; y <= 9; y++) table[x].push(x > 0 && y > 0 && ok(x, y)); }
    pairs.push({ a, b, table });
  };
  const consecutive = (x, y) => Math.abs(x - y) === 1;
  const ratio = (x, y) => x === 2 * y || y === 2 * x;
  const dotted = new Set();
  for (const dot of entry.kropki || []) {
    const a = idx(dot.a), b = idx(dot.b);
    dotted.add(`${Math.min(a, b)}-${Math.max(a, b)}`);
    addPair(a, b, dot.kind === 'white' ? consecutive : ratio);
  }
  if (entry.kropkiNegative) {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      for (const [nr, nc] of [[r, c + 1], [r + 1, c]]) {
        if (nr > 8 || nc > 8) continue;
        const a = r * 9 + c, b = nr * 9 + nc;
        if (dotted.has(`${a}-${b}`)) continue;
        addPair(a, b, (x, y) => !consecutive(x, y) && !ratio(x, y));
      }
    }
  }
  for (const xv of entry.xv || []) {
    const target = xv.kind === 'X' ? 10 : 5;
    addPair(idx(xv.a), idx(xv.b), (x, y) => x + y === target);
  }

  const sums = []; // { cells, total: number | cellIndex (arrow circle) , distinct:false }
  const thermos = [];
  const renbans = [];
  for (const line of entry.lines || []) {
    const cells = line.cells.map(idx);
    if (line.kind === 'thermo') {
      thermos.push(cells);
      for (let i = 1; i < cells.length; i++) addPair(cells[i - 1], cells[i], (x, y) => x < y);
    } else if (line.kind === 'whispers') {
      for (let i = 1; i < cells.length; i++) addPair(cells[i - 1], cells[i], (x, y) => Math.abs(x - y) >= 5);
    } else if (line.kind === 'palindrome') {
      for (let i = 0; i < Math.floor(cells.length / 2); i++) addPair(cells[i], cells[cells.length - 1 - i], (x, y) => x === y);
    } else if (line.kind === 'renban') {
      renbans.push(cells);
      addGroup(cells);
    } else {
      throw new Error(`Unsupported line kind ${line.kind}`);
    }
  }
  for (const arrow of entry.arrows || []) {
    sums.push({ cells: arrow.cells.map(idx), circle: idx(arrow.circle) });
  }
  for (const lk of entry.littleKiller || []) {
    sums.push({ cells: lk.cells.map(idx), total: lk.sum });
  }

  const givens = new Array(81).fill(0);
  (entry.givens || []).forEach((row, r) => row.forEach((v, c) => { givens[r * 9 + c] = v || 0; }));
  const parity = new Array(81).fill(ALL);
  for (const clue of entry.oddEven || []) {
    parity[idx(clue.cell)] = clue.parity === 'odd' ? 0x2aa : 0x154;
  }

  const peerList = peers.map(s => [...s]);
  const cellPairs = Array.from({ length: 81 }, () => []);
  pairs.forEach((p, i) => { cellPairs[p.a].push(i); cellPairs[p.b].push(i); });

  const rowCells = houses.slice(0, 9), colCells = houses.slice(9, 18);
  const intersections = [];
  for (const line of houses.slice(0, 18)) {
    for (const box of houses.slice(18, 27)) {
      const overlap = line.filter(i => box.includes(i));
      if (overlap.length) {
        intersections.push({ overlap, lineRest: line.filter(i => !overlap.includes(i)), boxRest: box.filter(i => !overlap.includes(i)) });
      }
    }
  }
  return { rowCells, colCells, intersections, houses, cages, peerList, peerSets: peers, pairs, cellPairs, sums, thermos, renbans, givens, parity, sandwich: entry.sandwich || null };
}

// Filters candidate masks in `cand` to a fixpoint. Returns false on
// contradiction.
function propagate(model, cand) {
  const { houses, cages, peerList, pairs, sums, renbans, sandwich } = model;
  let changed = true;
  const set = (i, m) => {
    if (m === cand[i]) return true;
    cand[i] = m;
    changed = true;
    return m !== 0;
  };

  while (changed) {
    changed = false;

    // Naked singles eliminate from peers.
    for (let i = 0; i < 81; i++) {
      const m = cand[i];
      if (m === 0) return false;
      if ((m & (m - 1)) === 0) {
        for (const p of peerList[i]) {
          if (cand[p] & m) { if (!set(p, cand[p] & ~m)) return false; }
        }
      }
    }

    // Hidden singles in houses.
    for (const h of houses) {
      let seenOnce = 0, seenTwice = 0;
      for (const i of h) { seenTwice |= seenOnce & cand[i]; seenOnce |= cand[i]; }
      if ((seenOnce & ALL) !== ALL) return false;
      const unique = seenOnce & ~seenTwice;
      if (unique) {
        for (const i of h) {
          const u = cand[i] & unique;
          if (u && cand[i] !== u) {
            if (popcount(u) > 1) return false;
            if (!set(i, u)) return false;
          }
        }
      }
    }

    // Locked candidates: a digit confined to one box within a row/column
    // (or to one row/column within a box) is removed from the rest of the
    // other house.
    for (const { overlap, lineRest, boxRest } of model.intersections) {
      let inOverlap = 0, lineMask = 0, boxMask = 0;
      for (const i of overlap) inOverlap |= cand[i];
      for (const i of lineRest) lineMask |= cand[i];
      for (const i of boxRest) boxMask |= cand[i];
      const fromBox = inOverlap & ~lineMask;  // must be in overlap -> clear from box rest
      const fromLine = inOverlap & ~boxMask;  // must be in overlap -> clear from line rest
      if (fromBox & boxMask) {
        for (const i of boxRest) if (cand[i] & fromBox) { if (!set(i, cand[i] & ~fromBox)) return false; }
      }
      if (fromLine & lineMask) {
        for (const i of lineRest) if (cand[i] & fromLine) { if (!set(i, cand[i] & ~fromLine)) return false; }
      }
    }

    // Pair relations (arc consistency).
    for (const { a, b, table } of pairs) {
      let ma = 0, mb = 0;
      const A = cand[a], B = cand[b];
      for (let x = 1; x <= 9; x++) {
        if (!(A & bit(x))) continue;
        for (let y = 1; y <= 9; y++) {
          if ((B & bit(y)) && table[x][y]) { ma |= bit(x); mb |= bit(y); }
        }
      }
      if (!set(a, A & ma)) return false;
      if (!set(b, B & mb)) return false;
    }

    // Killer cages: restrict to digit sets that fit.
    for (const cage of cages) {
      if (cage.sum == null) continue;
      const n = cage.cells.length;
      let union = 0;
      for (const i of cage.cells) union |= cand[i];
      let allowed = 0;
      for (const combo of cageCombos(n, cage.sum)) {
        if ((combo & union) !== combo) continue;
        if (cage.cells.every(i => cand[i] & combo)) allowed |= combo;
      }
      if (!allowed) return false;
      for (const i of cage.cells) if (!set(i, cand[i] & allowed)) return false;
      let forced = ALL;
      for (const combo of cageCombos(n, cage.sum)) {
        if ((combo & allowed) === combo && cage.cells.every(i => cand[i] & combo)) forced &= combo;
      }
      for (const d of digitsOf(forced)) {
        let spot = -1, spots = 0;
        for (const i of cage.cells) if (cand[i] & bit(d)) { spot = i; spots++; }
        if (spots === 0) return false;
        if (spots === 1 && cand[spot] !== bit(d)) { if (!set(spot, bit(d))) return false; }
      }
    }

    // Renban: consecutive windows that fit. A window of n digits over n
    // distinct cells must use every one of its digits, so each digit in it
    // needs some cell that can still hold it.
    for (const cells of renbans) {
      const n = cells.length;
      let allowed = 0, forced = ALL;
      let union = 0;
      for (const i of cells) union |= cand[i];
      for (let lo = 1; lo + n - 1 <= 9; lo++) {
        const w = rangeMask(lo, lo + n - 1);
        if ((union & w) === w && cells.every(i => cand[i] & w)) { allowed |= w; forced &= w; }
      }
      if (!allowed) return false;
      for (const i of cells) if (!set(i, cand[i] & allowed)) return false;
      if (forced) {
        // Digits in every possible window must appear: hidden singles.
        for (const d of digitsOf(forced)) {
          let spot = -1, spots = 0;
          for (const i of cells) if (cand[i] & bit(d)) { spot = i; spots++; }
          if (spots === 0) return false;
          if (spots === 1 && cand[spot] !== bit(d)) { if (!set(spot, bit(d))) return false; }
        }
      }
    }

    // Arrows / little killers: exact enumeration when the candidate space is
    // small, otherwise bounds reasoning (repeats allowed unless cells see
    // each other).
    for (const s of sums) {
      let space = 1;
      for (const i of s.cells) space *= popcount(cand[i]);
      if (s.circle != null) space *= popcount(cand[s.circle]);
      if (space <= 4096) {
        const n = s.cells.length;
        const seen = new Array(n).fill(0);
        let circleSeen = 0;
        const vals = new Array(n);
        const targetMask = s.circle != null ? cand[s.circle] : null;
        (function rec(k, total) {
          if (k === n) {
            if (s.circle != null) {
              if (total <= 9 && (targetMask & bit(total))) {
                circleSeen |= bit(total);
                for (let j = 0; j < n; j++) seen[j] |= bit(vals[j]);
              }
            } else if (total === s.total) {
              for (let j = 0; j < n; j++) seen[j] |= bit(vals[j]);
            }
            return;
          }
          const cell = s.cells[k];
          for (const v of digitsOf(cand[cell])) {
            let clash = false;
            for (let j = 0; j < k; j++) {
              if (vals[j] === v && model.peerSets[s.cells[j]].has(cell)) { clash = true; break; }
            }
            if (clash) continue;
            vals[k] = v;
            rec(k + 1, total + v);
          }
        })(0, 0);
        if (s.circle != null && !set(s.circle, cand[s.circle] & circleSeen)) return false;
        for (let j = 0; j < n; j++) if (!set(s.cells[j], cand[s.cells[j]] & seen[j])) return false;
        continue;
      }
      let lo = 0, hi = 0;
      for (const i of s.cells) { lo += maskMin(cand[i]); hi += maskMax(cand[i]); }
      let tLo, tHi;
      if (s.circle != null) {
        const cm = cand[s.circle] & rangeMask(lo, hi);
        if (!set(s.circle, cm)) return false;
        tLo = maskMin(cm); tHi = maskMax(cm);
      } else {
        tLo = tHi = s.total;
        if (s.total < lo || s.total > hi) return false;
      }
      for (const i of s.cells) {
        const m = cand[i];
        const othersLo = lo - maskMin(m), othersHi = hi - maskMax(m);
        const nm = m & rangeMask(tLo - othersHi, tHi - othersLo);
        if (!set(i, nm)) return false;
      }
    }

    // Sandwich: try every placement of the 1 and 9 still possible, keep
    // those whose in-between cells can reach the clue (distinct digits
    // 2-8), and strip 1/9 from positions no surviving placement uses.
    if (sandwich) {
      const minDistinct = n => (n * (n + 3)) / 2;          // 2+3+...
      const maxDistinct = n => (n * (17 - n)) / 2;         // 8+7+...
      const prune = (cells, clue) => {
        if (clue == null) return true;
        let ok1 = 0, ok9 = 0; // bitmasks over positions 0..8
        for (let a = 0; a < 9; a++) {
          for (let b = 0; b < 9; b++) {
            if (a === b) continue;
            if (!(cand[cells[a]] & bit(1)) || !(cand[cells[b]] & bit(9))) continue;
            const lo = Math.min(a, b), hi = Math.max(a, b);
            const n = hi - lo - 1;
            if (clue < minDistinct(n) || clue > maxDistinct(n)) continue;
            let sLo = 0, sHi = 0, feasible = true;
            for (let k = lo + 1; k < hi; k++) {
              const m = cand[cells[k]] & 0x1fc; // digits 2..8
              if (!m) { feasible = false; break; }
              sLo += maskMin(m); sHi += maskMax(m);
            }
            if (!feasible || clue < sLo || clue > sHi) continue;
            ok1 |= 1 << a; ok9 |= 1 << b;
          }
        }
        if (!ok1 || !ok9) return false;
        for (let k = 0; k < 9; k++) {
          let m = cand[cells[k]];
          if (!(ok1 & (1 << k))) m &= ~bit(1);
          if (!(ok9 & (1 << k))) m &= ~bit(9);
          if (!set(cells[k], m)) return false;
        }
        return true;
      };
      for (let r = 0; r < 9; r++) {
        if (!prune(model.rowCells[r], (sandwich.rows || [])[r])) return false;
      }
      for (let c = 0; c < 9; c++) {
        if (!prune(model.colCells[c], (sandwich.cols || [])[c])) return false;
      }
    }
  }
  return true;
}

function countSolutions(entry, { limit = 2, nodeLimit = 2_000_000 } = {}) {
  const model = buildModel(entry);
  const cand = new Array(81);
  for (let i = 0; i < 81; i++) {
    cand[i] = model.givens[i] ? bit(model.givens[i]) & model.parity[i] : model.parity[i];
  }
  let count = 0, solution = null, nodes = 0, aborted = false;

  function search(state) {
    if (aborted) return;
    if (++nodes > nodeLimit) { aborted = true; return; }
    if (!propagate(model, state)) return;
    // Branch on whichever is narrowest: a cell's candidates, or the
    // positions left for a digit in a house.
    let best = -1, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      const pc = popcount(state[i]);
      if (pc > 1 && pc < bestCount) { best = i; bestCount = pc; if (pc === 2) break; }
    }
    if (best < 0) {
      count++;
      if (!solution) solution = state.map(m => lowestDigit(m));
      return;
    }
    let bestHouse = null, bestDigit = 0;
    if (bestCount > 2) {
      for (const h of model.houses) {
        for (let d = 1; d <= 9; d++) {
          let spots = 0, solved = false;
          for (const i of h) {
            if (state[i] & bit(d)) { spots++; if (state[i] === bit(d)) solved = true; }
          }
          if (!solved && spots > 1 && spots < bestCount) { bestCount = spots; bestHouse = h; bestDigit = d; }
        }
        if (bestCount === 2) break;
      }
    }
    if (bestHouse) {
      for (const i of bestHouse) {
        if (!(state[i] & bit(bestDigit))) continue;
        const next = state.slice();
        next[i] = bit(bestDigit);
        search(next);
        if (count >= limit || aborted) return;
      }
      return;
    }
    for (const v of digitsOf(state[best])) {
      const next = state.slice();
      next[best] = bit(v);
      search(next);
      if (count >= limit || aborted) return;
    }
  }
  search(cand);

  const grid = solution ? Array.from({ length: 9 }, (_, r) => solution.slice(r * 9, r * 9 + 9)) : null;
  return { count, solution: grid, aborted, nodes };
}

// Proves `solution` is the only solution, cell by cell: forbid a cell's
// solution digit and search for any grid at all. If none exists, every
// solution has that digit there, so it can be fixed as a given for the
// remaining proofs. Solving order tends to follow logical order, so later
// proofs get cheap quickly. Node budgets escalate only for cells that
// resist, rather than one giant exhaustive search.
//
// -> { unique: true } | { unique: false, other } | { aborted: true }
function proveUnique(entry, solution, { maxNodes = 3_000_000 } = {}) {
  const model = buildModel(entry);
  const flat = solution.flat();
  const fixed = model.givens.slice();
  for (let i = 0; i < 81; i++) if (fixed[i] && fixed[i] !== flat[i]) return { unique: false, other: null, invalid: true };
  // The proof only means something if `solution` itself satisfies every rule.
  if (!propagate(model, flat.map((v, i) => bit(v) & model.parity[i]))) return { unique: false, other: null, invalid: true };

  let totalNodes = 0;
  let budget = 200;
  while (true) {
    let progress = false;
    let pending = false;
    for (let i = 0; i < 81; i++) {
      if (fixed[i]) continue;
      const cand = new Array(81);
      for (let k = 0; k < 81; k++) cand[k] = fixed[k] ? bit(fixed[k]) & model.parity[k] : model.parity[k];
      cand[i] &= ~bit(flat[i]);
      if (!cand[i]) { fixed[i] = flat[i]; progress = true; continue; }

      let nodes = 0, found = null, aborted = false;
      const search = state => {
        if (found || aborted) return;
        if (++nodes > budget) { aborted = true; return; }
        if (!propagate(model, state)) return;
        let best = -1, bestCount = 10;
        for (let k = 0; k < 81; k++) {
          const pc = popcount(state[k]);
          if (pc > 1 && pc < bestCount) { best = k; bestCount = pc; if (pc === 2) break; }
        }
        if (best < 0) { found = state.map(m => lowestDigit(m)); return; }
        for (const v of digitsOf(state[best])) {
          const next = state.slice();
          next[best] = bit(v);
          search(next);
          if (found || aborted) return;
        }
      };
      search(cand);
      totalNodes += nodes;
      if (found) {
        return { unique: false, other: Array.from({ length: 9 }, (_, r) => found.slice(r * 9, r * 9 + 9)), nodes: totalNodes };
      }
      if (aborted) {
        pending = true;
        if (totalNodes > maxNodes) return { aborted: true, nodes: totalNodes };
        continue;
      }
      fixed[i] = flat[i];
      progress = true;
    }
    if (!pending) return { unique: true, nodes: totalNodes };
    if (totalNodes > maxNodes) return { aborted: true, nodes: totalNodes };
    if (!progress) budget *= 6;
  }
}

module.exports = { countSolutions, proveUnique };
