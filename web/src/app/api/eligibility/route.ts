import { NextResponse, type NextRequest } from "next/server";
import { checkEligibility } from "@/lib/compliance";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") ?? "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return NextResponse.json({ error: "address must be a Solana wallet address (base58)." }, { status: 400 });
  }
  // Vercel sets x-vercel-ip-country; other hosts can forward an equivalent header.
  const country = req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? null;
  const result = await checkEligibility(address, country);
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
