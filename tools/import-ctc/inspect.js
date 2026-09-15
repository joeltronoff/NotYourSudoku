// Debug helper: show raw details for rejected puzzles.
// Usage: node inspect.js "<regex on rejection reason>" [count] [--full]

const fs = require('fs');
const path = require('path');
const { decodePayload } = require('./lib');

const [pattern, countArg] = process.argv.slice(2);
const full = process.argv.includes('--full');
const re = new RegExp(pattern || '.', 'i');
const report = JSON.parse(fs.readFileSync(path.join(__dirname, 'report.json'), 'utf8')).report;
const fetched = JSON.parse(fs.readFileSync(path.join(__dirname, 'fetched.json'), 'utf8'));
const s = (v, n = 300) => String(JSON.stringify(v)).slice(0, full ? 100000 : n);

for (const item of report.filter(x => re.test(x.result)).slice(0, Number(countArg) || 3)) {
  const video = fetched.find(v => v.videoId === item.videoId);
  console.log(`\n## ${item.title} | ${video.tags.join(';')} | ${item.videoId} => ${item.result}`);
  if (!video.chosen) continue;
  const raw = video.chosen.ref.inline
    || fs.readFileSync(path.join(__dirname, 'cache', 'pad', video.chosen.ref.id.replace(/[^A-Za-z0-9_.-]/g, '_')), 'utf8');
  const { format, puzzle: p } = decodePayload(raw);
  if (format === 'fpuzzles') {
    console.log('  [fpuzzles] rules:', s(p.ruleset));
    const keys = Object.keys(p).filter(k => !['size', 'grid', 'title', 'author', 'ruleset', 'solution'].includes(k));
    for (const k of keys) console.log(`  ${k}:`, s(p[k]));
  } else {
    const metaCage = (p.cages || []).find(c => typeof c.value === 'string' && /^rules/i.test(c.value));
    console.log('  [scl] rules:', s((p.metadata || {}).rules || (metaCage && metaCage.value)));
    for (const k of ['cages', 'lines', 'arrows', 'overlays', 'underlays']) if (p[k]) console.log(`  ${k}:`, s(p[k]));
  }
}
