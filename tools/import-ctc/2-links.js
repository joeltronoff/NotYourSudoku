// Step 2: read each candidate video's YouTube description and pull out the
// puzzle link CTC posts there ("Here's where you can attempt X: <link>").
// Requests are spaced out and cached, so an interrupted run resumes free.
//
// Usage: node 2-links.js [--limit N]
// Output: links.json

const fs = require('fs');
const path = require('path');
const { cachedFetch } = require('./lib');

const DESC_RE = /"shortDescription":"((?:[^"\\]|\\.)*)"/;
const LINK_RE = /https?:\/\/(?:www\.)?(?:sudokupad\.app|app\.crackingthecryptic\.com|beta\.sudokupad\.app|f-puzzles\.com|tinyurl\.com|bit\.ly|tiny\.cc|is\.gd|t\.ly|sudokupad\.svencodes\.com|crackingthecryptic\.com)\/[^\s"<>)\]]+/gi;

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

async function main() {
  const candidates = JSON.parse(fs.readFileSync(path.join(__dirname, 'candidates.json'), 'utf8'));
  const limit = parseInt(argValue('--limit') || candidates.length, 10);
  const out = [];
  let fetched = 0;

  for (const cand of candidates.slice(0, limit)) {
    const { body: description, cached, error } = await cachedFetch('youtube', `${cand.videoId}.txt`,
      `https://www.youtube.com/watch?v=${cand.videoId}`,
      {
        headers: { Cookie: 'CONSENT=YES+1' },
        delayMs: 1200,
        // A page without a description is usually a consent/bot wall, not a
        // real miss -- reject it so it's retried instead of cached.
        transform: html => {
          const m = html.match(DESC_RE);
          return m ? JSON.parse(`"${m[1]}"`) : null;
        },
      });
    if (!cached) fetched++;
    if (description == null) {
      out.push({ ...cand, links: [], error: error || 'no description' });
      continue;
    }
    const links = [...new Set((description.match(LINK_RE) || []).map(l => l.replace(/[.,;]+$/, '')))];
    out.push({ ...cand, links });
    if (fetched && fetched % 25 === 0) console.log(`…${out.length}/${limit}`);
  }

  fs.writeFileSync(path.join(__dirname, 'links.json'), JSON.stringify(out, null, 1));
  const withLinks = out.filter(o => o.links.length > 0).length;
  console.log(`${withLinks}/${out.length} videos have a puzzle link (fetched ${fetched} new pages)`);
}

main().catch(err => { console.error(err); process.exit(1); });
