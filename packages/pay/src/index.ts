import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createPublicClient, decodeEventLog, defineChain, http, parseAbiItem, type PublicClient } from "viem";

/**
 * @unslept/pay: accept x402 v2 payments in USDG on Robinhood Chain.
 *
 * Without payment the paywall answers HTTP 402 with a PAYMENT-REQUIRED header (scheme "unslept-direct").
 * The paying agent settles through the Unslept SettlementRouter and retries with PAYMENT-SIGNATURE carrying the
 * transaction hash. The paywall reads the receipt, checks the Settled event (payment ID, payee, amount) and lets
 * the request through. Each payment is accepted once.
 */

export const ROBINHOOD_CHAIN = {
  chainId: 4663,
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as `0x${string}`,
  router: "0x1FeAB3B8f88FB0667B686fDCB0206194e88c984b" as `0x${string}`,
};

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
  /** Address that receives the USDG. */
  payTo: string;
  /** Price per request in atomic USDG units (6 decimals). 10_000n is 0.01 USDG. */
  price: bigint | number | string;
  /** Secret used to sign payment IDs, at least 16 characters. Keep it stable across instances. */
  secret: string;
  /** Shown to agents in the PAYMENT-REQUIRED resource. */
  description?: string;
  mimeType?: string;
  /** Seconds a payment ID stays valid. Default 600. */
  ttlSeconds?: number;
  /** RPC URL for Robinhood Chain. Defaults to the public RPC; use a dedicated one in production. */
  rpcUrl?: string;
  /** Replay protection store. Defaults to memory. */
  store?: ReplayStore;
  /** Override chain settings, for tests or a fork. */
  chain?: Partial<typeof ROBINHOOD_CHAIN>;
  /** Inject a viem public client (tests). */
  client?: Pick<PublicClient, "getTransactionReceipt">;
}

export interface PaymentInfo {
  payer: string;
  amount: bigint;
  transaction: string;
  paymentId: string;
}

export type VerifyResult = { paid: true; payment: PaymentInfo; headers: Record<string, string> } | { paid: false; response: Response };

const settledEvent = parseAbiItem(
  "event Settled(bytes32 indexed paymentId, address indexed agent, address indexed payee, address buffer, address recipient, uint256 amount, uint256 fee, uint8 mode, string endpoint)",
);

const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64");
const dec = <T>(h: string): T => JSON.parse(Buffer.from(h, "base64").toString("utf8")) as T;
const isAddr = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

export function createPaywall(opts: PaywallOptions) {
  const cfg = { ...ROBINHOOD_CHAIN, ...opts.chain };
  if (!isAddr(opts.payTo)) throw new Error("payTo must be an EVM address.");
  const price = BigInt(opts.price);
  if (price <= 0n) throw new Error("price must be a positive number of atomic USDG units.");
  if (!opts.secret || opts.secret.length < 16) throw new Error("secret must be at least 16 characters.");
  const ttl = opts.ttlSeconds ?? 600;
  const store = opts.store ?? memoryStore();
  const network = `eip155:${cfg.chainId}`;
  const payTo = opts.payTo.toLowerCase();

  let client = opts.client;
  const getClient = () => {
    if (!client) {
      const chain = defineChain({
        id: cfg.chainId,
        name: "Robinhood Chain",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [opts.rpcUrl ?? cfg.rpcUrl] } },
      });
      client = createPublicClient({ chain, transport: http(opts.rpcUrl ?? cfg.rpcUrl) });
    }
    return client;
  };

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
          asset: cfg.usdg,
          payTo: opts.payTo,
          maxTimeoutSeconds: ttl,
          extra: { paymentId: newPaymentId(), router: cfg.router },
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

    let p: { accepted?: { scheme?: string; network?: string; asset?: string; payTo?: string }; payload?: { transaction?: string; paymentId?: string } };
    try {
      p = dec(sig);
    } catch {
      return { paid: false, response: paymentRequired(url, "invalid_payment_signature") };
    }
    const a = p.accepted ?? {};
    const tx = p.payload?.transaction ?? "";
    const paymentId = p.payload?.paymentId ?? "";
    const fail = (reason: string) => ({ paid: false as const, response: paymentRequired(url, reason, { success: false, errorReason: reason, transaction: tx, network }) });

    if (a.scheme !== "unslept-direct") return fail("unsupported_scheme");
    if (a.network !== network || a.asset?.toLowerCase() !== cfg.usdg.toLowerCase() || a.payTo?.toLowerCase() !== payTo) {
      return fail("accepted_requirements_mismatch");
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) return fail("invalid_transaction_hash");
    const idState = checkPaymentId(paymentId);
    if (idState !== "ok") return fail(idState === "expired" ? "payment_id_expired" : "unknown_payment_id");

    const receipt = await getClient()
      .getTransactionReceipt({ hash: tx as `0x${string}` })
      .catch(() => undefined);
    if (!receipt || receipt.status !== "success") return fail("transaction_not_successful");

    let payment: PaymentInfo | undefined;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== cfg.router.toLowerCase()) continue;
      try {
        const { args } = decodeEventLog({ abi: [settledEvent], data: log.data, topics: log.topics });
        if (args.paymentId.toLowerCase() !== paymentId.toLowerCase()) continue;
        if (args.payee.toLowerCase() !== payTo || args.recipient.toLowerCase() !== payTo) return fail("wrong_payee");
        if (args.mode !== 0) return fail("not_a_direct_payment");
        if (args.amount < price) return fail("insufficient_amount");
        payment = { payer: args.agent, amount: args.amount, transaction: tx, paymentId };
        break;
      } catch {
        continue;
      }
    }
    if (!payment) return fail("no_settlement_event");
    if (!(await store.claim(`tx:${tx.toLowerCase()}`, ttl * 2)) || !(await store.claim(`id:${paymentId.toLowerCase()}`, ttl * 2))) {
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
