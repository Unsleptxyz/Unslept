import { ThemeToggle } from "./ThemeToggle";

export interface ChromeLinks {
  docsUrl: string;
  githubUrl?: string;
  xUrl?: string;
}

export const DISCLAIMER =
  "Unslept is experimental software. Yields are variable and not guaranteed. Tokenized assets may be unavailable in your jurisdiction. Nothing on this site is investment advice.";

export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className="mark">
      <circle cx="16" cy="16" r="12.5" fill="none" stroke="var(--lamp)" strokeWidth="3" />
      <rect x="13" y="12" width="6" height="8" rx="1" fill="var(--lamp)" />
    </svg>
  );
}

export function SiteHeader({ docsUrl }: { docsUrl: string }) {
  return (
    <header className="site-header">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="site-header__inner">
        <a href="/" className="brand" aria-label="Unslept home">
          <Mark />
          <span className="brand__word">Unslept</span>
        </a>
        <nav aria-label="Primary" className="site-nav">
          <a href="/#how-it-works">How it works</a>
          <a href="/#developers">Developers</a>
          <a href="/#token">$UNSLEPT</a>
          <a href={docsUrl}>Docs</a>
        </nav>
        <div className="site-header__actions">
          <ThemeToggle />
          <a href="/app" className="btn btn--primary btn--small">
            Launch app
          </a>
        </div>
      </div>
    </header>
  );
}

function FooterLink({ href, children }: { href?: string; children: string }) {
  if (!href) {
    return (
      <span className="footer-link footer-link--pending" title="Link not published yet">
        {children} (soon)
      </span>
    );
  }
  const external = href.startsWith("http");
  return (
    <a className="footer-link" href={href} {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}>
      {children}
    </a>
  );
}

export function SiteFooter({ docsUrl, githubUrl, xUrl }: ChromeLinks) {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <a href="/" className="brand" aria-label="Unslept home">
            <Mark />
            <span className="brand__word">Unslept</span>
          </a>
          <p className="site-footer__tagline">Your money, unslept.</p>
        </div>
        <nav aria-label="Footer" className="site-footer__links">
          <FooterLink href={docsUrl}>Docs</FooterLink>
          <FooterLink href={githubUrl}>GitHub</FooterLink>
          <FooterLink href={xUrl}>X</FooterLink>
          <FooterLink href="/terms">Terms</FooterLink>
          <FooterLink href="/privacy">Privacy</FooterLink>
          <FooterLink href="/risk">Risk disclosure</FooterLink>
        </nav>
        <p className="site-footer__disclaimer">{DISCLAIMER}</p>
      </div>
    </footer>
  );
}
