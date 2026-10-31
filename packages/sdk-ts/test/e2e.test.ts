/**
 * End to end: real contracts on a local node, the sample x402 endpoint, and the SDK.
 * Run through scripts/e2e.sh, which starts anvil, deploys the protocol and exports E2E_* variables.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import { Unslept, UnsleptError } from "../src/index.js";
import { createEndpoint } from "../../../examples/x402-endpoint/server.js";
import { CastChain } from "./helpers/cast-chain.js";

const env = process.env;
const enabled = Boolean(env.E2E_RPC);

test("SDK pays the sample x402 endpoint end to end on a local chain", { skip: !enabled }, async () => {
  const rpc = env.E2E_RPC!;
  const chainId = Number(env.E2E_CHAIN_ID);
  const usdg = env.E2E_USDG as `0x${string}`;
  const merchant = env.E2E_MERCHANT as `0x${string}`;
  const balance = (a: string) => BigInt(execFileSync("cast", ["call", usdg, "balanceOf(address)(uint256)", a, "--rpc-url", rpc], { encoding: "utf8" }).split(" ")[0]);

  const server = createEndpoint({ rpcUrl: rpc, chainId, usdg, payTo: merchant, router: env.E2E_ROUTER!, price: 250_000n });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as AddressInfo).port;

  try {
    const chain = new CastChain(chainId, usdg, rpc, env.E2E_AGENT as `0x${string}`, env.E2E_BUFFER as `0x${string}`, env.E2E_SIGNER_KEY!);
    const unslept = new Unslept({ agentAccount: env.E2E_AGENT, signer: {}, network: "robinhood-chain", chain });

    const before = balance(merchant);
    const res = await unslept.fetch(`http://localhost:${port}/data`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { paidWith: string };
    assert.equal(body.paidWith, "unslept-direct");
    assert.equal(balance(merchant) - before, 250_000n, "merchant received exactly the price");
    const [p] = unslept.localPayments();
    assert.equal(p.settlement?.success, true);
    assert.match(p.transactionHash, /^0x[0-9a-f]{64}$/);

    // The same transaction cannot be replayed for a second request
    const replay = await fetch(`http://localhost:${port}/data`, {
      headers: {
        "PAYMENT-SIGNATURE": Buffer.from(
          JSON.stringify({ x402Version: 2, accepted: { scheme: "unslept-direct", network: `eip155:${chainId}`, asset: usdg, payTo: merchant, amount: "250000" }, payload: { transaction: p.transactionHash, paymentId: p.paymentId, agentAccount: env.E2E_AGENT } }),
        ).toString("base64"),
      },
    });
    assert.equal(replay.status, 402);

    // Over the per-call cap (1 USDG in the setup): rejected before anything moves on-chain
    const pricey = createEndpoint({ rpcUrl: rpc, chainId, usdg, payTo: merchant, router: env.E2E_ROUTER!, price: 2_000_000n });
    await new Promise<void>((r) => pricey.listen(0, r));
    const p2 = (pricey.address() as AddressInfo).port;
    const mid = balance(merchant);
    await assert.rejects(unslept.fetch(`http://localhost:${p2}/data`), (e: unknown) => (e as UnsleptError).code === "PER_CALL_CAP");
    assert.equal(balance(merchant), mid);
    pricey.close();
  } finally {
    server.close();
  }
});
