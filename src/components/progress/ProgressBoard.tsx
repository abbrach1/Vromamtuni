"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { pillars, type Requirement } from "@/config/program";
import { addWeeks, dayIndex, type ISODate } from "@/lib/dates";
import {
  readMarks,
  summarizeWeek,
  type EntryData,
  type Evaluation,
  type ProgressByWeek,
} from "@/lib/rules";
import { useLang } from "@/i18n/client";
import { CheckIcon } from "@/components/icons";
import { DayRow, FormFields, TapGrid, type WeekContext } from "./inputs";
import { useAutosave, type SaveStatus } from "./useAutosave";

interface Props {
  userId: string;
  week: ISODate;
  currentWeek: ISODate;
  today: ISODate;
  selectedIds: string[];
  smartGoal: string;
  initialProgress: ProgressByWeek;
  readOnly?: boolean;
  /** Where "last week" links point, e.g. "/progress". */
  basePath: string;
}

export function ProgressBoard(props: Props) {
  const { userId, week, currentWeek, today, selectedIds, smartGoal, readOnly = false, basePath } = props;
  const { lang, m, t } = useLang();
  const [progress, setProgress] = useState<ProgressByWeek>(props.initialProgress);
  const { save, status } = useAutosave(userId, week);

  const summary = useMemo(
    () => summarizeWeek(selectedIds, progress, week, currentWeek, lang),
    [selectedIds, progress, week, currentWeek, lang],
  );

  const ctx: WeekContext = { week, today, readOnly };
  const isCurrent = week === currentWeek;

  function update(reqId: string, data: EntryData) {
    if (readOnly) return;
    setProgress((p) => ({ ...p, [week]: { ...p[week], [reqId]: data } }));
    save(reqId, data);
  }

  function toggleMark(reqId: string, mark: string) {
    const marks = readMarks(progress[week]?.[reqId]);
    if (marks.has(mark)) marks.delete(mark);
    else marks.add(mark);
    update(reqId, { marks: [...marks].sort() });
  }

  if (selectedIds.length === 0) {
    return (
      <div className="card empty stack">
        <p>{readOnly ? m.notSignedUpOther : m.notSignedUpSelf}</p>
        {!readOnly && (
          <Link href="/sign-up" className="btn btn--primary">
            {m.chooseCommitments}
          </Link>
        )}
      </div>
    );
  }

  const hasTracked = summary.results.some((r) => r.evaluation.status === "tracked");
  const touchesShabbos = summary.results.some(
    (r) =>
      r.req.pillar === "shabbos" ||
      (r.req.measure.kind !== "form" && r.req.measure.days.includes("sat")),
  );
  // Shabbos is logged after Shabbos, so on Sunday and Monday point back to last week.
  const showLastWeekHint = !readOnly && isCurrent && dayIndex(today) <= 1 && touchesShabbos;

  return (
    <div className={`stack${readOnly ? " readonly" : ""}`}>
      <section className="card summary" aria-live="polite">
        <div className="summary__count">
          {summary.met}
          <span> / {summary.total}</span>
        </div>
        <div className="summary__text">
          <strong>{m.goalsMet(summary.met, summary.total, isCurrent)}</strong>
          <div className="segments" aria-hidden>
            {Array.from({ length: summary.total }, (_, i) => (
              <i key={i} className={i < summary.met ? "on" : undefined} />
            ))}
          </div>
          {!readOnly && <SaveIndicator status={status} />}
          {readOnly && hasTracked && <span className="muted small">{m.trackedNoteStaff}</span>}
        </div>
      </section>

      {showLastWeekHint && (
        <div className="alert alert--info hint">
          <span>{m.lastWeekHint}</span>
          <Link href={`${basePath}?week=${addWeeks(week, -1)}`} className="btn btn--small">
            {m.goLastWeek}
          </Link>
        </div>
      )}

      {pillars.map((pillar) => {
        const items = summary.results.filter((r) => r.req.pillar === pillar.id);
        if (items.length === 0) return null;
        return (
          <section key={pillar.id} className="pillar">
            <h2 className="pillar__title">{t(pillar.title)}</h2>
            {items.map(({ req, evaluation }) => (
              <RequirementCard
                key={req.id}
                req={req}
                evaluation={evaluation}
                code={`${t(pillar.title)} ${t(req.letter)}`}
                smartGoal={smartGoal}
              >
                <RequirementInput
                  req={req}
                  data={progress[week]?.[req.id]}
                  ctx={ctx}
                  onChange={(d) => update(req.id, d)}
                  onToggle={(mark) => toggleMark(req.id, mark)}
                />
              </RequirementCard>
            ))}
          </section>
        );
      })}

      {!readOnly && hasTracked && (
        <p className="muted small" style={{ textAlign: "center" }}>
          {m.trackedNote}
        </p>
      )}
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const { m } = useLang();
  if (status === "error" || status === "offline") {
    return (
      <span className={`savestate${status === "error" ? " savestate--error" : ""}`} role="status">
        {status === "error" ? m.saveError : m.saveOffline}
      </span>
    );
  }
  return (
    <span className="savestate" role="status">
      {status === "saving" && m.saveSaving}
      {status === "saved" && (
        <>
          <CheckIcon width={14} height={14} /> {m.saveSaved}
        </>
      )}
      {status === "idle" && m.saveIdle}
    </span>
  );
}

function RequirementCard({
  req,
  evaluation,
  code,
  smartGoal,
  children,
}: {
  req: Requirement;
  evaluation: Evaluation;
  code: string;
  smartGoal: string;
  children: React.ReactNode;
}) {
  const { m, t } = useLang();
  return (
    <article className="card req" aria-labelledby={`${req.id}-title`}>
      <div className="req__head">
        <div className="req__titles">
          <span className="req__code">{code}</span>
          <h3 id={`${req.id}-title`}>{t(req.title)}</h3>
          <span className="req__line">{evaluation.line}</span>
          {evaluation.thisWeek && <span className="req__sub">{evaluation.thisWeek}</span>}
        </div>
        <span className={`badge badge--${evaluation.status}`}>
          {evaluation.status === "met" && <CheckIcon width={13} height={13} />}
          {m.badge[evaluation.status]}
        </span>
      </div>
      {req.goalText && smartGoal && (
        <blockquote className="req__goal" dir="auto">
          {smartGoal}
        </blockquote>
      )}
      {children}
      <details className="req__about">
        <summary>{m.about}</summary>
        <p>{t(req.description)}</p>
      </details>
    </article>
  );
}

function RequirementInput({
  req,
  data,
  ctx,
  onChange,
  onToggle,
}: {
  req: Requirement;
  data: EntryData | undefined;
  ctx: WeekContext;
  onChange: (data: EntryData) => void;
  onToggle: (mark: string) => void;
}) {
  const m = req.measure;
  if (m.kind === "form") {
    return <FormFields reqId={req.id} fields={m.fields} data={data} onChange={onChange} ctx={ctx} />;
  }
  const marks = readMarks(data);
  if (m.kind === "days") {
    return <DayRow days={m.days} marks={marks} onToggle={onToggle} ctx={ctx} />;
  }
  return (
    <TapGrid
      days={m.days}
      rows={m.rows}
      marks={marks}
      onToggle={onToggle}
      minPerDay={m.goal.per === "day" ? m.goal.minPerDay : undefined}
      ctx={ctx}
    />
  );
}
