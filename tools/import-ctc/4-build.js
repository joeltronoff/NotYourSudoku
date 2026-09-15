// Step 4: convert every fetched payload, verify it, and write the survivors
// to /puzzles-ctc.js.
//
// A puzzle is imported only if ALL of these hold:
//   1. The converter recognised every element of the drawing (convert.js).
//   2. Our solver finds exactly one solution under the app's rules.
//   3. That solution equals the setter's own published solution -- or, for
//      the few older puzzles that shipped without one, the rules text (or
//      catalogue tags, if there's no rules text) covers everything detected.
//   4. The app's own conflict checker (sudoku-engine.js) accepts it.
//   5. It isn't a duplicate of a puzzle already in the library.
//
// Usage: node 4-build.js [--limit N] [--only videoId]
// Output: ../../puzzles-ctc.js, report.json

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { decodePayload, cachedFetch, CACHE_DIR, ensureDir } = require('./lib');
const { convertPayload } = require('./convert');
const { countSolutions, proveUnique } = require('./solver');
const { loadApp, appAcceptsSolution, ROOT } = require('./app-engine');

const { engine, library } = loadApp();

const CODE_VERSION = crypto.createHash('sha1')
  .update(['convert.js', 'solver.js', 'app-engine.js', '../../sudoku-engine.js'].map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n'))
  .digest('hex');

const TAG_KINDS = {
  Killer: ['killer'], Kropki: ['kropkiWhite', 'kropkiBlack'], Consecutive: ['kropkiWhite'],
  Difference: ['kropkiWhite'], Ratio: ['kropkiBlack'], Arrow: ['arrow'], Thermo: ['thermo'],
  'German Whispers': ['whispers'], Renban: ['renban'], Palindrome: ['palindrome'],
  'Little Killer': ['littleKiller'], 'Anti-Knight': ['antiKnight'], Sandwich: ['sandwich'],
  XV: ['xv'], Diagonal: ['diagonal'], 'O/E': ['odd', 'even'],
};

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

// Video length is a decent difficulty proxy: it's how long an expert took.
function starsFromMinutes(min) {
  if (!min) return 6;
  const bands = [[12, 2], [18, 3], [25, 4], [33, 5], [42, 6], [55, 7], [70, 8], [95, 9]];
  for (const [limit, stars] of bands) if (min <= limit) return stars;
  return 10;
}

// GAS puzzles come with a "one hat" target time; they're all approachable.
function starsFromGasMinutes(min) {
  if (!min) return 2;
  if (min <= 8) return 1;
  if (min <= 13) return 2;
  if (min <= 20) return 3;
  return 4;
}

function variantsOf(entry) {
  const v = [];
  if (entry.cages) v.push('killer');
  if (entry.kropki) v.push('kropki');
  if (entry.lines || entry.arrows || entry.littleKiller) v.push('lines');
  if (entry.antiKnight) v.push('antiknight');
  if (entry.sandwich) v.push('sandwich');
  if (entry.xv) v.push('xv');
  if (entry.diagonals) v.push('diagonal');
  if (entry.oddEven) v.push('oddeven');
  if (v.length === 0) v.push('classic');
  return v;
}

function detectedKinds(entry) {
  const k = new Set();
  if (entry.cages) k.add('killer');
  for (const d of entry.kropki || []) k.add(d.kind === 'white' ? 'kropkiWhite' : 'kropkiBlack');
  for (const l of entry.lines || []) k.add(l.kind);
  if (entry.arrows) k.add('arrow');
  if (entry.littleKiller) k.add('littleKiller');
  if (entry.antiKnight) k.add('antiKnight');
  if (entry.sandwich) k.add('sandwich');
  if (entry.xv) k.add('xv');
  if (entry.diagonals) k.add('diagonal');
  for (const o of entry.oddEven || []) k.add(o.parity);
  return k;
}

const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MONTHS = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' };
function monthYear(date) {
  const m = String(date || '').match(/^\d+-([A-Za-z]{3})-(\d{4})$/);
  return m ? `${MONTHS[m[1]] || m[1]} ${m[2]}` : '';
}

function gridKey(entry) {
  return JSON.stringify([entry.solution, entry.givens]);
}

// Converts and fully verifies one chosen puzzle payload.
// -> { entry, conv } (entry.solution filled in) | { error }
async function verify(chosen, tags) {
  let raw;
  if (chosen.ref.inline) raw = chosen.ref.inline;
  else raw = (await cachedFetch('pad', chosen.ref.id, `https://sudokupad.app/api/puzzle/${chosen.ref.id}`)).body;
  if (!raw) return { error: 'payload missing' };

  // Verification is expensive (some proofs take a minute), so results are
  // cached per payload + tags, keyed by the code that produced them.
  const cacheFile = path.join(CACHE_DIR, 'verify', crypto.createHash('sha1').update(`${CODE_VERSION}|${tags.join(';')}|${raw}`).digest('hex'));
  if (fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  const result = await verifyUncached(raw, tags);
  ensureDir(path.dirname(cacheFile));
  fs.writeFileSync(cacheFile, JSON.stringify(result));
  return result;
}

async function verifyUncached(raw, tags) {
  let decoded;
  try { decoded = decodePayload(raw); } catch (e) { return { error: `decode failed` }; }

  const tagKinds = new Set(tags.flatMap(t => TAG_KINDS[t] || []));
  const conv = convertPayload(decoded, { tagAllows: kind => tagKinds.has(kind) });
  if (conv.error) return { error: conv.error };
  const { entry, rules, solution: setterSolution } = conv;

  if (!setterSolution) {
    // Without the setter's answer we can't catch a misread rule by its
    // wrong answer, so insist the stated rules/tags cover what we found.
    const kinds = detectedKinds(entry);
    if (!rules) {
      const missing = [...kinds].filter(k => !tagKinds.has(k));
      if (missing.length) { return { error: `no solution/rules and tags don't cover ${missing.join(',')}` }; }
    }
  }

  if (setterSolution && !appAcceptsSolution(engine, { ...entry, solution: setterSolution }, setterSolution)) {
    return { error: 'setter solution breaks an inferred constraint' };
  }

  let result = countSolutions(entry, { limit: 2, nodeLimit: 500000 });
  if (result.aborted && setterSolution) {
    // Fall back to proving the setter's answer unique cell by cell.
    const proof = proveUnique(entry, setterSolution, { maxNodes: 2500000 });
    if (proof.unique) result = { count: 1, solution: setterSolution };
    else if (proof.other) result = { count: 2, solution: setterSolution };
  }
  if (result.aborted) { return { error: 'solver gave up (too slow)' }; }
  if (result.count === 0) { return { error: 'no solution under app rules' }; }
  if (result.count > 1) { return { error: 'multiple solutions under app rules (setter rule not captured?)' }; }
  if (setterSolution && JSON.stringify(result.solution) !== JSON.stringify(setterSolution)) {
    return { error: 'unique solution differs from setter solution' };
  }
  entry.solution = result.solution;
  if (!appAcceptsSolution(engine, entry, entry.solution)) { return { error: 'app conflict checker rejects solution' }; }

  return { entry, conv: { title: conv.title, author: conv.author } };
}

async function main() {
  const fetched = JSON.parse(fs.readFileSync(path.join(__dirname, argValue('--fetched') || 'fetched.json'), 'utf8'));
  const candidates = new Map(JSON.parse(fs.readFileSync(path.join(__dirname, 'candidates.json'), 'utf8')).map(c => [`${c.videoId}|${c.serial}`, c]));
  const only = argValue('--only');
  const limit = parseInt(argValue('--limit') || fetched.length, 10);

  const seen = new Set(library.map(gridKey));
  const videoRowCounts = new Map();
  fetched.forEach(v => videoRowCounts.set(v.videoId, (videoRowCounts.get(v.videoId) || 0) + 1));
  const imported = [];
  const report = [];
  const reasons = {};
  const bump = r => { const key = r.replace(/\[[^\]]*\]|"[^"]*"|\d+ options|#[0-9a-f]+/gi, '…'); reasons[key] = (reasons[key] || 0) + 1; };

  // Oldest first, so a puzzle featured twice keeps its original video.
  const queue = fetched.slice(0, limit).filter(v => !only || v.videoId === only).reverse();
  for (const [n, video] of queue.entries()) {
    const cand = candidates.get(`${video.videoId}|${video.serial}`) || video;
    const done = reason => { report.push({ videoId: video.videoId, title: video.puzzleTitle, result: reason }); if (reason !== 'imported') bump(reason); };
    if (!video.chosen) { done(video.links.length ? 'no decodable puzzle link' : 'no puzzle link in description'); continue; }

    const v = await verify(video.chosen, cand.tags);
    if (v.error) { done(v.error); continue; }
    const { entry, conv } = v;

    const key = gridKey(entry);
    if (seen.has(key)) { done('duplicate of an existing puzzle'); continue; }
    seen.add(key);

    const title = (cand.puzzleTitle || conv.title || video.videoTitle || 'Untitled').trim();
    const setter = (cand.setter || conv.author || '').trim();
    const when = monthYear(cand.date);
    const givenCount = entry.givens.flat().filter(Boolean).length;
    imported.push({
      // A video that features several puzzles has one catalogue row each.
      id: videoRowCounts.get(video.videoId) > 1 ? `ctc-${video.videoId}-${cand.serial}` : `ctc-${video.videoId}`,
      title: escapeHtml(title),
      blurb: escapeHtml(`${setter ? `By ${setter}. ` : ''}Featured on Cracking the Cryptic${when ? ` (${when})` : ''}${givenCount ? ` — ${givenCount} given${givenCount === 1 ? '' : 's'}` : ' — no givens'}.`),
      stars: starsFromMinutes(cand.minutes),
      source: { video: `https://www.youtube.com/watch?v=${video.videoId}`, puzzle: video.chosen.url },
      ...entry,
      solution: entry.solution,
      variants: variantsOf(entry),
    });
    done('imported');
    if ((n + 1) % 100 === 0) console.log(`…${n + 1}/${queue.length}, ${imported.length} imported`);
  }

  // Newest first in the menu, same as the catalogue.
  imported.reverse();

  // GAS (Genuinely Approachable Sudoku) puzzles listed in video descriptions.
  // Imported after the featured puzzles so a featured one keeps its video
  // attribution if it's both.
  const gasSeen = new Set();
  const gasImported = [];
  const gasQueue = only ? [] : fetched.slice(0, limit).flatMap(v => (v.gas || []).map(g => ({ ...g, video: v })));
  gasQueue.sort((a, b) => b.number - a.number);
  for (const g of gasQueue) {
    if (gasSeen.has(g.number)) continue;
    gasSeen.add(g.number);
    const done = reason => { report.push({ videoId: g.video.videoId, gas: g.number, title: g.title, result: reason }); if (reason !== 'imported') bump(`GAS: ${reason}`); };
    const v = await verify(g.chosen, []);
    if (v.error) { done(v.error); continue; }
    const { entry } = v;
    const key = gridKey(entry);
    if (seen.has(key)) { done('duplicate of an existing puzzle'); continue; }
    seen.add(key);
    // Strip the "Oct. 10, 2023: " style date prefixes GAS titles often carry.
    const title = g.title.replace(/^[A-Z][a-z]{2,8}\.? \d{1,2},? \d{4,5}:\s*/, '').replace(/^\d{1,2}\/\d{1,2}\/\d{2}:\s*/, '') || 'Untitled';
    const givenCount = entry.givens.flat().filter(Boolean).length;
    gasImported.push({
      id: `ctc-gas-${g.number}`,
      title: escapeHtml(title),
      blurb: escapeHtml(`By ${g.setter}. Genuinely Approachable Sudoku #${g.number} from Cracking the Cryptic${givenCount ? ` — ${givenCount} given${givenCount === 1 ? '' : 's'}` : ' — no givens'}.`),
      stars: starsFromGasMinutes(g.oneHatMinutes),
      source: { video: `https://www.youtube.com/watch?v=${g.video.videoId}`, puzzle: g.chosen.url, gas: g.number },
      ...entry,
      solution: entry.solution,
      variants: variantsOf(entry),
    });
    done('imported');
  }
  console.log(`GAS: imported ${gasImported.length} of ${gasSeen.size}`);
  imported.push(...gasImported);

  // Generic titles ("Classic Sudoku", "Killer Sudoku"...) repeat a lot; add
  // the setter and/or month so list rows can be told apart.
  const titleCounts = new Map();
  imported.forEach(e => titleCounts.set(e.title, (titleCounts.get(e.title) || 0) + 1));
  for (const e of imported) {
    if (titleCounts.get(e.title) < 2) continue;
    const setter = (e.blurb.match(/^By (.+?)\. /) || [])[1];
    const when = (e.blurb.match(/\(([A-Z][a-z]+ \d{4})\)/) || [])[1] || (e.source.gas ? `GAS #${e.source.gas}` : '');
    const suffix = [setter, when].filter(Boolean).join(', ');
    if (suffix) e.title = `${e.title} (${suffix})`;
  }

  const allIds = new Set(library.map(e => e.id));
  for (const e of imported) {
    if (allIds.has(e.id)) throw new Error(`Duplicate puzzle id ${e.id}`);
    allIds.add(e.id);
  }
  const header = `// ============================================================
// Puzzles featured on Cracking the Cryptic, imported by tools/import-ctc.
// GENERATED FILE -- re-run that pipeline instead of editing by hand.
//
// Each puzzle belongs to its setter (credited in the blurb). Every entry
// was converted from the setter's SudokuPad/f-puzzles file and verified to
// have exactly one solution under this app's rules, matching the setter's
// own published solution wherever one was provided. Star ratings are
// derived from the length of the CTC video, not a technique analysis.
// ============================================================
`;
  const body = imported.map(e => `  ${JSON.stringify(e)}`).join(',\n');
  if (!only) {
    fs.writeFileSync(path.join(ROOT, 'puzzles-ctc.js'), `${header}\n(() => {\n window.PuzzleLibrary.push(\n${body}\n );\n})();\n`);
  }
  fs.writeFileSync(path.join(__dirname, only ? 'report-one.json' : 'report.json'), JSON.stringify({ reasons, report }, null, 1));

  const sorted = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  console.log(`\nImported ${imported.length} of ${queue.length}`);
  const byVariant = {};
  imported.forEach(e => e.variants.forEach(v => { byVariant[v] = (byVariant[v] || 0) + 1; }));
  console.log('by variant:', byVariant);
  console.log('rejection reasons:');
  sorted.slice(0, 40).forEach(([r, c]) => console.log(`  ${String(c).padStart(4)}  ${r}`));
}

main().catch(err => { console.error(err); process.exit(1); });
