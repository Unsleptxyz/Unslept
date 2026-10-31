import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Waitlist", robots: { index: false } };
export const dynamicParams = false;

const outcomes = {
  joined: {
    title: "You are on the waitlist.",
    body: "We will email you when the app opens. Until then, the docs explain how Unslept works.",
    ok: true,
  },
  already: {
    title: "You are already on the list.",
    body: "This email joined earlier. There is nothing more to do. We will write when the app opens.",
    ok: true,
  },
  "invalid-email": {
    title: "The email address is not valid.",
    body: "Check for a typo and submit the form again.",
    ok: false,
  },
  "invalid-wallet": {
    title: "The wallet address is not valid.",
    body: "Enter 0x followed by 40 hexadecimal characters, or leave the field empty.",
    ok: false,
  },
  unavailable: {
    title: "The waitlist could not be saved.",
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
      <section className="prose-page">
        <h1 className="display">{o.title}</h1>
        <p className="page-intro">{o.body}</p>
        <div className="page-actions">
          {o.ok ? (
            <a className="btn btn--primary" href="/docs">
              Read the docs
            </a>
          ) : (
            <a className="btn btn--primary" href="/#waitlist">
              Back to the form
            </a>
          )}
          <a className="btn btn--ghost" href="/">
            Back to home
          </a>
        </div>
      </section>
    </PageShell>
  );
}
