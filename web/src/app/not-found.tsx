import { PageShell } from "@/components/PageShell";
import { Mark } from "@/components/SiteChrome";

export default function NotFound() {
  return (
    <PageShell>
      <section className="status-page container">
        <div className="status-page__card card">
          <span className="status-page__mark" aria-hidden="true">
            <Mark size={44} />
          </span>
          <p className="eyebrow">404</p>
          <h1 className="display status-page__title">This page is still asleep.</h1>
          <p className="status-page__body">The link may be old or mistyped. Everything else is awake and where you left it.</p>
          <div className="page-actions">
            <a className="btn btn--primary" href="/">
              Back to home
            </a>
            <a className="btn btn--ghost" href="/docs">
              Open the docs
            </a>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
