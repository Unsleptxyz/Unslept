#!/usr/bin/env node
/**
 * @unslept/mcp entry point.
 * Env: UNSLEPT_AGENT (agent account address), UNSLEPT_SIGNER_KEY (agent signer secret key: base58, or a JSON byte
 * array as written by solana-keygen), UNSLEPT_NETWORK (solana | solana-devnet), UNSLEPT_RPC_URL (optional).
 */
import { Unslept, b58decode } from "@unslept/sdk";
import { Keypair } from "@solana/web3.js";
import { serveStdio } from "./server.js";

function need(k: string): string {
  const v = process.env[k]?.trim();
  if (!v) {
    process.stderr.write(`unslept-mcp: ${k} is not set. See the MCP section of the Unslept docs.\n`);
    process.exit(1);
  }
  return v;
}

const raw = need("UNSLEPT_SIGNER_KEY");
const signer = Keypair.fromSecretKey(raw.startsWith("[") ? Uint8Array.from(JSON.parse(raw)) : b58decode(raw));
const network = (process.env.UNSLEPT_NETWORK ?? "solana") as "solana" | "solana-devnet";
const sdk = new Unslept({ agent: need("UNSLEPT_AGENT"), signer, network, rpcUrl: process.env.UNSLEPT_RPC_URL });
serveStdio(sdk);
