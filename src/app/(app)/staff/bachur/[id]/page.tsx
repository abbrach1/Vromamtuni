import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMessages } from "@/i18n/server";
import { getWeekInfo } from "@/lib/week";
import { ChevronLeft } from "@/components/icons";
import { ProgressScreen } from "@/components/progress/ProgressScreen";
import { WeekNav } from "@/components/WeekNav";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getMessages();
  return { title: m.viewing };
}

/** One bachur's week, read-only, for staff. */
export default async function BachurPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id } = await params;
  if (!/^[A-Za-z0-9]{1,128}$/.test(id)) notFound();
  const { m } = await getMessages();
  const { today, currentWeek, week } = getWeekInfo((await searchParams).week);
  const basePath = `/staff/bachur/${id}`;

  return (
    <main className="page">
      <Link href={week === currentWeek ? "/staff" : `/staff?week=${week}`} className="backlink">
        <ChevronLeft width={18} height={18} className="flip-rtl" /> {m.overview}
      </Link>
      <ProgressScreen
        bachurId={id}
        week={week}
        currentWeek={currentWeek}
        today={today}
        weekNav={<WeekNav week={week} currentWeek={currentWeek} basePath={basePath} />}
      />
    </main>
  );
}
