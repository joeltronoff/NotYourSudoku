// Shared helpers for the import-ctc pipeline: polite cached HTTP, a small
// CSV parser, and SudokuPad payload decoding.

const fs = require('fs');
const path = require('path');
const LZString = require('lz-string');

const CACHE_DIR = path.join(__dirname, 'cache');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetches a URL as text, caching the body on disk under cache/<bucket>/<key>
// so re-runs never hit the network twice for the same resource. A cached
// empty file records a permanent miss (404 etc.) so it isn't retried either.
// `transform` (optional) reduces the body before it's cached -- e.g. keep
// only a YouTube description rather than the whole ~1MB watch page.
async function cachedFetch(bucket, key, url, { headers = {}, delayMs = 0, retries = 3, transform = null } = {}) {
  const dir = path.join(CACHE_DIR, bucket);
  ensureDir(dir);
  const file = path.join(dir, key.replace(/[^A-Za-z0-9_.-]/g, '_'));
  if (fs.existsSync(file)) return { body: fs.readFileSync(file, 'utf8'), cached: true };

  for (let attempt = 1; attempt <= retries; attempt++) {
    if (delayMs) await sleep(delayMs);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (solvers-notebook importer)', 'Accept-Language': 'en-US', ...headers },
        signal: AbortSignal.timeout(45000),
      });
      if (res.status === 404 || res.status === 410) {
        fs.writeFileSync(file, '');
        return { body: '', cached: false, status: res.status };
      }
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      let body = await res.text();
      if (transform) body = transform(body);
      if (body === null) throw new Error('transform rejected response');
      fs.writeFileSync(file, body);
      return { body, cached: false, status: res.status, finalUrl: res.url };
    } catch (err) {
      if (attempt === retries) return { body: null, error: String(err) };
      await sleep(3000 * attempt);
    }
  }
}

// RFC 4180-ish CSV parser (quoted fields, embedded newlines, doubled quotes).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// SudokuPad's own key-compression helper, fetched on demand into the cache
// rather than vendored (it's Sven Neumann's code, not ours to redistribute).
const ZIPPER_URL = 'https://sudokupad.app/puzzlezipper.js';
async function prepareZipper() {
  const { body } = await cachedFetch('vendor', 'puzzlezipper.js', ZIPPER_URL);
  if (!body) throw new Error('Could not download SudokuPad puzzlezipper.js');
}

let PuzzleZipper = null;
function loadZipper() {
  if (PuzzleZipper) return PuzzleZipper;
  const src = fs.readFileSync(path.join(CACHE_DIR, 'vendor', 'puzzlezipper.js'), 'utf8');
  PuzzleZipper = new Function(`${src}; return PuzzleZipper;`)();
  return PuzzleZipper;
}

// Decodes a SudokuPad API payload / puzzle-id string into either
// { format: 'scl', puzzle } (SudokuPad's native visual format) or
// { format: 'fpuzzles', puzzle } (f-puzzles' semantic JSON).
function decodePayload(raw) {
  raw = raw.trim();
  if (raw.startsWith('scl')) {
    const unzipped = loadZipper().unzip(LZString.decompressFromBase64(raw.slice(3)));
    return { format: 'scl', puzzle: JSON.parse(unzipped) };
  }
  if (raw.startsWith('ctc')) {
    const unzipped = loadZipper().unzip(LZString.decompressFromBase64(raw.slice(3)));
    return { format: 'scl', puzzle: JSON.parse(unzipped) };
  }
  const fp = raw.match(/^(fpuzzles|fpuz)/);
  if (fp) {
    const json = LZString.decompressFromBase64(decodeURIComponent(raw.slice(fp[1].length)));
    return { format: 'fpuzzles', puzzle: JSON.parse(json) };
  }
  if (raw.startsWith('{')) {
    // Older CTC-app puzzles are stored as zipped (key-shortened, unquoted)
    // JSON without the LZ layer; plain JSON also passes through unzip fine.
    let obj;
    try { obj = JSON.parse(raw); } catch (e) { obj = JSON.parse(loadZipper().unzip(raw)); }
    return { format: obj.grid ? 'fpuzzles' : 'scl', puzzle: obj };
  }
  throw new Error(`Unrecognized payload prefix: ${raw.slice(0, 16)}`);
}

module.exports = { CACHE_DIR, ensureDir, sleep, cachedFetch, parseCsv, prepareZipper, decodePayload };
