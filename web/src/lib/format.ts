export const USDC_DECIMALS = 6;

const grouped = new Intl.NumberFormat("en-US");

/** 1234567890n -> "1,234.56789" (trailing zeros trimmed, at least 2 decimals). */
export function fmtUsdc(v: bigint | undefined, opts: { decimals?: number } = {}): string {
  if (v === undefined) return "--";
  const neg = v < 0n;
  const a = neg ? -v : v;
  const whole = a / 1_000_000n;
  let frac = (a % 1_000_000n).toString().padStart(6, "0");
  const keep = opts.decimals ?? 2;
  frac = frac.slice(0, Math.max(keep, frac.replace(/0+$/, "").length));
  if (opts.decimals !== undefined) frac = frac.slice(0, opts.decimals);
  return `${neg ? "-" : ""}${grouped.format(whole)}${frac ? "." + frac : ""}`;
}

/** "500" | "0.25" -> atomic units. Returns undefined for invalid input. */
export function parseUsdc(s: string): bigint | undefined {
  const m = /^\s*(\d{1,12})(?:\.(\d{0,6}))?\s*$/.exec(s.replace(/,/g, ""));
  if (!m) return undefined;
  return BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0") || "0");
}

export function shortAddr(a?: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

export function fmtBps(bps: bigint | number | undefined): string {
  if (bps === undefined) return "--";
  return `${(Number(bps) / 100).toFixed(2)}%`;
}
