"use client";

import type { ReactNode } from "react";
import { shortAddr } from "@/lib/format";
import { privyAppId } from "@/lib/solana";
import { useSolanaWallet } from "./solana-wallet";

export function ConnectButton() {
  const { ready, address, connect, disconnect } = useSolanaWallet();
  if (address) {
    const a = address.toBase58();
    return (
      <div className="wallet">
        <span className="wallet__addr num" title={a}>
          {shortAddr(a)}
        </span>
        <button type="button" className="btn btn--ghost btn--small" onClick={disconnect}>
          Disconnect
        </button>
      </div>
    );
  }
  return (
    <div className="wallet">
      <button type="button" className="btn btn--primary btn--small" disabled={!ready} onClick={connect}>
        {ready ? "Connect wallet" : "Loading"}
      </button>
    </div>
  );
}

/** Shows children only when a Solana wallet is connected. */
export function NetworkGuard({ children }: { children: ReactNode }) {
  const { address } = useSolanaWallet();
  if (!address) {
    return (
      <div className="app-empty">
        <h2>Connect a wallet to continue</h2>
        <p>
          {privyAppId
            ? "Connect Phantom, Solflare, Backpack or another Solana wallet, or continue with email, to see your agents and buffer deposits."
            : "Unslept works with standard Solana wallets such as Phantom, Solflare and Backpack. Connect one to see your agents and buffer deposits."}
        </p>
        <ConnectButton />
      </div>
    );
  }
  return <>{children}</>;
}
