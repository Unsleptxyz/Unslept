import { NextResponse, type NextRequest } from "next/server";
import { CATEGORIES, probeEndpoint } from "@/lib/directory";
import { dbConfigured, dbRpc } from "@/lib/server-db";

export const dynamic = "force-dynamic";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "");

/** Adds an endpoint to the x402 Directory after checking that it really asks for USDC on Solana. */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "The directory is not configured on this deployment." }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  if (clean(body.company, 10)) return NextResponse.json({ ok: true }); // honeypot field, filled only by bots

  const url = clean(body.url, 300);
  const name = clean(body.name, 80);
  if (!url || !name) return NextResponse.json({ error: "URL and name are required." }, { status: 400 });
  const category = CATEGORIES.some((c) => c.id === body.category) ? (body.category as string) : "other";
  const website = clean(body.website, 200);
  if (website && !/^https:\/\//.test(website)) return NextResponse.json({ error: "The website must start with https://." }, { status: 400 });

  const probe = await probeEndpoint(url);
  if (!probe.ok) return NextResponse.json({ error: probe.reason }, { status: 422 });

  const entry = await dbRpc<{ id: number }>("un_directory_upsert", {
    p_entry: {
      url: new URL(url).toString(),
      name,
      description: clean(body.description, 280) || clean(probe.description, 280),
      category,
      provider: clean(body.provider, 80) || null,
      website: website || null,
      scheme: probe.scheme,
      network: probe.network,
      asset: probe.asset,
      pay_to: probe.payTo,
      price: probe.price,
    },
  });
  return NextResponse.json({ ok: true, id: entry.id, price: probe.price, scheme: probe.scheme });
}
