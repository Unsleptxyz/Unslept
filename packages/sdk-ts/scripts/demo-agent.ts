import { Unslept } from "../src/index.ts";
import { privateKeyToAccount } from "viem/accounts";

/**
 * The official demo agent. Pays the listed endpoints in the x402 Directory (verified ones only), one call each,
 * so the live feed on the home page shows real settlements. Budget per run: DEMO_AGENT_BUDGET atomic USDG.
 */
const budget = BigInt(process.env.DEMO_AGENT_BUDGET || "20000");
const unslept = new Unslept({
  agentAccount: process.env.DEMO_AGENT_ACCOUNT,
  signer: privateKeyToAccount(process.env.DEMO_AGENT_SIGNER_KEY as `0x${string}`),
  network: "robinhood-chain",
});

const dir = (await (await fetch("https://www.unslept.xyz/api/directory")).json()) as {
  entries: { name: string; url: string; price: string; verified: boolean; online: boolean }[];
};
let spent = 0n;
for (const e of dir.entries.filter((x) => x.verified && x.online)) {
  const price = BigInt(e.price);
  if (spent + price > budget) break;
  try {
    const res = await unslept.fetch(e.url, {}, { maxAmount: price });
    spent += price;
    console.log(`${e.name}: HTTP ${res.status}`);
  } catch (err) {
    console.log(`${e.name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
console.log(`Spent ${Number(spent) / 1e6} USDG this run.`);
