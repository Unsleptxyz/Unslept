"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hero background. The scene module (and three.js with it) loads only after the page is idle,
 * so the headline paints first. Without WebGL, or before it loads, a CSS skyline poster shows instead.
 */
export function NightCity() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let stop: (() => void) | undefined;
    let cancelled = false;

    const supportsWebGL = (() => {
      try {
        const c = document.createElement("canvas");
        return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
      } catch {
        return false;
      }
    })();
    if (!supportsWebGL) return;

    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPower = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4 || window.innerWidth < 700;

    const load = () => {
      import("./nightcity-scene")
        .then((mod) => {
          if (cancelled) return;
          stop = mod.startCity(canvas, { reducedMotion, lowPower });
          requestAnimationFrame(() => setReady(true));
        })
        .catch(() => undefined);
    };

    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    let idleId: number | undefined;
    const schedule = () => {
      if (w.requestIdleCallback) idleId = w.requestIdleCallback(load, { timeout: 2500 });
      else idleId = window.setTimeout(load, 900);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (idleId !== undefined) {
        const wc = window as Window & { cancelIdleCallback?: (h: number) => void };
        if (wc.cancelIdleCallback) wc.cancelIdleCallback(idleId);
        window.clearTimeout(idleId);
      }
      stop?.();
    };
  }, []);

  return (
    <div className="nightcity" data-ready={ready} aria-hidden="true">
      <div className="nightcity__poster">
        <div className="nightcity__moon" />
        <div className="nightcity__skyline" />
      </div>
      <canvas ref={ref} className="nightcity__canvas" />
      <div className="nightcity__shade" />
    </div>
  );
}
