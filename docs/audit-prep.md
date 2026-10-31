# Audit preparation

Unslept is live in a guarded launch without a completed third-party audit. This file tracks what an auditor needs.

## Scope

All contracts in `contracts/src`, deployed at the addresses in `contracts/deployments/4663.json` (Robinhood Chain,
chain ID 4663). Out of scope: third-party systems (Robinhood Chain, USDG, Spark Savings, wallets).

## What is already in place

- Foundry unit tests, invariant tests and a mainnet fork test (`.github/workflows/fork-test.yml`, results in `ops/fork-test.txt`).
- Static analysis with Slither on every run of `.github/workflows/static-analysis.yml`, results in `ops/slither.txt`.
- Verified source on Sourcify.
- Guarded launch controls: 50,000 USDG caps, a 24-hour timelock on admin changes, an emergency pause.

## Open items for the audit

- Independent review of SettlementRouter, UnsleptBuffer, Allocator, AgentAccount and the Spark adapter.
- Review of the keeper's refill path and buffer utilization limits.
- Review of the escrow design in `docs/escrow-design.md` before it is implemented.

The deposit caps are raised only after the audit report is published and its findings are fixed.
