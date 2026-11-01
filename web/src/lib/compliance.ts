/**
 * Pluggable compliance provider for access to yield features: jurisdiction (geo) and KYC status.
 * Select with COMPLIANCE_PROVIDER:
 *   - "allowlist": KYC passes for addresses in COMPLIANCE_ALLOWLIST (comma-separated). For a controlled launch.
 *   - "http":      POST {address, country} to COMPLIANCE_API_URL with Bearer COMPLIANCE_API_KEY.
 *                  Expected reply: { kyc: "verified" | "pending" | "rejected" | "none", reason?: string }
 *   - unset:       no identity verification. Access is decided by the geo rules alone.
 * Geo: COMPLIANCE_BLOCKED_COUNTRIES (ISO 3166-1 alpha-2, comma-separated) and/or COMPLIANCE_ALLOWED_COUNTRIES.
 */

export type KycStatus = "verified" | "pending" | "rejected" | "none" | "unavailable";

export interface Eligibility {
  eligible: boolean;
  country: string | null;
  geo: "allowed" | "blocked" | "unknown";
  kyc: KycStatus;
  reason: string;
  provider: string;
}

export interface ComplianceProvider {
  name: string;
  kycStatus(address: string, country: string | null): Promise<{ kyc: KycStatus; reason?: string }>;
}

const list = (v?: string) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function providerFromEnv(): ComplianceProvider | undefined {
  const kind = process.env.COMPLIANCE_PROVIDER?.trim();
  if (kind === "allowlist") {
    const allowed = new Set(list(process.env.COMPLIANCE_ALLOWLIST).map((a) => a.toLowerCase()));
    return {
      name: "allowlist",
      async kycStatus(address) {
        return allowed.has(address) || allowed.has(address.toLowerCase()) ? { kyc: "verified" } : { kyc: "none", reason: "Address is not on the access list." };
      },
    };
  }
  if (kind === "http") {
    const url = process.env.COMPLIANCE_API_URL;
    const key = process.env.COMPLIANCE_API_KEY;
    if (!url) return undefined;
    return {
      name: "http",
      async kycStatus(address, country) {
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
            body: JSON.stringify({ address, country }),
            signal: AbortSignal.timeout(5000),
            cache: "no-store",
          });
          if (!r.ok) return { kyc: "unavailable", reason: `Provider answered ${r.status}.` };
          const j = (await r.json()) as { kyc?: KycStatus; reason?: string };
          return { kyc: j.kyc ?? "none", reason: j.reason };
        } catch {
          return { kyc: "unavailable", reason: "Provider did not respond." };
        }
      },
    };
  }
  return undefined;
}

export function geoStatus(country: string | null): Eligibility["geo"] {
  const blocked = list(process.env.COMPLIANCE_BLOCKED_COUNTRIES).map((c) => c.toUpperCase());
  const allowed = list(process.env.COMPLIANCE_ALLOWED_COUNTRIES).map((c) => c.toUpperCase());
  if (!country) return allowed.length ? "unknown" : "allowed";
  const c = country.toUpperCase();
  if (blocked.includes(c)) return "blocked";
  if (allowed.length && !allowed.includes(c)) return "blocked";
  return "allowed";
}

export async function checkEligibility(address: string, country: string | null): Promise<Eligibility> {
  const geo = geoStatus(country);
  const provider = providerFromEnv();
  if (geo === "blocked") {
    return { eligible: false, country, geo, kyc: "none", provider: provider?.name ?? "none", reason: "Kamino lending are not available in your jurisdiction." };
  }
  if (geo === "unknown") {
    return { eligible: false, country, geo, kyc: "none", provider: provider?.name ?? "none", reason: "Your jurisdiction could not be determined." };
  }
  if (!provider) {
    return { eligible: true, country, geo, kyc: "none", provider: "none", reason: "No identity verification is required." };
  }
  const k = await provider.kycStatus(address, country);
  const messages: Record<KycStatus, string> = {
    verified: "Verified. You can use Kamino lending.",
    pending: "Verification is in review. Actions that touch Kamino lending unlock once it passes.",
    rejected: "Verification did not pass. Contact support to review it.",
    none: "Complete identity verification to use Kamino lending.",
    unavailable: "The verification service is unavailable. Try again in a few minutes.",
  };
  return { eligible: k.kyc === "verified", country, geo, kyc: k.kyc, provider: provider.name, reason: k.reason ?? messages[k.kyc] };
}
