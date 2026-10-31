import type { NetworkStats } from "@/components/landing/Sections";
import { indexer } from "./config";

/**
 * Reads network stats from the indexer (Phase 2). Until INDEXER_URL is set,
 * the landing page shows the pre-launch empty state.
 * Expected response shape from `${INDEXER_URL}/stats`:
 * { totalValueWorkingUsd: number, paymentsSettled: number, connectedAgents: number, bufferRateBps: number | null }
 */
/** Stats from the Supabase-backed lightweight indexer (un_stats), when configured. */
async function fromSupabase(): Promise<NetworkStats | undefined> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return undefined;
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/un_stats`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: "{}",
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return { status: "error" };
    const d = (await r.json()) as {
      lastBlock: number;
      totalValueWorking: string;
      bufferTotalAssets: string;
      paymentsSettled: number;
      connectedAgents: number;
      bufferRateBps: number | null;
    };
    if (!d.lastBlock) return { status: "prelaunch" };
    return {
      status: "live",
      totalValueWorkingUsd: (Number(d.totalValueWorking) + Number(d.bufferTotalAssets)) / 1e6,
      paymentsSettled: d.paymentsSettled,
      connectedAgents: d.connectedAgents,
      bufferRateBps: d.bufferRateBps,
    };
  } catch {
    return { status: "error" };
  }
}

export async function getNetworkStats(): Promise<NetworkStats> {
  const sb = await fromSupabase();
  if (sb) return sb;
  if (!indexer.url) return { status: "prelaunch" };
  try {
    const res = await fetch(`${indexer.url.replace(/\/$/, "")}/stats`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { status: "error" };
    const d = (await res.json()) as Record<string, unknown>;
    const nums = ["totalValueWorkingUsd", "paymentsSettled", "connectedAgents"] as const;
    if (!nums.every((k) => typeof d[k] === "number" && Number.isFinite(d[k]))) return { status: "error" };
    const rate = typeof d.bufferRateBps === "number" && Number.isFinite(d.bufferRateBps) ? d.bufferRateBps : null;
    return {
      status: "live",
      totalValueWorkingUsd: d.totalValueWorkingUsd as number,
      paymentsSettled: d.paymentsSettled as number,
      connectedAgents: d.connectedAgents as number,
      bufferRateBps: rate,
    };
  } catch {
    return { status: "error" };
  }
}
