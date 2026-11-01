/**
 * Test-only chain implementation that drives the real contracts through Foundry's `cast`.
 * Used by the end-to-end test against a local node. Production code uses createViemChain.
 */
import { execFileSync } from "node:child_process";
import type { AccountState, PaymentRecord, PaymentRequestInput, Policy, SettlementResult, UnsleptChain } from "../../src/chain.js";

const SETTLED = "0x840ee00c8bdf0b51f6780c66e0c32236366088094b9ca1154d600bb59517ec95";

export class CastChain implements UnsleptChain {
  constructor(
    readonly chainId: number,
    readonly usdg: `0x${string}`,
    private rpc: string,
    private account: `0x${string}`,
    private buffer: `0x${string}`,
    private signerKey: string,
  ) {}

  private cast(args: string[]): string {
    return execFileSync("cast", args, { encoding: "utf8" }).trim();
  }

  private call(sig: string, ...args: string[]): string {
    return this.cast(["call", this.account, sig, ...args, "--rpc-url", this.rpc]).split(" ")[0];
  }

  async isPayeeAllowed(payee: string, domain: string) {
    return this.call("isPayeeAllowed(address,string)(bool)", payee, domain) === "true";
  }

  async getAccountState(): Promise<AccountState> {
    const policy = this.cast(["call", this.account, "policy()(uint128,uint128)", "--rpc-url", this.rpc]).split("\n").map((l) => BigInt(l.split(" ")[0]));
    const debt = BigInt(this.cast(["call", this.buffer, "debtOf(address)(uint256)", this.account, "--rpc-url", this.rpc]).split(" ")[0]);
    return {
      policy: { perCallCap: policy[0], dailyCap: policy[1] },
      remainingToday: BigInt(this.call("remainingToday()(uint256)")),
      paused: this.call("paused()(bool)") === "true",
      revoked: this.call("revoked()(bool)") === "true",
      liquid: BigInt(this.call("liquid()(uint256)")),
      parked: BigInt(this.call("parkedValue()(uint256)")),
      debt,
    };
  }

  async requestPayment(i: PaymentRequestInput): Promise<SettlementResult> {
    const tuple = `(${i.payee},${i.amount},${i.paymentId},"${i.domain}","${i.endpoint}",${i.mode})`;
    const out = this.cast([
      "send", this.account, "requestPayment((address,uint256,bytes32,string,string,uint8))", tuple,
      "--private-key", this.signerKey, "--rpc-url", this.rpc, "--json",
    ]);
    const r = JSON.parse(out) as { transactionHash: `0x${string}`; status: string; logs: { topics: string[]; data: string }[] };
    if (r.status !== "0x1" && r.status !== "1") throw new Error(`requestPayment reverted: ${r.transactionHash}`);
    const log = r.logs.find((l) => l.topics[0] === SETTLED)!;
    const fee = BigInt(`0x${log.data.slice(2 + 3 * 64, 2 + 4 * 64)}`);
    return { transactionHash: r.transactionHash, fee, buffer: `0x${log.data.slice(26, 66)}` };
  }

  async setPolicy(_p: Policy): Promise<`0x${string}`> {
    throw new Error("not used in e2e");
  }

  async getPayments(): Promise<PaymentRecord[]> {
    return [];
  }
}
