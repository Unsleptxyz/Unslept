import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, decodeEventLog, http, parseAbiItem } from "viem";
import { dbConfigured, dbRpc } from "@/lib/server-db";
import { addresses, chain } from "@/lib/web3";

/**
 * Live x402 v2 demo endpoint on Robinhood Chain mainnet.
 *
 * GET without PAYMENT-SIGNATURE answers 402 with PAYMENT-REQUIRED (scheme "unslept-direct").
 * The agent pays through the SettlementRouter, then retries with PAYMENT-SIGNATURE carrying the transaction hash.
 * The server checks the Settled event in the receipt and answers 200 with PAYMENT-RESPONSE.
 *
 * Stateless: the paymentId is an 8-byte expiry plus a 24-byte HMAC, so any instance can check it.
 * Each paymentId and each transaction is accepted once (un_demo_claim).
 * Config: DEMO_PAY_TO, DEMO_PRICE (atomic USDG), INDEXER_SECRET.
 */
export const dynamic = "force-dynamic";

const settled = parseAbiItem(
  "event Settled(bytes32 indexed paymentId, address indexed agent, address indexed payee, address buffer, address recipient, uint256 amount, uint256 fee, uint8 mode, string endpoint)",
);
const TTL_SECONDS = 600;

const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64");
const dec = <T,>(h: string): T => JSON.parse(Buffer.from(h, "base64").toString("utf8")) as T;

function config() {
  const payTo = process.env.DEMO_PAY_TO;
  const price = process.env.DEMO_PRICE;
  const secret = process.env.INDEXER_SECRET;
  if (!chain || !addresses.usdg || !addresses.router || !payTo || !/^0x[0-9a-fA-F]{40}$/.test(payTo) || !price || !/^\d+$/.test(price) || !secret) {
    return undefined;
  }
  return { chain, payTo: payTo as `0x${string}`, price: BigInt(price), secret, network: `eip155:${chain.id}` };
}

function mac(secret: string, expiryHex: string) {
  return createHmac("sha256", `${secret}:x402-demo`).update(expiryHex).digest("hex").slice(0, 48);
}

function newPaymentId(secret: string) {
  const expiryHex = BigInt(Math.floor(Date.now() / 1000) + TTL_SECONDS).toString(16).padStart(16, "0");
  return `0x${expiryHex}${mac(secret, expiryHex)}` as `0x${string}`;
}

function checkPaymentId(secret: string, id: string): "ok" | "invalid" | "expired" {
  if (!/^0x[0-9a-fA-F]{64}$/.test(id)) return "invalid";
  const expiryHex = id.slice(2, 18).toLowerCase();
  const a = Buffer.from(id.slice(18).toLowerCase(), "hex");
  const b = Buffer.from(mac(secret, expiryHex), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "invalid";
  return Number.parseInt(expiryHex, 16) * 1000 < Date.now() ? "expired" : "ok";
}

function requirements(cfg: NonNullable<ReturnType<typeof config>>, resourceUrl: string, error = "PAYMENT-SIGNATURE header is required") {
  return {
    x402Version: 2,
    error,
    resource: { url: resourceUrl, description: "Unslept live protocol snapshot (demo)", mimeType: "application/json" },
    accepts: [
      {
        scheme: "unslept-direct",
        network: cfg.network,
        amount: cfg.price.toString(),
        asset: addresses.usdg,
        payTo: cfg.payTo,
        maxTimeoutSeconds: TTL_SECONDS,
        extra: { paymentId: newPaymentId(cfg.secret), router: addresses.router },
      },
    ],
  };
}

function paymentRequired(cfg: NonNullable<ReturnType<typeof config>>, url: string, error?: string, settlement?: object) {
  const headers: Record<string, string> = { "PAYMENT-REQUIRED": enc(requirements(cfg, url, error)), "Cache-Control": "no-store" };
  if (settlement) headers["PAYMENT-RESPONSE"] = enc(settlement);
  return NextResponse.json({ error: error ?? "Payment required." }, { status: 402, headers });
}

export async function GET(req: NextRequest) {
  const cfg = config();
  if (!cfg || !dbConfigured()) return NextResponse.json({ error: "The demo endpoint is not configured on this deployment." }, { status: 503 });
  const url = req.nextUrl.toString().split("?")[0];

  const sig = req.headers.get("payment-signature");
  if (!sig) return paymentRequired(cfg, url);

  let p: { accepted?: { scheme?: string; network?: string; asset?: string; payTo?: string; amount?: string }; payload?: { transaction?: string; paymentId?: string } };
  try {
    p = dec(sig);
  } catch {
    return NextResponse.json({ error: "PAYMENT-SIGNATURE is not valid base64 JSON." }, { status: 400 });
  }
  const a = p.accepted ?? {};
  const tx = p.payload?.transaction ?? "";
  const paymentId = p.payload?.paymentId ?? "";
  const fail = (reason: string) => paymentRequired(cfg, url, reason, { success: false, errorReason: reason, transaction: tx, network: cfg.network });

  if (a.scheme !== "unslept-direct") return fail("unsupported_scheme");
  if (a.network !== cfg.network || a.asset?.toLowerCase() !== addresses.usdg.toLowerCase() || a.payTo?.toLowerCase() !== cfg.payTo.toLowerCase()) {
    return fail("accepted_requirements_mismatch");
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) return fail("invalid_transaction_hash");
  const idState = checkPaymentId(cfg.secret, paymentId);
  if (idState !== "ok") return fail(idState === "expired" ? "payment_id_expired" : "unknown_payment_id");

  const client = createPublicClient({ chain: cfg.chain, transport: http() });
  const receipt = await client.getTransactionReceipt({ hash: tx as `0x${string}` }).catch(() => undefined);
  if (!receipt || receipt.status !== "success") return fail("transaction_not_successful");

  let payer: string | undefined;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== addresses.router.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: [settled], data: log.data, topics: log.topics });
      const v = ev.args;
      if (v.paymentId.toLowerCase() !== paymentId.toLowerCase()) continue;
      if (v.payee.toLowerCase() !== cfg.payTo.toLowerCase() || v.recipient.toLowerCase() !== cfg.payTo.toLowerCase()) return fail("wrong_payee");
      if (v.mode !== 0) return fail("not_a_direct_payment");
      if (v.amount < cfg.price) return fail("insufficient_amount");
      payer = v.agent;
      break;
    } catch {
      continue;
    }
  }
  if (!payer) return fail("no_settlement_event");

  const fresh = await dbRpc<boolean>("un_demo_claim", { p_tx: tx, p_payment_id: paymentId, p_payer: payer }).catch(() => false);
  if (!fresh) return fail("payment_already_used");

  const stats = await dbRpc("un_stats", {}, false).catch(() => null);
  const settlement = { success: true, transaction: tx, network: cfg.network, payer };
  return NextResponse.json(
    {
      message: "Payment settled. This is the paid response.",
      paidWith: "unslept-direct",
      snapshot: stats,
      at: new Date().toISOString(),
    },
    { status: 200, headers: { "PAYMENT-RESPONSE": enc(settlement), "Cache-Control": "no-store" } },
  );
}
