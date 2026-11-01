/**
 * x402 v2 HTTP transport types and helpers.
 * Field names follow the x402 v2 specification (x402-foundation/x402, specs/x402-specification-v2.md)
 * and the HTTP transport (specs/transports-v2/http.md): PAYMENT-REQUIRED, PAYMENT-SIGNATURE and
 * PAYMENT-RESPONSE headers, each carrying base64-encoded JSON.
 */

export const X402_VERSION = 2 as const;

export const HEADER_REQUIRED = "PAYMENT-REQUIRED";
export const HEADER_SIGNATURE = "PAYMENT-SIGNATURE";
export const HEADER_RESPONSE = "PAYMENT-RESPONSE";

/**
 * Unslept scheme on Solana: the Unslept buffer pays `payTo` in USDC on-chain first, and the client sends the
 * transaction signature and the address of the on-chain Payment record. The merchant reads that record (owned by
 * the Unslept program) and checks payment ID, payee and amount.
 */
export const SCHEME_UNSLEPT = "unslept-direct";

export interface ResourceInfo {
  url: string;
  description?: string;
  mimeType?: string;
  serviceName?: string;
  tags?: string[];
  iconUrl?: string;
}

export interface PaymentRequirements {
  scheme: string;
  network: string; // CAIP-2, e.g. "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
  amount: string; // atomic units
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

export interface PaymentRequired {
  x402Version: number;
  error?: string;
  resource: ResourceInfo;
  accepts: PaymentRequirements[];
  extensions?: Record<string, unknown>;
}

export interface PaymentPayload<P = unknown> {
  x402Version: number;
  resource?: ResourceInfo;
  accepted: PaymentRequirements;
  payload: P;
  extensions?: Record<string, unknown>;
}

export interface UnsleptDirectPayload {
  /** Transaction signature (base58). */
  transaction: string;
  /** 32-byte payment ID, 0x-prefixed hex. */
  paymentId: string;
  /** Agent account address (base58). */
  agent: string;
  /** On-chain Payment record address (base58). */
  payment: string;
}

export interface SettlementResponse {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: string;
}

function toBase64(s: string): string {
  let bin = "";
  for (const byte of new TextEncoder().encode(s)) bin += String.fromCharCode(byte);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

export function encodeHeader(value: unknown): string {
  return toBase64(JSON.stringify(value));
}

export function decodeHeader<T>(value: string): T {
  return JSON.parse(fromBase64(value.trim())) as T;
}

export class X402FormatError extends Error {
  readonly code = "X402_FORMAT";
}

/** Reads the PaymentRequired object from a 402 response. */
export function readPaymentRequired(res: { headers: { get(name: string): string | null } }): PaymentRequired {
  const header = res.headers.get(HEADER_REQUIRED);
  if (!header) {
    throw new X402FormatError(
      "The server answered 402 without a PAYMENT-REQUIRED header. Only x402 v2 servers are supported.",
    );
  }
  let parsed: PaymentRequired;
  try {
    parsed = decodeHeader<PaymentRequired>(header);
  } catch {
    throw new X402FormatError("The PAYMENT-REQUIRED header is not valid base64-encoded JSON.");
  }
  if (parsed.x402Version !== X402_VERSION) {
    throw new X402FormatError(`Unsupported x402Version ${parsed.x402Version}. Expected ${X402_VERSION}.`);
  }
  if (!Array.isArray(parsed.accepts) || parsed.accepts.length === 0) {
    throw new X402FormatError("The PAYMENT-REQUIRED header lists no accepted payment methods.");
  }
  return parsed;
}

export interface SelectOptions {
  network: string;
  asset: string;
  schemes: string[]; // in order of preference
}

/** Picks the first requirement matching our network and asset, by scheme preference. */
export function selectRequirement(pr: PaymentRequired, opts: SelectOptions): PaymentRequirements | undefined {
  for (const scheme of opts.schemes) {
    const match = pr.accepts.find((r) => r.scheme === scheme && r.network === opts.network && r.asset === opts.asset);
    if (match) return match;
  }
  return undefined;
}
