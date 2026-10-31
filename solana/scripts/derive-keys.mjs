// Derives the Solana keypairs Unslept uses from the existing DEPLOYER_PRIVATE_KEY secret, so no new secrets are
// needed. Each key is ed25519 from sha256("<label>:" + secret). Writes keypair files to the given directory and
// prints only public keys.
import { createHash } from "node:crypto";
import fs from "node:fs";
import { Keypair } from "@solana/web3.js";

const secret = process.env.DEPLOYER_PRIVATE_KEY;
if (!secret) throw new Error("DEPLOYER_PRIVATE_KEY is not set");
const dir = process.argv[2] || ".keys";
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const out = {};
for (const label of ["program", "deployer", "keeper", "treasury"]) {
  const seed = createHash("sha256").update(`unslept-solana-${label}:${secret.trim()}`).digest();
  const kp = Keypair.fromSeed(seed);
  fs.writeFileSync(`${dir}/${label}.json`, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  out[label] = kp.publicKey.toBase58();
}
console.log(JSON.stringify(out));
