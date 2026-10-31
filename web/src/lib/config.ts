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
  id: read(process.env.NEXT_PUBLIC_CHAIN_ID),
  name: read(process.env.NEXT_PUBLIC_CHAIN_NAME) ?? "Robinhood Chain",
  rpcUrl: read(process.env.NEXT_PUBLIC_RPC_URL),
  explorerUrl: read(process.env.NEXT_PUBLIC_EXPLORER_URL),
};

export const token = {
  address: read(process.env.NEXT_PUBLIC_UNSLEPT_TOKEN_ADDRESS),
  ponsUrl: read(process.env.NEXT_PUBLIC_PONS_TOKEN_URL),
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
