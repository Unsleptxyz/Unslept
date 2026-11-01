"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { privyAppId } from "@/lib/solana";
import { SolanaWalletProvider } from "./solana-wallet";

const connectors = typeof window !== "undefined" ? toSolanaWalletConnectors({ shouldAutoConnect: true }) : undefined;

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchInterval: 15_000, staleTime: 5_000 } } }));
  if (!privyAppId) {
    return (
      <QueryClientProvider client={qc}>
        <SolanaWalletProvider>{children}</SolanaWalletProvider>
      </QueryClientProvider>
    );
  }
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
          walletChainType: "solana-only",
        },
        externalWallets: { solana: { connectors } },
        embeddedWallets: { solana: { createOnLogin: "users-without-wallets" } },
      }}
    >
      <QueryClientProvider client={qc}>
        <SolanaWalletProvider privy>{children}</SolanaWalletProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
