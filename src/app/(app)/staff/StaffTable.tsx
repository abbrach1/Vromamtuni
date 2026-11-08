"use client";

import Link from "next/link";
import { useState } from "react";
import { formatShort } from "@/lib/dates";
import type { OverviewRow } from "@/lib/overview";
import { useLang } from "@/i18n/client";

export function StaffTable({ rows, week, isCurrent }: { rows: OverviewRow[]; week: string; isCurrent: boolean }) {
  const { lang, m, t } = useLang();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? rows.filter((r) => r.profile.name.toLowerCase().includes(q) || r.profile.email.toLowerCase().includes(q))
    : rows;
  const weekParam = isCurrent ? "" : `?week=${week}`;

  return (
    <div className="stack">
      {rows.length > 6 && (
        <input
          className="input"
          type="search"
          placeholder={m.search}
          aria-label={m.searchLabel}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {shown.length === 0 ? (
          <p className="empty">{rows.length === 0 ? m.noBachurim : m.noMatch}</p>
        ) : (
          <table className="roster" data-trend-label={m.colTrend}>
            <thead>
              <tr>
                <th scope="col">{m.colName}</th>
                <th scope="col">{m.colSignedUpFor}</th>
                <th scope="col">{isCurrent ? m.colThisWeek : m.colThatWeek}</th>
                <th scope="col">{m.colTrend}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ profile, chips, summary, trend }) => (
                <tr key={profile.id}>
                  <td className="roster__name">
                    <Link href={`/staff/bachur/${profile.id}${weekParam}`}>
                      {profile.name || profile.email || m.unnamed}
                    </Link>
                  </td>
                  <td className="roster__chips">
                    {chips.length > 0 ? (
                      <div className="chips">
                        {chips.map((c) => (
                          <span key={c.id} className="chip" data-pillar={c.pillar}>
                            {t(c.short)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted small">{m.notSignedUpYet}</span>
                    )}
                  </td>
                  <td className="roster__goals">
                    {summary.total > 0 ? (
                      <>
                        {summary.met} <small>{m.of(summary.met, summary.total)}</small>
                      </>
                    ) : (
                      <small>—</small>
                    )}
                  </td>
                  <td className="roster__trend" data-label={m.colTrend}>
                    <div
                      className="trend"
                      role="img"
                      aria-label={trend.map((w) => m.trendTitle(formatShort(w.week, lang), w.met, w.total)).join("; ")}
                    >
                      {trend.map((w) => (
                        <i
                          key={w.week}
                          data-trend={w.trend}
                          className={w.week === week ? "current" : undefined}
                          title={m.trendTitle(formatShort(w.week, lang), w.met, w.total)}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
