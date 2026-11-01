import { LiveFeed } from "./LiveFeed";
import { getFeed } from "@/lib/feed";
import { chain } from "@/lib/config";

/** Home page band: the live feed of x402 payments settled through Unslept. */
export async function AgentsAtWork() {
  const items = await getFeed(8);
  return (
    <section className="section agents-live" aria-labelledby="agents-live-title">
      <div className="container agents-live__grid">
        <header className="section-head" data-reveal>
          <p className="eyebrow">Live on mainnet</p>
          <h2 id="agents-live-title" className="display section-title">
            Agents at work, <em>right now.</em>
          </h2>
          <p className="lede">
            Every row is a real x402 payment an agent made through Unslept on Solana, settled from the buffer in one
            transaction. Open any row to see it on the explorer.
          </p>
          <div className="agents-live__links">
            <a className="btn btn--ghost" href="/directory">
              Browse paid APIs
            </a>
            <a className="arrow-link" href="/templates">
              Start from a template
            </a>
          </div>
        </header>
        <div className="card agents-live__panel" data-reveal>
          <div className="agents-live__bar">
            <span className="agents-live__status">
              <span className="feed__pulse" aria-hidden="true" />
              Live feed
            </span>
            <span className="muted small">Updates every 20 seconds</span>
          </div>
          <LiveFeed initial={items} explorerUrl={chain.explorerUrl} />
        </div>
      </div>
    </section>
  );
}
