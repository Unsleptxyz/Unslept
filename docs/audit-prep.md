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

## Static analysis triage (Slither, 2026-10-31)

No high-impact findings. Medium-impact findings and their status after internal review:

| Finding | Where | Assessment |
|---|---|---|
| divide-before-multiply | `FeeModule.feeFor` | Intended: the discount applies to the already-rounded base fee. The rounding error is under one atomic USDG unit and always in the payer's favor. |
| reentrancy-no-eth | `ERC4626Adapter.deposit` | Guarded by `nonReentrant`; the only external call is to the configured ERC-4626 vault (Spark Savings). Moving the share accounting before the call is a cleanup for the audit. |
| incorrect-equality | `AgentAccount`, `UnsleptBuffer` | Comparisons against zero for empty states (no debt, no supply). Not exploitable by donations because the values are internal accounting, not token balances. To be confirmed by the auditor. |
| unused-return | `Allocator`, `AgentAccount`, `UnsleptBuffer`, `ERC4626Adapter` | Return values are either recomputed from state or not needed. `ECDSA.tryRecover` errors are handled by comparing the recovered signer. |

Internal review is not an audit. These notes exist to save the auditor time.
