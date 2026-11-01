/** Unslept on Solana: program constants and account layouts. Dependency-free. */

export const PROGRAM_ID = "HbAgL4w8R9D8RUEuK4rJknK5Vn8rBusfRtfTnFcYieue";
export const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const ATA_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

export const NETWORKS = {
  solana: {
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    rpcUrl: "https://api.mainnet-beta.solana.com",
  },
  "solana-devnet": {
    caip2: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    usdc: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    rpcUrl: "https://api.devnet.solana.com",
  },
} as const;
export type NetworkName = keyof typeof NETWORKS;

export const DISC = {
  pay: [119, 18, 216, 65, 192, 117, 122, 220],
  agent: [47, 166, 112, 147, 155, 197, 86, 7],
  payment: [227, 231, 51, 26, 244, 88, 4, 148],
  config: [155, 12, 170, 224, 30, 250, 204, 130],
  settled: [232, 210, 40, 17, 142, 124, 145, 238],
} as const;

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function b58encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

export function b58decode(s: string): Uint8Array {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error(`invalid base58 character ${c}`);
    n = n * 58n + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const c of s) {
    if (c !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

export const isBase58Address = (s: unknown): s is string => {
  if (typeof s !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return false;
  try {
    return b58decode(s).length === 32;
  } catch {
    return false;
  }
};

export const hexToBytes = (h: string) => Uint8Array.from((h.replace(/^0x/, "").match(/../g) ?? []).map((x) => parseInt(x, 16)));
export const bytesToHex = (b: Uint8Array) => `0x${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;

class Reader {
  o = 0;
  constructor(readonly d: Uint8Array) {}
  private dv = () => new DataView(this.d.buffer, this.d.byteOffset, this.d.byteLength);
  bytes(n: number) {
    const v = this.d.subarray(this.o, this.o + n);
    this.o += n;
    return v;
  }
  key() {
    return b58encode(this.bytes(32));
  }
  u8() {
    return this.d[this.o++];
  }
  u16() {
    const v = this.dv().getUint16(this.o, true);
    this.o += 2;
    return v;
  }
  u64() {
    const v = this.dv().getBigUint64(this.o, true);
    this.o += 8;
    return v;
  }
  i64() {
    const v = this.dv().getBigInt64(this.o, true);
    this.o += 8;
    return v;
  }
}

const checkDisc = (d: Uint8Array, disc: readonly number[], what: string) => {
  if (d.length < 8 || disc.some((b, i) => d[i] !== b)) throw new Error(`account is not an Unslept ${what}`);
};

export interface AgentAccount {
  owner: string;
  signer: string;
  agentId: bigint;
  perCallCap: bigint;
  dailyCap: bigint;
  spentToday: bigint;
  spendDay: bigint;
  paused: boolean;
  revoked: boolean;
  debt: bigint;
  positionValue: bigint;
  payments: bigint;
  allowlist: string[];
}

export function decodeAgent(d: Uint8Array): AgentAccount {
  checkDisc(d, DISC.agent, "agent");
  const r = new Reader(d);
  r.o = 8;
  const a = {
    owner: r.key(),
    signer: r.key(),
    agentId: r.u64(),
    perCallCap: r.u64(),
    dailyCap: r.u64(),
    spentToday: r.u64(),
    spendDay: r.i64(),
    paused: r.u8() === 1,
    revoked: r.u8() === 1,
    debt: r.u64(),
    positionValue: r.u64(),
    payments: r.u64(),
  };
  const len = r.u8();
  const allowlist: string[] = [];
  for (let i = 0; i < 8; i++) {
    const k = r.key();
    if (i < len) allowlist.push(k);
  }
  return { ...a, allowlist };
}

export interface ConfigAccount {
  admin: string;
  usdcMint: string;
  feeBps: number;
  depositCap: bigint;
  pauser: string;
  keeper: string;
  treasury: string;
  outstandingDebt: bigint;
  paused: boolean;
}

export function decodeConfig(d: Uint8Array): ConfigAccount {
  checkDisc(d, DISC.config, "config");
  const r = new Reader(d);
  r.o = 8;
  const admin = r.key();
  r.key(); // pending admin
  const usdcMint = r.key();
  const feeBps = r.u16();
  const depositCap = r.u64();
  const pauser = r.key();
  const keeper = r.key();
  const treasury = r.key();
  r.o += 2 + 8 + 32 * 3; // pending params
  r.i64(); // pending eta
  const outstandingDebt = r.u64();
  const paused = r.u8() === 1;
  return { admin, usdcMint, feeBps, depositCap, pauser, keeper, treasury, outstandingDebt, paused };
}

export interface PaymentAccount {
  paymentId: string;
  agent: string;
  payee: string;
  amount: bigint;
  fee: bigint;
  endpointHash: string;
  slot: bigint;
  ts: bigint;
}

export function decodePayment(d: Uint8Array): PaymentAccount {
  checkDisc(d, DISC.payment, "payment record");
  const r = new Reader(d);
  r.o = 8;
  return {
    paymentId: bytesToHex(r.bytes(32)),
    agent: r.key(),
    payee: r.key(),
    amount: r.u64(),
    fee: r.u64(),
    endpointHash: bytesToHex(r.bytes(32)),
    slot: r.u64(),
    ts: r.i64(),
  };
}

export interface SettledEvent {
  paymentId: string;
  agent: string;
  payee: string;
  amount: bigint;
  fee: bigint;
  fronted: bigint;
}

/** Decodes a `Program data:` log line payload (base64) into a Settled event, or undefined. */
export function decodeSettled(b64: string): SettledEvent | undefined {
  const d = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (d.length < 8 + 32 * 3 + 24 || DISC.settled.some((b, i) => d[i] !== b)) return undefined;
  const r = new Reader(d);
  r.o = 8;
  return { paymentId: bytesToHex(r.bytes(32)), agent: r.key(), payee: r.key(), amount: r.u64(), fee: r.u64(), fronted: r.u64() };
}
