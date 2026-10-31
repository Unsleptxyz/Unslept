import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#111317" }}>
        <svg viewBox="0 0 32 32" width="128" height="128">
          <path d="M10.1 9v6.9a5.9 5.9 0 0 0 11.8 0V9" fill="none" stroke="#f2a93b" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="16" cy="12.1" r="2.1" fill="#f2a93b" />
        </svg>
      </div>
    ),
    size,
  );
}
