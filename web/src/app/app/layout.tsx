import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell, NotConfigured } from "@/components/app/AppShell";
import { Providers } from "@/components/app/Providers";
import { isConfigured, missingConfig } from "@/lib/web3";

export const metadata: Metadata = { title: { default: "App", template: "%s | Unslept app" }, robots: { index: false } };

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <AppShell configured={isConfigured}>{isConfigured ? children : <NotConfigured missing={missingConfig} />}</AppShell>
    </Providers>
  );
}
