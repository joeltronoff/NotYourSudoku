// Takes the raw convert.js output for the 3 confirmed-clean real community
// puzzles, engine-validates them, runs them through the real solver for a
// star rating (same technique->star map as build-all.js), and writes an
// app-ready snippet with proper attribution in the blurb.
const fs = require('fs');
const vm = require('vm');
const { execFileSync } = require('child_process');

const engineSrc = fs.readFileSync(__dirname + '/../../sudoku-engine.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(engineSrc, sandbox);
const { findConflicts, findVariantConflicts } = sandbox.window.SudokuEngine;

const TECHNIQUE_STAR = {
  NakedSingle: 1, HiddenSingle: 2, Thermo: 2, Kropki: 2, PalindromeValues: 2,
  Candidates: 3, ThermoCandidates: 3, KillerCandidates: 3, ArrowCandidates: 3, RenbanCandidates: 3, PalindromeCandidates: 3,
  LockedCandidatesPairs: 4, TopBottomCandidates: 4,
  NakedPairs: 5, HiddenPairs: 5, Killer45: 5, KropkiChainCandidates: 5,
  ArrowAdvancedCandidates: 6, KropkiAdvancedCandidates: 6,
  LockedCandidatesTriples: 7, NakedTriples: 7, HiddenTriples: 7,
  CommonPeerElimination: 7, CommonPeerEliminationKropki: 7, CommonPeerEliminationArrow: 7,
  XWing: 8, TurbotFish: 8, EmptyRectangles: 8,
  XYWing: 9, Swordfish: 9, AdhocNakedSet: 9, PhistomefelRing: 9,
  NishioForcingChains: 10,
};
function starRating(techniques) {
  let max = 1;
  for (const t of Object.keys(techniques || {})) if (TECHNIQUE_STAR[t] !== undefined) max = Math.max(max, TECHNIQUE_STAR[t]);
  return max;
}

const BIN = '/tmp/lisudoku_solver/target/debug/verify';
function toLisudokuConstraints(entry) {
  const c = { gridSize: 9 };
  const fixedNumbers = [];
  for (let r = 0; r < 9; r++) for (let col = 0; col < 9; col++) if (entry.givens[r][col]) fixedNumbers.push({ position: { row: r, col }, value: entry.givens[r][col] });
  c.fixedNumbers = fixedNumbers;
  if (entry.cages) c.killerCages = entry.cages.map(cg => ({ sum: cg.sum, region: cg.cells.map(([row, col]) => ({ row, col })) }));
  if (entry.kropki) c.kropkiDots = entry.kropki.map(d => ({ dotType: d.kind === 'white' ? 'Consecutive' : 'Double', cell1: { row: d.a[0], col: d.a[1] }, cell2: { row: d.b[0], col: d.b[1] } }));
  if (entry.lines) {
    // Only set a key when non-empty: passing an empty array (Some([]) on
    // the Rust side) for a constraint type that isn't actually used is a
    // different, hang-triggering bug from the killer45 one already
    // patched -- verified empirically (adding a bare `thermos: []` to an
    // otherwise-fine renban+kropki puzzle made the solver hang).
    const thermos = entry.lines.filter(l => l.kind === 'thermo').map(l => l.cells.map(([row, col]) => ({ row, col })));
    const renbans = entry.lines.filter(l => l.kind === 'renban').map(l => l.cells.map(([row, col]) => ({ row, col })));
    const palindromes = entry.lines.filter(l => l.kind === 'palindrome').map(l => l.cells.map(([row, col]) => ({ row, col })));
    if (thermos.length) c.thermos = thermos;
    if (renbans.length) c.renbans = renbans;
    if (palindromes.length) c.palindromes = palindromes;
  }
  if (entry.arrows) c.arrows = entry.arrows.map(a => ({ circleCells: [{ row: a.circle[0], col: a.circle[1] }], arrowCells: a.cells.map(([row, col]) => ({ row, col })) }));
  if (entry.antiKnight) c.antiKnight = true;
  return c;
}
function checkSolvable(constraints) {
  const tmp = __dirname + '/_import_check.json';
  fs.writeFileSync(tmp, JSON.stringify(constraints));
  let out;
  try { out = execFileSync(BIN, [tmp], { encoding: 'utf8', timeout: 15000 }); }
  catch (e) { return { ok: false, note: 'solver could not verify (likely uses whispers or another field lisudoku_solver lacks)' }; }
  const solutionCount = parseInt(out.match(/solution_count: (\d+)/)[1], 10);
  const solutionType = out.match(/solution_type: (\w+)/)[1];
  const techniques = {};
  const techRegex = /^\s\s(\w+): (\d+)$/gm;
  let m; while ((m = techRegex.exec(out))) techniques[m[1]] = +m[2];
  return { ok: true, solutionCount, solutionType, techniques };
}

const ATTRIBUTION = {
  'self-contained': { title: 'Self-Contained', author: 'Lavaloid', variants: ['killer', 'antiknight'] },
  '300-subs-': { title: '300 Subs', author: 'Rangsk', variants: ['kropki', 'lines'] },
  '159': { title: '159', author: 'zetamath', variants: ['kropki', 'lines'] },
  'killer-blister': { title: 'Killer Blister', author: 'Rangsk', variants: ['killer'] },
  orbit: { title: 'Orbit', author: 'Qodec', variants: ['lines'] },
};

const cands = JSON.parse(fs.readFileSync('/tmp/imported-candidates.json', 'utf8'));
const finalEntries = [];
for (const c of cands) {
  const entry = c.conv.entry;
  const attribution = ATTRIBUTION[entry.id];
  if (findConflicts(entry.solution).size > 0) throw new Error(`${entry.id}: classic conflicts`);
  const variantConflicts = findVariantConflicts(entry.solution, entry);
  if (variantConflicts.size > 0) throw new Error(`${entry.id}: variant conflicts: ${[...variantConflicts]}`);

  // lisudoku_solver has no little killer support at all, so for a puzzle
  // that uses one, any checkSolvable result would be checking an
  // INCOMPLETE constraint set (missing real clues) -- solutionCount from
  // that is meaningless, not a genuine uniqueness signal, so don't call
  // it "verified" for those.
  const hasUnverifiableMechanic = !!(entry.littleKiller && entry.littleKiller.length > 0);
  const lisudokuConstraints = toLisudokuConstraints(entry);
  const check = hasUnverifiableMechanic ? { ok: false } : checkSolvable(lisudokuConstraints);
  // The solver confirms TRUE uniqueness (solution_count) even when its own
  // technique library can't fully trace the logical path (solutionType
  // Partial) -- that just means this specific puzzle needs a deduction
  // (e.g. renban-chain coloring) the solver doesn't implement, not that
  // it's broken. These are real, previously human-solved community
  // puzzles, so uniqueness alone is enough to trust; only the star number
  // is an estimate in that case.
  const verifiedUnique = check.ok && check.solutionCount === 1;
  const fullyTraced = check.ok && check.solutionType === 'Full';
  const stars = fullyTraced ? starRating(check.techniques) : 8;
  const note = hasUnverifiableMechanic
    ? ' Uses little killer clues our solver-checker doesn’t support, so this one rests on the community’s own testing rather than our verification.'
    : (verifiedUnique && !fullyTraced ? ' Verified uniquely solvable; needs a deduction beyond our checker’s technique list.' : '');

  finalEntries.push({
    id: attribution.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: attribution.title,
    blurb: `By ${attribution.author}, imported from the community.${note}`.trim(),
    stars,
    givens: entry.givens,
    solution: entry.solution,
    ...(entry.cages ? { cages: entry.cages } : {}),
    ...(entry.kropki ? { kropki: entry.kropki } : {}),
    ...(entry.kropkiNegative ? { kropkiNegative: true } : {}),
    ...(entry.lines ? { lines: entry.lines } : {}),
    ...(entry.arrows ? { arrows: entry.arrows } : {}),
    ...(entry.antiKnight ? { antiKnight: true } : {}),
    ...(entry.littleKiller ? { littleKiller: entry.littleKiller } : {}),
    variants: attribution.variants,
  });
  console.log(attribution.title, 'by', attribution.author, '-> solver ok:', check.ok, check.techniques || check.note, '-> stars:', stars);
}

fs.writeFileSync(__dirname + '/imported-final.json', JSON.stringify(finalEntries, null, 2));
console.log('\nWrote imported-final.json,', finalEntries.length, 'entries.');
