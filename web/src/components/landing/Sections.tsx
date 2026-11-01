import type { ReactNode } from "react";
import { MoneyClock } from "./MoneyClock";
import { CodeTabs, type CodeTab } from "./CodeTabs";
import { NightCity } from "./NightCity";
import { CopyCommand, CountUp } from "./Interactive";
import {
  IconBolt,
  IconCheckFile,
  IconClock,
  IconCode,
  IconKey,
  IconLayers,
  IconPark,
  IconPulse,
  IconRefresh,
  IconShield,
  IconSliders,
  IconWallet,
} from "./Icons";

function SectionHead({ eyebrow, title, lede, id, align = "left" }: { eyebrow: string; title: ReactNode; lede?: ReactNode; id: string; align?: "left" | "center" }) {
  return (
    <header className={`section-head section-head--${align}`} data-reveal>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="display section-title">
        {title}
      </h2>
      {lede ? <p className="lede">{lede}</p> : null}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

export function Hero({ docsUrl }: { docsUrl: string }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <NightCity />
      <div className="hero__inner">
        <h1 id="hero-title" className="display hero__title">
          Your agent&apos;s money, <em>unslept.</em>
        </h1>
        <p className="hero__sub">
          AI agents keep cash waiting between payments. Unslept puts that balance to work on Kamino and settles
          every x402 payment the instant it is due, from a shared USDC buffer. The agent never waits for its money.
        </p>
        <div className="hero__actions">
          <a className="btn btn--primary btn--large" href="/app">
            Launch app
          </a>
          <a className="btn btn--ghost btn--large" href={`${docsUrl}/quickstart`}>
            Read the quickstart
          </a>
        </div>
        <ul className="hero__facts" aria-label="Highlights">
          <li>
            <IconBolt />
            Settles in one transaction
          </li>
          <li>
            <IconSliders />
            Spending limits enforced on chain
          </li>
          <li>
            <IconKey />
            Non-custodial agent accounts
          </li>
        </ul>
      </div>
      <a className="hero__scroll" href="#problem" aria-label="Scroll to learn more">
        <span />
      </a>
    </section>
  );
}

export function BuiltWith() {
  const items = ["Solana", "USDC by Circle", "Kamino Lend", "x402", "Anchor", "Kamino", "MCP"];
  return (
    <section className="built" aria-label="Built with">
      <p className="built__label">Built on open standards</p>
      <div className="built__track">
        <ul className="built__list">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        <ul className="built__list" aria-hidden="true">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Problem                                                             */
/* ------------------------------------------------------------------ */

export function Problem() {
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const paid = new Set([3, 9, 10, 16, 21]);
  return (
    <section id="problem" className="section problem" aria-labelledby="problem-title">
      <div className="container problem__grid">
        <SectionHead
          id="problem-title"
          eyebrow="The problem"
          title={
            <>
              Most agent money spends its life <em>asleep.</em>
            </>
          }
          lede="Agents pay for data, tools and compute per request through x402. To do that, they keep balances on hand. Those balances wait for hours between payments and earn nothing while they wait. Across thousands of agents, that is a lot of capital doing nothing."
        />
        <figure className="card day-card" data-reveal>
          <figcaption className="day-card__title">
            <span>One agent wallet, one day</span>
            <span className="muted small num">00:00 to 24:00</span>
          </figcaption>
          <div className="day-row">
            <p className="day-row__label">Ordinary wallet</p>
            <div className="day-row__bar" aria-hidden="true">
              {hours.map((h) => (
                <span key={h} className={paid.has(h) ? "day-cell day-cell--pay" : "day-cell"} />
              ))}
            </div>
            <p className="day-row__note">Brief moments of spending, long stretches of waiting.</p>
          </div>
          <div className="day-row">
            <p className="day-row__label">With Unslept</p>
            <div className="day-row__bar day-row__bar--working" aria-hidden="true">
              {hours.map((h) => (
                <span key={h} className={paid.has(h) ? "day-cell day-cell--pay" : "day-cell day-cell--work"} />
              ))}
            </div>
            <p className="day-row__note">Between payments the balance sits in a Kamino lending position. Payments still settle at once.</p>
          </div>
          <div className="day-card__legend" aria-hidden="true">
            <span>
              <i className="day-cell day-cell--pay" /> Payment
            </span>
            <span>
              <i className="day-cell" /> Idle
            </span>
            <span>
              <i className="day-cell day-cell--work" /> Working
            </span>
          </div>
        </figure>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

const steps = [
  {
    icon: <IconPark />,
    title: "Park",
    body: "Owners supply an agent's idle USDC to the Kamino Main Market USDC reserve, a lending position on Solana, and keep a little liquid for payments. It stays theirs and can be redeemed at any time.",
  },
  {
    icon: <IconBolt />,
    title: "Pay",
    body: "When an API answers 402, the SDK checks the agent's on-chain policy and the Unslept program pays at once from the buffer, in a single Solana transaction. The agent never waits for a position to be redeemed.",
  },
  {
    icon: <IconRefresh />,
    title: "Rebalance",
    body: "The agent repays the buffer in the same transaction from its liquid USDC. Any rest is repaid when its Kamino position is redeemed, and can only settle that same agent's debt.",
  },
  {
    icon: <IconLayers />,
    title: "Earn",
    body: "Depositors supply the USDC that settles payments. They earn the settlement fee agents pay on every payment. The rate is variable and can fall to zero.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section how" aria-labelledby="how-title">
      <div className="container">
        <SectionHead
          id="how-title"
          eyebrow="How it works"
          title={
            <>
              Four steps, <em>always on.</em>
            </>
          }
          lede="Unslept separates two jobs that usually fight each other: keeping money ready to pay, and keeping money working. The buffer does the first, Kamino does the second."
        />
        <ol className="how__steps">
          {steps.map((s, i) => (
            <li key={s.title} className="card how__step" data-reveal style={{ ["--reveal-i" as string]: i }}>
              <div className="how__top">
                <span className="how__icon">{s.icon}</span>
                <span className="how__num num">0{i + 1}</span>
              </div>
              <h3 className="how__title">{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="flow card" data-reveal>
          <FlowDiagram />
        </div>
      </div>
    </section>
  );
}

function FlowDiagram() {
  return (
    <svg viewBox="0 0 1000 220" className="flow__svg" role="img" aria-labelledby="flow-title flow-desc">
      <title id="flow-title">Payment flow</title>
      <desc id="flow-desc">
        The agent asks its account to pay. The buffer pays the API at once. Later, the agent&apos;s
        Kamino position repays the buffer.
      </desc>
      <g className="flow__edges">
        <path id="e1" d="M170 110 H330" />
        <path id="e2" d="M470 110 H630" />
        <path id="e3" d="M770 110 H860" />
        <path id="e5" d="M400 160 C 400 200, 700 200, 700 160" className="flow__edge--slow" />
      </g>
      <g className="flow__pulses">
        <circle r="5">
          <animateMotion dur="2.6s" repeatCount="indefinite" path="M170 110 H330" />
        </circle>
        <circle r="5">
          <animateMotion dur="2.6s" begin="0.9s" repeatCount="indefinite" path="M470 110 H630" />
        </circle>
        <circle r="5">
          <animateMotion dur="2.6s" begin="1.7s" repeatCount="indefinite" path="M770 110 H860" />
        </circle>
        <circle r="4" className="flow__pulse--slow">
          <animateMotion dur="5s" begin="0.4s" repeatCount="indefinite" path="M700 160 C 700 200, 400 200, 400 160" />
        </circle>
      </g>
      <g className="flow__nodes">
        <g transform="translate(40 75)">
          <rect width="130" height="70" rx="16" />
          <text x="65" y="32">AI agent</text>
          <text x="65" y="52" className="flow__sub">
            SDK or MCP
          </text>
        </g>
        <g transform="translate(330 60)">
          <rect width="140" height="100" rx="16" />
          <text x="70" y="44">Agent account</text>
          <text x="70" y="64" className="flow__sub">
            policy on chain
          </text>
        </g>
        <g transform="translate(630 60)" className="flow__node--lamp">
          <rect width="140" height="100" rx="16" />
          <text x="70" y="44">USDC buffer</text>
          <text x="70" y="64" className="flow__sub">
            pays at once
          </text>
        </g>
        <g transform="translate(860 75)">
          <rect width="110" height="70" rx="16" />
          <text x="55" y="32">Paid API</text>
          <text x="55" y="52" className="flow__sub">
            x402
          </text>
        </g>
      </g>
      <text x="550" y="212" className="flow__caption">
        the Kamino position repays the buffer in the background
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Money clock                                                         */
/* ------------------------------------------------------------------ */

export function Clock() {
  return (
    <section className="section clock" aria-labelledby="clock-title">
      <div className="container clock__grid">
        <div className="clock__visual" data-reveal>
          <MoneyClock />
        </div>
        <div className="clock__copy">
          <SectionHead
            id="clock-title"
            eyebrow="The money clock"
            title={
              <>
                Every hour counts, <em>including the quiet ones.</em>
              </>
            }
            lede="An agent might pay twice in a morning and then wait until the next day. With Unslept, the waiting hours are working hours too. The lit arc never breaks."
          />
          <ul className="clock__points" data-reveal>
            <li>
              <strong>Liquid when it matters.</strong> The buffer fronts the payment, so a balance working in Kamino never makes a call fail.
            </li>
            <li>
              <strong>Working when it does not.</strong> Between payments the balance earns the variable rate of the underlying asset.
            </li>
            <li>
              <strong>Yours throughout.</strong> Owners can pause, revoke or withdraw at any time, including while funds are in Kamino.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Audiences                                                           */
/* ------------------------------------------------------------------ */

export function Audiences({ docsUrl }: { docsUrl: string }) {
  const cards = [
    {
      icon: <IconCode />,
      title: "Agent builders",
      body: "Give each agent its own account with a per-call cap, a daily cap and an allowlist of APIs it may pay. Fund it once; the balance works between calls and payments never fail for lack of liquidity.",
      href: "/app/agents",
      cta: "Create an agent account",
    },
    {
      icon: <IconWallet />,
      title: "Buffer depositors",
      body: "Supply the USDC that settles agent payments and earn from real activity: the settlement fee plus the buffer's share of payment activity. No agent required. The rate is variable.",
      href: "/app/buffer",
      cta: "Deposit to the buffer",
    },
    {
      icon: <IconLayers />,
      title: "Platforms and API sellers",
      body: "Plug any framework in through the SDK or MCP server, or accept x402 payments yourself with the sample endpoint. Project treasuries can park idle funds the same way.",
      href: `${docsUrl}/x402`,
      cta: "Accept x402 payments",
    },
  ];
  return (
    <section className="section audiences" aria-labelledby="audiences-title">
      <div className="container">
        <SectionHead
          id="audiences-title"
          eyebrow="Who it is for"
          title={
            <>
              Built for everyone <em>in the payment.</em>
            </>
          }
        />
        <div className="audiences__grid">
          {cards.map((c, i) => (
            <article key={c.title} className="card audience" data-reveal style={{ ["--reveal-i" as string]: i }}>
              <span className="audience__icon">{c.icon}</span>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              <a className="arrow-link" href={c.href}>
                {c.cta}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Developers                                                          */
/* ------------------------------------------------------------------ */

const sdkCode = `import { Unslept } from "@unslept/sdk";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const unslept = new Unslept({
  agent: process.env.UNSLEPT_AGENT,
  signer: Keypair.fromSecretKey(bs58.decode(process.env.UNSLEPT_SIGNER_KEY)),
  network: "solana",
});

// A drop-in fetch. On 402 it checks the policy, settles, and retries.
const res = await unslept.fetch("https://api.example.com/data", undefined, {
  maxAmount: 50_000n, // 0.05 USDC, never more for this call
});`;

const pyCode = `import os
from solders.keypair import Keypair
from unslept import Unslept

unslept = Unslept(
    agent=os.environ["UNSLEPT_AGENT"],
    signer=Keypair.from_base58_string(os.environ["UNSLEPT_SIGNER_KEY"]),
    network="solana",
)

res = unslept.fetch("https://api.example.com/data")
print(res.status, res.text())`;

const mcpCode = `{
  "mcpServers": {
    "unslept": {
      "command": "npx",
      "args": ["-y", "@unslept/mcp"],
      "env": {
        "UNSLEPT_AGENT": "<your agent account address>",
        "UNSLEPT_SIGNER_KEY": "<agent signer key, from your secret store>",
        "UNSLEPT_NETWORK": "solana"
      }
    }
  }
}`;

const tabs: CodeTab[] = [
  { label: "TypeScript", filename: "agent.ts", code: sdkCode },
  { label: "Python", filename: "agent.py", code: pyCode },
  { label: "MCP", filename: "mcp.json", code: mcpCode },
];

export function Developers({ docsUrl, siteUrl, head = true }: { docsUrl: string; siteUrl?: string; head?: boolean }) {
  const demo = `${(siteUrl ?? "").replace(/\/$/, "")}/api/demo/x402`;
  return (
    <section id="developers" className="section developers" aria-labelledby="dev-title">
      <div className="container developers__grid">
        <div className="developers__intro">
          {head ? (
          <SectionHead
            id="dev-title"
            eyebrow="For developers"
            title={
              <>
                One call to stop paying from <em>a sleeping wallet.</em>
              </>
            }
            lede="Wrap the fetch your agent already makes. When a server answers 402, the SDK checks your spending policy, settles from the buffer and retries with the payment attached."
          />
          ) : null}
          <div className="developers__installs" data-reveal>
            <CopyCommand command="npm install @unslept/sdk @solana/web3.js" label="TypeScript" />
            <CopyCommand command='pip install "unslept[solana]"' label="Python" />
            <CopyCommand command="npx -y @unslept/mcp" label="MCP" />
          </div>
          <div className="demo-callout card" data-reveal>
            <p className="demo-callout__title">
              <span className="badge badge--lamp">Live</span> Try a real paid endpoint
            </p>
            <p className="muted small">
              The demo endpoint asks for 0.01 USDC on mainnet and answers with live protocol stats once the payment settles.
            </p>
            <code className="demo-callout__code">GET {demo || "/api/demo/x402"}</code>
            <a className="arrow-link" href={`${docsUrl}/x402`}>
              How x402 works with Unslept
            </a>
          </div>
        </div>
        <div className="developers__code" data-reveal>
          <CodeTabs tabs={tabs} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Live network stats                                                  */
/* ------------------------------------------------------------------ */

export type NetworkStats =
  | { status: "prelaunch" }
  | { status: "error" }
  | {
      status: "live";
      totalValueWorkingUsd: number;
      paymentsSettled: number;
      connectedAgents: number;
      bufferRateBps: number | null;
    };

const statDefs = [
  { key: "tvw", label: "Total value working" },
  { key: "paid", label: "x402 payments settled" },
  { key: "agents", label: "Agent accounts" },
  { key: "rate", label: "Buffer rate, variable" },
] as const;

function StatsShell({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <section className="section stats" aria-labelledby="stats-title">
      <div className="container">
        <SectionHead
          id="stats-title"
          eyebrow="On chain, right now"
          title={
            <>
              The network, <em>live.</em>
            </>
          }
        />
        {children}
        {note}
      </div>
    </section>
  );
}

export function StatsSkeleton() {
  return (
    <StatsShell>
      <dl className="stats__grid" aria-busy="true">
        {statDefs.map((d) => (
          <div key={d.key} className="card stat">
            <dt>{d.label}</dt>
            <dd>
              <span className="skeleton" aria-hidden="true" />
              <span className="sr-only">Loading</span>
            </dd>
          </div>
        ))}
      </dl>
    </StatsShell>
  );
}

export function Stats({ stats }: { stats: NetworkStats }) {
  if (stats.status === "live") {
    return (
      <StatsShell
        note={
          <p className="stats__note">
            Read from the Unslept program by the indexer every few minutes. Rates are variable and change with utilization.{" "}
            <a className="text-link" href="/docs/contracts">
              See the program
            </a>
          </p>
        }
      >
        <dl className="stats__grid">
          <div className="card stat" data-reveal>
            <dt>{statDefs[0].label}</dt>
            <dd className="num stat__value">
              <CountUp value={stats.totalValueWorkingUsd} format="usd" />
            </dd>
          </div>
          <div className="card stat" data-reveal style={{ ["--reveal-i" as string]: 1 }}>
            <dt>{statDefs[1].label}</dt>
            <dd className="num stat__value">
              <CountUp value={stats.paymentsSettled} format="int" />
            </dd>
          </div>
          <div className="card stat" data-reveal style={{ ["--reveal-i" as string]: 2 }}>
            <dt>{statDefs[2].label}</dt>
            <dd className="num stat__value">
              <CountUp value={stats.connectedAgents} format="int" />
            </dd>
          </div>
          <div className="card stat" data-reveal style={{ ["--reveal-i" as string]: 3 }}>
            <dt>{statDefs[3].label}</dt>
            <dd className="num stat__value stat__value--yield">
              {stats.bufferRateBps === null ? <span className="stat__pending">Not enough history yet</span> : <CountUp value={stats.bufferRateBps / 100} format="pct" />}
            </dd>
          </div>
        </dl>
      </StatsShell>
    );
  }

  const message =
    stats.status === "error"
      ? "The indexer did not respond. Stats return as soon as it is reachable again."
      : "Stats read from the Unslept program on Solana as soon as the indexer reports them.";

  return (
    <StatsShell note={<p className="stats__note">{message}</p>}>
      <dl className="stats__grid">
        {statDefs.map((d) => (
          <div key={d.key} className="card stat">
            <dt>{d.label}</dt>
            <dd className="num stat__value stat__value--empty">
              <span aria-hidden="true">--</span>
              <span className="sr-only">Not available</span>
            </dd>
          </div>
        ))}
      </dl>
    </StatsShell>
  );
}

/* ------------------------------------------------------------------ */
/* Security                                                            */
/* ------------------------------------------------------------------ */

export function Security({ head = true }: { head?: boolean }) {
  const facts = [
    { icon: <IconShield />, title: "Guarded launch", body: "Not yet audited by a third party. Until an audit is published, total buffer deposits are capped at 50,000 USDC by the program." },
    { icon: <IconClock />, title: "24-hour delay", body: "Every parameter change, from the fee to the deposit cap, is proposed on-chain a full day before it can take effect. Anyone can watch it coming." },
    { icon: <IconCheckFile />, title: "Open source", body: "The Solana program, SDKs and tests are public on GitHub, including a test suite that runs against the real Kamino program and reserve copied from mainnet." },
    { icon: <IconSliders />, title: "Policies on chain", body: "Per-call caps, daily caps and payee allowlists are checked by the Unslept program itself, not by the SDK or a server." },
    { icon: <IconKey />, title: "Owner always exits", body: "Each agent has its own account in the program. The owner can pause, revoke, redeem and withdraw at any time. Unslept never holds your keys." },
    { icon: <IconPulse />, title: "Watched around the clock", body: "Buffer health, liquidity, outstanding debt and pending parameter changes are checked every 15 minutes, with alerts on anything new." },
  ];
  return (
    <section id="security" className="section security" aria-labelledby="security-title">
      <div className="container">
        {head ? (
          <SectionHead
          id="security-title"
          eyebrow="Security"
          title={
            <>
              Safeguards, <em>stated plainly.</em>
            </>
          }
          lede="No marketing language about safety. These are the controls that exist today, and the risks that remain."
        />
        ) : null}
        <div className="security__grid">
          {facts.map((f, i) => (
            <article key={f.title} className="card security__item" data-reveal style={{ ["--reveal-i" as string]: i % 3 }}>
              <span className="security__icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
        <aside className="risk-band" data-reveal>
          <div>
            <h3>Risks you take</h3>
            <p>
              Smart contract bugs, loss of value in a lending market, a depeg of USDC, slower withdrawals when the buffer is
              heavily used, and rules that limit access where you live. You can lose money.
            </p>
          </div>
          <a className="btn btn--ghost" href="/risk">
            Read the risk disclosure
          </a>
        </aside>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Token                                                               */
/* ------------------------------------------------------------------ */

export function Token({ address, launchUrl, head = true }: { address?: string; launchUrl?: string; explorerUrl?: string; head?: boolean }) {
  return (
    <section id="token" className="section token" aria-labelledby="token-title">
      <div className="container">
        <div className="card token__card" data-reveal>
          <div className="token__glow" aria-hidden="true" />
          <div className="token__head" hidden={!head}>
            <p className="eyebrow">The protocol token</p>
            <h2 id="token-title" className="display section-title">
              $UNSLEPT
            </h2>
            <p className="lede">It lives on Solana. It is planned to do what is listed here and nothing more.</p>
          </div>
          <dl className="token__facts">
            <div>
              <dt>Ticker</dt>
              <dd>$UNSLEPT</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>
                {launchUrl ? (
                  <a className="text-link" href={launchUrl} rel="noopener noreferrer" target="_blank">
                    Solana
                  </a>
                ) : (
                  "Solana"
                )}
              </dd>
            </div>
            <div className="token__contract">
              <dt>Mint</dt>
              <dd className="num">
                {address ? (
                  <a className="text-link" href={`https://solscan.io/token/${address}`} rel="noopener noreferrer" target="_blank">
                    {address}
                  </a>
                ) : (
                  "Published on official Unslept channels only. Always check the address before you trade."
                )}
              </dd>
            </div>
          </dl>
          <ul className="token__uses">
            <li>
              <h3>Fee discounts</h3>
              <p>Lower instant-settlement fees for agents, tiered by the amount held or staked.</p>
            </li>
            <li>
              <h3>Staker buffer tier</h3>
              <p>Stakers can deposit into a higher-fee buffer tier. Its rate is variable like every other tier.</p>
            </li>
            <li>
              <h3>Governance signaling</h3>
              <p>Signal which yield venues and caps the protocol supports. Advisory until a formal process exists.</p>
            </li>
          </ul>
          <p className="token__legal">
            $UNSLEPT is not an investment and carries no claim on protocol revenue. Any fee sharing with holders is pending
            legal review and is not live.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

const faqs: { q: string; a: ReactNode }[] = [
  {
    q: "What is x402?",
    a: "An open payment standard built on the HTTP 402 Payment Required status code. A server answers a request with 402 and its price. The client pays and retries the same request with a proof attached. It lets agents pay for APIs, data and compute per request, without accounts or API keys.",
  },
  {
    q: "Where does the yield come from?",
    a: "From two places. Idle balances sit in Kamino Lend, whose rate is set by Kamino borrowers and changes over time. Buffer depositors also receive the small instant-settlement fee that agents pay. Both move with market conditions, so the rate is variable and can be zero.",
  },
  {
    q: "What happens if the buffer runs low?",
    a: "Payments larger than the free buffer liquidity fail cleanly with a clear error, and nothing is lost. Agents repay their debts from their own liquid USDC and Kamino positions. Depositor withdrawals are available up to the free liquidity and the rest returns as agents repay.",
  },
  {
    q: "Can Unslept move my funds?",
    a: "No one can take funds out of your agent account except you. The keeper can only redeem an agent's Kamino position to repay that agent's own debt, and the agent key can only pay within your caps and allowlist. Parameter changes wait 24 hours on-chain.",
  },
  {
    q: "Is my deposit at risk?",
    a: (
      <>
        Yes. Deposits carry program risk, lending market risk, USDC depeg risk, liquidity risk and regulatory risk,
        and the program is not yet audited. Read the{" "}
        <a className="text-link" href="/risk">
          risk disclosure
        </a>{" "}
        before depositing anything.
      </>
    ),
  },
  {
    q: "Do I need to verify my identity?",
    a: "No. Unslept does not ask for identity documents. Access may be limited from some countries where the law requires it. You are responsible for making sure using Unslept is allowed where you live.",
  },
  {
    q: "Which agent frameworks work?",
    a: "Any agent that makes HTTP requests. The TypeScript and Python SDKs wrap fetch, the Python SDK includes a LangChain tool, and the MCP server works with any MCP client. That covers OpenClaw, Virtuals, LangChain, CrewAI and custom stacks.",
  },
];

export function Faq({ docsUrl }: { docsUrl: string }) {
  return (
    <section className="section faq" aria-labelledby="faq-title">
      <div className="container faq__grid">
        <div className="faq__intro">
          <SectionHead
            id="faq-title"
            eyebrow="Questions"
            title={
              <>
                Asked, <em>answered.</em>
              </>
            }
          />
          <p className="muted" data-reveal>
            Something missing? The{" "}
            <a className="text-link" href={docsUrl}>
              docs
            </a>{" "}
            cover every part of the protocol in detail.
          </p>
        </div>
        <div className="faq__list" data-reveal>
          {faqs.map((f) => (
            <details key={f.q} className="faq__item">
              <summary>
                <span>{f.q}</span>
                <span className="faq__icon" aria-hidden="true" />
              </summary>
              <div className="faq__answer">
                <p>{f.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Closing call to action and updates                                  */
/* ------------------------------------------------------------------ */

export function Closing({ docsUrl }: { docsUrl: string }) {
  return (
    <section id="updates" className="section closing" aria-labelledby="closing-title">
      <div className="container">
        <div className="closing__panel card" data-reveal>
          <div className="closing__copy">
            <h2 id="closing-title" className="display section-title">
              Put idle agent money <em>to work.</em>
            </h2>
            <p className="lede">Create an agent account in a few minutes, or deposit to the buffer and supply the liquidity that settles payments.</p>
            <div className="hero__actions">
              <a className="btn btn--primary btn--large" href="/app">
                Launch app
              </a>
              <a className="btn btn--ghost btn--large" href={docsUrl}>
                Explore the docs
              </a>
            </div>
          </div>
          <form className="closing__form" method="post" action="/api/waitlist">
            <p className="closing__form-title">Release notes and the $UNSLEPT launch, by email</p>
            <div className="field">
              <label htmlFor="wl-email">Email</label>
              <input id="wl-email" name="email" type="email" required autoComplete="email" inputMode="email" maxLength={254} placeholder="you@example.com" />
            </div>
            <div className="field">
              <label htmlFor="wl-wallet">
                Wallet address <span className="field__optional">(optional)</span>
              </label>
              <input id="wl-wallet" name="wallet" type="text" autoComplete="off" spellCheck={false} pattern="^[1-9A-HJ-NP-Za-km-z]{32,44}$" placeholder="Solana address" aria-describedby="wl-wallet-hint" />
              <p id="wl-wallet-hint" className="field__hint">
                A Solana address (base58).
              </p>
            </div>
            <div className="field field--trap" aria-hidden="true">
              <label htmlFor="wl-company">Company</label>
              <input id="wl-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <button type="submit" className="btn btn--primary">
              Keep me posted
            </button>
            <p className="field__hint">We only write about releases, and we never share your address.</p>
          </form>
        </div>
      </div>
    </section>
  );
}
