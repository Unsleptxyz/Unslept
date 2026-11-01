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

const devnet = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet";
const env = {
  site: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, ""),
  audit: process.env.NEXT_PUBLIC_AUDIT_REPORT_URL,
  program: process.env.NEXT_PUBLIC_UNSLEPT_PROGRAM_ID || "HbAgL4w8R9D8RUEuK4rJknK5Vn8rBusfRtfTnFcYieue",
  network: devnet ? "solana-devnet" : "solana",
};
const cluster = devnet ? "?cluster=devnet" : "";

const published: [string, string, string][] = [
  ["Unslept program", env.program, "Agent accounts, the USDC buffer, x402 settlement and the Kamino adapter"],
  ["USDC mint", devnet ? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" : "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Circle USDC, the settlement asset"],
  ["Kamino Lend", "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD", "Lending program where idle agent USDC can earn"],
  ["Kamino Main Market", "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF", "Lending market"],
  ["Kamino USDC reserve", "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59", "The reserve agent positions use"],
];

function Addr({ a }: { a: string }) {
  return (
    <a className="text-link num" href={`https://solscan.io/account/${a}${cluster}`} rel="noopener noreferrer" target="_blank">
      {a}
    </a>
  );
}

const demoUrl = `${env.site ?? "https://<this-site>"}/api/demo/x402`;

const tsAgent = (url: string) => `import { Unslept } from "@unslept/sdk";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const unslept = new Unslept({
  agent: process.env.UNSLEPT_AGENT,                     // agent account address
  signer: Keypair.fromSecretKey(bs58.decode(process.env.UNSLEPT_SIGNER_KEY!)),
  network: "${env.network}",
  rpcUrl: process.env.UNSLEPT_RPC_URL,                  // a dedicated RPC is recommended
});

const res = await unslept.fetch("${url}");
console.log(res.status, await res.json());`;

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
          Unslept is a payment layer for AI agents on Solana. It does two things at once that are usually in tension: it keeps
          an agent&apos;s USDC working between payments, and it pays every x402 request the moment it is due.
        </p>
        <p>
          An agent that buys API calls with x402 needs money ready at all times. Money that waits earns nothing. Unslept puts the
          idle part into Kamino Lend and settles payments from a shared USDC buffer, which the agent repays in the same
          transaction from its liquid balance or, later, from its Kamino position.
        </p>
        <DefTable
          head={["Piece", "What it does"]}
          rows={[
            [<strong key="a">Agent account</strong>, "An account in the Unslept program, one per agent. It holds the agent's USDC and enforces its spending policy on-chain: per-call cap, daily cap and an optional payee allowlist."],
            [<strong key="b">Agent signer</strong>, "The key your agent runs with. It can request payments inside the policy and nothing else. It can never withdraw."],
            [<strong key="c">Buffer</strong>, "A pool of USDC supplied by depositors. It pays merchants the moment an agent asks and earns the settlement fee."],
            [<strong key="d">Kamino position</strong>, "Idle agent USDC supplied to the Kamino Main Market USDC reserve. It earns the variable lending rate and backs buffer debt."],
            [<strong key="e">SDK and MCP server</strong>, "Drop-in fetch for TypeScript and Python, and an MCP server for agent frameworks."],
          ]}
        />
        <p>
          Merchants accept these payments with <a className="text-link" href="/pay">@unslept/pay</a>, which checks the on-chain
          payment record before serving the request.
        </p>
        <Callout tone="warning" title="Guarded launch">
          The program is live without a completed third-party audit. Buffer deposits are capped. Read the{" "}
          <a className="text-link" href="/risk">risk disclosure</a> before you deposit.
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
          minutes. You need a Solana wallet (Phantom, Solflare, Backpack or an email login) with a little SOL for network fees
          and some USDC for the agent to spend.
        </p>
        <Steps>
          <Step title="Connect your wallet">
            <p>
              Open the <a className="text-link" href="/app">app</a> and connect. This wallet becomes the <strong>owner</strong> of
              your agent accounts: it sets policies, funds agents and can always withdraw.
            </p>
          </Step>
          <Step title="Create an agent signer and account">
            <p>Generate a fresh key for the agent and keep it apart from your own wallet:</p>
            <CodeBlock filename="terminal" code="solana-keygen new -o agent.json" />
            <p>
              On the <a className="text-link" href="/app/agents">Agents</a> page, create an account with that public key as
              the signer, a per-call cap and a daily cap. Send the signer about 0.01 SOL: it pays network fees and the rent of
              each payment record, which anyone can return to it after 24 hours.
            </p>
          </Step>
          <Step title="Optionally allowlist payees">
            <p>
              Add up to 8 merchant wallets the agent may pay. With an empty list the agent may pay any merchant, still within its
              caps.
            </p>
          </Step>
          <Step title="Fund it and put the balance to work">
            <p>
              Add USDC from the agent&apos;s card. Keep a little liquid so payments repay the buffer at once, and supply the rest
              to Kamino from the same card. You can redeem and withdraw at any time.
            </p>
          </Step>
          <Step title="Point your agent at a paid API">
            <p>
              Install the SDK, copy the environment from the <a className="text-link" href="/app/developers">Developers</a> page
              and swap your fetch for <code>unslept.fetch</code>.
            </p>
            <CodeBlock filename="terminal" code="npm install @unslept/sdk @solana/web3.js bs58" />
            <CodeBlock filename="agent.ts" code={tsAgent(demoUrl)} />
          </Step>
        </Steps>
        <p>
          The URL above is the live demo endpoint. It costs a few cents in USDC and answers with current protocol stats once the
          payment settles, so it is an easy way to confirm everything works end to end.
        </p>
        <Callout tone="tip" title="Start small">
          Give your first agent a low daily cap, for example 1 USDC. You can raise it later in one transaction.
        </Callout>
      </>
    ),
  },
  {
    slug: "concepts",
    group: "Get started",
    title: "Core concepts",
    description: "Agent accounts, policies, the buffer, Kamino positions and debt, in one page.",
    body: (
      <>
        <h2>Agent accounts</h2>
        <p>
          An agent account is a program-derived account owned by your wallet, with its own USDC vault. The owner can change the
          policy, rotate or revoke the signer, pause the agent, move USDC into and out of Kamino, and withdraw. The signer can
          only call <code>pay</code>.
        </p>
        <h2>Spending policy</h2>
        <DefTable
          rows={[
            ["Per-call cap", "The most one payment may cost, in USDC."],
            ["Daily cap", "The most the agent may spend per UTC day. It resets at 00:00 UTC."],
            ["Payee allowlist", "Up to 8 merchant wallets. Empty means any merchant."],
            ["Pause and revoke", "Pause stops payments until resumed. Revoke removes the signer for good; the owner keeps every withdrawal right."],
          ]}
        />
        <h2>Settlement</h2>
        <p>
          When an agent pays, the buffer sends USDC to the merchant first. In the same transaction the settlement fee goes from
          the agent&apos;s vault to the treasury, and the agent repays the buffer from its liquid USDC. Whatever is not repaid stays
          as debt, which must stay within 95 percent of the USDC the agent has in Kamino.
        </p>
        <h2>Kamino positions</h2>
        <p>
          Owners can supply an agent&apos;s liquid USDC to the Kamino Main Market USDC reserve. The agent receives cUSDC, which
          grows in value as borrowers pay interest. The program counts the USDC supplied (not the interest) as collateral, so
          interest never adds borrowing room. Redeeming returns USDC to the agent&apos;s vault and repays any debt first.
        </p>
        <h2>The buffer</h2>
        <p>
          Depositors supply USDC and receive buffer shares, an SPL token. The buffer&apos;s value is its free USDC plus what agents
          owe it, so shares grow as fees come in. See <a className="text-link" href="/docs/buffer">Buffer and deposits</a>.
        </p>
      </>
    ),
  },
  {
    slug: "quickstart-typescript",
    group: "Guides",
    title: "Build a TypeScript agent",
    description: "Use @unslept/sdk to pay x402 APIs from a Node.js agent.",
    body: (
      <>
        <CodeBlock filename="terminal" code="npm install @unslept/sdk @solana/web3.js bs58" />
        <p>
          <code>@solana/web3.js</code> is a peer dependency used to build and send transactions. The SDK runs on Node.js 20 or
          newer and in browsers.
        </p>
        <CodeBlock
          filename=".env"
          code={`UNSLEPT_AGENT=<agent account address>
UNSLEPT_SIGNER_KEY=<agent signer secret key, base58>
UNSLEPT_RPC_URL=<your Solana RPC URL>`}
        />
        <CodeBlock filename="agent.ts" code={tsAgent("https://api.example.com/data")} />
        <h2>Limits per request</h2>
        <CodeBlock
          filename="agent.ts"
          code={`const res = await unslept.fetch(url, undefined, {
  maxAmount: 50_000n, // 0.05 USDC, never more for this call
});`}
        />
        <h2>Balances and history</h2>
        <CodeBlock
          filename="agent.ts"
          code={`const b = await unslept.getBalances();   // { liquid, working, debt, net } in atomic USDC
const p = await unslept.getPolicy();     // caps, remaining today, allowlist, paused, revoked
const h = await unslept.getPayments({ limit: 20 });

unslept.onLowBalance((b) => console.warn("low balance", b.net), { threshold: 2_000_000n });`}
        />
      </>
    ),
  },
  {
    slug: "quickstart-langchain",
    group: "Guides",
    title: "Use Unslept with LangChain",
    description: "Give a LangChain agent a tool that pays x402 requests.",
    body: (
      <>
        <CodeBlock filename="terminal" code={`pip install "unslept[solana,langchain]"`} />
        <CodeBlock
          filename="agent.py"
          code={`import os
from solders.keypair import Keypair
from unslept import Unslept
from unslept.langchain_tool import unslept_tool

unslept = Unslept(
    os.environ["UNSLEPT_AGENT"],
    signer=Keypair.from_base58_string(os.environ["UNSLEPT_SIGNER_KEY"]),
    network="${env.network}",
    rpc_url=os.environ.get("UNSLEPT_RPC_URL"),
)
tool = unslept_tool(unslept)  # pass to your agent's tools`}
        />
        <p>The tool pays within the agent&apos;s on-chain policy and returns the response body, status and payment details.</p>
      </>
    ),
  },
  {
    slug: "quickstart-crewai",
    group: "Guides",
    title: "Use Unslept with CrewAI",
    description: "Pay x402 requests from a CrewAI tool.",
    body: (
      <>
        <CodeBlock filename="terminal" code={`pip install "unslept[solana]" crewai`} />
        <CodeBlock
          filename="crew.py"
          code={`import json, os
from crewai.tools import tool
from solders.keypair import Keypair
from unslept import Unslept
from unslept.langchain_tool import pay_x402_request

unslept = Unslept(os.environ["UNSLEPT_AGENT"], signer=Keypair.from_base58_string(os.environ["UNSLEPT_SIGNER_KEY"]))

@tool("pay_x402_request")
def pay(url: str, max_amount_usdc: str = "0.10") -> str:
    """Fetch a URL and pay it with x402 if it asks for payment."""
    return pay_x402_request(unslept, url, max_amount_usdc=max_amount_usdc)`}
        />
      </>
    ),
  },
  {
    slug: "mcp",
    group: "Guides",
    title: "MCP server",
    description: "Run @unslept/mcp so any MCP client can pay x402 requests.",
    body: (
      <>
        <p>The MCP server speaks stdio and exposes four tools backed by the SDK.</p>
        <CodeBlock
          filename="mcp.json"
          code={`{
  "mcpServers": {
    "unslept": {
      "command": "npx",
      "args": ["-y", "@unslept/mcp"],
      "env": {
        "UNSLEPT_AGENT": "<agent account address>",
        "UNSLEPT_SIGNER_KEY": "<agent signer secret key, base58 or JSON array>",
        "UNSLEPT_NETWORK": "${env.network}",
        "UNSLEPT_RPC_URL": "<your Solana RPC URL>"
      }
    }
  }
}`}
        />
        <DefTable
          head={["Tool", "What it does"]}
          rows={[
            [<code key="a">pay_x402_request</code>, "HTTP request that pays a 402 inside the policy. Optional max_amount_usdc."],
            [<code key="b">get_balances</code>, "Liquid USDC, USDC working in Kamino, buffer debt and net balance."],
            [<code key="c">get_payment_history</code>, "Recent payments with payee, amount, fee and transaction signature."],
            [<code key="d">get_policy</code>, "Caps, what is left today, the allowlist, and whether the agent is paused or revoked."],
          ]}
        />
      </>
    ),
  },
  {
    slug: "x402",
    group: "Protocol",
    title: "x402 payments",
    description: "How the unslept-direct scheme works on Solana, for agents and merchants.",
    body: (
      <>
        <p>
          Unslept follows the x402 v2 HTTP transport: <code>PAYMENT-REQUIRED</code>, <code>PAYMENT-SIGNATURE</code> and{" "}
          <code>PAYMENT-RESPONSE</code> headers carrying base64 JSON. It uses one scheme, <code>unslept-direct</code>.
        </p>
        <Steps>
          <Step title="402 with requirements">
            <p>
              The merchant answers 402 with an <code>accepts</code> entry: scheme <code>unslept-direct</code>, network{" "}
              <code>{devnet ? "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" : "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"}</code>, asset the
              USDC mint, <code>payTo</code> (its wallet), the price in atomic USDC, and a 32-byte <code>extra.paymentId</code>.
            </p>
          </Step>
          <Step title="The agent pays on-chain">
            <p>
              The SDK checks the policy, then sends one transaction to the Unslept program. The buffer pays the merchant&apos;s USDC
              account, and the program writes a <strong>Payment record</strong> at an address derived from the payment ID. A payment
              ID can never be paid twice.
            </p>
          </Step>
          <Step title="Retry with proof">
            <p>
              The agent retries with <code>PAYMENT-SIGNATURE</code>: the transaction signature, the payment ID, the agent address
              and the Payment record address.
            </p>
          </Step>
          <Step title="The merchant verifies">
            <p>
              The merchant reads the record, checks that the Unslept program owns it, and that payment ID, payee and amount match.
              Then it serves the request and answers 200 with a <code>PAYMENT-RESPONSE</code> header describing the settlement.
            </p>
          </Step>
        </Steps>
        <p>
          Try it against the live demo endpoint: <code>{demoUrl}</code>. Merchants can use{" "}
          <a className="text-link" href="/pay">@unslept/pay</a>, which does all of the above.
        </p>
      </>
    ),
  },
  {
    slug: "buffer",
    group: "Protocol",
    title: "Buffer and deposits",
    description: "How the USDC buffer works, what it earns and how withdrawals work.",
    body: (
      <>
        <p>
          The buffer holds USDC. Depositors receive buffer shares, an SPL token minted by the program. The buffer is worth its free
          USDC plus the debt agents owe it; the first deposit mints shares one to one, later ones at the current share price.
        </p>
        <DefTable
          rows={[
            ["What it earns", "The settlement fee on each payment (at most 1 percent, set on-chain). Variable, and zero when agents are idle."],
            ["Withdrawals", "Instant up to the free USDC in the buffer. The rest returns as agents repay."],
            ["Deposit cap", "Total deposits are capped during the guarded launch."],
            ["While paused", "Deposits stop; withdrawals stay open."],
          ]}
        />
        <p>
          The buffer is exposed to program risk, to Kamino through agents&apos; collateral, to USDC and Circle, and to agents&apos;
          debts. Read the <a className="text-link" href="/risk">risk disclosure</a>.
        </p>
      </>
    ),
  },
  {
    slug: "settlement",
    group: "Protocol",
    title: "Settlement and fees",
    description: "What happens in a payment transaction, and what it costs.",
    body: (
      <>
        <ol>
          <li>Checks: protocol and agent not paused, agent not revoked, per-call cap, daily cap, payee allowlist, free buffer USDC.</li>
          <li>The buffer pays the merchant&apos;s USDC account.</li>
          <li>The settlement fee goes from the agent&apos;s vault to the treasury.</li>
          <li>The agent repays the buffer from its liquid USDC. Any remainder becomes debt, which must stay within 95 percent of its Kamino position.</li>
          <li>A Payment record is written and a <code>Settled</code> event is emitted.</li>
        </ol>
        <DefTable
          rows={[
            ["Settlement fee", "Basis points of the payment, read from the program config. Never above 1 percent."],
            ["Network fee", "Paid in SOL by the agent signer."],
            ["Payment record rent", "About 0.0018 SOL per payment, returned to the signer when the record is closed after 24 hours."],
          ]}
        />
        <p>
          Debt is repaid when the agent&apos;s vault receives USDC (anyone can call <code>repay_debt</code>) or when the owner or the
          keeper redeems from Kamino.
        </p>
      </>
    ),
  },
  {
    slug: "security",
    group: "Protocol",
    title: "Security model",
    description: "Who can do what, what is enforced on-chain, and what is not.",
    body: (
      <>
        <DefTable
          head={["Role", "Can"]}
          rows={[
            ["Agent signer", "Call pay, within the policy. Nothing else."],
            ["Owner", "Change policy, signer and allowlist, pause, revoke, move USDC into and out of Kamino, withdraw."],
            ["Keeper", "Redeem an agent's Kamino position to repay its debt."],
            ["Pauser", "Pause deposits and payments. Withdrawals stay open."],
            ["Admin", "Propose parameter changes (fee up to 1 percent, cap, keeper, pauser, treasury) that apply after 24 hours; set the Kamino reserve once."],
          ]}
        />
        <p>
          The program is tested on a local validator, and the Kamino adapter against the real Kamino Lend program and the live
          USDC reserve copied from mainnet. {env.audit ? <a className="text-link" href={env.audit}>Audit report</a> : "No third-party audit has been completed yet."}
        </p>
        <ContactLine purpose="Security reports" />
      </>
    ),
  },
  {
    slug: "contracts",
    group: "Reference",
    title: "Program and addresses",
    nav: "Addresses",
    description: "The Unslept program and the accounts it uses on Solana.",
    body: (
      <>
        <DefTable head={["Name", "Address"]} rows={published.map(([n, a, d]) => [<span key={n}>{n}<br /><span className="muted small">{d}</span></span>, <Addr key={a} a={a} />])} />
        <p>Program-derived accounts:</p>
        <DefTable
          head={["Account", "Seeds"]}
          rows={[
            ["Config", <code key="1">[&quot;config&quot;]</code>],
            ["Buffer vault", <code key="2">[&quot;buffer_vault&quot;]</code>],
            ["Buffer share mint", <code key="3">[&quot;share_mint&quot;]</code>],
            ["Agent", <code key="4">[&quot;agent&quot;, owner, agent_id (u64 LE)]</code>],
            ["Agent vault", <code key="5">[&quot;agent_vault&quot;, agent]</code>],
            ["Agent cUSDC", <code key="6">[&quot;agent_ctoken&quot;, agent]</code>],
            ["Payment record", <code key="7">[&quot;payment&quot;, payment_id]</code>],
          ]}
        />
      </>
    ),
  },
  {
    slug: "sdk",
    group: "Reference",
    title: "SDK reference",
    description: "The @unslept/sdk and unslept (Python) surface.",
    body: (
      <>
        <CodeBlock
          filename="types.ts"
          code={`new Unslept({
  agent,          // agent account address (base58)
  signer,         // Keypair, or a wallet with publicKey and signTransaction
  network,        // "solana" | "solana-devnet"
  rpcUrl?,        // defaults to the public RPC
  chain?,         // custom UnsleptChain implementation (tests)
  onPayment?,     // called after every settled payment
})

unslept.fetch(input, init?, { maxAmount? })   // Response
unslept.getBalances()                           // { liquid, working, debt, net }
unslept.getPolicy()                             // { perCallCap, dailyCap, remainingToday, allowlist, paused, revoked }
unslept.getPayments({ limit? })                 // on-chain history from Settled events
unslept.localPayments()                         // payments made by this instance
unslept.onLowBalance(cb, { threshold, intervalMs? })`}
        />
        <p>
          Lower level helpers are exported too: <code>createSolanaChain</code> and <code>agentAddress</code> from{" "}
          <code>@unslept/sdk/solana</code>, and account decoders from <code>@unslept/sdk</code>. The Python package mirrors
          the same surface with snake_case names.
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
            [<code key="7">INSUFFICIENT_COLLATERAL</code>, "The agent's liquid USDC and Kamino position cannot cover the payment. Fund it."],
            [<code key="8">INSUFFICIENT_BUFFER_LIQUIDITY</code>, "The buffer cannot front this payment right now. Retry shortly."],
            [<code key="9">NO_MATCHING_REQUIREMENT</code>, "The server does not offer unslept-direct in USDC on this Solana cluster."],
            [<code key="10">SETTLEMENT_FAILED</code>, "The transaction failed or the server rejected the proof. The message has details."],
            [<code key="11">CONFIG</code>, "A setting is missing or wrong, such as an address or environment variable."],
          ]}
        />
      </>
    ),
  },
];

export function findDoc(slug: string) {
  return docs.find((d) => d.slug === slug);
}
