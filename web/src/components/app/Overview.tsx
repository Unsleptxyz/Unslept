"use client";

import { fmtUsdc, shortAddr } from "@/lib/format";
import { txUrl } from "@/lib/solana";
import { useBuffer, useMyAgents, usePayments, type PaymentRow } from "./hooks";

export function Overview() {
  const { agents, isLoading } = useMyAgents();
  const buf = useBuffer();
  const payments = usePayments(agents.map((a) => a.address), 10);

  const working = agents.reduce((s, a) => s + a.positionValue, 0n);
  const liquid = agents.reduce((s, a) => s + a.liquid, 0n);
  const debt = agents.reduce((s, a) => s + a.debt, 0n);
  const inBuffer = buf.position ?? 0n;
  const total = working + liquid - debt + inBuffer;

  if (!isLoading && agents.length === 0 && (buf.shares ?? 0n) === 0n) {
    return (
      <div className="app-empty">
        <h2>Nothing here yet</h2>
        <p>Create an agent to pay x402 requests in USDC from a balance that earns on Kamino, or deposit to the buffer to earn from agent payments.</p>
        <div className="page-actions">
          <a className="btn btn--primary" href="/app/agents">
            Create an agent
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
          <p className="num ov-total__value">{fmtUsdc(total)} USDC</p>
        </div>
        <dl className="ov-split">
          <div>
            <dt>Working in Kamino</dt>
            <dd className="num">{fmtUsdc(working)}</dd>
          </div>
          <div>
            <dt>Held liquid in agents</dt>
            <dd className="num">{fmtUsdc(liquid)}</dd>
          </div>
          <div>
            <dt>In the buffer</dt>
            <dd className="num">{fmtUsdc(inBuffer)}</dd>
          </div>
          <div>
            <dt>Owed to the buffer</dt>
            <dd className="num">{fmtUsdc(debt)}</dd>
          </div>
        </dl>
        <p className="muted small">
          Kamino positions are shown at the USDC deposited; interest earned arrives when a position is redeemed. Rates are variable.
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
        <h2 id="agents">Agents</h2>
        {agents.length === 0 ? (
          <p className="muted">
            No agents yet. <a className="text-link" href="/app/agents">Create an agent</a>
          </p>
        ) : (
          <ul className="agent-mini">
            {agents.map((a) => (
              <li key={a.address.toBase58()}>
                <a href={`/app/agents#${a.address.toBase58()}`} className="num">
                  {shortAddr(a.address.toBase58())}
                </a>
                <span className={a.paused || a.revoked ? "badge badge--off" : "badge"}>{a.revoked ? "Revoked" : a.paused ? "Paused" : "Active"}</span>
                <span className="num">{fmtUsdc(a.positionValue + a.liquid)} USDC</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function PaymentTable({ rows, showAgent }: { rows: PaymentRow[]; showAgent?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Time (UTC)</th>
            {showAgent ? <th scope="col">Agent</th> : null}
            <th scope="col">Payee</th>
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
          {rows.map((p) => (
            <tr key={p.signature + p.paymentId}>
              <td className="num">{p.timestamp ? new Date(p.timestamp * 1000).toISOString().slice(0, 19).replace("T", " ") : "--"}</td>
              {showAgent ? <td className="num">{shortAddr(p.agent)}</td> : null}
              <td className="num">{shortAddr(p.payee)}</td>
              <td className="num r">{fmtUsdc(p.amount)}</td>
              <td className="num r">{fmtUsdc(p.fee, { decimals: 6 })}</td>
              <td className="num">
                <a className="text-link" href={txUrl(p.signature)} target="_blank" rel="noopener noreferrer">
                  {shortAddr(p.signature)}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
