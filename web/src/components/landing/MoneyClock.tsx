"use client";

import { memo, useEffect, useRef, useState } from "react";

/**
 * The money clock. A 24-hour dial with night hours shaded and one continuous
 * Sodium lamp arc that never breaks. The only animated element on page load.
 * Under prefers-reduced-motion the dial renders static (CSS handles the arc)
 * and the counter updates once per second without motion.
 */

const SIZE = 400;
const C = SIZE / 2;
const FACE_R = 150;
const ARC_R = 172;
const NIGHT_START = 20; // 20:00
const NIGHT_END = 6; // 06:00

// Illustration inputs. Shown on screen next to the counter.
const EXAMPLE_BALANCE = 25_000;
const ILLUSTRATIVE_RATE = 0.04;
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
const PER_SECOND = (EXAMPLE_BALANCE * ILLUSTRATIVE_RATE) / SECONDS_PER_YEAR;

function polar(hour: number, r: number) {
  const a = ((hour / 24) * 360 - 90) * (Math.PI / 180);
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
}

function wedge(fromHour: number, toHour: number, r: number) {
  const span = (toHour - fromHour + 24) % 24;
  const start = polar(fromHour, r);
  const end = polar(toHour, r);
  const large = span > 12 ? 1 : 0;
  return `M ${C} ${C} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

const usd = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const micro = new Intl.NumberFormat("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 });

/** The counter writes its own text node, so the dial never re-renders on each tick. */
function EarnedCounter() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();
    let id = 0;
    const start = () => {
      const tick = () => {
        if (ref.current) ref.current.textContent = micro.format(((performance.now() - started) / 1000) * PER_SECOND);
      };
      tick();
      id = window.setInterval(tick, reduce ? 1000 : 100);
    };
    // Start after the page is idle so the first paint and hydration are not competing with the counter.
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const idle = ric ? ric(start, { timeout: 2000 }) : window.setTimeout(start, 1200);
    return () => {
      window.clearInterval(id);
      const cic = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (ric && cic) cic(idle as number);
      else window.clearTimeout(idle as number);
    };
  }, []);
  return <span ref={ref}>{micro.format(0)}</span>;
}

export function MoneyClock() {
  // Server render shows 4 a.m., the night shift. The client moves the marker to local time, once a minute.
  const [hour, setHour] = useState(4);

  useEffect(() => {
    const set = () => {
      const now = new Date();
      setHour(now.getHours() + now.getMinutes() / 60);
    };
    set();
    const id = window.setInterval(set, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return <ClockFigure hour={hour} />;
}

const ClockFigure = memo(function ClockFigure({ hour }: { hour: number }) {
  const marker = polar(hour, ARC_R);
  const hand = polar(hour, FACE_R - 18);
  const circumference = 2 * Math.PI * ARC_R;

  const ticks = Array.from({ length: 24 }, (_, h) => {
    const major = h % 6 === 0;
    const a = polar(h, FACE_R - (major ? 16 : 9));
    const b = polar(h, FACE_R - 3);
    return (
      <line
        key={h}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        className={major ? "clock-tick clock-tick--major" : "clock-tick"}
      />
    );
  });

  const labels = [0, 6, 12, 18].map((h) => {
    const p = polar(h, FACE_R - 34);
    return (
      <text key={h} x={p.x} y={p.y} className="clock-label" textAnchor="middle" dominantBaseline="central">
        {String(h).padStart(2, "0")}
      </text>
    );
  });

  // A small grid of windows at the center. Only one is lit.
  const windows = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const lit = row === 1 && col === 2;
      windows.push(
        <rect
          key={`${row}-${col}`}
          x={C - 33 + col * 24}
          y={C - 40 + row * 28}
          width={16}
          height={20}
          rx={2}
          className={lit ? "clock-window clock-window--lit" : "clock-window"}
        />,
      );
    }
  }

  return (
    <figure className="money-clock">
      <div className="money-clock__dial">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-labelledby="clock-title clock-desc"
          className="money-clock__svg"
        >
          <title id="clock-title">The money clock</title>
          <desc id="clock-desc">
            A 24-hour dial. Night hours from 20:00 to 06:00 are shaded. One continuous lit arc runs all the way
            around the dial: the balance keeps working through every hour.
          </desc>

          <circle cx={C} cy={C} r={FACE_R} className="clock-face" />
          <path d={wedge(NIGHT_START, NIGHT_END, FACE_R)} className="clock-night" />
          <circle cx={C} cy={C} r={FACE_R} className="clock-rim" />
          {ticks}
          {labels}
          {windows}

          <circle cx={C} cy={C} r={ARC_R} className="clock-arc-track" />
          {/* Glow is a wide faint stroke instead of an SVG blur filter: same look, no per-frame blur repaint. */}
          <circle
            cx={C}
            cy={C}
            r={ARC_R}
            className="clock-arc clock-arc--glow"
            style={{ strokeDasharray: circumference, ["--arc-length" as string]: `${circumference}` }}
            transform={`rotate(-90 ${C} ${C})`}
          />
          <circle
            cx={C}
            cy={C}
            r={ARC_R}
            className="clock-arc"
            style={{ strokeDasharray: circumference, ["--arc-length" as string]: `${circumference}` }}
            transform={`rotate(-90 ${C} ${C})`}
          />
          <g className="clock-comet" style={{ transformOrigin: `${C}px ${C}px` }}>
            <circle
              cx={C}
              cy={C}
              r={ARC_R}
              className="clock-comet__trail"
              style={{ strokeDasharray: `${circumference * 0.08} ${circumference}` }}
              transform={`rotate(-90 ${C} ${C})`}
            />
          </g>

          <line x1={C} y1={C} x2={hand.x} y2={hand.y} className="clock-hand" />
          <circle cx={C} cy={C} r={3.5} className="clock-hub" />
          <circle cx={marker.x} cy={marker.y} r={9} className="clock-marker-ring" />
          <circle cx={marker.x} cy={marker.y} r={4.5} className="clock-marker" />
        </svg>
      </div>

      <figcaption className="money-clock__counter">
        <p className="counter__label">Example balance</p>
        <p className="counter__balance num">{usd.format(EXAMPLE_BALANCE)} USDG</p>
        <p className="counter__label">Earned while you read</p>
        <p className="counter__earned num" aria-live="off">
          +<EarnedCounter /> USDG
        </p>
        <p className="counter__rate num">+{micro.format(PER_SECOND)} USDG per second</p>
        <p className="counter__note">
          Illustration only. Assumes a variable rate of {(ILLUSTRATIVE_RATE * 100).toFixed(2)}% a year on an
          example balance. Not a projection. Actual rates vary and can fall.
        </p>
      </figcaption>
    </figure>
  );
});
