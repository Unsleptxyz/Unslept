import type { ReactNode } from "react";

const published: [string, string | undefined][] = [
  ["UnsleptBuffer", process.env.NEXT_PUBLIC_BUFFER_ADDRESS],
  ["Staker buffer tier", process.env.NEXT_PUBLIC_STAKER_BUFFER_ADDRESS],
  ["AgentAccountFactory", process.env.NEXT_PUBLIC_AGENT_ACCOUNT_FACTORY_ADDRESS],
  ["SettlementRouter", process.env.NEXT_PUBLIC_SETTLEMENT_ROUTER_ADDRESS],
  ["Allocator", process.env.NEXT_PUBLIC_ALLOCATOR_ADDRESS],
  ["FeeModule", process.env.NEXT_PUBLIC_FEE_MODULE_ADDRESS],
  ["TimelockController", process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS],
];

function ContractsList() {
  const explorer = process.env.NEXT_PUBLIC_EXPLORER_URL?.replace(/\/$/, "");
  return (
    <>
      <p>
        Solidity, Foundry and OpenZeppelin. Addresses are published here and on official channels only. A TimelockController,
        controlled by the admin wallet, administers every contract with a 24-hour delay; the admin can pause without waiting. The admin moves to a multisig before the deposit caps are raised.
      </p>
      <ul>
        {published.map(([name, addr]) => (
          <li key={name}>
            {name}:{" "}
            {addr ? (
              explorer ? (
                <a className="text-link" href={`${explorer}/address/${addr}`} rel="noopener noreferrer" target="_blank">
                  <code>{addr}</code>
                </a>
              ) : (
                <code>{addr}</code>
              )
            ) : (
              "not deployed"
            )}
          </li>
        ))}
      </ul>
      <div className="notice" role="note">
        <p>
          {process.env.NEXT_PUBLIC_AUDIT_REPORT_URL ? (
            <>
              Audit report: <a className="text-link" href={process.env.NEXT_PUBLIC_AUDIT_REPORT_URL}>read it here</a>.
            </>
          ) : (
            "Not audited yet. Until an audit is published, deposits are limited by guarded caps."
          )}
        </p>
      </div>
    </>
  );
}

export interface DocPage {
  slug: string; // "" for the overview
  title: string;
  description: string;
  body: ReactNode;
}

const Draft = ({ children }: { children: ReactNode }) => (
  <div className="notice" role="note">
    <p>{children}</p>
  </div>
);

export const docs: DocPage[] = [
  {
    slug: "",
    title: "Overview",
    description: "What Unslept does and how the pieces fit.",
    body: (
      <>
        <p>
          Unslept is a yield-bearing payment layer for AI agents on Robinhood Chain. Idle agent balances are parked in
          tokenized assets. When an agent hits an x402 paywall, a shared buffer pays immediately, and the agent&apos;s
          position refills the buffer in the background.
        </p>
        <h2>Components</h2>
        <ul>
          <li>
            <strong>UnsleptBuffer</strong>: an ERC-4626 USDG vault that holds instant-settlement liquidity.
          </li>
          <li>
            <strong>AgentAccount</strong>: an ERC-4337 smart account per agent that enforces spending policies.
          </li>
          <li>
            <strong>Allocator</strong> and <strong>asset adapters</strong>: move idle balances into tokenized assets
            and back.
          </li>
          <li>
            <strong>SettlementRouter</strong>: pays x402 merchants from the buffer and records the debit.
          </li>
          <li>
            <strong>SDKs and MCP server</strong>: wrap your agent&apos;s HTTP calls.
          </li>
        </ul>
        <Draft>Docs skeleton. Sections fill in as each build phase ships.</Draft>
      </>
    ),
  },
  {
    slug: "quickstart",
    title: "Quickstart",
    description: "Connect an agent and make its first paid request.",
    body: (
      <>
        <ol>
          <li>Connect a wallet on Robinhood Chain and create an agent account on the Agents page of the app.</li>
          <li>Set a per-call cap and a daily cap, and allowlist the payee addresses or domains the agent may pay.</li>
          <li>Fund the agent account with USDG. Idle balance is parked in tokenized assets where you are eligible.</li>
          <li>Install the SDK, set the environment from the Developers page, and wrap your fetch call.</li>
        </ol>
        <p>
          Guides: <a className="text-link" href="/docs/quickstart-typescript">custom TypeScript agent</a>,{" "}
          <a className="text-link" href="/docs/quickstart-langchain">LangChain</a>,{" "}
          <a className="text-link" href="/docs/quickstart-crewai">CrewAI</a>.
        </p>
      </>
    ),
  },
  {
    slug: "quickstart-typescript",
    title: "Quickstart: custom TypeScript agent",
    description: "Pay x402 endpoints from any Node agent.",
    body: (
      <>
        <pre>
          <code>npm install @unslept/sdk viem</code>
        </pre>
        <pre>
          <code>{`import { Unslept, UnsleptError } from "@unslept/sdk";
import { privateKeyToAccount } from "viem/accounts";

const unslept = new Unslept({
  agentAccount: process.env.UNSLEPT_AGENT_ACCOUNT,
  signer: privateKeyToAccount(process.env.UNSLEPT_SIGNER_KEY as \`0x\${string}\`),
  network: "robinhood-chain",
  reportUrl: "https://<your Unslept app URL>", // optional: policy violations reach your webhooks
});

try {
  const res = await unslept.fetch("https://api.example.com/data", undefined, { maxAmount: 500_000n }); // 0.50 USDG
  console.log(await res.json(), unslept.localPayments().at(-1));
} catch (e) {
  if (e instanceof UnsleptError && e.code === "PER_CALL_CAP") console.error(e.message);
  else throw e;
}`}</code>
        </pre>
        <p>
          The SDK reads <code>UNSLEPT_CHAIN_ID</code>, <code>UNSLEPT_RPC_URL</code>, <code>UNSLEPT_USDG</code>,{" "}
          <code>UNSLEPT_ROUTER</code> and <code>UNSLEPT_BUFFERS</code>. The Developers page in the app fills them in for you.
        </p>
      </>
    ),
  },
  {
    slug: "quickstart-langchain",
    title: "Quickstart: LangChain",
    description: "Give a LangChain agent a tool that pays x402 requests.",
    body: (
      <>
        <pre>
          <code>{`pip install 'unslept[web3,langchain]'`}</code>
        </pre>
        <pre>
          <code>{`import os
from eth_account import Account
from unslept import Unslept
from unslept.web3_chain import EthAccountSigner
from unslept.langchain_tool import unslept_tool

signer = EthAccountSigner(Account.from_key(os.environ["UNSLEPT_SIGNER_KEY"]))
unslept = Unslept(os.environ["UNSLEPT_AGENT_ACCOUNT"], signer=signer, network="robinhood-chain")
tools = [unslept_tool(unslept)]   # pass to your agent, e.g. create_react_agent(llm, tools)`}</code>
        </pre>
        <p>The tool is named <code>pay_x402_request</code> and accepts an optional <code>max_amount_usdg</code> per call.</p>
      </>
    ),
  },
  {
    slug: "quickstart-crewai",
    title: "Quickstart: CrewAI",
    description: "Wrap Unslept as a CrewAI tool.",
    body: (
      <>
        <pre>
          <code>{`pip install 'unslept[web3]' crewai`}</code>
        </pre>
        <pre>
          <code>{`import os
from crewai.tools import tool
from eth_account import Account
from unslept import Unslept
from unslept.web3_chain import EthAccountSigner
from unslept.langchain_tool import pay_x402_request

unslept = Unslept(os.environ["UNSLEPT_AGENT_ACCOUNT"],
                  signer=EthAccountSigner(Account.from_key(os.environ["UNSLEPT_SIGNER_KEY"])),
                  network="robinhood-chain")

@tool("pay_x402_request")
def pay(url: str, max_amount_usdg: str = "1") -> str:
    """Fetch a URL, paying an x402 paywall within the agent's spending policy."""
    return pay_x402_request(unslept, url, max_amount_usdg=max_amount_usdg)`}</code>
        </pre>
        <p>Add <code>pay</code> to an agent&apos;s <code>tools</code>. Every payment stays inside the on-chain policy, whatever the model asks for.</p>
      </>
    ),
  },
  {
    slug: "webhooks",
    title: "Webhooks",
    description: "Low-balance and policy-violation alerts.",
    body: (
      <>
        <p>
          Register an https endpoint on the Developers page. Each delivery is a JSON POST with an <code>Unslept-Event</code> header
          and an <code>Unslept-Signature</code> header of the form <code>t=&lt;unix&gt;,v1=&lt;hex&gt;</code>, where the hex is
          HMAC-SHA256 of <code>t + &quot;.&quot; + body</code> with your signing secret.
        </p>
        <pre>
          <code>{`import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(secret: string, header: string, body: string) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const want = createHmac("sha256", secret).update(\`\${t}.\${body}\`).digest("hex");
  return timingSafeEqual(Buffer.from(want), Buffer.from(v1));
}`}</code>
        </pre>
        <ul>
          <li><code>low_balance</code>: an account&apos;s net balance fell below your threshold. Sent at most once per account per UTC day.</li>
          <li><code>policy_violation</code>: the SDK refused a payment for a policy reason and reported it, signed by the agent key.</li>
        </ul>
      </>
    ),
  },
  {
    slug: "x402",
    title: "x402 payments",
    description: "How Unslept handles HTTP 402 Payment Required.",
    body: (
      <>
        <p>
          x402 is an open payment standard on top of HTTP 402. The Unslept client interceptor handles the flow for your
          agent:
        </p>
        <ol>
          <li>The request returns 402 with the server&apos;s payment requirements.</li>
          <li>The SDK checks the agent&apos;s spending policy: per-call cap, daily cap and payee allowlist.</li>
          <li>The SDK requests settlement through the SettlementRouter, which pays from the buffer.</li>
          <li>The SDK retries the original request with the payment proof header attached.</li>
        </ol>
        <p>
          Every payment is logged with endpoint, amount, payee, agent ID and transaction hash. The facilitator is
          configurable.
        </p>
        <h2>Headers</h2>
        <p>
          Unslept follows x402 version 2. The 402 answer carries <code>PAYMENT-REQUIRED</code>, the retry carries{" "}
          <code>PAYMENT-SIGNATURE</code>, and the paid answer carries <code>PAYMENT-RESPONSE</code>. Each value is base64-encoded
          JSON. Unslept supports the standard <code>exact</code> scheme (EIP-3009 through a facilitator) and its own{" "}
          <code>unslept-direct</code> scheme, where the endpoint checks the SettlementRouter <code>Settled</code> event itself.
        </p>
        <h2>Try it on mainnet</h2>
        <p>
          <code>GET /api/demo/x402</code> on this site is a live paid endpoint on Robinhood Chain. It asks for 0.01 USDG through{" "}
          <code>unslept-direct</code> and answers with a snapshot of protocol stats once the payment settles. Each payment ID
          expires after 10 minutes and works once.
        </p>
        <pre>
          <code>{`import { Unslept } from "@unslept/sdk";

const unslept = new Unslept({ /* account, signer, chain config */ });
const res = await unslept.fetch("https://<this-site>/api/demo/x402");
console.log(res.status, await res.json());`}</code>
        </pre>
        <p>Without a payment the endpoint answers 402, which you can inspect with any HTTP client:</p>
        <pre>
          <code>{`curl -si https://<this-site>/api/demo/x402 | grep -i payment-required`}</code>
        </pre>
        <p>The demo pays real USDG to the project wallet. Use a small daily cap on the agent you test with.</p>
      </>
    ),
  },
  {
    slug: "sdk",
    title: "SDK",
    description: "TypeScript and Python SDK reference.",
    body: (
      <>
        <pre>
          <code>{`import { Unslept } from "@unslept/sdk";

const unslept = new Unslept({
  agentAccount: process.env.UNSLEPT_AGENT_ACCOUNT,
  signer: agentSigner,
  network: "robinhood-chain",
});

const res = await unslept.fetch("https://api.example.com/data");`}</code>
        </pre>
        <h2>Methods</h2>
        <ul>
          <li>
            <code>fetch(input, init)</code>: drop-in replacement for fetch that pays x402 paywalls.
          </li>
          <li>
            <code>getBalances()</code>: working, buffered and total balance.
          </li>
          <li>
            <code>getPolicy()</code> and <code>setPolicy(policy)</code>: spending policy.
          </li>
          <li>
            <code>getPayments()</code>: payment log.
          </li>
          <li>
            <code>onLowBalance(callback)</code>: alert when the balance drops below a threshold.
          </li>
        </ul>
        <p>The Python SDK exposes the same surface plus a LangChain tool wrapper.</p>
      </>
    ),
  },
  {
    slug: "mcp",
    title: "MCP server",
    description: "Use Unslept from MCP-compatible clients.",
    body: (
      <>
        <p>
          <code>@unslept/mcp</code> exposes four tools: <code>pay_x402_request</code>, <code>get_balances</code>,{" "}
          <code>get_payment_history</code> and <code>get_policy</code>.
        </p>
        <pre>
          <code>{`{
  "mcpServers": {
    "unslept": {
      "command": "npx",
      "args": ["-y", "@unslept/mcp"],
      "env": {
        "UNSLEPT_AGENT_ACCOUNT": "<your agent account address>",
        "UNSLEPT_SIGNER_KEY": "<agent signer key, kept in your secret store>",
        "UNSLEPT_NETWORK": "robinhood-chain"
      }
    }
  }
}`}</code>
        </pre>
      </>
    ),
  },
  {
    slug: "contracts",
    title: "Contracts",
    description: "Protocol contracts and addresses.",
    body: <ContractsList />,
  },
];

export function findDoc(slug: string) {
  return docs.find((d) => d.slug === slug);
}
