import type { PaymentRecord, Policy, UnsleptChain } from "./chain.js";
import { UnsleptError, fmtUsdc } from "./errors.js";
import { isBase58Address } from "./protocol.js";
import {
  HEADER_RESPONSE,
  HEADER_SIGNATURE,
  SCHEME_UNSLEPT,
  X402_VERSION,
  decodeHeader,
  encodeHeader,
  readPaymentRequired,
  selectRequirement,
  type PaymentPayload,
  type PaymentRequirements,
  type SettlementResponse,
  type UnsleptDirectPayload,
} from "./x402.js";

export interface UnsleptOptions {
  /** Agent account address (base58). */
  agent: string | undefined;
  /** The agent signer: a @solana/web3.js Keypair, or a wallet with publicKey and signTransaction. */
  signer?: unknown;
  /** "solana" (mainnet) or "solana-devnet". Default "solana". */
  network?: "solana" | "solana-devnet";
  /** Solana RPC URL. Defaults to the public RPC of the network; use a dedicated one in production. */
  rpcUrl?: string;
  /** Chain implementation. Defaults to the @solana/web3.js implementation. */
  chain?: UnsleptChain;
  /** fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Called after every settled payment. */
  onPayment?: (p: LocalPayment) => void;
}

export interface FetchOptions {
  /** Refuse to pay more than this many atomic USDC units for this request. */
  maxAmount?: bigint;
}

export interface LocalPayment {
  agent: string;
  endpoint: string;
  payee: string;
  amount: bigint;
  fee: bigint;
  scheme: string;
  transaction: string;
  paymentId: string;
  settlement?: SettlementResponse;
  at: Date;
}

export interface Balances {
  /** USDC in the agent vault, ready for repayments. */
  liquid: bigint;
  /** USDC working in Kamino (cost basis). */
  working: bigint;
  /** Owed to the buffer, repaid from the vault and the Kamino position. */
  debt: bigint;
  /** liquid + working - debt */
  net: bigint;
}

type LowBalanceCallback = (b: Balances) => void;

const randomBytes32 = (): string => {
  const b = new Uint8Array(32);
  globalThis.crypto.getRandomValues(b);
  return `0x${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;
};

const isBytes32 = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);

export class Unslept {
  readonly agent: string;
  private readonly opts: UnsleptOptions;
  private chainPromise?: Promise<UnsleptChain>;
  private readonly fetchImpl: typeof fetch;
  private readonly log: LocalPayment[] = [];
  private readonly lowBalance: { threshold: bigint; cb: LowBalanceCallback }[] = [];

  constructor(opts: UnsleptOptions) {
    if (!isBase58Address(opts.agent)) {
      throw new UnsleptError("CONFIG", "agent must be an Unslept agent account address (base58).");
    }
    this.agent = opts.agent;
    this.opts = opts;
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    if (opts.chain) this.chainPromise = Promise.resolve(opts.chain);
  }

  private chain(): Promise<UnsleptChain> {
    if (!this.chainPromise) {
      if (!this.opts.signer) throw new UnsleptError("CONFIG", "signer is required: pass the agent signer Keypair.");
      this.chainPromise = import("./solana.js").then((m) =>
        m.createSolanaChain({
          agent: this.agent,
          signer: this.opts.signer as never,
          network: this.opts.network ?? "solana",
          rpcUrl: this.opts.rpcUrl,
        }),
      );
    }
    return this.chainPromise;
  }

  /** Drop-in replacement for fetch. Pays x402 paywalls in USDC on Solana from a balance that keeps earning. */
  async fetch(input: string | URL | Request, init?: RequestInit, options: FetchOptions = {}): Promise<Response> {
    const retryInput = input instanceof Request ? input.clone() : input;
    const res = await this.fetchImpl(input, init);
    if (res.status !== 402) return res;

    const chain = await this.chain();
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const pr = readPaymentRequired(res);
    const req = selectRequirement(pr, { network: chain.network, asset: chain.usdc, schemes: [SCHEME_UNSLEPT] });
    if (!req) {
      const offered = pr.accepts.map((a) => `${a.scheme} on ${a.network} in ${a.asset}`).join("; ");
      throw new UnsleptError(
        "NO_MATCHING_REQUIREMENT",
        `The server does not accept USDC on ${chain.network} through ${SCHEME_UNSLEPT}. It offers: ${offered}.`,
        { offered: pr.accepts },
      );
    }

    const amount = BigInt(req.amount);
    if (options.maxAmount !== undefined && amount > options.maxAmount) {
      throw new UnsleptError(
        "MAX_AMOUNT",
        `The server asks ${fmtUsdc(amount)}, above the ${fmtUsdc(options.maxAmount)} limit set for this request. Raise maxAmount to pay it.`,
        { amount, maxAmount: options.maxAmount },
      );
    }
    await this.checkPolicy(chain, req, amount);

    const paymentId = isBytes32(req.extra?.paymentId) ? req.extra.paymentId : randomBytes32();
    const settlement = await chain.requestPayment({ payee: req.payTo, amount, paymentId, endpoint: url.toString() });

    const payload: PaymentPayload<UnsleptDirectPayload> = {
      x402Version: X402_VERSION,
      resource: pr.resource,
      accepted: req,
      payload: { transaction: settlement.transaction, paymentId, agent: this.agent, payment: settlement.payment },
      ...(pr.extensions ? { extensions: pr.extensions } : {}),
    };

    const headers = new Headers(init?.headers ?? (retryInput instanceof Request ? retryInput.headers : undefined));
    headers.set(HEADER_SIGNATURE, encodeHeader(payload));
    const paid = await this.fetchImpl(retryInput, { ...init, headers });

    const responseHeader = paid.headers.get(HEADER_RESPONSE);
    const sr = responseHeader ? safeDecode<SettlementResponse>(responseHeader) : undefined;
    const record: LocalPayment = {
      agent: this.agent,
      endpoint: url.toString(),
      payee: req.payTo,
      amount,
      fee: settlement.fee,
      scheme: req.scheme,
      transaction: settlement.transaction,
      paymentId,
      settlement: sr,
      at: new Date(),
    };
    this.log.push(record);
    this.opts.onPayment?.(record);
    void this.checkLowBalance();

    if (paid.status === 402) {
      throw new UnsleptError(
        "PAYMENT_REJECTED",
        `Paid ${fmtUsdc(amount)} (transaction ${settlement.transaction}) but the server still answered 402${sr?.errorReason ? `: ${sr.errorReason}` : ""}. Contact the merchant with the transaction signature.`,
        { record },
      );
    }
    return paid;
  }

  private async checkPolicy(chain: UnsleptChain, req: PaymentRequirements, amount: bigint) {
    const s = await chain.getAccountState();
    if (s.revoked) throw new UnsleptError("AGENT_REVOKED", "This agent was revoked by its owner. Create a new agent account to keep paying.");
    if (s.paused) throw new UnsleptError("AGENT_PAUSED", "This agent is paused. Its owner can resume it in the Unslept app.");
    if (amount > s.policy.perCallCap) {
      throw new UnsleptError(
        "PER_CALL_CAP",
        `Payment of ${fmtUsdc(amount)} is above the per-call cap of ${fmtUsdc(s.policy.perCallCap)}. Raise the cap in the agent's spending policy to allow it.`,
        { amount, cap: s.policy.perCallCap },
      );
    }
    if (amount > s.remainingToday) {
      throw new UnsleptError(
        "DAILY_CAP",
        `Payment of ${fmtUsdc(amount)} would pass today's cap. ${fmtUsdc(s.remainingToday)} is left until 00:00 UTC.`,
        { amount, remaining: s.remainingToday },
      );
    }
    if (s.allowlist.length > 0 && !s.allowlist.includes(req.payTo)) {
      throw new UnsleptError(
        "PAYEE_NOT_ALLOWED",
        `Payee ${req.payTo} is not on this agent's allowlist. Add the wallet in the agent's spending policy.`,
        { payee: req.payTo },
      );
    }
    const backing = s.liquid + (s.parked * 95n) / 100n;
    if (amount + s.debt > backing) {
      throw new UnsleptError(
        "INSUFFICIENT_COLLATERAL",
        `The agent holds ${fmtUsdc(s.liquid + s.parked)} and owes ${fmtUsdc(s.debt)}, not enough to cover ${fmtUsdc(amount)}. Fund the agent account.`,
        { amount, liquid: s.liquid, parked: s.parked, debt: s.debt },
      );
    }
  }

  async getBalances(): Promise<Balances> {
    const s = await (await this.chain()).getAccountState();
    return { liquid: s.liquid, working: s.parked, debt: s.debt, net: s.liquid + s.parked - s.debt };
  }

  async getPolicy(): Promise<Policy & { remainingToday: bigint; paused: boolean; revoked: boolean; allowlist: string[] }> {
    const s = await (await this.chain()).getAccountState();
    return { ...s.policy, remainingToday: s.remainingToday, paused: s.paused, revoked: s.revoked, allowlist: s.allowlist };
  }

  /** On-chain payment history for this agent, newest first. */
  async getPayments(opts?: { limit?: number }): Promise<PaymentRecord[]> {
    return (await this.chain()).getPayments(opts);
  }

  /** Payments made by this SDK instance. */
  localPayments(): readonly LocalPayment[] {
    return this.log;
  }

  /**
   * Calls `callback` when the net balance falls below `threshold` (atomic USDC). Checked after every payment
   * and every `intervalMs` if given. Returns a function that stops the watch.
   */
  onLowBalance(callback: LowBalanceCallback, opts: { threshold: bigint; intervalMs?: number }): () => void {
    const entry = { threshold: opts.threshold, cb: callback };
    this.lowBalance.push(entry);
    const timer = opts.intervalMs ? setInterval(() => void this.checkLowBalance(), opts.intervalMs) : undefined;
    return () => {
      if (timer) clearInterval(timer);
      const i = this.lowBalance.indexOf(entry);
      if (i >= 0) this.lowBalance.splice(i, 1);
    };
  }

  private async checkLowBalance() {
    if (this.lowBalance.length === 0) return;
    try {
      const b = await this.getBalances();
      for (const l of this.lowBalance) if (b.net < l.threshold) l.cb(b);
    } catch {
      /* balance reads are best effort; the next check retries */
    }
  }
}

function safeDecode<T>(h: string): T | undefined {
  try {
    return decodeHeader<T>(h);
  } catch {
    return undefined;
  }
}
