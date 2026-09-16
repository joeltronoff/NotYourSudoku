#!/usr/bin/env node
// Writes version.json from the BUILD constant in app.js, so the running app
// and the file it checks itself against can never disagree. Run before
// committing any change that should force installed copies to refresh.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

const match = app.match(/const BUILD = "([^"]+)"/);
if (!match) {
  console.error("Could not find `const BUILD = \"...\"` in app.js");
  process.exit(1);
}

const build = match[1];
fs.writeFileSync(
  path.join(root, "version.json"),
  JSON.stringify({ build }, null, 2) + "\n"
);
console.log("version.json -> build " + build);
