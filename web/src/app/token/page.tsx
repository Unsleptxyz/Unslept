import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { RevealObserver } from "@/components/Reveal";
import { Token } from "@/components/landing/Sections";
import { PageCta, SubpageHero } from "@/components/landing/Pages";
import { chain, site, token } from "@/lib/config";

export const metadata: Metadata = {
  title: "$UNSLEPT",
  description: "$UNSLEPT, the Unslept protocol token on Pons: fee discounts, a staker buffer tier and governance signaling.",
};

export default function TokenPage() {
  return (
    <>
      <SiteHeader docsUrl={site.docsUrl} active="/token" />
      <main id="main">
        <SubpageHero
          id="token-page-title"
          eyebrow="The protocol token"
          title={
            <>
              $UNSLEPT, <em>plainly.</em>
            </>
          }
          lede="The protocol token launches on Pons, on Robinhood Chain. It does what is listed on this page and nothing more. It is not an investment, and it carries no claim on protocol revenue."
          actions={
            token.ponsUrl ? (
              <a className="btn btn--primary btn--large" href={token.ponsUrl} rel="noopener noreferrer" target="_blank">
                View on Pons
              </a>
            ) : undefined
          }
        />
        <Token address={token.address} ponsUrl={token.ponsUrl} explorerUrl={chain.explorerUrl} head={false} />
        <PageCta next={{ href: "/how-it-works", label: "How Unslept works" }} />
      </main>
      <SiteFooter docsUrl={site.docsUrl} githubUrl={site.githubUrl} xUrl={site.xUrl} />
      <RevealObserver />
    </>
  );
}
