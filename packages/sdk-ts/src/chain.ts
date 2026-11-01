/**
 * The SDK talks to the chain through this interface. `createViemChain` (./viem.ts) is the production
 * implementation. Tests and custom stacks can provide their own.
 */

export enum SettlementMode {
  Direct = 0,
  Exact = 1,
}

export interface Policy {
  perCallCap: bigint;
  dailyCap: bigint;
}

export interface AccountState {
  policy: Policy;
  remainingToday: bigint;
  paused: boolean;
  revoked: boolean;
  liquid: bigint;
  parked: bigint;
  debt: bigint;
}

export interface PaymentRequestInput {
  payee: `0x${string}`;
  amount: bigint;
  paymentId: `0x${string}`; // bytes32
  domain: string;
  endpoint: string;
  mode: SettlementMode;
}

export interface SettlementResult {
  transactionHash: `0x${string}`;
  fee: bigint;
  buffer: `0x${string}`;
}

export interface PaymentRecord {
  paymentId: `0x${string}`;
  payee: `0x${string}`;
  amount: bigint;
  fee: bigint;
  endpoint: string;
  transactionHash: `0x${string}`;
  blockNumber: bigint;
  timestamp?: number;
}

export interface TypedDataSigner {
  address: `0x${string}`;
  signTypedData(args: {
    domain: Record<string, unknown>;
    types: Record<string, readonly { name: string; type: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`>;
}

export interface UnsleptChain {
  readonly chainId: number;
  readonly usdg: `0x${string}`;
  isPayeeAllowed(payee: `0x${string}`, domain: string): Promise<boolean>;
  getAccountState(): Promise<AccountState>;
  requestPayment(input: PaymentRequestInput): Promise<SettlementResult>;
  setPolicy(policy: Policy): Promise<`0x${string}`>;
  getPayments(opts?: { limit?: number }): Promise<PaymentRecord[]>;
}
