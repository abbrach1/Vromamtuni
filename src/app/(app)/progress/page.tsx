import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";
import { getWeekInfo } from "@/lib/week";
import { ProgressScreen } from "@/components/progress/ProgressScreen";
import { WeekNav } from "@/components/WeekNav";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getMessages();
  return { title: m.myWeek };
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; welcome?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const { today, currentWeek, week } = getWeekInfo(params.week);
  return (
    <main className="page">
      <ProgressScreen
        week={week}
        currentWeek={currentWeek}
        today={today}
        banner={params.welcome ? "welcome" : params.saved ? "saved" : undefined}
        weekNav={<WeekNav week={week} currentWeek={currentWeek} basePath="/progress" />}
      />
    </main>
  );
}
