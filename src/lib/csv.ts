import { requirements, type Lang } from "@/config/program";
import type { Messages } from "@/i18n/messages";
import { formatShort, weekWindow, type ISODate } from "./dates";
import { TREND_WEEKS, type OverviewRow } from "./overview";

/** Quotes a CSV cell, and stops spreadsheet apps from running text as a formula. */
function cell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The staff overview as a CSV file (UTF-8 with BOM so Excel shows Hebrew correctly). */
export function overviewCsv(rows: OverviewRow[], week: ISODate, lang: Lang, m: Messages): string {
  const header = [
    m.colName,
    m.csvEmail,
    m.csvWeekOf,
    m.colSignedUpFor,
    m.csvGoalsMet,
    m.csvGoalsTotal,
    ...requirements.map((r) => r.title[lang]),
    m.csvSmartGoal,
    ...weekWindow(week, TREND_WEEKS).map((w) => `${m.csvWeekOf} ${formatShort(w, lang)}`),
  ];
  const lines = rows.map((row) => {
    const results = new Map(row.summary.results.map((r) => [r.req.id, r.evaluation]));
    return [
      row.profile.name,
      row.profile.email,
      week,
      row.chips.map((c) => c.short[lang]).join("; "),
      row.summary.met,
      row.summary.total,
      ...requirements.map((r) => {
        const e = results.get(r.id);
        return e ? `${m.badge[e.status]}: ${e.line}` : "";
      }),
      row.profile.requirementIds.includes("yiras-sur-mera") ? row.profile.smartGoal : "",
      ...row.trend.map((t) => (t.total > 0 ? `${t.met}/${t.total}` : "")),
    ];
  });
  return "﻿" + [header, ...lines].map((line) => line.map(cell).join(",")).join("\r\n") + "\r\n";
}
