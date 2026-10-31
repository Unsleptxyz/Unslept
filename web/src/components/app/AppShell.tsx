"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Mark } from "@/components/SiteChrome";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConnectButton, NetworkGuard } from "./Wallet";

const nav = [
  { href: "/app", label: "Overview" },
  { href: "/app/agents", label: "Agents" },
  { href: "/app/buffer", label: "Buffer" },
  { href: "/app/treasury", label: "Treasury" },
  { href: "/app/developers", label: "Developers" },
  { href: "/app/settings", label: "Settings" },
];

export function AppShell({ children, configured }: { children: ReactNode; configured: boolean }) {
  const path = usePathname();
  return (
    <div className="app">
      <a className="skip-link" href="#app-main">
        Skip to content
      </a>
      <header className="app-header">
        <a href="/" className="brand" aria-label="Unslept home">
          <Mark />
          <span className="brand__word">Unslept</span>
        </a>
        <div className="app-header__actions">
          <ThemeToggle />
          {configured ? <ConnectButton /> : null}
        </div>
      </header>
      <nav aria-label="App" className="app-nav">
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
  );
}

export function NotConfigured({ missing }: { missing: string[] }) {
  return (
    <div className="app-empty">
      <h2>The app is not connected to the protocol yet</h2>
      <p>
        Contract addresses and chain settings are read from configuration, and these values are missing. The app will
        open as soon as they are set.
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
