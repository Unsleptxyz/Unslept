import { NextResponse } from "next/server";
import { createPublicClient, parseAbiItem } from "viem";
import { addresses, appTransport, chain, deployBlock } from "@/lib/web3";
import { DEV_WALLET, PONS_FACTORIES, TOKEN_SYMBOL } from "@/lib/token";
import { pad } from "viem";

/**
 * Lightweight indexer. Each call reads new SettlementRouter and factory events since the last indexed block,
 * takes one buffer snapshot, and stores them in Supabase through the secret-checked un_ingest function.
 * Safe to trigger by anyone: it only copies public chain data. Re-running it is idempotent apart from one extra snapshot.
 * Triggered every 10 minutes by .github/workflows/index.yml and daily by Vercel Cron.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const settled = parseAbiItem(
  "event Settled(bytes32 indexed paymentId, address indexed agent, address indexed payee, address buffer, address recipient, uint256 amount, uint256 fee, uint8 mode, string endpoint)",
);
const created = parseAbiItem("event AccountCreated(address indexed account, address indexed owner, address indexed signer, bool treasury)");
const bufferAbi = [
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "utilizationBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "convertToAssets", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;
const adapterAbi = [
  { type: "function", name: "totalValue", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "valueOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const CHUNK = 50_000n;
const MAX_CHUNKS = 40n;

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

export async function GET() {
  const secret = process.env.INDEXER_SECRET;
  if (!chain || !secret || !process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.json({ error: "Indexer is not configured." }, { status: 503 });
  }
  const client = createPublicClient({ chain, transport: appTransport() });
  const adapters = (process.env.INDEXER_ADAPTERS ?? "").split(",").map((s) => s.trim()).filter(Boolean) as `0x${string}`[];

  const last = BigInt((await rpc("un_index_last_block", {})) ?? 0);
  const head = await client.getBlockNumber();
  let from = last > 0n ? last + 1n : deployBlock;
  const to = head < from + CHUNK * MAX_CHUNKS ? head : from + CHUNK * MAX_CHUNKS - 1n;

  // $UNSLEPT launch detection: look for Pons factory logs naming the dev wallet as deployer, until one is found.
  const tokenKnown = !!process.env.NEXT_PUBLIC_UNSLEPT_TOKEN_ADDRESS || !!(await rpc("un_token_get", {}))?.address;
  const devTopic = pad(DEV_WALLET.toLowerCase() as `0x${string}`);
  let foundToken: { address: `0x${string}`; factory: string; block: number; tx: string } | undefined;
  const symbolAbi = [{ type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }] as const;

  const payments: Record<string, unknown>[] = [];
  const accounts: Record<string, unknown>[] = [];
  const times = new Map<bigint, number>();
  const ts = async (b: bigint) => {
    if (!times.has(b)) times.set(b, Number((await client.getBlock({ blockNumber: b })).timestamp));
    return times.get(b)!;
  };

  for (; from <= to; from += CHUNK) {
    const end = from + CHUNK - 1n < to ? from + CHUNK - 1n : to;
    const [pLogs, aLogs] = await Promise.all([
      client.getLogs({ address: addresses.router, event: settled, fromBlock: from, toBlock: end }),
      client.getLogs({ address: addresses.factory, event: created, fromBlock: from, toBlock: end }),
    ]);
    if (!tokenKnown && !foundToken && PONS_FACTORIES.length) {
      const launchLogs = (
        await Promise.all([
          client.request({ method: "eth_getLogs", params: [{ address: PONS_FACTORIES, topics: [null, null, devTopic], fromBlock: `0x${from.toString(16)}`, toBlock: `0x${end.toString(16)}` }] }),
          client.request({ method: "eth_getLogs", params: [{ address: PONS_FACTORIES, topics: [null, null, null, devTopic], fromBlock: `0x${from.toString(16)}`, toBlock: `0x${end.toString(16)}` }] }),
        ])
      ).flat() as { address: string; topics: string[]; blockNumber: string; transactionHash: string }[];
      for (const l of launchLogs) {
        if (!l.topics?.[1]) continue;
        const candidate = `0x${l.topics[1].slice(26)}` as `0x${string}`;
        const sym = await client.readContract({ address: candidate, abi: symbolAbi, functionName: "symbol" }).catch(() => "");
        if (sym.trim().replace(/^\$/, "").toUpperCase() === TOKEN_SYMBOL) {
          foundToken = { address: candidate, factory: l.address, block: Number(BigInt(l.blockNumber)), tx: l.transactionHash };
          break;
        }
      }
    }
    for (const l of pLogs) {
      payments.push({
        id: `${l.transactionHash}-${l.logIndex}`,
        paymentId: l.args.paymentId,
        agent: l.args.agent,
        payee: l.args.payee,
        buffer: l.args.buffer,
        amount: l.args.amount!.toString(),
        fee: l.args.fee!.toString(),
        mode: l.args.mode,
        endpoint: l.args.endpoint,
        tx: l.transactionHash,
        block: Number(l.blockNumber),
        ts: await ts(l.blockNumber!),
      });
    }
    for (const l of aLogs) {
      accounts.push({
        address: l.args.account,
        owner: l.args.owner,
        signer: l.args.signer,
        treasury: l.args.treasury,
        block: Number(l.blockNumber),
        ts: await ts(l.blockNumber!),
      });
    }
  }

  const [totalAssets, utilizationBps, assetsPerShare, block] = await Promise.all([
    client.readContract({ address: addresses.buffer, abi: bufferAbi, functionName: "totalAssets" }),
    client.readContract({ address: addresses.buffer, abi: bufferAbi, functionName: "utilizationBps" }),
    client.readContract({ address: addresses.buffer, abi: bufferAbi, functionName: "convertToAssets", args: [10n ** 18n] }),
    client.getBlock({ blockNumber: to }),
  ]);
  // Value parked by agent and treasury accounts. The buffer's own parked share is already in its totalAssets.
  let valueWorking = 0n;
  for (const a of adapters) {
    const [all, ofBuffer] = await Promise.all([
      client.readContract({ address: a, abi: adapterAbi, functionName: "totalValue" }).catch(() => 0n),
      client.readContract({ address: a, abi: adapterAbi, functionName: "valueOf", args: [addresses.buffer] }).catch(() => 0n),
    ]);
    valueWorking += all > ofBuffer ? all - ofBuffer : 0n;
  }

  await rpc("un_ingest", {
    p_secret: secret,
    p_last_block: Number(to),
    p_payments: payments,
    p_accounts: accounts,
    p_snapshot: {
      buffer: addresses.buffer,
      block: Number(to),
      ts: Number(block.timestamp),
      totalAssets: totalAssets.toString(),
      assetsPerShare: assetsPerShare.toString(),
      utilizationBps: Number(utilizationBps),
      valueWorking: valueWorking.toString(),
    },
  });

  if (foundToken) {
    await rpc("un_token_set", {
      p_secret: secret,
      p_address: foundToken.address,
      p_symbol: TOKEN_SYMBOL,
      p_factory: foundToken.factory,
      p_block: foundToken.block,
      p_tx: foundToken.tx,
    });
  }

  return NextResponse.json({ token: foundToken?.address, indexedTo: Number(to), head: Number(head), payments: payments.length, accounts: accounts.length });
}
