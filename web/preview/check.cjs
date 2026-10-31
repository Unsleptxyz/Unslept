const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const base = "file://" + process.cwd() + "/dist/";
  // reduced motion: arc must be fully drawn and comet hidden immediately
  let ctx = await b.newContext({ reducedMotion: "reduce" }); let p = await ctx.newPage();
  await p.goto(base + "prelaunch.html"); await p.waitForTimeout(300);
  console.log("rm comet display:", await p.$eval(".clock-comet", e => getComputedStyle(e).display), "arc anim:", await p.$eval(".clock-arc", e => getComputedStyle(e).animationName));
  await ctx.close();
  ctx = await b.newContext(); p = await ctx.newPage();
  await p.goto(base + "prelaunch.html"); await p.waitForTimeout(1500);
  const a = await p.textContent(".counter__earned"); await p.waitForTimeout(1200); const c = await p.textContent(".counter__earned");
  console.log("counter ticks:", a, "->", c);
  // theme toggle
  await p.click(".theme-toggle"); console.log("theme after toggle:", await p.evaluate(() => document.documentElement.dataset.theme));
  // tabs keyboard
  await p.focus(".code-tabs__tab"); await p.keyboard.press("ArrowRight");
  console.log("active tab:", await p.$eval('[role=tab][aria-selected=true]', e => e.textContent), "visible panels:", await p.$$eval(".code-tabs__panel", ps => ps.filter(x => getComputedStyle(x).display !== "none").length));
  // horizontal overflow at 360
  await p.setViewportSize({ width: 360, height: 800 }); await p.waitForTimeout(200);
  console.log("overflow@360:", await p.evaluate(() => document.documentElement.scrollWidth));
  await ctx.close();
  ctx = await b.newContext({ javaScriptEnabled: false }); p = await ctx.newPage();
  await p.goto(base + "prelaunch-nojs.html");
  console.log("nojs panels visible:", await p.$$eval(".code-tabs__panel", ps => ps.filter(x => getComputedStyle(x).display !== "none").length), "toggle hidden:", await p.$eval(".theme-toggle", e => getComputedStyle(e).display));
  const imgs = await p.$$eval("svg[role=img]", s => s.filter(x => !x.getAttribute("aria-label") && !x.getAttribute("aria-labelledby")).length);
  console.log("unlabeled role=img svgs:", imgs);
  await b.close();
})();
