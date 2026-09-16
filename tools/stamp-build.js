#!/usr/bin/env node
// Keeps the build number in step everywhere it appears. app.js is the one
// place to edit it; this copies it into version.json, into the page's own
// PAGE_BUILD, and onto the ?v= of every asset the page loads.
//
// Those ?v= stamps are the point. A host can serve a fresh index.html
// alongside an asset it has not expired yet, and a page that loads the
// previous release's app.js breaks in ways that look nothing like a
// caching problem. A URL that changes with the build cannot be answered
// from the old entry.
//
// Run it after changing APP_BUILD and before committing.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const appPath = path.join(root, "app.js");
const htmlPath = path.join(root, "index.html");

const app = fs.readFileSync(appPath, "utf8");
const match = app.match(/window\.APP_BUILD = "([^"]+)"/);
if (!match) {
  console.error('Could not find `window.APP_BUILD = "..."` in app.js');
  process.exit(1);
}
const build = match[1];

let html = fs.readFileSync(htmlPath, "utf8");
const before = html;

html = html.replace(
  /window\.PAGE_BUILD = "[^"]*"/,
  'window.PAGE_BUILD = "' + build + '"'
);

// Every local asset the page pulls in, so none of them can lag behind it.
const STAMPED = [
  "styles.css",
  "sudoku-engine.js",
  "variant-solver.js",
  "puzzles.js",
  "puzzles-ctc.js",
  "app.js",
];
let stamped = 0;
for (const asset of STAMPED) {
  const pattern = new RegExp(
    "(\\b(?:href|src)=\")" + asset.replace(".", "\\.") + "(?:\\?v=[^\"]*)?(\")",
    "g"
  );
  html = html.replace(pattern, (whole, open, close) => {
    stamped += 1;
    return open + asset + "?v=" + build + close;
  });
}

if (stamped !== STAMPED.length) {
  console.error(
    "Expected to stamp " + STAMPED.length + " assets but stamped " + stamped +
    ". index.html's asset tags have changed -- update STAMPED."
  );
  process.exit(1);
}

if (!/window\.PAGE_BUILD = "/.test(html)) {
  console.error("index.html has no PAGE_BUILD to update.");
  process.exit(1);
}

if (html !== before) fs.writeFileSync(htmlPath, html);
fs.writeFileSync(
  path.join(root, "version.json"),
  JSON.stringify({ build }, null, 2) + "\n"
);

console.log("build " + build + " -> version.json, PAGE_BUILD, " + stamped + " asset URLs");
