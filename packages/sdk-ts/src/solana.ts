/**
 * Solana implementation of UnsleptChain, built on @solana/web3.js (peer dependency).
 * Import from "@unslept/sdk/solana".
 */
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type Commitment,
} from "@solana/web3.js";
import type { AccountState, PaymentRecord, PaymentRequestInput, SettlementResult, UnsleptChain } from "./chain.js";
import { UnsleptError } from "./errors.js";
import {
  ATA_PROGRAM_ID,
  DISC,
  NETWORKS,
  PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  decodeAgent,
  decodeConfig,
  decodeSettled,
  hexToBytes,
  type NetworkName,
} from "./protocol.js";

/** A Keypair, or a wallet adapter style signer. */
export type SolanaSigner = Keypair | { publicKey: PublicKey; signTransaction<T extends Transaction>(tx: T): Promise<T> };

export interface SolanaChainOptions {
  /** Agent account address (the agent PDA). */
  agent: string;
  /** The agent signer. Pays transaction fees and the rent of each payment record (returned after 24 hours). */
  signer: SolanaSigner;
  network?: NetworkName;
  rpcUrl?: string;
  connection?: Connection;
  programId?: string;
  /** Priority fee in micro-lamports per compute unit. Default 10_000. */
  priorityFee?: number;
  commitment?: Commitment;
}

const TOKEN = new PublicKey(TOKEN_PROGRAM_ID);
const ATA = new PublicKey(ATA_PROGRAM_ID);

export function associatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN.toBuffer(), mint.toBuffer()], ATA)[0];
}

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

const u64le = (v: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, v, true);
  return b;
};

export function createSolanaChain(opts: SolanaChainOptions): UnsleptChain & {
  connection: Connection;
  programId: PublicKey;
  agent: PublicKey;
} {
  const net = NETWORKS[opts.network ?? "solana"];
  if (!net) throw new UnsleptError("CONFIG", `Unknown network ${opts.network}. Use "solana" or "solana-devnet".`);
  const commitment = opts.commitment ?? "confirmed";
  const connection = opts.connection ?? new Connection(opts.rpcUrl ?? net.rpcUrl, commitment);
  const programId = new PublicKey(opts.programId ?? PROGRAM_ID);
  const agent = new PublicKey(opts.agent);
  const usdc = new PublicKey(net.usdc);
  const pda = (...seeds: Uint8Array[]) => PublicKey.findProgramAddressSync(seeds, programId)[0];
  const enc = (s: string) => new TextEncoder().encode(s);
  const config = pda(enc("config"));
  const bufferVault = pda(enc("buffer_vault"));
  const agentVault = pda(enc("agent_vault"), agent.toBytes());
  const signerKey = opts.signer.publicKey;

  async function load(address: PublicKey, what: string) {
    const info = await connection.getAccountInfo(address, commitment);
    if (!info) throw new UnsleptError("CONFIG", `${what} ${address.toBase58()} was not found on ${net.caip2}.`);
    if (!info.owner.equals(programId)) throw new UnsleptError("CONFIG", `${what} ${address.toBase58()} is not owned by the Unslept program.`);
    return new Uint8Array(info.data);
  }

  async function tokenBalance(address: PublicKey): Promise<bigint> {
    const r = await connection.getTokenAccountBalance(address, commitment).catch(() => undefined);
    return r ? BigInt(r.value.amount) : 0n;
  }

  async function getAccountState(): Promise<AccountState> {
    const a = decodeAgent(await load(agent, "Agent account"));
    const today = BigInt(Math.floor(Date.now() / 86_400_000));
    const spent = a.spendDay === today ? a.spentToday : 0n;
    return {
      policy: { perCallCap: a.perCallCap, dailyCap: a.dailyCap },
      remainingToday: a.dailyCap > spent ? a.dailyCap - spent : 0n,
      paused: a.paused,
      revoked: a.revoked,
      liquid: await tokenBalance(agentVault),
      parked: a.positionValue,
      debt: a.debt,
      allowlist: a.allowlist,
    };
  }

  async function sign(tx: Transaction): Promise<Transaction> {
    const s = opts.signer as Partial<Keypair> & { signTransaction?: (t: Transaction) => Promise<Transaction> };
    if (s.secretKey) {
      tx.sign(s as Keypair);
      return tx;
    }
    return s.signTransaction!(tx);
  }

  async function requestPayment(input: PaymentRequestInput): Promise<SettlementResult> {
    const cfg = decodeConfig(await load(config, "Unslept config"));
    if (cfg.paused) throw new UnsleptError("SETTLEMENT_FAILED", "Unslept is paused. Payments resume when the protocol is unpaused.");
    const payee = new PublicKey(input.payee);
    const payeeToken = associatedTokenAddress(payee, usdc);
    const id = hexToBytes(input.paymentId);
    if (id.length !== 32) throw new UnsleptError("CONFIG", "paymentId must be 32 bytes.");
    const payment = pda(enc("payment"), id);
    const endpointHash = await sha256(input.endpoint);

    const createAta = new TransactionInstruction({
      programId: ATA,
      keys: [
        { pubkey: signerKey, isSigner: true, isWritable: true },
        { pubkey: payeeToken, isSigner: false, isWritable: true },
        { pubkey: payee, isSigner: false, isWritable: false },
        { pubkey: usdc, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([1]), // CreateIdempotent
    });
    const data = new Uint8Array(8 + 32 + 8 + 32);
    data.set(DISC.pay, 0);
    data.set(id, 8);
    data.set(u64le(input.amount), 40);
    data.set(endpointHash, 48);
    const pay = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: signerKey, isSigner: true, isWritable: true },
        { pubkey: config, isSigner: false, isWritable: true },
        { pubkey: agent, isSigner: false, isWritable: true },
        { pubkey: agentVault, isSigner: false, isWritable: true },
        { pubkey: bufferVault, isSigner: false, isWritable: true },
        { pubkey: new PublicKey(cfg.treasury), isSigner: false, isWritable: true },
        { pubkey: payeeToken, isSigner: false, isWritable: true },
        { pubkey: payment, isSigner: false, isWritable: true },
        { pubkey: TOKEN, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(data),
    });

    const tx = new Transaction();
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 120_000 }));
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: opts.priorityFee ?? 10_000 }));
    tx.add(createAta, pay);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(commitment);
    tx.recentBlockhash = blockhash;
    tx.feePayer = signerKey;
    const signed = await sign(tx);
    let signature: string;
    try {
      signature = await connection.sendRawTransaction(signed.serialize(), { preflightCommitment: commitment });
      const res = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, commitment);
      if (res.value.err) throw new Error(JSON.stringify(res.value.err));
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      const known: [RegExp, string][] = [
        [/InsufficientLiquidity/, "INSUFFICIENT_BUFFER_LIQUIDITY"],
        [/InsufficientCollateral/, "INSUFFICIENT_COLLATERAL"],
        [/PerCallCapExceeded/, "PER_CALL_CAP"],
        [/DailyCapExceeded/, "DAILY_CAP"],
        [/PayeeNotAllowed/, "PAYEE_NOT_ALLOWED"],
        [/AgentPaused/, "AGENT_PAUSED"],
        [/AgentRevoked/, "AGENT_REVOKED"],
      ];
      const hit = known.find(([re]) => re.test(msg));
      throw new UnsleptError((hit?.[1] ?? "SETTLEMENT_FAILED") as never, `Settlement failed: ${msg}`, { cause: msg });
    }
    const fee = (input.amount * BigInt(cfg.feeBps)) / 10_000n;
    return { transaction: signature, fee, payment: payment.toBase58() };
  }

  async function getPayments({ limit = 20 } = {}): Promise<PaymentRecord[]> {
    const sigs = await connection.getSignaturesForAddress(agent, { limit }, "confirmed");
    const out: PaymentRecord[] = [];
    for (const s of sigs) {
      if (s.err) continue;
      const tx = await connection.getTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
      for (const line of tx?.meta?.logMessages ?? []) {
        if (!line.startsWith("Program data: ")) continue;
        const ev = decodeSettled(line.slice(14));
        if (!ev || ev.agent !== agent.toBase58()) continue;
        out.push({
          paymentId: ev.paymentId,
          payee: ev.payee,
          amount: ev.amount,
          fee: ev.fee,
          transaction: s.signature,
          slot: s.slot,
          timestamp: s.blockTime ?? undefined,
        });
      }
    }
    return out;
  }

  return {
    network: net.caip2,
    usdc: net.usdc,
    connection,
    programId,
    agent,
    async isPayeeAllowed(payee: string) {
      const s = await getAccountState();
      return s.allowlist.length === 0 || s.allowlist.includes(payee);
    },
    getAccountState,
    requestPayment,
    getPayments,
  };
}

/** PDA of an agent account for an owner and numeric ID. */
export function agentAddress(owner: string, agentId: bigint | number, programId = PROGRAM_ID): string {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("agent"), new PublicKey(owner).toBytes(), u64le(BigInt(agentId))],
    new PublicKey(programId),
  )[0].toBase58();
}
