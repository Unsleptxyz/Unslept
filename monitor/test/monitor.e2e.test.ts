/** Runs inside scripts/e2e.sh against the local deployment. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { netBalance, protocolChecks, sendOps, sign, type MonitorConfig } from "../src/monitor.js";
import { createHmac } from "node:crypto";

const env = process.env;

test("monitor reads protocol state and an agent's net balance", { skip: !env.E2E_RPC }, async () => {
  const received: string[] = [];
  const ops = createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      received.push(b);
      res.end("ok");
    });
  });
  await new Promise<void>((r) => ops.listen(0, r));
  const cfg: MonitorConfig = {
    rpcUrl: env.E2E_RPC!,
    buffer: env.E2E_BUFFER!,
    router: env.E2E_ROUTER!,
    factory: env.E2E_FACTORY!,
    timelock: env.E2E_TIMELOCK,
    adapters: [{ address: env.E2E_ADAPTER!, maxStaleness: 10 * 365 * 86400 }],
    utilizationAlertBps: -1n, // below any reading, so the alert path is exercised
    minAvailable: 10n ** 18n, // always below: exercises the low-liquidity alert
    lookbackBlocks: 1000n,
    opsWebhook: `http://localhost:${(ops.address() as AddressInfo).port}`,
  };
  try {
  const alerts = await protocolChecks(cfg);
  const kinds = alerts.map((a) => a.key.split(":")[0]);
  assert.ok(kinds.includes("utilization"), "utilization alert");
  assert.ok(kinds.includes("available"), "low liquidity alert");
  assert.ok(!kinds.includes("buffer-paused"));
  assert.ok(!kinds.includes("stale"));
  await sendOps(cfg, alerts, new Set());
  assert.equal(received.length, 1);
  assert.match(JSON.parse(received[0]).text, /Buffer utilization is/);
  const net = await netBalance(cfg, env.E2E_AGENT!);
  assert.ok(net !== undefined && net > 0n && net < 50_000_000n, `net balance ${net}`);
  } finally {
    ops.closeAllConnections();
    ops.close();
  }
});

test("webhook signatures verify with HMAC-SHA256 over t.body", () => {
  const s = sign("whsec_test", '{"a":1}', 1700000000);
  const expected = createHmac("sha256", "whsec_test").update('1700000000.{"a":1}').digest("hex");
  assert.equal(s, `t=1700000000,v1=${expected}`);
});
