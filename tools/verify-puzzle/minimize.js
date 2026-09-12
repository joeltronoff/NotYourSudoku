// Greedily strips entries from one array-valued field of a candidate
// puzzle (kropkiDots, fixedNumbers, killerCages, thermos, arrows, renbans,
// palindromes, ...) in a fixed shuffled order, keeping each removal only
// if the puzzle is still uniquely AND fully-logically solvable afterward
// without any banned (too-advanced) technique. Prints the final technique
// set so you can see exactly how hard the minimized puzzle really is.
//
// Usage: node minimize.js <input.json> <output.json> <fieldToStrip> [seed]
//
// Requires tools/verify-puzzle/verify.rs to be built as a binary inside a
// checkout of https://github.com/lisudoku/lisudoku_solver (see README.md).
const fs = require('fs');
const { execFileSync } = require('child_process');

const [, , inputPath, outputPath, field, seedArg] = process.argv;
if (!inputPath || !outputPath || !field) {
  console.error('Usage: node minimize.js <input.json> <output.json> <fieldToStrip> [seed]');
  process.exit(1);
}

const BIN = process.env.LISUDOKU_VERIFY_BIN || '/tmp/lisudoku_solver/target/debug/verify';

// Chains (Nishio Forcing Chains) are the one thing ruled out by default —
// everything up to and including X-Wing/XY-Wing/Swordfish/Turbot Fish/
// Empty Rectangles/Phistomefel Ring is still fair, elegant pure deduction.
// Edit this list to change what counts as "too hard" or "not elegant" for
// a given puzzle.
const BANNED_TECHNIQUES = ['NishioForcingChains'];

function checkSolvable(constraints) {
  const tmpFile = __dirname + '/_tmp_check.json';
  fs.writeFileSync(tmpFile, JSON.stringify(constraints));
  let out;
  try {
    out = execFileSync(BIN, [tmpFile], { encoding: 'utf8' });
  } catch (e) {
    return { ok: false, out: e.stdout || '' };
  }
  const solutionCount = parseInt(out.match(/solution_count: (\d+)/)[1], 10);
  const solutionType = out.match(/solution_type: (\w+)/)[1];
  const techniques = {};
  const techRegex = /^\s\s(\w+): (\d+)$/gm;
  let m;
  while ((m = techRegex.exec(out))) techniques[m[1]] = parseInt(m[2], 10);
  const usesBanned = BANNED_TECHNIQUES.some(t => techniques[t]);
  return { ok: solutionCount === 1 && solutionType === 'Full' && !usesBanned, solutionCount, solutionType, techniques };
}

function seededShuffle(arr, seed) {
  const a = arr.slice();
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const base = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
let items = (base[field] || []).slice();
const order = seededShuffle([...items.keys()], parseInt(seedArg, 10) || 42);

console.log(`Starting ${field}:`, items.length);
let removed = 0;
for (const idx of order) {
  const key = JSON.stringify(items[idx]);
  const candidateItems = items.filter(d => JSON.stringify(d) !== key);
  const result = checkSolvable({ ...base, [field]: candidateItems });
  if (result.ok) {
    items = candidateItems;
    removed++;
  }
}
console.log('Removed:', removed, `-> remaining ${field}:`, items.length);

const final = { ...base, [field]: items };
fs.writeFileSync(outputPath, JSON.stringify(final, null, 2));

const finalCheck = checkSolvable(final);
console.log('Final check:', JSON.stringify(finalCheck, null, 2));
