"use client";

import { program } from "@/config/program";
import { useLang } from "@/i18n/client";
import { Motes, Ring, useCountUp } from "./motion";

export interface Pulse {
  marked: number;
  total: number;
}

/**
 * What the tablet shows while nobody is using it: the gold logo with a slow
 * shimmer, the week, and how many bachurim have marked this week, rising as
 * they do. Any tap goes back to the names. Always gold on black, whatever
 * the tablet's theme.
 */
export function Attract({
  pulse,
  parsha,
  dateLabel,
  onWake,
}: {
  pulse: Pulse | null;
  parsha: string | null;
  dateLabel: string;
  onWake: () => void;
}) {
  const { m, t } = useLang();
  const marked = useCountUp(pulse?.marked ?? 0);
  const logo = program.logoDark || program.logo;
  return (
    <button type="button" className="attract" onClick={onWake} aria-label={m.kioskTapToBegin}>
      <Motes count={22} />
      <span className="attract__glow" aria-hidden />
      <span className="attract__logo" style={{ "--logo": `url("${logo}")` } as React.CSSProperties}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" />
        <span className="attract__shine" aria-hidden />
      </span>
      <span className="attract__tagline">{t(program.tagline)}</span>
      <span className="attract__week">
        {parsha && <strong>{parsha}</strong>}
        <span>{dateLabel}</span>
      </span>
      {pulse && pulse.total > 0 && (
        <span className="attract__pulse">
          <Ring value={pulse.marked} max={pulse.total} size={168} stroke={5}>
            <span className="attract__count">{marked}</span>
          </Ring>
          <span className="attract__pulseline">{m.kioskPulse(pulse.marked, pulse.total)}</span>
        </span>
      )}
      <span className="attract__cta">{m.kioskTapToBegin}</span>
    </button>
  );
}
