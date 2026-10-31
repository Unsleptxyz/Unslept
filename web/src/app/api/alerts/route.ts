import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, http, verifyMessage } from "viem";
import { dbConfigured, dbRpc, deliverOnce, type Webhook } from "@/lib/server-db";
import { abis, chain } from "@/lib/web3";

/**
 * Policy-violation reports from the SDK (option `reportUrl`). The agent signer signs the report, the server
 * checks that the signer is the account's current agent signer, then forwards it to the owner's webhooks.
 */
const CODES = new Set(["PER_CALL_CAP", "DAILY_CAP", "PAYEE_NOT_ALLOWED", "AGENT_PAUSED", "AGENT_REVOKED", "MAX_AMOUNT"]);

export async function POST(req: NextRequest) {
  if (!chain) return NextResponse.json({ error: "The protocol is not configured on this deployment." }, { status: 503 });
  if (!dbConfigured()) return NextResponse.json({ error: "Alert storage is not configured." }, { status: 503 });

  let r: { account?: string; code?: string; message?: string; endpoint?: string; at?: string; signature?: string };
  try {
    r = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }
  if (!r.account || !/^0x[0-9a-fA-F]{40}$/.test(r.account) || !r.code || !CODES.has(r.code) || !r.message || !r.at || !r.signature) {
    return NextResponse.json({ error: "account, code, message, at and signature are required." }, { status: 400 });
  }
  const at = Date.parse(r.at);
  if (!Number.isFinite(at) || Math.abs(Date.now() - at) > 5 * 60 * 1000) return NextResponse.json({ error: "Report is too old." }, { status: 400 });

  const client = createPublicClient({ chain, transport: http() });
  const account = r.account as `0x${string}`;
  const [signer, owner] = (await Promise.all([
    client.readContract({ address: account, abi: abis.agentAccount, functionName: "agentSigner" }),
    client.readContract({ address: account, abi: abis.agentAccount, functionName: "owner" }),
  ]).catch(() => [undefined, undefined])) as [`0x${string}` | undefined, `0x${string}` | undefined];
  if (!signer || !owner) return NextResponse.json({ error: "Not an Unslept agent account." }, { status: 400 });

  const text = `Unslept policy violation\nAccount: ${account}\nCode: ${r.code}\nEndpoint: ${r.endpoint ?? ""}\nAt: ${r.at}\n${r.message}`;
  const ok = await verifyMessage({ address: signer, message: text, signature: r.signature as `0x${string}` }).catch(() => false);
  if (!ok) return NextResponse.json({ error: "Signature is not from the agent's signer." }, { status: 401 });

  const hooks = await dbRpc<Webhook[]>("un_webhooks_for", { p_event: "policy_violation", p_owner: owner });
  const payload = { type: "policy_violation", account, owner, code: r.code, endpoint: r.endpoint ?? null, message: r.message, at: r.at };
  let delivered = 0;
  for (const h of hooks) {
    if (await deliverOnce(h, `policy_violation:${account.toLowerCase()}:${r.code}:${r.at}`, payload)) delivered++;
  }
  return NextResponse.json({ delivered });
}
