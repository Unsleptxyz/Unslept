import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Unslept,
  UnsleptError,
  decodeHeader,
  encodeHeader,
  b58decode,
  b58encode,
  type AccountState,
  type PaymentRequestInput,
  type UnsleptChain,
} from "../src/index.js";

const NET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const PAYEE = "7DNkxPNsu6hYKpwgHsVXgtnR4twnXKEUbffGDsWMM37Z";
const AGENT = "HCdAT1i8DC1FKwsKsaKtpnLwzqWjjuLFSGMMpFyVxvv1";

class FakeChain implements UnsleptChain {
  network = NET;
  usdc = USDC;
  calls: PaymentRequestInput[] = [];
  state: AccountState = {
    policy: { perCallCap: 5_000_000n, dailyCap: 20_000_000n },
    remainingToday: 20_000_000n,
    paused: false,
    revoked: false,
    liquid: 0n,
    parked: 100_000_000n,
    debt: 0n,
    allowlist: [],
  };
  async isPayeeAllowed(p: string) {
    return this.state.allowlist.length === 0 || this.state.allowlist.includes(p);
  }
  async getAccountState() {
    return this.state;
  }
  async requestPayment(i: PaymentRequestInput) {
    this.calls.push(i);
    this.state.remainingToday -= i.amount;
    return { transaction: "5sig", fee: i.amount / 1000n, payment: "PaymentRecord1111111111111111111111111111111" };
  }
  async getPayments() {
    return [];
  }
}

function paywall(price: string, network = NET) {
  const seen: Headers[] = [];
  const f = async (_input: unknown, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    seen.push(h);
    if (!h.get("PAYMENT-SIGNATURE")) {
      const pr = {
        x402Version: 2,
        resource: { url: "https://api.example.com/data" },
        accepts: [{ scheme: "unslept-direct", network, amount: price, asset: USDC, payTo: PAYEE, maxTimeoutSeconds: 60, extra: { paymentId: `0x${"ab".repeat(32)}` } }],
      };
      return new Response("{}", { status: 402, headers: { "PAYMENT-REQUIRED": encodeHeader(pr) } });
    }
    return new Response('{"ok":true}', { status: 200, headers: { "PAYMENT-RESPONSE": encodeHeader({ success: true, transaction: "5sig", network }) } });
  };
  return { fetch: f as unknown as typeof fetch, seen };
}

test("base58 round trip", () => {
  const b = b58decode(AGENT);
  assert.equal(b.length, 32);
  assert.equal(b58encode(b), AGENT);
});

test("rejects a non-Solana agent address", () => {
  assert.throws(() => new Unslept({ agent: "0x1234", chain: new FakeChain() }), /base58/);
});

test("pays a 402 and retries with PAYMENT-SIGNATURE", async () => {
  const chain = new FakeChain();
  const pw = paywall("10000");
  const u = new Unslept({ agent: AGENT, chain, fetch: pw.fetch });
  const res = await u.fetch("https://api.example.com/data");
  assert.equal(res.status, 200);
  assert.equal(chain.calls.length, 1);
  assert.equal(chain.calls[0].payee, PAYEE);
  assert.equal(chain.calls[0].amount, 10_000n);
  assert.equal(chain.calls[0].paymentId, `0x${"ab".repeat(32)}`);
  const payload = decodeHeader<any>(pw.seen[1].get("PAYMENT-SIGNATURE")!);
  assert.equal(payload.payload.transaction, "5sig");
  assert.equal(payload.payload.agent, AGENT);
  assert.ok(payload.payload.payment);
  assert.equal(u.localPayments().length, 1);
});

test("refuses other networks", async () => {
  const u = new Unslept({ agent: AGENT, chain: new FakeChain(), fetch: paywall("10000", "eip155:1").fetch });
  await assert.rejects(u.fetch("https://api.example.com/data"), (e: UnsleptError) => e.code === "NO_MATCHING_REQUIREMENT");
});

test("enforces caps, allowlist and maxAmount before paying", async () => {
  const chain = new FakeChain();
  const u = new Unslept({ agent: AGENT, chain, fetch: paywall("6000000").fetch });
  await assert.rejects(u.fetch("https://api.example.com/data"), (e: UnsleptError) => e.code === "PER_CALL_CAP");
  const u2 = new Unslept({ agent: AGENT, chain, fetch: paywall("10000").fetch });
  await assert.rejects(u2.fetch("https://x.example/a", undefined, { maxAmount: 5000n }), (e: UnsleptError) => e.code === "MAX_AMOUNT");
  chain.state.allowlist = [AGENT];
  await assert.rejects(u2.fetch("https://x.example/a"), (e: UnsleptError) => e.code === "PAYEE_NOT_ALLOWED");
  chain.state.allowlist = [];
  chain.state.paused = true;
  await assert.rejects(u2.fetch("https://x.example/a"), (e: UnsleptError) => e.code === "AGENT_PAUSED");
  assert.equal(chain.calls.length, 0);
});

test("refuses when the position cannot back the payment", async () => {
  const chain = new FakeChain();
  chain.state.parked = 1_000n;
  const u = new Unslept({ agent: AGENT, chain, fetch: paywall("10000").fetch });
  await assert.rejects(u.fetch("https://x.example/a"), (e: UnsleptError) => e.code === "INSUFFICIENT_COLLATERAL");
});

test("passes non-402 responses through untouched", async () => {
  const u = new Unslept({ agent: AGENT, chain: new FakeChain(), fetch: (async () => new Response("hi")) as unknown as typeof fetch });
  assert.equal(await (await u.fetch("https://x.example")).text(), "hi");
});
