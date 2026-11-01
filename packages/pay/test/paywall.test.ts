import { test } from "node:test";
import assert from "node:assert/strict";
import { createPaywall, SOLANA, type AccountReader } from "../src/index.ts";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const b58d = (s: string) => {
  let n = 0n;
  for (const c of s) n = n * 58n + BigInt(B58.indexOf(c));
  const out: number[] = [];
  while (n > 0n) { out.unshift(Number(n & 0xffn)); n >>= 8n; }
  for (const c of s) { if (c !== "1") break; out.unshift(0); }
  return Uint8Array.from(out);
};
const payTo = "7DNkxPNsu6hYKpwgHsVXgtnR4twnXKEUbffGDsWMM37Z";
const agent = "HCdAT1i8DC1FKwsKsaKtpnLwzqWjjuLFSGMMpFyVxvv1";
const record = "5UwLn5mb4zx6JM62E28YjvnTwt18LRtDBi3ue3ftKFEC";
const tx = "5".repeat(88);

function recordData(paymentId: string, amount: bigint, payee = payTo) {
  const d = new Uint8Array(8 + 32 * 3 + 16 + 32 + 16 + 33);
  d.set([227, 231, 51, 26, 244, 88, 4, 148], 0);
  d.set(Buffer.from(paymentId.slice(2), "hex"), 8);
  d.set(b58d(agent), 40);
  d.set(b58d(payee), 72);
  new DataView(d.buffer).setBigUint64(104, amount, true);
  return d;
}

async function setup(amount = 10_000n, opts: { owner?: string; payee?: string } = {}) {
  let paymentId = "0x";
  const reader: AccountReader = async (addr) =>
    addr === record ? { owner: opts.owner ?? SOLANA.program, data: recordData(paymentId, amount, opts.payee) } : undefined;
  const pw = createPaywall({ payTo, price: 10_000n, secret: "a-test-secret-of-length", reader });
  const first = await pw.verify(new Request("https://api.example.com/x"));
  assert.equal(first.paid, false);
  if (first.paid) throw new Error("unreachable");
  assert.equal(first.response.status, 402);
  const pr = JSON.parse(Buffer.from(first.response.headers.get("PAYMENT-REQUIRED")!, "base64").toString());
  const accepted = pr.accepts[0];
  paymentId = accepted.extra.paymentId;
  const sig = Buffer.from(JSON.stringify({ x402Version: 2, accepted, payload: { transaction: tx, paymentId, agent, payment: record } })).toString("base64");
  const paidReq = () => new Request("https://api.example.com/x", { headers: { "PAYMENT-SIGNATURE": sig } });
  return { pw, paidReq, accepted };
}

test("402 offers USDC on Solana with a signed payment ID", async () => {
  const { accepted } = await setup();
  assert.equal(accepted.scheme, "unslept-direct");
  assert.equal(accepted.network, SOLANA.network);
  assert.equal(accepted.asset, SOLANA.usdc);
  assert.equal(accepted.amount, "10000");
  assert.match(accepted.extra.paymentId, /^0x[0-9a-f]{64}$/);
});

test("a valid payment record passes once, then is refused as reused", async () => {
  const { pw, paidReq } = await setup();
  const ok = await pw.verify(paidReq());
  assert.equal(ok.paid, true);
  if (ok.paid) assert.equal(ok.payment.payer, agent);
  assert.equal((await pw.verify(paidReq())).paid, false);
});

test("underpayment, wrong payee and foreign records are refused", async () => {
  const low = await setup(9_999n);
  assert.equal((await low.pw.verify(low.paidReq())).paid, false);
  const other = await setup(10_000n, { payee: agent });
  assert.equal((await other.pw.verify(other.paidReq())).paid, false);
  const foreign = await setup(10_000n, { owner: agent });
  assert.equal((await foreign.pw.verify(foreign.paidReq())).paid, false);
});

test("rejects EVM payTo", () => {
  assert.throws(() => createPaywall({ payTo: "0x00000000000000000000000000000000000000aa", price: 1n, secret: "a-test-secret-of-length" }));
});

test("protect() adds PAYMENT-RESPONSE to the handler response", async () => {
  const { pw, paidReq } = await setup();
  const handler = pw.protect(async (_req, payment) => Response.json({ ok: true, payer: payment.payer }));
  const res = await handler(paidReq());
  assert.equal(res.status, 200);
  assert.ok(res.headers.get("PAYMENT-RESPONSE"));
});
