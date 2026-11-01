/**
 * Sample x402 v2 endpoint for Unslept.
 *
 * GET /data costs PRICE atomic USDG. The 402 answer offers two methods:
 *  - "unslept-direct": the Unslept buffer pays PAY_TO on-chain first; the client sends the transaction hash.
 *    This server verifies the SettlementRouter `Settled` event itself over JSON-RPC.
 *  - "exact" (standard x402, EIP-3009): verified and settled through the configured facilitator.
 *
 * No dependencies. Every chain value comes from the environment.
 *   RPC_URL, CHAIN_ID, USDG, PAY_TO, ROUTER, PRICE, [FACILITATOR_URL], [USDG_EIP712_NAME], [USDG_EIP712_VERSION], [PORT]
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";

// keccak256("Settled(bytes32,address,address,address,address,uint256,uint256,uint8,string)")
export const SETTLED_TOPIC = "0x840ee00c8bdf0b51f6780c66e0c32236366088094b9ca1154d600bb59517ec95";

export interface EndpointConfig {
  rpcUrl: string;
  chainId: number;
  usdg: string;
  payTo: string;
  router: string;
  price: bigint;
  facilitatorUrl?: string;
  eip712Name?: string;
  eip712Version?: string;
  /** Confirmations to wait for. Settled events are read from the receipt. */
  challengeTtlSeconds?: number;
}

const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64");
const dec = <T>(h: string): T => JSON.parse(Buffer.from(h, "base64").toString("utf8")) as T;

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = (await r.json()) as { result?: T; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j.result as T;
}

const topicAddr = (t: string) => `0x${t.slice(26)}`.toLowerCase();
const word = (data: string, i: number) => BigInt(`0x${data.slice(2 + i * 64, 2 + (i + 1) * 64)}`);

export function createEndpoint(cfg: EndpointConfig) {
  const network = `eip155:${cfg.chainId}`;
  const challenges = new Map<string, number>(); // paymentId -> expiry (ms)
  const usedTx = new Set<string>();
  const ttl = (cfg.challengeTtlSeconds ?? 300) * 1000;

  function requirements(resourceUrl: string) {
    const paymentId = `0x${randomBytes(32).toString("hex")}`;
    challenges.set(paymentId, Date.now() + ttl);
    const accepts: Record<string, unknown>[] = [
      {
        scheme: "unslept-direct",
        network,
        amount: cfg.price.toString(),
        asset: cfg.usdg,
        payTo: cfg.payTo,
        maxTimeoutSeconds: 120,
        extra: { paymentId, router: cfg.router },
      },
    ];
    if (cfg.facilitatorUrl && cfg.eip712Name && cfg.eip712Version) {
      accepts.push({
        scheme: "exact",
        network,
        amount: cfg.price.toString(),
        asset: cfg.usdg,
        payTo: cfg.payTo,
        maxTimeoutSeconds: 60,
        extra: { assetTransferMethod: "eip3009", name: cfg.eip712Name, version: cfg.eip712Version },
      });
    }
    return {
      x402Version: 2,
      error: "PAYMENT-SIGNATURE header is required",
      resource: { url: resourceUrl, description: "Sample market data", mimeType: "application/json" },
      accepts,
    };
  }

  async function verifyDirect(p: { payload: { transaction: string; paymentId: string; agentAccount: string } }) {
    const { transaction, paymentId } = p.payload;
    const exp = challenges.get(paymentId);
    if (!exp || exp < Date.now()) return { ok: false, reason: "unknown_or_expired_payment_id" };
    if (usedTx.has(transaction.toLowerCase())) return { ok: false, reason: "transaction_already_used" };
    const receipt = await rpc<{ status: string; logs: { address: string; topics: string[]; data: string }[] } | null>(
      cfg.rpcUrl,
      "eth_getTransactionReceipt",
      [transaction],
    );
    if (!receipt || receipt.status !== "0x1") return { ok: false, reason: "transaction_not_successful" };
    const log = receipt.logs.find(
      (l) =>
        l.address.toLowerCase() === cfg.router.toLowerCase() &&
        l.topics[0] === SETTLED_TOPIC &&
        l.topics[1]?.toLowerCase() === paymentId.toLowerCase(),
    );
    if (!log) return { ok: false, reason: "no_settlement_event" };
    if (topicAddr(log.topics[3]) !== cfg.payTo.toLowerCase()) return { ok: false, reason: "wrong_payee" };
    // data: buffer, recipient, amount, fee, mode, endpoint offset, ...
    const recipient = `0x${log.data.slice(2 + 64 + 24, 2 + 128)}`.toLowerCase();
    const amount = word(log.data, 2);
    const mode = word(log.data, 4);
    if (mode !== 0n || recipient !== cfg.payTo.toLowerCase()) return { ok: false, reason: "not_a_direct_payment" };
    if (amount < cfg.price) return { ok: false, reason: "insufficient_amount" };
    challenges.delete(paymentId);
    usedTx.add(transaction.toLowerCase());
    return { ok: true, payer: topicAddr(log.topics[2]) };
  }

  async function verifyExact(p: unknown, req: unknown) {
    const base = cfg.facilitatorUrl!.replace(/\/$/, "");
    const body = JSON.stringify({ x402Version: 2, paymentPayload: p, paymentRequirements: req });
    const v = (await (await fetch(`${base}/verify`, { method: "POST", headers: { "content-type": "application/json" }, body })).json()) as {
      isValid: boolean;
      invalidReason?: string;
    };
    if (!v.isValid) return { ok: false, reason: v.invalidReason ?? "invalid" };
    const s = (await (await fetch(`${base}/settle`, { method: "POST", headers: { "content-type": "application/json" }, body })).json()) as {
      success: boolean;
      errorReason?: string;
      transaction: string;
      payer?: string;
    };
    if (!s.success) return { ok: false, reason: s.errorReason ?? "settle_failed" };
    return { ok: true, payer: s.payer, transaction: s.transaction };
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (url.pathname !== "/data") {
      res.writeHead(404).end();
      return;
    }
    const sig = req.headers["payment-signature"];
    if (typeof sig !== "string") {
      res.writeHead(402, { "PAYMENT-REQUIRED": enc(requirements(url.toString())), "content-type": "application/json" });
      res.end("{}");
      return;
    }
    let payload: { accepted: { scheme: string; network: string; asset: string; payTo: string; amount: string }; payload: never };
    try {
      payload = dec(sig);
    } catch {
      res.writeHead(400).end("PAYMENT-SIGNATURE is not valid base64 JSON");
      return;
    }
    const a = payload.accepted;
    if (a.network !== network || a.asset.toLowerCase() !== cfg.usdg.toLowerCase() || a.payTo.toLowerCase() !== cfg.payTo.toLowerCase()) {
      res.writeHead(402, { "PAYMENT-REQUIRED": enc({ ...requirements(url.toString()), error: "accepted requirements do not match" }) });
      res.end();
      return;
    }
    const result =
      a.scheme === "unslept-direct"
        ? await verifyDirect(payload as never)
        : a.scheme === "exact" && cfg.facilitatorUrl
          ? await verifyExact(payload, a)
          : { ok: false, reason: "unsupported_scheme" };
    const transaction = (result as { transaction?: string }).transaction ?? (payload.payload as { transaction?: string })?.transaction ?? "";
    const settlement = {
      success: result.ok,
      ...(result.ok ? {} : { errorReason: (result as { reason: string }).reason }),
      transaction,
      network,
      payer: (result as { payer?: string }).payer,
    };
    if (!result.ok) {
      res.writeHead(402, { "PAYMENT-REQUIRED": enc(requirements(url.toString())), "PAYMENT-RESPONSE": enc(settlement) });
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json", "PAYMENT-RESPONSE": enc(settlement) });
    res.end(JSON.stringify({ price: "illustrative", data: [1, 2, 3], paidWith: a.scheme }));
  }

  return createServer((req, res) => {
    handle(req, res).catch((e) => {
      res.writeHead(500).end(String(e));
    });
  });
}

// Run directly: node --import tsx examples/x402-endpoint/server.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  const need = (k: string) => {
    const v = process.env[k];
    if (!v) throw new Error(`${k} is required`);
    return v;
  };
  const server = createEndpoint({
    rpcUrl: need("RPC_URL"),
    chainId: Number(need("CHAIN_ID")),
    usdg: need("USDG"),
    payTo: need("PAY_TO"),
    router: need("ROUTER"),
    price: BigInt(need("PRICE")),
    facilitatorUrl: process.env.FACILITATOR_URL,
    eip712Name: process.env.USDG_EIP712_NAME,
    eip712Version: process.env.USDG_EIP712_VERSION,
  });
  const port = Number(process.env.PORT ?? 4020);
  server.listen(port, () => console.log(`x402 sample endpoint on http://localhost:${port}/data`));
}
