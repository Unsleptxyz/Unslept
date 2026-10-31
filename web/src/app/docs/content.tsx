import type { ReactNode } from "react";
import { Callout, CodeBlock, ContactLine, DefTable, Step, Steps } from "@/components/content/Blocks";

export const docGroups = ["Get started", "Guides", "Protocol", "Reference"] as const;
export type DocGroup = (typeof docGroups)[number];

export interface DocPage {
  slug: string; // "" for the overview
  group: DocGroup;
  title: string;
  nav?: string;
  description: string;
  body: ReactNode;
}

const env = {
  explorer: process.env.NEXT_PUBLIC_EXPLORER_URL?.replace(/\/$/, ""),
  site: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, ""),
  audit: process.env.NEXT_PUBLIC_AUDIT_REPORT_URL,
};

const published: [string, string | undefined, string][] = [
  ["UnsleptBuffer", process.env.NEXT_PUBLIC_BUFFER_ADDRESS, "USDG liquidity that settles payments (ERC-4626)"],
  ["SettlementRouter", process.env.NEXT_PUBLIC_SETTLEMENT_ROUTER_ADDRESS, "Pays merchants from the buffer, records debt"],
  ["AgentAccountFactory", process.env.NEXT_PUBLIC_AGENT_ACCOUNT_FACTORY_ADDRESS, "Creates agent accounts, keeps the registry"],
  ["Allocator", process.env.NEXT_PUBLIC_ALLOCATOR_ADDRESS, "Parks idle cash, settles debt, refills the buffer"],
  ["FeeModule", process.env.NEXT_PUBLIC_FEE_MODULE_ADDRESS, "Instant-settlement fee and holder discounts"],
  ["ERC4626Adapter", process.env.NEXT_PUBLIC_ADAPTER_ADDRESS, "Connects the allocator to spUSDG"],
  ["TimelockController", process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS, "Admin of every contract, 24-hour delay"],
  ["USDG", process.env.NEXT_PUBLIC_USDG_ADDRESS, "Paxos Global Dollar, the settlement asset"],
  ["spUSDG", process.env.NEXT_PUBLIC_ASSET_VAULT_ADDRESS, "Spark Savings USDG, where idle cash is parked"],
  ["Staker buffer tier", process.env.NEXT_PUBLIC_STAKER_BUFFER_ADDRESS, "Higher-fee tier for $UNSLEPT stakers"],
];

function Addr({ a }: { a?: string }) {
  if (!a) return <span className="muted">Not deployed</span>;
  return env.explorer ? (
    <a className="text-link num" href={`${env.explorer}/address/${a}`} rel="noopener noreferrer" target="_blank">
      {a}
    </a>
  ) : (
    <code>{a}</code>
  );
}

const demoUrl = `${env.site ?? "https://<this-site>"}/api/demo/x402`;

/* ------------------------------------------------------------------ */

export const docs: DocPage[] = [
  {
    slug: "",
    group: "Get started",
    title: "Introduction",
    nav: "Introduction",
    description: "What Unslept is, the problem it solves, and how the pieces fit together.",
    body: (
      <>
        <p>
          Unslept is a payment layer for AI agents on Robinhood Chain. It does two things at once that are usually in
          conflict: it keeps an agent&apos;s money <strong>ready to pay</strong>, and it keeps that same money{" "}
          <strong>working</strong> while it waits.
        </p>
        <h2>The problem</h2>
        <p>
          Agents increasingly pay for what they use, one request at a time, through the x402 standard: an API answers
          <code>402 Payment Required</code> with a price, the agent pays, and the request goes through. To do that, an agent
          has to keep a balance on hand. Most of the time that balance is simply waiting, often for hours between two
          payments, and it earns nothing while it waits.
        </p>
        <p>
          Moving the balance into an interest-bearing asset is not a fix on its own. Selling an asset to pay a 402 takes
          time and can fail, and an agent that has to wait for its money is an agent that misses the call.
        </p>
        <h2>How Unslept solves it</h2>
        <p>
          Unslept splits the job in two. A shared <strong>buffer</strong> of USDG pays every x402 request the instant it is
          due. Each agent&apos;s idle balance sits in a tokenized savings position, <strong>Spark Savings USDG</strong>{" "}
          (spUSDG), and repays the buffer in the background. The agent sees a payment that settled in one transaction;
          its balance keeps earning the variable rate of the underlying asset between payments.
        </p>
        <h2>The pieces</h2>
        <DefTable
          head={["Component", "What it does"]}
          rows={[
            [<strong key="a">Agent account</strong>, "A smart account per agent (ERC-4337 compatible). It holds the agent's funds and enforces its spending policy on chain: per-call cap, daily cap, payee and domain allowlists."],
            [<strong key="b">Settlement router</strong>, "Pays the merchant from the buffer when the agent asks, and records what the account owes. Supports the standard x402 exact scheme and Unslept's direct scheme."],
            [<strong key="c">Buffer</strong>, "An ERC-4626 vault of USDG supplied by depositors. It fronts payments and earns the settlement fee in return."],
            [<strong key="d">Allocator and adapters</strong>, "Move idle cash into spUSDG and back, settle account debt from parked positions, and refill the buffer."],
            [<strong key="e">SDKs and MCP server</strong>, "Wrap your agent's HTTP calls. On a 402 they check the policy, request settlement and retry with the proof attached."],
          ]}
        />
        <h2>Where to go next</h2>
        <ul>
          <li>
            New to Unslept: read <a className="text-link" href="/docs/concepts">Core concepts</a>, then follow the{" "}
            <a className="text-link" href="/docs/quickstart">Quickstart</a>.
          </li>
          <li>
            Building an agent: pick a guide for <a className="text-link" href="/docs/quickstart-typescript">TypeScript</a>,{" "}
            <a className="text-link" href="/docs/quickstart-langchain">LangChain</a>, <a className="text-link" href="/docs/quickstart-crewai">CrewAI</a> or{" "}
            <a className="text-link" href="/docs/mcp">MCP</a>.
          </li>
          <li>
            Supplying liquidity: read <a className="text-link" href="/docs/buffer">Buffer and deposits</a> and the{" "}
            <a className="text-link" href="/risk">risk disclosure</a>.
          </li>
        </ul>
        <Callout tone="warning" title="Guarded launch">
          The contracts are live on Robinhood Chain mainnet without a completed third-party audit. Total buffer deposits and
          each asset are capped at 50,000 USDG. Use only amounts you can afford to lose.
        </Callout>
      </>
    ),
  },
  {
    slug: "quickstart",
    group: "Get started",
    title: "Quickstart",
    description: "From an empty wallet to an agent that pays its first x402 request, in five steps.",
    body: (
      <>
        <p>
          This guide uses the app for everything that involves your own wallet, and the SDK for the agent. Plan for about ten
          minutes. You need a wallet on Robinhood Chain with a little ETH for gas and some USDG for the agent to spend.
        </p>
        <Steps>
          <Step title="Connect your wallet">
            <p>
              Open the <a className="text-link" href="/app">app</a> and connect a browser wallet. If it is on another network,
              the app offers to switch to Robinhood Chain. This wallet becomes the <strong>owner</strong> of your agent
              accounts: it sets policies, funds agents and can always withdraw.
            </p>
          </Step>
          <Step title="Create an agent account">
            <p>
              On the <a className="text-link" href="/app/agents">Agents</a> page, create an account. You choose:
            </p>
            <ul>
              <li>
                <strong>Signer</strong>: the address of the key your agent runs with. Generate a fresh key for each agent and
                keep it apart from your own wallet. The signer can only request payments within the policy; it can never
                withdraw.
              </li>
              <li>
                <strong>Per-call cap</strong>: the most a single payment may cost.
              </li>
              <li>
                <strong>Daily cap</strong>: the most the agent may spend in one UTC day.
              </li>
            </ul>
          </Step>
          <Step title="Allowlist who it may pay">
            <p>
              Add the payee addresses (or API host names) your agent is allowed to pay. Until you add one, the agent cannot pay
              anyone. Addresses are enforced strictly on chain; host names rely on what the SDK reports, so prefer addresses
              where you can.
            </p>
          </Step>
          <Step title="Fund the account">
            <p>
              Deposit USDG into the account from the agent&apos;s card. A keeper parks the idle part in spUSDG automatically. You
              can turn that off per account, and you can unwind and withdraw at any time.
            </p>
          </Step>
          <Step title="Point your agent at a paid API">
            <p>
              Install the SDK, copy the environment from the <a className="text-link" href="/app/developers">Developers</a> page and
              swap your fetch for <code>unslept.fetch</code>.
            </p>
            <CodeBlock filename="terminal" code="npm install @unslept/sdk viem" />
            <CodeBlock
              filename="agent.ts"
              code={`import { Unslept } from "@unslept/sdk";
import { privateKeyToAccount } from "viem/accounts";

const unslept = new Unslept({
  agentAccount: process.env.UNSLEPT_AGENT_ACCOUNT,
  signer: privateKeyToAccount(process.env.UNSLEPT_SIGNER_KEY as \`0x\${string}\`),
  network: "robinhood-chain",
});

const res = await unslept.fetch("${demoUrl}");
console.log(res.status, await res.json());`}
            />
          </Step>
        </Steps>
        <p>
          The URL above is the live demo endpoint. It costs 0.01 USDG and answers with current protocol stats once the
          payment settles, so it is an easy way to confirm everything works end to end.
        </p>
        <Callout tone="tip" title="Start small">
          Give your first agent a low daily cap, for example 1 USDG. You can raise it later in one transaction.
        </Callout>
      </>
    ),
  },
  {
    slug: "concepts",
    group: "Get started",
    title: "Core concepts",
    description: "The handful of ideas that explain everything else: accounts, policies, the buffer, parking and debt.",
    body: (
      <>
        <h2>Owner and signer</h2>
        <p>
          Every agent account has two keys with very different powers. The <strong>owner</strong> is your wallet. It can do
          everything: change the policy, add payees, fund, unwind, withdraw, pause and revoke. The <strong>signer</strong> is
          the key your agent runs with. It can do exactly one thing: ask the account to pay someone, within the policy.
        </p>
        <p>
          This split is what makes it safe to give an AI model access to money. If the signer key leaks, the worst case is
          bounded by your daily cap and your payee list, and you can revoke the signer from the owner wallet.
        </p>
        <h2>Spending policy</h2>
        <p>The account contract checks every payment against its policy before any money moves:</p>
        <DefTable
          rows={[
            ["Per-call cap", "Maximum amount of a single payment."],
            ["Daily cap", "Maximum total per UTC day. It resets at 00:00 UTC."],
            ["Payee allowlist", "Addresses the agent may pay. Enforced strictly on chain."],
            ["Domain allowlist", "API hosts the agent may pay, such as api.example.com. Matching relies on the host the SDK reports."],
            ["Pause and revoke", "Pause stops payments until resumed. Revoke disables the signer permanently."],
          ]}
        />
        <p>
          The SDK also lets you set a per-request <code>maxAmount</code>. It is checked before anything is signed, as an
          extra guard on top of the on-chain policy.
        </p>
        <h2>Liquid, parked and net balance</h2>
        <p>An account&apos;s money is always in one of two places:</p>
        <ul>
          <li>
            <strong>Liquid</strong>: plain USDG in the account, used first to repay the buffer.
          </li>
          <li>
            <strong>Parked</strong> (also called working): USDG value held in spUSDG through the adapter, earning the asset&apos;s
            variable rate.
          </li>
        </ul>
        <p>
          The <strong>net balance</strong> is liquid plus parked minus debt. It is what the account is really worth, and what
          low-balance alerts watch.
        </p>
        <h2>The buffer and debt</h2>
        <p>
          When an agent pays, the buffer pays the merchant immediately. If the account has enough liquid USDG, it repays the
          buffer in the same transaction. If its money is parked, the account carries a <strong>debt</strong> to the buffer
          for the amount plus the fee, and the debt is settled from the parked position shortly after.
        </p>
        <p>
          An account can never owe more than it is worth: the router refuses a payment that would leave debt uncovered by the
          account&apos;s collateral. That keeps the buffer whole even if an agent misbehaves.
        </p>
        <h2>Keeper and permissionless valves</h2>
        <p>
          A keeper service parks idle cash and unwinds positions. It holds a narrow role: it can only move an account&apos;s
          funds between the account and registered adapters. Two functions need no role at all, so the system keeps working
          even if the keeper stops: <code>settleDebt</code> repays an account&apos;s debt from its own parked funds, and{" "}
          <code>refillBuffer</code> tops the buffer up from its own parked position.
        </p>
        <h2>Timelock</h2>
        <p>
          Every contract is administered by a TimelockController with a 24-hour delay. Fee changes, new assets, caps and role
          changes are scheduled publicly and can only execute a day later. The admin can pause in an emergency without the
          delay; pausing never blocks owners from exiting their accounts.
        </p>
      </>
    ),
  },

  /* Guides */
  {
    slug: "quickstart-typescript",
    group: "Guides",
    title: "Build a TypeScript agent",
    nav: "TypeScript agent",
    description: "Pay x402 endpoints from any Node.js agent, with error handling and low-balance alerts.",
    body: (
      <>
        <h2>Install</h2>
        <CodeBlock filename="terminal" code="npm install @unslept/sdk viem" />
        <p>
          <code>viem</code> is a peer dependency used for signing and chain access. The SDK runs on Node.js 20 or newer.
        </p>
        <h2>Configure</h2>
        <p>
          The <code>robinhood-chain</code> preset reads its chain settings from the environment. The{" "}
          <a className="text-link" href="/app/developers">Developers</a> page in the app shows these values for your account.
        </p>
        <CodeBlock
          filename=".env"
          code={`UNSLEPT_AGENT_ACCOUNT=0x...            # your agent account
UNSLEPT_SIGNER_KEY=0x...               # the agent's signing key, from your secret store
UNSLEPT_CHAIN_ID=4663
UNSLEPT_RPC_URL=https://rpc.mainnet.chain.robinhood.com
UNSLEPT_USDG=${process.env.NEXT_PUBLIC_USDG_ADDRESS ?? "0x..."}
UNSLEPT_ROUTER=${process.env.NEXT_PUBLIC_SETTLEMENT_ROUTER_ADDRESS ?? "0x..."}
UNSLEPT_BUFFERS=${process.env.NEXT_PUBLIC_BUFFER_ADDRESS ?? "0x..."}`}
        />
        <Callout tone="warning" title="Keep the signer key secret">
          Load <code>UNSLEPT_SIGNER_KEY</code> from a secret manager in production, never from source control. It is not your
          owner wallet, but it can spend up to your daily cap.
        </Callout>
        <h2>Pay a request</h2>
        <CodeBlock
          filename="agent.ts"
          code={`import { Unslept, UnsleptError } from "@unslept/sdk";
import { privateKeyToAccount } from "viem/accounts";

const unslept = new Unslept({
  agentAccount: process.env.UNSLEPT_AGENT_ACCOUNT,
  signer: privateKeyToAccount(process.env.UNSLEPT_SIGNER_KEY as \`0x\${string}\`),
  network: "robinhood-chain",
  // Optional: report policy refusals so the owner's webhooks receive them.
  reportUrl: "${env.site ?? "https://<this-site>"}",
});

try {
  const res = await unslept.fetch("https://api.example.com/data", undefined, {
    maxAmount: 500_000n, // never pay more than 0.50 USDG for this call
  });
  console.log(await res.json());
  console.log(unslept.localPayments().at(-1)); // amount, fee, payee, transaction hash
} catch (e) {
  if (e instanceof UnsleptError) console.error(e.code, e.message);
  else throw e;
}`}
        />
        <p>
          <code>unslept.fetch</code> takes the same arguments as the standard <code>fetch</code>, plus options. If the server
          does not answer 402, nothing is paid and you get the response as usual.
        </p>
        <h2>Watch the balance</h2>
        <CodeBlock
          filename="agent.ts"
          code={`const stop = unslept.onLowBalance(
  (b) => console.warn("Low balance", b.net),
  { threshold: 5_000_000n, intervalMs: 60_000 }, // below 5 USDG, checked every minute
);`}
        />
        <p>
          For alerts that reach you even when the agent is offline, register a webhook instead. See{" "}
          <a className="text-link" href="/docs/webhooks">Webhooks</a>.
        </p>
        <h2>Amounts</h2>
        <p>
          All amounts are atomic USDG units as <code>bigint</code>. USDG has 6 decimals, so <code>1_000_000n</code> is 1 USDG
          and <code>10_000n</code> is 0.01 USDG.
        </p>
      </>
    ),
  },
  {
    slug: "quickstart-langchain",
    group: "Guides",
    title: "Use Unslept with LangChain",
    nav: "LangChain",
    description: "Give a LangChain agent a tool that pays x402 requests within its policy.",
    body: (
      <>
        <h2>Install</h2>
        <CodeBlock filename="terminal" code={`pip install "unslept[web3,langchain]"`} />
        <h2>Create the tool</h2>
        <CodeBlock
          filename="agent.py"
          code={`import os
from eth_account import Account
from unslept import Unslept
from unslept.web3_chain import EthAccountSigner
from unslept.langchain_tool import unslept_tool

signer = EthAccountSigner(Account.from_key(os.environ["UNSLEPT_SIGNER_KEY"]))
unslept = Unslept(os.environ["UNSLEPT_AGENT_ACCOUNT"], signer=signer, network="robinhood-chain")

tools = [unslept_tool(unslept)]  # pass to your agent, e.g. create_react_agent(llm, tools)`}
        />
        <p>
          The tool is called <code>pay_x402_request</code>. It takes a URL, an optional method and body, and an optional{" "}
          <code>max_amount_usdg</code> per call, written as a decimal string such as <code>&quot;0.25&quot;</code>.
        </p>
        <Callout tone="note" title="The model cannot exceed your policy">
          Whatever the model asks for, the account contract enforces the per-call cap, daily cap and payee allowlist. The
          tool&apos;s maximum is an extra limit on top.
        </Callout>
        <h2>Environment</h2>
        <p>
          The Python SDK reads the same variables as the TypeScript SDK: <code>UNSLEPT_CHAIN_ID</code>,{" "}
          <code>UNSLEPT_RPC_URL</code>, <code>UNSLEPT_USDG</code>, <code>UNSLEPT_ROUTER</code> and <code>UNSLEPT_BUFFERS</code>.
        </p>
      </>
    ),
  },
  {
    slug: "quickstart-crewai",
    group: "Guides",
    title: "Use Unslept with CrewAI",
    nav: "CrewAI",
    description: "Wrap Unslept as a CrewAI tool so a crew can pay for the data it needs.",
    body: (
      <>
        <CodeBlock filename="terminal" code={`pip install "unslept[web3]" crewai`} />
        <CodeBlock
          filename="crew.py"
          code={`import os
from crewai.tools import tool
from eth_account import Account
from unslept import Unslept
from unslept.web3_chain import EthAccountSigner
from unslept.langchain_tool import pay_x402_request

unslept = Unslept(
    os.environ["UNSLEPT_AGENT_ACCOUNT"],
    signer=EthAccountSigner(Account.from_key(os.environ["UNSLEPT_SIGNER_KEY"])),
    network="robinhood-chain",
)

@tool("pay_x402_request")
def pay(url: str, max_amount_usdg: str = "1") -> str:
    """Fetch a URL, paying an x402 paywall within the agent's spending policy."""
    return pay_x402_request(unslept, url, max_amount_usdg=max_amount_usdg)`}
        />
        <p>
          Add <code>pay</code> to an agent&apos;s <code>tools</code>. Give each crew member that spends money its own agent
          account if you want separate budgets and separate payment histories.
        </p>
      </>
    ),
  },
  {
    slug: "mcp",
    group: "Guides",
    title: "MCP server",
    description: "Let any MCP client, such as a desktop assistant or an IDE agent, pay x402 requests within policy.",
    body: (
      <>
        <p>
          <code>@unslept/mcp</code> is a small stdio MCP server. It needs no install step: MCP clients start it with{" "}
          <code>npx</code>.
        </p>
        <h2>Tools</h2>
        <DefTable
          head={["Tool", "What it does"]}
          rows={[
            [<code key="a">pay_x402_request</code>, "Fetch a URL and pay its 402 challenge, optionally with a maximum amount."],
            [<code key="b">get_balances</code>, "Liquid, parked, debt and net balance of the agent account."],
            [<code key="c">get_payment_history</code>, "Recent payments with amounts, fees, payees and transaction hashes."],
            [<code key="d">get_policy</code>, "Caps, what is left today, and whether the agent is paused or revoked."],
          ]}
        />
        <h2>Configuration</h2>
        <CodeBlock
          filename="mcp.json"
          code={`{
  "mcpServers": {
    "unslept": {
      "command": "npx",
      "args": ["-y", "@unslept/mcp"],
      "env": {
        "UNSLEPT_AGENT_ACCOUNT": "<your agent account address>",
        "UNSLEPT_SIGNER_KEY": "<agent signer key, from your secret store>",
        "UNSLEPT_NETWORK": "robinhood-chain",
        "UNSLEPT_CHAIN_ID": "4663",
        "UNSLEPT_RPC_URL": "https://rpc.mainnet.chain.robinhood.com",
        "UNSLEPT_USDG": "${process.env.NEXT_PUBLIC_USDG_ADDRESS ?? "0x..."}",
        "UNSLEPT_ROUTER": "${process.env.NEXT_PUBLIC_SETTLEMENT_ROUTER_ADDRESS ?? "0x..."}",
        "UNSLEPT_BUFFERS": "${process.env.NEXT_PUBLIC_BUFFER_ADDRESS ?? "0x..."}"
      }
    }
  }
}`}
        />
        <Callout tone="tip" title="One agent account per client">
          Use a dedicated agent account with a small daily cap for each MCP client. Then a misbehaving conversation can only
          spend what that account allows.
        </Callout>
      </>
    ),
  },
  {
    slug: "x402",
    group: "Guides",
    title: "x402 payments",
    nav: "x402 and the demo",
    description: "How the x402 flow works with Unslept, both as a payer and as an API that wants to get paid.",
    body: (
      <>
        <h2>The flow in four steps</h2>
        <Steps>
          <Step title="The API asks for payment">
            <p>
              The server answers <code>402 Payment Required</code> with a <code>PAYMENT-REQUIRED</code> header: base64-encoded
              JSON listing the price, asset, payee and the payment schemes it accepts.
            </p>
          </Step>
          <Step title="The SDK checks the policy">
            <p>Before anything is signed, the SDK checks the amount against your per-request maximum and the account policy.</p>
          </Step>
          <Step title="The router settles">
            <p>The account asks the settlement router to pay. The buffer pays the merchant at once, in one transaction.</p>
          </Step>
          <Step title="The request is retried with proof">
            <p>
              The SDK repeats the original request with a <code>PAYMENT-SIGNATURE</code> header. The server verifies it and
              answers 200 with a <code>PAYMENT-RESPONSE</code> header describing the settlement.
            </p>
          </Step>
        </Steps>
        <h2>Schemes</h2>
        <DefTable
          head={["Scheme", "How it settles"]}
          rows={[
            [
              <code key="a">exact</code>,
              "The standard x402 scheme. The router funds the agent's signer with exactly the price, and the signer signs an EIP-3009 transfer to the payee, verified and settled by the server's facilitator.",
            ],
            [
              <code key="b">unslept-direct</code>,
              "The router pays the payee directly and emits a Settled event. The server verifies that event in the transaction receipt itself, with no facilitator.",
            ],
          ]}
        />
        <p>
          The SDK prefers <code>unslept-direct</code> when the server offers it, and falls back to <code>exact</code>.
        </p>
        <h2>Try the live endpoint</h2>
        <p>
          This site runs a real paid endpoint on mainnet. It asks for 0.01 USDG through <code>unslept-direct</code> and
          answers with a snapshot of protocol stats. Each payment ID expires after 10 minutes and can be used once.
        </p>
        <CodeBlock filename="terminal" code={`curl -si ${demoUrl} | grep -i payment-required`} />
        <CodeBlock filename="demo.ts" code={`const res = await unslept.fetch("${demoUrl}");\nconsole.log(res.status, await res.json());`} />
        <Callout tone="note" title="Real money">
          The demo pays real USDG to the project wallet. Use an agent with a small daily cap when you try it.
        </Callout>
        <h2>Accept x402 payments in your API</h2>
        <p>
          The repository includes a dependency-free sample endpoint, <code>examples/x402-endpoint</code>, that offers both
          schemes. To verify an <code>unslept-direct</code> payment yourself:
        </p>
        <ol>
          <li>Issue a fresh payment ID with every 402 and remember it until it expires.</li>
          <li>
            Read the receipt of the transaction hash the client sends, and find the router&apos;s <code>Settled</code> event
            whose payment ID matches.
          </li>
          <li>Check the payee, the recipient, the amount and that the mode is direct.</li>
          <li>Accept each transaction and each payment ID once only.</li>
        </ol>
      </>
    ),
  },
  {
    slug: "webhooks",
    group: "Guides",
    title: "Webhooks",
    description: "Get low-balance and policy-violation alerts delivered to your own server.",
    body: (
      <>
        <p>
          Register an https endpoint on the <a className="text-link" href="/app/developers">Developers</a> page. You sign the
          registration with your owner wallet, so only you can add webhooks for your accounts. You receive a signing secret
          once; store it, it is not shown again.
        </p>
        <h2>Events</h2>
        <DefTable
          head={["Event", "When it is sent"]}
          rows={[
            [<code key="a">low_balance</code>, "An account's net balance fell below your threshold. At most once per account per UTC day."],
            [<code key="b">policy_violation</code>, "The SDK refused a payment for a policy reason and reported it, signed by the agent's key."],
          ]}
        />
        <h2>Verify the signature</h2>
        <p>
          Each delivery is a JSON POST with an <code>Unslept-Event</code> header and an <code>Unslept-Signature</code> header of
          the form <code>t=&lt;unix&gt;,v1=&lt;hex&gt;</code>. The hex is HMAC-SHA256 of <code>t + &quot;.&quot; + body</code> with
          your signing secret. Reject deliveries older than five minutes.
        </p>
        <CodeBlock
          filename="verify.ts"
          code={`import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(secret: string, header: string, body: string) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const want = createHmac("sha256", secret).update(\`\${t}.\${body}\`).digest("hex");
  return want.length === v1.length && timingSafeEqual(Buffer.from(want), Buffer.from(v1));
}`}
        />
        <h2>Example payload</h2>
        <CodeBlock
          filename="low_balance.json"
          code={`{
  "type": "low_balance",
  "account": "0x...",
  "owner": "0x...",
  "netBalance": "3200000",
  "threshold": "5000000",
  "message": "Account 0x... holds 3.2 USDG net, below your 5 USDG threshold.",
  "at": "2026-10-31T09:00:00.000Z"
}`}
        />
      </>
    ),
  },

  /* Protocol */
  {
    slug: "buffer",
    group: "Protocol",
    title: "Buffer and deposits",
    description: "How depositing works, where returns come from, and when withdrawals are instant or queued.",
    body: (
      <>
        <p>
          The buffer is an ERC-4626 vault that holds USDG. Depositors receive <code>usBUF</code> shares. The buffer uses its
          USDG to pay x402 requests the instant they are due, and agents repay it shortly after, with a fee.
        </p>
        <h2>Where returns come from</h2>
        <ul>
          <li>
            <strong>Settlement fees.</strong> Agents pay a small fee on every settled payment. It is added to their debt and
            counted only when it is actually repaid, so the share price never rises on money that has not arrived.
          </li>
          <li>
            <strong>Asset yield.</strong> Part of the buffer that is not needed for settlement can be parked in spUSDG and earns
            its variable rate.
          </li>
        </ul>
        <p>
          Both depend on activity and market conditions. The rate is variable, has no floor, and can be zero. Past rates say
          nothing about future ones.
        </p>
        <h2>Liquidity rules</h2>
        <DefTable
          rows={[
            ["Deposit cap", "Total deposits are capped at 50,000 USDG during the guarded launch."],
            ["Liquid target", "The allocator keeps at least 20 percent of buffer assets liquid before parking any."],
            ["Queue threshold", "When utilization is above 80 percent, instant withdrawals pause and requests join a queue."],
          ]}
        />
        <h2>Withdrawing</h2>
        <p>
          When there is enough free liquidity and utilization is below the threshold, you withdraw instantly. Otherwise you
          request a withdrawal and receive a ticket. Tickets are served first in, first out as agents repay and parked funds
          return; you claim yours once it is funded. The app shows both options and your open tickets.
        </p>
        <Callout tone="warning" title="Deposits can lose value">
          The buffer is exposed to smart contract risk, to spUSDG and Spark, to USDG and Paxos, and to agents&apos; debts. Read
          the <a className="text-link" href="/risk">risk disclosure</a> before depositing.
        </Callout>
      </>
    ),
  },
  {
    slug: "settlement",
    group: "Protocol",
    title: "Settlement and fees",
    description: "What happens on chain when an agent pays, and how the fee is set.",
    body: (
      <>
        <h2>What happens on chain</h2>
        <Steps>
          <Step title="Policy check">
            <p>
              The signer calls <code>requestPayment</code> on the agent account. The account checks the per-call cap, the daily
              cap, the payee allowlist, pause and revoke, and that the payment ID was never used.
            </p>
          </Step>
          <Step title="Payment">
            <p>The settlement router takes the amount from the buffer and pays the merchant, or the signer in exact mode.</p>
          </Step>
          <Step title="Repayment">
            <p>
              The account repays the amount plus the fee from its liquid USDG. Whatever it cannot cover becomes debt, which
              must stay below the account&apos;s total value.
            </p>
          </Step>
          <Step title="Background settlement">
            <p>
              <code>settleDebt</code> unwinds just enough of the parked position to repay the debt. Anyone can call it.
            </p>
          </Step>
        </Steps>
        <h2>The fee</h2>
        <p>
          The instant-settlement fee is set in the FeeModule. It is currently <strong>0.10 percent</strong> of the payment. The
          contract bounds it between 0 and 1 percent, and any change goes through the 24-hour timelock. Holders of $UNSLEPT can
          receive tiered discounts once tiers are configured; the account owner&apos;s wallet and staked balances count.
        </p>
        <DefTable
          head={["Payment", "Fee at 0.10 percent"]}
          rows={[
            ["0.01 USDG", "0.00001 USDG"],
            ["1 USDG", "0.001 USDG"],
            ["100 USDG", "0.10 USDG"],
          ]}
        />
      </>
    ),
  },
  {
    slug: "security",
    group: "Protocol",
    title: "Security model",
    description: "Who can do what, what protects your funds, and what does not.",
    body: (
      <>
        <h2>Roles</h2>
        <DefTable
          head={["Role", "What it can do"]}
          rows={[
            ["Account owner", "Everything on their own account: policy, payees, funding, unwinding, withdrawing, pause, revoke."],
            ["Agent signer", "Request payments within the policy. Nothing else; it can never withdraw."],
            ["Keeper", "Move an account's idle cash into a registered adapter and back. It cannot send funds anywhere else."],
            ["Admin (timelock)", "Change parameters, add adapters and grant roles, each only after a 24-hour delay."],
            ["Pauser", "Pause the buffer and router in an emergency. Owners can still exit while paused."],
            ["Anyone", "Call settleDebt and refillBuffer, which only move funds to repay what is already owed."],
          ]}
        />
        <h2>Safeguards</h2>
        <ul>
          <li>Deposit caps of 50,000 USDG on the buffer and on each asset adapter during the guarded launch.</li>
          <li>Debt can never exceed an account&apos;s collateral, so one agent cannot drain the buffer.</li>
          <li>Payment IDs are single use, so a payment cannot be replayed.</li>
          <li>Fees are recognized only when repaid, so the share price cannot be inflated by unpaid debt.</li>
          <li>All contract sources are verified with an exact match on Sourcify.</li>
          <li>A monitor checks protocol health every 15 minutes and opens an alert for anything new.</li>
        </ul>
        <h2>Testing</h2>
        <p>
          The contracts have unit, fuzz and invariant tests, and a fork test that runs the full flow against the live mainnet
          contracts, real USDG and real spUSDG without moving real funds.
        </p>
        <Callout tone="warning" title="Not yet audited">
          {env.audit ? (
            <>
              An audit report is available: <a className="text-link" href={env.audit}>read it</a>.
            </>
          ) : (
            "No third-party audit has been completed. Tests reduce risk but do not remove it. Until an audit is published, deposits stay capped."
          )}
        </Callout>
        <h2>Report a vulnerability</h2>
        <p>
          Please report privately and do not share details publicly or test against mainnet funds. <ContactLine purpose="Security reports" />
        </p>
      </>
    ),
  },
  {
    slug: "contracts",
    group: "Protocol",
    title: "Contracts",
    description: "Every deployed contract on Robinhood Chain mainnet, with what it does.",
    body: (
      <>
        <p>
          Robinhood Chain mainnet, chain ID 4663. Solidity 0.8.28 with OpenZeppelin 5. Addresses are published here and in the
          repository only. Every source is verified with an exact match on Sourcify and readable on the explorer.
        </p>
        <div className="def-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Contract</th>
                <th scope="col">Role</th>
                <th scope="col">Address</th>
              </tr>
            </thead>
            <tbody>
              {published.map(([name, addr, role]) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td>{role}</td>
                  <td className="def-table__addr">
                    <Addr a={addr} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="note" title="Administration">
          A TimelockController with a 24-hour delay administers every contract. The admin can pause without waiting. The admin
          moves to a multisig before the deposit caps are raised.
        </Callout>
      </>
    ),
  },

  /* Reference */
  {
    slug: "sdk",
    group: "Reference",
    title: "SDK reference",
    description: "Every method of the TypeScript SDK, with the Python equivalents.",
    body: (
      <>
        <h2>Constructor</h2>
        <CodeBlock
          filename="ts"
          code={`new Unslept({
  agentAccount,   // AgentAccount address
  signer,         // viem account, or anything with an address and signTypedData
  network,        // "robinhood-chain" reads its settings from the environment
  chain?,         // custom chain implementation, instead of the preset
  fetch?,         // custom fetch implementation
  schemes?,       // scheme preference, default ["unslept-direct", "exact"]
  onPayment?,     // called after every settled payment
  reportUrl?,     // Unslept site URL, to report policy refusals to webhooks
})`}
        />
        <h2>Methods</h2>
        <DefTable
          head={["TypeScript", "What it returns"]}
          rows={[
            [<code key="a">fetch(input, init?, {"{ maxAmount? }"})</code>, "A Response. Pays a 402 if needed, within maxAmount and the policy."],
            [<code key="b">getBalances()</code>, "liquid, working, debt and net, in atomic USDG."],
            [<code key="c">getPolicy()</code>, "perCallCap, dailyCap, remainingToday, paused and revoked."],
            [<code key="d">setPolicy(policy)</code>, "A transaction hash. Owner only."],
            [<code key="e">getPayments({"{ limit? }"})</code>, "Settled payments read from chain."],
            [<code key="f">localPayments()</code>, "Payments made by this SDK instance, with transaction hashes."],
            [<code key="g">onLowBalance(cb, {"{ threshold, intervalMs? }"})</code>, "A function that stops the watch."],
          ]}
        />
        <h2>Python</h2>
        <p>
          The Python SDK mirrors the TypeScript one with snake case names: <code>fetch(url, method, headers, body, max_amount)</code>,{" "}
          <code>get_balances()</code>, <code>get_policy()</code>, <code>set_policy(policy)</code>, <code>get_payments(limit)</code>,{" "}
          <code>local_payments()</code> and <code>on_low_balance(callback, threshold)</code>. Wrap an{" "}
          <code>eth_account</code> key in <code>EthAccountSigner</code> to use it as the signer.
        </p>
      </>
    ),
  },
  {
    slug: "errors",
    group: "Reference",
    title: "Errors",
    description: "Every error code the SDK can raise, what it means and what to do.",
    body: (
      <>
        <p>
          The SDK raises <code>UnsleptError</code> with a stable <code>code</code> and a message written for people. Policy
          errors are raised before anything is paid.
        </p>
        <DefTable
          head={["Code", "Meaning and fix"]}
          rows={[
            [<code key="1">PER_CALL_CAP</code>, "The price is above the per-call cap. Raise the cap or skip the request."],
            [<code key="2">DAILY_CAP</code>, "Today's spending would exceed the daily cap. It resets at 00:00 UTC."],
            [<code key="3">MAX_AMOUNT</code>, "The price is above the maxAmount you passed for this request."],
            [<code key="4">PAYEE_NOT_ALLOWED</code>, "The payee is not on the allowlist. Add it from the owner wallet."],
            [<code key="5">AGENT_PAUSED</code>, "The owner paused the agent. Resume it in the app."],
            [<code key="6">AGENT_REVOKED</code>, "The signer was revoked. Create a new agent account."],
            [<code key="7">INSUFFICIENT_COLLATERAL</code>, "The account is not worth enough to cover the payment. Fund it."],
            [<code key="8">INSUFFICIENT_BUFFER_LIQUIDITY</code>, "The buffer cannot front this payment right now. Retry shortly or fund the account's liquid balance."],
            [<code key="9">SETTLEMENT_FAILED</code>, "The transaction failed or the server rejected the proof. The message has details."],
            [<code key="10">CONFIG</code>, "A setting is missing or wrong, such as an address or environment variable."],
          ]}
        />
      </>
    ),
  },
];

export function findDoc(slug: string) {
  return docs.find((d) => d.slug === slug);
}
