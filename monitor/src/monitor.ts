/**
 * Unslept monitor. Dependency-free; run it on a schedule (cron, GitHub Actions, a container).
 *
 *  1. Protocol health → OPS_WEBHOOK_URL (Slack-compatible {"text": ...}):
 *     buffer or router paused, utilization above OPS_UTILIZATION_ALERT_BPS, free liquidity below
 *     OPS_MIN_AVAILABLE_USDG, stale adapter price, timelock operations scheduled, debts written off.
 *  2. User alerts → webhooks registered in the app (Supabase un_webhooks):
 *     low balance per agent account, deduplicated once per account per UTC day.
 *
 * Every address and threshold comes from the environment.
 */
import { createHmac } from "node:crypto";

export const SEL = {
  utilizationBps: "0x975e900e",
  paused: "0x5c975abb",
  available: "0x48a0d754",
  liquid: "0xa68fee87",
  parkedValue: "0x28a1e2ae",
  totalDebt: "0xfc7b9c18",
  lastPriceUpdate: "0x6949faeb",
  accountsOf: "0x0b2f2618",
} as const;

export const TOPIC = {
  AccountCreated: "0xcf30bb20d042201481624c64fc3e158ea88d912dce43b51495a5efe903cb80de",
  CallScheduled: "0x4cf4410cc57040e44862ef0f45f3dd5a5e02db8eb8add648d4b0e236f1d07dca",
  WrittenOff: "0xa1a9c0aeb482d653fed55ff77cf90045f44b27878317dc346f5741008fcb856f",
} as const;

export interface MonitorConfig {
  rpcUrl: string;
  buffer: string;
  router: string;
  factory: string;
  timelock?: string;
  adapters: { address: string; maxStaleness: number }[];
  utilizationAlertBps: bigint;
  minAvailable: bigint;
  lookbackBlocks: bigint;
  opsWebhook?: string;
  supabase?: { url: string; key: string };
}

export interface Alert {
  key: string;
  severity: "info" | "warning" | "critical";
  text: string;
}

let rpcId = 0;
export async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const j = (await r.json()) as { result?: T; error?: { message: string } };
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result as T;
}

const pad = (a: string) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");

export async function call(url: string, to: string, data: string): Promise<string> {
  return rpc<string>(url, "eth_call", [{ to, data }, "latest"]);
}

export const uint = (hex: string) => BigInt(hex === "0x" ? 0 : hex);
export const bool = (hex: string) => uint(hex) !== 0n;

export function decodeAddressArray(hex: string): string[] {
  const d = hex.slice(2);
  const offset = Number(BigInt(`0x${d.slice(0, 64)}`)) * 2;
  const len = Number(BigInt(`0x${d.slice(offset, offset + 64)}`));
  const out: string[] = [];
  for (let i = 0; i < len; i++) out.push(`0x${d.slice(offset + 64 + i * 64 + 24, offset + 128 + i * 64)}`);
  return out;
}

const usdg = (v: bigint) => `${(Number(v) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })} USDG`;

/* ------------------------------------------------------------------ */
/* Protocol health                                                     */
/* ------------------------------------------------------------------ */

export async function protocolChecks(cfg: MonitorConfig): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const [bufPaused, routerPaused, util, avail, head] = await Promise.all([
    call(cfg.rpcUrl, cfg.buffer, SEL.paused).then(bool),
    call(cfg.rpcUrl, cfg.router, SEL.paused).then(bool),
    call(cfg.rpcUrl, cfg.buffer, SEL.utilizationBps).then(uint),
    call(cfg.rpcUrl, cfg.buffer, SEL.available).then(uint),
    rpc<string>(cfg.rpcUrl, "eth_blockNumber", []).then(uint),
  ]);
  const day = new Date().toISOString().slice(0, 10);
  if (bufPaused) alerts.push({ key: `buffer-paused:${day}`, severity: "critical", text: "Buffer is paused. Deposits, withdrawals and settlements are stopped." });
  if (routerPaused) alerts.push({ key: `router-paused:${day}`, severity: "critical", text: "Settlement router is paused. Agents cannot pay x402 requests." });
  if (util > cfg.utilizationAlertBps) {
    alerts.push({
      key: `utilization:${day}:${util / 500n}`,
      severity: "warning",
      text: `Buffer utilization is ${(Number(util) / 100).toFixed(2)}%, above the ${(Number(cfg.utilizationAlertBps) / 100).toFixed(2)}% alert level. Run settleDebt for indebted accounts and check the withdrawal queue.`,
    });
  }
  if (avail < cfg.minAvailable) {
    alerts.push({
      key: `available:${day}`,
      severity: "warning",
      text: `Buffer free liquidity is ${usdg(avail)}, below ${usdg(cfg.minAvailable)}. Payments larger than this will fail. Refill from parked positions.`,
    });
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  for (const a of cfg.adapters) {
    try {
      const t = uint(await call(cfg.rpcUrl, a.address, SEL.lastPriceUpdate));
      if (now - t > BigInt(a.maxStaleness)) {
        alerts.push({
          key: `stale:${a.address}:${day}`,
          severity: "critical",
          text: `Adapter ${a.address} price is ${now - t}s old (limit ${a.maxStaleness}s). Valuations revert until the feed updates; deposits and allocation are blocked.`,
        });
      }
    } catch (e) {
      alerts.push({ key: `adapter-error:${a.address}:${day}`, severity: "critical", text: `Adapter ${a.address} price read failed: ${(e as Error).message}` });
    }
  }
  const from = head > cfg.lookbackBlocks ? head - cfg.lookbackBlocks : 0n;
  const logs = async (address: string, topic: string) =>
    rpc<{ transactionHash: string; topics: string[]; data: string }[]>(cfg.rpcUrl, "eth_getLogs", [
      { address, topics: [topic], fromBlock: `0x${from.toString(16)}`, toBlock: "latest" },
    ]);
  if (cfg.timelock) {
    for (const l of await logs(cfg.timelock, TOPIC.CallScheduled)) {
      const target = `0x${l.data.slice(2 + 24, 2 + 64)}`;
      alerts.push({
        key: `scheduled:${l.topics[1]}:${l.topics[2]}`,
        severity: "info",
        text: `Timelock operation scheduled for ${target} (operation ${l.topics[1]}, tx ${l.transactionHash}). Review it before the delay ends.`,
      });
    }
  }
  for (const l of await logs(cfg.buffer, TOPIC.WrittenOff)) {
    alerts.push({ key: `writeoff:${l.transactionHash}`, severity: "critical", text: `Buffer debt written off for ${`0x${l.topics[1].slice(26)}`} (tx ${l.transactionHash}).` });
  }
  return alerts;
}

/* ------------------------------------------------------------------ */
/* User webhooks                                                       */
/* ------------------------------------------------------------------ */

interface Webhook {
  id: number;
  owner: string;
  url: string;
  events: string[];
  low_balance_threshold: string;
  secret: string;
}

async function sb<T>(cfg: MonitorConfig, path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: T }> {
  const r = await fetch(`${cfg.supabase!.url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: cfg.supabase!.key, Authorization: `Bearer ${cfg.supabase!.key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, body: (text ? JSON.parse(text) : null) as T };
}

export function sign(secret: string, body: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

export async function netBalance(cfg: MonitorConfig, account: string): Promise<bigint | undefined> {
  try {
    const [l, p, d] = await Promise.all([
      call(cfg.rpcUrl, account, SEL.liquid).then(uint),
      call(cfg.rpcUrl, account, SEL.parkedValue).then(uint),
      call(cfg.rpcUrl, account, SEL.totalDebt).then(uint),
    ]);
    return l + p - d;
  } catch {
    return undefined; // stale price or RPC error: skip this round
  }
}

export async function userAlerts(cfg: MonitorConfig, deliver = deliverOnce): Promise<number> {
  if (!cfg.supabase) return 0;
  const hooks = await sb<Webhook[]>(cfg, "un_webhooks?select=*&events=cs.{low_balance}");
  if (!hooks.ok) throw new Error(`Supabase answered ${hooks.status} for un_webhooks`);
  const day = new Date().toISOString().slice(0, 10);
  let sent = 0;
  for (const h of hooks.body) {
    const accounts = decodeAddressArray(await call(cfg.rpcUrl, cfg.factory, SEL.accountsOf + pad(h.owner)));
    for (const a of accounts) {
      const net = await netBalance(cfg, a);
      if (net === undefined || net >= BigInt(h.low_balance_threshold)) continue;
      const payload = {
        type: "low_balance",
        account: a,
        owner: h.owner,
        netBalance: net.toString(),
        threshold: h.low_balance_threshold,
        message: `Account ${a} holds ${usdg(net)} net, below your ${usdg(BigInt(h.low_balance_threshold))} threshold. Fund it to keep payments flowing.`,
        at: new Date().toISOString(),
      };
      if (await deliver(cfg, h, `low_balance:${a.toLowerCase()}:${day}`, payload)) sent++;
    }
  }
  return sent;
}

/** Delivers once per event key. Returns true if this call delivered it. */
export async function deliverOnce(cfg: MonitorConfig, h: Webhook, eventKey: string, payload: object): Promise<boolean> {
  const claim = await sb(cfg, "un_webhook_deliveries", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ webhook_id: h.id, event_key: eventKey, attempts: 1 }),
  });
  if (!claim.ok) return false; // 409: already delivered (or being delivered)
  const body = JSON.stringify(payload);
  let status = 0;
  try {
    const r = await fetch(h.url, {
      method: "POST",
      headers: { "content-type": "application/json", "Unslept-Signature": sign(h.secret, body), "Unslept-Event": eventKey.split(":")[0] },
      body,
      signal: AbortSignal.timeout(8000),
    });
    status = r.status;
  } catch {
    status = 0;
  }
  await sb(cfg, `un_webhook_deliveries?webhook_id=eq.${h.id}&event_key=eq.${encodeURIComponent(eventKey)}`, {
    method: "PATCH",
    body: JSON.stringify({ status, delivered_at: status >= 200 && status < 300 ? new Date().toISOString() : null }),
  });
  return status >= 200 && status < 300;
}

/** Sends alerts not sent before. With Supabase configured, dedupes across runs through un_ops_alerts. */
export async function sendOps(cfg: MonitorConfig, alerts: Alert[], seen: Set<string>) {
  let fresh = alerts.filter((a) => !seen.has(a.key));
  if (cfg.supabase && fresh.length) {
    const claimed: Alert[] = [];
    for (const a of fresh) {
      const r = await sb(cfg, "un_ops_alerts", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ key: a.key, severity: a.severity, text: a.text }) });
      if (r.ok) claimed.push(a);
    }
    fresh = claimed;
  }
  if (!cfg.opsWebhook || fresh.length === 0) return fresh;
  const text = fresh.map((a) => `[${a.severity}] ${a.text}`).join("\n");
  await fetch(cfg.opsWebhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
  return fresh;
}

export function configFromEnv(env = process.env): MonitorConfig {
  const need = (k: string) => {
    const v = env[k]?.trim();
    if (!v) throw new Error(`${k} is required for the monitor.`);
    return v;
  };
  const staleness = Number(env.ORACLE_MAX_STALENESS_SECONDS ?? 0);
  return {
    rpcUrl: need("MONITOR_RPC_URL"),
    buffer: need("NEXT_PUBLIC_BUFFER_ADDRESS"),
    router: need("NEXT_PUBLIC_SETTLEMENT_ROUTER_ADDRESS"),
    factory: need("NEXT_PUBLIC_AGENT_ACCOUNT_FACTORY_ADDRESS"),
    timelock: env.TIMELOCK_ADDRESS?.trim() || undefined,
    adapters: (env.MONITOR_ADAPTERS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((address) => ({ address, maxStaleness: staleness })),
    utilizationAlertBps: BigInt(env.OPS_UTILIZATION_ALERT_BPS ?? need("WITHDRAW_QUEUE_THRESHOLD_BPS")),
    minAvailable: BigInt(env.OPS_MIN_AVAILABLE_USDG ?? "0"),
    lookbackBlocks: BigInt(env.MONITOR_LOOKBACK_BLOCKS ?? "5000"),
    opsWebhook: env.OPS_WEBHOOK_URL?.trim() || undefined,
    supabase: env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY } : undefined,
  };
}

// Run: node --import tsx monitor/src/monitor.ts   (one pass, for cron)
if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = configFromEnv();
  const alerts = await protocolChecks(cfg);
  const fresh = await sendOps(cfg, alerts, new Set());
  const sent = await userAlerts(cfg);
  console.log(JSON.stringify({ protocolAlerts: fresh.length, userAlertsSent: sent }));
}
