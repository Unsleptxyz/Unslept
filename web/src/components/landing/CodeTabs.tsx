"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { highlight } from "@/lib/highlight";

export interface CodeTab {
  label: string;
  filename: string;
  code: string;
}

/**
 * Accessible tabs for code samples. Without JavaScript every panel is visible,
 * stacked, so the content stays readable (inactive panels are hidden only
 * under html.js).
 */
export function CodeTabs({ tabs }: { tabs: CodeTab[] }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState<number | null>(null);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  }

  async function copy(i: number) {
    try {
      await navigator.clipboard.writeText(tabs[i].code);
      setCopied(i);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="code-tabs">
      <div role="tablist" aria-label="Integration options" className="code-tabs__list js-only-flex">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${base}-tab-${i}`}
            aria-selected={active === i}
            aria-controls={`${base}-panel-${i}`}
            tabIndex={active === i ? 0 : -1}
            className="code-tabs__tab"
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.label}
          role="tabpanel"
          id={`${base}-panel-${i}`}
          aria-labelledby={`${base}-tab-${i}`}
          className="code-tabs__panel"
          data-active={active === i}
          tabIndex={0}
        >
          <div className="code-tabs__bar">
            <span className="code-tabs__file">{t.filename}</span>
            <button type="button" className="code-tabs__copy js-only" onClick={() => copy(i)}>
              {copied === i ? "Copied" : "Copy"}
            </button>
          </div>
          <pre>
            <code>{highlight(t.code)}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}
