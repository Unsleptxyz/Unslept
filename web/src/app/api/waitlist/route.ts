import { NextResponse, type NextRequest } from "next/server";
import { saveWaitlistEntry } from "@/lib/waitlist-store";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;
const WALLET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type Outcome = "joined" | "already" | "invalid-email" | "invalid-wallet" | "unavailable";

const messages: Record<Outcome, string> = {
  joined: "You are on the waitlist.",
  already: "This email is already on the waitlist.",
  "invalid-email": "The email address is not valid. Check it and submit again.",
  "invalid-wallet": "The wallet must be a Solana address (base58). Correct it or leave it empty.",
  unavailable: "The waitlist could not be saved right now. Try again in a few minutes.",
};

/**
 * Accepts a standard form post (works without JavaScript) or JSON.
 * Form posts redirect to /waitlist/<outcome>; JSON gets a JSON reply.
 */
export async function POST(req: NextRequest) {
  const isJson = req.headers.get("content-type")?.includes("application/json") ?? false;
  let email = "";
  let wallet = "";
  let trap = "";

  try {
    if (isJson) {
      const body = (await req.json()) as Record<string, unknown>;
      email = String(body.email ?? "");
      wallet = String(body.wallet ?? "");
      trap = String(body.company ?? "");
    } else {
      const form = await req.formData();
      email = String(form.get("email") ?? "");
      wallet = String(form.get("wallet") ?? "");
      trap = String(form.get("company") ?? "");
    }
  } catch {
    return reply(req, isJson, "invalid-email", 400);
  }

  email = email.trim().toLowerCase();
  wallet = wallet.trim();

  // Honeypot filled in: answer as if it worked, store nothing.
  if (trap) return reply(req, isJson, "joined", 200);
  if (!EMAIL.test(email) || email.length > 254) return reply(req, isJson, "invalid-email", 400);
  if (wallet && !WALLET.test(wallet)) return reply(req, isJson, "invalid-wallet", 400);

  let outcome: Outcome;
  try {
    outcome = await saveWaitlistEntry({ email, wallet: wallet || null });
  } catch (err) {
    console.error("waitlist: store error", err);
    outcome = "unavailable";
  }
  return reply(req, isJson, outcome, outcome === "unavailable" ? 503 : 200);
}

function reply(req: NextRequest, isJson: boolean, outcome: Outcome, status: number) {
  if (isJson) return NextResponse.json({ outcome, message: messages[outcome] }, { status });
  return NextResponse.redirect(new URL(`/waitlist/${outcome}`, req.url), 303);
}
