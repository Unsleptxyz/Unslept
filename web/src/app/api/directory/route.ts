import { NextResponse } from "next/server";
import { listDirectory } from "@/lib/directory";

export const revalidate = 60;

/** Public, machine-readable x402 Directory. Agents can discover paid endpoints from here. */
export async function GET() {
  const entries = (await listDirectory()).map((e) => ({
    name: e.name,
    url: e.url,
    description: e.description,
    category: e.category,
    provider: e.provider ?? null,
    scheme: e.scheme,
    network: e.network,
    asset: e.asset,
    payTo: e.pay_to,
    price: e.price,
    verified: e.verified,
    online: e.online,
  }));
  return NextResponse.json({ network: "eip155:4663", count: entries.length, entries }, { headers: { "access-control-allow-origin": "*" } });
}
