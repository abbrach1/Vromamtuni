"use client";

import { useState } from "react";
import { days as DAY_LABELS, type DayKey, type FormField, type Text } from "@/config/program";
import { dateInWeek, type ISODate } from "@/lib/dates";
import { cellKey, formatHours, readBool, readNumber, type EntryData } from "@/lib/rules";
import { CheckIcon } from "@/components/icons";
import { useLang } from "@/i18n/client";

/** What every input needs to know about the week it's showing. */
export interface WeekContext {
  week: ISODate;
  today: ISODate;
  readOnly: boolean;
}

const dayLabel = (key: DayKey) => DAY_LABELS.find((d) => d.key === key)!;
const dayNumber = (week: ISODate, key: DayKey) => Number(dateInWeek(week, key).slice(8));

/** Future days can't be marked yet. */
function dayState(ctx: WeekContext, key: DayKey) {
  const date = dateInWeek(ctx.week, key);
  return { isToday: date === ctx.today, isFuture: date > ctx.today };
}

// ── A row of day toggles ──────────────────────────────────────────────────

export function DayRow({
  days,
  marks,
  onToggle,
  ctx,
}: {
  days: DayKey[];
  marks: Set<string>;
  onToggle: (mark: string) => void;
  ctx: WeekContext;
}) {
  const { m, t } = useLang();
  return (
    <div className="taprow" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
      {days.map((key) => {
        const on = marks.has(key);
        const { isToday, isFuture } = dayState(ctx, key);
        const label = dayLabel(key);
        return (
          <button
            key={key}
            type="button"
            className={`tap${isToday ? " tap--today" : ""}`}
            aria-pressed={on}
            aria-label={`${t(label.long)}${isToday ? `, ${m.today}` : ""}`}
            disabled={ctx.readOnly || (isFuture && !on)}
            onClick={() => onToggle(key)}
          >
            <span>{t(label.short)}</span>
            {on ? <CheckIcon /> : <span className="tap__date">{dayNumber(ctx.week, key)}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── A grid of day × slot toggles ──────────────────────────────────────────
// Days run down the side and slots across the top, so even a full week fits
// a phone screen with comfortable tap targets.

export function TapGrid({
  days,
  rows,
  marks,
  onToggle,
  minPerDay,
  ctx,
}: {
  days: DayKey[];
  rows: { key: string; label: Text }[];
  marks: Set<string>;
  onToggle: (mark: string) => void;
  /** When set, each day shows a dot that fills once enough slots are marked. */
  minPerDay?: number;
  ctx: WeekContext;
}) {
  const { m, t } = useLang();
  return (
    <div
      className="grid"
      role="group"
      style={{ gridTemplateColumns: `minmax(64px, 0.9fr) repeat(${rows.length}, minmax(0, 1fr))` }}
    >
      <span />
      {rows.map((r) => (
        <span key={r.key} className="grid__head">
          {t(r.label)}
        </span>
      ))}
      {days.map((key) => {
        const { isToday, isFuture } = dayState(ctx, key);
        const label = dayLabel(key);
        const marked = rows.filter((r) => marks.has(cellKey(key, r.key))).length;
        const dayMet = minPerDay !== undefined && marked >= minPerDay;
        return (
          <div key={key} style={{ display: "contents" }}>
            <span className={`grid__day${isToday ? " grid__day--today" : ""}`}>
              {minPerDay !== undefined && (
                <span
                  className={`daydot${dayMet ? " daydot--on" : ""}`}
                  title={dayMet ? m.dayCounts : m.needed(minPerDay)}
                >
                  <CheckIcon />
                </span>
              )}
              <span>
                {t(label.short)} <span className="muted" style={{ fontWeight: 400 }}>{dayNumber(ctx.week, key)}</span>
              </span>
            </span>
            {rows.map((r) => {
              const mark = cellKey(key, r.key);
              const on = marks.has(mark);
              return (
                <button
                  key={mark}
                  type="button"
                  className={`tap${isToday ? " tap--today" : ""}`}
                  aria-pressed={on}
                  aria-label={`${t(label.long)}, ${t(r.label)}`}
                  disabled={ctx.readOnly || (isFuture && !on)}
                  onClick={() => onToggle(mark)}
                >
                  {on && <CheckIcon />}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Number and checkbox fields ────────────────────────────────────────────

function roundToStep(n: number, step: number): number {
  return Number((Math.round(n / step) * step).toFixed(2));
}

function Stepper({
  id,
  value,
  step,
  max,
  onChange,
  disabled,
}: {
  id: string;
  value: number;
  step: number;
  max: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const { m } = useLang();
  const [draft, setDraft] = useState<string | null>(null);
  const set = (n: number) => onChange(Math.min(max, Math.max(0, roundToStep(n, step))));

  function commit() {
    if (draft === null) return;
    const n = Number.parseFloat(draft.replace(",", "."));
    set(Number.isFinite(n) ? n : 0);
    setDraft(null);
  }

  return (
    <div className="stepper">
      <button
        type="button"
        aria-label={m.less}
        disabled={disabled || value <= 0}
        onClick={() => set(value - step)}
      >
        −
      </button>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={draft ?? formatHours(value)}
        disabled={disabled}
        onFocus={(e) => {
          setDraft(formatHours(value));
          e.target.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <button
        type="button"
        aria-label={m.more}
        disabled={disabled || value >= max}
        onClick={() => set(value + step)}
      >
        +
      </button>
    </div>
  );
}

export function FormFields({
  reqId,
  fields,
  data,
  onChange,
  ctx,
}: {
  reqId: string;
  fields: FormField[];
  data: EntryData | undefined;
  onChange: (data: EntryData) => void;
  ctx: WeekContext;
}) {
  const { t } = useLang();
  function update(key: string, value: number | boolean) {
    const next: EntryData = { ...data, [key]: value };
    // Keep "at most" fields (e.g. hours on Shabbos ≤ total hours) consistent.
    for (const f of fields) {
      if (f.type === "number" && f.atMost) {
        next[f.key] = Math.min(readNumber(next, f.key), readNumber(next, f.atMost));
      }
    }
    onChange(next);
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      {fields.map((f) => {
        const id = `${reqId}-${f.key}`;
        if (f.type === "number") {
          const value = readNumber(data, f.key);
          const max = f.atMost ? Math.min(f.max, readNumber(data, f.atMost)) : f.max;
          return (
            <div key={f.key} className="numfield">
              <label htmlFor={id} className="numfield__label">
                {t(f.label)}
              </label>
              <Stepper
                id={id}
                value={value}
                step={f.step}
                max={max}
                disabled={ctx.readOnly}
                onChange={(v) => update(f.key, v)}
              />
            </div>
          );
        }
        const on = readBool(data, f.key);
        return (
          <label key={f.key} className="checkrow">
            <input
              type="checkbox"
              checked={on}
              disabled={ctx.readOnly}
              onChange={(e) => update(f.key, e.target.checked)}
            />
            <span className="checkmark">
              <CheckIcon width={16} height={16} />
            </span>
            <span>{t(f.label)}</span>
          </label>
        );
      })}
    </div>
  );
}
