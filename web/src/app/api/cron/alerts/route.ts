import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";
import { dbConfigured, dbRpc, deliverOnce, type Webhook } from "@/lib/server-db";
import { addresses, chain } from "@/lib/web3";

/**
 * Low-balance alerts. For each webhook subscribed to low_balance, checks the owner's agent accounts and
 * delivers at most one alert per account per day when net balance (liquid + parked value - debt) is below
 * the threshold. Safe to trigger by anyone: delivery is idempotent per day. Triggered by .github/workflows/index.yml.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const factoryAbi = parseAbi(["function accountsOf(address owner) view returns (address[])"]);
const accountAbi = parseAbi([
  "function liquid() view returns (uint256)",
  "function parkedValue() view returns (uint256)",
  "function totalDebt() view returns (uint256)",
]);

const usdg = (v: bigint) => `${(Number(v) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })} USDG`;

export async function GET() {
  if (!chain || !dbConfigured() || !addresses.factory) {
    return NextResponse.json({ error: "Alerts are not configured." }, { status: 503 });
  }
  const client = createPublicClient({ chain, transport: http() });
  const hooks = await dbRpc<Webhook[]>("un_webhooks_for", { p_event: "low_balance" });
  const day = new Date().toISOString().slice(0, 10);
  let checked = 0;
  let sent = 0;
  for (const h of hooks) {
    const threshold = BigInt(String(h.low_balance_threshold).split(".")[0]);
    const accounts = await client
      .readContract({ address: addresses.factory, abi: factoryAbi, functionName: "accountsOf", args: [h.owner as `0x${string}`] })
      .catch(() => [] as readonly `0x${string}`[]);
    for (const a of accounts) {
      checked++;
      let net: bigint;
      try {
        const [l, p, d] = await Promise.all(
          (["liquid", "parkedValue", "totalDebt"] as const).map((fn) => client.readContract({ address: a, abi: accountAbi, functionName: fn })),
        );
        net = l + p - d;
      } catch {
        continue; // stale price or RPC error: skip this round
      }
      if (net >= threshold) continue;
      const payload = {
        type: "low_balance",
        account: a,
        owner: h.owner,
        netBalance: net.toString(),
        threshold: threshold.toString(),
        message: `Account ${a} holds ${usdg(net)} net, below your ${usdg(threshold)} threshold. Fund it to keep payments flowing.`,
        at: new Date().toISOString(),
      };
      if (await deliverOnce(h, `low_balance:${a.toLowerCase()}:${day}`, payload)) sent++;
    }
  }
  return NextResponse.json({ webhooks: hooks.length, accounts: checked, sent });
}
