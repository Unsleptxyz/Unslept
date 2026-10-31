"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "unslept-theme";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/**
 * Manual theme toggle. Without a stored choice, the OS preference decides.
 * Hidden when JavaScript is off (the html.js class is set by the bootstrap script).
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      stored = null;
    }
    setTheme(stored === "light" || stored === "dark" ? stored : systemTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable: the choice lasts for this page view */
    }
    setTheme(next);
  }

  const label = theme === "light" ? "Switch to dark theme" : "Switch to light theme";

  return (
    <button type="button" className="theme-toggle js-only" onClick={toggle} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        {theme === "light" ? (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        ) : (
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
          </g>
        )}
      </svg>
    </button>
  );
}

/** Inline script that runs before paint so a stored theme never flashes. */
export const themeBootstrap = `(function(){try{var d=document.documentElement;d.classList.add('js');var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark'){d.dataset.theme=t;}}catch(e){document.documentElement.classList.add('js');}})();`;
