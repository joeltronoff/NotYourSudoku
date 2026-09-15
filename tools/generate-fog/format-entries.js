// Formats generated JSON puzzle sets into pretty-printed puzzles.js entry
// blocks (same style as merge-into-library.js) without touching the rest
// of the file -- prints to stdout for manual insertion.
"use strict";
const fs = require("fs");

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function fmt(value, indent) {
  const pad = "  ".repeat(indent);
  const padIn = "  ".repeat(indent + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every(v => typeof v === "number")) return "[" + value.join(", ") + "]";
    if (value.every(v => Array.isArray(v) && v.every(x => typeof x === "number"))) {
      return "[" + value.map(v => "[" + v.join(", ") + "]").join(", ") + "]";
    }
    const items = value.map(v => padIn + fmt(v, indent + 1));
    return "[\n" + items.join(",\n") + "\n" + pad + "]";
  }
  if (typeof value === "object" && value !== null) {
    const keys = Object.keys(value);
    const inlineParts = keys.map(k => (IDENT_RE.test(k) ? k : JSON.stringify(k)) + ": " + fmt(value[k], indent + 1));
    const oneLine = "{ " + inlineParts.join(", ") + " }";
    if (oneLine.length <= 100 && !oneLine.includes("\n")) return oneLine;
    const items = keys.map(k => padIn + (IDENT_RE.test(k) ? k : JSON.stringify(k)) + ": " + fmt(value[k], indent + 1));
    return "{\n" + items.join(",\n") + "\n" + pad + "}";
  }
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}
function fmtGrid(grid, indent) {
  const pad = "  ".repeat(indent);
  const padIn = "  ".repeat(indent + 1);
  return "[\n" + grid.map(row => padIn + "[" + row.join(", ") + "]").join(",\n") + "\n" + pad + "]";
}
const FIELD_ORDER = ["id", "title", "blurb", "stars", "givens", "solution", "diagonals", "oddEven", "fog", "variants"];
function fmtEntry(entry) {
  const pad = "    ", padIn = "      ";
  let out = pad + "{\n";
  for (const key of FIELD_ORDER) {
    if (!(key in entry)) continue;
    const valStr = (key === "givens" || key === "solution") ? fmtGrid(entry[key], 3) : fmt(entry[key], 3);
    out += padIn + key + ": " + valStr + ",\n";
  }
  out = out.replace(/,\n$/, "\n");
  out += pad + "},\n";
  return out;
}

const file = process.argv[2];
const entries = JSON.parse(fs.readFileSync(file, "utf8"));
for (const e of entries) process.stdout.write(fmtEntry(e));
