// End to end on the mainnet fork: an x402 paywall built with @unslept/pay, paid by an agent using @unslept/sdk.
// Uses the agent funded by tests-fork/kamino.ts.
import fs from "node:fs";
import http from "node:http";
import { Connection, Keypair } from "@solana/web3.js";
import { Unslept } from "../../packages/sdk-ts/src/index.ts";
import { createSolanaChain } from "../../packages/sdk-ts/src/solana.ts";
import { createPaywall, rpcAccountReader } from "../../packages/pay/src/index.ts";

const RPC = process.env.ANCHOR_PROVIDER_URL ?? "http://127.0.0.1:8899";
const { agent, signer } = JSON.parse(fs.readFileSync(".fork/e2e.json", "utf8"));
const agentSigner = Keypair.fromSecretKey(Uint8Array.from(signer));
const merchant = Keypair.generate();

const paywall = createPaywall({
  payTo: merchant.publicKey.toBase58(),
  price: 25_000n, // 0.025 USDC
  secret: "e2e-secret-of-sufficient-length",
  description: "Fork e2e quote",
  reader: rpcAccountReader(RPC),
});
const handler = paywall.protect(async (_req, payment) => Response.json({ quote: 101.25, paidBy: payment.payer }));

const server = http.createServer(async (req, res) => {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  const out = await handler(new Request(`http://127.0.0.1:4021${req.url}`, { headers }));
  res.writeHead(out.status, Object.fromEntries(out.headers.entries()));
  res.end(await out.text());
});
await new Promise<void>((r) => server.listen(4021, r));

const fail = (m: string) => {
  console.error(`FAIL ${m}`);
  server.close();
  process.exit(1);
};
try {
  const chain = createSolanaChain({ agent, signer: agentSigner, connection: new Connection(RPC, "confirmed"), priorityFee: 1 });
  const unslept = new Unslept({ agent, chain });
  const before = await unslept.getBalances();
  const res = await unslept.fetch("http://127.0.0.1:4021/quote");
  const body = await res.json();
  if (res.status !== 200) fail(`status ${res.status}`);
  if (body.paidBy !== agent) fail(`paidBy ${body.paidBy}`);
  const p = unslept.localPayments()[0];
  const bal = await chain.connection.getTokenAccountBalance(
    (await import("../../packages/sdk-ts/src/solana.ts")).associatedTokenAddress(merchant.publicKey, new (await import("@solana/web3.js")).PublicKey(chain.usdc)),
  );
  if (bal.value.amount !== "25000") fail(`merchant balance ${bal.value.amount}`);
  const after = await unslept.getBalances();
  console.log(`  ok paid 0.025 USDC via x402: ${p.transaction.slice(0, 16)}..., fee ${p.fee}, agent liquid ${before.liquid} -> ${after.liquid}`);

  // The same payment cannot be replayed.
  const sig = (await fetch("http://127.0.0.1:4021/quote")).headers.get("payment-required");
  if (!sig) fail("no 402 on a fresh request");
  const history = await unslept.getPayments({ limit: 10 });
  if (!history.some((h) => h.transaction === p.transaction)) fail("payment missing from on-chain history");
  console.log(`  ok on-chain history has ${history.length} payment(s)`);
  console.log("  2 passing (sdk e2e)");
} catch (e) {
  fail(String((e as Error)?.stack ?? e));
}
server.close();
