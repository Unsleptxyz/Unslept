import { ImageResponse } from "next/og";

export const alt = "Unslept: idle agent balances kept working, released the instant an x402 payment is due.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(160deg, #0e1630 0%, #18234a 100%)",
          color: "#e8e6f0",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg viewBox="0 0 32 32" width="64" height="64">
            <circle cx="16" cy="16" r="12.5" fill="none" stroke="#f2a93b" strokeWidth="3" />
            <rect x="13" y="12" width="6" height="8" rx="1" fill="#f2a93b" />
          </svg>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>Unslept</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            Your agent&apos;s money, unslept.
          </div>
          <div style={{ fontSize: 32, color: "#8a93b8", maxWidth: 960, lineHeight: 1.35 }}>
            Idle balances stay in tokenized assets on Robinhood Chain and settle x402 payments the instant they are due.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#8a93b8" }}>
          <div style={{ display: "flex", color: "#4fd1b5" }}>x402 · USDG · Robinhood Chain</div>
          <div style={{ display: "flex" }}>Yield is variable and not guaranteed</div>
        </div>
      </div>
    ),
    size,
  );
}
