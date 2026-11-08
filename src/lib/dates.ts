/**
 * Week math on plain "YYYY-MM-DD" strings. Weeks run Sunday to Shabbos and
 * are identified by their Sunday. All arithmetic is done in UTC so daylight
 * saving changes can't shift a date.
 */

import type { DayKey, Lang } from "@/config/program";

export type ISODate = string;

const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function toUTC(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUTC(toUTC(value)) === value;
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
}

export function addWeeks(iso: ISODate, n: number): ISODate {
  return addDays(iso, n * 7);
}

/** 0 = Sunday … 6 = Shabbos */
export function dayIndex(iso: ISODate): number {
  return toUTC(iso).getUTCDay();
}

export function dayKeyOf(iso: ISODate): DayKey {
  return DAY_KEYS[dayIndex(iso)];
}

/** The Sunday that starts the week containing `iso`. */
export function weekStartOf(iso: ISODate): ISODate {
  return addDays(iso, -dayIndex(iso));
}

/** The date of a given day within the week that starts on `weekStart`. */
export function dateInWeek(weekStart: ISODate, day: DayKey): ISODate {
  return addDays(weekStart, DAY_KEYS.indexOf(day));
}

/** Today's date in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The `weeks` week-starts ending at `weekStart`, oldest first. */
export function weekWindow(weekStart: ISODate, weeks: number): ISODate[] {
  return Array.from({ length: weeks }, (_, i) => addWeeks(weekStart, i - (weeks - 1)));
}

/**
 * Reads a `?week=` value. Anything invalid falls back to the current week;
 * future weeks are clamped to the current week.
 */
export function resolveWeek(param: string | string[] | undefined, currentWeek: ISODate): ISODate {
  const value = Array.isArray(param) ? param[0] : param;
  if (!isISODate(value)) return currentWeek;
  const start = weekStartOf(value);
  return start > currentWeek ? currentWeek : start;
}

const fmt = (locale: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" });

const EN_MONTH_DAY = fmt("en-US", { month: "short", day: "numeric" });
const EN_FULL = fmt("en-US", { month: "short", day: "numeric", year: "numeric" });
const HE_MONTH_DAY = fmt("he-IL", { month: "long", day: "numeric" });
const HE_FULL = fmt("he-IL", { month: "long", day: "numeric", year: "numeric" });

/**
 * English: "Nov 8 – 14, 2026", "Nov 29 – Dec 5, 2026", "Dec 27, 2026 – Jan 2, 2027"
 * Hebrew:  "8–14 בנובמבר 2026", "29 בנובמבר – 5 בדצמבר 2026"
 */
export function formatWeekRange(weekStart: ISODate, lang: Lang = "en"): string {
  const start = toUTC(weekStart);
  const end = toUTC(addDays(weekStart, 6));
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  if (lang === "he") {
    if (sameMonth) return `${start.getUTCDate()}–${HE_FULL.format(end)}`;
    if (sameYear) return `${HE_MONTH_DAY.format(start)} – ${HE_FULL.format(end)}`;
    return `${HE_FULL.format(start)} – ${HE_FULL.format(end)}`;
  }
  if (sameMonth) return `${EN_MONTH_DAY.format(start)} – ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  if (sameYear) return `${EN_MONTH_DAY.format(start)} – ${EN_MONTH_DAY.format(end)}, ${end.getUTCFullYear()}`;
  return `${EN_FULL.format(start)} – ${EN_FULL.format(end)}`;
}

/** "Nov 8" / "8 בנובמבר" */
export function formatShort(iso: ISODate, lang: Lang = "en"): string {
  return (lang === "he" ? HE_MONTH_DAY : EN_MONTH_DAY).format(toUTC(iso));
}
