import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Providers } from "@/components/app/Providers";

export const metadata: Metadata = { title: { default: "App", template: "%s | Unslept app" }, robots: { index: false } };

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <AppShell configured>{children}</AppShell>
    </Providers>
  );
}
