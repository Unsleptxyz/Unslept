import { NextResponse } from "next/server";
import { getNetworkStats } from "@/lib/stats";

export const revalidate = 30;

export async function GET() {
  const s = await getNetworkStats();
  return NextResponse.json(s);
}
