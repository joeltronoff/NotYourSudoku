// Step 1: pull the fan-maintained Cracking the Cryptic Catalogue (a public
// Google Sheet, one row per video) and keep only sudoku videos whose
// constraint tags are all rules Solver's Notebook can actually enforce.
//
// Output: candidates.json

const fs = require('fs');
const path = require('path');
const { cachedFetch, parseCsv, prepareZipper } = require('./lib');

const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/1rVqAjm-l_Urjd3TNmIc3SmTmz_OlgSoBuhY7RPgiuRg/export?format=csv&gid=725349095';

// Catalogue constraint tag -> our variant key. Tags not listed here make the
// video ineligible. (Consecutive/Difference/Ratio are the catalogue's names
// for kropki-style dots; the converter re-checks the real dot semantics.)
const SUPPORTED_TAGS = {
  'Classic': null,
  'Killer': 'killer',
  'Kropki': 'kropki',
  'Consecutive': 'kropki',
  'Difference': 'kropki',
  'Ratio': 'kropki',
  'Arrow': 'lines',
  'Thermo': 'lines',
  'German Whispers': 'lines',
  'Renban': 'lines',
  'Palindrome': 'lines',
  'Little Killer': 'lines',
  'Anti-Knight': 'antiknight',
  'Sandwich': 'sandwich',
  'XV': 'xv',
  'Diagonal': 'diagonal',
  'O/E': 'oddeven',
};

async function main() {
  const refresh = process.argv.includes('--refresh');
  const cacheFile = path.join(__dirname, 'cache', 'catalogue', 'catalogue.csv');
  if (refresh && fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);

  await prepareZipper();
  const { body, error } = await cachedFetch('catalogue', 'catalogue.csv', SHEET_CSV);
  if (!body) throw new Error(`Catalogue download failed: ${error}`);

  const rows = parseCsv(body);
  const headerIdx = rows.findIndex(r => r.includes('Link YT') && r.includes('Puzzle Title'));
  const header = rows[headerIdx];
  const col = name => header.indexOf(name);
  const C = {
    videoTitle: col('Video Title'), link: col('Link YT'), date: col('Date'),
    supercat: col('Supercat'), constraints: col('Puzzle Sub-Type / Constraints'),
    puzzleTitle: col('Puzzle Title'), setter: col('Setter'), source: col('Source'), serial: col('Sr. No.'), minutes: col('Time (m)'),
  };

  const candidates = [];
  for (const r of rows.slice(headerIdx + 1)) {
    if (r[C.supercat] !== 'Sudoku') continue;
    const tags = r[C.constraints].split(';').map(s => s.trim()).filter(Boolean);
    if (tags.length === 0 || !tags.every(t => t in SUPPORTED_TAGS)) continue;
    const m = (r[C.link] || '').match(/[?&]v=([\w-]{11})/) || (r[C.link] || '').match(/youtu\.be\/([\w-]{11})/);
    if (!m) continue;
    candidates.push({
      serial: r[C.serial],
      videoId: m[1],
      videoTitle: r[C.videoTitle],
      date: r[C.date],
      puzzleTitle: r[C.puzzleTitle],
      setter: r[C.setter],
      source: r[C.source],
      minutes: parseFloat(r[C.minutes]) || null,
      tags,
    });
  }

  fs.writeFileSync(path.join(__dirname, 'candidates.json'), JSON.stringify(candidates, null, 1));
  console.log(`${candidates.length} candidate videos written to candidates.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
