import { createPaywall } from "@unslept/pay";

const paywall = createPaywall({
  payTo: process.env.PAY_TO!,
  price: 10_000n, // 0.01 USDC
  secret: process.env.PAYWALL_SECRET!,
  description: "Example quote endpoint",
  rpcUrl: process.env.SOLANA_RPC_URL,
});

export const GET = paywall.protect(async (_request, payment) => {
  return Response.json({ symbol: "EXAMPLE", price: 101.25, at: new Date().toISOString(), paidBy: payment.payer });
});
