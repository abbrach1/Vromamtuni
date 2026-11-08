import Link from "next/link";
import { addWeeks, formatShort, formatWeekRange, type ISODate } from "@/lib/dates";
import { parshaForWeek } from "@/lib/parsha";
import { getMessages } from "@/i18n/server";
import { ChevronLeft, ChevronRight } from "./icons";

/** Previous / next week arrows with the parsha and dates in between. */
export async function WeekNav({
  week,
  currentWeek,
  basePath,
}: {
  week: ISODate;
  currentWeek: ISODate;
  basePath: string;
}) {
  const { lang, m } = await getMessages();
  const isCurrent = week === currentWeek;
  const prev = addWeeks(week, -1);
  const next = addWeeks(week, 1);
  const href = (w: ISODate) => (w === currentWeek ? basePath : `${basePath}?week=${w}`);
  const parsha = parshaForWeek(week, lang);

  return (
    <nav className="weeknav" aria-label={m.chooseWeek}>
      <Link className="weeknav__arrow" href={href(prev)} aria-label={m.prevWeek(formatShort(prev, lang))}>
        <ChevronLeft className="flip-rtl" />
      </Link>
      <div className="weeknav__label">
        <span className="weeknav__parsha">{parsha ?? m.weekOf(formatShort(week, lang))}</span>
        <span className="weeknav__dates">
          {formatWeekRange(week, lang)}
          {isCurrent ? (
            <span className="pill">{m.thisWeek}</span>
          ) : (
            <>
              {" · "}
              <Link href={basePath}>{m.thisWeek}</Link>
            </>
          )}
        </span>
      </div>
      {isCurrent ? (
        <span className="weeknav__arrow" aria-disabled="true">
          <ChevronRight className="flip-rtl" />
        </span>
      ) : (
        <Link className="weeknav__arrow" href={href(next)} aria-label={m.nextWeek(formatShort(next, lang))}>
          <ChevronRight className="flip-rtl" />
        </Link>
      )}
    </nav>
  );
}
