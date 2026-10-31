import { SiteFooter, SiteHeader } from "../src/components/SiteChrome";
import { Audiences, Developers, Faq, Hero, HowItWorks, Problem, Security, Stats, Token, Waitlist, type NetworkStats } from "../src/components/landing/Sections";

export function Landing({ stats }: { stats: NetworkStats }) {
  return (
    <>
      <SiteHeader docsUrl="/docs" />
      <main id="main">
        <Hero docsUrl="/docs" />
        <Problem />
        <HowItWorks />
        <Audiences docsUrl="/docs" />
        <Developers docsUrl="/docs" />
        <Stats stats={stats} />
        <Waitlist />
        <Token />
        <Security />
        <Faq />
      </main>
      <SiteFooter docsUrl="/docs" />
    </>
  );
}
