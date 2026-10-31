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

/** Standard x402 scheme. Settled by a facilitator from an EIP-3009 authorization. */
export const SCHEME_EXACT = "exact";
/**
 * Unslept scheme for merchants that opt in: the buffer pays `payTo` on-chain first and the client sends
 * the transaction hash. The merchant (or its facilitator) verifies the SettlementRouter `Settled` event.
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
  network: string; // CAIP-2, e.g. "eip155:<chainId>"
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

export interface Eip3009Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

export interface ExactEip3009Payload {
  signature: string;
  authorization: Eip3009Authorization;
}

export interface UnsleptDirectPayload {
  transaction: string;
  paymentId: string;
  agentAccount: string;
}

export interface SettlementResponse {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: string;
}

export const eip3009Types = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

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
  const asset = opts.asset.toLowerCase();
  for (const scheme of opts.schemes) {
    const match = pr.accepts.find(
      (r) => r.scheme === scheme && r.network === opts.network && r.asset.toLowerCase() === asset,
    );
    if (match) return match;
  }
  return undefined;
}

export function chainIdFromCaip2(network: string): number {
  const m = /^eip155:(\d+)$/.exec(network);
  if (!m) throw new X402FormatError(`Network ${network} is not an EVM CAIP-2 identifier.`);
  return Number(m[1]);
}
