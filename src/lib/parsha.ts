import "server-only";
import { HDate, Locale, ParshaEvent, getSedra } from "@hebcal/core";
import { program, type Lang } from "@/config/program";
import { addDays, type ISODate } from "./dates";

/**
 * The parsha (or Yom Tov) of the Shabbos that ends the week:
 * "Parshas Toldos" in English (Ashkenazi transliteration), "פרשת תולדות" in
 * Hebrew. Returns null if turned off in the config or if the lookup fails.
 */
export function parshaForWeek(weekStart: ISODate, lang: Lang = "en"): string | null {
  if (!program.parsha) return null;
  const locale = lang === "he" ? "he-x-NoNikud" : "ashkenazi";
  try {
    const [y, m, d] = addDays(weekStart, 6).split("-").map(Number);
    const hd = new HDate(new Date(y, m - 1, d));
    const result = getSedra(hd.getFullYear(), program.parshaInIsrael).lookup(hd);
    if (result.chag) return Locale.gettext(result.parsha[0], locale);
    return new ParshaEvent(result).render(locale);
  } catch {
    return null;
  }
}
