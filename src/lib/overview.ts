import { requirementById, requirements, type Lang, type PillarId, type Text } from "@/config/program";
import { addWeeks, weekWindow, type ISODate } from "./dates";
import type { Profile } from "./db";
import { summarizeWeek, trendOf, weeksNeeded, type ProgressByWeek, type Trend, type WeekSummary } from "./rules";

export const TREND_WEEKS = 4;

export interface OverviewRow {
  profile: Profile;
  chips: { id: string; short: Text; pillar: PillarId }[];
  summary: WeekSummary;
  trend: { week: ISODate; trend: Trend; met: number; total: number }[];
}

/** The range of weeks the overview must load (trend weeks plus rolling windows). */
export function overviewRange(week: ISODate): { from: ISODate; to: ISODate } {
  return { from: addWeeks(week, -(weeksNeeded(TREND_WEEKS, requirements) - 1)), to: week };
}

/** One row per bachur for the staff table and CSV, sorted by name. */
export function buildOverview(
  bachurim: Profile[],
  progress: Map<string, ProgressByWeek>,
  week: ISODate,
  currentWeek: ISODate,
  lang: Lang,
): OverviewRow[] {
  const trendWeeks = weekWindow(week, TREND_WEEKS);
  return bachurim
    .map((profile) => {
      const ids = profile.requirementIds;
      const p = progress.get(profile.id) ?? {};
      return {
        profile,
        chips: ids.map((id) => {
          const r = requirementById.get(id)!;
          return { id, short: r.short, pillar: r.pillar };
        }),
        summary: summarizeWeek(ids, p, week, currentWeek, lang),
        trend: trendWeeks.map((w) => {
          const s = summarizeWeek(ids, p, w, currentWeek, lang);
          return { week: w, trend: trendOf(s), met: s.met, total: s.total };
        }),
      };
    })
    .sort((a, b) =>
      (a.profile.name || a.profile.email).localeCompare(b.profile.name || b.profile.email, lang, {
        sensitivity: "base",
      }),
    );
}
