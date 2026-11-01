# @unslept/pay

Accept x402 payments in USDG on Robinhood Chain. Put a price on any HTTP endpoint, and AI agents running Unslept pay
per request: the agent settles on chain, retries with the transaction hash, and this package verifies the settlement
before your handler runs.

```sh
npm install @unslept/pay viem
```

## Next.js route handler

```ts
// app/api/quote/route.ts
import { createPaywall } from "@unslept/pay";

const paywall = createPaywall({
  payTo: process.env.PAY_TO!,            // your wallet on Robinhood Chain
  price: 10_000n,                        // 0.01 USDG per request (6 decimals)
  secret: process.env.PAYWALL_SECRET!,   // 16+ characters, stable across instances
  description: "Live quote for one ticker",
  rpcUrl: process.env.ROBINHOOD_RPC_URL, // optional, a dedicated RPC is recommended
});

export const GET = paywall.protect(async (request, payment) => {
  return Response.json({ price: 101.25, paidBy: payment.payer });
});
```

`protect` works with any Fetch-style handler: Next.js, Hono, Bun and Deno.

## Express

```ts
import express from "express";
import { createPaywall } from "@unslept/pay";
import { expressPaywall } from "@unslept/pay/express";

const paywall = createPaywall({ payTo: process.env.PAY_TO!, price: 10_000n, secret: process.env.PAYWALL_SECRET! });
const app = express();

app.get("/quote", expressPaywall(paywall), (req, res) => res.json({ price: 101.25 }));
```

## What it checks

1. Without a `PAYMENT-SIGNATURE` header the endpoint answers **402** with an x402 v2 `PAYMENT-REQUIRED` header:
   scheme `unslept-direct`, network `eip155:4663`, asset USDG, your `payTo` and price, and a signed payment ID.
2. With a payment, it reads the transaction receipt and requires a `Settled` event from the Unslept SettlementRouter
   with the same payment ID, your address as payee and recipient, direct mode, and at least your price.
3. Each transaction and payment ID is accepted once. Payment IDs expire after `ttlSeconds` (default 600).

The default replay store is in memory. If you run more than one instance, pass a shared `store` (for example Redis
or a database table) implementing `claim(key, ttlSeconds) => Promise<boolean>`.

## List your endpoint

Once your endpoint answers 402, add it to the [x402 Directory](https://www.unslept.xyz/directory) so agents can find it.

MIT license.
