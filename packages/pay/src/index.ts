import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * @unslept/pay: accept x402 v2 payments in USDC on Solana.
 *
 * Without payment the paywall answers HTTP 402 with a PAYMENT-REQUIRED header (scheme "unslept-direct").
 * The paying agent settles through the Unslept program, which pays your wallet in USDC and writes a Payment record
 * on-chain, then retries with PAYMENT-SIGNATURE carrying the transaction signature and the record address. The
 * paywall reads the record (it must be owned by the Unslept program) and checks payment ID, payee and amount.
 * Each payment is accepted once. No dependencies: it talks to Solana JSON-RPC with fetch.
 */

export const SOLANA = {
  network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  rpcUrl: "https://api.mainnet-beta.solana.com",
  usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  program: "HbAgL4w8R9D8RUEuK4rJknK5Vn8rBusfRtfTnFcYieue",
};

export const SOLANA_DEVNET = {
  network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  rpcUrl: "https://api.devnet.solana.com",
  usdc: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  program: "HbAgL4w8R9D8RUEuK4rJknK5Vn8rBusfRtfTnFcYieue",
};

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}
const isSolAddr = (v: unknown): v is string => typeof v === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
const PAYMENT_DISC = [227, 231, 51, 26, 244, 88, 4, 148];

/** Reads an account's owner and data. Inject your own for tests or a custom RPC client. */
export type AccountReader = (address: string) => Promise<{ owner: string; data: Uint8Array } | undefined>;

export function rpcAccountReader(rpcUrl: string): AccountReader {
  return async (address) => {
    const r = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [address, { encoding: "base64", commitment: "confirmed" }] }),
    });
    const j = (await r.json()) as { result?: { value?: { owner: string; data: [string, string] } | null } };
    const v = j.result?.value;
    return v ? { owner: v.owner, data: Uint8Array.from(Buffer.from(v.data[0], "base64")) } : undefined;
  };
}

export interface PaymentRecord {
  paymentId: string;
  agent: string;
  payee: string;
  amount: bigint;
  fee: bigint;
}

export function decodePaymentRecord(d: Uint8Array): PaymentRecord | undefined {
  if (d.length < 8 + 32 * 3 + 16 || PAYMENT_DISC.some((b, i) => d[i] !== b)) return undefined;
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  return {
    paymentId: `0x${Buffer.from(d.subarray(8, 40)).toString("hex")}`,
    agent: b58(d.subarray(40, 72)),
    payee: b58(d.subarray(72, 104)),
    amount: dv.getBigUint64(104, true),
    fee: dv.getBigUint64(112, true),
  };
}

/** Stores payments already used. The default keeps them in memory; use a shared store when you run several instances. */
export interface ReplayStore {
  /** Returns true the first time a key is claimed, false afterwards. */
  claim(key: string, ttlSeconds: number): Promise<boolean>;
}

export function memoryStore(): ReplayStore {
  const seen = new Map<string, number>();
  return {
    async claim(key, ttl) {
      const now = Date.now();
      for (const [k, exp] of seen) if (exp < now) seen.delete(k);
      if (seen.has(key)) return false;
      seen.set(key, now + ttl * 1000);
      return true;
    },
  };
}

export interface PaywallOptions {
  /** Solana wallet that receives the USDC (base58). */
  payTo: string;
  /** Price per request in atomic USDC units (6 decimals). 10_000n is 0.01 USDC. */
  price: bigint | number | string;
  /** Secret used to sign payment IDs, at least 16 characters. Keep it stable across instances. */
  secret: string;
  /** Shown to agents in the PAYMENT-REQUIRED resource. */
  description?: string;
  mimeType?: string;
  /** Seconds a payment ID stays valid. Default 600. */
  ttlSeconds?: number;
  /** "solana" (default) or "solana-devnet". */
  network?: "solana" | "solana-devnet";
  /** Solana RPC URL. Defaults to the public RPC; use a dedicated one in production. */
  rpcUrl?: string;
  /** Replay protection store. Defaults to memory. */
  store?: ReplayStore;
  /** Override network settings, for tests or a fork. */
  chain?: Partial<typeof SOLANA>;
  /** Inject an account reader (tests, custom RPC clients). */
  reader?: AccountReader;
}

export interface PaymentInfo {
  payer: string;
  amount: bigint;
  transaction: string;
  paymentId: string;
}

export type VerifyResult = { paid: true; payment: PaymentInfo; headers: Record<string, string> } | { paid: false; response: Response };

const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64");
const dec = <T>(h: string): T => JSON.parse(Buffer.from(h, "base64").toString("utf8")) as T;

export function createPaywall(opts: PaywallOptions) {
  const cfg = { ...(opts.network === "solana-devnet" ? SOLANA_DEVNET : SOLANA), ...opts.chain };
  if (!isSolAddr(opts.payTo)) throw new Error("payTo must be a Solana wallet address (base58).");
  const price = BigInt(opts.price);
  if (price <= 0n) throw new Error("price must be a positive number of atomic USDC units.");
  if (!opts.secret || opts.secret.length < 16) throw new Error("secret must be at least 16 characters.");
  const ttl = opts.ttlSeconds ?? 600;
  const store = opts.store ?? memoryStore();
  const network = cfg.network;
  const payTo = opts.payTo;
  const read = opts.reader ?? rpcAccountReader(opts.rpcUrl ?? cfg.rpcUrl);

  const mac = (expiryHex: string, nonce: string) =>
    createHmac("sha256", `${opts.secret}:unslept-pay`).update(`${expiryHex}${nonce}`).digest("hex").slice(0, 32);

  /** 32-byte payment ID: 8-byte expiry, 8-byte nonce, 16-byte HMAC. Stateless, so any instance can check it. */
  function newPaymentId() {
    const expiryHex = BigInt(Math.floor(Date.now() / 1000) + ttl).toString(16).padStart(16, "0");
    const nonce = randomBytes(8).toString("hex");
    return `0x${expiryHex}${nonce}${mac(expiryHex, nonce)}`;
  }

  function checkPaymentId(id: string): "ok" | "invalid" | "expired" {
    if (!/^0x[0-9a-fA-F]{64}$/.test(id)) return "invalid";
    const expiryHex = id.slice(2, 18).toLowerCase();
    const nonce = id.slice(18, 34).toLowerCase();
    const a = Buffer.from(id.slice(34).toLowerCase(), "hex");
    const b = Buffer.from(mac(expiryHex, nonce), "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return "invalid";
    return Number.parseInt(expiryHex, 16) * 1000 < Date.now() ? "expired" : "ok";
  }

  function requirements(resourceUrl: string, error = "PAYMENT-SIGNATURE header is required") {
    return {
      x402Version: 2,
      error,
      resource: { url: resourceUrl, description: opts.description ?? "Paid resource", mimeType: opts.mimeType ?? "application/json" },
      accepts: [
        {
          scheme: "unslept-direct",
          network,
          amount: price.toString(),
          asset: cfg.usdc,
          payTo: opts.payTo,
          maxTimeoutSeconds: ttl,
          extra: { paymentId: newPaymentId(), program: cfg.program },
        },
      ],
    };
  }

  function paymentRequired(url: string, error?: string, settlement?: object): Response {
    const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store", "PAYMENT-REQUIRED": enc(requirements(url, error)) });
    if (settlement) headers.set("PAYMENT-RESPONSE", enc(settlement));
    return new Response(JSON.stringify({ error: error ?? "Payment required." }), { status: 402, headers });
  }

  /** Checks a request. Returns the payment when it is valid, or the 402 response to send back. */
  async function verify(request: Request): Promise<VerifyResult> {
    const url = request.url.split("?")[0];
    const sig = request.headers.get("payment-signature");
    if (!sig) return { paid: false, response: paymentRequired(url) };

    let p: { accepted?: { scheme?: string; network?: string; asset?: string; payTo?: string }; payload?: { transaction?: string; paymentId?: string; payment?: string } };
    try {
      p = dec(sig);
    } catch {
      return { paid: false, response: paymentRequired(url, "invalid_payment_signature") };
    }
    const a = p.accepted ?? {};
    const tx = p.payload?.transaction ?? "";
    const paymentId = (p.payload?.paymentId ?? "").toLowerCase();
    const record = p.payload?.payment ?? "";
    const fail = (reason: string) => ({ paid: false as const, response: paymentRequired(url, reason, { success: false, errorReason: reason, transaction: tx, network }) });

    if (a.scheme !== "unslept-direct") return fail("unsupported_scheme");
    if (a.network !== network || a.asset !== cfg.usdc || a.payTo !== payTo) return fail("accepted_requirements_mismatch");
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(tx)) return fail("invalid_transaction_signature");
    if (!isSolAddr(record)) return fail("invalid_payment_record");
    const idState = checkPaymentId(paymentId);
    if (idState !== "ok") return fail(idState === "expired" ? "payment_id_expired" : "unknown_payment_id");

    const acct = await read(record).catch(() => undefined);
    if (!acct) return fail("payment_record_not_found");
    if (acct.owner !== cfg.program) return fail("payment_record_not_from_unslept");
    const rec = decodePaymentRecord(acct.data);
    if (!rec || rec.paymentId !== paymentId) return fail("payment_id_mismatch");
    if (rec.payee !== payTo) return fail("wrong_payee");
    if (rec.amount < price) return fail("insufficient_amount");
    const payment: PaymentInfo = { payer: rec.agent, amount: rec.amount, transaction: tx, paymentId };

    if (!(await store.claim(`id:${paymentId}`, ttl * 2)) || !(await store.claim(`tx:${tx}`, ttl * 2))) {
      return fail("payment_already_used");
    }
    return { paid: true, payment, headers: { "PAYMENT-RESPONSE": enc({ success: true, transaction: tx, network, payer: payment.payer }) } };
  }

  /** Wraps a Fetch-style handler (Next.js route handler, Hono, Bun, Deno). */
  function protect<A extends unknown[]>(handler: (request: Request, payment: PaymentInfo, ...rest: A) => Response | Promise<Response>) {
    return async (request: Request, ...rest: A): Promise<Response> => {
      const v = await verify(request);
      if (!v.paid) return v.response;
      const res = await handler(request, v.payment, ...rest);
      const out = new Response(res.body, res);
      for (const [k, val] of Object.entries(v.headers)) out.headers.set(k, val);
      return out;
    };
  }

  return { verify, protect, requirements, network, price };
}

export type Paywall = ReturnType<typeof createPaywall>;
