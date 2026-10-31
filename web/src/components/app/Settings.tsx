"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useEligibility } from "./Eligibility";

type ThemeChoice = "system" | "light" | "dark";

function useThemeChoice(): [ThemeChoice, (t: ThemeChoice) => void] {
  const [t, setT] = useState<ThemeChoice>("system");
  useEffect(() => {
    try {
      const s = localStorage.getItem("unslept-theme");
      setT(s === "light" || s === "dark" ? s : "system");
    } catch {
      setT("system");
    }
  }, []);
  return [
    t,
    (next) => {
      setT(next);
      try {
        if (next === "system") {
          localStorage.removeItem("unslept-theme");
          delete document.documentElement.dataset.theme;
        } else {
          localStorage.setItem("unslept-theme", next);
          document.documentElement.dataset.theme = next;
        }
      } catch {
        if (next !== "system") document.documentElement.dataset.theme = next;
      }
    },
  ];
}

export function SettingsPage() {
  const [theme, setTheme] = useThemeChoice();
  const { isConnected } = useAccount();
  return (
    <div className="app-page">
      <h1 className="display app-title">Settings</h1>
      <section className="app-panel" aria-labelledby="theme">
        <h2 id="theme">Theme</h2>
        <fieldset className="checks">
          <legend className="sr-only">Theme</legend>
          {(["system", "light", "dark"] as const).map((o) => (
            <label key={o}>
              <input type="radio" name="theme" checked={theme === o} onChange={() => setTheme(o)} /> {o === "system" ? "Match my device" : o === "light" ? "Light" : "Dark"}
            </label>
          ))}
        </fieldset>
      </section>
      <section className="app-panel" aria-labelledby="notif">
        <h2 id="notif">Notifications</h2>
        <p className="muted">
          Alerts for low balances and policy violations are delivered by webhook. Set one up on the{" "}
          <a className="text-link" href="/app/developers">
            Developers page
          </a>
          .
        </p>
      </section>
      <section className="app-panel" aria-labelledby="elig">
        <h2 id="elig">Eligibility</h2>
        {isConnected ? <EligibilityStatus /> : <p className="muted">Connect a wallet to see its eligibility for tokenized assets.</p>}
      </section>
    </div>
  );
}

function EligibilityStatus() {
  const q = useEligibility();
  if (q.isLoading) return <p className="muted">Checking eligibility</p>;
  if (!q.data) return <p className="app-error">Eligibility could not be checked. Reload the page to try again.</p>;
  const e = q.data;
  return (
    <dl className="kv-list">
      <div>
        <dt>Status</dt>
        <dd>{e.eligible ? "Eligible for tokenized assets" : "Not eligible yet"}</dd>
      </div>
      <div>
        <dt>Jurisdiction</dt>
        <dd>{e.country ? `${e.country}, ${e.geo === "allowed" ? "supported" : "not supported"}` : "Not detected"}</dd>
      </div>
      {e.provider !== "none" ? (
        <div>
          <dt>Identity verification</dt>
          <dd>{e.kyc}</dd>
        </div>
      ) : null}
      <div>
        <dt>Details</dt>
        <dd>{e.reason}</dd>
      </div>
    </dl>
  );
}
