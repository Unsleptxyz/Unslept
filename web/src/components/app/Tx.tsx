"use client";

import type { TransactionInstruction } from "@solana/web3.js";
import { useEffect, useState, type ReactNode } from "react";
import { txUrl } from "@/lib/solana";
import { useSolanaWallet } from "./solana-wallet";

export interface PreviewRow {
  label: string;
  value: ReactNode;
}

/** What will happen, the fees, and the resulting balances. Shown before every transaction. */
export function TxPreview({ summary, rows }: { summary: string; rows: PreviewRow[] }) {
  return (
    <div className="tx-preview" aria-live="polite">
      <p className="tx-preview__summary">{summary}</p>
      <dl>
        {rows.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd className="num">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const knownErrors: Record<string, string> = {
  ProtocolPaused: "The protocol is paused by the admin. Deposits and payments resume when it is unpaused; withdrawals stay open.",
  InsufficientLiquidity: "The buffer does not have that much free liquidity right now. Withdraw less, or try again as agents repay.",
  CapExceeded: "This deposit is above the buffer's current deposit cap. Deposit a smaller amount.",
  WouldLeaveDebtUncovered: "That withdrawal would leave buffer debt uncovered. Withdraw less, or redeem from Kamino first so the debt is repaid.",
  InsufficientCollateral: "The agent does not hold enough to cover this.",
  NotOwner: "Only the agent's owner can do this. Connect the owner wallet.",
  NotOwnerOrKeeper: "Only the agent's owner or the keeper can redeem its Kamino position.",
  AllowlistTooLong: "An agent can allowlist at most 8 payees.",
  InsufficientPosition: "The agent does not hold that much in Kamino.",
  YieldReserveNotSet: "Kamino yield is not enabled on this deployment yet.",
  "insufficient funds": "Your wallet does not hold enough for this, including the network fee in SOL.",
  "0x1": "Your wallet does not hold enough USDC for this.",
};

export function explainError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/reject|denied|cancel/i.test(msg)) return "You rejected the request in your wallet. Nothing was sent.";
  for (const [k, v] of Object.entries(knownErrors)) if (msg.includes(k)) return v;
  return msg.length > 240 ? `${msg.slice(0, 240)}…` : msg;
}

interface TxButtonProps {
  /** Exact action, for example "Deposit 500 USDC". */
  label: string;
  /** Same verb in the past tense, for example "Deposited 500 USDC". */
  doneLabel: string;
  /** Builds the instructions to send. Undefined disables the button. */
  build: (() => TransactionInstruction[]) | undefined;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  onDone?: () => void;
}

/** Sends one transaction and reports its state with the action's own verb. */
export function TxButton({ label, doneLabel, build, disabled, variant = "primary", onDone }: TxButtonProps) {
  const { send, address } = useSolanaWallet();
  const [state, setState] = useState<"idle" | "signing" | "done">("idle");
  const [sig, setSig] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    setState("idle");
    setError(undefined);
  }, [label]);

  async function run() {
    if (!build) return;
    setError(undefined);
    setState("signing");
    try {
      const s = await send(build());
      setSig(s);
      setState("done");
      onDone?.();
    } catch (e) {
      setError(explainError(e));
      setState("idle");
    }
  }

  return (
    <div className="tx">
      <button type="button" className={`btn btn--${variant}`} disabled={disabled || !build || !address || state === "signing"} onClick={run}>
        {state === "signing" ? "Confirm in your wallet" : label}
      </button>
      {state === "done" && sig ? (
        <p className="tx__done" role="status">
          {doneLabel}.{" "}
          <a className="text-link" href={txUrl(sig)} target="_blank" rel="noopener noreferrer">
            View transaction
          </a>
        </p>
      ) : null}
      {error ? (
        <p className="app-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
