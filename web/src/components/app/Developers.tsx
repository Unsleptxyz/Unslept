"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { CodeTabs } from "@/components/landing/CodeTabs";
import { parseUsdg } from "@/lib/format";
import { addresses, chain } from "@/lib/web3";
import { useMyAccounts } from "./hooks";
import { explainError } from "./Tx";

export function DevelopersPage() {
  const { isConnected } = useAccount();
  return (
    <div className="app-page">
      <h1 className="display app-title">Developers</h1>
      {isConnected ? <DevBody /> : <Snippets agent="<your agent account address>" />}
    </div>
  );
}

function DevBody() {
  const { accounts } = useMyAccounts();
  const agents = accounts.filter((a) => !a.isTreasury);
  const [i, setI] = useState(0);
  const agent = agents[i]?.address ?? "<your agent account address>";
  return (
    <>
      {agents.length > 1 ? (
        <div className="field">
          <label htmlFor="dev-agent">Agent</label>
          <select id="dev-agent" value={i} onChange={(e) => setI(Number(e.target.value))}>
            {agents.map((a, k) => (
              <option key={a.address} value={k}>
                {a.address}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <Snippets agent={agent} />
      <Webhooks />
    </>
  );
}

function Snippets({ agent }: { agent: string }) {
  const env = [
    `UNSLEPT_AGENT_ACCOUNT=${agent}`,
    `UNSLEPT_SIGNER_KEY=<agent signer key>`,
    `UNSLEPT_CHAIN_ID=${chain?.id ?? "<chain id>"}`,
    `UNSLEPT_RPC_URL=${chain?.rpcUrls.default.http[0] ?? "<rpc url>"}`,
    `UNSLEPT_USDG=${addresses.usdg ?? "<usdg>"}`,
    `UNSLEPT_ROUTER=${addresses.router ?? "<router>"}`,
    `UNSLEPT_BUFFERS=${[addresses.buffer, addresses.stakerBuffer].filter(Boolean).join(",")}`,
  ].join("\n");
  return (
    <section className="app-section">
      <h2>Install</h2>
      <CodeTabs
        tabs={[
          { label: "TypeScript", filename: "terminal", code: "npm install @unslept/sdk viem" },
          { label: "Python", filename: "terminal", code: "pip install 'unslept[web3]'" },
          { label: "Environment", filename: ".env", code: env },
          {
            label: "Usage",
            filename: "agent.ts",
            code: `import { Unslept } from "@unslept/sdk";
import { privateKeyToAccount } from "viem/accounts";

const unslept = new Unslept({
  agentAccount: process.env.UNSLEPT_AGENT_ACCOUNT,
  signer: privateKeyToAccount(process.env.UNSLEPT_SIGNER_KEY as \`0x\${string}\`),
  network: "robinhood-chain",
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
                    env: Object.fromEntries(env.split("\n").map((l) => l.split("=") as [string, string])),
                  },
                },
              },
              null,
              2,
            ),
          },
        ]}
      />
      <p className="muted small">Keep the signer key in your secret store. It can only request payments inside the agent&apos;s policy.</p>
    </section>
  );
}

function Webhooks() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [url, setUrl] = useState("");
  const [threshold, setThreshold] = useState("10");
  const [events, setEvents] = useState({ low_balance: true, policy_violation: true });
  const [state, setState] = useState<{ ok?: string; err?: string }>({});
  const t = parseUsdg(threshold);
  const valid = /^https:\/\/[^\s]+$/.test(url) && t !== undefined && (events.low_balance || events.policy_violation);

  async function save() {
    setState({});
    try {
      const issuedAt = new Date().toISOString();
      const message = `Unslept webhook\nOwner: ${address}\nURL: ${url}\nEvents: ${Object.entries(events)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(",")}\nLow balance threshold: ${t}\nIssued: ${issuedAt}`;
      const signature = await signMessageAsync({ message });
      const r = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner: address, message, signature }),
      });
      const j = (await r.json()) as { message?: string; error?: string; secret?: string };
      if (!r.ok) setState({ err: j.error ?? "The webhook was not saved." });
      else setState({ ok: `Saved webhook. Signing secret: ${j.secret}. Store it now; it is shown once.` });
    } catch (e) {
      setState({ err: explainError(e) });
    }
  }

  return (
    <section className="app-section app-panel" aria-labelledby="wh">
      <h2 id="wh">Webhooks</h2>
      <p className="muted">
        Get a POST when an agent&apos;s balance drops below a threshold or a payment is rejected by its policy. Each request is signed with
        HMAC-SHA256 in the <code>Unslept-Signature</code> header.
      </p>
      <div className="field">
        <label htmlFor="wh-url">Endpoint URL (https)</label>
        <input id="wh-url" value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://example.com/hooks/unslept" />
      </div>
      <fieldset className="checks">
        <legend>Events</legend>
        <label>
          <input type="checkbox" checked={events.low_balance} onChange={(e) => setEvents({ ...events, low_balance: e.target.checked })} /> Low balance
        </label>
        <label>
          <input type="checkbox" checked={events.policy_violation} onChange={(e) => setEvents({ ...events, policy_violation: e.target.checked })} /> Policy
          violation
        </label>
      </fieldset>
      <div className="field">
        <label htmlFor="wh-th">Low balance threshold (USDG)</label>
        <input id="wh-th" inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
      </div>
      <button type="button" className="btn btn--primary" disabled={!valid} onClick={save}>
        Sign and save webhook
      </button>
      {state.ok ? <p className="tx__done" role="status">{state.ok}</p> : null}
      {state.err ? <p className="app-error" role="alert">{state.err}</p> : null}
    </section>
  );
}
