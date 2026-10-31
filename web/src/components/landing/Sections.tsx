import type { ReactNode } from "react";
import { MoneyClock } from "./MoneyClock";
import { CodeTabs, type CodeTab } from "./CodeTabs";

/* ------------------------------------------------------------------ */
/* 1. Hero                                                             */
/* ------------------------------------------------------------------ */

export function Hero({ docsUrl }: { docsUrl: string }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__copy">
        <h1 id="hero-title" className="display hero__title">
          Your money, unslept.
        </h1>
        <p className="hero__sub">
          Every AI agent holds idle cash between payments. Unslept keeps it working in tokenized assets on Robinhood
          Chain and releases it the instant an x402 payment is due.
        </p>
        <div className="hero__actions">
          <a className="btn btn--primary" href="/app">
            Launch app
          </a>
          <a className="btn btn--ghost" href={docsUrl}>
            Read the docs
          </a>
        </div>
      </div>
      <div className="hero__clock">
        <MoneyClock />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Problem                                                          */
/* ------------------------------------------------------------------ */

export function Problem() {
  return (
    <section className="section problem" aria-labelledby="problem-title">
      <div className="problem__grid">
        <h2 id="problem-title" className="display section-title problem__title">
          Agent money spends most of its life asleep.
        </h2>
        <p className="problem__body lede">
          Agents pay for data, tools and compute through x402. To do it, they keep balances waiting. Waiting balances
          earn nothing, and across thousands of agents that adds up to a lot of capital doing nothing.
        </p>
      </div>
      <div className="sleep-strip" aria-hidden="true">
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className={h % 9 === 4 ? "sleep-strip__hour sleep-strip__hour--paid" : "sleep-strip__hour"} />
        ))}
      </div>
      <p className="sleep-strip__caption">
        A typical agent balance across a day: brief moments of spending, long stretches of waiting.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. How it works                                                     */
/* ------------------------------------------------------------------ */

type Node = "Agent wallet" | "Tokenized asset" | "Buffer" | "x402 payee" | "Depositor";

const steps: { title: string; body: string; from: Node; to: Node; back?: boolean }[] = [
  {
    title: "Park",
    body: "Agent balances are automatically allocated into low-risk tokenized assets available on Robinhood Chain, for example a short-duration treasury or money-market style instrument, where available in your jurisdiction.",
    from: "Agent wallet",
    to: "Tokenized asset",
  },
  {
    title: "Pay",
    body: "When the agent hits an x402 paywall, Unslept settles the payment immediately from a shared liquidity buffer, so the agent never waits and never fails a call.",
    from: "Buffer",
    to: "x402 payee",
  },
  {
    title: "Rebalance",
    body: "The buffer is refilled from the agent's parked position in the background.",
    from: "Tokenized asset",
    to: "Buffer",
  },
  {
    title: "Earn",
    body: "Anyone can deposit USDG into the buffer and earn a share of the underlying asset yield plus a small instant-settlement fee paid by agents.",
    from: "Depositor",
    to: "Buffer",
    back: true,
  },
];

function FlowLine({ from, to, back }: { from: Node; to: Node; back?: boolean }) {
  return (
    <svg viewBox="0 0 320 48" className="flow-line" role="img" aria-label={`Funds move from ${from} to ${to}${back ? ", and yield returns" : ""}`}>
      <circle cx="10" cy="24" r="6" className="flow-line__node" />
      <circle cx="310" cy="24" r="6" className="flow-line__node flow-line__node--to" />
      <line x1="22" y1="24" x2="292" y2="24" className="flow-line__track" />
      <line x1="22" y1="24" x2="292" y2="24" className="flow-line__flow" />
      <path d="M 286 18 L 296 24 L 286 30" className="flow-line__head" />
      {back ? <path d="M 292 38 C 220 46, 100 46, 24 38" className="flow-line__return" /> : null}
    </svg>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section how" aria-labelledby="how-title">
      <h2 id="how-title" className="display section-title">
        How it works
      </h2>
      <ol className="how__steps">
        {steps.map((s, i) => (
          <li key={s.title} className="how__step">
            <span className="how__num num" aria-hidden="true">
              {i + 1}
            </span>
            <div className="how__content">
              <h3 className="how__title">{s.title}</h3>
              <p>{s.body}</p>
              <div className="how__flow">
                <span className="how__node">{s.from}</span>
                <FlowLine from={s.from} to={s.to} back={s.back} />
                <span className="how__node how__node--to">{s.to}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Audiences                                                        */
/* ------------------------------------------------------------------ */

export function Audiences({ docsUrl }: { docsUrl: string }) {
  return (
    <section className="section audiences" aria-labelledby="audiences-title">
      <h2 id="audiences-title" className="display section-title">
        Built for three kinds of people
      </h2>
      <div className="audiences__grid">
        <article className="audience audience--primary">
          <h3 className="audience__title">Agent builders</h3>
          <p>
            Agent builders and operators get operating balances that earn while they wait, and payments that never
            fail for lack of liquidity. Spending policies stay on-chain and under your control.
          </p>
          <a className="btn btn--primary" href="/app/agents">
            Connect an agent
          </a>
        </article>
        <article className="audience audience--secondary">
          <h3 className="audience__title">Depositors</h3>
          <p>
            Fund the liquidity buffer and earn from real agent activity. No agent required. The rate is variable.
          </p>
          <a className="text-link" href="/app/buffer">
            Deposit to the buffer
          </a>
        </article>
        <article className="audience audience--tertiary">
          <h3 className="audience__title">Projects and platforms</h3>
          <p>
            Any agent framework can plug in through the SDK or MCP: OpenClaw, Virtuals, LangChain, CrewAI or a
            custom stack. Project treasuries can park idle funds the same way.
          </p>
          <a className="text-link" href={`${docsUrl}/sdk`}>
            Integrate the SDK
          </a>
        </article>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Developers                                                       */
/* ------------------------------------------------------------------ */

const sdkCode = `import { Unslept } from "@unslept/sdk";

const unslept = new Unslept({
  agentAccount: process.env.UNSLEPT_AGENT_ACCOUNT,
  signer: agentSigner,
  network: "robinhood-chain",
});

// Drop-in replacement for fetch. Pays x402 paywalls from a balance that is always working.
const res = await unslept.fetch("https://api.example.com/data");`;

const mcpCode = `{
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
}`;

const tabs: CodeTab[] = [
  { label: "TypeScript SDK", filename: "agent.ts", code: sdkCode },
  { label: "MCP server", filename: "mcp.json", code: mcpCode },
];

export function Developers({ docsUrl }: { docsUrl: string }) {
  return (
    <section id="developers" className="section developers" aria-labelledby="dev-title">
      <div className="developers__intro">
        <h2 id="dev-title" className="display section-title">
          One line to stop paying from a sleeping wallet.
        </h2>
        <p className="lede">
          Wrap the fetch call your agent already makes. When a server answers 402, the SDK checks your spending
          policy, settles from the buffer and retries with the payment attached.
        </p>
        <ul className="developers__facts">
          <li>
            Methods: <code>fetch</code>, <code>getBalances</code>, <code>getPolicy</code>, <code>setPolicy</code>,{" "}
            <code>getPayments</code>, <code>onLowBalance</code>
          </li>
          <li>MCP tools: pay_x402_request, get_balances, get_payment_history, get_policy</li>
          <li>Python SDK with a LangChain tool wrapper</li>
        </ul>
        <p className="developers__status">The TypeScript SDK, Python SDK and MCP server ship with the first public release.</p>
        <a className="text-link" href={`${docsUrl}/quickstart`}>
          Read the quickstart
        </a>
      </div>
      <CodeTabs tabs={tabs} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Live network stats                                               */
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
  { key: "agents", label: "Connected agents" },
  { key: "rate", label: "Buffer rate (variable)" },
] as const;

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});
const count = new Intl.NumberFormat("en-US");

function StatsShell({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <section className="section stats" aria-labelledby="stats-title">
      <h2 id="stats-title" className="display section-title">
        Live network stats
      </h2>
      {children}
      {note}
    </section>
  );
}

export function StatsSkeleton() {
  return (
    <StatsShell>
      <dl className="stats__grid" aria-busy="true">
        {statDefs.map((d) => (
          <div key={d.key} className="stat">
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
    const values: Record<(typeof statDefs)[number]["key"], string> = {
      tvw: compactUsd.format(stats.totalValueWorkingUsd),
      paid: count.format(stats.paymentsSettled),
      agents: count.format(stats.connectedAgents),
      rate: stats.bufferRateBps === null ? "Not enough history" : `${(stats.bufferRateBps / 100).toFixed(2)}%`,
    };
    return (
      <StatsShell
        note={<p className="stats__note">Read from protocol contracts through the indexer. Rates are variable and change with utilization.</p>}
      >
        <dl className="stats__grid">
          {statDefs.map((d) => (
            <div key={d.key} className="stat">
              <dt>{d.label}</dt>
              <dd className={d.key === "rate" ? "num stat__value stat__value--yield" : "num stat__value"}>{values[d.key]}</dd>
            </div>
          ))}
        </dl>
      </StatsShell>
    );
  }

  const message =
    stats.status === "error"
      ? "The indexer did not respond. Stats will return when it is reachable again."
      : "Nothing is live yet. These numbers read from the protocol contracts on Robinhood Chain as soon as they are deployed.";

  return (
    <StatsShell>
      <div className="stats__empty">
        <dl className="stats__grid stats__grid--empty">
          {statDefs.map((d) => (
            <div key={d.key} className="stat">
              <dt>{d.label}</dt>
              <dd className="num stat__value stat__value--empty">
                <span aria-hidden="true">--</span>
                <span className="sr-only">Not available yet</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="stats__empty-msg">{message}</p>
        <a className="btn btn--ghost" href="#waitlist">
          Join the waitlist
        </a>
      </div>
    </StatsShell>
  );
}

/* ------------------------------------------------------------------ */
/* Waitlist (Phase 1)                                                  */
/* ------------------------------------------------------------------ */

export function Waitlist() {
  return (
    <section id="waitlist" className="section waitlist" aria-labelledby="waitlist-title">
      <div className="waitlist__panel">
        <div className="waitlist__copy">
          <h2 id="waitlist-title" className="display section-title">
            Get early access
          </h2>
          <p>
            Leave an email and, if you have one, the wallet you plan to use. We write when the app opens.
            Nothing else.
          </p>
        </div>
        <form className="waitlist__form" method="post" action="/api/waitlist">
          <div className="field">
            <label htmlFor="wl-email">Email</label>
            <input id="wl-email" name="email" type="email" required autoComplete="email" inputMode="email" maxLength={254} />
          </div>
          <div className="field">
            <label htmlFor="wl-wallet">
              Wallet address <span className="field__optional">(optional)</span>
            </label>
            <input
              id="wl-wallet"
              name="wallet"
              type="text"
              autoComplete="off"
              spellCheck={false}
              pattern="^0x[a-fA-F0-9]{40}$"
              placeholder="0x..."
              aria-describedby="wl-wallet-hint"
            />
            <p id="wl-wallet-hint" className="field__hint">
              An EVM address: 0x followed by 40 hexadecimal characters.
            </p>
          </div>
          <div className="field field--trap" aria-hidden="true">
            <label htmlFor="wl-company">Company</label>
            <input id="wl-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
          </div>
          <button type="submit" className="btn btn--primary">
            Join the waitlist
          </button>
        </form>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 7. $UNSLEPT                                                         */
/* ------------------------------------------------------------------ */

export function Token({ address, ponsUrl, explorerUrl }: { address?: string; ponsUrl?: string; explorerUrl?: string }) {
  return (
    <section id="token" className="section token" aria-labelledby="token-title">
      <div className="token__head">
        <h2 id="token-title" className="display section-title">
          $UNSLEPT
        </h2>
        <p className="lede">
          The protocol token. It launches on Pons, on Robinhood Chain. It does what is listed here and nothing more.
        </p>
      </div>
      <dl className="token__facts">
        <div>
          <dt>Ticker</dt>
          <dd>$UNSLEPT</dd>
        </div>
        <div>
          <dt>Launch venue</dt>
          <dd>{ponsUrl ? <a className="text-link" href={ponsUrl} rel="noopener noreferrer" target="_blank">Pons, Robinhood Chain</a> : "Pons, Robinhood Chain"}</dd>
        </div>
        <div>
          <dt>Contract</dt>
          <dd className="num token__address">
            {address ? (
              explorerUrl ? (
                <a className="text-link" href={`${explorerUrl.replace(/\/$/, "")}/address/${address}`} rel="noopener noreferrer" target="_blank">
                  {address}
                </a>
              ) : (
                address
              )
            ) : (
              "Not launched yet. The address will be published here and on official channels only."
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
          <p>Signal which tokenized assets and caps the protocol supports. Advisory until a formal governance process exists.</p>
        </li>
      </ul>
      <p className="token__legal">
        $UNSLEPT is not an investment and carries no claim on protocol revenue. Any form of fee sharing with holders is
        pending legal review and is not live.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 8. Security and risk                                                */
/* ------------------------------------------------------------------ */

export function Security() {
  return (
    <section className="section security" aria-labelledby="security-title">
      <h2 id="security-title" className="display section-title">
        Security and risk
      </h2>
      <div className="security__grid">
        <div className="security__item security__item--audit">
          <h3>Audits</h3>
          <p className="security__status">Not yet audited.</p>
          <p>
            An independent audit is planned. Until its report is published here, the buffer and every tokenized
            asset run under guarded deposit caps enforced by the contracts and the deployment script.
          </p>
        </div>
        <div className="security__item">
          <h3>Non-custodial</h3>
          <p>
            Each agent has its own smart account. The operator always keeps withdrawal rights, and Unslept never takes
            custody of agent funds.
          </p>
        </div>
        <div className="security__item">
          <h3>Spending policies</h3>
          <p>
            Per-call caps, daily caps and payee allowlists are enforced on-chain. Operators can pause or revoke an
            agent at any time.
          </p>
        </div>
        <div className="security__item">
          <h3>Protocol safeguards</h3>
          <p>
            Emergency pause, parameter changes behind a 24-hour timelock, oracle staleness checks, per-asset caps, and a solvency
            invariant that keeps the buffer above pending settlements.
          </p>
        </div>
      </div>
      <div className="risk-summary">
        <h3>Risks you take</h3>
        <p>
          Smart contract bugs, loss of value in a tokenized asset, a depeg of USDG, slower withdrawals when the buffer
          is heavily used, and regulatory changes that limit access. You can lose money.
        </p>
        <a className="text-link" href="/risk">
          Read the full risk disclosure
        </a>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 9. FAQ                                                              */
/* ------------------------------------------------------------------ */

const faqs: { q: string; a: ReactNode }[] = [
  {
    q: "What is x402?",
    a: (
      <>
        x402 is an open payment standard built on the HTTP 402 Payment Required status code. A server answers a
        request with 402 and its payment requirements. The client signs a payment and retries the same request with it
        attached, and a facilitator verifies and settles the payment on-chain. It lets agents pay for APIs, data and
        compute per request, without accounts or API keys.
      </>
    ),
  },
  {
    q: "Where does the yield come from?",
    a: (
      <>
        From two sources. First, the tokenized assets that idle balances are allocated into, such as short-duration
        treasury or money-market style instruments where available. Second, the small instant-settlement fee agents
        pay when the buffer settles an x402 payment for them. Both change over time, so the rate is variable.
      </>
    ),
  },
  {
    q: "Is my deposit at risk?",
    a: (
      <>
        Yes. Deposits are exposed to smart contract risk, tokenized asset risk, USDG depeg risk, liquidity risk
        (withdrawals can queue when utilization is high) and regulatory risk. The contracts are not yet audited.{" "}
        <a className="text-link" href="/risk">
          Read the risk disclosure
        </a>{" "}
        before depositing anything.
      </>
    ),
  },
  {
    q: "Which countries are supported?",
    a: (
      <>
        Unslept does not ask for identity verification. Some jurisdictions may be blocked from using the app where the law
        requires it; you can always read the site and the docs. You are responsible for making sure using Unslept is
        allowed where you live.
      </>
    ),
  },
  {
    q: "Which agent frameworks work with Unslept?",
    a: (
      <>
        Any agent that makes HTTP requests. The TypeScript and Python SDKs wrap fetch, the Python SDK includes a
        LangChain tool, and the MCP server works with MCP-compatible clients. That covers OpenClaw, Virtuals,
        LangChain, CrewAI and custom stacks.
      </>
    ),
  },
  {
    q: "What is $UNSLEPT used for?",
    a: (
      <>
        Fee discounts on instant settlement, access to a higher-fee buffer tier for stakers, and advisory governance
        signaling on supported assets and caps. It is not an investment.
      </>
    ),
  },
];

export function Faq() {
  return (
    <section className="section faq" aria-labelledby="faq-title">
      <h2 id="faq-title" className="display section-title">
        Questions
      </h2>
      <div className="faq__list">
        {faqs.map((f) => (
          <details key={f.q} className="faq__item">
            <summary>{f.q}</summary>
            <div className="faq__answer">
              <p>{f.a}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
