import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { themeBootstrap } from "@/components/ThemeToggle";
import { site } from "@/lib/config";
import "./globals.css";

// Self-hosted from @fontsource so builds never depend on a network fetch to Google Fonts.
const bricolage = localFont({
  src: [
    { path: "../../node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-bricolage",
  display: "swap",
});

const plex = localFont({
  src: [
    { path: "../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-plex",
  display: "swap",
});

const plexMono = localFont({
  src: [{ path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2", weight: "400" }],
  variable: "--font-mono",
  display: "swap",
});

const description =
  "Every AI agent holds idle cash between payments. Unslept keeps it working in tokenized assets on Robinhood Chain and releases it the instant an x402 payment is due.";

export const metadata: Metadata = {
  metadataBase: site.url ? new URL(site.url) : undefined,
  title: { default: "Unslept: your money, unslept", template: "%s | Unslept" },
  description,
  openGraph: { title: "Unslept", description, type: "website" },
  twitter: { card: "summary_large_image", title: "Unslept", description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0E1630" },
    { media: "(prefers-color-scheme: light)", color: "#E8E6F0" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${plex.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrap}
        </Script>
        {children}
      </body>
    </html>
  );
}
