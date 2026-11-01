"use client";

import { useEffect, useState } from "react";
import type { FeedItem } from "@/lib/feed";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const usdg = (atomic: string) => {
  const n = Number(atomic) / 1e6;
  return n >= 1 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toLocaleString("en-US", { maximumFractionDigits: 4 });
};
function ago(ts: number, now: number) {
  const s = Math.max(0, Math.round(now / 1000 - ts));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function endpointLabel(e: string) {
  try {
    const u = new URL(e);
    return `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return e || "x402 endpoint";
  }
}

/** Live list of x402 payments settled through Unslept. Polls the public feed every 20 seconds. */
export function LiveFeed({ initial, explorerUrl }: { initial: FeedItem[]; explorerUrl?: string }) {
  const [items, setItems] = useState(initial);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/feed", { cache: "no-store" });
        if (r.ok) {
          const d = (await r.json()) as { items: FeedItem[] };
          if (!stop && Array.isArray(d.items)) setItems(d.items);
        }
      } catch {
        /* keep the last list */
      }
      if (!stop) setNow(Date.now());
    };
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void tick();
    }, 20_000);
    const clock = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => {
      stop = true;
      window.clearInterval(id);
      window.clearInterval(clock);
    };
  }, []);

  if (!items.length) {
    return (
      <div className="feed feed--empty">
        <span className="feed__pulse" aria-hidden="true" />
        <p>
          Waiting for the first settlement. Every x402 payment made through Unslept on Robinhood Chain appears here within a
          few minutes, with a link to the transaction.
        </p>
      </div>
    );
  }

  return (
    <ol className="feed" aria-live="polite">
      {items.map((it) => {
        const href = explorerUrl ? `${explorerUrl.replace(/\/$/, "")}/tx/${it.tx}` : undefined;
        return (
          <li key={`${it.tx}-${it.block}`} className="feed__row">
            <span className="feed__dot" aria-hidden="true" />
            <span className="feed__main">
              <span className="feed__line">
                Agent <span className="num">{short(it.agent)}</span> paid{" "}
                <strong className="num">{usdg(it.amount)} USDG</strong>
              </span>
              <span className="feed__endpoint">{endpointLabel(it.endpoint)}</span>
            </span>
            <span className="feed__meta">
              <span className="feed__mode">{it.mode === 0 ? "direct" : "exact"}</span>
              {href ? (
                <a className="feed__time" href={href} rel="noopener noreferrer" target="_blank">
                  {ago(it.ts, now)}
                </a>
              ) : (
                <span className="feed__time">{ago(it.ts, now)}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
