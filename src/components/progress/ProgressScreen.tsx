"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { requirements } from "@/config/program";
import { loadProfile, loadProgress, type Profile } from "@/lib/db";
import { weekWindow, type ISODate } from "@/lib/dates";
import { weeksNeeded, type ProgressByWeek } from "@/lib/rules";
import { useLang } from "@/i18n/client";
import { useAuth } from "@/components/AuthProvider";
import { ProgressBoard } from "./ProgressBoard";

interface Props {
  week: ISODate;
  currentWeek: ISODate;
  today: ISODate;
  /** Server-rendered week navigation. */
  weekNav: React.ReactNode;
  /** Staff view of another bachur (read-only). Omit for "my week". */
  bachurId?: string;
  banner?: "welcome" | "saved";
}

/** Loads a bachur's sign-up and recent weeks, then shows the week. */
export function ProgressScreen({ week, currentWeek, today, weekNav, bachurId, banner }: Props) {
  const auth = useAuth();
  const router = useRouter();
  const { m } = useLang();
  const me = auth.status === "signed-in" ? auth.profile : null;
  const readOnly = Boolean(bachurId);
  const [other, setOther] = useState<Profile | null | undefined>(undefined);
  // Tagged with the bachur and week it belongs to, so a stale week never shows.
  const [loaded, setLoaded] = useState<{ key: string; progress: ProgressByWeek } | null>(null);
  const [failed, setFailed] = useState(false);

  const profile = readOnly ? other : me;
  const uid = bachurId ?? me?.id;
  const key = `${uid}-${week}`;
  const progress = loaded?.key === key ? loaded.progress : null;

  useEffect(() => {
    if (!readOnly && me && me.role !== "staff" && me.requirementIds.length === 0) router.replace("/sign-up");
  }, [readOnly, me, router]);

  useEffect(() => {
    if (!uid) return;
    let live = true;
    const weeks = weekWindow(week, weeksNeeded(1, requirements));
    Promise.all([loadProgress(uid, weeks), bachurId ? loadProfile(bachurId) : Promise.resolve(undefined)])
      .then(([p, prof]) => {
        if (!live) return;
        if (bachurId) setOther(prof ?? null);
        setLoaded({ key: `${uid}-${week}`, progress: p });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [uid, week, bachurId]);

  const isStaffViewer = me?.role === "staff";
  if (readOnly && me && !isStaffViewer) return <p className="card empty">{m.staffOnly}</p>;
  if (failed) return <p className="alert alert--error">{m.loadError}</p>;

  const firstName = profile?.name.split(/\s+/)[0];

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{readOnly ? m.viewing : m.myWeek}</span>
        <h1>{readOnly ? profile?.name || profile?.email || "…" : firstName ? m.hi(firstName) : m.myWeek}</h1>
        {readOnly && profile?.email && (
          <p className="muted small" dir="ltr" style={{ textAlign: "start" }}>
            {profile.email}
          </p>
        )}
      </div>
      <div className="stack">
        {banner === "welcome" && <p className="alert alert--ok">{m.welcomeBanner}</p>}
        {banner === "saved" && <p className="alert alert--ok">{m.savedBanner}</p>}
        {weekNav}
        {progress && profile ? (
          <ProgressBoard
            key={key}
            userId={profile.id}
            week={week}
            currentWeek={currentWeek}
            today={today}
            selectedIds={profile.requirementIds}
            smartGoal={profile.smartGoal}
            initialProgress={progress}
            readOnly={readOnly}
            basePath={readOnly ? `/staff/bachur/${profile.id}` : "/progress"}
          />
        ) : profile === null ? (
          <p className="card empty">{m.notFound}</p>
        ) : (
          <p className="loading" role="status">
            {m.loading}
          </p>
        )}
      </div>
    </>
  );
}
