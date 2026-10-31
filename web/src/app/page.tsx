import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { RevealObserver } from "@/components/Reveal";
import { BuiltWith, Closing, Hero, Problem, Stats, StatsSkeleton } from "@/components/landing/Sections";
import { Explore } from "@/components/landing/Pages";
import { AgentsAtWork } from "@/components/landing/AgentsAtWork";
import { site } from "@/lib/config";
import { getNetworkStats } from "@/lib/stats";

export const revalidate = 30;

async function LiveStats() {
  const stats = await getNetworkStats();
  return <Stats stats={stats} />;
}

export default function Home() {
  return (
    <>
      <SiteHeader docsUrl={site.docsUrl} active="/" />
      <main id="main" className="landing">
        <Hero docsUrl={site.docsUrl} />
        <BuiltWith />
        <AgentsAtWork />
        <Problem />
        <Explore />
        <Suspense fallback={<StatsSkeleton />}>
          <LiveStats />
        </Suspense>
        <Closing docsUrl={site.docsUrl} />
      </main>
      <SiteFooter docsUrl={site.docsUrl} githubUrl={site.githubUrl} xUrl={site.xUrl} />
      <RevealObserver />
    </>
  );
}
