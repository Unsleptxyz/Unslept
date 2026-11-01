"use client";

import { useMemo, useState } from "react";
import type { DirectoryEntry } from "@/lib/directory";

type Category = { id: string; label: string };

const price = (atomic: string) => {
  const n = Number(atomic) / 1e6;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: n < 0.01 ? 6 : 4 })} USDG`;
};
const host = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
};

function snippet(e: DirectoryEntry) {
  const max = BigInt(e.price) * 2n;
  return `import { Unslept } from "@unslept/sdk";
import { privateKeyToAccount } from "viem/accounts";

const unslept = new Unslept({
  agentAccount: process.env.UNSLEPT_AGENT_ACCOUNT,
  signer: privateKeyToAccount(process.env.UNSLEPT_SIGNER_KEY),
  network: "robinhood-chain",
});

// ${e.name}: ${price(e.price)} per call
const res = await unslept.fetch("${e.url}", {}, { maxAmount: ${max}n });
console.log(await res.json());`;
}

export function DirectoryBrowser({ entries, categories }: { entries: DirectoryEntry[]; categories: readonly Category[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return m;
  }, [entries]);

  const shown = entries.filter((e) => {
    if (cat !== "all" && e.category !== cat) return false;
    if (!q.trim()) return true;
    const t = `${e.name} ${e.description} ${e.provider ?? ""} ${e.url}`.toLowerCase();
    return t.includes(q.trim().toLowerCase());
  });

  const copy = async (e: DirectoryEntry) => {
    try {
      await navigator.clipboard.writeText(snippet(e));
      setCopied(e.id);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="dir">
      <div className="dir__controls">
        <input
          className="input dir__search"
          type="search"
          placeholder="Search APIs, providers or URLs"
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          aria-label="Search the directory"
        />
        <div className="dir__chips" role="tablist" aria-label="Categories">
          <button type="button" role="tab" aria-selected={cat === "all"} className="chip" onClick={() => setCat("all")}>
            All <span className="chip__n">{entries.length}</span>
          </button>
          {categories
            .filter((c) => counts.get(c.id))
            .map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} className="chip" onClick={() => setCat(c.id)}>
                {c.label} <span className="chip__n">{counts.get(c.id)}</span>
              </button>
            ))}
        </div>
      </div>

      {shown.length ? (
        <ul className="dir__list">
          {shown.map((e) => (
            <li key={e.id} className="card dir__item">
              <div className="dir__head">
                <div className="dir__title">
                  <h3>{e.name}</h3>
                  <p className="dir__provider">
                    {e.provider ?? host(e.url)}
                    {e.verified ? <span className="badge badge--lamp">Verified</span> : <span className="badge badge--off">Community</span>}
                  </p>
                </div>
                <div className="dir__price">
                  <span className="num">{price(e.price)}</span>
                  <span className="muted small">per call</span>
                </div>
              </div>
              {e.description ? <p className="dir__desc">{e.description}</p> : null}
              <div className="dir__meta">
                <span className={`dir__status ${e.online ? "is-on" : "is-off"}`}>
                  <span aria-hidden="true" />
                  {e.online ? "Online" : "Not answering"}
                </span>
                <span className="dir__tag">{e.scheme}</span>
                <span className="dir__tag">{categories.find((c) => c.id === e.category)?.label ?? "Other"}</span>
                <code className="dir__url">{e.url}</code>
              </div>
              <div className="dir__actions">
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                  {open === e.id ? "Hide code" : "Try with your agent"}
                </button>
                {e.website ? (
                  <a className="arrow-link" href={e.website} rel="noopener noreferrer" target="_blank">
                    Provider site
                  </a>
                ) : null}
              </div>
              {open === e.id ? (
                <div className="dir__code">
                  <div className="dir__code-bar">
                    <span>agent.ts</span>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => void copy(e)}>
                      {copied === e.id ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre>
                    <code>{snippet(e)}</code>
                  </pre>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="dir__empty muted">No endpoint matches this search yet.</p>
      )}
    </div>
  );
}
