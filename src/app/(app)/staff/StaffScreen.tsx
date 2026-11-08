"use client";

import { useEffect, useMemo, useState } from "react";
import { loadAllProgress, loadBachurim, type Profile } from "@/lib/db";
import type { ISODate } from "@/lib/dates";
import { overviewCsv } from "@/lib/csv";
import { buildOverview, overviewRange } from "@/lib/overview";
import type { ProgressByWeek } from "@/lib/rules";
import { useLang } from "@/i18n/client";
import { useAuth } from "@/components/AuthProvider";
import { DownloadIcon } from "@/components/icons";
import { StaffTable } from "./StaffTable";

export function StaffScreen({
  week,
  currentWeek,
  weekNav,
}: {
  week: ISODate;
  currentWeek: ISODate;
  weekNav: React.ReactNode;
}) {
  const auth = useAuth();
  const { lang, m } = useLang();
  const isStaff = auth.status === "signed-in" && auth.profile?.role === "staff";
  const [loaded, setLoaded] = useState<{
    week: ISODate;
    bachurim: Profile[];
    progress: Map<string, ProgressByWeek>;
  } | null>(null);
  const data = loaded?.week === week ? loaded : null;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isStaff) return;
    let live = true;
    const { from, to } = overviewRange(week);
    Promise.all([loadBachurim(), loadAllProgress(from, to)])
      .then(([bachurim, progress]) => live && setLoaded({ week, bachurim, progress }))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [isStaff, week]);

  const rows = useMemo(
    () => (data ? buildOverview(data.bachurim, data.progress, week, currentWeek, lang) : []),
    [data, week, currentWeek, lang],
  );

  if (!isStaff) return <p className="card empty">{m.staffOnly}</p>;

  const signedUp = rows.filter((r) => r.chips.length > 0).length;
  const allMet = rows.filter((r) => r.summary.total > 0 && r.summary.met === r.summary.total).length;

  function exportCsv() {
    const blob = new Blob([overviewCsv(rows, week, lang, m)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shabbos-program-${week}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{m.staff}</span>
        <h1>{m.overview}</h1>
      </div>
      <div className="stack">
        {weekNav}
        {failed && <p className="alert alert--error">{m.loadError}</p>}
        {!data && !failed && (
          <p className="loading" role="status">
            {m.loading}
          </p>
        )}
        {data && (
          <>
            <div className="stats">
              <div className="stat">
                <b>{rows.length}</b>
                <span>{m.statBachurim}</span>
              </div>
              <div className="stat">
                <b>{signedUp}</b>
                <span>{m.statSignedUp}</span>
              </div>
              <div className="stat">
                <b>{allMet}</b>
                <span>{m.statAllMet}</span>
              </div>
            </div>

            <div className="toolbar" style={{ justifyContent: "space-between" }}>
              <div className="legend" aria-label={m.legend}>
                <span>
                  <span className="trend"><i data-trend="all" /></span> {m.legendAll}
                </span>
                <span>
                  <span className="trend"><i data-trend="some" /></span> {m.legendSome}
                </span>
                <span>
                  <span className="trend"><i data-trend="none" /></span> {m.legendNone}
                </span>
              </div>
              <button type="button" className="btn btn--small" onClick={exportCsv}>
                <DownloadIcon width={18} height={18} /> {m.exportCsv}
              </button>
            </div>

            <StaffTable rows={rows} week={week} isCurrent={week === currentWeek} />
          </>
        )}
      </div>
    </>
  );
}
