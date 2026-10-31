"use client";

import { useEffect, useRef, useState } from "react";

/** A shell command with a copy button. Without JavaScript it is plain selectable text. */
export function CopyCommand({ command, label }: { command: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="copy-cmd">
      {label ? <span className="copy-cmd__label">{label}</span> : null}
      <code className="copy-cmd__code">
        <span className="copy-cmd__prompt" aria-hidden="true">
          $
        </span>
        {command}
      </code>
      <button type="button" className="copy-cmd__btn js-only" onClick={copy} aria-label={`Copy ${command}`}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/**
 * Counts up to a formatted value once it scrolls into view. The final value is server rendered,
 * so search engines, screen readers and visitors without JavaScript always see the real number.
 */
export function CountUp({ value, format }: { value: number; format: "usd" | "int" | "pct" }) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = (v: number) =>
    format === "usd"
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: v >= 10_000 ? "compact" : "standard", maximumFractionDigits: 2 }).format(v)
      : format === "pct"
        ? `${v.toFixed(2)}%`
        : new Intl.NumberFormat("en-US").format(Math.round(v));
  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const dur = 1400;
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - t, 4);
          el.textContent = fmt(value * eased);
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, format]);
  return <span ref={ref}>{fmt(value)}</span>;
}

/** A small copy button for code blocks. */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button type="button" className="code-block__copy js-only" onClick={copy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
