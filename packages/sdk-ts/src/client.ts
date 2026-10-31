import { SettlementMode, type PaymentRecord, type Policy, type TypedDataSigner, type UnsleptChain } from "./chain.js";
import { UnsleptError, fmtUsdg } from "./errors.js";
import {
  HEADER_RESPONSE,
  HEADER_SIGNATURE,
  SCHEME_EXACT,
  SCHEME_UNSLEPT,
  X402_VERSION,
  decodeHeader,
  eip3009Types,
  encodeHeader,
  readPaymentRequired,
  selectRequirement,
  type ExactEip3009Payload,
  type PaymentPayload,
  type PaymentRequirements,
  type SettlementResponse,
  type UnsleptDirectPayload,
} from "./x402.js";

export interface UnsleptOptions {
  /** AgentAccount address. */
  agentAccount: `0x${string}` | string | undefined;
  /** The agent signer. A viem account, or anything with an address and signTypedData. */
  signer: TypedDataSigner | unknown;
  /** Network preset. "robinhood-chain" reads its RPC, chain ID and addresses from the environment. */
  network: "robinhood-chain" | (string & {});
  /** Chain implementation. Defaults to the viem implementation built from the environment. */
  chain?: UnsleptChain;
  /** fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Scheme preference. Defaults to Unslept direct settlement first, then standard x402 "exact". */
  schemes?: string[];
  /** Called after every settled payment. */
  onPayment?: (p: LocalPayment) => void;
  /**
   * Unslept app base URL. When set, policy violations are reported (signed by the agent signer) so the
   * account owner's webhooks receive them. Best effort; never blocks or changes the error thrown.
   */
  reportUrl?: string;
}

const REPORTED = new Set(["PER_CALL_CAP", "DAILY_CAP", "PAYEE_NOT_ALLOWED", "AGENT_PAUSED", "AGENT_REVOKED", "MAX_AMOUNT"]);

export interface FetchOptions {
  /** Refuse to pay more than this many atomic USDG units for this request. */
  maxAmount?: bigint;
}

export interface LocalPayment {
  agentId: string;
  endpoint: string;
  payee: string;
  amount: bigint;
  fee: bigint;
  scheme: string;
  transactionHash: string;
  paymentId: string;
  settlement?: SettlementResponse;
  at: Date;
}

export interface Balances {
  /** USDG held in the account, ready for repayments. */
  liquid: bigint;
  /** USDG value parked in tokenized assets. */
  working: bigint;
  /** Owed to the buffer, repaid in the background. */
  debt: bigint;
  /** liquid + working - debt */
  net: bigint;
}

type LowBalanceCallback = (b: Balances) => void;

const randomBytes32 = (): `0x${string}` => {
  const b = new Uint8Array(32);
  globalThis.crypto.getRandomValues(b);
  return `0x${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;
};

const isBytes32 = (v: unknown): v is `0x${string}` => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);

export class Unslept {
  readonly agentAccount: `0x${string}`;
  private readonly opts: UnsleptOptions;
  private chainPromise?: Promise<UnsleptChain>;
  private readonly fetchImpl: typeof fetch;
  private readonly log: LocalPayment[] = [];
  private readonly lowBalance: { threshold: bigint; cb: LowBalanceCallback }[] = [];

  constructor(opts: UnsleptOptions) {
    if (!opts.agentAccount || !/^0x[0-9a-fA-F]{40}$/.test(opts.agentAccount)) {
      throw new UnsleptError("CONFIG", "agentAccount must be an AgentAccount address (0x followed by 40 hex characters).");
    }
    this.agentAccount = opts.agentAccount as `0x${string}`;
    this.opts = opts;
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    if (opts.chain) this.chainPromise = Promise.resolve(opts.chain);
  }

  private chain(): Promise<UnsleptChain> {
    if (!this.chainPromise) {
      this.chainPromise = import("./viem.js").then((m) =>
        m.createViemChainFromEnv({ agentAccount: this.agentAccount, signer: this.opts.signer, network: this.opts.network }),
      );
    }
    return this.chainPromise;
  }

  /** Drop-in replacement for fetch. Pays x402 paywalls from a balance that is always working. */
  async fetch(input: string | URL | Request, init?: RequestInit, options: FetchOptions = {}): Promise<Response> {
    try {
      return await this.fetchInner(input, init, options);
    } catch (e) {
      if (e instanceof UnsleptError && REPORTED.has(e.code) && this.opts.reportUrl) {
        void this.report(e, input instanceof Request ? input.url : input.toString());
      }
      throw e;
    }
  }

  private async report(e: UnsleptError, endpoint: string) {
    const signer = this.opts.signer as { signMessage?: (a: { message: string }) => Promise<string> };
    if (typeof signer?.signMessage !== "function") return;
    try {
      const at = new Date().toISOString();
      const text = `Unslept policy violation\nAccount: ${this.agentAccount}\nCode: ${e.code}\nEndpoint: ${endpoint}\nAt: ${at}\n${e.message}`;
      const signature = await signer.signMessage({ message: text });
      await this.fetchImpl(`${this.opts.reportUrl!.replace(/\/$/, "")}/api/alerts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: this.agentAccount, code: e.code, message: e.message, endpoint, at, signature }),
      });
    } catch {
      /* reporting is best effort */
    }
  }

  private async fetchInner(input: string | URL | Request, init: RequestInit | undefined, options: FetchOptions): Promise<Response> {
    const retryInput = input instanceof Request ? input.clone() : input;
    const res = await this.fetchImpl(input, init);
    if (res.status !== 402) return res;

    const chain = await this.chain();
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const pr = readPaymentRequired(res);
    const schemes = this.opts.schemes ?? [SCHEME_UNSLEPT, SCHEME_EXACT];
    const network = `eip155:${chain.chainId}`;
    const req = selectRequirement(pr, { network, asset: chain.usdg, schemes });
    if (!req) {
      const offered = pr.accepts.map((a) => `${a.scheme} on ${a.network} in ${a.asset}`).join("; ");
      throw new UnsleptError(
        "NO_MATCHING_REQUIREMENT",
        `The server does not accept USDG on ${network} through ${schemes.join(" or ")}. It offers: ${offered}.`,
        { offered: pr.accepts },
      );
    }

    const amount = BigInt(req.amount);
    if (options.maxAmount !== undefined && amount > options.maxAmount) {
      throw new UnsleptError(
        "MAX_AMOUNT",
        `The server asks ${fmtUsdg(amount)}, above the ${fmtUsdg(options.maxAmount)} limit set for this request. Raise maxAmount to pay it.`,
        { amount, maxAmount: options.maxAmount },
      );
    }
    await this.checkPolicy(chain, req, amount, url.hostname);

    const exact = req.scheme === SCHEME_EXACT;
    const paymentId = isBytes32(req.extra?.paymentId) ? req.extra.paymentId : randomBytes32();
    const settlement = await chain.requestPayment({
      payee: req.payTo as `0x${string}`,
      amount,
      paymentId,
      domain: url.hostname,
      endpoint: url.toString(),
      mode: exact ? SettlementMode.Exact : SettlementMode.Direct,
    });

    const payload: PaymentPayload = {
      x402Version: X402_VERSION,
      resource: pr.resource,
      accepted: req,
      payload: exact
        ? await this.signExact(chain, req, amount, paymentId)
        : ({ transaction: settlement.transactionHash, paymentId, agentAccount: this.agentAccount } satisfies UnsleptDirectPayload),
      ...(pr.extensions ? { extensions: pr.extensions } : {}),
    };

    const headers = new Headers(init?.headers ?? (retryInput instanceof Request ? retryInput.headers : undefined));
    headers.set(HEADER_SIGNATURE, encodeHeader(payload));
    const paid = await this.fetchImpl(retryInput, { ...init, headers });

    const responseHeader = paid.headers.get(HEADER_RESPONSE);
    const sr = responseHeader ? safeDecode<SettlementResponse>(responseHeader) : undefined;
    const record: LocalPayment = {
      agentId: this.agentAccount,
      endpoint: url.toString(),
      payee: req.payTo,
      amount,
      fee: settlement.fee,
      scheme: req.scheme,
      transactionHash: sr?.transaction || settlement.transactionHash,
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
        `Paid ${fmtUsdg(amount)} (transaction ${settlement.transactionHash}) but the server still answered 402${sr?.errorReason ? `: ${sr.errorReason}` : ""}. Contact the merchant with the transaction hash.`,
        { record },
      );
    }
    return paid;
  }

  private async checkPolicy(chain: UnsleptChain, req: PaymentRequirements, amount: bigint, domain: string) {
    const s = await chain.getAccountState();
    if (s.revoked) throw new UnsleptError("AGENT_REVOKED", "This agent was revoked by its owner. Create a new agent account to keep paying.");
    if (s.paused) throw new UnsleptError("AGENT_PAUSED", "This agent is paused. Its owner can resume it in the Unslept app.");
    if (amount > s.policy.perCallCap) {
      throw new UnsleptError(
        "PER_CALL_CAP",
        `Payment of ${fmtUsdg(amount)} is above the per-call cap of ${fmtUsdg(s.policy.perCallCap)}. Raise the cap in the agent's spending policy to allow it.`,
        { amount, cap: s.policy.perCallCap },
      );
    }
    if (amount > s.remainingToday) {
      throw new UnsleptError(
        "DAILY_CAP",
        `Payment of ${fmtUsdg(amount)} would pass today's cap. ${fmtUsdg(s.remainingToday)} is left until 00:00 UTC.`,
        { amount, remaining: s.remainingToday },
      );
    }
    if (!(await chain.isPayeeAllowed(req.payTo as `0x${string}`, domain))) {
      throw new UnsleptError(
        "PAYEE_NOT_ALLOWED",
        `Payee ${req.payTo} (${domain}) is not on this agent's allowlist. Add the address or the domain in the agent's spending policy.`,
        { payee: req.payTo, domain },
      );
    }
    const needed = amount + s.debt;
    if (needed > s.liquid + s.parked) {
      throw new UnsleptError(
        "INSUFFICIENT_COLLATERAL",
        `The agent holds ${fmtUsdg(s.liquid + s.parked)} and owes ${fmtUsdg(s.debt)}, not enough to cover ${fmtUsdg(amount)}. Fund the agent account.`,
        { amount, liquid: s.liquid, parked: s.parked, debt: s.debt },
      );
    }
  }

  private async signExact(chain: UnsleptChain, req: PaymentRequirements, amount: bigint, nonce: `0x${string}`): Promise<ExactEip3009Payload> {
    const signer = this.opts.signer as TypedDataSigner;
    if (!signer || typeof signer.signTypedData !== "function") {
      throw new UnsleptError("CONFIG", "The exact scheme needs a signer with signTypedData, such as a viem account.");
    }
    const name = req.extra?.name;
    const version = req.extra?.version;
    if (typeof name !== "string" || typeof version !== "string") {
      throw new UnsleptError("CONFIG", "The server's exact requirement is missing extra.name or extra.version for the EIP-712 domain.");
    }
    const now = Math.floor(Date.now() / 1000);
    const authorization = {
      from: signer.address,
      to: req.payTo,
      value: amount.toString(),
      validAfter: "0",
      validBefore: String(now + req.maxTimeoutSeconds),
      nonce,
    };
    const signature = await signer.signTypedData({
      domain: { name, version, chainId: chain.chainId, verifyingContract: req.asset },
      types: eip3009Types,
      primaryType: "TransferWithAuthorization",
      message: {
        ...authorization,
        value: amount,
        validAfter: 0n,
        validBefore: BigInt(authorization.validBefore),
      },
    });
    return { signature, authorization };
  }

  async getBalances(): Promise<Balances> {
    const s = await (await this.chain()).getAccountState();
    return { liquid: s.liquid, working: s.parked, debt: s.debt, net: s.liquid + s.parked - s.debt };
  }

  async getPolicy(): Promise<Policy & { remainingToday: bigint; paused: boolean; revoked: boolean }> {
    const s = await (await this.chain()).getAccountState();
    return { ...s.policy, remainingToday: s.remainingToday, paused: s.paused, revoked: s.revoked };
  }

  /** Sends setPolicy from the configured signer. Only the account owner can change policy on-chain. */
  async setPolicy(policy: Policy): Promise<`0x${string}`> {
    return (await this.chain()).setPolicy(policy);
  }

  /** On-chain payment history for this agent, newest first. */
  async getPayments(opts?: { limit?: number }): Promise<PaymentRecord[]> {
    return (await this.chain()).getPayments(opts);
  }

  /** Payments made by this SDK instance, with endpoint, amount, payee, agent ID and transaction hash. */
  localPayments(): readonly LocalPayment[] {
    return this.log;
  }

  /**
   * Calls `callback` when the net balance falls below `threshold` (atomic USDG). Checked after every payment
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
