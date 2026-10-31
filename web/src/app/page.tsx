import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import {
  Audiences,
  Developers,
  Faq,
  Hero,
  HowItWorks,
  Problem,
  Security,
  Stats,
  StatsSkeleton,
  Token,
  Waitlist,
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
      <main id="main">
        <Hero docsUrl={site.docsUrl} />
        <Problem />
        <HowItWorks />
        <Audiences docsUrl={site.docsUrl} />
        <Developers docsUrl={site.docsUrl} />
        <Suspense fallback={<StatsSkeleton />}>
          <LiveStats />
        </Suspense>
        <Waitlist />
        <Token address={token.address} ponsUrl={token.ponsUrl} explorerUrl={chain.explorerUrl} />
        <Security />
        <Faq />
      </main>
      <SiteFooter docsUrl={site.docsUrl} githubUrl={site.githubUrl} xUrl={site.xUrl} />
    </>
  );
}
