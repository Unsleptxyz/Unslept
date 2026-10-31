import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters, encodeEventTopics, parseAbiItem, pad } from "viem";
import { createPaywall, ROBINHOOD_CHAIN } from "../src/index.ts";

const payTo = "0x00000000000000000000000000000000000000aa";
const agent = "0x00000000000000000000000000000000000000bb";
const ev = parseAbiItem(
  "event Settled(bytes32 indexed paymentId, address indexed agent, address indexed payee, address buffer, address recipient, uint256 amount, uint256 fee, uint8 mode, string endpoint)",
);
const tx = `0x${"11".repeat(32)}`;

function receiptFor(paymentId: `0x${string}`, amount: bigint, mode = 0) {
  return {
    status: "success" as const,
    logs: [
      {
        address: ROBINHOOD_CHAIN.router,
        topics: encodeEventTopics({ abi: [ev], eventName: "Settled", args: { paymentId, agent, payee: payTo } }),
        data: encodeAbiParameters(
          [{ type: "address" }, { type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "uint8" }, { type: "string" }],
          [pad("0x01", { size: 20 }), payTo, amount, 0n, mode, "https://api.example.com/x"],
        ),
      },
    ],
  };
}

async function setup(amount = 10_000n, mode = 0) {
  let paymentId = "0x" as `0x${string}`;
  const pw = createPaywall({
    payTo,
    price: 10_000n,
    secret: "a-test-secret-of-length",
    client: { getTransactionReceipt: (async () => receiptFor(paymentId, amount, mode)) as never },
  });
  const first = await pw.verify(new Request("https://api.example.com/x"));
  assert.equal(first.paid, false);
  if (first.paid) throw new Error("unreachable");
  assert.equal(first.response.status, 402);
  const pr = JSON.parse(Buffer.from(first.response.headers.get("PAYMENT-REQUIRED")!, "base64").toString());
  const accepted = pr.accepts[0];
  paymentId = accepted.extra.paymentId;
  const sig = Buffer.from(JSON.stringify({ x402Version: 2, accepted, payload: { transaction: tx, paymentId, agentAccount: agent } })).toString("base64");
  const paidReq = () => new Request("https://api.example.com/x", { headers: { "PAYMENT-SIGNATURE": sig } });
  return { pw, paidReq, accepted };
}

test("402 offers USDG on Robinhood Chain with a signed payment ID", async () => {
  const { accepted } = await setup();
  assert.equal(accepted.scheme, "unslept-direct");
  assert.equal(accepted.network, "eip155:4663");
  assert.equal(accepted.amount, "10000");
  assert.match(accepted.extra.paymentId, /^0x[0-9a-f]{64}$/);
});

test("a valid settlement passes once, then is refused as reused", async () => {
  const { pw, paidReq } = await setup();
  const ok = await pw.verify(paidReq());
  assert.equal(ok.paid, true);
  const again = await pw.verify(paidReq());
  assert.equal(again.paid, false);
});

test("underpayment and non-direct settlements are refused", async () => {
  const low = await setup(9_999n);
  assert.equal((await low.pw.verify(low.paidReq())).paid, false);
  const exact = await setup(10_000n, 1);
  assert.equal((await exact.pw.verify(exact.paidReq())).paid, false);
});

test("protect() adds PAYMENT-RESPONSE to the handler response", async () => {
  const { pw, paidReq } = await setup();
  const handler = pw.protect(async (_req, payment) => Response.json({ ok: true, payer: payment.payer }));
  const res = await handler(paidReq());
  assert.equal(res.status, 200);
  assert.ok(res.headers.get("PAYMENT-RESPONSE"));
});
