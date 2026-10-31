import { NextResponse } from "next/server";
import { getFeed } from "@/lib/feed";

export const revalidate = 15;

export async function GET() {
  return NextResponse.json({ items: await getFeed(12) }, { headers: { "access-control-allow-origin": "*" } });
}
