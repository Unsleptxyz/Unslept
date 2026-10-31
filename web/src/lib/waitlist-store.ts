import { promises as fs } from "node:fs";
import path from "node:path";
import { waitlistStore } from "./config";

export interface WaitlistEntry {
  email: string;
  wallet: string | null;
}

export type StoreResult = "joined" | "already" | "unavailable";

/**
 * Pluggable waitlist storage.
 * - Supabase (table un_waitlist) when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.
 * - A local JSON file in development only.
 * - Otherwise "unavailable", so production never silently drops entries.
 */
export async function saveWaitlistEntry(entry: WaitlistEntry): Promise<StoreResult> {
  const { supabaseUrl, supabaseKey, publishableKey } = waitlistStore;
  const key = supabaseKey ?? publishableKey;
  if (supabaseUrl && key) return saveToSupabase(supabaseUrl, key, entry);
  if (process.env.NODE_ENV !== "production") return saveToFile(entry);
  return "unavailable";
}

async function saveToSupabase(url: string, key: string, entry: WaitlistEntry): Promise<StoreResult> {
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/un_waitlist`, {
    method: "POST",
    headers: {
      apikey: key,
      // Only legacy JWT keys go in Authorization; publishable and secret keys (sb_...) use the apikey header alone.
      ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ email: entry.email, wallet: entry.wallet }),
    signal: AbortSignal.timeout(5000),
  });
  if (res.ok) return "joined";
  if (res.status === 409) return "already"; // unique violation on email
  console.error("waitlist: supabase insert failed", res.status, await res.text().catch(() => ""));
  return "unavailable";
}

async function saveToFile(entry: WaitlistEntry): Promise<StoreResult> {
  const dir = path.join(process.cwd(), ".data");
  const file = path.join(dir, "waitlist.json");
  await fs.mkdir(dir, { recursive: true });
  let rows: (WaitlistEntry & { created_at: string })[] = [];
  try {
    rows = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    rows = [];
  }
  if (rows.some((r) => r.email === entry.email)) return "already";
  rows.push({ ...entry, created_at: new Date().toISOString() });
  await fs.writeFile(file, JSON.stringify(rows, null, 2));
  return "joined";
}
