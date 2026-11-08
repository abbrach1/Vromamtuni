import { describe, expect, it } from "vitest";
import { requirementById, requirements } from "@/config/program";
import {
  addDays,
  formatWeekRange,
  resolveWeek,
  todayIn,
  weekStartOf,
  weekWindow,
} from "./dates";
import { evaluate, evaluateWeek, summarizeWeek, trendOf, type ProgressByWeek } from "./rules";

const req = (id: string) => {
  const r = requirementById.get(id);
  if (!r) throw new Error(`missing ${id}`);
  return r;
};

const W = "2026-11-08"; // a Sunday
const prev = (n: number) => addDays(W, -7 * n);

describe("dates", () => {
  it("finds the Sunday of a week", () => {
    expect(weekStartOf("2026-11-08")).toBe("2026-11-08");
    expect(weekStartOf("2026-11-14")).toBe("2026-11-08"); // Shabbos
    expect(weekStartOf("2026-11-15")).toBe("2026-11-15");
  });

  it("builds a rolling window, oldest first", () => {
    expect(weekWindow(W, 4)).toEqual(["2026-10-18", "2026-10-25", "2026-11-01", "2026-11-08"]);
  });

  it("clamps future weeks and rejects junk", () => {
    expect(resolveWeek("2027-01-01", W)).toBe(W);
    expect(resolveWeek("nonsense", W)).toBe(W);
    expect(resolveWeek("2026-02-30", W)).toBe(W);
    expect(resolveWeek("2026-11-04", W)).toBe("2026-11-01");
  });

  it("formats week ranges", () => {
    expect(formatWeekRange("2026-11-08")).toBe("Nov 8 – 14, 2026");
    expect(formatWeekRange("2026-11-29")).toBe("Nov 29 – Dec 5, 2026");
    expect(formatWeekRange("2026-12-27")).toBe("Dec 27, 2026 – Jan 2, 2027");
    expect(formatWeekRange("2026-11-08", "he")).toBe("8–14 בנובמבר 2026");
  });

  it("uses the yeshiva's time zone for today", () => {
    // 23:30 UTC on Saturday is already Sunday in Yerushalayim.
    expect(todayIn("Asia/Jerusalem", new Date("2026-11-14T23:30:00Z"))).toBe("2026-11-15");
    expect(todayIn("America/New_York", new Date("2026-11-14T23:30:00Z"))).toBe("2026-11-14");
  });
});

describe("Shabbos A: weekend learning", () => {
  const r = req("shabbos-weekend");
  it("needs 3.5 total and 1.5 on Shabbos", () => {
    expect(evaluateWeek(r, { total: 3.5, shabbos: 1.5 }).met).toBe(true);
    expect(evaluateWeek(r, { total: 4, shabbos: 1 }).met).toBe(false);
    expect(evaluateWeek(r, { total: 3, shabbos: 2 }).met).toBe(false);
  });
  it("doesn't let Shabbos hours exceed the total", () => {
    expect(evaluateWeek(r, { total: 1, shabbos: 3 }).line).toBe("1 of 3.5 hours · 1 of 1.5 on Shabbos");
  });
  it("ignores junk values", () => {
    expect(evaluateWeek(r, { total: "lots", shabbos: -2 }).line).toBe(
      "0 of 3.5 hours · 0 of 1.5 on Shabbos",
    );
  });
});

describe("Shabbos B: Motzaei Shabbos (3 of every 4)", () => {
  const r = req("shabbos-motzaei");
  const good = { hours: 2, chavrusa: true };

  it("a week counts only with 2 hours and a chavrusa", () => {
    expect(evaluateWeek(r, good).met).toBe(true);
    expect(evaluateWeek(r, { hours: 3, chavrusa: false }).met).toBe(false);
    expect(evaluateWeek(r, { hours: 1.5, chavrusa: true }).met).toBe(false);
  });

  it("counts the current week plus the 3 before it", () => {
    const p: ProgressByWeek = {
      [prev(4)]: { [r.id]: good }, // outside the window
      [prev(2)]: { [r.id]: good },
      [prev(1)]: { [r.id]: good },
    };
    const e = evaluate(r, p, W, W);
    expect(e.status).toBe("in-progress");
    expect(e.line).toBe("2 of the last 4 Motzaei Shabbosos · need 3");
    expect(e.thisWeek).toBe("This week: 0 of 2 hours · chavrusa not marked");

    p[W] = { [r.id]: good };
    expect(evaluate(r, p, W, W).status).toBe("met");
  });

  it("past weeks that fell short say 'Not met'", () => {
    expect(evaluate(r, {}, prev(1), W).status).toBe("not-met");
  });
});

describe("Shabbos C: staying in yeshiva (2 of every 4)", () => {
  const r = req("shabbos-in-yeshiva");
  it("is met with 2 Shabbosos in the window", () => {
    const p: ProgressByWeek = {
      [prev(3)]: { [r.id]: { stayed: true } },
      [prev(1)]: { [r.id]: { stayed: true } },
    };
    expect(evaluate(r, p, W, W).status).toBe("met");
    expect(evaluate(r, p, addDays(W, 7 * 2), addDays(W, 14)).status).toBe("in-progress");
  });
});

describe("Torah A: Shmiras Sedarim grid", () => {
  const r = req("torah-sedarim");
  it("a day counts with 2 of 3 sedarim; needs 4 of 5 days", () => {
    const marks = [
      "sun.morning", "sun.night",
      "mon.morning", "mon.afternoon",
      "tue.afternoon", "tue.night",
      "wed.morning", // only one seder
      "thu.morning", "thu.afternoon", "thu.night",
    ];
    expect(evaluateWeek(r, { marks }).met).toBe(true);
    expect(evaluateWeek(r, { marks: marks.slice(0, 6) })).toEqual({ met: false, line: "3 of 4 days" });
  });
  it("ignores Friday and Shabbos marks", () => {
    expect(evaluateWeek(r, { marks: ["fri.morning", "fri.night"] }).line).toBe("0 of 4 days");
  });
});

describe("Tefillah B: minyan grid", () => {
  const r = req("tefillah-minyan");
  it("needs all 21 tefillos", () => {
    const all = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].flatMap((d) =>
      ["shacharis", "mincha", "maariv"].map((t) => `${d}.${t}`),
    );
    expect(evaluateWeek(r, { marks: all }).met).toBe(true);
    expect(evaluateWeek(r, { marks: all.slice(1) })).toEqual({ met: false, line: "20 of 21 tefillos" });
  });
});

describe("day rows", () => {
  it("Halacha: 4 of 5 days, Sunday–Thursday", () => {
    const r = req("torah-halacha");
    expect(evaluateWeek(r, { marks: ["sun", "mon", "tue", "sat"] })).toEqual({
      met: false,
      line: "3 of 4 days",
    });
    expect(evaluateWeek(r, { marks: ["sun", "mon", "tue", "wed", "thu"] })).toEqual({
      met: true,
      line: "4 of 4 days",
    });
  });
  it("Sur Me'ra is tracked with no target", () => {
    const r = req("yiras-sur-mera");
    expect(evaluate(r, { [W]: { [r.id]: { marks: ["sun", "mon"] } } }, W, W)).toEqual({
      status: "tracked",
      line: "Kept 2 of 7 days",
    });
  });
});

describe("Hebrew", () => {
  it("builds progress lines in Hebrew", () => {
    expect(evaluateWeek(req("torah-halacha"), { marks: ["sun"] }, "he").line).toBe("1 מתוך 4 ימים");
    expect(evaluateWeek(req("tefillah-minyan"), {}, "he").line).toBe("0 מתוך 21 תפילות");
    const e = evaluate(req("shabbos-in-yeshiva"), {}, W, W, "he");
    expect(e.line).toBe("0 מתוך 4 השבתות האחרונות · נדרשות 2");
    expect(e.thisWeek).toBe("השבוע: עדיין לא סומן");
  });
});

describe("weekly summary", () => {
  it("counts met goals and leaves Sur Me'ra out", () => {
    const p: ProgressByWeek = {
      [W]: {
        "torah-halacha": { marks: ["sun", "mon", "tue", "wed"] },
        "yiras-sur-mera": { marks: ["sun"] },
      },
    };
    const s = summarizeWeek(["torah-halacha", "yiras-mussar", "yiras-sur-mera", "gone"], p, W, W);
    expect(s.met).toBe(1);
    expect(s.total).toBe(2);
    expect(s.results).toHaveLength(3);
    expect(trendOf(s)).toBe("some");
    expect(trendOf({ met: 2, total: 2 })).toBe("all");
    expect(trendOf({ met: 0, total: 0 })).toBe("none");
  });
});

describe("config", () => {
  it("has unique ids and sensible targets", () => {
    const ids = requirements.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of requirements) {
      if (r.rolling) expect(r.rolling.required).toBeLessThanOrEqual(r.rolling.weeks);
      const m = r.measure;
      if (m.kind === "days" && m.target !== null) expect(m.target).toBeLessThanOrEqual(m.days.length);
      if (m.kind === "grid" && m.goal.per === "day") {
        expect(m.goal.days).toBeLessThanOrEqual(m.days.length);
        expect(m.goal.minPerDay).toBeLessThanOrEqual(m.rows.length);
      }
      if (m.kind === "grid" && m.goal.per === "cell") {
        expect(m.goal.count).toBeLessThanOrEqual(m.days.length * m.rows.length);
      }
    }
  });
});
