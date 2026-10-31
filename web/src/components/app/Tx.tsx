"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BaseError, ContractFunctionRevertedError, type Abi } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { txUrl } from "@/lib/web3";

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
  InsufficientLiquidity: "The buffer does not have that much free liquidity. Request a queued withdrawal instead.",
  UseWithdrawQueue: "Utilization is above the queue threshold, so instant withdrawals are paused. Request a queued withdrawal; it is paid as liquidity returns.",
  InsufficientLiquid: "The account does not hold that much liquid USDG. Unwind a parked position first.",
  WouldLeaveDebtUncovered: "That withdrawal would leave buffer debt uncovered. Withdraw less, or unwind a position so the debt is repaid first.",
  DepositNotAllowed: "This buffer tier is for $UNSLEPT stakers. Stake the required amount first.",
  ERC4626ExceededMaxDeposit: "This deposit is above the buffer's current deposit cap. Deposit a smaller amount.",
  ERC20InsufficientBalance: "Your wallet does not hold enough USDG for this.",
  ERC20InsufficientAllowance: "USDG spending is not approved yet. Approve first, then retry.",
  NotOwner: "Only the account owner can do this. Connect the owner wallet.",
  AgentRevoked: "This agent is revoked. Its signer cannot be changed or restored.",
  TicketNotFunded: "This withdrawal is still queued. It becomes claimable when liquidity returns.",
  EnforcedPause: "The protocol is paused by the admin. Deposits, withdrawals and payments resume when it is unpaused.",
};

export function explainError(e: unknown): string {
  if (e instanceof BaseError) {
    const rev = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (rev instanceof ContractFunctionRevertedError && rev.data?.errorName) {
      return knownErrors[rev.data.errorName] ?? `The contract rejected the transaction with ${rev.data.errorName}.`;
    }
    if (e.shortMessage.toLowerCase().includes("user rejected")) return "You rejected the request in your wallet. Nothing was sent.";
    return e.shortMessage;
  }
  return e instanceof Error ? e.message : String(e);
}

interface TxButtonProps {
  /** Exact action, for example "Deposit 500 USDG". */
  label: string;
  /** Same verb in the past tense, for example "Deposited 500 USDG". */
  doneLabel: string;
  request: { address: `0x${string}`; abi: Abi; functionName: string; args?: readonly unknown[] } | undefined;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  onDone?: () => void;
}

/** Sends one transaction and reports its state with the action's own verb. */
export function TxButton({ label, doneLabel, request, disabled, variant = "primary", onDone }: TxButtonProps) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (receipt.isSuccess) {
      setShown(doneLabel);
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess]);

  useEffect(() => {
    setShown(null);
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  const busy = isPending || receipt.isLoading;
  const link = hash ? txUrl(hash) : undefined;
  return (
    <div className="tx">
      <button
        type="button"
        className={`btn btn--${variant}`}
        disabled={disabled || !request || busy}
        onClick={() => request && writeContract(request as never)}
      >
        {isPending ? "Confirm in your wallet" : receipt.isLoading ? "Waiting for confirmation" : label}
      </button>
      {shown ? (
        <p className="tx__done" role="status">
          {shown}.{" "}
          {link ? (
            <a className="text-link" href={link} target="_blank" rel="noopener noreferrer">
              View transaction
            </a>
          ) : null}
        </p>
      ) : null}
      {error ? (
        <p className="app-error" role="alert">
          {explainError(error)}
        </p>
      ) : null}
      {receipt.isError ? (
        <p className="app-error" role="alert">
          The transaction was sent but failed on-chain. {explainError(receipt.error)}
        </p>
      ) : null}
    </div>
  );
}
