import { Hono } from "hono";
import { and, asc, desc, eq, gte } from "ponder";
import { db } from "ponder:api";
import * as schema from "ponder:schema";
import { graphql } from "ponder";

const app = new Hono();
const PRIMARY = (process.env.NEXT_PUBLIC_BUFFER_ADDRESS ?? "").toLowerCase() as `0x${string}`;
const WINDOW_DAYS = Number(process.env.INDEXER_RATE_WINDOW_DAYS ?? 7);
const MIN_HISTORY_SECONDS = 24 * 3600;

app.use("/graphql", graphql({ db, schema }));

/**
 * Trailing variable rate, annualized from the buffer's share price over the window.
 * It is history, not a projection. Returns null until there is at least a day of history.
 */
async function trailingRateBps(buffer: `0x${string}`): Promise<number | null> {
  const [latest] = await db.select().from(schema.bufferSnapshot).where(eq(schema.bufferSnapshot.buffer, buffer)).orderBy(desc(schema.bufferSnapshot.timestamp)).limit(1);
  if (!latest) return null;
  const since = latest.timestamp - WINDOW_DAYS * 86400;
  const [start] = await db
    .select()
    .from(schema.bufferSnapshot)
    .where(and(eq(schema.bufferSnapshot.buffer, buffer), gte(schema.bufferSnapshot.timestamp, since)))
    .orderBy(asc(schema.bufferSnapshot.timestamp))
    .limit(1);
  if (!start || latest.timestamp - start.timestamp < MIN_HISTORY_SECONDS || start.assetsPerShare === 0n) return null;
  const growth = Number(latest.assetsPerShare - start.assetsPerShare) / Number(start.assetsPerShare);
  const years = (latest.timestamp - start.timestamp) / (365 * 86400);
  return Math.round((growth / years) * 10_000);
}

/** Shape read by the website's stats section (web/src/lib/stats.ts). */
app.get("/stats", async (c) => {
  const [t] = await db.select().from(schema.totals).where(eq(schema.totals.id, "global")).limit(1);
  const [snap] = await db.select().from(schema.bufferSnapshot).where(eq(schema.bufferSnapshot.buffer, PRIMARY)).orderBy(desc(schema.bufferSnapshot.timestamp)).limit(1);
  const usdg = (v: bigint) => Number(v) / 1e6;
  return c.json({
    totalValueWorkingUsd: usdg(t?.valueWorking ?? 0n),
    paymentsSettled: t?.paymentsSettled ?? 0,
    connectedAgents: t?.connectedAgents ?? 0,
    bufferRateBps: await trailingRateBps(PRIMARY),
    bufferTotalAssetsUsd: usdg(snap?.totalAssets ?? 0n),
    utilizationBps: Number(snap?.utilizationBps ?? 0n),
    updatedAt: t?.updatedAt ?? null,
  });
});

app.get("/agents/:address/payments", async (c) => {
  const agent = c.req.param("address").toLowerCase() as `0x${string}`;
  const limit = Math.min(200, Number(c.req.query("limit") ?? 50));
  const rows = await db.select().from(schema.payment).where(eq(schema.payment.agent, agent)).orderBy(desc(schema.payment.timestamp)).limit(limit);
  return c.json(rows.map((r) => ({ ...r, amount: r.amount.toString(), fee: r.fee.toString(), blockNumber: r.blockNumber.toString() })));
});

export default app;
