import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { RevealObserver } from "@/components/Reveal";
import { Developers } from "@/components/landing/Sections";
import { PageCta, SubpageHero } from "@/components/landing/Pages";
import { site } from "@/lib/config";

export const metadata: Metadata = {
  title: "Developers",
  description: "Pay x402 requests from an Unslept agent account with the TypeScript SDK, the Python SDK or the MCP server.",
};

const resources = [
  { href: "/docs/quickstart", title: "Quickstart", body: "From an empty wallet to a first paid request, in five steps." },
  { href: "/docs/quickstart-typescript", title: "TypeScript agent", body: "Configuration, error handling and low-balance alerts." },
  { href: "/docs/quickstart-langchain", title: "LangChain and CrewAI", body: "A ready-made tool that pays within the agent's policy." },
  { href: "/docs/mcp", title: "MCP server", body: "Let any MCP client pay x402 requests from its own account." },
  { href: "/docs/x402", title: "Accept x402 payments", body: "Verify unslept-direct payments in your own API." },
  { href: "/docs/sdk", title: "SDK reference", body: "Every method, option and error code." },
];

export default function DevelopersPage() {
  return (
    <>
      <SiteHeader docsUrl={site.docsUrl} active="/developers" />
      <main id="main">
        <SubpageHero
          id="dev-title"
          eyebrow="For developers"
          title={
            <>
              One call to stop paying from <em>a sleeping wallet.</em>
            </>
          }
          lede="Wrap the fetch your agent already makes. When a server answers 402, the SDK checks your spending policy, settles from the buffer and retries with the payment attached. Published on npm and PyPI under the MIT license."
          actions={
            <>
              <a className="btn btn--primary btn--large" href={`${site.docsUrl}/quickstart`}>
                Read the quickstart
              </a>
              <a className="btn btn--ghost btn--large" href="/app/developers">
                Get your environment
              </a>
            </>
          }
        />
        <Developers docsUrl={site.docsUrl} siteUrl={site.url} head={false} />
        <section className="section resources" aria-labelledby="resources-title">
          <div className="container">
            <header className="section-head" data-reveal>
              <p className="eyebrow">Guides</p>
              <h2 id="resources-title" className="display section-title">
                Everything you need, <em>in the docs.</em>
              </h2>
            </header>
            <div className="resources__grid">
              {resources.map((r, i) => (
                <a key={r.href} href={r.href} className="card resource" data-reveal style={{ ["--reveal-i" as string]: i % 3 }}>
                  <span className="resource__title">{r.title}</span>
                  <span className="resource__body">{r.body}</span>
                  <span className="arrow-link">Read</span>
                </a>
              ))}
            </div>
          </div>
        </section>
        <PageCta next={{ href: "/security", label: "How it is secured" }} />
      </main>
      <SiteFooter docsUrl={site.docsUrl} githubUrl={site.githubUrl} xUrl={site.xUrl} />
      <RevealObserver />
    </>
  );
}
