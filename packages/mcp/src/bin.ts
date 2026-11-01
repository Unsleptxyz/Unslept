#!/usr/bin/env node
/**
 * @unslept/mcp entry point.
 * Env: UNSLEPT_AGENT_ACCOUNT, UNSLEPT_SIGNER_KEY, UNSLEPT_NETWORK (robinhood-chain),
 * plus the chain settings the SDK reads: UNSLEPT_CHAIN_ID, UNSLEPT_RPC_URL, UNSLEPT_USDG, UNSLEPT_ROUTER, UNSLEPT_BUFFERS.
 */
import { Unslept } from "@unslept/sdk";
import { privateKeyToAccount } from "viem/accounts";
import { serveStdio } from "./server.js";

function need(k: string): string {
  const v = process.env[k]?.trim();
  if (!v) {
    process.stderr.write(`unslept-mcp: ${k} is not set. See the MCP section of the Unslept docs.\n`);
    process.exit(1);
  }
  return v;
}

const signer = privateKeyToAccount(need("UNSLEPT_SIGNER_KEY") as `0x${string}`);
const sdk = new Unslept({
  agentAccount: need("UNSLEPT_AGENT_ACCOUNT"),
  signer,
  network: process.env.UNSLEPT_NETWORK ?? "robinhood-chain",
});
serveStdio(sdk);
