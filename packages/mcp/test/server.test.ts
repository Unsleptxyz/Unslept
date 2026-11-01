import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { handle, parseUsdc, serveStdio, type UnsleptLike } from "../src/server.js";

function stub(): UnsleptLike & { lastMax?: bigint } {
  const log: unknown[] = [];
  const s = {
    lastMax: undefined as bigint | undefined,
    async fetch(_u: unknown, _i: unknown, o?: { maxAmount?: bigint }) {
      s.lastMax = o?.maxAmount;
      log.push({ amount: 250_000n, fee: 250n, payee: "0xpayee", scheme: "unslept-direct", transaction: "5abc" });
      return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } });
    },
    async getBalances() {
      return { liquid: 1_000_000n, working: 49_000_000n, debt: 250_250n, net: 49_749_750n };
    },
    async getPayments() {
      return [];
    },
    async getPolicy() {
      return { perCallCap: 1_000_000n, dailyCap: 10_000_000n, remainingToday: 9_750_000n, paused: false, revoked: false };
    },
    localPayments() {
      return log as never;
    },
  };
  return s as never;
}

test("initialize negotiates a supported protocol version", async () => {
  const r = (await handle(stub(), { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } })) as {
    result: { protocolVersion: string; capabilities: { tools: object } };
  };
  assert.equal(r.result.protocolVersion, "2025-06-18");
  assert.ok(r.result.capabilities.tools);
  const r2 = (await handle(stub(), { jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } })) as {
    result: { protocolVersion: string };
  };
  assert.equal(r2.result.protocolVersion, "2025-11-25");
});

test("lists exactly the four Unslept tools", async () => {
  const r = (await handle(stub(), { jsonrpc: "2.0", id: 1, method: "tools/list" })) as { result: { tools: { name: string }[] } };
  assert.deepEqual(r.result.tools.map((t) => t.name), ["pay_x402_request", "get_balances", "get_payment_history", "get_policy"]);
});

test("pay_x402_request returns the response and the payment", async () => {
  const s = stub();
  const r = (await handle(s, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "pay_x402_request", arguments: { url: "https://api.example.com/data", max_amount_usdc: "0.50" } },
  })) as { result: { structuredContent: { status: number; payment: { amountUsdc: string } } } };
  assert.equal(r.result.structuredContent.status, 200);
  assert.equal(r.result.structuredContent.payment.amountUsdc, "0.250000");
  assert.equal(s.lastMax, 500_000n);
});

test("tool errors come back as isError results, not protocol errors", async () => {
  const r = (await handle(stub(), {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "pay_x402_request", arguments: { url: "ftp://x" } },
  })) as { result: { isError: boolean } };
  assert.equal(r.result.isError, true);
  const u = (await handle(stub(), { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope" } })) as { error: { code: number } };
  assert.equal(u.error.code, -32602);
});

test("balances and policy are formatted in USDC", async () => {
  const b = (await handle(stub(), { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "get_balances" } })) as {
    result: { structuredContent: Record<string, string> };
  };
  assert.equal(b.result.structuredContent.workingUsdc, "49.000000");
  const p = (await handle(stub(), { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "get_policy" } })) as {
    result: { structuredContent: Record<string, string> };
  };
  assert.equal(p.result.structuredContent.perCallCapUsdc, "1.000000");
});

test("parseUsdc", () => {
  assert.equal(parseUsdc("1"), 1_000_000n);
  assert.equal(parseUsdc("0.000001"), 1n);
  assert.throws(() => parseUsdc("-1"));
  assert.throws(() => parseUsdc("1.0000001"));
});

test("stdio transport answers requests and ignores notifications", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  serveStdio(stub(), input, output);
  const lines: string[] = [];
  output.on("data", (c) => lines.push(...String(c).trim().split("\n")));
  input.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }) + "\n");
  input.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  input.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
  input.write("not json\n");
  await new Promise((r) => setTimeout(r, 50));
  const msgs = lines.map((l) => JSON.parse(l));
  assert.equal(msgs.length, 3);
  assert.ok(msgs.some((m) => m.id === 1 && m.result));
  assert.ok(msgs.some((m) => m.id === 2 && m.result.tools.length === 4));
  assert.ok(msgs.some((m) => m.error?.code === -32700));
});
