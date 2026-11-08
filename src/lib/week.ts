import "server-only";
import { program } from "@/config/program";
import { resolveWeek, todayIn, weekStartOf, type ISODate } from "./dates";

export interface WeekInfo {
  today: ISODate;
  currentWeek: ISODate;
  week: ISODate;
}

/** Today, this week and the week asked for in `?week=`, in the yeshiva's time zone. */
export function getWeekInfo(param: string | string[] | undefined): WeekInfo {
  const today = todayIn(program.timeZone);
  const currentWeek = weekStartOf(today);
  return { today, currentWeek, week: resolveWeek(param, currentWeek) };
}
