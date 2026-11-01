import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { RevealObserver } from "@/components/Reveal";
import { Security } from "@/components/landing/Sections";
import { PageCta, SubpageHero } from "@/components/landing/Pages";
import { site } from "@/lib/config";

export const metadata: Metadata = {
  title: "Security",
  description: "The safeguards that protect Unslept today, and the risks that remain.",
};

const roles: [string, string][] = [
  ["Account owner", "Your wallet. Sets the policy, adds payees, funds, moves USDC into and out of Kamino, withdraws, pauses and revokes."],
  ["Agent signer", "Your agent's key. Can only request payments within the policy, and can never withdraw."],
  ["Keeper", "Redeems an agent's Kamino position to repay that agent's own debt. Cannot send funds anywhere else."],
  ["Admin", "Proposes parameter changes that wait 24 hours on-chain, so each one is public a full day before it takes effect."],
  ["Anyone", "Can trigger debt repayment from an agent's liquid USDC, which only repays what is already owed."],
];

export default function SecurityPage() {
  return (
    <>
      <SiteHeader docsUrl={site.docsUrl} active="/security" />
      <main id="main">
        <SubpageHero
          id="security-title"
          eyebrow="Security"
          title={
            <>
              Safeguards, <em>stated plainly.</em>
            </>
          }
          lede="No marketing language about safety. These are the controls that exist today, who can do what, and the risks that remain. Unslept is in a guarded launch and has not completed a third-party audit."
          actions={
            <>
              <a className="btn btn--primary btn--large" href="/risk">
                Read the risk disclosure
              </a>
              <a className="btn btn--ghost btn--large" href={`${site.docsUrl}/security`}>
                Security model in the docs
              </a>
            </>
          }
        />
        <Security head={false} />
        <section className="section roles" aria-labelledby="roles-title">
          <div className="container">
            <header className="section-head" data-reveal>
              <p className="eyebrow">Permissions</p>
              <h2 id="roles-title" className="display section-title">
                Who can do <em>what.</em>
              </h2>
              <p className="lede">Every role is narrow by design. The keys your agents run with can spend within limits you set, and nothing else.</p>
            </header>
            <dl className="roles__list" data-reveal>
              {roles.map(([k, v]) => (
                <div key={k} className="roles__row">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
        <PageCta next={{ href: "/token", label: "About $UNSLEPT" }} />
      </main>
      <SiteFooter docsUrl={site.docsUrl} githubUrl={site.githubUrl} xUrl={site.xUrl} />
      <RevealObserver />
    </>
  );
}
