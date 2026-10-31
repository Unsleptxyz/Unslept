import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e1630" }}>
        <svg viewBox="0 0 32 32" width="132" height="132">
          <circle cx="16" cy="16" r="12.5" fill="none" stroke="#f2a93b" strokeWidth="3" />
          <rect x="13" y="12" width="6" height="8" rx="1" fill="#f2a93b" />
        </svg>
      </div>
    ),
    size,
  );
}
