import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { verifyMessage } from "viem";
import { dbConfigured, dbRpc } from "@/lib/server-db";

/**
 * Registers a webhook for low-balance and policy-violation alerts.
 * The owner proves control of the wallet by signing the exact registration message (EIP-191).
 * Stored through the secret-checked Supabase function un_webhook_upsert. /api/cron/alerts and /api/alerts deliver events.
 */
export async function POST(req: NextRequest) {
  let body: { owner?: string; message?: string; signature?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON with owner, message and signature." }, { status: 400 });
  }
  const { owner, message, signature } = body;
  if (!owner || !/^0x[0-9a-fA-F]{40}$/.test(owner) || !message || !signature) {
    return NextResponse.json({ error: "owner, message and signature are required." }, { status: 400 });
  }
  const ok = await verifyMessage({ address: owner as `0x${string}`, message, signature: signature as `0x${string}` }).catch(() => false);
  if (!ok) return NextResponse.json({ error: "The signature does not match the owner address. Sign again with the owner wallet." }, { status: 401 });

  const field = (k: string) => new RegExp(`^${k}: (.+)$`, "m").exec(message)?.[1]?.trim();
  if (field("Owner")?.toLowerCase() !== owner.toLowerCase()) return NextResponse.json({ error: "The message owner does not match." }, { status: 400 });
  const url = field("URL");
  const events = (field("Events") ?? "").split(",").filter((e) => e === "low_balance" || e === "policy_violation");
  const threshold = field("Low balance threshold");
  const issued = Date.parse(field("Issued") ?? "");
  if (!url || !/^https:\/\//.test(url)) return NextResponse.json({ error: "The webhook URL must use https." }, { status: 400 });
  if (events.length === 0) return NextResponse.json({ error: "Choose at least one event." }, { status: 400 });
  if (!threshold || !/^\d+$/.test(threshold)) return NextResponse.json({ error: "The threshold is not valid." }, { status: 400 });
  if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > 10 * 60 * 1000) {
    return NextResponse.json({ error: "The signed message is older than 10 minutes. Sign again." }, { status: 400 });
  }

  if (!dbConfigured()) {
    return NextResponse.json({ error: "Webhook storage is not configured on this deployment yet." }, { status: 503 });
  }
  const secret = `whsec_${randomBytes(24).toString("hex")}`;
  try {
    await dbRpc("un_webhook_upsert", { p_owner: owner, p_url: url, p_events: events, p_threshold: threshold, p_hook_secret: secret });
  } catch {
    return NextResponse.json({ error: "The webhook could not be saved. Try again in a few minutes." }, { status: 503 });
  }
  return NextResponse.json({ message: "Saved webhook.", secret });
}
