import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEventLogs,
  type Account,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { agentAccountAbi, settlementRouterAbi, unsleptBufferAbi } from "./abi.js";
import type { AccountState, PaymentRecord, PaymentRequestInput, Policy, SettlementResult, UnsleptChain } from "./chain.js";
import { UnsleptError } from "./errors.js";

export interface ViemChainConfig {
  agentAccount: `0x${string}`;
  usdg: `0x${string}`;
  router: `0x${string}`;
  buffers: `0x${string}`[];
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
  /** First block to scan for payment history. */
  fromBlock?: bigint;
}

function need(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new UnsleptError("CONFIG", `${name} is not set. See .env.example for the Robinhood Chain settings.`);
  return v;
}

/** Builds the chain client for the "robinhood-chain" preset from environment variables. Nothing is assumed. */
export function createViemChainFromEnv(args: { agentAccount: `0x${string}`; signer: unknown; network: string }): UnsleptChain {
  if (args.network !== "robinhood-chain") {
    throw new UnsleptError("CONFIG", `Unknown network preset "${args.network}". Pass a chain implementation instead.`);
  }
  const id = Number(need("UNSLEPT_CHAIN_ID"));
  const rpc = need("UNSLEPT_RPC_URL");
  const chain: Chain = defineChain({
    id,
    name: process.env.UNSLEPT_CHAIN_NAME ?? "Robinhood Chain",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });
  const account = args.signer as Account;
  if (!account || typeof account !== "object" || !("address" in account)) {
    throw new UnsleptError("CONFIG", "signer must be a viem Account, for example privateKeyToAccount(key).");
  }
  const buffers = need("UNSLEPT_BUFFERS")
    .split(",")
    .map((s) => s.trim() as `0x${string}`);
  return createViemChain({
    agentAccount: args.agentAccount,
    usdg: need("UNSLEPT_USDG") as `0x${string}`,
    router: need("UNSLEPT_ROUTER") as `0x${string}`,
    buffers,
    publicClient: createPublicClient({ chain, transport: http(rpc) }) as PublicClient,
    walletClient: createWalletClient({ chain, transport: http(rpc), account }),
    account,
    fromBlock: process.env.UNSLEPT_FROM_BLOCK ? BigInt(process.env.UNSLEPT_FROM_BLOCK) : undefined,
  });
}

const revertMap: Record<string, (args: readonly unknown[]) => UnsleptError> = {
  PerCallCapExceeded: (a) => new UnsleptError("PER_CALL_CAP", "Payment is above the per-call cap. Raise the cap in the spending policy.", { amount: a[0], cap: a[1] }),
  DailyCapExceeded: (a) => new UnsleptError("DAILY_CAP", "Payment would pass today's cap. Wait for 00:00 UTC or raise the daily cap.", { spent: a[0], amount: a[1], cap: a[2] }),
  PayeeNotAllowed: (a) => new UnsleptError("PAYEE_NOT_ALLOWED", `Payee ${String(a[0])} is not on the allowlist. Add it in the spending policy.`),
  AgentPaused: () => new UnsleptError("AGENT_PAUSED", "This agent is paused. Its owner can resume it in the Unslept app."),
  AgentRevoked: () => new UnsleptError("AGENT_REVOKED", "This agent was revoked. Create a new agent account."),
  InsufficientCollateral: (a) => new UnsleptError("INSUFFICIENT_COLLATERAL", "The agent does not hold enough to cover this payment. Fund the agent account.", { debtAfter: a[0], value: a[1] }),
  InsufficientBufferLiquidity: (a) => new UnsleptError("INSUFFICIENT_BUFFER_LIQUIDITY", "The buffer is short of liquidity right now. Retry shortly; it refills from parked positions.", { amount: a[0], available: a[1] }),
};

function mapRevert(err: unknown): never {
  if (err instanceof BaseError) {
    const r = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (r instanceof ContractFunctionRevertedError && r.data?.errorName) {
      const f = revertMap[r.data.errorName];
      if (f) throw f(r.data.args ?? []);
      throw new UnsleptError("SETTLEMENT_FAILED", `Settlement reverted with ${r.data.errorName}.`, { args: r.data.args });
    }
  }
  throw new UnsleptError("SETTLEMENT_FAILED", `Settlement transaction failed: ${(err as Error).message}`);
}

export function createViemChain(cfg: ViemChainConfig): UnsleptChain {
  const pc = cfg.publicClient;
  const acct = { address: cfg.agentAccount, abi: agentAccountAbi } as const;
  const chainId = pc.chain?.id;
  if (!chainId) throw new UnsleptError("CONFIG", "The public client has no chain configured.");

  return {
    chainId,
    usdg: cfg.usdg,

    async isPayeeAllowed(payee, domain) {
      return pc.readContract({ ...acct, functionName: "isPayeeAllowed", args: [payee, domain] } as never) as Promise<boolean>;
    },

    async getAccountState(): Promise<AccountState> {
      const [policy, remainingToday, paused, revoked, liquid, parked, debt] = await Promise.all([
        pc.readContract({ ...acct, functionName: "policy" }) as Promise<readonly [bigint, bigint]>,
        pc.readContract({ ...acct, functionName: "remainingToday" }) as Promise<bigint>,
        pc.readContract({ ...acct, functionName: "paused" }) as Promise<boolean>,
        pc.readContract({ ...acct, functionName: "revoked" }) as Promise<boolean>,
        pc.readContract({ ...acct, functionName: "liquid" }) as Promise<bigint>,
        pc.readContract({ ...acct, functionName: "parkedValue" }) as Promise<bigint>,
        Promise.all(
          cfg.buffers.map(
            (b) => pc.readContract({ address: b, abi: unsleptBufferAbi, functionName: "debtOf", args: [cfg.agentAccount] }) as Promise<bigint>,
          ),
        ).then((d) => d.reduce((x, y) => x + y, 0n)),
      ]);
      return { policy: { perCallCap: policy[0], dailyCap: policy[1] }, remainingToday, paused, revoked, liquid, parked, debt };
    },

    async requestPayment(input: PaymentRequestInput): Promise<SettlementResult> {
      try {
        const { request } = await pc.simulateContract({
          ...acct,
          functionName: "requestPayment",
          args: [input],
          account: cfg.account,
        } as never);
        const hash = await cfg.walletClient.writeContract(request as never);
        const receipt = await pc.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new UnsleptError("SETTLEMENT_FAILED", `Transaction ${hash} reverted.`);
        const [ev] = parseEventLogs({ abi: settlementRouterAbi, logs: receipt.logs, eventName: "Settled" }) as unknown as {
          args: { fee: bigint; buffer: `0x${string}` };
        }[];
        if (!ev) throw new UnsleptError("SETTLEMENT_FAILED", `Transaction ${hash} has no Settled event.`);
        return { transactionHash: hash, fee: ev.args.fee, buffer: ev.args.buffer };
      } catch (e) {
        if (e instanceof UnsleptError) throw e;
        mapRevert(e);
      }
    },

    async setPolicy(policy: Policy) {
      const { request } = await pc.simulateContract({ ...acct, functionName: "setPolicy", args: [policy], account: cfg.account } as never);
      return cfg.walletClient.writeContract(request as never);
    },

    async getPayments(opts) {
      const logs = await pc.getContractEvents({
        address: cfg.router,
        abi: settlementRouterAbi,
        eventName: "Settled",
        args: { agent: cfg.agentAccount },
        fromBlock: cfg.fromBlock ?? 0n,
      } as never);
      const rows: PaymentRecord[] = (logs as unknown as {
        args: { paymentId: `0x${string}`; payee: `0x${string}`; amount: bigint; fee: bigint; endpoint: string };
        transactionHash: `0x${string}`;
        blockNumber: bigint;
      }[]).map((l) => ({
        paymentId: l.args.paymentId,
        payee: l.args.payee,
        amount: l.args.amount,
        fee: l.args.fee,
        endpoint: l.args.endpoint,
        transactionHash: l.transactionHash,
        blockNumber: l.blockNumber,
      }));
      rows.reverse();
      return opts?.limit ? rows.slice(0, opts.limit) : rows;
    },
  };
}
