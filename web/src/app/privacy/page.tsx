import type { Metadata } from "next";
import { LongformPage } from "@/components/PageShell";
import { ContactLine, Summary } from "@/components/content/Blocks";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LongformPage
      eyebrow="Trust"
      title="Privacy policy"
      updated="31 October 2026"
      intro={<p className="lede">Unslept collects as little as it can. This page lists exactly what is stored, why, where it lives, how long it is kept, and how to have it removed.</p>}
      summary={
        <Summary
          items={[
            "No accounts, no identity checks, no advertising trackers.",
            "We store only what you choose to give: a waitlist email, and webhook settings you register.",
            "Transactions on Robinhood Chain are public by design; we cannot hide or delete them.",
            "Vercel, Supabase and GitHub process data for us.",
            "You can ask to see, correct or delete your data at any time.",
          ]}
        />
      }
    >

        <h2>The short version</h2>
        <p>
          Unslept collects as little as it can. There are no accounts, no identity checks and no advertising trackers.
          The only personal data we store is what you choose to give us: a waitlist email, and webhook URLs you register.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Waitlist.</strong> Your email address, an optional wallet address, and the time you joined. We use them
            only to tell you about access to Unslept.
          </li>
          <li>
            <strong>Webhooks.</strong> If you register a webhook, we store your owner wallet address, the URL, the events you
            chose, your low-balance threshold and a signing secret, plus a record of each delivery attempt. We use them only
            to send you the alerts you asked for.
          </li>
          <li>
            <strong>Policy-violation reports.</strong> If your agent uses the SDK reporting option, the report (account,
            reason code, endpoint and time) is forwarded to your webhooks. We keep a delivery record, not the report body.
          </li>
          <li>
            <strong>Demo payments.</strong> When you pay the demo endpoint, we record the transaction hash, payment ID and
            paying account so each payment is used once. These are already public on chain.
          </li>
          <li>
            <strong>Server logs.</strong> Our hosting provider keeps short-lived request logs, which include IP addresses, to
            run and protect the service.
          </li>
        </ul>

        <h2>What we do not collect</h2>
        <p>
          We do not collect identity documents, names, phone numbers or private keys. Your approximate country, derived from
          your IP address by the hosting provider, is used at the moment of the request to apply jurisdiction rules and is
          not stored by us.
        </p>

        <h2>What is public by design</h2>
        <p>
          Transactions on Robinhood Chain, including deposits, withdrawals, agent account creation and agent payments, are
          public and permanent. Unslept indexes this public data to show protocol statistics. We cannot delete or hide it.
        </p>

        <h2>Processors</h2>
        <ul>
          <li>Vercel hosts the website and its server functions.</li>
          <li>Supabase stores the waitlist, webhook settings, delivery records and indexed chain data.</li>
          <li>GitHub runs scheduled jobs and hosts the project&apos;s code.</li>
        </ul>
        <p>These providers may process data in countries other than yours, under their own security and privacy terms.</p>

        <h2>How long we keep it</h2>
        <p>
          Waitlist entries are kept until the waitlist closes or you ask us to remove them. Webhook settings are kept until
          you ask us to remove them. Delivery records and demo payment records are kept for up to 12 months.
        </p>

        <h2>Your choices</h2>
        <p>
          You can ask to see, correct or delete the data we hold about you. Because there are no accounts, we will ask you
          to prove control of the email address or sign a message with the wallet involved. You may also have rights under
          the data protection law where you live, including the right to complain to a regulator.
        </p>

        <h2>Changes</h2>
        <p>The date at the top shows the current version. Changes are recorded in the project repository.</p>

        <h2>Contact</h2>
        <p>
          <ContactLine />
        </p>
    </LongformPage>
  );
}
