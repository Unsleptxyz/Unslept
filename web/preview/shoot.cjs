const { chromium } = require("playwright");
(async () => {
const b = await chromium.launch();
const base = "file://" + process.cwd() + "/dist/";
async function shot(file, name, opts = {}) {
  const ctx = await b.newContext({ viewport: opts.vp ?? { width: 1440, height: 900 }, colorScheme: opts.scheme ?? "dark", reducedMotion: opts.rm ?? "no-preference", javaScriptEnabled: !opts.nojs });
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(base + file, { waitUntil: "networkidle" }).catch(()=>{});
  await p.waitForTimeout(2600);
  await p.screenshot({ path: `shots/${name}.png`, fullPage: !!opts.full });
  if (errs.length) console.log(name, "ERRORS:", errs.slice(0, 5));
  await ctx.close();
}
await shot("prelaunch.html", "desktop-hero");
await shot("prelaunch.html", "desktop-full", { full: true });
await shot("prelaunch.html", "light-full", { full: true, scheme: "light" });
await shot("prelaunch.html", "mobile-full", { full: true, vp: { width: 360, height: 780 } });
await shot("prelaunch.html", "rm-hero", { rm: "reduce" });
await shot("live.html", "live-full", { full: true });
await shot("prelaunch-nojs.html", "nojs-full", { full: true, nojs: true });
await b.close();
})();
