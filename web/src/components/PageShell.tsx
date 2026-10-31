import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome";
import { ReadingProgress, Toc } from "./content/Toc";
import { site } from "@/lib/config";

export function PageShell({ children, progress = false, active }: { children: ReactNode; progress?: boolean; active?: string }) {
  return (
    <>
      <SiteHeader docsUrl={site.docsUrl} active={active} />
      {progress ? <ReadingProgress /> : null}
      <main id="main">{children}</main>
      <SiteFooter docsUrl={site.docsUrl} githubUrl={site.githubUrl} xUrl={site.xUrl} />
    </>
  );
}

export function LegalReviewNotice() {
  return (
    <p className="legal-note">
      Written in plain language and not yet reviewed by a lawyer. It may change after legal review; the date above shows
      the version in force.
    </p>
  );
}

/** Long-form page layout for risk, terms and privacy: title block, summary, sticky contents, article. */
export function LongformPage({
  eyebrow,
  title,
  updated,
  intro,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  intro: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageShell progress>
      <div className="longform">
        <header className="longform__head container">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display longform__title">{title}</h1>
          <p className="longform__meta">
            <span>Last updated {updated}</span>
          </p>
          <div className="longform__intro">{intro}</div>
          <LegalReviewNotice />
        </header>
        <div className="longform__body container">
          <aside className="longform__aside">
            <Toc rootId="longform-article" title="Contents" />
          </aside>
          <article id="longform-article" className="prose">
            {summary}
            {children}
          </article>
        </div>
      </div>
    </PageShell>
  );
}
