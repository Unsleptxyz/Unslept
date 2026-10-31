"use client";

import type { ReactNode } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { chain } from "@/lib/web3";
import { shortAddr } from "@/lib/format";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div className="wallet">
        <span className="wallet__addr num" title={address}>
          {shortAddr(address)}
        </span>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }
  const injectedConnector = connectors[0];
  return (
    <div className="wallet">
      <button
        type="button"
        className="btn btn--primary btn--small"
        disabled={!injectedConnector || isPending}
        onClick={() => injectedConnector && connect({ connector: injectedConnector })}
      >
        {isPending ? "Connecting" : "Connect wallet"}
      </button>
      {error ? (
        <p className="app-error" role="alert">
          {error.message.includes("Provider not found")
            ? "No browser wallet found. Install an EVM wallet extension, then reload this page."
            : `The wallet refused the connection: ${error.message}`}
        </p>
      ) : null}
    </div>
  );
}

/** Shows children only when the wallet is connected to the configured chain. */
export function NetworkGuard({ children }: { children: ReactNode }) {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();
  if (!isConnected) {
    return (
      <div className="app-empty">
        <h2>Connect a wallet to continue</h2>
        <p>Unslept works with standard EVM wallets. Connect one to see your agents, buffer deposits and treasury.</p>
        <ConnectButton />
      </div>
    );
  }
  if (chain && chainId !== chain.id) {
    return (
      <div className="app-empty" role="alert">
        <h2>Wrong network</h2>
        <p>
          Your wallet is on chain {chainId}. Unslept runs on {chain.name} (chain {chain.id}).
        </p>
        <button type="button" className="btn btn--primary" disabled={isPending} onClick={() => switchChain({ chainId: chain!.id })}>
          {isPending ? "Switching" : `Switch to ${chain.name}`}
        </button>
        {error ? (
          <p className="app-error">
            The wallet did not switch: {error.message}. Add {chain.name} to your wallet manually and try again.
          </p>
        ) : null}
      </div>
    );
  }
  return <>{children}</>;
}
