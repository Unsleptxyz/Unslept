// Fetches the mainnet accounts the Kamino fork test needs and writes them as solana-test-validator --account files.
// The USDC mint is copied with its mint authority replaced by the local test wallet, so the test can mint USDC.
import fs from "node:fs";
import os from "node:os";
import { Keypair, PublicKey } from "@solana/web3.js";

const RPC = process.env.MAINNET_RPC || "https://api.mainnet-beta.solana.com";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MARKET = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
const RESERVE = "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59";
const KLEND = "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

async function rpc(method, params) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    if (r.ok) { const j = await r.json(); if (!j.error) return j.result; console.error(j.error); }
    await new Promise((s) => setTimeout(s, 1500 * (i + 1)));
  }
  throw new Error(`rpc ${method} failed`);
}
async function get(addr) {
  const r = await rpc("getAccountInfo", [addr, { encoding: "base64" }]);
  if (!r.value) throw new Error(`missing account ${addr}`);
  return r.value;
}
function save(addr, v, data) {
  const buf = data ?? Buffer.from(v.data[0], "base64");
  fs.writeFileSync(`.fork/${addr}.json`, JSON.stringify({
    pubkey: addr,
    account: { lamports: v.lamports, data: [buf.toString("base64"), "base64"], owner: v.owner, executable: false, rentEpoch: 0, space: buf.length },
  }));
}

fs.mkdirSync(".fork", { recursive: true });
const wallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(`${os.homedir()}/.config/solana/id.json`, "utf8"))));

const reserve = await get(RESERVE);
if (reserve.owner !== KLEND) throw new Error(`reserve owner ${reserve.owner}`);
const rd = Buffer.from(reserve.data[0], "base64");
const pk = (o) => new PublicKey(rd.subarray(o, o + 32)).toBase58();
const market = pk(32), liqMint = pk(128), supply = pk(160), ctokenMint = pk(2560);
if (market !== MARKET || liqMint !== USDC) throw new Error(`unexpected reserve layout: market ${market} mint ${liqMint}`);
const ct = await get(ctokenMint);
if (ct.owner !== TOKEN) throw new Error(`collateral mint ${ctokenMint} owner ${ct.owner}`);
save(RESERVE, reserve);
save(MARKET, await get(MARKET));
save(supply, await get(supply));
save(ctokenMint, ct);

const usdc = await get(USDC);
const ud = Buffer.from(usdc.data[0], "base64");
ud.writeUInt32LE(1, 0);
wallet.publicKey.toBuffer().copy(ud, 4);
save(USDC, usdc, ud);

const slot = await rpc("getSlot", []);
fs.writeFileSync(".fork/env", `SLOT=${slot}\nCTOKEN_MINT=${ctokenMint}\nSUPPLY=${supply}\n`);
console.log(JSON.stringify({ slot, market, reserve: RESERVE, supply, ctokenMint }));
