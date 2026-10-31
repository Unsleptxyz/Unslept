import { ponder, type Context } from "ponder:registry";
import { account, bufferSnapshot, payment, totals } from "ponder:schema";
import { ERC4626AdapterAbi } from "../abis/ERC4626Adapter";
import { UnsleptBufferAbi } from "../abis/UnsleptBuffer";

// Adapters whose totalValue counts as "value working" (comma-separated). Read from the environment.
const adapters = (process.env.INDEXER_ADAPTERS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean) as `0x${string}`[];

const GLOBAL = "global";

async function bumpTotals(context: Context, timestamp: number, patch: (t: typeof totals.$inferSelect) => Partial<typeof totals.$inferSelect>) {
  let valueWorking = 0n;
  for (const a of adapters) {
    try {
      valueWorking += await context.client.readContract({ abi: ERC4626AdapterAbi, address: a, functionName: "totalValue" });
    } catch {
      /* stale price: keep the previous value */
    }
  }
  const existing = await context.db.find(totals, { id: GLOBAL });
  const base = existing ?? { id: GLOBAL, paymentsSettled: 0, volume: 0n, fees: 0n, connectedAgents: 0, valueWorking: 0n, updatedAt: 0 };
  const next = { ...base, ...patch(base), updatedAt: timestamp, ...(adapters.length ? { valueWorking } : {}) };
  if (existing) await context.db.update(totals, { id: GLOBAL }).set(next);
  else await context.db.insert(totals).values(next);
}

async function snapshot(context: Context, buffer: `0x${string}`, blockNumber: bigint, timestamp: number) {
  const [totalAssets, assetsPerShare, utilizationBps] = await Promise.all([
    context.client.readContract({ abi: UnsleptBufferAbi, address: buffer, functionName: "totalAssets" }),
    context.client.readContract({ abi: UnsleptBufferAbi, address: buffer, functionName: "convertToAssets", args: [10n ** 18n] }),
    context.client.readContract({ abi: UnsleptBufferAbi, address: buffer, functionName: "utilizationBps" }),
  ]);
  await context.db
    .insert(bufferSnapshot)
    .values({ id: `${buffer}-${blockNumber}`, buffer, blockNumber, timestamp, totalAssets, assetsPerShare, utilizationBps })
    .onConflictDoUpdate({ totalAssets, assetsPerShare, utilizationBps });
}

ponder.on("SettlementRouter:Settled", async ({ event, context }) => {
  const ts = Number(event.block.timestamp);
  await context.db.insert(payment).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    paymentId: event.args.paymentId,
    agent: event.args.agent,
    payee: event.args.payee,
    buffer: event.args.buffer,
    amount: event.args.amount,
    fee: event.args.fee,
    mode: Number(event.args.mode),
    endpoint: event.args.endpoint,
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
    timestamp: ts,
  });
  await bumpTotals(context, ts, (t) => ({
    paymentsSettled: t.paymentsSettled + 1,
    volume: t.volume + event.args.amount,
    fees: t.fees + event.args.fee,
  }));
});

ponder.on("AgentAccountFactory:AccountCreated", async ({ event, context }) => {
  const ts = Number(event.block.timestamp);
  await context.db.insert(account).values({
    address: event.args.account,
    owner: event.args.owner,
    signer: event.args.signer,
    treasury: event.args.treasury,
    createdAt: ts,
  });
  if (!event.args.treasury) await bumpTotals(context, ts, (t) => ({ connectedAgents: t.connectedAgents + 1 }));
});

for (const name of ["Deposit", "Withdraw", "Repaid", "Advanced", "WithdrawRequested", "Unwound", "Allocated"] as const) {
  ponder.on(`UnsleptBuffer:${name}`, async ({ event, context }) => {
    await snapshot(context, event.log.address, event.block.number, Number(event.block.timestamp));
  });
}
