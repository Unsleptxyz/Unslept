"use client";

import { useState } from "react";
import { CodeTabs } from "@/components/landing/CodeTabs";
import { cluster, rpcUrl } from "@/lib/solana";
import { useMyAgents } from "./hooks";
import { useSolanaWallet } from "./solana-wallet";

export function DevelopersPage() {
  const { address } = useSolanaWallet();
  return (
    <div className="app-page">
      <h1 className="display app-title">Developers</h1>
      {address ? <DevBody /> : <Snippets agent="<your agent account address>" />}
    </div>
  );
}

function DevBody() {
  const { agents } = useMyAgents();
  const [i, setI] = useState(0);
  const agent = agents[i]?.address.toBase58() ?? "<your agent account address>";
  return (
    <>
      {agents.length > 1 ? (
        <div className="field">
          <label htmlFor="dev-agent">Agent</label>
          <select id="dev-agent" value={i} onChange={(e) => setI(Number(e.target.value))}>
            {agents.map((a, k) => (
              <option key={a.address.toBase58()} value={k}>
                {a.address.toBase58()}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <Snippets agent={agent} />
    </>
  );
}

function Snippets({ agent }: { agent: string }) {
  const network = cluster === "devnet" ? "solana-devnet" : "solana";
  const env = [`UNSLEPT_AGENT=${agent}`, `UNSLEPT_SIGNER_KEY=<agent signer secret key, base58 or JSON array>`, `UNSLEPT_NETWORK=${network}`, `UNSLEPT_RPC_URL=${rpcUrl}`].join("\n");
  return (
    <section className="app-section">
      <h2>Install</h2>
      <CodeTabs
        tabs={[
          { label: "TypeScript", filename: "terminal", code: "npm install @unslept/sdk @solana/web3.js" },
          { label: "Python", filename: "terminal", code: "pip install 'unslept[solana]'" },
          { label: "Environment", filename: ".env", code: env },
          {
            label: "Usage",
            filename: "agent.ts",
            code: `import { Unslept } from "@unslept/sdk";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const unslept = new Unslept({
  agent: process.env.UNSLEPT_AGENT,
  signer: Keypair.fromSecretKey(bs58.decode(process.env.UNSLEPT_SIGNER_KEY!)),
  network: "${network}",
  rpcUrl: process.env.UNSLEPT_RPC_URL,
});

const res = await unslept.fetch("https://api.example.com/data");`,
          },
          {
            label: "MCP",
            filename: "mcp.json",
            code: JSON.stringify(
              {
                mcpServers: {
                  unslept: {
                    command: "npx",
                    args: ["-y", "@unslept/mcp"],
                    env: Object.fromEntries(env.split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])),
                  },
                },
              },
              null,
              2,
            ),
          },
        ]}
      />
      <p className="muted small">
        Keep the signer key in your secret store. It can only request payments inside the agent&apos;s policy, and it needs a little SOL for network
        fees and payment-record rent (returned after 24 hours).
      </p>
    </section>
  );
}
