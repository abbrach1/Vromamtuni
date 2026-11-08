/**
 * The rules engine: turns what a bachur logged into "Met" / "In progress"
 * and a progress line. Pure functions only, shared by the bachur's screen,
 * the staff overview and the CSV export. Targets come from the config.
 */

import {
  fill,
  requirementById,
  type DayKey,
  type FormField,
  type Lang,
  type Requirement,
} from "@/config/program";
import { weekWindow, type ISODate } from "./dates";

/** What is stored per bachur, per week, per requirement. */
export type EntryData = Record<string, unknown>;

/** week start → requirement id → data */
export type ProgressByWeek = Record<ISODate, Record<string, EntryData>>;

export type Status = "met" | "in-progress" | "not-met" | "tracked";

export interface WeekResult {
  /** null = tracked only (no target) */
  met: boolean | null;
  line: string;
}

export interface Evaluation {
  status: Status;
  /** Main progress line, e.g. "3 of 4 days". */
  line: string;
  /** Extra line for rolling requirements: what was logged this week. */
  thisWeek?: string;
}

// ── Reading stored values safely ──────────────────────────────────────────

export function readNumber(data: EntryData | undefined, key: string): number {
  const v = data?.[key];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

export function readBool(data: EntryData | undefined, key: string): boolean {
  return data?.[key] === true;
}

export function readMarks(data: EntryData | undefined): Set<string> {
  const v = data?.marks;
  return new Set(Array.isArray(v) ? v.filter((m): m is string => typeof m === "string") : []);
}

/** The key stored for a grid cell. */
export function cellKey(day: DayKey, row: string): string {
  return `${day}.${row}`;
}

/** 3 → "3", 2.5 → "2.5" */
export function formatHours(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

function fieldValue(field: FormField, data: EntryData | undefined): number | boolean {
  if (field.type === "checkbox") return readBool(data, field.key);
  let v = readNumber(data, field.key);
  if (field.atMost) v = Math.min(v, readNumber(data, field.atMost));
  return v;
}

/** The few words the progress lines are built from. */
const WORDS = {
  en: {
    of: (a: string | number, b: string | number) => `${a} of ${b}`,
    days: "days",
    kept: (n: number, of: number) => `Kept ${n} of ${of} days`,
    thisWeek: "This week: ",
  },
  he: {
    of: (a: string | number, b: string | number) => `${a} מתוך ${b}`,
    days: "ימים",
    kept: (n: number, of: number) => `עמד בזה ${n} מתוך ${of} ימים`,
    thisWeek: "השבוע: ",
  },
};

// ── One week ──────────────────────────────────────────────────────────────

export function evaluateWeek(req: Requirement, data: EntryData | undefined, lang: Lang = "en"): WeekResult {
  const m = req.measure;
  const w = WORDS[lang];

  if (m.kind === "form") {
    const parts: string[] = [];
    let met = true;
    for (const field of m.fields) {
      const value = fieldValue(field, data);
      if (field.type === "number") {
        const n = value as number;
        if (n < field.target) met = false;
        parts.push(`${w.of(formatHours(n), formatHours(field.target))} ${field.summary[lang]}`);
      } else {
        const on = value as boolean;
        if (field.required && !on) met = false;
        parts.push((on ? field.summaryOn : field.summaryOff)[lang]);
      }
    }
    const line = parts.join(" · ");
    return { met, line: line.charAt(0).toUpperCase() + line.slice(1) };
  }

  const marks = readMarks(data);

  if (m.kind === "days") {
    const count = m.days.filter((d) => marks.has(d)).length;
    if (m.target === null) return { met: null, line: w.kept(count, m.days.length) };
    return { met: count >= m.target, line: `${w.of(Math.min(count, m.target), m.target)} ${w.days}` };
  }

  // grid
  if (m.goal.per === "day") {
    const minPerDay = m.goal.minPerDay;
    const goodDays = m.days.filter(
      (d) => m.rows.filter((r) => marks.has(cellKey(d, r.key))).length >= minPerDay,
    ).length;
    const target = m.goal.days;
    return { met: goodDays >= target, line: `${w.of(Math.min(goodDays, target), target)} ${w.days}` };
  }
  const cells = m.days.reduce(
    (sum, d) => sum + m.rows.filter((r) => marks.has(cellKey(d, r.key))).length,
    0,
  );
  const target = m.goal.count;
  return { met: cells >= target, line: `${w.of(Math.min(cells, target), target)} ${m.cellUnit[lang]}` };
}

// ── A requirement for a selected week (handles rolling windows) ───────────

export function hasTarget(req: Requirement): boolean {
  return !(req.measure.kind === "days" && req.measure.target === null);
}

export function evaluate(
  req: Requirement,
  progress: ProgressByWeek,
  week: ISODate,
  currentWeek: ISODate,
  lang: Lang = "en",
): Evaluation {
  const thisWeek = evaluateWeek(req, progress[week]?.[req.id], lang);
  const notMet: Status = week < currentWeek ? "not-met" : "in-progress";

  if (thisWeek.met === null) return { status: "tracked", line: thisWeek.line };

  if (!req.rolling) {
    return { status: thisWeek.met ? "met" : notMet, line: thisWeek.line };
  }

  const { weeks, required, line } = req.rolling;
  const metWeeks = weekWindow(week, weeks).filter(
    (w) => evaluateWeek(req, progress[w]?.[req.id]).met,
  ).length;
  return {
    status: metWeeks >= required ? "met" : notMet,
    line: fill(line[lang], { met: metWeeks, weeks, required }),
    thisWeek:
      WORDS[lang].thisWeek +
      (lang === "en" ? thisWeek.line.charAt(0).toLowerCase() + thisWeek.line.slice(1) : thisWeek.line),
  };
}

// ── A bachur's whole week ─────────────────────────────────────────────────

export interface WeekSummary {
  met: number;
  /** Requirements with a target (tracked-only ones like Sur Me'ra are left out). */
  total: number;
  results: { req: Requirement; evaluation: Evaluation }[];
}

export function summarizeWeek(
  selectedIds: readonly string[],
  progress: ProgressByWeek,
  week: ISODate,
  currentWeek: ISODate,
  lang: Lang = "en",
): WeekSummary {
  const results = selectedIds
    .map((id) => requirementById.get(id))
    .filter((r): r is Requirement => Boolean(r))
    .map((req) => ({ req, evaluation: evaluate(req, progress, week, currentWeek, lang) }));
  const counted = results.filter((r) => hasTarget(r.req));
  return {
    met: counted.filter((r) => r.evaluation.status === "met").length,
    total: counted.length,
    results,
  };
}

export type Trend = "all" | "some" | "none";

export function trendOf(summary: Pick<WeekSummary, "met" | "total">): Trend {
  if (summary.total > 0 && summary.met === summary.total) return "all";
  return summary.met > 0 ? "some" : "none";
}

/** How many weeks of data a screen must load to evaluate `weeksShown` weeks. */
export function weeksNeeded(weeksShown: number, requirements: Requirement[]): number {
  const longestWindow = Math.max(1, ...requirements.map((r) => r.rolling?.weeks ?? 1));
  return weeksShown + longestWindow - 1;
}
