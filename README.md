# Unslept

A yield-bearing payment layer for AI agents on Robinhood Chain. Idle agent balances stay working in tokenized
assets and are released the instant an x402 payment is due.

Status: all four phases built, targeting Robinhood Chain mainnet. Not deployed, not audited. See
[PLAN.md](PLAN.md) and [RUNBOOK.md](RUNBOOK.md).

## Layout

| Path | What |
|---|---|
| `contracts/` | Foundry: UnsleptBuffer (ERC-4626), AgentAccount (ERC-4337) and factory, SettlementRouter, Allocator, FeeModule, adapters, staking, deploy script |
| `web/` | Next.js: landing, risk, docs, waitlist, and the app (`/app`: overview, agents, buffer, treasury, developers, settings) |
| `indexer/` | Ponder indexer feeding stats and payment history |
| `packages/sdk-ts/` | `@unslept/sdk`, TypeScript |
| `packages/sdk-py/` | `unslept`, Python, with a LangChain tool |
| `packages/mcp/` | `@unslept/mcp`, MCP server over stdio |
| `examples/x402-endpoint/` | Sample x402 v2 endpoint used by the end-to-end test |
| `monitor/`, `ops/` | Alerting and keeper |
| `supabase/` | Waitlist, webhook and alert tables |

## Tests

```bash
cd contracts && forge test                          # unit, fuzz and invariant tests
cd packages/sdk-ts && npm test                      # SDK unit tests
cd packages/mcp && npm test                         # MCP server tests
cd packages/sdk-py && python -m unittest discover -s tests
./scripts/e2e.sh                                    # local chain: deploy, SDK pays the sample endpoint, monitor, keeper
cd web && npm run build && npm run copy-check
```

## Rules this codebase keeps

- No hardcoded chain IDs, addresses, tickers or rates. Everything comes from `.env` (see `.env.example`).
- Yield is always variable, historical or illustrative.
- No emoji, no exclamation marks, no promise of returns. `npm run copy-check` enforces the copy rules.
- Live-chain deployment without an audit is refused unless explicitly acknowledged, and then capped.
