/**
 * Typed configuration. Values come from the environment only.
 * Unknown chain values stay `undefined` and the UI shows a "not configured"
 * state. There are no fallback chain IDs, addresses or rates anywhere.
 */

function read(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

export const site = {
  url: read(process.env.NEXT_PUBLIC_SITE_URL),
  docsUrl: read(process.env.NEXT_PUBLIC_DOCS_URL) ?? "/docs",
  githubUrl: read(process.env.NEXT_PUBLIC_GITHUB_URL),
  xUrl: read(process.env.NEXT_PUBLIC_X_URL),
};

export const chain = {
  name: process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ? "Solana devnet" : "Solana",
  explorerUrl: "https://solscan.io",
};

export const token = {
  address: read(process.env.NEXT_PUBLIC_UNSLEPT_TOKEN_ADDRESS),
  /** Where the token trades or launched, for example a launchpad or DEX page. */
  launchUrl: read(process.env.NEXT_PUBLIC_TOKEN_LAUNCH_URL),
};

export const indexer = {
  url: read(process.env.INDEXER_URL),
};

/** Service role key: needed for webhooks and alerts (secrets). Server only. */
export const waitlistStore = {
  supabaseUrl: read(process.env.SUPABASE_URL),
  supabaseKey: read(process.env.SUPABASE_SERVICE_ROLE_KEY),
  /** Publishable key: enough for waitlist inserts (insert-only RLS policy on un_waitlist). */
  publishableKey: read(process.env.SUPABASE_PUBLISHABLE_KEY),
};
