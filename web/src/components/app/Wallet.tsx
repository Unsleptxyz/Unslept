"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { chain, privyAppId } from "@/lib/web3";
import { shortAddr } from "@/lib/format";

export function ConnectButton() {
  return privyAppId ? <PrivyConnectButton /> : <InjectedConnectButton />;
}

/** Connect through Privy: browser and mobile wallets, WalletConnect, or an email login with an embedded wallet. */
function PrivyConnectButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { address, isConnected } = useAccount();

  if (ready && authenticated && isConnected) {
    return (
      <div className="wallet">
        <span className="wallet__addr num" title={address}>
          {shortAddr(address)}
        </span>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => void logout()}>
          Disconnect
        </button>
      </div>
    );
  }
  return (
    <div className="wallet">
      <button type="button" className="btn btn--primary btn--small" disabled={!ready || authenticated} onClick={() => login()}>
        {!ready || authenticated ? "Connecting" : "Connect wallet"}
      </button>
      {ready && authenticated ? (
        <button type="button" className="btn btn--ghost btn--small" onClick={() => void logout()}>
          Cancel
        </button>
      ) : null}
    </div>
  );
}

function InjectedConnectButton() {
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
  const { isConnected, chainId, address } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();
  // Ask the wallet to switch once per connected address, so the user is not sent through the button on every visit.
  const asked = useRef<string | undefined>(undefined);
  const wrongChain = !!chain && isConnected && chainId !== chain.id;
  useEffect(() => {
    if (!wrongChain || !address || asked.current === address) return;
    asked.current = address;
    switchChain({ chainId: chain!.id });
  }, [wrongChain, address, switchChain]);
  if (!isConnected) {
    return (
      <div className="app-empty">
        <h2>Connect a wallet to continue</h2>
        <p>
          {privyAppId
            ? "Connect a browser or mobile wallet, or continue with email, to see your agents, buffer deposits and treasury."
            : "Unslept works with standard EVM wallets. Connect one to see your agents, buffer deposits and treasury."}
        </p>
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
