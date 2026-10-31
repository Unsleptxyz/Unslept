import type { Metadata } from "next";
import { LegalReviewNotice, PageShell } from "@/components/PageShell";
import { site } from "@/lib/config";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  const contact = site.githubUrl ? `${site.githubUrl.replace(/\/$/, "")}/issues` : undefined;
  return (
    <PageShell>
      <article className="prose-page">
        <h1 className="display">Terms of service</h1>
        <p className="page-intro">Last updated: 31 October 2026.</p>
        <LegalReviewNotice />

        <h2>1. Who these terms cover</h2>
        <p>
          These terms apply to you when you use this website, the Unslept app, the Unslept SDKs, the MCP server or the demo
          endpoints (together, the interface). &quot;We&quot; means the contributors who operate this website and publish the
          Unslept software. By using the interface you accept these terms. If you do not accept them, do not use it.
        </p>

        <h2>2. What Unslept is</h2>
        <p>
          Unslept is software. The interface helps you create and use smart contracts on Robinhood Chain: agent accounts
          with spending policies, a shared USDG buffer that settles x402 payments, and adapters that place idle balances
          in tokenized assets. The interface is non-custodial. We never hold your keys or your funds, and we cannot move,
          freeze or recover them for you. Every action happens through a transaction you or your agent sign.
        </p>
        <p>
          Some contract parameters, such as fee rates within fixed bounds, deposit caps and adapter settings, can be changed
          by an admin role. Every such change goes through a 24-hour timelock on chain, so it is public before it takes
          effect. The admin can also pause the contracts in an emergency.
        </p>

        <h2>3. Guarded launch</h2>
        <p>
          The contracts are deployed on mainnet without a completed third-party security audit. During this period total
          deposits are capped at 50,000 USDG and each tokenized asset has its own cap. Use only amounts you can afford to
          lose entirely. The caps and the audit status may change through the timelock; this page and the risk disclosure
          will be updated when they do.
        </p>

        <h2>4. Eligibility</h2>
        <p>
          You must be at least 18 years old and legally able to enter into these terms. Unslept does not perform identity
          verification. You alone are responsible for making sure that using the interface, holding USDG and gaining
          exposure to tokenized assets is lawful where you live. The interface may refuse access from certain countries
          based on your approximate location. Do not use the interface if you are subject to sanctions or located in a
          country where its use is prohibited, and do not try to get around location restrictions.
        </p>

        <h2>5. Risks</h2>
        <p>
          The <a className="text-link" href="/risk">risk disclosure</a> is part of these terms. In short: yield is variable
          and not guaranteed and can be zero; smart contracts can fail; USDG, the tokenized assets and their issuers, Spark,
          oracles and Robinhood Chain itself are outside our control; and withdrawals can be delayed when the buffer is in
          use. Nothing on this website is investment, legal or tax advice.
        </p>

        <h2>6. Fees</h2>
        <p>
          Instant settlement from the buffer charges a fee on each payment, paid to buffer depositors. The current rate is
          shown in the app and read from the chain. The rate can only change within the bounds set in the FeeModule
          contract, and only through the 24-hour timelock. Network gas fees are paid separately to Robinhood Chain.
        </p>

        <h2>7. Your responsibilities</h2>
        <ul>
          <li>Keep your wallet keys and your agents&apos; signing keys safe. Anyone with them can act within the policies you set.</li>
          <li>Set spending policies that match what you are willing to lose if an agent misbehaves.</li>
          <li>Check transactions before you sign them.</li>
          <li>Pay any taxes that apply to you.</li>
        </ul>

        <h2>8. Prohibited use</h2>
        <p>You agree not to use the interface to:</p>
        <ul>
          <li>break any law or sanctions rule, or move proceeds of crime;</li>
          <li>attack, exploit or overload the contracts, the website or its infrastructure, outside a responsible disclosure;</li>
          <li>pay for content or services that are illegal where you or the payee are;</li>
          <li>mislead others about your relationship with Unslept.</li>
        </ul>
        <p>
          If you find a vulnerability, report it privately through the repository rather than exploiting it.
        </p>

        <h2>9. $UNSLEPT</h2>
        <p>
          $UNSLEPT is a token launched on Pons. Holding it does not give you a share of a company, a claim on protocol
          revenue unless a deployed contract says so, or any promise of value. Its price can fall to zero.
        </p>

        <h2>10. Open source and third parties</h2>
        <p>
          The Unslept software is published in a public repository. The interface links to and
          depends on third-party services, including Robinhood Chain, Paxos (USDG), Spark, Pons, block explorers, wallet
          software and hosting providers. Their terms apply to your use of them, and we are not responsible for them.
        </p>

        <h2>11. No warranty</h2>
        <p>
          The interface and the software are provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind,
          including fitness for a particular purpose, availability, accuracy of displayed data, or that the contracts are
          free of bugs.
        </p>

        <h2>12. Limitation of liability</h2>
        <p>
          To the fullest extent the law allows, we are not liable for any loss of funds, profits, data or opportunity, or
          for any indirect or consequential loss, arising from your use of the interface, the contracts, or any third-party
          service, including losses caused by bugs, exploits, oracle failures, depegs, chain outages or admin actions taken
          through the timelock. Where liability cannot be excluded, it is limited to the extent the law allows.
        </p>

        <h2>13. Ending access</h2>
        <p>
          We may change, suspend or stop the website or the demo endpoints at any time. This does not affect the contracts
          already on chain: you can always interact with them directly, including to withdraw, subject to their rules.
        </p>

        <h2>14. Changes to these terms</h2>
        <p>
          We may update these terms. The date at the top shows the current version, and the full history is public in the
          repository. If you keep using the interface after a change, the new terms apply.
        </p>

        <h2>15. Contact</h2>
        <p>
          {contact ? (
            <>
              Questions and reports go through the{" "}
              <a className="text-link" href={contact}>
                project&apos;s public issue tracker
              </a>
              . For security reports, use a private security advisory in the same repository.
            </>
          ) : (
            "Questions and reports go through the project's public repository."
          )}
        </p>
      </article>
    </PageShell>
  );
}
