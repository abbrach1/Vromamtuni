/**
 * ─────────────────────────────────────────────────────────────────────────
 *  SHABBOS PROGRAM: PROGRAM RULES
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Everything about the program lives in this one file: the pillars, the
 *  requirements, their descriptions (in English and Hebrew), how each one is
 *  measured and what target counts as "met". The screens read from here, so
 *  you can change a target, reword a description, or add/remove a
 *  requirement without touching any UI code.
 *
 *  A few rules of thumb when editing:
 *
 *  • Never reuse or rename a requirement `id`, a row `key`, or a field `key`
 *    once bachurim have started logging. Those keys are what is stored in
 *    the database. Change titles, descriptions and targets freely.
 *  • Every piece of text has an `en` and a `he` version.
 *  • Day keys are fixed: sun, mon, tue, wed, thu, fri, sat ("sat" = Shabbos).
 *  • A `days` measure with `target: null` is tracked only. It shows on the
 *    progress screen but is not counted in "X of Y goals met".
 *  • `rolling` turns a weekly requirement into "N of every M weeks": the
 *    selected week plus the (M − 1) weeks before it. In its `line`, the
 *    placeholders {met}, {weeks} and {required} are filled in.
 *  • Only one requirement should have `goalText` (the Sur Me'ra goal).
 *
 *  After editing, restart `npm run dev` (or redeploy on Vercel).
 */

export type Lang = "en" | "he";

/** A piece of text in both languages. */
export interface Text {
  en: string;
  he: string;
}

export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type PillarId = "shabbos" | "torah" | "tefillah" | "yiras-shamayim";

export interface Pillar {
  id: PillarId;
  title: Text;
}

/** A number input, e.g. hours learned. Logged in steps (e.g. 0.5). */
export interface NumberField {
  type: "number";
  key: string;
  /** Label above the input. */
  label: Text;
  /** Used in the progress line: "2.5 of 3.5 hours". */
  summary: Text;
  step: number;
  max: number;
  /** Minimum value needed for the week to count. */
  target: number;
  /** Optional: this field can't be more than another field (by key). */
  atMost?: string;
}

/** A checkbox, e.g. "learned with a chavrusa". */
export interface CheckboxField {
  type: "checkbox";
  key: string;
  label: Text;
  /** Must be ticked for the week to count. */
  required: boolean;
  /** Progress-line text when ticked / not ticked. */
  summaryOn: Text;
  summaryOff: Text;
}

export type FormField = NumberField | CheckboxField;

export type Measure =
  /** One or more number/checkbox inputs. The week counts when every field meets its target. */
  | { kind: "form"; fields: FormField[] }
  /** A single row of day toggles. `target: null` = tracked, no target. */
  | { kind: "days"; days: DayKey[]; target: number | null }
  /** A grid of day × slot toggles (sedarim, tefillos). */
  | {
      kind: "grid";
      days: DayKey[];
      rows: { key: string; label: Text }[];
      /** Plural noun for one cell, used in the progress line ("tefillos"). */
      cellUnit: Text;
      goal:
        /** A day counts when at least `minPerDay` slots are marked; need `days` such days. */
        | { per: "day"; minPerDay: number; days: number }
        /** Need `count` marked cells in the week. */
        | { per: "cell"; count: number };
    };

export interface Requirement {
  /** Stable id stored in the database. Do not change once in use. */
  id: string;
  pillar: PillarId;
  letter: Text;
  title: Text;
  /** Short name for chips in the staff overview. */
  short: Text;
  description: Text;
  measure: Measure;
  /** "N of every M weeks" requirements. */
  rolling?: { weeks: number; required: number; line: Text };
  /** Shows a text field on the sign-up screen for the bachur's own goal. */
  goalText?: { label: Text; placeholder: Text; help: Text };
}

// ── General settings ──────────────────────────────────────────────────────

export const program = {
  name: { en: "Shabbos Program", he: "תוכנית שבת" } as Text,
  yeshivaName: { en: "Yeshiva Toras Chaim", he: "ישיבת תורת חיים" } as Text,
  /**
   * The yeshiva's logo. Put the image file in the `public` folder with this
   * name. If the file isn't there, a simple candles icon is shown instead.
   */
  logo: "/logo.png",
  /** Language the app opens in. Everyone can switch with the language button. */
  defaultLang: "en" as Lang,
  /**
   * The yeshiva's time zone. Used to decide what "today" and "this week"
   * are, wherever the server happens to run. For example "Asia/Jerusalem",
   * "America/New_York", "America/Denver".
   */
  timeZone: "Asia/Jerusalem",
  /** Week labels show the parsha. Set `parsha` to false to hide it. */
  parsha: true,
  /** true = Eretz Yisrael parsha schedule, false = chutz la'aretz. */
  parshaInIsrael: true,
};

/** Day labels, Sunday to Shabbos. */
export const days: { key: DayKey; short: Text; long: Text }[] = [
  { key: "sun", short: { en: "Sun", he: "א׳" }, long: { en: "Sunday", he: "יום ראשון" } },
  { key: "mon", short: { en: "Mon", he: "ב׳" }, long: { en: "Monday", he: "יום שני" } },
  { key: "tue", short: { en: "Tue", he: "ג׳" }, long: { en: "Tuesday", he: "יום שלישי" } },
  { key: "wed", short: { en: "Wed", he: "ד׳" }, long: { en: "Wednesday", he: "יום רביעי" } },
  { key: "thu", short: { en: "Thu", he: "ה׳" }, long: { en: "Thursday", he: "יום חמישי" } },
  { key: "fri", short: { en: "Fri", he: "ו׳" }, long: { en: "Friday", he: "יום שישי" } },
  { key: "sat", short: { en: "Shab", he: "שבת" }, long: { en: "Shabbos", he: "שבת" } },
];

const SUN_TO_THU: DayKey[] = ["sun", "mon", "tue", "wed", "thu"];
const ALL_WEEK: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const SEDARIM = [
  { key: "morning", label: { en: "Morning", he: "בוקר" } },
  { key: "afternoon", label: { en: "Afternoon", he: "צהריים" } },
  { key: "night", label: { en: "Night", he: "ערב" } },
];

const TEFILLOS = [
  { key: "shacharis", label: { en: "Shacharis", he: "שחרית" } },
  { key: "mincha", label: { en: "Mincha", he: "מנחה" } },
  { key: "maariv", label: { en: "Maariv", he: "מעריב" } },
];

// ── The four pillars ──────────────────────────────────────────────────────

export const pillars: Pillar[] = [
  { id: "shabbos", title: { en: "Shabbos", he: "שבת" } },
  { id: "torah", title: { en: "Torah", he: "תורה" } },
  { id: "tefillah", title: { en: "Tefillah", he: "תפילה" } },
  { id: "yiras-shamayim", title: { en: "Yiras Shamayim", he: "יראת שמים" } },
];

// ── The requirements ──────────────────────────────────────────────────────

export const requirements: Requirement[] = [
  // SHABBOS ────────────────────────────────────────────────────────────────
  {
    id: "shabbos-weekend",
    pillar: "shabbos",
    letter: { en: "A", he: "א" },
    title: { en: "Weekend learning", he: "לימוד בסוף השבוע" },
    short: { en: "Weekend", he: "סוף שבוע" },
    description: {
      en: "3½ hours of learning from Friday morning until 12 midnight Motzaei Shabbos. At least 1½ of those hours must be on Shabbos itself.",
      he: "3.5 שעות לימוד מיום שישי בבוקר עד חצות במוצאי שבת. לפחות 1.5 שעות מתוכן בשבת עצמה.",
    },
    measure: {
      kind: "form",
      fields: [
        {
          type: "number",
          key: "total",
          label: {
            en: "Total hours, Friday morning to midnight Motzaei Shabbos",
            he: "סך הכול שעות, מיום שישי בבוקר עד חצות במוצאי שבת",
          },
          summary: { en: "hours", he: "שעות" },
          step: 0.5,
          max: 40,
          target: 3.5,
        },
        {
          type: "number",
          key: "shabbos",
          label: { en: "Of those, hours on Shabbos itself", he: "מתוכן, שעות בשבת עצמה" },
          summary: { en: "on Shabbos", he: "בשבת" },
          step: 0.5,
          max: 25,
          target: 1.5,
          atMost: "total",
        },
      ],
    },
  },
  {
    id: "shabbos-motzaei",
    pillar: "shabbos",
    letter: { en: "B", he: "ב" },
    title: { en: "Motzaei Shabbos learning", he: "לימוד במוצאי שבת" },
    short: { en: "Motzaei Shabbos", he: "מוצ״ש" },
    description: {
      en: "2 hours of learning with a chavrusa on Motzaei Shabbos, in addition to the 3½ hours. Minimum: 3 of every 4 Motzaei Shabbosos.",
      he: "שעתיים לימוד בחברותא במוצאי שבת, בנוסף ל־3.5 השעות. לפחות 3 מכל 4 מוצאי שבתות.",
    },
    measure: {
      kind: "form",
      fields: [
        {
          type: "number",
          key: "hours",
          label: { en: "Hours on Motzaei Shabbos", he: "שעות במוצאי שבת" },
          summary: { en: "hours", he: "שעות" },
          step: 0.5,
          max: 8,
          target: 2,
        },
        {
          type: "checkbox",
          key: "chavrusa",
          label: { en: "Learned with a chavrusa", he: "למדתי בחברותא" },
          required: true,
          summaryOn: { en: "with a chavrusa", he: "בחברותא" },
          summaryOff: { en: "chavrusa not marked", he: "חברותא לא סומנה" },
        },
      ],
    },
    rolling: {
      weeks: 4,
      required: 3,
      line: {
        en: "{met} of the last {weeks} Motzaei Shabbosos · need {required}",
        he: "{met} מתוך {weeks} מוצאי השבתות האחרונים · נדרשים {required}",
      },
    },
  },
  {
    id: "shabbos-in-yeshiva",
    pillar: "shabbos",
    letter: { en: "C", he: "ג" },
    title: { en: "Staying in yeshiva", he: "שבת בישיבה" },
    short: { en: "In yeshiva", he: "בישיבה" },
    description: {
      en: "Stay in the yeshiva for Shabbos, 2 of every 4 Shabbosos.",
      he: "להישאר בישיבה לשבת, 2 מכל 4 שבתות.",
    },
    measure: {
      kind: "form",
      fields: [
        {
          type: "checkbox",
          key: "stayed",
          label: { en: "Stayed in yeshiva this Shabbos", he: "נשארתי בישיבה השבת" },
          required: true,
          summaryOn: { en: "stayed in yeshiva", he: "נשאר בישיבה" },
          summaryOff: { en: "not marked yet", he: "עדיין לא סומן" },
        },
      ],
    },
    rolling: {
      weeks: 4,
      required: 2,
      line: {
        en: "{met} of the last {weeks} Shabbosos · need {required}",
        he: "{met} מתוך {weeks} השבתות האחרונות · נדרשות {required}",
      },
    },
  },

  // TORAH ──────────────────────────────────────────────────────────────────
  {
    id: "torah-sedarim",
    pillar: "torah",
    letter: { en: "A", he: "א" },
    title: { en: "Shmiras Sedarim", he: "שמירת סדרים" },
    short: { en: "Sedarim", he: "סדרים" },
    description: {
      en: "Arrive within the first 15 minutes of seder. 2 of 3 sedarim a day (morning, afternoon, night), 4 of 5 days (Sunday–Thursday).",
      he: "להגיע בתוך 15 הדקות הראשונות של הסדר. 2 מתוך 3 סדרים ביום (בוקר, צהריים, ערב), 4 מתוך 5 ימים (ראשון–חמישי).",
    },
    measure: {
      kind: "grid",
      days: SUN_TO_THU,
      rows: SEDARIM,
      cellUnit: { en: "sedarim", he: "סדרים" },
      goal: { per: "day", minPerDay: 2, days: 4 },
    },
  },
  {
    id: "torah-retzufos",
    pillar: "torah",
    letter: { en: "B", he: "ב" },
    title: { en: "Retzufos", he: "רציפות" },
    short: { en: "Retzufos", he: "רציפות" },
    description: {
      en: "Learn 30 minutes straight with no break during seder. 2 of 3 sedarim a day, 4 of 5 days.",
      he: "ללמוד 30 דקות ברציפות, בלי הפסקה, בזמן הסדר. 2 מתוך 3 סדרים ביום, 4 מתוך 5 ימים.",
    },
    measure: {
      kind: "grid",
      days: SUN_TO_THU,
      rows: SEDARIM,
      cellUnit: { en: "sedarim", he: "סדרים" },
      goal: { per: "day", minPerDay: 2, days: 4 },
    },
  },
  {
    id: "torah-halacha",
    pillar: "torah",
    letter: { en: "C", he: "ג" },
    title: { en: "Halacha learning", he: "לימוד הלכה" },
    short: { en: "Halacha", he: "הלכה" },
    description: {
      en: "20 minutes of halacha a day, 4 of 5 days a week (Sunday–Thursday).",
      he: "20 דקות הלכה ביום, 4 מתוך 5 ימים בשבוע (ראשון–חמישי).",
    },
    measure: { kind: "days", days: SUN_TO_THU, target: 4 },
  },

  // TEFILLAH ───────────────────────────────────────────────────────────────
  {
    id: "tefillah-yeshiva",
    pillar: "tefillah",
    letter: { en: "A", he: "א" },
    title: { en: "Davening in yeshiva", he: "תפילה בישיבה" },
    short: { en: "Davening", he: "תפילה" },
    description: {
      en: "Daven in the yeshiva 4 of 7 days a week.",
      he: "להתפלל בישיבה 4 מתוך 7 ימים בשבוע.",
    },
    measure: { kind: "days", days: ALL_WEEK, target: 4 },
  },
  {
    id: "tefillah-minyan",
    pillar: "tefillah",
    letter: { en: "B", he: "ב" },
    title: { en: "Minyan commitment", he: "תפילה במניין" },
    short: { en: "Minyan", he: "מניין" },
    description: {
      en: "Shacharis, Mincha and Maariv with a minyan every day: all 21 tefillos of the week.",
      he: "שחרית, מנחה ומעריב במניין בכל יום: כל 21 התפילות של השבוע.",
    },
    measure: {
      kind: "grid",
      days: ALL_WEEK,
      rows: TEFILLOS,
      cellUnit: { en: "tefillos", he: "תפילות" },
      goal: { per: "cell", count: 21 },
    },
  },

  // YIRAS SHAMAYIM ─────────────────────────────────────────────────────────
  {
    id: "yiras-sur-mera",
    pillar: "yiras-shamayim",
    letter: { en: "A", he: "א" },
    title: { en: "Personal Sur Me'ra commitment", he: "קבלה אישית: סור מרע" },
    short: { en: "Sur Me'ra", he: "סור מרע" },
    description: {
      en: "Choose one area to work on, following the Rosh Yeshiva's SMART method. Write your goal in your own words and mark each day you kept it.",
      he: "לבחור תחום אחד לעבוד עליו, לפי שיטת SMART של ראש הישיבה. כתוב את המטרה במילים שלך וסמן כל יום שעמדת בה.",
    },
    measure: { kind: "days", days: ALL_WEEK, target: null },
    goalText: {
      label: { en: "My SMART goal", he: "המטרה שלי (SMART)" },
      placeholder: {
        en: "In my own words: what exactly I'll do, and how I'll know I kept it…",
        he: "במילים שלי: מה בדיוק אעשה, ואיך אדע שעמדתי בזה…",
      },
      help: {
        en: "Specific, Measurable, Achievable, Relevant, Time-bound.",
        he: "ספציפית, מדידה, ברת השגה, רלוונטית ומוגבלת בזמן.",
      },
    },
  },
  {
    id: "yiras-mussar",
    pillar: "yiras-shamayim",
    letter: { en: "B", he: "ב" },
    title: { en: "Mussar learning", he: "לימוד מוסר" },
    short: { en: "Mussar", he: "מוסר" },
    description: {
      en: "20 minutes of mussar a day, 4 of 5 days a week (Sunday–Thursday).",
      he: "20 דקות מוסר ביום, 4 מתוך 5 ימים בשבוע (ראשון–חמישי).",
    },
    measure: { kind: "days", days: SUN_TO_THU, target: 4 },
  },
];

// ── Helpers (no need to edit below) ───────────────────────────────────────

export const requirementById = new Map(requirements.map((r) => [r.id, r]));

export function requirementsForPillar(pillar: PillarId): Requirement[] {
  return requirements.filter((r) => r.pillar === pillar);
}

/** Keeps only known requirement ids, in config order. */
export function normalizeSelection(ids: readonly unknown[]): string[] {
  const set = new Set(ids);
  return requirements.filter((r) => set.has(r.id)).map((r) => r.id);
}

/** Fills {placeholders} in a template. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
}
