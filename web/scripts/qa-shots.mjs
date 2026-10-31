// Screenshots every page at desktop and mobile widths and records console errors.
// Usage: node scripts/qa-shots.mjs <baseUrl> <outDir>
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "qa";
const pages = (process.env.QA_PAGES || "/,/docs,/docs/quickstart,/docs/x402,/risk,/terms,/privacy,/app,/app/agents,/app/buffer,/app/developers,/waitlist/joined,/missing-page").split(",");
const sizes = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
mkdirSync(out, { recursive: true });
const log = [];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const s of sizes) {
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.name === "mobile" ? 2 : 1, colorScheme: "dark" });
  for (const p of pages) {
    const page = await ctx.newPage();
    const errs = [];
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
    page.on("pageerror", (e) => errs.push(`pageerror: ${String(e).slice(0, 300)}`));
    const name = `${s.name}${p === "/" ? "_home" : p.replaceAll("/", "_")}`;
    try {
      const r = await page.goto(base + p, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${out}/${name}_top.png` });
      await page.screenshot({ path: `${out}/${name}_full.png`, fullPage: true });
      log.push(`${name}: HTTP ${r?.status()}${errs.length ? "\n  " + errs.join("\n  ") : ""}`);
    } catch (e) {
      log.push(`${name}: FAILED ${String(e).slice(0, 300)}`);
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${out}/console.txt`, log.join("\n") + "\n");
console.log(log.join("\n"));
