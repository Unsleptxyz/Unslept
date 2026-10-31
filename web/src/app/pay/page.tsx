import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { RevealObserver } from "@/components/Reveal";
import { PageCta, SubpageHero } from "@/components/landing/Pages";
import { CodeTabs, type CodeTab } from "@/components/landing/CodeTabs";
import { CopyCommand } from "@/components/landing/Interactive";
import { site } from "@/lib/config";

export const metadata: Metadata = {
  title: "Unslept Pay",
  description: "Accept x402 payments in USDG on Robinhood Chain. Put a price on any endpoint and let AI agents pay per request.",
};

const tabs: CodeTab[] = [
  {
    label: "Next.js",
    filename: "app/api/quote/route.ts",
    code: `import { createPaywall } from "@unslept/pay";

const paywall = createPaywall({
  payTo: process.env.PAY_TO!,          // your wallet on Robinhood Chain
  price: 10_000n,                      // 0.01 USDG per request
  secret: process.env.PAYWALL_SECRET!, // 16+ characters
  description: "Live quote for one ticker",
});

export const GET = paywall.protect(async (request, payment) => {
  return Response.json({ price: 101.25, paidBy: payment.payer });
});`,
  },
  {
    label: "Express",
    filename: "server.ts",
    code: `import express from "express";
import { createPaywall } from "@unslept/pay";
import { expressPaywall } from "@unslept/pay/express";

const paywall = createPaywall({
  payTo: process.env.PAY_TO!,
  price: 10_000n,
  secret: process.env.PAYWALL_SECRET!,
});

const app = express();
app.get("/quote", expressPaywall(paywall), (req, res) => {
  res.json({ price: 101.25 });
});`,
  },
  {
    label: "Hono",
    filename: "index.ts",
    code: `import { Hono } from "hono";
import { createPaywall } from "@unslept/pay";

const paywall = createPaywall({
  payTo: process.env.PAY_TO!,
  price: 10_000n,
  secret: process.env.PAYWALL_SECRET!,
});

const app = new Hono();
app.get("/quote", (c) =>
  paywall.protect(async () => Response.json({ price: 101.25 }))(c.req.raw),
);`,
  },
];

const steps = [
  { t: "Install", b: "Add @unslept/pay to the API you already run. No account, no API key and no dashboard to set up." },
  { t: "Set a price", b: "Choose a price per request in USDG and the wallet that receives it. Wrap the route." },
  { t: "Agents pay", b: "Agents get a 402 with your price, settle on Robinhood Chain and retry. The package verifies the settlement on chain before your code runs." },
  { t: "Get listed", b: "Submit the endpoint to the x402 Directory so agent developers can find it and copy a working snippet." },
];

const facts = [
  ["Settlement", "USDG on Robinhood Chain, paid straight to your wallet"],
  ["Protocol", "x402 v2: PAYMENT-REQUIRED, PAYMENT-SIGNATURE, PAYMENT-RESPONSE"],
  ["Verification", "Settled event from the Unslept SettlementRouter, checked per request"],
  ["Replay protection", "Signed, expiring payment IDs; each transaction accepted once"],
  ["Fees for providers", "None. The paying agent covers the settlement fee"],
  ["License", "MIT, open source"],
];

export default function PayPage() {
  return (
    <>
      <SiteHeader docsUrl={site.docsUrl} active="/pay" />
      <main id="main">
        <SubpageHero
          id="pay-title"
          eyebrow="Unslept Pay"
          title={
            <>
              Charge AI agents <em>per request.</em>
            </>
          }
          lede="Put a USDG price on any endpoint in a few lines. Agents running Unslept pay on Robinhood Chain and your handler runs only after the payment is verified on chain. The money lands in your wallet, not ours."
          actions={
            <>
              <a className="btn btn--primary btn--large" href="#code">
                See the code
              </a>
              <a className="btn btn--ghost btn--large" href="/directory#list">
                List your API
              </a>
            </>
          }
        />
        <section className="section" aria-labelledby="pay-steps-title">
          <div className="container">
            <header className="section-head" data-reveal>
              <p className="eyebrow">How it works</p>
              <h2 id="pay-steps-title" className="display section-title">
                From free endpoint to <em>paid endpoint.</em>
              </h2>
            </header>
            <ol className="pay-steps">
              {steps.map((s, i) => (
                <li key={s.t} className="card pay-step" data-reveal style={{ ["--reveal-i" as string]: i }}>
                  <span className="how__num num">0{i + 1}</span>
                  <h3>{s.t}</h3>
                  <p>{s.b}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="section" id="code" aria-labelledby="pay-code-title">
          <div className="container pay-code">
            <header className="section-head" data-reveal>
              <p className="eyebrow">Integrate</p>
              <h2 id="pay-code-title" className="display section-title">
                A paywall in <em>twelve lines.</em>
              </h2>
              <p className="lede">Works with any Fetch-style handler and with Express. Node 20 or later.</p>
              <CopyCommand label="npm" command="npm install @unslept/pay viem" />
            </header>
            <div data-reveal>
              <CodeTabs tabs={tabs} />
            </div>
          </div>
        </section>
        <section className="section" aria-labelledby="pay-facts-title">
          <div className="container">
            <header className="section-head" data-reveal>
              <p className="eyebrow">The details</p>
              <h2 id="pay-facts-title" className="display section-title">
                What you get, <em>exactly.</em>
              </h2>
            </header>
            <dl className="pay-facts" data-reveal>
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
        <PageCta next={{ href: "/directory", label: "Open the directory" }} />
      </main>
      <SiteFooter docsUrl={site.docsUrl} githubUrl={site.githubUrl} xUrl={site.xUrl} />
      <RevealObserver />
    </>
  );
}
