"use client";

import { fmtUsdg, shortAddr } from "@/lib/format";
import { txUrl } from "@/lib/web3";
import { useBuffer, useMyAccounts, usePayments } from "./hooks";

export function Overview() {
  const { accounts, isLoading } = useMyAccounts();
  const buf = useBuffer();
  const payments = usePayments(accounts.map((a) => a.address), 10);

  const working = accounts.reduce((s, a) => s + a.parked, 0n);
  const liquid = accounts.reduce((s, a) => s + a.liquid, 0n);
  const debt = accounts.reduce((s, a) => s + a.debt, 0n);
  const inBuffer = buf.position ?? 0n;
  const total = working + liquid - debt + inBuffer;
  const agents = accounts.filter((a) => !a.isTreasury);

  if (!isLoading && accounts.length === 0 && (buf.shares ?? 0n) === 0n) {
    return (
      <div className="app-empty">
        <h2>Nothing here yet</h2>
        <p>Connect an agent to pay x402 requests from a balance that keeps working, or deposit to the buffer to earn from agent payments.</p>
        <div className="page-actions">
          <a className="btn btn--primary" href="/app/agents">
            Connect an agent
          </a>
          <a className="btn btn--ghost" href="/app/buffer">
            Deposit to the buffer
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <h1 className="display app-title">Overview</h1>
      <section className="ov-hero" aria-label="Totals">
        <div className="ov-total">
          <p className="muted">Total balance</p>
          <p className="num ov-total__value">{fmtUsdg(total)} USDG</p>
        </div>
        <dl className="ov-split">
          <div>
            <dt>Working in tokenized assets</dt>
            <dd className="num">{fmtUsdg(working)}</dd>
          </div>
          <div>
            <dt>Held liquid in accounts</dt>
            <dd className="num">{fmtUsdg(liquid)}</dd>
          </div>
          <div>
            <dt>In the buffer</dt>
            <dd className="num">{fmtUsdg(inBuffer)}</dd>
          </div>
          <div>
            <dt>Owed to the buffer</dt>
            <dd className="num">{fmtUsdg(debt)}</dd>
          </div>
        </dl>
        <p className="muted small">
          Yield earned is shown per position on the Buffer page. Rates are variable; past results say nothing about future ones.
        </p>
      </section>

      <section className="app-section" aria-labelledby="recent">
        <h2 id="recent">Recent x402 payments</h2>
        {payments.isLoading ? <p className="muted">Loading payments</p> : null}
        {payments.data && payments.data.length === 0 ? (
          <p className="muted">No payments yet. They appear here as soon as an agent pays its first 402.</p>
        ) : null}
        {payments.data && payments.data.length > 0 ? <PaymentTable rows={payments.data} showAgent /> : null}
      </section>

      <section className="app-section" aria-labelledby="agents">
        <h2 id="agents">Connected agents</h2>
        {agents.length === 0 ? (
          <p className="muted">
            No agents yet. <a className="text-link" href="/app/agents">Connect an agent</a>
          </p>
        ) : (
          <ul className="agent-mini">
            {agents.map((a) => (
              <li key={a.address}>
                <a href={`/app/agents#${a.address}`} className="num">
                  {shortAddr(a.address)}
                </a>
                <span className={a.paused || a.revoked ? "badge badge--off" : "badge"}>{a.revoked ? "Revoked" : a.paused ? "Paused" : "Active"}</span>
                <span className="num">{fmtUsdg(a.parked + a.liquid)} USDG</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function PaymentTable({
  rows,
  showAgent,
}: {
  rows: { agent: string; endpoint: string; amount: bigint; fee: bigint; timestamp?: number; txHash: string }[];
  showAgent?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Time (UTC)</th>
            {showAgent ? <th scope="col">Agent</th> : null}
            <th scope="col">Endpoint</th>
            <th scope="col" className="r">
              Amount
            </th>
            <th scope="col" className="r">
              Fee
            </th>
            <th scope="col">Transaction</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const link = txUrl(p.txHash);
            return (
              <tr key={p.txHash + p.endpoint}>
                <td className="num">{p.timestamp ? new Date(p.timestamp * 1000).toISOString().slice(0, 19).replace("T", " ") : "--"}</td>
                {showAgent ? <td className="num">{shortAddr(p.agent)}</td> : null}
                <td className="endpoint" title={p.endpoint}>
                  {p.endpoint}
                </td>
                <td className="num r">{fmtUsdg(p.amount)}</td>
                <td className="num r">{fmtUsdg(p.fee, { decimals: 6 })}</td>
                <td className="num">
                  {link ? (
                    <a className="text-link" href={link} target="_blank" rel="noopener noreferrer">
                      {shortAddr(p.txHash)}
                    </a>
                  ) : (
                    shortAddr(p.txHash)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
