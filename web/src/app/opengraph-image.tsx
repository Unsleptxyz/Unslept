import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Unslept: your agent's money, unslept. Idle balances keep working; x402 payments settle the instant they are due.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function font(file: string) {
  try {
    return await readFile(join(process.cwd(), "node_modules", file));
  } catch {
    return undefined;
  }
}

export default async function OpengraphImage() {
  const [serif, serifItalic, sans] = await Promise.all([
    font("@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff"),
    font("@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff"),
    font("@fontsource/inter/files/inter-latin-500-normal.woff"),
  ]);
  const fonts = [
    serif && { name: "Instrument Serif", data: serif, style: "normal" as const, weight: 400 as const },
    serifItalic && { name: "Instrument Serif", data: serifItalic, style: "italic" as const, weight: 400 as const },
    sans && { name: "Inter", data: sans, style: "normal" as const, weight: 500 as const },
  ].filter(Boolean) as { name: string; data: Buffer; style: "normal" | "italic"; weight: 400 | 500 }[];

  const windows = Array.from({ length: 34 }, (_, i) => i);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(165deg, #07080b 0%, #111317 60%, #16181d 100%)",
          color: "#eceaf4",
          fontFamily: "Inter",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", right: 90, top: 70, width: 150, height: 150, borderRadius: 999, background: "radial-gradient(circle, rgba(244,240,255,0.85) 0%, rgba(200,205,255,0.15) 45%, rgba(0,0,0,0) 70%)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 200, display: "flex", alignItems: "flex-end", gap: 10, padding: "0 40px", opacity: 0.9 }}>
          {windows.map((i) => {
            const h = 40 + ((i * 53) % 150);
            return (
              <div key={i} style={{ width: 26, height: h, background: "#0a1129", borderTop: "1px solid #1c2a5a", display: "flex", flexDirection: "column", gap: 8, padding: 6 }}>
                {i % 4 === 1 ? <div style={{ width: 8, height: 10, background: "#f2a93b" }} /> : null}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg viewBox="0 0 32 32" width="64" height="64">
            <rect width="32" height="32" rx="8" fill="#16181d" />
            <path d="M10.1 9v6.9a5.9 5.9 0 0 0 11.8 0V9" fill="none" stroke="#f2a93b" strokeWidth="3.2" strokeLinecap="round" />
            <circle cx="16" cy="12.1" r="2.1" fill="#f2a93b" />
          </svg>
          <div style={{ fontFamily: "Instrument Serif", fontSize: 46 }}>Unslept</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 150 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontFamily: "Instrument Serif", fontSize: 84, lineHeight: 1.02, letterSpacing: -1.5, maxWidth: 1000 }}>
            <span>Your agent&apos;s money,&nbsp;</span>
            <span style={{ fontStyle: "italic", color: "#f2a93b" }}>unslept.</span>
          </div>
          <div style={{ fontSize: 28, color: "#c4c9e0", maxWidth: 900 }}>Idle balances keep working. x402 payments settle the instant they are due.</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
