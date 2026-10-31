import type { Metadata } from "next";
import { LongformPage } from "@/components/PageShell";
import { ContactLine, Summary } from "@/components/content/Blocks";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <LongformPage
      eyebrow="Trust"
      title="Terms of service"
      updated="31 October 2026"
      intro={<p className="lede">These terms explain what Unslept is, what you agree to when you use it, and where responsibility lies. They are written to be read, not skimmed past. If anything is unclear, ask before you deposit.</p>}
      summary={
        <Summary
          items={[
            "Unslept is non-custodial software. You keep your keys; we cannot move, freeze or recover your funds.",
            "The contracts are live without a completed audit, with deposits capped at 50,000 USDG. Use only what you can afford to lose.",
            "There is no identity verification. You are responsible for using Unslept lawfully where you live.",
            "Fees are set on chain within fixed bounds and change only through a 24-hour timelock.",
            "The software is provided as is, and our liability is limited as far as the law allows.",
          ]}
        />
      }
    >

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

        <h2>3. Agent accounts</h2>
        <p>
          An agent account is a smart contract you create and own. You choose a signer key for your agent and a spending
          policy: a per-call cap, a daily cap, and the payees or domains the agent may pay. The account contract enforces the
          policy on every payment. The signer can only request payments within it and can never withdraw.
        </p>
        <p>
          You are responsible for the policy you set and for every payment your agent makes within it. Payments that settle on
          chain are final; we cannot reverse them. You can pause the agent, revoke its signer, unwind parked funds and withdraw
          at any time.
        </p>

        <h2>4. Buffer deposits</h2>
        <p>
          When you deposit USDG into the buffer you receive vault shares. The buffer uses deposits to settle agent payments
          and earns the settlement fee and, on its parked part, the variable rate of the underlying asset. The value of your
          shares can go up or down, including because of agent debt that cannot be recovered.
        </p>
        <p>
          Withdrawals are instant while liquidity allows. When utilization is high they are queued and paid in order as
          liquidity returns. There is no promised rate and no promised withdrawal time.
        </p>

        <h2>5. Guarded launch</h2>
        <p>
          The contracts are deployed on mainnet without a completed third-party security audit. During this period total
          deposits are capped at 50,000 USDG and each tokenized asset has its own cap. Use only amounts you can afford to
          lose entirely. The caps and the audit status may change through the timelock; this page and the risk disclosure
          will be updated when they do.
        </p>

        <h2>6. Eligibility</h2>
        <p>
          You must be at least 18 years old and legally able to enter into these terms. Unslept does not perform identity
          verification. You alone are responsible for making sure that using the interface, holding USDG and gaining
          exposure to tokenized assets is lawful where you live. The interface may refuse access from certain countries
          based on your approximate location. Do not use the interface if you are subject to sanctions or located in a
          country where its use is prohibited, and do not try to get around location restrictions.
        </p>

        <h2>7. Risks</h2>
        <p>
          The <a className="text-link" href="/risk">risk disclosure</a> is part of these terms. In short: yield is variable
          and not guaranteed and can be zero; smart contracts can fail; USDG, the tokenized assets and their issuers, Spark,
          oracles and Robinhood Chain itself are outside our control; and withdrawals can be delayed when the buffer is in
          use. Nothing on this website is investment, legal or tax advice.
        </p>

        <h2>8. Fees</h2>
        <p>
          Instant settlement from the buffer charges a fee on each payment, paid to buffer depositors. The current rate is
          shown in the app and read from the chain. The rate can only change within the bounds set in the FeeModule
          contract, and only through the 24-hour timelock. Network gas fees are paid separately to Robinhood Chain.
        </p>

        <h2>9. Your responsibilities</h2>
        <ul>
          <li>Keep your wallet keys and your agents&apos; signing keys safe. Anyone with them can act within the policies you set.</li>
          <li>Set spending policies that match what you are willing to lose if an agent misbehaves.</li>
          <li>Check transactions before you sign them.</li>
          <li>Pay any taxes that apply to you.</li>
        </ul>

        <h2>10. Prohibited use</h2>
        <p>You agree not to use the interface to:</p>
        <ul>
          <li>break any law or sanctions rule, or move proceeds of crime;</li>
          <li>attack, exploit or overload the contracts, the website or its infrastructure, outside a responsible disclosure;</li>
          <li>pay for content or services that are illegal where you or the payee are;</li>
          <li>mislead others about your relationship with Unslept.</li>
        </ul>
        <p>
          If you find a vulnerability, report it privately through the contact in section 17 rather than exploiting it.
        </p>

        <h2>11. $UNSLEPT</h2>
        <p>
          $UNSLEPT is a token launched on Pons. Holding it does not give you a share of a company, a claim on protocol
          revenue unless a deployed contract says so, or any promise of value. Its price can fall to zero.
        </p>

        <h2>12. Open source and third parties</h2>
        <p>
          The Unslept SDKs and MCP server are published under the MIT license, and the source of every deployed contract is verified on chain. The interface links to and
          depends on third-party services, including Robinhood Chain, Paxos (USDG), Spark, Pons, block explorers, wallet
          software and hosting providers. Their terms apply to your use of them, and we are not responsible for them.
        </p>

        <h2>13. No warranty</h2>
        <p>
          The interface and the software are provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind,
          including fitness for a particular purpose, availability, accuracy of displayed data, or that the contracts are
          free of bugs.
        </p>

        <h2>14. Limitation of liability</h2>
        <p>
          To the fullest extent the law allows, we are not liable for any loss of funds, profits, data or opportunity, or
          for any indirect or consequential loss, arising from your use of the interface, the contracts, or any third-party
          service, including losses caused by bugs, exploits, oracle failures, depegs, chain outages or admin actions taken
          through the timelock. Where liability cannot be excluded, it is limited to the extent the law allows.
        </p>

        <h2>15. Ending access</h2>
        <p>
          We may change, suspend or stop the website or the demo endpoints at any time. This does not affect the contracts
          already on chain: you can always interact with them directly, including to withdraw, subject to their rules.
        </p>

        <h2>16. Changes to these terms</h2>
        <p>
          We may update these terms. The date at the top shows the current version, and the change history is kept in the
          project repository. If you keep using the interface after a change, the new terms apply.
        </p>

        <h2>17. Contact</h2>
        <p>
          <ContactLine />
        </p>
    </LongformPage>
  );
}
