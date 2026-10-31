// Fails if site copy breaks the brand rules: banned phrases, emoji, exclamation marks in JSX text.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const banned = [/\brisk-free\b/i, /passive income/i, /to the moon/i, /\b100x\b/i, /\bguaranteed?\b/i];
// The required disclaimer contains "not guaranteed"; that exact phrase is allowed.
const allowed = [/not guaranteed/i, /no guarantee/i];
const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css|md)$/.test(f)) out.push(p);
  }
  return out;
}

let failures = 0;
for (const file of walk(new URL("../src", import.meta.url).pathname)) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const cleaned = allowed.reduce((l, re) => l.replace(re, ""), line);
      const hit = banned.find((re) => re.test(cleaned));
      const textBang = />[^<{]*![^<{=]*</.test(line);
      if (hit || emoji.test(line) || textBang) {
        failures++;
        console.log(`${file}:${i + 1}: ${line.trim()}`);
      }
    });
}
if (failures) {
  console.error(`copy-check: ${failures} issue(s)`);
  process.exit(1);
}
console.log("copy-check: clean");
