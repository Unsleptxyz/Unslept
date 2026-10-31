import { addresses, chain } from "@/lib/web3";

/** x402 Directory: paid endpoints that accept USDG on Robinhood Chain, so Unslept agents can pay them. */
export interface DirectoryEntry {
  id: number;
  url: string;
  name: string;
  description: string;
  category: string;
  provider?: string | null;
  website?: string | null;
  scheme: string;
  network: string;
  asset: string;
  pay_to: string;
  price: string;
  verified: boolean;
  online: boolean;
  last_checked: number;
  created_at: string;
}

export const CATEGORIES = [
  { id: "data", label: "Data" },
  { id: "ai", label: "AI and models" },
  { id: "search", label: "Search" },
  { id: "crypto", label: "Onchain" },
  { id: "media", label: "Media" },
  { id: "tools", label: "Tools" },
  { id: "other", label: "Other" },
] as const;

export async function listDirectory(): Promise<DirectoryEntry[]> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  try {
    const r = await fetch(`${url}/rest/v1/rpc/un_directory_list`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: "{}",
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return [];
    const d = (await r.json()) as DirectoryEntry[];
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

export interface ProbeResult {
  ok: boolean;
  reason?: string;
  scheme?: string;
  network?: string;
  asset?: string;
  payTo?: string;
  price?: string;
  description?: string;
}

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$|.*\.local$|.*\.internal$)|^172\.(1[6-9]|2\d|3[01])\./i;

/** Public https URL only: no credentials, no private or link-local hosts. */
export function checkUrl(raw: string): URL | string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "Enter a full URL, starting with https://.";
  }
  if (u.protocol !== "https:") return "The endpoint must use https.";
  if (u.username || u.password) return "Remove credentials from the URL.";
  if (PRIVATE_HOST.test(u.hostname)) return "The endpoint must be publicly reachable.";
  if (raw.length > 300) return "The URL is too long.";
  return u;
}

/**
 * Calls the endpoint without payment and checks that it answers 402 with an x402 v2 PAYMENT-REQUIRED header
 * offering USDG on Robinhood Chain through "unslept-direct" or "exact".
 */
export async function probeEndpoint(raw: string): Promise<ProbeResult> {
  const u = checkUrl(raw);
  if (typeof u === "string") return { ok: false, reason: u };
  if (!chain) return { ok: false, reason: "The chain is not configured on this deployment." };
  let res: Response;
  try {
    res = await fetch(u, { method: "GET", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(8000), headers: { "user-agent": "UnsleptDirectory/1.0" } });
  } catch {
    return { ok: false, reason: "The endpoint did not answer within 8 seconds." };
  }
  if (res.status !== 402) return { ok: false, reason: `Expected HTTP 402 without payment, got ${res.status}.` };
  const header = res.headers.get("payment-required");
  if (!header) return { ok: false, reason: "The 402 response has no PAYMENT-REQUIRED header (x402 v2)." };
  let pr: { accepts?: { scheme?: string; network?: string; asset?: string; payTo?: string; amount?: string }[]; resource?: { description?: string } };
  try {
    pr = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return { ok: false, reason: "PAYMENT-REQUIRED is not base64-encoded JSON." };
  }
  const network = `eip155:${chain.id}`;
  const usdg = addresses.usdg?.toLowerCase();
  const a = (pr.accepts ?? []).find(
    (x) => x.network === network && x.asset?.toLowerCase() === usdg && (x.scheme === "unslept-direct" || x.scheme === "exact"),
  );
  if (!a) return { ok: false, reason: `No payment option for USDG on ${network}. Unslept agents can only pay USDG on Robinhood Chain.` };
  if (!a.payTo || !/^0x[0-9a-fA-F]{40}$/.test(a.payTo) || !a.amount || !/^\d+$/.test(a.amount)) {
    return { ok: false, reason: "The payment option is missing payTo or amount." };
  }
  return { ok: true, scheme: a.scheme, network, asset: a.asset, payTo: a.payTo, price: a.amount, description: pr.resource?.description };
}
