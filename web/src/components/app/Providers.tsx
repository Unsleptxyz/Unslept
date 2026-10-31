"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { createConfig as createPrivyConfig, WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { appTransport, chain, privyAppId, wagmiConfig } from "@/lib/web3";

/** wagmi config for the Privy path. Built here so server code that imports web3.ts never loads Privy. */
const privyWagmiConfig =
  chain && privyAppId
    ? createPrivyConfig({ chains: [chain], transports: { [chain.id]: appTransport() }, ssr: true })
    : undefined;

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchInterval: 15_000, staleTime: 5_000 } } }));
  if (!wagmiConfig || !chain) return <>{children}</>;

  if (privyAppId && privyWagmiConfig) {
    return (
      <PrivyProvider
        appId={privyAppId}
        config={{
          loginMethods: ["wallet", "email"],
          appearance: {
            theme: "dark",
            accentColor: "#f2a93b",
            landingHeader: "Connect to Unslept",
            showWalletLoginFirst: true,
            walletChainType: "ethereum-only",
          },
          defaultChain: chain,
          supportedChains: [chain],
          embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        }}
      >
        <QueryClientProvider client={qc}>
          <PrivyWagmiProvider config={privyWagmiConfig}>{children}</PrivyWagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
