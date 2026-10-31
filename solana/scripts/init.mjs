// Initializes the Unslept program on a cluster (idempotent). Usage: RPC=<url> node scripts/init.mjs <keysDir> <devnet|mainnet>
import fs from "node:fs";
import * as anchor from "@anchor-lang/core";
import BN from "bn.js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";

const [dir, cluster] = process.argv.slice(2);
const conn = new Connection(process.env.RPC, "confirmed");
const load = (n) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(`${dir}/${n}.json`, "utf8"))));
const deployer = load("deployer"), keeper = load("keeper"), treasuryOwner = load("treasury"), programKp = load("program");
const USDC = new PublicKey(cluster === "mainnet" ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" : "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const RESERVE = new PublicKey("D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59");

const idl = JSON.parse(fs.readFileSync(fs.existsSync("target/idl/unslept.json") ? "target/idl/unslept.json" : "../ops/solana-idl.json", "utf8"));
idl.address = programKp.publicKey.toBase58();
const provider = new anchor.AnchorProvider(conn, new anchor.Wallet(deployer), { commitment: "confirmed" });
const program = new anchor.Program(idl, provider);
const pda = (...s) => PublicKey.findProgramAddressSync(s, program.programId)[0];
const config = pda(Buffer.from("config"));

const treasury = (await getOrCreateAssociatedTokenAccount(conn, deployer, USDC, treasuryOwner.publicKey)).address;
console.log("treasury token account", treasury.toBase58());

if (!(await conn.getAccountInfo(config))) {
  const sig = await program.methods
    .initialize({ feeBps: 10, depositCap: new BN(50_000_000_000), pauser: deployer.publicKey, keeper: keeper.publicKey, treasury })
    .accountsPartial({ admin: deployer.publicKey, usdcMint: USDC, config, bufferVault: pda(Buffer.from("buffer_vault")), shareMint: pda(Buffer.from("share_mint")) })
    .rpc();
  console.log("initialized", sig);
} else console.log("config exists");

let c = await program.account.config.fetch(config);
if (cluster === "mainnet" && c.yieldReserve.equals(PublicKey.default)) {
  const r = await conn.getAccountInfo(RESERVE);
  const ctokenMint = new PublicKey(r.data.subarray(2560, 2592));
  const sig = await program.methods.setYieldReserve(RESERVE, ctokenMint).accountsPartial({ admin: deployer.publicKey, config }).rpc();
  console.log("yield reserve set", ctokenMint.toBase58(), sig);
  c = await program.account.config.fetch(config);
}
console.log(JSON.stringify({
  program: program.programId.toBase58(), config: config.toBase58(), admin: c.admin.toBase58(), usdc: c.usdcMint.toBase58(),
  feeBps: c.params.feeBps, depositCap: c.params.depositCap.toString(), keeper: c.params.keeper.toBase58(),
  treasury: c.params.treasury.toBase58(), yieldReserve: c.yieldReserve.toBase58(), yieldCtokenMint: c.yieldCtokenMint.toBase58(),
  bufferVault: pda(Buffer.from("buffer_vault")).toBase58(), shareMint: pda(Buffer.from("share_mint")).toBase58(),
}, null, 2));
