"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAccount } from "wagmi";
import type { Eligibility } from "@/lib/compliance";

export function useEligibility() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["eligibility", address],
    enabled: !!address,
    refetchInterval: false,
    queryFn: async (): Promise<Eligibility> => {
      const r = await fetch(`/api/eligibility?address=${address}`, { cache: "no-store" });
      if (!r.ok) throw new Error("Eligibility check failed");
      return r.json();
    },
  });
}

/**
 * Wraps any action that touches tokenized assets. Ineligible users see why, and can still read everything else.
 */
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
