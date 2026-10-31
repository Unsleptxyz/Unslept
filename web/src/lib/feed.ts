/** Recent x402 payments settled through Unslept, read from the indexer (un_feed). Public chain data. */
export interface FeedItem {
  agent: string;
  payee: string;
  amount: string;
  fee: string;
  mode: number;
  endpoint: string;
  tx: string;
  block: number;
  ts: number;
}

export async function getFeed(limit = 12): Promise<FeedItem[]> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  try {
    const r = await fetch(`${url}/rest/v1/rpc/un_feed`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_limit: limit }),
      next: { revalidate: 15 },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return [];
    const d = (await r.json()) as FeedItem[];
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}
