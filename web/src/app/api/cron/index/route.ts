import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, addresses, decodeConfig, decodeSettled, rpcUrl } from "@/lib/solana";
import { probeEndpoint } from "@/lib/directory";

/**
 * Lightweight Solana indexer. Each call reads the Unslept program's new transactions since the last indexed slot,
 * collects Settled and AgentCreated events, takes one buffer snapshot, and stores them in Supabase through the
 * secret-checked un_ingest function. Safe to trigger by anyone: it only copies public chain data.
 * Triggered every 10 minutes by .github/workflows/index.yml and daily by Vercel Cron.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Slots below this belong to the earlier Robinhood Chain index (block numbers), so indexing starts fresh. */
const SOLANA_MIN_SLOT = 300_000_000;
const AGENT_CREATED = [237, 44, 61, 111, 90, 251, 241, 34];
const AGENT_DISC = "8yGSUtV5BEn";

async function rpc(name: string, body: unknown) {
  const url = process.env.SUPABASE_URL!.replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${name}: ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

function decodeAgentCreated(b64: string) {
  const d = Buffer.from(b64, "base64");
  if (d.length < 8 + 96 + 8 || AGENT_CREATED.some((b, i) => d[i] !== b)) return undefined;
  const key = (o: number) => new PublicKey(d.subarray(o, o + 32)).toBase58();
  return { agent: key(8), owner: key(40), signer: key(72) };
}

export async function GET() {
  try {
    return await run();
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e).slice(0, 500) }, { status: 500 });
  }
}

async function run() {
  const secret = process.env.INDEXER_SECRET;
  if (!secret || !process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.json({ error: "Indexer is not configured." }, { status: 503 });
  }
  const conn = new Connection(process.env.SOLANA_RPC_URL || rpcUrl, "confirmed");
  const stored = Number((await rpc("un_index_last_block", {})) ?? 0);
  const last = stored >= SOLANA_MIN_SLOT ? stored : 0;

  // Newest first; walk back until the last indexed slot (at most 5 pages per run).
  const sigs: { signature: string; slot: number; blockTime?: number | null; err: unknown }[] = [];
  let before: string | undefined;
  for (let page = 0; page < 5; page++) {
    const batch = await conn.getSignaturesForAddress(PROGRAM_ID, { before, limit: 1000 }, "confirmed");
    const fresh = batch.filter((s) => s.slot > last);
    sigs.push(...fresh);
    if (batch.length < 1000 || fresh.length < batch.length) break;
    before = batch[batch.length - 1].signature;
  }
  // Process oldest first so the stored slot only moves forward over what was read.
  sigs.reverse();
  const payments: Record<string, unknown>[] = [];
  const accounts: Record<string, unknown>[] = [];
  let maxSlot = last;
  for (const s of sigs) {
    if (s.err) {
      maxSlot = Math.max(maxSlot, s.slot);
      continue;
    }
    const tx = await conn.getTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
    const ts = s.blockTime ?? Math.floor(Date.now() / 1000);
    (tx?.meta?.logMessages ?? []).forEach((line, i) => {
      if (!line.startsWith("Program data: ")) return;
      const b64 = line.slice(14);
      const p = decodeSettled(b64);
      if (p) {
        payments.push({
          id: `${s.signature}-${i}`,
          paymentId: p.paymentId,
          agent: p.agent,
          payee: p.payee,
          buffer: addresses.bufferVault.toBase58(),
          amount: p.amount.toString(),
          fee: p.fee.toString(),
          mode: 0,
          endpoint: "",
          tx: s.signature,
          block: s.slot,
          ts,
        });
        return;
      }
      const a = decodeAgentCreated(b64);
      if (a) accounts.push({ address: a.agent, owner: a.owner, signer: a.signer, treasury: false, block: s.slot, ts });
    });
    maxSlot = Math.max(maxSlot, s.slot);
  }

  // Buffer snapshot and value working in Kamino.
  const [cfgInfo, vault, supply, agentAccts, slot] = await Promise.all([
    conn.getAccountInfo(addresses.config, "confirmed"),
    conn.getTokenAccountBalance(addresses.bufferVault, "confirmed").catch(() => undefined),
    conn.getTokenSupply(addresses.shareMint, "confirmed").catch(() => undefined),
    conn.getProgramAccounts(PROGRAM_ID, { commitment: "confirmed", filters: [{ memcmp: { offset: 0, bytes: AGENT_DISC } }], dataSlice: { offset: 8 + 64 + 8 * 5 + 2 + 8, length: 8 } }),
    conn.getSlot("confirmed"),
  ]);
  const config = cfgInfo ? decodeConfig(new Uint8Array(cfgInfo.data)) : undefined;
  let snapshot: Record<string, unknown> | null = null;
  if (config) {
    const available = BigInt(vault?.value.amount ?? "0");
    const totalAssets = available + config.outstandingDebt;
    const shares = BigInt(supply?.value.amount ?? "0");
    const valueWorking = agentAccts.reduce((s, a) => s + Buffer.from(a.account.data).readBigUInt64LE(0), 0n);
    snapshot = {
      buffer: addresses.bufferVault.toBase58(),
      block: slot,
      ts: Math.floor(Date.now() / 1000),
      totalAssets: totalAssets.toString(),
      assetsPerShare: (shares > 0n ? (totalAssets * 1_000_000n) / shares : 1_000_000n).toString(),
      utilizationBps: totalAssets > 0n ? Number((config.outstandingDebt * 10_000n) / totalAssets) : 0,
      valueWorking: valueWorking.toString(),
    };
  }

  await rpc("un_ingest", { p_secret: secret, p_last_block: Math.max(maxSlot, SOLANA_MIN_SLOT), p_payments: payments, p_accounts: accounts, p_snapshot: snapshot });

  // Directory health: re-check the five listings checked longest ago.
  let checked = 0;
  try {
    const due = ((await rpc("un_directory_due", { p_secret: secret, p_limit: 5 })) ?? []) as { id: number; url: string }[];
    await Promise.all(
      due.map(async (d) => {
        const p = await probeEndpoint(d.url);
        await rpc("un_directory_checked", { p_secret: secret, p_id: d.id, p_ok: p.ok });
        checked++;
      }),
    );
  } catch {
    /* directory checks never block indexing */
  }

  return NextResponse.json({ directoryChecked: checked, indexedTo: maxSlot, head: slot, payments: payments.length, accounts: accounts.length, deployed: !!config });
}
