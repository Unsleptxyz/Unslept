/**
 * The SDK talks to Solana through this interface. `createSolanaChain` (./solana.ts) is the production
 * implementation. Tests and custom stacks can provide their own.
 */

export interface Policy {
  /** Atomic USDC (6 decimals). */
  perCallCap: bigint;
  dailyCap: bigint;
}

export interface AccountState {
  policy: Policy;
  remainingToday: bigint;
  paused: boolean;
  revoked: boolean;
  /** USDC in the agent vault, ready for repayments. */
  liquid: bigint;
  /** USDC cost basis of the agent's Kamino position. */
  parked: bigint;
  /** Owed to the buffer. */
  debt: bigint;
  /** Allowed payee wallets. Empty means every payee is allowed. */
  allowlist: string[];
}

export interface PaymentRequestInput {
  /** Merchant wallet (base58). */
  payee: string;
  amount: bigint;
  /** 32-byte payment ID, 0x-prefixed hex. */
  paymentId: string;
  endpoint: string;
}

export interface SettlementResult {
  /** Transaction signature (base58). */
  transaction: string;
  fee: bigint;
  /** Address of the on-chain Payment record. */
  payment: string;
}

export interface PaymentRecord {
  paymentId: string;
  payee: string;
  amount: bigint;
  fee: bigint;
  transaction: string;
  slot: number;
  timestamp?: number;
}

export interface UnsleptChain {
  /** CAIP-2 network, e.g. "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp". */
  readonly network: string;
  /** USDC mint (base58). */
  readonly usdc: string;
  isPayeeAllowed(payee: string): Promise<boolean>;
  getAccountState(): Promise<AccountState>;
  requestPayment(input: PaymentRequestInput): Promise<SettlementResult>;
  getPayments(opts?: { limit?: number }): Promise<PaymentRecord[]>;
}
