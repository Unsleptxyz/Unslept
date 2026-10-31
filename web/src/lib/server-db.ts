import { createHmac } from "node:crypto";

/**
 * Server-only access to Supabase through secret-checked SECURITY DEFINER functions.
 * Uses the publishable key plus INDEXER_SECRET, so no service role key is needed on the web deployment.
 */
export function dbConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.INDEXER_SECRET);
}

export async function dbRpc<T = unknown>(name: string, args: Record<string, unknown>, withSecret = true): Promise<T> {
  const url = process.env.SUPABASE_URL!.replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const body = withSecret ? { p_secret: process.env.INDEXER_SECRET, ...args } : args;
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${name}: ${r.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

export interface Webhook {
  id: number;
  owner: string;
  url: string;
  events: string[];
  low_balance_threshold: string | number;
  secret: string;
}

export function signWebhook(secret: string, body: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

/** Delivers an event to one webhook at most once per event key. Returns true if this call delivered it. */
export async function deliverOnce(h: Webhook, eventKey: string, payload: object): Promise<boolean> {
  const claimed = await dbRpc<boolean>("un_delivery_claim", { p_webhook_id: h.id, p_event_key: eventKey });
  if (!claimed) return false;
  const body = JSON.stringify(payload);
  const res = await fetch(h.url, {
    method: "POST",
    headers: { "content-type": "application/json", "Unslept-Signature": signWebhook(h.secret, body), "Unslept-Event": eventKey.split(":")[0] },
    body,
    signal: AbortSignal.timeout(8000),
  }).catch(() => undefined);
  await dbRpc("un_delivery_result", { p_webhook_id: h.id, p_event_key: eventKey, p_status: res?.status ?? 0 }).catch(() => undefined);
  return Boolean(res?.ok);
}
