import type { Metadata, Viewport } from "next";
import { program } from "@/config/program";
import { formatWeekRange } from "@/lib/dates";
import { parshaForWeek } from "@/lib/parsha";
import { getWeekInfo } from "@/lib/week";
import { getMessages } from "@/i18n/server";
import { KioskApp } from "@/components/kiosk/KioskApp";
import { WeekNav } from "@/components/WeekNav";

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = await getMessages();
  return {
    title: program.yeshivaName[lang],
    appleWebApp: { capable: true, title: program.name[lang], statusBarStyle: "default" },
  };
}

// A wall tablet: no pinch-zoom, so stray touches don't leave it zoomed in.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/**
 * The wall tablet. Bachurim tap their name, enter a PIN, mark their week,
 * and tap Done. Set up with KIOSK_CODE and FIREBASE_SERVICE_ACCOUNT (see README).
 */
export default async function KioskPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { lang } = await getMessages();
  const { today, currentWeek, week } = getWeekInfo((await searchParams).week);
  return (
    <KioskApp
      week={week}
      currentWeek={currentWeek}
      today={today}
      parsha={parshaForWeek(currentWeek, lang)}
      dateLabel={formatWeekRange(currentWeek, lang)}
      weekNav={<WeekNav week={week} currentWeek={currentWeek} basePath="/kiosk" />}
    />
  );
}
