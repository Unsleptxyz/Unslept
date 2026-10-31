import { token } from "@/lib/config";

/**
 * $UNSLEPT launch detection settings.
 * The indexer watches the Pons launch factories for a launch whose deployer is the dev wallet and whose symbol is
 * UNSLEPT, then stores the token address. NEXT_PUBLIC_UNSLEPT_TOKEN_ADDRESS, when set, always wins.
 */
export const TOKEN_SYMBOL = "UNSLEPT";
export const DEV_WALLET = (process.env.UNSLEPT_DEV_WALLET || "0x32AA18844DEe5cb6B597Ef24642bC7Bf87a5F66C") as `0x${string}`;

/** Pons launch factories on Robinhood Chain (v1 active, v1 legacy, v2). The token is always the first indexed argument. */
export const PONS_FACTORIES: `0x${string}`[] = (
  process.env.PONS_FACTORIES ||
  "0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB,0x0c37a24F5D23A486FA692d1500881d698B1F77a4,0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e"
)
  .split(",")
  .map((s) => s.trim())
  .filter((s) => /^0x[0-9a-fA-F]{40}$/.test(s)) as `0x${string}`[];

/** The token address to show: the env override, else the address the indexer found. Cached for a minute. */
export async function getTokenAddress(): Promise<string | undefined> {
  if (token.address) return token.address;
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return undefined;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/un_token_get`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: "{}",
      next: { revalidate: 60 },
    });
    if (!r.ok) return undefined;
    const j = (await r.json()) as { address?: string } | null;
    return j?.address && /^0x[0-9a-fA-F]{40}$/.test(j.address) ? j.address : undefined;
  } catch {
    return undefined;
  }
}
