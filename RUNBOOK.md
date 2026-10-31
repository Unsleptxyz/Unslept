# Mainnet runbook

This is the order of operations for taking Unslept live on Robinhood Chain. Nothing here assumes a chain ID,
an address or an asset. Fill `.env` from official sources and check every value twice.

## 0. Decisions only a human can make

- **Audit.** The deployment script refuses a live chain without `AUDIT_REPORT_URL`. Launching unaudited needs
  `UNAUDITED_LAUNCH_ACK` set to the exact sentence in `contracts/script/Deploy.s.sol`, and caps the buffer and the
  asset at 50,000 USDG each. That bounds the loss from a bug; it does not prevent it.
- **Tokenized asset.** Proposed: Spark Savings USDG (spUSDG, ERC-4626,
  `0xde770c84FE66E063336b31737cFE9790f18c4087` per public listings; confirm on the explorer that `asset()` is USDG).
  Steakhouse USDG V2 on Morpho is a larger alternative whose withdrawals depend on lending utilization.
  Midas mGLO needs KYC and is not ERC-4626, so it needs its own adapter. Which asset the reference adapter targets is yours to confirm. `ERC4626Adapter` fits assets that expose an
  ERC-4626 interface with USDG as the asset and synchronous redemption. Anything else needs its own adapter.
- **Stablecoin.** Robinhood Chain's native stablecoin is USDG (Global Dollar, Paxos),
  `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`, 6 decimals, chain ID 4663 (Paxos integrator docs). It supports
  EIP-3009, so the standard x402 `exact` scheme works; its EIP-712 domain is name "Global Dollar", version "1".
  Paxos can freeze addresses; a frozen buffer or account would stop settlement for it.
- **Compliance.** Decided: no KYC. Leave `COMPLIANCE_PROVIDER` empty; use `COMPLIANCE_BLOCKED_COUNTRIES` if any
  jurisdiction must be blocked.
- **Launch mode.** Decided: guarded unaudited launch, buffer and asset capped at 50,000 USDG each.
- **Asset.** Decided: Spark Savings USDG (spUSDG) for the reference adapter.
- **Legal review** of terms, privacy, risk disclosure and the $UNSLEPT description.

## 1. Multisig and keys

1. Create a Safe (or equivalent) on Robinhood Chain with at least 3 signers and a threshold of 2 or more,
   on separate hardware wallets. This is `PAUSER_MULTISIG_ADDRESS`.
2. Create a fresh deployer key. It ends with no roles; fund it only with gas.
3. Create a keeper key for `ops/keeper.sh`. It can only park idle funds into registered adapters.

## 2. Deploy

```bash
cd contracts
forge test                                   # 46 tests: unit, fuzz, invariant
forge script script/Deploy.s.sol --tc Deploy --rpc-url "$NEXT_PUBLIC_RPC_URL"            # dry run
forge script script/Deploy.s.sol --tc Deploy --rpc-url "$NEXT_PUBLIC_RPC_URL" --broadcast --verify
```

The script checks that the RPC's chain ID equals `NEXT_PUBLIC_CHAIN_ID`, deploys the TimelockController
(proposer and executor: the multisig), hands the admin role of every contract to it, and renounces the
deployer's roles. Addresses are written to `contracts/deployments/<chainId>.json`.

Verify on the explorer, then check roles:

```bash
cast call $BUFFER "hasRole(bytes32,address)(bool)" 0x00 $DEPLOYER --rpc-url $RPC   # false
cast call $BUFFER "hasRole(bytes32,address)(bool)" 0x00 $TIMELOCK --rpc-url $RPC   # true
```

## 3. Post-deploy proposals (through the timelock)

Each needs a multisig `schedule`, the delay, then `execute`:

- `FeeModule.setToken($UNSLEPT, staking)` once the token is live on Pons, and `setTiers(...)` for discounts.
- Any change of fee, caps, queue threshold, buffer target or adapters.

The multisig can pause the buffer, router and allocator immediately, without the delay.

## 4. Off-chain services

| Service | Where | Notes |
|---|---|---|
| Website and app | Vercel, root `web/` | Set the `NEXT_PUBLIC_*` values from the deployment JSON. |
| Indexer | `indexer/` (Ponder) | Needs Postgres in production (`DATABASE_URL`). Set `INDEXER_URL` in the web project to its URL. |
| Keeper | `ops/keeper.sh` every minute | Repays debts, parks idle cash, refills the buffer, funds the withdrawal queue. |
| Monitor | `monitor/` every 5 minutes | Ops alerts to `OPS_WEBHOOK_URL`, user low-balance webhooks. |
| Database | Supabase | Run `supabase/un_waitlist.sql` and `supabase/un_webhooks.sql`. |

## 5. Incident response

1. **Pause first.** Multisig calls `pause()` on SettlementRouter, UnsleptBuffer and Allocator. Repayments and
   claims of funded withdrawals keep working while paused; owners can always unwind and withdraw.
2. Post a status note on the site and X with what is known and what users can do.
3. Investigate with the indexer and explorer. Do not unpause until the cause is understood and fixed.
4. A debt that cannot be recovered is recognized with `writeOff(agent)` through the timelock, so the loss is
   shared transparently rather than hidden in the share price.

## 6. Known limits to keep in mind

- A stale NAV feed makes valuations revert. Deposits, allocation and instant withdrawals stop until it updates;
  repayments, owner unwinds and queued claims still work.
- Domain allowlisting trusts the host the SDK reports. Payee address allowlisting is the strict control.
- In `exact` mode the buffer funds the agent signer just before the EIP-3009 authorization, so the signer briefly
  holds the payment amount. Per-call and daily caps bound that exposure.
