# @unslept/sdk

Pay x402 paywalls in USDC on Solana from an Unslept agent account. Idle agent USDC can earn on Kamino Lend while the
Unslept buffer pays every request the moment it is due.

```sh
npm install @unslept/sdk @solana/web3.js
```

```ts
import { Unslept } from "@unslept/sdk";
import { Keypair } from "@solana/web3.js";

const unslept = new Unslept({
  agent: process.env.UNSLEPT_AGENT,              // agent account address, from the Unslept app
  signer: Keypair.fromSecretKey(agentSecretKey), // the agent signer, never your own wallet
  network: "solana",                             // or "solana-devnet"
  rpcUrl: process.env.UNSLEPT_RPC_URL,           // a dedicated RPC is recommended
});

const res = await unslept.fetch("https://api.example.com/data", undefined, { maxAmount: 50_000n }); // at most 0.05 USDC
```

On a 402 with an `unslept-direct` requirement in USDC on Solana, the SDK checks the agent's on-chain policy (per-call
cap, daily cap, payee allowlist, collateral), sends one transaction to the Unslept program, and retries with
`PAYMENT-SIGNATURE`. Merchants verify with [@unslept/pay](https://www.npmjs.com/package/@unslept/pay).

Other calls: `getBalances()`, `getPolicy()`, `getPayments({ limit })`, `localPayments()`, `onLowBalance(cb, { threshold })`.
Errors are `UnsleptError` with a stable `code` (`PER_CALL_CAP`, `DAILY_CAP`, `PAYEE_NOT_ALLOWED`, `INSUFFICIENT_COLLATERAL`, ...).

The agent signer needs a little SOL for network fees and payment-record rent (returned after 24 hours).

Docs: https://www.unslept.xyz/docs. MIT license.
