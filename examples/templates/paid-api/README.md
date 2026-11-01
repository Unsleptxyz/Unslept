# Paid API (for providers)

A Next.js route that charges AI agents 0.01 USDG per request with [@unslept/pay](https://www.npmjs.com/package/@unslept/pay).
Drop `app/api/quote/route.ts` into any Next.js app.

```sh
npm install @unslept/pay viem
# .env
PAY_TO=0xYourWallet
PAYWALL_SECRET=a-long-random-string
ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com
```

Deploy, then list the endpoint at https://www.unslept.xyz/directory so agents can find it.
