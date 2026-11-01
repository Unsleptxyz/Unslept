import { Unslept, UnsleptError } from "@unslept/sdk";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Discovers paid endpoints in the x402 Directory and calls them, paying per request from the agent account.
 * Stops at BUDGET (atomic USDG) and never pays more than the listed price for a single call.
 */
const DIRECTORY = "https://www.unslept.xyz/api/directory";
const budget = BigInt(process.env.BUDGET || "50000");
const category = process.env.CATEGORY?.trim();

const unslept = new Unslept({
  agentAccount: process.env.UNSLEPT_AGENT_ACCOUNT,
  signer: privateKeyToAccount(process.env.UNSLEPT_SIGNER_KEY as `0x${string}`),
  network: "robinhood-chain",
});

type Entry = { name: string; url: string; price: string; category: string; online: boolean };
const { entries } = (await (await fetch(DIRECTORY)).json()) as { entries: Entry[] };
const targets = entries.filter((e) => e.online && (!category || e.category === category));
console.log(`Directory: ${entries.length} endpoints, ${targets.length} selected. Budget ${Number(budget) / 1e6} USDG.`);

let spent = 0n;
for (const e of targets) {
  const price = BigInt(e.price);
  if (spent + price > budget) {
    console.log(`Budget reached, skipping ${e.name}.`);
    continue;
  }
  try {
    const res = await unslept.fetch(e.url, {}, { maxAmount: price });
    spent += price;
    const body = await res.text();
    console.log(`\n${e.name} (${Number(price) / 1e6} USDG) -> ${res.status}\n${body.slice(0, 400)}`);
  } catch (err) {
    console.log(`\n${e.name} failed: ${err instanceof UnsleptError ? `${err.code}: ${err.message}` : String(err)}`);
  }
}

const b = await unslept.getBalances();
console.log(`\nSpent ${Number(spent) / 1e6} USDG. Balances:`, b);
