"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { fmtBps, fmtUsdg, parseUsdg } from "@/lib/format";
import { abis, addresses, txUrl } from "@/lib/web3";
import { EligibilityGate } from "./Eligibility";
import { useBuffer, useBufferHistory } from "./hooks";
import { TxButton, TxPreview } from "./Tx";

export function BufferPage() {
  const tiers = [{ address: addresses.buffer, name: "Buffer" }];
  if (addresses.stakerBuffer) tiers.push({ address: addresses.stakerBuffer, name: "Staker tier" });
  const [tier, setTier] = useState(0);
  return (
    <div className="app-page">
      <h1 className="display app-title">Buffer</h1>
      <p className="lede muted">
        The buffer pays agents&apos; x402 requests instantly and is repaid from their parked positions. Depositors earn the
        instant-settlement fees and the yield on the buffer&apos;s own parked liquidity. The rate is variable and can fall.
      </p>
      {tiers.length > 1 ? (
        <div role="tablist" aria-label="Buffer tier" className="seg">
          {tiers.map((t, i) => (
            <button key={t.address} type="button" role="tab" aria-selected={tier === i} className="seg__btn" onClick={() => setTier(i)}>
              {t.name}
            </button>
          ))}
        </div>
      ) : null}
      <BufferTier key={tiers[tier].address} buffer={tiers[tier].address} />
    </div>
  );
}

function useRate() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const r = await fetch("/api/stats", { cache: "no-store" });
      return (await r.json()) as { status: string; bufferRateBps?: number | null };
    },
  });
}

function BufferTier({ buffer }: { buffer: `0x${string}` }) {
  const { address } = useAccount();
  const b = useBuffer(buffer);
  const hist = useBufferHistory(buffer);
  const rate = useRate();
  const [dep, setDep] = useState("");
  const [wd, setWd] = useState("");
  const d = parseUsdg(dep);
  const w = parseUsdg(wd);
  const needsApproval = d !== undefined && (b.allowance ?? 0n) < d;
  const preview = useReadContract({
    address: buffer,
    abi: abis.buffer,
    functionName: "previewDeposit",
    args: d ? [d] : undefined,
    query: { enabled: !!d },
  });
  const instant = w !== undefined && b.maxWithdraw !== undefined && w <= b.maxWithdraw;
  const sharesForW = useReadContract({
    address: buffer,
    abi: abis.buffer,
    functionName: "convertToShares",
    args: w ? [w] : undefined,
    query: { enabled: !!w },
  });
  const highUtil = b.utilizationBps !== undefined && b.queueThresholdBps !== undefined && b.utilizationBps > BigInt(b.queueThresholdBps);
  const earned = hist.data && b.position !== undefined ? b.position + hist.data.withdrawn - hist.data.deposited : undefined;
  const refresh = () => {
    b.refetch();
    void hist.refetch();
  };

  return (
    <>
      <dl className="kv-row kv-row--wide">
        <div>
          <dt>Total in buffer</dt>
          <dd className="num">{fmtUsdg(b.totalAssets)}</dd>
        </div>
        <div>
          <dt>Free liquidity</dt>
          <dd className="num">{fmtUsdg(b.available)}</dd>
        </div>
        <div>
          <dt>Utilization</dt>
          <dd className="num">{fmtBps(b.utilizationBps)}</dd>
        </div>
        <div>
          <dt>Current rate (variable)</dt>
          <dd className="num accrual">
            {typeof rate.data?.bufferRateBps === "number" ? fmtBps(rate.data.bufferRateBps) : <span className="muted">Not enough history yet</span>}
          </dd>
        </div>
      </dl>
      {b.paused ? <p className="gate">The buffer is paused by the admin. Deposits and withdrawals resume when it is unpaused.</p> : null}
      {highUtil ? (
        <p className="gate">
          Utilization is above {fmtBps(b.queueThresholdBps)}. Instant withdrawals are paused; requested withdrawals are queued and paid in order as agents
          repay.
        </p>
      ) : null}

      <div className="two-col">
        <section className="app-panel" aria-labelledby="dep">
          <h2 id="dep">Deposit</h2>
          <EligibilityGate action="Depositing to the buffer">
            <div className="field">
              <label htmlFor="dep-amt">Amount (USDG)</label>
              <input id="dep-amt" inputMode="decimal" value={dep} onChange={(e) => setDep(e.target.value)} placeholder="0.00" />
              <p className="field__hint num">Wallet: {fmtUsdg(b.walletUsdg)} USDG</p>
            </div>
            {d && d > 0n ? (
              <>
                <TxPreview
                  summary={`Deposits ${fmtUsdg(d)} USDG into the buffer. You receive buffer shares that track your part of it.`}
                  rows={[
                    { label: "Protocol fee", value: "None" },
                    { label: "Shares received", value: preview.data !== undefined ? String(preview.data) : "--" },
                    { label: "Your position after", value: `${fmtUsdg((b.position ?? 0n) + d)} USDG` },
                    { label: "Wallet after", value: `${fmtUsdg((b.walletUsdg ?? 0n) - d)} USDG` },
                  ]}
                />
                {needsApproval ? (
                  <TxButton
                    label={`Approve ${fmtUsdg(d)} USDG`}
                    doneLabel={`Approved ${fmtUsdg(d)} USDG`}
                    request={{ address: addresses.usdg, abi: abis.erc20, functionName: "approve", args: [buffer, d] }}
                    onDone={refresh}
                  />
                ) : (
                  <TxButton
                    label={`Deposit ${fmtUsdg(d)} USDG`}
                    doneLabel={`Deposited ${fmtUsdg(d)} USDG`}
                    disabled={!address || d > (b.walletUsdg ?? 0n)}
                    request={{ address: buffer, abi: abis.buffer, functionName: "deposit", args: [d, address] }}
                    onDone={() => {
                      setDep("");
                      refresh();
                    }}
                  />
                )}
              </>
            ) : null}
          </EligibilityGate>
        </section>

        <section className="app-panel" aria-labelledby="wd">
          <h2 id="wd">Withdraw</h2>
          <p className="num">Your position: {fmtUsdg(b.position)} USDG</p>
          <div className="field">
            <label htmlFor="wd-amt">Amount (USDG)</label>
            <input id="wd-amt" inputMode="decimal" value={wd} onChange={(e) => setWd(e.target.value)} placeholder="0.00" />
            <p className="field__hint num">Instant now: {fmtUsdg(b.maxWithdraw)} USDG</p>
          </div>
          {w && w > 0n ? (
            instant ? (
              <>
                <TxPreview
                  summary={`Withdraws ${fmtUsdg(w)} USDG now.`}
                  rows={[
                    { label: "Protocol fee", value: "None" },
                    { label: "Position after", value: `${fmtUsdg((b.position ?? 0n) - w)} USDG` },
                  ]}
                />
                <TxButton
                  label={`Withdraw ${fmtUsdg(w)} USDG`}
                  doneLabel={`Withdrew ${fmtUsdg(w)} USDG`}
                  request={{ address: buffer, abi: abis.buffer, functionName: "withdraw", args: [w, address, address] }}
                  onDone={() => {
                    setWd("");
                    refresh();
                  }}
                />
              </>
            ) : (
              <>
                <TxPreview
                  summary={`Not enough free liquidity for an instant withdrawal. This queues ${fmtUsdg(w)} USDG at today's share price; it becomes claimable as agents repay.`}
                  rows={[
                    { label: "Protocol fee", value: "None" },
                    { label: "Shares burned now", value: sharesForW.data !== undefined ? String(sharesForW.data) : "--" },
                    { label: "Position after", value: `${fmtUsdg((b.position ?? 0n) - w)} USDG` },
                  ]}
                />
                <TxButton
                  label={`Queue withdrawal of ${fmtUsdg(w)} USDG`}
                  doneLabel={`Queued withdrawal of ${fmtUsdg(w)} USDG`}
                  disabled={sharesForW.data === undefined || (sharesForW.data as bigint) > b.shares}
                  request={{ address: buffer, abi: abis.buffer, functionName: "requestWithdraw", args: [sharesForW.data, address, address] }}
                  onDone={() => {
                    setWd("");
                    refresh();
                  }}
                />
              </>
            )
          ) : null}

          {hist.data && hist.data.tickets.some((t) => !t.claimed) ? (
            <div className="tickets">
              <h3>Withdrawal queue</h3>
              <ul>
                {hist.data.tickets
                  .filter((t) => !t.claimed)
                  .map((t) => (
                    <li key={String(t.id)} className="position-row">
                      <span className="num">
                        {fmtUsdg(t.assets)} USDG, {t.funded ? "ready to claim" : "waiting for liquidity"}
                      </span>
                      {t.funded ? (
                        <TxButton
                          label={`Claim ${fmtUsdg(t.assets)} USDG`}
                          doneLabel={`Claimed ${fmtUsdg(t.assets)} USDG`}
                          request={{ address: buffer, abi: abis.buffer, functionName: "claimWithdraw", args: [t.id] }}
                          onDone={refresh}
                        />
                      ) : (
                        <TxButton
                          variant="ghost"
                          label="Process the queue"
                          doneLabel="Processed the queue"
                          request={{ address: buffer, abi: abis.buffer, functionName: "processQueue", args: [20n] }}
                          onDone={refresh}
                        />
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>

      <section className="app-section" aria-labelledby="earn">
        <h2 id="earn">Your earnings</h2>
        {hist.isLoading ? <p className="muted">Loading history</p> : null}
        {hist.data ? (
          <>
            <dl className="kv-row">
              <div>
                <dt>Deposited</dt>
                <dd className="num">{fmtUsdg(hist.data.deposited)}</dd>
              </div>
              <div>
                <dt>Withdrawn</dt>
                <dd className="num">{fmtUsdg(hist.data.withdrawn)}</dd>
              </div>
              <div>
                <dt>Earned so far</dt>
                <dd className={`num ${earned !== undefined && earned > 0n ? "accrual" : ""}`}>{fmtUsdg(earned, { decimals: 6 })}</dd>
              </div>
            </dl>
            {hist.data.events.length === 0 ? (
              <p className="muted">No deposits yet. Your history appears here after your first deposit.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Event</th>
                      <th scope="col" className="r">
                        Amount
                      </th>
                      <th scope="col">Transaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hist.data.events.map((e) => (
                      <tr key={e.txHash + e.kind}>
                        <td>{e.kind}</td>
                        <td className="num r">{fmtUsdg(e.assets)}</td>
                        <td className="num">
                          {txUrl(e.txHash) ? (
                            <a className="text-link" href={txUrl(e.txHash)} target="_blank" rel="noopener noreferrer">
                              View
                            </a>
                          ) : (
                            e.txHash.slice(0, 10)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </section>
    </>
  );
}
