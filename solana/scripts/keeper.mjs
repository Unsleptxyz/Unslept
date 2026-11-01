// Unslept keeper on Solana. One pass:
//  1. For every agent with buffer debt: repay from its liquid USDC (permissionless), then redeem just enough of its
//     Kamino position to clear the rest (keeper role).
//  2. Close payment records older than 24 hours, returning their rent to whoever paid it.
// The keeper key is derived from DEPLOYER_PRIVATE_KEY (see derive-keys.mjs). Usage: RPC=<url> node scripts/keeper.mjs <keysDir>
import fs from "node:fs";
import {
  ComputeBudgetProgram, Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction,
} from "@solana/web3.js";

const dir = process.argv[2];
const conn = new Connection(process.env.RPC || "https://api.mainnet-beta.solana.com", "confirmed");
const keeper = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(`${dir}/keeper.json`, "utf8"))));
const PROGRAM = new PublicKey(process.env.PROGRAM_ID || "HbAgL4w8R9D8RUEuK4rJknK5Vn8rBusfRtfTnFcYieue");
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const KLEND = new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
const MARKET = new PublicKey("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF");
const SUPPLY = new PublicKey("Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6");
const SYSVAR_IX = new PublicKey("Sysvar1nstructions1111111111111111111111111");
const enc = (s) => Buffer.from(s);
const pda = (...s) => PublicKey.findProgramAddressSync(s, PROGRAM)[0];
const config = pda(enc("config"));
const bufferVault = pda(enc("buffer_vault"));
const LMA = PublicKey.findProgramAddressSync([enc("lma"), MARKET.toBuffer()], KLEND)[0];
const u64 = (v) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); return b; };
const ix = (disc, keys, ...args) => new TransactionInstruction({
  programId: PROGRAM, keys: keys.map(([pubkey, isSigner, isWritable]) => ({ pubkey, isSigner, isWritable })), data: Buffer.concat([Buffer.from(disc), ...args]),
});
const bal = async (a) => BigInt((await conn.getTokenAccountBalance(a, "confirmed").catch(() => ({ value: { amount: "0" } }))).value.amount);
const send = (ixs) => sendAndConfirmTransaction(conn, new Transaction().add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20_000 }), ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ...ixs), [keeper], { commitment: "confirmed" });

const cfgInfo = await conn.getAccountInfo(config);
if (!cfgInfo) { console.log("program not initialized; nothing to do"); process.exit(0); }
const cfg = cfgInfo.data;
const yieldReserve = new PublicKey(cfg.subarray(8 + 96 + 106 * 2 + 16 + 4, 8 + 96 + 106 * 2 + 16 + 36));
const ctokenMint = new PublicKey(cfg.subarray(8 + 96 + 106 * 2 + 16 + 36, 8 + 96 + 106 * 2 + 16 + 68));
console.log(`keeper ${keeper.publicKey.toBase58()} balance ${(await conn.getBalance(keeper.publicKey)) / 1e9} SOL`);

const agents = await conn.getProgramAccounts(PROGRAM, { filters: [{ memcmp: { offset: 0, bytes: "8yGSUtV5BEn" } }] });
let repaid = 0, redeemed = 0;
for (const { pubkey: agent, account } of agents) {
  const d = account.data;
  const debt = d.readBigUInt64LE(8 + 64 + 40 + 2);
  const position = d.readBigUInt64LE(8 + 64 + 40 + 2 + 8);
  if (debt === 0n) continue;
  const vault = pda(enc("agent_vault"), agent.toBuffer());
  const ctokenAcct = pda(enc("agent_ctoken"), agent.toBuffer());
  const liquid = await bal(vault);
  try {
    if (liquid > 0n) {
      await send([ix([79, 200, 30, 15, 252, 22, 162, 8], [[config, false, true], [agent, false, true], [vault, false, true], [bufferVault, false, true], [TOKEN, false, false]])]);
      repaid++;
    }
    const rest = debt > liquid ? debt - liquid : 0n;
    const ctokens = await bal(ctokenAcct);
    if (rest > 0n && ctokens > 0n && position > 0n && !yieldReserve.equals(PublicKey.default)) {
      // cUSDC is worth at least its cost basis, so this redeems enough (rounded up, plus 0.1%), never more than held.
      let amount = (rest * ctokens * 1001n) / (position * 1000n) + 1n;
      if (amount > ctokens) amount = ctokens;
      await send([ix([229, 64, 30, 80, 246, 159, 124, 214], [
        [keeper.publicKey, true, false], [config, false, true], [agent, false, true], [vault, false, true], [ctokenAcct, false, true],
        [bufferVault, false, true], [ctokenMint, false, true], [new PublicKey(cfg.subarray(72, 104)), false, false], [yieldReserve, false, true],
        [MARKET, false, false], [LMA, false, false], [SUPPLY, false, true], [SYSVAR_IX, false, false], [KLEND, false, false], [TOKEN, false, false],
      ], u64(amount))]);
      redeemed++;
    }
    console.log(`agent ${agent.toBase58()}: debt ${debt}, liquid ${liquid}, cUSDC ${ctokens}`);
  } catch (e) {
    console.log(`agent ${agent.toBase58()}: ${String(e?.message ?? e).slice(0, 300)}`);
  }
}

// Payment records older than 24 hours.
const now = Math.floor(Date.now() / 1000);
const records = await conn.getProgramAccounts(PROGRAM, { filters: [{ memcmp: { offset: 0, bytes: "f7wrcKwpwHd" } }], dataSlice: { offset: 0, length: 8 + 32 * 3 + 16 + 32 + 16 + 32 } });
let closed = 0;
for (const { pubkey, account } of records) {
  const d = account.data;
  const ts = Number(d.readBigInt64LE(8 + 32 * 3 + 16 + 32 + 8));
  if (now - ts < 86_400 + 60) continue;
  const rentPayer = new PublicKey(d.subarray(8 + 32 * 3 + 16 + 32 + 16, 8 + 32 * 3 + 16 + 32 + 48));
  try {
    await send([ix([172, 106, 77, 250, 247, 169, 156, 178], [[rentPayer, false, true], [pubkey, false, true]])]);
    closed++;
  } catch (e) {
    console.log(`close ${pubkey.toBase58()}: ${String(e?.message ?? e).slice(0, 200)}`);
  }
  if (closed >= 20) break;
}
console.log(JSON.stringify({ agents: agents.length, repaid, redeemed, recordsClosed: closed }));
