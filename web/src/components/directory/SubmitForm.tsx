"use client";

import { useState, type FormEvent } from "react";

type Category = { id: string; label: string };

export function SubmitForm({ categories }: { categories: readonly Category[] }) {
  const [state, setState] = useState<{ kind: "idle" | "busy" | "ok" | "error"; text?: string }>({ kind: "idle" });

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setState({ kind: "busy" });
    try {
      const r = await fetch("/api/directory/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (r.ok && j.ok) {
        setState({ kind: "ok", text: "Listed. The endpoint answered 402 with a valid USDG offer and appears in the directory within a minute." });
        form.reset();
      } else setState({ kind: "error", text: j.error ?? "The endpoint could not be listed." });
    } catch {
      setState({ kind: "error", text: "The request failed. Check your connection and try again." });
    }
  }

  return (
    <form className="card dir-form" onSubmit={submit}>
      <div className="dir-form__grid">
        <div className="field dir-form__wide">
          <label htmlFor="df-url">Endpoint URL</label>
          <input id="df-url" name="url" type="url" required placeholder="https://api.example.com/v1/quote" />
        </div>
        <div className="field">
          <label htmlFor="df-name">Name</label>
          <input id="df-name" name="name" required maxLength={80} placeholder="Weather now" />
        </div>
        <div className="field">
          <label htmlFor="df-cat">Category</label>
          <select id="df-cat" name="category" defaultValue="data">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="df-provider">
            Provider <span className="field__optional">optional</span>
          </label>
          <input id="df-provider" name="provider" maxLength={80} placeholder="Your company or handle" />
        </div>
        <div className="field">
          <label htmlFor="df-site">
            Website <span className="field__optional">optional</span>
          </label>
          <input id="df-site" name="website" type="url" placeholder="https://example.com" />
        </div>
        <div className="field dir-form__wide">
          <label htmlFor="df-desc">What it returns</label>
          <textarea id="df-desc" name="description" maxLength={280} rows={3} placeholder="One or two sentences an agent developer can act on." />
        </div>
        <input className="dir-form__hp" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      </div>
      <div className="dir-form__foot">
        <p className="muted small">
          We call your endpoint once without payment. It must answer HTTP 402 with an x402 v2 PAYMENT-REQUIRED header offering
          USDG on Robinhood Chain.
        </p>
        <button className="btn btn--primary" type="submit" disabled={state.kind === "busy"}>
          {state.kind === "busy" ? "Checking the endpoint" : "List my endpoint"}
        </button>
      </div>
      {state.kind === "ok" || state.kind === "error" ? (
        <p className={state.kind === "ok" ? "dir-form__ok" : "app-error"} role="status">
          {state.text}
        </p>
      ) : null}
    </form>
  );
}
