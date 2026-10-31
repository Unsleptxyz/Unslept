import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { RevealObserver } from "@/components/Reveal";
import {
  Audiences,
  BuiltWith,
  Clock,
  Closing,
  Developers,
  Faq,
  Hero,
  HowItWorks,
  Problem,
  Security,
  Stats,
  StatsSkeleton,
  Token,
} from "@/components/landing/Sections";
import { chain, site, token } from "@/lib/config";
import { getNetworkStats } from "@/lib/stats";

export const revalidate = 30;

async function LiveStats() {
  const stats = await getNetworkStats();
  return <Stats stats={stats} />;
}

export default function Home() {
  return (
    <>
      <SiteHeader docsUrl={site.docsUrl} />
      <main id="main" className="landing">
        <Hero docsUrl={site.docsUrl} />
        <BuiltWith />
        <Problem />
        <HowItWorks />
        <Clock />
        <Audiences docsUrl={site.docsUrl} />
        <Developers docsUrl={site.docsUrl} siteUrl={site.url} />
        <Suspense fallback={<StatsSkeleton />}>
          <LiveStats />
        </Suspense>
        <Security />
        <Token address={token.address} ponsUrl={token.ponsUrl} explorerUrl={chain.explorerUrl} />
        <Faq docsUrl={site.docsUrl} />
        <Closing docsUrl={site.docsUrl} />
      </main>
      <SiteFooter docsUrl={site.docsUrl} githubUrl={site.githubUrl} xUrl={site.xUrl} />
      <RevealObserver />
    </>
  );
}
