# Pay-on-success escrow (design, not deployed)

Status: design and test plan. Not deployed. It will ship only after an independent review, behind its own cap.

## Problem

With `unslept-direct`, the agent pays before the server answers. If the server takes the payment and then fails,
returns garbage or never answers, the agent has no recourse.

## Design

A new mode in the SettlementRouter, `Escrow`, settles into a per-payment escrow instead of paying the merchant.

1. The agent requests payment in Escrow mode. The router pulls from the buffer as today, but transfers the USDG to
   `PaymentEscrow`, recording `paymentId`, agent, merchant, amount and `deadline = now + window` (default 10 minutes,
   capped at 1 hour).
2. The merchant serves the request and returns a `PAYMENT-RESPONSE` that includes a receipt signed with the merchant's
   registered key: `keccak256(paymentId, responseHash, status)`.
3. Release: anyone can submit the agent's acceptance signature over the same receipt, or the merchant's receipt after the
   agent has not disputed by `deadline`. Funds go to the merchant.
4. Refund: before `deadline`, the agent's signer can dispute when there is no valid receipt (no response, non-2xx, or a
   response hash that does not match what was delivered). Undisputed timeouts with no merchant receipt refund the agent.

No oracle decides quality. The contract only enforces "the merchant produced a signed receipt and the agent did not
dispute in time". Merchants with frequent disputes are visible on chain and in the x402 Directory.

## Invariants to test

- Escrowed USDG is always either released once, refunded once, or still held. Never both, never twice.
- Only the agent's current signer can dispute; only the registered merchant key can sign receipts.
- Total escrowed never exceeds the escrow cap; the cap is set through the 24-hour timelock.
- Pausing the protocol blocks new escrows but never blocks refunds.

## Test plan

Unit and fuzz tests in Foundry for every path above, a mainnet fork test with real USDG, and an invariant test run
of at least 10,000 sequences before any deployment.
