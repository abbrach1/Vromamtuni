"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Small pieces of motion for the wall tablet. Everything here moves with CSS
 * transforms and opacity only, so it stays smooth on a mid-range Android
 * tablet, and the CSS turns it all off for prefers-reduced-motion.
 */

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** A short tick on tablets that can vibrate. Silent everywhere else. */
export function buzz() {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* no vibration motor */
  }
}

/** Counts from the previous value up (or down) to `target`. */
export function useCountUp(target: number, ms = 1100): number {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (reducedMotion()) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(begin + (target - begin) * eased);
      setShown(v);
      if (p < 1) frame = requestAnimationFrame(step);
      else from.current = target;
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      from.current = target;
    };
  }, [target, ms]);
  return shown;
}

/** Fixed pseudo-random numbers, so server and client draw the same motes. */
function seeded(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Specks of gold light drifting upward. Purely decorative. */
export function Motes({ count = 18 }: { count?: number }) {
  return (
    <div className="motes" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          style={
            {
              "--x": `${(seeded(i + 1) * 100).toFixed(1)}%`,
              "--s": `${(2 + seeded(i + 7) * 4).toFixed(1)}px`,
              "--t": `${(9 + seeded(i + 13) * 9).toFixed(1)}s`,
              "--d": `${(-seeded(i + 19) * 18).toFixed(1)}s`,
              "--o": (0.35 + seeded(i + 23) * 0.55).toFixed(2),
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** A burst of gold sparks that rise and fade, for a goal just met. */
export function Sparks({ big = false }: { big?: boolean }) {
  const n = big ? 22 : 12;
  return (
    <span className={`sparks${big ? " sparks--big" : ""}`} aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        // Fan upward: angles from -150° to -30°, a little jitter.
        const a = -150 + (120 * i) / (n - 1) + (seeded(i + 3) - 0.5) * 10;
        const d = (big ? 90 : 56) + seeded(i + 11) * (big ? 80 : 40);
        return (
          <i
            key={i}
            style={
              {
                "--a": `${a.toFixed(1)}deg`,
                "--r": `${d.toFixed(0)}px`,
                "--w": `${(i % 3) * 60}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}

/** A thin gold ring that fills to value / max, with whatever sits inside it. */
export function Ring({
  value,
  max,
  size = 220,
  stroke = 6,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [fill, setFill] = useState(0);
  // Start empty, then fill, so the ring visibly rises.
  useEffect(() => {
    const id = requestAnimationFrame(() => setFill(max > 0 ? Math.min(1, value / max) : 0));
    return () => cancelAnimationFrame(id);
  }, [value, max]);
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fill)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring__inner">{children}</div>
    </div>
  );
}
