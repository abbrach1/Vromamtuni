import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";
import { getWeekInfo } from "@/lib/week";
import { WeekNav } from "@/components/WeekNav";
import { StaffScreen } from "./StaffScreen";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getMessages();
  return { title: m.overview };
}

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { currentWeek, week } = getWeekInfo((await searchParams).week);
  return (
    <main className="page page--wide">
      <StaffScreen
        week={week}
        currentWeek={currentWeek}
        weekNav={<WeekNav week={week} currentWeek={currentWeek} basePath="/staff" />}
      />
    </main>
  );
}
