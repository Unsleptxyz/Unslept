"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "@/components/SiteChrome";
import { ConnectButton, NetworkGuard } from "./Wallet";

function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const nav = [
  { href: "/app", label: "Overview", icon: "M4 13h6V4H4v9Zm10 7h6V11h-6v9ZM4 20h6v-4H4v4Zm10-13h6V4h-6v3Z" },
  { href: "/app/agents", label: "Agents", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" },
  { href: "/app/buffer", label: "Buffer", icon: "M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" },
  { href: "/app/treasury", label: "Treasury", icon: "M3 10 12 4l9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18" },
  { href: "/app/developers", label: "Developers", icon: "m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" },
  { href: "/app/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" },
];

export function AppShell({ children, configured }: { children: ReactNode; configured: boolean }) {
  const path = usePathname();
  const current = nav.find((n) => n.href === path) ?? nav[0];
  return (
    <div className="app">
      <a className="skip-link" href="#app-main">
        Skip to content
      </a>
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <Brand />
          <span className="badge badge--lamp app-sidebar__tag">App</span>
        </div>
        <nav aria-label="App" className="app-nav">
          {nav.map((n) => (
            <a key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}>
              <NavIcon d={n.icon} />
              <span>{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="app-sidebar__foot">
          <p className="pill">
            <span className="pill__dot" aria-hidden="true" />
            Robinhood Chain mainnet
          </p>
          <p className="app-sidebar__note">
            Guarded launch. Deposits are capped and yields are variable. <a className="text-link" href="/risk">Risks</a>
          </p>
          <nav className="app-sidebar__links" aria-label="Help">
            <a href="/docs">Docs</a>
            <a href="/">Website</a>
          </nav>
        </div>
      </aside>
      <div className="app-body">
        <header className="app-header">
          <div className="app-header__title">
            <span className="app-header__mobile-brand">
              <Brand />
            </span>
            <span className="app-header__crumb">{current.label}</span>
          </div>
          <div className="app-header__actions">{configured ? <ConnectButton /> : null}</div>
        </header>
        <nav aria-label="App sections" className="app-tabs">
          {nav.map((n) => (
            <a key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <main id="app-main" className="app-main">
          {!configured || path === "/app/developers" || path === "/app/settings" ? children : <NetworkGuard>{children}</NetworkGuard>}
        </main>
      </div>
    </div>
  );
}

export function NotConfigured({ missing }: { missing: string[] }) {
  return (
    <div className="app-empty">
      <h2>The app is not connected to the protocol yet</h2>
      <p>
        Contract addresses and chain settings are read from configuration, and these values are missing. The app will open as
        soon as they are set.
      </p>
      <ul className="mono-list">
        {missing.map((m) => (
          <li key={m}>
            <code>{m}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
