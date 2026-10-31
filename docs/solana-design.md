# Unslept on Solana

Status: core program built and tested on a local validator (14 tests). Not deployed. Yield adapter (Kamino) next.

## Program accounts

| Account | Seeds | Holds |
|---|---|---|
| Config | `config` | admin, USDC mint, params (fee, deposit cap, pauser, keeper, treasury), pending params with a 24-hour delay, outstanding buffer debt, pause flag |
| Buffer vault | `buffer_vault` | USDC that settles payments, owned by Config |
| Share mint | `share_mint` | Buffer depositor shares (same decimals as USDC) |
| Agent | `agent`, owner, agent_id | signer, per-call cap, daily cap, spend counter, allowlist (8 payees), pause/revoke, debt, yield position value |
| Agent vault | `agent_vault`, agent | the agent's liquid USDC |
| Payment | `payment`, payment_id | proof that an x402 payment ID was paid: agent, payee, amount, fee, endpoint hash, slot, time |

## Payment flow (`pay`)

1. The agent signer calls `pay(payment_id, amount, endpoint_hash)`. The program checks pause flags, the per-call and
   daily caps and the payee allowlist.
2. The buffer pays the merchant's USDC token account at once.
3. The fee (bps of the amount, at most 1%) goes from the agent vault to the treasury.
4. The agent vault repays the buffer in the same transaction. Whatever cannot be repaid stays as agent debt and must be
   covered by 95% of the agent's yield position, otherwise the whole transaction fails.
5. A Payment record is created at `payment_id`, so the ID can never be paid twice. The merchant verifies the payment by
   reading this account (payee, amount). Records can be closed after 24 hours to reclaim rent.

## x402

Network `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` (mainnet), asset USDC `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`,
scheme `unslept-direct`: the server issues a 32-byte payment ID, the agent pays it through the program and retries with
the transaction signature and payment ID, and the server reads the Payment account.

## Safety

- Parameter changes wait 24 hours (`propose_params`, then anyone calls `apply_params`). Admin transfer is two-step.
- The pauser can stop deposits and payments. Buffer withdrawals, agent withdrawals and debt repayment stay open.
- Deposit cap on the buffer.
- Agent owners can pause, revoke, change the signer and withdraw at any time, as long as debt stays covered.

## Next

1. Kamino adapter: deposit idle agent USDC into the Kamino USDC reserve, refresh `position_value`, redeem to repay debt.
2. Keeper: refresh positions and repay debt.
3. SDK, MCP, `@unslept/pay`, app and indexer for Solana.
4. Devnet deployment, then mainnet. Then pause the Robinhood Chain contracts.
