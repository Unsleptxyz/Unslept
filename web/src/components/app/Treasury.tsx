"use client";

import { useAccount } from "wagmi";
import { fmtUsdg, shortAddr } from "@/lib/format";
import { CreateAccount, FundsPanel } from "./Agents";
import { useMyAccounts } from "./hooks";

export function TreasuryPage() {
  const { address } = useAccount();
  const { accounts, isLoading, refetch } = useMyAccounts();
  const treasuries = accounts.filter((a) => a.isTreasury);
  return (
    <div className="app-page">
      <h1 className="display app-title">Treasury</h1>
      <p className="lede muted">
        For projects with idle treasury funds. A treasury account has no agent key: only the owner moves funds. Idle
        balance can be parked in tokenized assets and unwound at any time.
      </p>
      {treasuries.length === 0 && !isLoading ? <CreateAccount kind="treasury" onDone={refetch} /> : null}
      {isLoading ? <p className="muted">Loading treasury accounts</p> : null}
      {treasuries.map((t) => (
        <article key={t.address} className="app-panel" aria-label={`Treasury ${t.address}`}>
          <header className="agent-card__head">
            <h2 className="num">{shortAddr(t.address)}</h2>
          </header>
          <dl className="kv-row">
            <div>
              <dt>Working</dt>
              <dd className="num">{fmtUsdg(t.parked)}</dd>
            </div>
            <div>
              <dt>Liquid</dt>
              <dd className="num">{fmtUsdg(t.liquid)}</dd>
            </div>
            <div>
              <dt>Positions</dt>
              <dd className="num">{t.positions.length}</dd>
            </div>
          </dl>
          <FundsPanel a={t} owner={address} onDone={refetch} />
        </article>
      ))}
      {treasuries.length > 0 ? (
        <details className="app-panel">
          <summary>Create another treasury account</summary>
          <CreateAccount kind="treasury" onDone={refetch} />
        </details>
      ) : null}
    </div>
  );
}
