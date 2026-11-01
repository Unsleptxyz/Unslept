import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { RevealObserver } from "@/components/Reveal";
import { PageCta, SubpageHero } from "@/components/landing/Pages";
import { DirectoryBrowser } from "@/components/directory/DirectoryBrowser";
import { SubmitForm } from "@/components/directory/SubmitForm";
import { CATEGORIES, listDirectory } from "@/lib/directory";
import { site } from "@/lib/config";

export const metadata: Metadata = {
  title: "x402 Directory",
  description: "Paid APIs that accept USDC on Solana through x402. Every listing is checked automatically, so an Unslept agent can pay it.",
};

export const revalidate = 60;

export default async function DirectoryPage() {
  const entries = await listDirectory();
  const online = entries.filter((e) => e.online).length;
  return (
    <>
      <SiteHeader docsUrl={site.docsUrl} active="/directory" />
      <main id="main">
        <SubpageHero
          id="directory-title"
          eyebrow="x402 Directory"
          title={
            <>
              Paid APIs your agent <em>can call today.</em>
            </>
          }
          lede="Every endpoint here answers HTTP 402 with a USDC price on Solana, and is checked again every few hours. Pick one, copy the snippet, and your Unslept agent pays per call within its spending policy."
          actions={
            <>
              <a className="btn btn--primary btn--large" href="#list">
                List your API
              </a>
              <a className="btn btn--ghost btn--large" href="/pay">
                Accept x402 payments
              </a>
            </>
          }
        />
        <section className="section dir-section" aria-label="Directory">
          <div className="container">
            <dl className="dir-stats" data-reveal>
              <div>
                <dt>Endpoints listed</dt>
                <dd className="num">{entries.length}</dd>
              </div>
              <div>
                <dt>Online now</dt>
                <dd className="num">{online}</dd>
              </div>
              <div>
                <dt>Network</dt>
                <dd>Solana, USDC</dd>
              </div>
            </dl>
            <DirectoryBrowser entries={entries} categories={CATEGORIES} />
          </div>
        </section>
        <section className="section" id="list" aria-labelledby="list-title">
          <div className="container dir-list-grid">
            <header className="section-head" data-reveal>
              <p className="eyebrow">For API providers</p>
              <h2 id="list-title" className="display section-title">
                List your endpoint <em>in one step.</em>
              </h2>
              <p className="lede">
                Listing is free. Community listings appear as soon as the automatic check passes. Verified listings are reviewed
                by the Unslept team. Endpoints that stop answering are hidden after repeated failed checks.
              </p>
              <a className="arrow-link" href="/pay">
                Not charging yet? Add x402 to your API with Unslept Pay
              </a>
            </header>
            <SubmitForm categories={CATEGORIES} />
          </div>
        </section>
        <PageCta next={{ href: "/templates", label: "Agent templates" }} />
      </main>
      <SiteFooter docsUrl={site.docsUrl} githubUrl={site.githubUrl} xUrl={site.xUrl} />
      <RevealObserver />
    </>
  );
}
