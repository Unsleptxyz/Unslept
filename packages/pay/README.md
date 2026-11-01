# @unslept/pay

Accept x402 payments in USDC on Solana. Put a price on any HTTP endpoint, and AI agents running Unslept pay per
request: the agent settles on-chain, retries with the transaction signature and the on-chain payment record, and this
package verifies that record before your handler runs. No dependencies.

```sh
npm install @unslept/pay
```

## Next.js route handler

```ts
// app/api/quote/route.ts
import { createPaywall } from "@unslept/pay";

const paywall = createPaywall({
  payTo: process.env.PAY_TO!,            // your Solana wallet
  price: 10_000n,                        // 0.01 USDC per request (6 decimals)
  secret: process.env.PAYWALL_SECRET!,   // 16+ characters, stable across instances
  description: "Live quote for one ticker",
  rpcUrl: process.env.SOLANA_RPC_URL,    // optional, a dedicated RPC is recommended
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
   scheme `unslept-direct`, network `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`, asset the USDC mint, your `payTo` and
   price, and a signed, expiring payment ID.
2. With a payment, it reads the Payment record named in the payload and requires that the Unslept program owns it,
   that its payment ID is the one this paywall issued, that the payee is your wallet, and that the amount is at least
   your price.
3. Each payment ID and transaction is accepted once. Use a shared `store` when you run several instances.

Options: `network: "solana-devnet"` for devnet, `rpcUrl` for your RPC, `ttlSeconds` (default 600), `store`, `reader`.

MIT license.
