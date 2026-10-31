import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
mkdirSync("out", { recursive: true });
const b = await chromium.launch();
for (const [file, w, h] of [["x-avatar.html", 400, 400], ["x-header.html", 1500, 500]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.goto("file://" + resolve(file));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await p.screenshot({ path: "out/" + file.replace(".html", ".png") });
}
await b.close();
