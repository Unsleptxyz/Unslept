import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { site } from "@/lib/config";
import "./globals.css";

// Self-hosted from @fontsource so builds never depend on a network fetch.
const instrument = localFont({
  src: [
    { path: "../../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument",
  display: "swap",
});

const inter = localFont({
  src: [
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2", weight: "500" },
  ],
  variable: "--font-inter",
  display: "swap",
});

const plexMono = localFont({
  src: [
    { path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2", weight: "500" },
  ],
  variable: "--font-mono",
  display: "swap",
});

const description =
  "Every AI agent holds idle cash between payments. Unslept keeps it working in tokenized assets on Robinhood Chain and settles x402 payments the instant they are due.";

export const metadata: Metadata = {
  metadataBase: site.url ? new URL(site.url) : undefined,
  title: { default: "Unslept: your agent's money, unslept", template: "%s | Unslept" },
  description,
  openGraph: { title: "Unslept", description, type: "website", siteName: "Unslept" },
  twitter: { card: "summary_large_image", title: "Unslept", description },
};

export const viewport: Viewport = {
  themeColor: "#07080b",
  colorScheme: "dark",
};

/** Marks the document as JavaScript-enabled before paint, so progressive enhancements never flash. */
const bootstrap = `document.documentElement.classList.add('js');`;

/** Vercel Web Analytics and Speed Insights, cookieless. Loaded after the page is idle and only on Vercel builds. */
const onVercel = process.env.VERCEL === "1";
const metricsQueue = `window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};window.si=window.si||function(){(window.siq=window.siq||[]).push(arguments)};`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${instrument.variable} ${inter.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body>
        <Script id="js-bootstrap" strategy="beforeInteractive">
          {bootstrap}
        </Script>
        {children}
        {onVercel ? (
          <>
            <Script id="vercel-metrics" strategy="afterInteractive">
              {metricsQueue}
            </Script>
            <Script src="/_vercel/insights/script.js" strategy="lazyOnload" />
            <Script src="/_vercel/speed-insights/script.js" strategy="lazyOnload" />
          </>
        ) : null}
      </body>
    </html>
  );
}
