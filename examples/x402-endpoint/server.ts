/**
 * Sample x402 v2 endpoint for Unslept on Solana, built on @unslept/pay.
 *
 * GET /data costs PRICE atomic USDC (default 10000 = 0.01 USDC). Without payment it answers 402 with an
 * "unslept-direct" requirement; with a valid PAYMENT-SIGNATURE it checks the on-chain Payment record and answers 200.
 *
 *   PAY_TO=<your Solana wallet> PAYWALL_SECRET=<16+ chars> [PRICE] [SOLANA_RPC_URL] [PORT] node --import tsx server.ts
 */
import { createServer } from "node:http";
import { createPaywall } from "@unslept/pay";

const paywall = createPaywall({
  payTo: process.env.PAY_TO!,
  price: BigInt(process.env.PRICE ?? "10000"),
  secret: process.env.PAYWALL_SECRET!,
  description: "Sample data",
  rpcUrl: process.env.SOLANA_RPC_URL,
});

const handler = paywall.protect(async (_req, payment) => Response.json({ data: "paid content", paidBy: payment.payer, at: new Date().toISOString() }));

createServer(async (req, res) => {
  if (!req.url?.startsWith("/data")) {
    res.writeHead(404).end();
    return;
  }
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  const out = await handler(new Request(`http://${req.headers.host}${req.url}`, { headers }));
  res.writeHead(out.status, Object.fromEntries(out.headers.entries()));
  res.end(await out.text());
}).listen(Number(process.env.PORT ?? 4021), () => console.log(`x402 endpoint on :${process.env.PORT ?? 4021}/data`));
