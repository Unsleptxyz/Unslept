/**
 * Unslept on Solana: cluster settings, program addresses, account decoders and instruction builders for the app.
 * Safe to import on the server (no wallet code).
 */
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

const env = {
  cluster: (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "mainnet") as "mainnet" | "devnet",
  rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  program: process.env.NEXT_PUBLIC_UNSLEPT_PROGRAM_ID || "HbAgL4w8R9D8RUEuK4rJknK5Vn8rBusfRtfTnFcYieue",
};

export const cluster = env.cluster;
export const isDevnet = cluster === "devnet";
export const clusterName = isDevnet ? "Solana devnet" : "Solana";
export const network = isDevnet ? "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" : "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
export const rpcUrl = env.rpcUrl || (isDevnet ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com");

export const PROGRAM_ID = new PublicKey(env.program);
export const USDC_MINT = new PublicKey(isDevnet ? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" : "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ATA_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
export const KLEND_PROGRAM_ID = new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
export const KAMINO_MARKET = new PublicKey("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF");
export const KAMINO_USDC_RESERVE = new PublicKey("D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59");
export const KAMINO_USDC_SUPPLY = new PublicKey("Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6");
export const KAMINO_CUSDC_MINT = new PublicKey("B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D");
export const SYSVAR_INSTRUCTIONS = new PublicKey("Sysvar1nstructions1111111111111111111111111");

/** Privy app ID (public). */
export const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || undefined;

const enc = (s: string) => new TextEncoder().encode(s);
const pda = (...seeds: Uint8Array[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
const u64 = (v: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, v, true);
  return b;
};

export const addresses = {
  config: pda(enc("config")),
  bufferVault: pda(enc("buffer_vault")),
  shareMint: pda(enc("share_mint")),
};
export const agentAddress = (owner: PublicKey, id: bigint) => pda(enc("agent"), owner.toBytes(), u64(id));
export const agentVault = (agent: PublicKey) => pda(enc("agent_vault"), agent.toBytes());
export const agentCtoken = (agent: PublicKey) => pda(enc("agent_ctoken"), agent.toBytes());
export const ata = (owner: PublicKey, mint: PublicKey) =>
  PublicKey.findProgramAddressSync([owner.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()], ATA_PROGRAM_ID)[0];
export const kaminoAuthority = () => PublicKey.findProgramAddressSync([enc("lma"), KAMINO_MARKET.toBytes()], KLEND_PROGRAM_ID)[0];

// ---------------------------------------------------------------- decoding

export const DISC = {
  agent: [47, 166, 112, 147, 155, 197, 86, 7],
  config: [155, 12, 170, 224, 30, 250, 204, 130],
  settled: [232, 210, 40, 17, 142, 124, 145, 238],
};

function reader(d: Uint8Array, start = 8) {
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  let o = start;
  return {
    key: () => new PublicKey(d.subarray(o, (o += 32))),
    bytes: (n: number) => d.subarray(o, (o += n)),
    u8: () => d[o++],
    u16: () => ((o += 2), dv.getUint16(o - 2, true)),
    u64: () => ((o += 8), dv.getBigUint64(o - 8, true)),
    i64: () => ((o += 8), dv.getBigInt64(o - 8, true)),
    skip: (n: number) => void (o += n),
  };
}
const hasDisc = (d: Uint8Array, disc: number[]) => d.length >= 8 && disc.every((b, i) => d[i] === b);

export interface AgentState {
  address: PublicKey;
  owner: PublicKey;
  signer: PublicKey;
  agentId: bigint;
  perCallCap: bigint;
  dailyCap: bigint;
  remainingToday: bigint;
  paused: boolean;
  revoked: boolean;
  debt: bigint;
  /** USDC cost basis of the Kamino position. */
  positionValue: bigint;
  payments: bigint;
  allowlist: PublicKey[];
}

export function decodeAgent(address: PublicKey, d: Uint8Array): AgentState | undefined {
  if (!hasDisc(d, DISC.agent)) return undefined;
  const r = reader(d);
  const owner = r.key();
  const signer = r.key();
  const agentId = r.u64();
  const perCallCap = r.u64();
  const dailyCap = r.u64();
  const spentToday = r.u64();
  const spendDay = r.i64();
  const paused = r.u8() === 1;
  const revoked = r.u8() === 1;
  const debt = r.u64();
  const positionValue = r.u64();
  const payments = r.u64();
  const n = r.u8();
  const allowlist: PublicKey[] = [];
  for (let i = 0; i < 8; i++) {
    const k = r.key();
    if (i < n) allowlist.push(k);
  }
  const today = BigInt(Math.floor(Date.now() / 86_400_000));
  const spent = spendDay === today ? spentToday : 0n;
  return {
    address, owner, signer, agentId, perCallCap, dailyCap, remainingToday: dailyCap > spent ? dailyCap - spent : 0n,
    paused, revoked, debt, positionValue, payments, allowlist,
  };
}

export interface ConfigState {
  admin: PublicKey;
  usdcMint: PublicKey;
  feeBps: number;
  depositCap: bigint;
  pauser: PublicKey;
  keeper: PublicKey;
  treasury: PublicKey;
  outstandingDebt: bigint;
  paused: boolean;
  yieldReserve: PublicKey;
  yieldCtokenMint: PublicKey;
}

export function decodeConfig(d: Uint8Array): ConfigState | undefined {
  if (!hasDisc(d, DISC.config)) return undefined;
  const r = reader(d);
  const admin = r.key();
  r.key();
  const usdcMint = r.key();
  const feeBps = r.u16();
  const depositCap = r.u64();
  const pauser = r.key();
  const keeper = r.key();
  const treasury = r.key();
  r.skip(2 + 8 + 96 + 8);
  const outstandingDebt = r.u64();
  const paused = r.u8() === 1;
  r.skip(3);
  const yieldReserve = r.key();
  const yieldCtokenMint = r.key();
  return { admin, usdcMint, feeBps, depositCap, pauser, keeper, treasury, outstandingDebt, paused, yieldReserve, yieldCtokenMint };
}

export interface SettledEvent {
  paymentId: string;
  agent: string;
  payee: string;
  amount: bigint;
  fee: bigint;
  fronted: bigint;
}

export function decodeSettled(b64: string): SettledEvent | undefined {
  const d = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (d.length < 8 + 96 + 24 || !hasDisc(d, DISC.settled)) return undefined;
  const r = reader(d);
  const id = r.bytes(32);
  return {
    paymentId: `0x${Array.from(id, (x) => x.toString(16).padStart(2, "0")).join("")}`,
    agent: r.key().toBase58(),
    payee: r.key().toBase58(),
    amount: r.u64(),
    fee: r.u64(),
    fronted: r.u64(),
  };
}

// ---------------------------------------------------------------- instructions

const IX: Record<string, number[]> = {
  buffer_deposit: [116, 43, 213, 36, 140, 232, 79, 207],
  buffer_withdraw: [150, 119, 201, 186, 120, 192, 208, 175],
  create_agent: [143, 66, 198, 95, 110, 85, 83, 249],
  set_policy: [40, 133, 12, 157, 235, 202, 2, 132],
  set_signer: [127, 120, 252, 184, 97, 4, 88, 68],
  set_agent_paused: [156, 197, 182, 170, 124, 76, 118, 195],
  revoke: [170, 23, 31, 34, 133, 173, 93, 242],
  set_allowlist: [141, 30, 41, 131, 132, 7, 216, 134],
  agent_withdraw: [13, 149, 99, 245, 171, 171, 185, 53],
  yield_deposit: [197, 128, 119, 222, 188, 102, 165, 63],
  yield_redeem: [229, 64, 30, 80, 246, 159, 124, 214],
  set_paused: [91, 60, 125, 192, 176, 225, 166, 218],
};

type Meta = [PublicKey, boolean, boolean]; // pubkey, signer, writable
function ix(name: keyof typeof IX, metas: Meta[], ...args: Uint8Array[]) {
  const len = 8 + args.reduce((s, a) => s + a.length, 0);
  const data = new Uint8Array(len);
  data.set(IX[name], 0);
  let o = 8;
  for (const a of args) {
    data.set(a, o);
    o += a.length;
  }
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: metas.map(([pubkey, isSigner, isWritable]) => ({ pubkey, isSigner, isWritable })),
    data: Buffer.from(data),
  });
}
const bool = (v: boolean) => Uint8Array.of(v ? 1 : 0);

/** Creates the owner's associated token account for `mint` if it does not exist. */
export function createAtaIdempotent(payer: PublicKey, owner: PublicKey, mint: PublicKey) {
  return new TransactionInstruction({
    programId: ATA_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata(owner, mint), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}

/** SPL token transfer (instruction 3). */
export function tokenTransfer(source: PublicKey, dest: PublicKey, owner: PublicKey, amount: bigint) {
  const data = new Uint8Array(9);
  data[0] = 3;
  data.set(u64(amount), 1);
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

export const build = {
  bufferDeposit(user: PublicKey, assets: bigint) {
    return [
      createAtaIdempotent(user, user, addresses.shareMint),
      ix("buffer_deposit", bufferMetas(user), u64(assets)),
    ];
  },
  bufferWithdraw(user: PublicKey, shares: bigint) {
    return [createAtaIdempotent(user, user, USDC_MINT), ix("buffer_withdraw", bufferMetas(user), u64(shares))];
  },
  createAgent(owner: PublicKey, agentId: bigint, signer: PublicKey, perCallCap: bigint, dailyCap: bigint) {
    const agent = agentAddress(owner, agentId);
    return [
      ix(
        "create_agent",
        [
          [owner, true, true],
          [addresses.config, false, false],
          [USDC_MINT, false, false],
          [agent, false, true],
          [agentVault(agent), false, true],
          [TOKEN_PROGRAM_ID, false, false],
          [SystemProgram.programId, false, false],
          [new PublicKey("SysvarRent111111111111111111111111111111111"), false, false],
        ],
        u64(agentId),
        signer.toBytes(),
        u64(perCallCap),
        u64(dailyCap),
      ),
    ];
  },
  setPolicy: (owner: PublicKey, agent: PublicKey, perCallCap: bigint, dailyCap: bigint) => [
    ix("set_policy", ownerMetas(owner, agent), u64(perCallCap), u64(dailyCap)),
  ],
  setSigner: (owner: PublicKey, agent: PublicKey, signer: PublicKey) => [ix("set_signer", ownerMetas(owner, agent), signer.toBytes())],
  setAgentPaused: (owner: PublicKey, agent: PublicKey, paused: boolean) => [ix("set_agent_paused", ownerMetas(owner, agent), bool(paused))],
  revoke: (owner: PublicKey, agent: PublicKey) => [ix("revoke", ownerMetas(owner, agent))],
  setAllowlist(owner: PublicKey, agent: PublicKey, payees: PublicKey[]) {
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, payees.length, true);
    return [ix("set_allowlist", ownerMetas(owner, agent), len, ...payees.map((p) => p.toBytes()))];
  },
  fundAgent(owner: PublicKey, agent: PublicKey, amount: bigint) {
    return [tokenTransfer(ata(owner, USDC_MINT), agentVault(agent), owner, amount)];
  },
  agentWithdraw(owner: PublicKey, agent: PublicKey, amount: bigint) {
    return [
      createAtaIdempotent(owner, owner, USDC_MINT),
      ix(
        "agent_withdraw",
        [
          [owner, true, false],
          [agent, false, true],
          [agentVault(agent), false, true],
          [ata(owner, USDC_MINT), false, true],
          [TOKEN_PROGRAM_ID, false, false],
        ],
        u64(amount),
      ),
    ];
  },
  yieldDeposit(owner: PublicKey, agent: PublicKey, amount: bigint) {
    return [
      ix(
        "yield_deposit",
        [
          [owner, true, true],
          [addresses.config, false, false],
          [agent, false, true],
          [agentVault(agent), false, true],
          [agentCtoken(agent), false, true],
          [KAMINO_CUSDC_MINT, false, true],
          [USDC_MINT, false, false],
          [KAMINO_USDC_RESERVE, false, true],
          [KAMINO_MARKET, false, false],
          [kaminoAuthority(), false, false],
          [KAMINO_USDC_SUPPLY, false, true],
          [SYSVAR_INSTRUCTIONS, false, false],
          [KLEND_PROGRAM_ID, false, false],
          [TOKEN_PROGRAM_ID, false, false],
          [SystemProgram.programId, false, false],
        ],
        u64(amount),
      ),
    ];
  },
  yieldRedeem(caller: PublicKey, agent: PublicKey, ctokens: bigint) {
    return [
      ix(
        "yield_redeem",
        [
          [caller, true, false],
          [addresses.config, false, true],
          [agent, false, true],
          [agentVault(agent), false, true],
          [agentCtoken(agent), false, true],
          [addresses.bufferVault, false, true],
          [KAMINO_CUSDC_MINT, false, true],
          [USDC_MINT, false, false],
          [KAMINO_USDC_RESERVE, false, true],
          [KAMINO_MARKET, false, false],
          [kaminoAuthority(), false, false],
          [KAMINO_USDC_SUPPLY, false, true],
          [SYSVAR_INSTRUCTIONS, false, false],
          [KLEND_PROGRAM_ID, false, false],
          [TOKEN_PROGRAM_ID, false, false],
        ],
        u64(ctokens),
      ),
    ];
  },
  setProtocolPaused: (admin: PublicKey, paused: boolean) => [
    ix("set_paused", [[admin, true, false], [addresses.config, false, true]], bool(paused)),
  ],
};

function bufferMetas(user: PublicKey): Meta[] {
  return [
    [user, true, true],
    [addresses.config, false, true],
    [addresses.bufferVault, false, true],
    [addresses.shareMint, false, true],
    [ata(user, USDC_MINT), false, true],
    [ata(user, addresses.shareMint), false, true],
    [TOKEN_PROGRAM_ID, false, false],
  ];
}

function ownerMetas(owner: PublicKey, agent: PublicKey): Meta[] {
  return [
    [owner, true, false],
    [agent, false, true],
  ];
}

export function txUrl(sig: string) {
  return `https://solscan.io/tx/${sig}${isDevnet ? "?cluster=devnet" : ""}`;
}
export function addressUrl(a: string) {
  return `https://solscan.io/account/${a}${isDevnet ? "?cluster=devnet" : ""}`;
}
