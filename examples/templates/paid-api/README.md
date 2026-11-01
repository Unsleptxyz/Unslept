# Paid API (for providers)

A Next.js route that charges AI agents 0.01 USDC per request with [@unslept/pay](https://www.npmjs.com/package/@unslept/pay).
Drop `app/api/quote/route.ts` into any Next.js app.

```sh
npm install @unslept/pay
# .env
PAY_TO=<your Solana wallet>
PAYWALL_SECRET=a-long-random-string
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

Deploy, then list the endpoint at https://www.unslept.xyz/directory so agents can find it.
