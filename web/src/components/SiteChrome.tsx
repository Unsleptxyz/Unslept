import { HeaderScroll } from "./HeaderScroll";

export interface ChromeLinks {
  docsUrl: string;
  githubUrl?: string;
  xUrl?: string;
}

export const DISCLAIMER =
  "Unslept is experimental software in a guarded launch. Yields are variable and not guaranteed, and you can lose money. Tokenized assets may be unavailable in your jurisdiction. Nothing on this site is investment, legal or tax advice.";

/** The U-moon mark: a U that is also a crescent moon, holding one coin. */
export function Mark({ size = 28, tile = false }: { size?: number; tile?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className="mark" focusable="false">
      {tile ? <rect width="32" height="32" rx="8" fill="var(--night-2)" /> : null}
      <path d="M10.6 9.6v6.2a5.4 5.4 0 0 0 10.8 0V9.6" fill="none" stroke="var(--lamp)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="12.4" r="1.9" fill="var(--lamp)" />
    </svg>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <a href={href} className="brand" aria-label="Unslept home">
      <Mark />
      <span className="brand__word">Unslept</span>
    </a>
  );
}

const nav = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#developers", label: "Developers" },
  { href: "/#security", label: "Security" },
  { href: "/#token", label: "$UNSLEPT" },
];

export function SiteHeader({ docsUrl }: { docsUrl: string }) {
  return (
    <header className="site-header" data-site-header>
      <HeaderScroll />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="site-header__inner">
        <Brand />
        <nav aria-label="Primary" className="site-nav">
          {nav.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
          <a href={docsUrl}>Docs</a>
        </nav>
        <div className="site-header__actions">
          <a href="/app" className="btn btn--primary btn--small">
            Launch app
          </a>
          <details className="mobile-nav">
            <summary aria-label="Open menu">
              <span className="mobile-nav__bars" aria-hidden="true" />
            </summary>
            <nav aria-label="Mobile" className="mobile-nav__panel">
              {nav.map((n) => (
                <a key={n.href} href={n.href}>
                  {n.label}
                </a>
              ))}
              <a href={docsUrl}>Docs</a>
              <a href="/risk">Risk disclosure</a>
            </nav>
          </details>
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
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <Brand />
            <p className="site-footer__tagline">
              Idle agent money, kept working. x402 payments, settled the instant they are due.
            </p>
            <p className="pill site-footer__status">
              <span className="pill__dot" aria-hidden="true" />
              Live on Robinhood Chain mainnet, guarded launch
            </p>
          </div>
          <nav aria-label="Product" className="site-footer__col">
            <h2>Product</h2>
            <FooterLink href="/app">App</FooterLink>
            <FooterLink href="/app/agents">Agents</FooterLink>
            <FooterLink href="/app/buffer">Buffer</FooterLink>
            <FooterLink href="/#token">$UNSLEPT</FooterLink>
          </nav>
          <nav aria-label="Developers" className="site-footer__col">
            <h2>Developers</h2>
            <FooterLink href={docsUrl}>Docs</FooterLink>
            <FooterLink href={`${docsUrl}/quickstart`}>Quickstart</FooterLink>
            <FooterLink href={`${docsUrl}/contracts`}>Contracts</FooterLink>
            <FooterLink href={githubUrl}>GitHub</FooterLink>
          </nav>
          <nav aria-label="Legal" className="site-footer__col">
            <h2>Trust</h2>
            <FooterLink href="/risk">Risk disclosure</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href={xUrl}>X</FooterLink>
          </nav>
        </div>
        <p className="site-footer__word" aria-hidden="true">
          Unslept
        </p>
        <div className="site-footer__bottom">
          <p className="site-footer__disclaimer">{DISCLAIMER}</p>
          <p className="site-footer__copy">SDKs and MCP server released under the MIT license.</p>
        </div>
      </div>
    </footer>
  );
}
