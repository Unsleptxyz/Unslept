import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { dbConfigured, dbRpc } from "@/lib/server-db";
import { PROGRAM_ID, USDC_MINT, network, rpcUrl } from "@/lib/solana";

/**
 * Live x402 v2 demo endpoint on Solana.
 *
 * GET without PAYMENT-SIGNATURE answers 402 with PAYMENT-REQUIRED (scheme "unslept-direct", USDC).
 * The agent pays through the Unslept program, then retries with PAYMENT-SIGNATURE carrying the transaction signature
 * and the address of the on-chain Payment record. The server reads that record (owned by the Unslept program),
 * checks payment ID, payee and amount, and answers 200 with PAYMENT-RESPONSE.
 *
 * Stateless: the paymentId is an 8-byte expiry plus a 24-byte HMAC, so any instance can check it.
 * Each paymentId and each transaction is accepted once (un_demo_claim).
 * Config: DEMO_PAY_TO (Solana wallet), DEMO_PRICE (atomic USDC), INDEXER_SECRET.
 */
export const dynamic = "force-dynamic";

const PAYMENT_DISC = [227, 231, 51, 26, 244, 88, 4, 148];
const TTL_SECONDS = 600;

const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64");
const dec = <T,>(h: string): T => JSON.parse(Buffer.from(h, "base64").toString("utf8")) as T;

function config() {
  const payTo = process.env.DEMO_PAY_TO;
  const price = process.env.DEMO_PRICE;
  const secret = process.env.INDEXER_SECRET;
  if (!payTo || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(payTo) || !price || !/^\d+$/.test(price) || !secret) return undefined;
  return { payTo, price: BigInt(price), secret, network };
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
        asset: USDC_MINT.toBase58(),
        payTo: cfg.payTo,
        maxTimeoutSeconds: TTL_SECONDS,
        extra: { paymentId: newPaymentId(cfg.secret), program: PROGRAM_ID.toBase58() },
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

  let p: { accepted?: { scheme?: string; network?: string; asset?: string; payTo?: string; amount?: string }; payload?: { transaction?: string; paymentId?: string; payment?: string } };
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
  if (a.network !== cfg.network || a.asset !== USDC_MINT.toBase58() || a.payTo !== cfg.payTo) return fail("accepted_requirements_mismatch");
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(tx)) return fail("invalid_transaction_signature");
  const record = p.payload?.payment ?? "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(record)) return fail("invalid_payment_record");
  const idState = checkPaymentId(cfg.secret, paymentId);
  if (idState !== "ok") return fail(idState === "expired" ? "payment_id_expired" : "unknown_payment_id");

  const conn = new Connection(process.env.SOLANA_RPC_URL || rpcUrl, "confirmed");
  const acct = await conn.getAccountInfo(new PublicKey(record), "confirmed").catch(() => null);
  if (!acct) return fail("payment_record_not_found");
  if (!acct.owner.equals(PROGRAM_ID)) return fail("payment_record_not_from_unslept");
  const d = Buffer.from(acct.data);
  if (d.length < 120 || PAYMENT_DISC.some((b, i) => d[i] !== b)) return fail("payment_record_invalid");
  if (`0x${d.subarray(8, 40).toString("hex")}` !== paymentId.toLowerCase()) return fail("payment_id_mismatch");
  const payer = new PublicKey(d.subarray(40, 72)).toBase58();
  if (new PublicKey(d.subarray(72, 104)).toBase58() !== cfg.payTo) return fail("wrong_payee");
  if (d.readBigUInt64LE(104) < cfg.price) return fail("insufficient_amount");

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
