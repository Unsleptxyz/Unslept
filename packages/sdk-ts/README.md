# @unslept/sdk

Pay x402 paywalls from an Unslept agent account on Robinhood Chain. The client catches HTTP 402, checks the
agent's on-chain spending policy, settles the payment from the Unslept buffer and retries the request with the
payment proof.

```sh
npm install @unslept/sdk viem
```

```ts
import { Unslept } from "@unslept/sdk";
import { privateKeyToAccount } from "viem/accounts";

const unslept = new Unslept({
  agentAccount: process.env.UNSLEPT_AGENT_ACCOUNT,
  signer: privateKeyToAccount(process.env.UNSLEPT_SIGNER_KEY as `0x${string}`),
  network: "robinhood-chain",
});

const res = await unslept.fetch("https://example.com/paid-resource", undefined, { maxAmount: 50_000n }); // 0.05 USDG
```

## Configuration

The `robinhood-chain` preset reads its chain settings from the environment:

```sh
# Robinhood Chain mainnet. Addresses are published in contracts/deployments/4663.json.
UNSLEPT_CHAIN_ID=4663
UNSLEPT_RPC_URL=https://rpc.mainnet.chain.robinhood.com
UNSLEPT_USDG=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
UNSLEPT_ROUTER=0x1FeAB3B8f88FB0667B686fDCB0206194e88c984b
UNSLEPT_BUFFERS=0xcD853fb30eCe3134Cf21e2f47B9e23eaf965F40D
```

## Errors

Policy refusals throw `UnsleptError` with a code: `PER_CALL_CAP`, `DAILY_CAP`, `PAYEE_NOT_ALLOWED`,
`AGENT_PAUSED`, `AGENT_REVOKED` or `MAX_AMOUNT`.

Unslept is experimental software on a guarded, unaudited mainnet launch. Yield is variable and not guaranteed. Give each agent a small daily cap.
