"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Eligibility } from "@/lib/compliance";
import { useSolanaWallet } from "./solana-wallet";

export function useEligibility() {
  const { address } = useSolanaWallet();
  const a = address?.toBase58();
  return useQuery({
    queryKey: ["eligibility", a],
    enabled: !!a,
    refetchInterval: false,
    queryFn: async (): Promise<Eligibility> => {
      const r = await fetch(`/api/eligibility?address=${a}`, { cache: "no-store" });
      if (!r.ok) throw new Error("Eligibility check failed");
      return r.json();
    },
  });
}

/** Wraps actions that move funds into yield. Ineligible users see why, and can still read everything else. */
export function EligibilityGate({ children, action }: { children: ReactNode; action: string }) {
  const q = useEligibility();
  if (q.isLoading) return <p className="muted">Checking eligibility</p>;
  if (q.isError) return <p className="app-error">Eligibility could not be checked. Reload the page to try again.</p>;
  if (!q.data?.eligible) {
    return (
      <div className="gate" role="note">
        <p>
          <strong>{action} is not available for this wallet.</strong> {q.data?.reason}
        </p>
        <a className="text-link" href="/app/settings">
          See eligibility status
        </a>
      </div>
    );
  }
  return <>{children}</>;
}
