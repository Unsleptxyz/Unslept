/** Errors say what happened and how to fix it. */

export type UnsleptErrorCode =
  | "PER_CALL_CAP"
  | "DAILY_CAP"
  | "PAYEE_NOT_ALLOWED"
  | "AGENT_PAUSED"
  | "AGENT_REVOKED"
  | "NO_MATCHING_REQUIREMENT"
  | "INSUFFICIENT_COLLATERAL"
  | "INSUFFICIENT_BUFFER_LIQUIDITY"
  | "SETTLEMENT_FAILED"
  | "PAYMENT_REJECTED"
  | "MAX_AMOUNT"
  | "CONFIG";

export class UnsleptError extends Error {
  constructor(
    readonly code: UnsleptErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "UnsleptError";
  }
}

export const fmtUsdc = (atomic: bigint, decimals = 6): string => {
  const neg = atomic < 0n;
  const v = neg ? -atomic : atomic;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = (v % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""} USDC`;
};
