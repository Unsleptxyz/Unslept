import { NextResponse, type NextRequest } from "next/server";
import { checkEligibility } from "@/lib/compliance";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: "address must be 0x followed by 40 hexadecimal characters." }, { status: 400 });
  }
  // Vercel sets x-vercel-ip-country; other hosts can forward an equivalent header.
  const country = req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? null;
  const result = await checkEligibility(address, country);
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
