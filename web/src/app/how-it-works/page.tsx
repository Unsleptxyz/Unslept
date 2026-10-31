import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { RevealObserver } from "@/components/Reveal";
import { Audiences, Clock, Faq, HowItWorks } from "@/components/landing/Sections";
import { PageCta, SubpageHero } from "@/components/landing/Pages";
import { site } from "@/lib/config";

export const metadata: Metadata = {
  title: "How it works",
  description: "How Unslept keeps agent money ready to pay and working at the same time: park, pay, rebalance, earn.",
};

export default function HowItWorksPage() {
  return (
    <>
      <SiteHeader docsUrl={site.docsUrl} active="/how-it-works" />
      <main id="main">
        <SubpageHero
          id="page-title"
          eyebrow="How it works"
          title={
            <>
              Ready to pay. <em>Working while it waits.</em>
            </>
          }
          lede="Unslept separates the two jobs that usually fight each other. A shared USDG buffer pays every x402 request the instant it is due; each agent's idle balance sits in a tokenized savings position and repays the buffer in the background."
          actions={
            <>
              <a className="btn btn--primary btn--large" href="/app">
                Launch app
              </a>
              <a className="btn btn--ghost btn--large" href={`${site.docsUrl}/concepts`}>
                Read the concepts
              </a>
            </>
          }
        />
        <HowItWorks />
        <Clock />
        <Audiences docsUrl={site.docsUrl} />
        <Faq docsUrl={site.docsUrl} />
        <PageCta next={{ href: "/developers", label: "For developers" }} />
      </main>
      <SiteFooter docsUrl={site.docsUrl} githubUrl={site.githubUrl} xUrl={site.xUrl} />
      <RevealObserver />
    </>
  );
}
