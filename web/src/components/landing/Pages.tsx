import type { ReactNode } from "react";
import { IconBolt, IconCode, IconLayers, IconShield } from "./Icons";

/** Title block at the top of each marketing page (How it works, Developers, Security, $UNSLEPT). */
export function SubpageHero({
  eyebrow,
  title,
  lede,
  id,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  lede: ReactNode;
  id: string;
  actions?: ReactNode;
}) {
  return (
    <section className="subhero" aria-labelledby={id}>
      <div className="subhero__sky" aria-hidden="true">
        <div className="subhero__glow" />
        <div className="subhero__grid" />
      </div>
      <div className="container subhero__inner">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id={id} className="display subhero__title">
          {title}
        </h1>
        <p className="lede subhero__lede">{lede}</p>
        {actions ? <div className="hero__actions subhero__actions">{actions}</div> : null}
      </div>
    </section>
  );
}

const explore = [
  {
    href: "/how-it-works",
    icon: <IconBolt />,
    eyebrow: "Product",
    title: "How it works",
    body: "Park, pay, rebalance, earn: the four steps that keep agent money ready to pay and working at the same time.",
  },
  {
    href: "/directory",
    icon: <IconLayers />,
    eyebrow: "Discover",
    title: "x402 Directory",
    body: "Paid APIs that accept USDG on Robinhood Chain, checked automatically, with a snippet your agent can run as is.",
  },
  {
    href: "/pay",
    icon: <IconBolt />,
    eyebrow: "Earn",
    title: "Unslept Pay",
    body: "Charge AI agents per request. A few lines in your API, USDG straight to your wallet, no provider fees.",
  },
  {
    href: "/developers",
    icon: <IconCode />,
    eyebrow: "Build",
    title: "Developers",
    body: "One fetch call in TypeScript or Python, an MCP server for any client, and a live paid endpoint to test against.",
  },
  {
    href: "/security",
    icon: <IconShield />,
    eyebrow: "Trust",
    title: "Security",
    body: "Caps, a 24-hour timelock, on-chain spending policies and verified source. Plus the risks that remain.",
  },
  {
    href: "/token",
    icon: <IconLayers />,
    eyebrow: "Token",
    title: "$UNSLEPT",
    body: "The protocol token on Pons: fee discounts, a staker buffer tier and governance signaling. Nothing more.",
  },
];

/** Home page cards that lead to each dedicated page. */
export function Explore() {
  return (
    <section className="section explore" aria-labelledby="explore-title">
      <div className="container">
        <header className="section-head" data-reveal>
          <p className="eyebrow">Explore</p>
          <h2 id="explore-title" className="display section-title">
            Go deeper, <em>one page at a time.</em>
          </h2>
        </header>
        <div className="explore__grid">
          {explore.map((e, i) => (
            <a key={e.href} href={e.href} className="card explore__card" data-reveal style={{ ["--reveal-i" as string]: i }}>
              <span className="explore__top">
                <span className="how__icon">{e.icon}</span>
                <span className="explore__eyebrow">{e.eyebrow}</span>
              </span>
              <span className="explore__title">{e.title}</span>
              <span className="explore__body">{e.body}</span>
              <span className="arrow-link explore__cta">Open</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Closing band on dedicated pages: one primary action and a pointer to the next page. */
export function PageCta({ next }: { next?: { href: string; label: string } }) {
  return (
    <section className="section page-cta" aria-label="Next steps">
      <div className="container">
        <div className="card page-cta__panel" data-reveal>
          <div>
            <h2 className="display page-cta__title">
              Put idle agent money <em>to work.</em>
            </h2>
            <p className="muted">Create an agent account in a few minutes, or supply the liquidity that settles payments.</p>
          </div>
          <div className="page-cta__actions">
            <a className="btn btn--primary btn--large" href="/app">
              Launch app
            </a>
            {next ? (
              <a className="btn btn--ghost btn--large" href={next.href}>
                {next.label}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
