import { renderToString } from "react-dom/server";
import { writeFileSync, readFileSync } from "node:fs";
import { Landing } from "./Landing";
import { themeBootstrap } from "../src/components/ThemeToggle";

const mode = process.argv[2] ?? "prelaunch";
const stats: any = mode === "live" ? { status: "live", totalValueWorkingUsd: 1234567, paymentsSettled: 48213, connectedAgents: 312, bufferRateBps: 412 } : { status: mode };
const tokens = readFileSync("../src/styles/tokens.css", "utf8");
const globals = readFileSync("../src/app/globals.css", "utf8")
  .replace('@import "tailwindcss";', "")
  .replace('@import "../styles/tokens.css";', "")
  .replace(/@theme inline \{[\s\S]*?\n\}/, "");
const body = renderToString(<Landing stats={stats} />);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unslept preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Mono&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<script>${process.env.NOJS ? "" : themeBootstrap}</script>
<style>:root{--font-bricolage:"Bricolage Grotesque";--font-plex:"IBM Plex Sans";--font-mono:"IBM Plex Mono";}${tokens}${globals}</style></head>
<body><div id="root">${body}</div>${process.env.NOJS ? "" : `<script>window.__STATS__=${JSON.stringify(stats)}</script><script src="hydrate.js"></script>`}</body></html>`;
writeFileSync(`dist/${mode}${process.env.NOJS ? "-nojs" : ""}.html`, html);
console.log("wrote", mode);
