import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Unslept,
  UnsleptError,
  SettlementMode,
  decodeHeader,
  encodeHeader,
  type AccountState,
  type PaymentRequestInput,
  type UnsleptChain,
} from "../src/index.js";

const USDG = "0x00000000000000000000000000000000000000aa" as const;
const PAYEE = "0x00000000000000000000000000000000000000bb" as const;
const AGENT = "0x00000000000000000000000000000000000000cc" as const;

class FakeChain implements UnsleptChain {
  chainId = 4242;
  usdg = USDG;
  calls: PaymentRequestInput[] = [];
  state: AccountState = {
    policy: { perCallCap: 5_000_000n, dailyCap: 20_000_000n },
    remainingToday: 20_000_000n,
    paused: false,
    revoked: false,
    liquid: 0n,
    parked: 100_000_000n,
    debt: 0n,
  };
  allowed = new Set<string>([PAYEE]);
  async isPayeeAllowed(p: string, d: string) {
    return this.allowed.has(p) || this.allowed.has(d);
  }
  async getAccountState() {
    return this.state;
  }
  async requestPayment(i: PaymentRequestInput) {
    this.calls.push(i);
    this.state.remainingToday -= i.amount;
    return { transactionHash: `0x${"11".repeat(32)}` as `0x${string}`, fee: i.amount / 1000n, buffer: USDG };
  }
  async setPolicy() {
    return `0x${"22".repeat(32)}` as `0x${string}`;
  }
  async getPayments() {
    return [];
  }
}

function paywall(price: string, schemes: string[] = ["unslept-direct"]) {
  const seen: Headers[] = [];
  const f = async (_input: unknown, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    seen.push(h);
    const sig = h.get("PAYMENT-SIGNATURE");
    if (!sig) {
      const pr = {
        x402Version: 2,
        resource: { url: "https://api.example.com/data" },
        accepts: schemes.map((scheme) => ({
          scheme,
          network: "eip155:4242",
          amount: price,
          asset: USDG,
          payTo: PAYEE,
          maxTimeoutSeconds: 60,
          extra: scheme === "exact" ? { name: "Global Dollar", version: "2" } : { paymentId: `0x${"ab".repeat(32)}` },
        })),
      };
      return new Response("{}", { status: 402, headers: { "PAYMENT-REQUIRED": encodeHeader(pr) } });
    }
    return new Response('{"ok":true}', {
      status: 200,
      headers: { "PAYMENT-RESPONSE": encodeHeader({ success: true, transaction: `0x${"11".repeat(32)}`, network: "eip155:4242" }) },
    });
  };
  return { fetch: f as unknown as typeof fetch, seen };
}

test("passes through non-402 responses untouched", async () => {
  const chain = new FakeChain();
  const u = new Unslept({ agentAccount: AGENT, signer: {}, network: "robinhood-chain", chain, fetch: (async () => new Response("hi")) as never });
  const r = await u.fetch("https://api.example.com/free");
  assert.equal(await r.text(), "hi");
  assert.equal(chain.calls.length, 0);
});

test("pays a 402 through the buffer and retries with PAYMENT-SIGNATURE", async () => {
  const chain = new FakeChain();
  const pw = paywall("1000000");
  const payments: unknown[] = [];
  const u = new Unslept({ agentAccount: AGENT, signer: {}, network: "robinhood-chain", chain, fetch: pw.fetch, onPayment: (p) => payments.push(p) });
  const r = await u.fetch("https://api.example.com/data");
  assert.equal(r.status, 200);
  assert.equal(chain.calls.length, 1);
  assert.equal(chain.calls[0].mode, SettlementMode.Direct);
  assert.equal(chain.calls[0].paymentId, `0x${"ab".repeat(32)}`, "uses the server-issued payment id");
  assert.equal(chain.calls[0].domain, "api.example.com");
  const sent = decodeHeader<{ x402Version: number; accepted: { scheme: string }; payload: { transaction: string; agentAccount: string } }>(
    pw.seen[1].get("PAYMENT-SIGNATURE")!,
  );
  assert.equal(sent.x402Version, 2);
  assert.equal(sent.accepted.scheme, "unslept-direct");
  assert.equal(sent.payload.agentAccount, AGENT);
  assert.equal(payments.length, 1);
  const [log] = u.localPayments();
  assert.equal(log.endpoint, "https://api.example.com/data");
  assert.equal(log.amount, 1_000_000n);
  assert.equal(log.payee, PAYEE);
  assert.ok(log.transactionHash.startsWith("0x"));
});

test("rejects a payment over the per-call cap with a clear error", async () => {
  const chain = new FakeChain();
  const u = new Unslept({ agentAccount: AGENT, signer: {}, network: "robinhood-chain", chain, fetch: paywall("6000000").fetch });
  await assert.rejects(u.fetch("https://api.example.com/data"), (e: unknown) => {
    assert.ok(e instanceof UnsleptError);
    assert.equal(e.code, "PER_CALL_CAP");
    assert.match(e.message, /6 USDG is above the per-call cap of 5 USDG/);
    return true;
  });
  assert.equal(chain.calls.length, 0, "nothing was settled");
});

test("empty wallet cannot pay", async () => {
  const chain = new FakeChain();
  chain.state.parked = 0n;
  const u = new Unslept({ agentAccount: AGENT, signer: {}, network: "robinhood-chain", chain, fetch: paywall("1000000").fetch });
  await assert.rejects(u.fetch("https://api.example.com/data"), (e: unknown) => (e as UnsleptError).code === "INSUFFICIENT_COLLATERAL");
  assert.equal(chain.calls.length, 0);
});

test("enforces daily cap, allowlist, pause and maxAmount", async () => {
  const chain = new FakeChain();
  const mk = () => new Unslept({ agentAccount: AGENT, signer: {}, network: "robinhood-chain", chain, fetch: paywall("1000000").fetch });
  chain.state.remainingToday = 500_000n;
  await assert.rejects(mk().fetch("https://api.example.com/data"), (e: unknown) => (e as UnsleptError).code === "DAILY_CAP");
  chain.state.remainingToday = 20_000_000n;
  chain.allowed.clear();
  await assert.rejects(mk().fetch("https://api.example.com/data"), (e: unknown) => (e as UnsleptError).code === "PAYEE_NOT_ALLOWED");
  chain.allowed.add("api.example.com");
  chain.state.paused = true;
  await assert.rejects(mk().fetch("https://api.example.com/data"), (e: unknown) => (e as UnsleptError).code === "AGENT_PAUSED");
  chain.state.paused = false;
  await assert.rejects(mk().fetch("https://api.example.com/data", undefined, { maxAmount: 999_999n }), (e: unknown) => (e as UnsleptError).code === "MAX_AMOUNT");
  const r = await mk().fetch("https://api.example.com/data");
  assert.equal(r.status, 200, "domain allowlisting works");
});

test("standard exact scheme signs an EIP-3009 authorization bound to payTo and amount", async () => {
  const chain = new FakeChain();
  const pw = paywall("2500000", ["exact"]);
  let typed: { domain: Record<string, unknown>; message: Record<string, unknown>; primaryType: string } | undefined;
  const signer = {
    address: "0x00000000000000000000000000000000000000dd" as const,
    async signTypedData(a: never) {
      typed = a;
      return `0x${"33".repeat(65)}` as `0x${string}`;
    },
  };
  const u = new Unslept({ agentAccount: AGENT, signer, network: "robinhood-chain", chain, fetch: pw.fetch });
  await u.fetch("https://api.example.com/data");
  assert.equal(chain.calls[0].mode, SettlementMode.Exact);
  assert.equal(typed!.primaryType, "TransferWithAuthorization");
  assert.deepEqual(typed!.domain, { name: "Global Dollar", version: "2", chainId: 4242, verifyingContract: USDG });
  assert.equal(typed!.message.to, PAYEE);
  assert.equal(typed!.message.value, 2_500_000n);
  assert.equal(typed!.message.nonce, chain.calls[0].paymentId, "EIP-3009 nonce doubles as the payment id");
  const sent = decodeHeader<{ payload: { authorization: { from: string; value: string } } }>(pw.seen[1].get("PAYMENT-SIGNATURE")!);
  assert.equal(sent.payload.authorization.from, signer.address);
  assert.equal(sent.payload.authorization.value, "2500000");
});

test("no matching network or asset gives an actionable error", async () => {
  const chain = new FakeChain();
  chain.chainId = 1;
  const u = new Unslept({ agentAccount: AGENT, signer: {}, network: "robinhood-chain", chain, fetch: paywall("1").fetch });
  await assert.rejects(u.fetch("https://api.example.com/data"), (e: unknown) => {
    assert.equal((e as UnsleptError).code, "NO_MATCHING_REQUIREMENT");
    assert.match((e as Error).message, /It offers: unslept-direct on eip155:4242/);
    return true;
  });
});

test("onLowBalance fires after a payment drops the balance", async () => {
  const chain = new FakeChain();
  chain.state.parked = 1_500_000n;
  const u = new Unslept({ agentAccount: AGENT, signer: {}, network: "robinhood-chain", chain, fetch: paywall("1000000").fetch });
  let fired = 0;
  u.onLowBalance(() => fired++, { threshold: 2_000_000n });
  await u.fetch("https://api.example.com/data");
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(fired, 1);
});

test("rejects bad configuration early", () => {
  assert.throws(() => new Unslept({ agentAccount: "nope", signer: {}, network: "robinhood-chain" }), /agentAccount must be/);
});

test("policy violations are reported, signed by the agent signer", async () => {
  const chain = new FakeChain();
  const pw = paywall("6000000");
  const reports: { url: string; body: Record<string, string> }[] = [];
  const f = (async (input: unknown, init?: RequestInit) => {
    if (String(input).endsWith("/api/alerts")) {
      reports.push({ url: String(input), body: JSON.parse(String(init!.body)) });
      return new Response("{}");
    }
    return pw.fetch(input as never, init);
  }) as unknown as typeof fetch;
  const signer = { address: "0x00000000000000000000000000000000000000dd", signMessage: async () => "0xsig" };
  const u = new Unslept({ agentAccount: AGENT, signer, network: "robinhood-chain", chain, fetch: f, reportUrl: "https://app.example.com/" });
  await assert.rejects(u.fetch("https://api.example.com/data"));
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(reports.length, 1);
  assert.equal(reports[0].url, "https://app.example.com/api/alerts");
  assert.equal(reports[0].body.code, "PER_CALL_CAP");
  assert.equal(reports[0].body.signature, "0xsig");
});
