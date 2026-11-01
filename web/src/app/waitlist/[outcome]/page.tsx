import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { Mark } from "@/components/SiteChrome";

export const metadata: Metadata = { title: "Updates", robots: { index: false } };
export const dynamicParams = false;

const outcomes = {
  joined: {
    title: "You are on the list.",
    body: "We will email you about releases and the $UNSLEPT launch, nothing else. The app is already live if you want to start now.",
    ok: true,
  },
  already: {
    title: "You are already on the list.",
    body: "This email joined earlier, so there is nothing more to do. We will write about releases and the $UNSLEPT launch.",
    ok: true,
  },
  "invalid-email": {
    title: "The email address is not valid.",
    body: "Check for a typo and submit the form again.",
    ok: false,
  },
  "invalid-wallet": {
    title: "The wallet address is not valid.",
    body: "Enter a Solana wallet address, or leave the field empty.",
    ok: false,
  },
  unavailable: {
    title: "Your email could not be saved.",
    body: "Storage did not respond. Your details were not stored. Submit the form again in a few minutes.",
    ok: false,
  },
} as const;

type Outcome = keyof typeof outcomes;

export function generateStaticParams() {
  return Object.keys(outcomes).map((outcome) => ({ outcome }));
}

export default async function WaitlistOutcome({ params }: { params: Promise<{ outcome: string }> }) {
  const { outcome } = await params;
  if (!(outcome in outcomes)) notFound();
  const o = outcomes[outcome as Outcome];
  return (
    <PageShell>
      <section className="status-page container">
        <div className="status-page__card card">
        <span className="status-page__mark" aria-hidden="true">
          <Mark size={44} />
        </span>
        <h1 className="display status-page__title">{o.title}</h1>
        <p className="status-page__body">{o.body}</p>
        <div className="page-actions">
          {o.ok ? (
            <a className="btn btn--primary" href="/app">
              Launch app
            </a>
          ) : (
            <a className="btn btn--primary" href="/#updates">
              Back to the form
            </a>
          )}
          <a className="btn btn--ghost" href="/">
            Back to home
          </a>
        </div>
        </div>
      </section>
    </PageShell>
  );
}
