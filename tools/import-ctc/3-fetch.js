// Step 3: resolve each video's description links to an actual puzzle
// payload (following short-link redirects, then SudokuPad's puzzle API),
// picking the payload whose title best matches the catalogue's puzzle title
// when a description links several puzzles.
//
// Usage: node 3-fetch.js [--limit N]
// Output: fetched.json (payloads themselves live in cache/pad)

const fs = require('fs');
const path = require('path');
const { cachedFetch, decodePayload, sleep, CACHE_DIR, ensureDir } = require('./lib');

const IGNORE = /crackingthecryptic\.com\/(apps|merch)|tinyurl\.com\/CTCCatalogue|patreon|steampowered|instagram|twitter|facebook/i;
const SHORTENERS = /^https?:\/\/(?:www\.)?(tinyurl\.com|bit\.ly|tiny\.cc|is\.gd|t\.ly|goo\.gl)\//i;

// Follows redirects by hand (without downloading the target page), caching
// the final URL. Returns null if it never lands on a puzzle host.
async function resolveShortLink(url) {
  const dir = path.join(CACHE_DIR, 'redirects');
  ensureDir(dir);
  const file = path.join(dir, url.replace(/[^A-Za-z0-9_.-]/g, '_'));
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8') || null;
  let current = url;
  for (let hop = 0; hop < 6 && SHORTENERS.test(current); hop++) {
    await sleep(600);
    try {
      const res = await fetch(current, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(20000) });
      const loc = res.headers.get('location');
      if (!loc) break;
      current = new URL(loc, current).toString();
    } catch (err) {
      return null; // transient -- not cached, retried next run
    }
  }
  const final = SHORTENERS.test(current) ? '' : current;
  fs.writeFileSync(file, final);
  return final || null;
}

// Turns a puzzle-host URL into either inline payload data or an API id.
function puzzleRefFromUrl(url) {
  let u;
  try { u = new URL(url); } catch (e) { return null; }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'f-puzzles.com') {
    const load = u.searchParams.get('load');
    return load ? { inline: `fpuzzles${load}` } : null;
  }
  if (!/sudokupad\.app$|crackingthecryptic\.com$|svencodes\.com$/.test(host)) return null;
  const pid = u.searchParams.get('puzzleid');
  if (pid) return /^(scl|ctc|fpuz)/.test(pid) ? { inline: pid } : { id: pid };
  let p = decodeURIComponent(u.pathname).replace(/^\/+|\/+$/g, '');
  p = p.replace(/^(sudoku|webapp|puzzle)\//, '');
  const inline = p.match(/(?:^|\/)(scl|ctc|fpuzzles|fpuz)(N4Ig.+|[A-Za-z0-9+/=]{40,}.*)$/);
  if (inline) return { inline: inline[1] + inline[2] };
  if (!p || p === 'sudoku' || p === 'webapp' || p === 'apps') return null;
  return { id: p };
}

async function loadPayload(ref) {
  if (ref.inline) return ref.inline;
  const { body } = await cachedFetch('pad', ref.id, `https://sudokupad.app/api/puzzle/${ref.id}`, { delayMs: 700 });
  return body || null;
}

function payloadTitle(format, puzzle) {
  if (format === 'fpuzzles') return puzzle.title || '';
  if (puzzle.metadata && puzzle.metadata.title) return puzzle.metadata.title;
  const t = (puzzle.cages || []).find(c => typeof c.value === 'string' && /^title:/i.test(c.value));
  return t ? t.value.replace(/^title:\s*/i, '') : '';
}

const LINK_RE = /https?:\/\/[^\s"<>)\]]+/g;

function readDescription(videoId) {
  const file = path.join(CACHE_DIR, 'youtube', `${videoId}.txt`);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

// Splits a description into "GAS 123 – Title by Setter: <links> rules (hh:mm/hh:mm)"
// blocks. Only the first link of a block is the puzzle itself (later ones
// are alternates such as a non-GAS version).
function parseGasBlocks(description) {
  const blocks = [];
  const parts = description.split(/(?=^\s*GAS\s*#?\s*\d+\s*[–—-])/m);
  for (const part of parts) {
    const m = part.match(/^\s*GAS\s*#?\s*(\d+)\s*[–—-]\s*([^\n]+?)\s+by\s+([^\n:]+?)\s*(?::|\n|https?:|$)/);
    if (!m) continue;
    // f-puzzles short ids (?id=) can't be decoded; skip to the next link.
    const links = (part.match(LINK_RE) || []).map(l => l.replace(/[.,;]+$/, '')).filter(l => !/f-puzzles\.com\/\?id=/.test(l));
    const hats = part.match(/\((\d+):(\d+)\s*\/\s*(\d+):(\d+)\)/);
    blocks.push({
      number: Number(m[1]),
      title: m[2].trim(),
      setter: m[3].replace(/\s*https?:.*$/, '').trim(),
      links: links.slice(0, 1),
      oneHatMinutes: hats ? Number(hats[3]) + Number(hats[4]) / 60 : null,
    });
  }
  return blocks;
}

function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

async function main() {
  const links = JSON.parse(fs.readFileSync(path.join(__dirname, 'links.json'), 'utf8'));
  const limit = parseInt(argValue('--limit') || links.length, 10);
  const out = [];
  const stats = { ok: 0, noLink: 0, noPayload: 0 };
  const rowsPerVideo = new Map();
  links.forEach(v => rowsPerVideo.set(v.videoId, (rowsPerVideo.get(v.videoId) || 0) + 1));

  for (const [n, video] of links.slice(0, limit).entries()) {
    const found = [];
    for (let url of video.links) {
      const from = url;
      if (IGNORE.test(url)) continue;
      if (SHORTENERS.test(url)) {
        url = await resolveShortLink(url);
        if (!url || IGNORE.test(url)) continue;
      }
      const ref = puzzleRefFromUrl(url);
      if (!ref) continue;
      const raw = await loadPayload(ref);
      if (!raw) continue;
      try {
        const { format, puzzle } = decodePayload(raw);
        found.push({ from, url, ref, format, title: payloadTitle(format, puzzle) });
      } catch (err) {
        found.push({ from, url, ref, error: String(err.message || err) });
      }
    }

    // GAS (Genuinely Approachable Sudoku) roundups list several separate
    // puzzles; collect each one, and keep their links out of the choice of
    // the video's own puzzle.
    const description = readDescription(video.videoId);
    const gas = parseGasBlocks(description).map(block => {
      const hit = found.find(f => !f.error && block.links.includes(f.from));
      return hit ? { ...block, chosen: hit } : null;
    }).filter(Boolean);
    const gasLinks = new Set(parseGasBlocks(description).flatMap(b => b.links));

    const decodable = found.filter(f => !f.error && !gasLinks.has(f.from));
    let chosen = null;
    // A video with several catalogue rows (several puzzles) shares one
    // description, so each row must match its puzzle by title.
    if (decodable.length === 1 && rowsPerVideo.get(video.videoId) === 1) chosen = decodable[0];
    else if (decodable.length >= 1) {
      const want = norm(video.puzzleTitle);
      chosen = decodable.find(f => want && norm(f.title) === want)
        || decodable.find(f => want && (norm(f.title).includes(want) || want.includes(norm(f.title)) && norm(f.title)))
        || null; // ambiguous -- don't guess which puzzle the video solved
    }
    if (!chosen && gas.length > 0) {
      // The video itself may be solving one of the day's GAS puzzles.
      const want = norm(video.puzzleTitle);
      const match = want && gas.filter(g => norm(g.title) === want || norm(g.chosen.title).replace(/^.*?\d{4} /, '') === want);
      if (match && match.length === 1) chosen = match[0].chosen;
    }

    if (video.links.length === 0) stats.noLink++;
    else if (!chosen) stats.noPayload++;
    else stats.ok++;
    out.push({ ...video, found, chosen, gas });
    if ((n + 1) % 50 === 0) console.log(`…${n + 1}/${limit}`, stats);
  }

  fs.writeFileSync(path.join(__dirname, 'fetched.json'), JSON.stringify(out, null, 1));
  console.log('done', stats);
}

if (require.main === module) main().catch(err => { console.error(err); process.exit(1); });

module.exports = { puzzleRefFromUrl, payloadTitle };
