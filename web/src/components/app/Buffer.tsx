"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fmtBps, fmtUsdc, parseUsdc } from "@/lib/format";
import { build } from "@/lib/solana";
import { EligibilityGate } from "./Eligibility";
import { sharesFor, useBuffer } from "./hooks";
import { useSolanaWallet } from "./solana-wallet";
import { TxButton, TxPreview } from "./Tx";

function useRate() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const r = await fetch("/api/stats", { cache: "no-store" });
      return (await r.json()) as { status: string; bufferRateBps?: number | null };
    },
  });
}

export function BufferPage() {
  const { address } = useSolanaWallet();
  const b = useBuffer();
  const rate = useRate();
  const [dep, setDep] = useState("");
  const [wd, setWd] = useState("");
  const d = parseUsdc(dep);
  const w = parseUsdc(wd);
  const totalAssets = b.totalAssets ?? 0n;
  const totalShares = b.totalShares ?? 0n;
  const depShares = d ? sharesFor(d, totalAssets, totalShares) : undefined;
  // Shares to burn for `w` USDC, rounded up so the withdrawal is at least `w`, capped at the user's shares.
  const wShares =
    w && totalAssets > 0n ? (() => {
      const s = (w * totalShares + totalAssets - 1n) / totalAssets;
      return s > (b.shares ?? 0n) ? (b.shares ?? 0n) : s;
    })() : undefined;
  const capLeft = b.depositCap !== undefined ? (b.depositCap > totalAssets ? b.depositCap - totalAssets : 0n) : undefined;
  const missing = !b.isLoading && !b.config;

  return (
    <div className="app-page">
      <h1 className="display app-title">Buffer</h1>
      <p className="lede muted">
        The buffer pays agents&apos; x402 requests in USDC the moment they ask, and is repaid from their liquid balance and Kamino positions.
        Depositors earn the settlement fees agents pay. The rate is variable and can fall.
      </p>
      {missing ? <p className="gate">The Unslept program is not initialized on this cluster yet. Deposits open as soon as it is.</p> : null}

      <dl className="kv-row kv-row--wide">
        <div>
          <dt>Total in buffer</dt>
          <dd className="num">{fmtUsdc(b.totalAssets)}</dd>
        </div>
        <div>
          <dt>Free liquidity</dt>
          <dd className="num">{fmtUsdc(b.available)}</dd>
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
      {b.paused ? <p className="gate">The protocol is paused by the admin. Deposits resume when it is unpaused; withdrawals stay open.</p> : null}

      <div className="two-col">
        <section className="app-panel" aria-labelledby="dep">
          <h2 id="dep">Deposit</h2>
          <EligibilityGate action="Depositing to the buffer">
            <div className="field">
              <label htmlFor="dep-amt">Amount (USDC)</label>
              <input id="dep-amt" inputMode="decimal" value={dep} onChange={(e) => setDep(e.target.value)} placeholder="0.00" />
              <p className="field__hint num">
                Wallet: {fmtUsdc(b.walletUsdc)} USDC{capLeft !== undefined ? ` · Room under the cap: ${fmtUsdc(capLeft)} USDC` : ""}
              </p>
            </div>
            {d && d > 0n ? (
              <>
                <TxPreview
                  summary={`Deposits ${fmtUsdc(d)} USDC into the buffer. You receive buffer shares (an SPL token) that track your part of it.`}
                  rows={[
                    { label: "Protocol fee", value: "None" },
                    { label: "Shares received", value: depShares !== undefined ? fmtUsdc(depShares, { decimals: 6 }) : "--" },
                    { label: "Your position after", value: `${fmtUsdc((b.position ?? 0n) + d)} USDC` },
                    { label: "Wallet after", value: `${fmtUsdc((b.walletUsdc ?? 0n) - d)} USDC` },
                  ]}
                />
                <TxButton
                  label={`Deposit ${fmtUsdc(d)} USDC`}
                  doneLabel={`Deposited ${fmtUsdc(d)} USDC`}
                  disabled={!address || d > (b.walletUsdc ?? 0n) || !!b.paused || missing || (capLeft !== undefined && d > capLeft)}
                  build={address ? () => build.bufferDeposit(address, d) : undefined}
                  onDone={() => {
                    setDep("");
                    b.refetch();
                  }}
                />
              </>
            ) : null}
          </EligibilityGate>
        </section>

        <section className="app-panel" aria-labelledby="wd">
          <h2 id="wd">Withdraw</h2>
          <p className="num">Your position: {fmtUsdc(b.position)} USDC</p>
          <div className="field">
            <label htmlFor="wd-amt">Amount (USDC)</label>
            <input id="wd-amt" inputMode="decimal" value={wd} onChange={(e) => setWd(e.target.value)} placeholder="0.00" />
            <p className="field__hint num">Available now: {fmtUsdc(b.maxWithdraw)} USDC</p>
          </div>
          {w && w > 0n ? (
            <>
              <TxPreview
                summary={
                  w <= (b.maxWithdraw ?? 0n)
                    ? `Withdraws ${fmtUsdc(w)} USDC to your wallet now.`
                    : "Not enough free liquidity right now: the rest is out with agents and returns as they repay. Withdraw up to the amount available now."
                }
                rows={[
                  { label: "Protocol fee", value: "None" },
                  { label: "Shares burned", value: wShares !== undefined ? fmtUsdc(wShares, { decimals: 6 }) : "--" },
                  { label: "Position after", value: `${fmtUsdc((b.position ?? 0n) - w)} USDC` },
                ]}
              />
              <TxButton
                label={`Withdraw ${fmtUsdc(w)} USDC`}
                doneLabel={`Withdrew ${fmtUsdc(w)} USDC`}
                disabled={!address || !wShares || w > (b.maxWithdraw ?? 0n)}
                build={address && wShares ? () => build.bufferWithdraw(address, wShares) : undefined}
                onDone={() => {
                  setWd("");
                  b.refetch();
                }}
              />
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
