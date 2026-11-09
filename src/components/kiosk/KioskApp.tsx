"use client";

import { signInWithCustomToken, signOut } from "firebase/auth";
import { waitForPendingWrites } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { program, requirements } from "@/config/program";
import { loadProfile, loadProgress, type Profile } from "@/lib/db";
import { weekWindow, type ISODate } from "@/lib/dates";
import { firebase } from "@/lib/firebase";
import { weeksNeeded, type ProgressByWeek } from "@/lib/rules";
import { useLang } from "@/i18n/client";
import { SignUpForm } from "@/app/(app)/sign-up/SignUpForm";
import { LangToggle } from "@/components/LangToggle";
import { Logo } from "@/components/Logo";
import { ProgressBoard } from "@/components/progress/ProgressBoard";
import { Attract, type Pulse } from "./Attract";
import { buzz, Motes, Ring, Sparks, useCountUp } from "./motion";
import { PinPad } from "./PinPad";

interface Person {
  id: string;
  name: string;
  hasPin: boolean;
  mayChoose: boolean;
}

type Screen =
  | { s: "loading" }
  | { s: "setup"; error?: string }
  | { s: "off" }
  | { s: "names" }
  | { s: "pin"; person: Person; mode: "enter" | "choose" | "confirm"; first?: string; error?: string }
  | { s: "no-pin"; person: Person }
  | { s: "join-name" }
  | { s: "join-pin"; name: string; mode: "choose" | "confirm"; first?: string; error?: string }
  | { s: "session"; uid: string; name: string }
  | { s: "leaving"; name: string; met: number; total: number };

const CODE_KEY = "kioskCode";
const IDLE_SESSION_MS = 90_000; // then "Still there?"
const IDLE_PROMPT_S = 15;
const IDLE_PIN_MS = 45_000; // PIN / join screens go back to the names
const IDLE_ATTRACT_MS = 60_000; // the names screen dims to the idle screen
const FAREWELL_MS = 2_800; // shortest time the "well done" screen stays up

function readCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

async function api<T>(path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "x-kiosk-code": readCode() },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as T };
}

/** Time since the last touch, in ms; resets on any tap or key. */
function useIdle(active: boolean, limitMs: number, onIdle: () => void) {
  useEffect(() => {
    if (!active) return;
    let timer = setTimeout(onIdle, limitMs);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(onIdle, limitMs);
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [active, limitMs, onIdle]);
}

/**
 * When /kiosk is shown inside the wall tablet's kiosk shell (see kiosk-bundle/),
 * tell the shell that the page is up and when someone touches it, so the shell
 * never swaps in an update while a bachur is using it.
 */
function useShellBridge() {
  useEffect(() => {
    if (window.parent === window) return;
    const post = (type: string) => window.parent.postMessage({ source: "shabbos-kiosk", type }, "*");
    post("ready");
    let last = 0;
    const onTouch = () => {
      const now = Date.now();
      if (now - last < 1000) return;
      last = now;
      post("activity");
    };
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, onTouch, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onTouch));
  }, []);
}

export function KioskApp({
  week,
  currentWeek,
  today,
  weekNav,
  parsha,
  dateLabel,
}: {
  week: ISODate;
  currentWeek: ISODate;
  today: ISODate;
  weekNav: React.ReactNode;
  parsha: string | null;
  dateLabel: string;
}) {
  const { m, t } = useLang();
  const router = useRouter();
  useShellBridge();
  const [screen, setScreen] = useState<Screen>({ s: "loading" });
  const [people, setPeople] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [thanks, setThanks] = useState("");
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState("");
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [attract, setAttract] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadPulse = useCallback(async () => {
    if (!readCode()) return;
    try {
      const { status, data } = await api<Partial<Pulse>>("/api/kiosk/pulse");
      if (status === 200 && typeof data.marked === "number" && typeof data.total === "number") {
        setPulse({ marked: data.marked, total: data.total });
      }
    } catch {
      /* keep the last number */
    }
  }, []);

  const loadRoster = useCallback(async () => {
    if (!readCode()) return setScreen({ s: "setup" });
    try {
      const { status, data } = await api<{ people?: Person[] }>("/api/kiosk/roster");
      if (status === 503) return setScreen({ s: "off" });
      if (status === 401) return setScreen({ s: "setup" });
      setPeople((data.people ?? []).sort((a, b) => a.name.localeCompare(b.name)));
      setScreen((s) => (s.s === "loading" || s.s === "setup" ? { s: "names" } : s));
    } catch {
      setScreen((s) => (s.s === "loading" ? { s: "names" } : s));
    }
  }, []);

  // Start clean: nobody stays signed in if the tablet reloads.
  useEffect(() => {
    void signOut(firebase().auth).finally(() => {
      void loadRoster();
      void loadPulse();
    });
  }, [loadRoster, loadPulse]);

  const backToNames = useCallback(() => {
    setQuery("");
    setLetter("");
    setBusy(false);
    setScreen({ s: "names" });
    void loadRoster();
    void loadPulse();
  }, [loadRoster, loadPulse]);

  // Keep the date, parsha and names fresh while the tablet waits.
  useEffect(() => {
    if (screen.s !== "names") return;
    const id = setInterval(() => {
      router.refresh();
      void loadRoster();
      void loadPulse();
    }, 10 * 60_000);
    return () => clearInterval(id);
  }, [screen.s, router, loadRoster, loadPulse]);

  // Nobody at the tablet for a while: show the idle screen.
  const toAttract = useCallback(() => {
    setQuery("");
    setLetter("");
    setAttract(true);
  }, []);
  useIdle(screen.s === "names" && !attract, IDLE_ATTRACT_MS, toAttract);

  useEffect(() => {
    if (!thanks) return;
    const id = setTimeout(() => setThanks(""), 5000);
    return () => clearTimeout(id);
  }, [thanks]);

  const onPinScreens = screen.s === "pin" || screen.s === "no-pin" || screen.s === "join-name" || screen.s === "join-pin";
  useIdle(onPinScreens, IDLE_PIN_MS, backToNames);

  async function choosePerson(p: Person) {
    buzz();
    setAttempt((a) => a + 1);
    let person = p;
    if (!person.hasPin) {
      // He may have just set his PIN on his phone: ask the server again.
      try {
        const { data } = await api<{ people?: Person[] }>("/api/kiosk/roster");
        if (data.people) {
          setPeople(data.people.sort((a, b) => a.name.localeCompare(b.name)));
          person = data.people.find((x) => x.id === p.id) ?? p;
        }
      } catch {
        /* use what we have */
      }
    }
    if (person.hasPin) setScreen({ s: "pin", person, mode: "enter" });
    else if (person.mayChoose) setScreen({ s: "pin", person, mode: "choose" });
    else setScreen({ s: "no-pin", person });
  }

  async function startSession(token: string, uid: string, name: string) {
    await signInWithCustomToken(firebase().auth, token);
    setBusy(false);
    setScreen({ s: "session", uid, name });
  }

  async function submitPin(person: Person, pin: string, create: boolean) {
    setBusy(true);
    try {
      const { status, data } = await api<{ token?: string; error?: string; triesLeft?: number }>(
        "/api/kiosk/signin",
        { uid: person.id, pin, create },
      );
      if (data.token) return await startSession(data.token, person.id, person.name);
      const error =
        status === 429 ? m.kioskLocked : status === 401 ? m.kioskWrongPin(data.triesLeft ?? 0) : m.errGeneric;
      setBusy(false);
      setAttempt((a) => a + 1);
      setScreen({ s: "pin", person, mode: create ? "choose" : "enter", error });
    } catch {
      setBusy(false);
      setAttempt((a) => a + 1);
      setScreen({ s: "pin", person, mode: create ? "choose" : "enter", error: m.errNetwork });
    }
  }

  async function join(name: string, pin: string) {
    setBusy(true);
    try {
      const { data } = await api<{ token?: string; uid?: string }>("/api/kiosk/join", { name, pin });
      if (data.token && data.uid) return await startSession(data.token, data.uid, name);
      throw new Error("join failed");
    } catch {
      setBusy(false);
      setAttempt((a) => a + 1);
      setScreen({ s: "join-pin", name, mode: "choose", error: m.errGeneric });
    }
  }

  // Leaving: let the open week save, wait for the server to confirm, then sign out.
  // The "well done" screen stays up a moment so it can be seen; signing out
  // still happens as soon as the writes are confirmed.
  useEffect(() => {
    if (screen.s !== "leaving") return;
    const name = screen.name.split(/\s+/)[0];
    const { auth, db } = firebase();
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setSaved(false);
    void waitForPendingWrites(db)
      .catch(() => {})
      .then(() => signOut(auth))
      .then(() => {
        setSaved(true);
        timer = setTimeout(
          () => {
            setThanks(m.kioskThanks(name));
            router.replace("/kiosk");
            router.refresh();
            backToNames();
          },
          Math.max(0, FAREWELL_MS - (Date.now() - started)),
        );
      });
    return () => clearTimeout(timer);
  }, [screen, m, router, backToNames]);

  const letters = useMemo(
    () => [...new Set(people.map((p) => initial(p.name)).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [people],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter(
      (p) => (!q || p.name.toLowerCase().includes(q)) && (!letter || initial(p.name) === letter),
    );
  }, [people, query, letter]);

  // ── Screens ───────────────────────────────────────────────────────────

  if (screen.s === "session") {
    return (
      <KioskSession
        key={screen.uid}
        uid={screen.uid}
        week={week}
        currentWeek={currentWeek}
        today={today}
        weekNav={weekNav}
        onDone={(name, met, total) => setScreen({ s: "leaving", name, met, total })}
      />
    );
  }

  if (screen.s === "leaving") {
    return <Farewell name={screen.name} met={screen.met} total={screen.total} saved={saved} />;
  }

  const header = (
    <header className="kiosk__head">
      <Logo size={230} className="kiosk__logo" />
      <div className="kiosk__titles">
        <span className="eyebrow">{t(program.yeshivaName)}</span>
        <h1 className="kiosk__program">{t(program.name)}</h1>
        <p className="kiosk__tagline">{t(program.tagline)}</p>
        <p className="kiosk__week">
          {parsha && <strong>{parsha}</strong>}
          <span>{dateLabel}</span>
        </p>
      </div>
      <LangToggle />
    </header>
  );

  if (screen.s === "loading") {
    return (
      <main className="kiosk" key="loading">
        {header}
        <p className="loading">{m.loading}</p>
      </main>
    );
  }

  if (screen.s === "off") {
    return (
      <main className="kiosk kiosk--in" key="off">
        {header}
        <p className="card empty">{m.kioskOff}</p>
      </main>
    );
  }

  if (screen.s === "setup") {
    return (
      <main className="kiosk kiosk--in" key="setup">
        {header}
        <form
          className="card stack kiosk__narrow"
          onSubmit={async (e) => {
            e.preventDefault();
            const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
            try {
              localStorage.setItem(CODE_KEY, code);
            } catch {
              /* ignore */
            }
            const { status } = await api("/api/kiosk/roster");
            if (status === 401) return setScreen({ s: "setup", error: m.kioskBadCode });
            void loadRoster();
          }}
        >
          <h2>{m.kioskSetupTitle}</h2>
          <p className="muted">{m.kioskSetupIntro}</p>
          {screen.error && <p className="alert alert--error">{screen.error}</p>}
          <label className="field">
            <span className="field__label">{m.kioskCode}</span>
            <input className="input" name="code" type="password" autoComplete="off" required />
          </label>
          <button className="btn btn--primary btn--block" type="submit">
            {m.kioskSave}
          </button>
        </form>
      </main>
    );
  }

  if (screen.s === "pin") {
    const { person, mode } = screen;
    const first = person.name.split(/\s+/)[0];
    return (
      <main className="kiosk kiosk--center kiosk--in" key={`pin-${person.id}`}>
        <PinPad
          key={`${mode}-${attempt}`}
          title={
            mode === "enter" ? m.kioskEnterPin(first) : mode === "choose" ? m.kioskChoosePin(first) : m.kioskConfirmPin
          }
          help={mode === "enter" ? m.kioskForgot : m.kioskChoosePinHelp}
          error={screen.error}
          busy={busy}
          onBack={backToNames}
          onComplete={(pin) => {
            if (mode === "enter") return void submitPin(person, pin, false);
            if (mode === "choose") return setScreen({ s: "pin", person, mode: "confirm", first: pin });
            if (pin === screen.first) return void submitPin(person, pin, true);
            setAttempt((a) => a + 1);
            setScreen({ s: "pin", person, mode: "choose", error: m.kioskPinMismatch });
          }}
        />
      </main>
    );
  }

  if (screen.s === "no-pin") {
    return (
      <main className="kiosk kiosk--center kiosk--in" key="no-pin">
        <div className="card stack kiosk__narrow">
          <h2>{screen.person.name}</h2>
          <p>{m.kioskNoPin}</p>
          <button className="btn btn--block" type="button" onClick={backToNames}>
            {m.kioskBack}
          </button>
        </div>
      </main>
    );
  }

  if (screen.s === "join-name") {
    return (
      <main className="kiosk kiosk--center kiosk--in" key="join-name">
        <form
          className="card stack kiosk__narrow"
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
            if (name) setScreen({ s: "join-pin", name, mode: "choose" });
          }}
        >
          <h2>{m.kioskJoinTitle}</h2>
          <p className="muted">{m.kioskJoinIntro}</p>
          <label className="field">
            <span className="field__label">{m.yourName}</span>
            <input className="input kiosk__input" name="name" autoComplete="off" maxLength={120} required autoFocus />
          </label>
          <div className="kiosk__actions">
            <button className="btn" type="button" onClick={backToNames}>
              {m.kioskBack}
            </button>
            <button className="btn btn--primary" type="submit">
              {m.kioskNext}
            </button>
          </div>
        </form>
      </main>
    );
  }

  if (screen.s === "join-pin") {
    const { name, mode } = screen;
    const first = name.split(/\s+/)[0];
    return (
      <main className="kiosk kiosk--center kiosk--in" key="join-pin">
        <PinPad
          key={`join-${mode}-${attempt}`}
          title={mode === "choose" ? m.kioskChoosePin(first) : m.kioskConfirmPin}
          help={m.kioskChoosePinHelp}
          error={screen.error}
          busy={busy}
          onBack={backToNames}
          onComplete={(pin) => {
            if (mode === "choose") return setScreen({ s: "join-pin", name, mode: "confirm", first: pin });
            if (pin === screen.first) return void join(name, pin);
            setAttempt((a) => a + 1);
            setScreen({ s: "join-pin", name, mode: "choose", error: m.kioskPinMismatch });
          }}
        />
      </main>
    );
  }

  // Names
  return (
    <main className="kiosk kiosk--in" key="names">
      {header}
      {thanks && (
        <p className="alert alert--ok kiosk__thanks" role="status">
          {thanks}
        </p>
      )}
      {pulse && pulse.total > 0 && <PulseBar pulse={pulse} />}
      <div className="kiosk__bar">
        <h2>{m.kioskTapName}</h2>
        {people.length > 12 && (
          <input
            className="input kiosk__search"
            type="search"
            placeholder={m.kioskFind}
            aria-label={m.kioskFind}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </div>
      {people.length > 12 && letters.length > 1 && (
        <div className="kiosk__letters" role="group" aria-label={m.kioskFind}>
          {["", ...letters].map((l) => (
            <button
              key={l || "all"}
              type="button"
              className="kiosk__letter"
              aria-pressed={letter === l}
              onClick={() => {
                buzz();
                setLetter(l);
              }}
            >
              {l || m.kioskAllLetters}
            </button>
          ))}
        </div>
      )}
      {people.length === 0 ? (
        <p className="empty">{m.kioskNoNames}</p>
      ) : (
        <div className="kiosk__names" key={`${letter}|${query.trim()}`}>
          {shown.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="kiosk__name"
              style={{ "--i": Math.min(i, 24) } as React.CSSProperties}
              onClick={() => void choosePerson(p)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      <div className="kiosk__foot">
        <button
          type="button"
          className="btn"
          onClick={() => {
            buzz();
            setScreen({ s: "join-name" });
          }}
        >
          {m.kioskNew}
        </button>
      </div>
      {attract && (
        <Attract
          pulse={pulse}
          parsha={parsha}
          dateLabel={dateLabel}
          onWake={() => {
            buzz();
            setAttract(false);
          }}
        />
      )}
    </main>
  );
}

/** First letter of a name, for the letter buttons. Skips a leading "R'" or quote marks. */
function initial(name: string): string {
  const ch = name.trim().replace(/^[^\p{L}]+/u, "").charAt(0);
  return ch.toLocaleUpperCase();
}

/** The yeshiva-wide count under the header: a line of text over a filling gold rule. */
function PulseBar({ pulse }: { pulse: Pulse }) {
  const { m } = useLang();
  const n = useCountUp(pulse.marked);
  const pct = pulse.total > 0 ? Math.min(100, (pulse.marked / pulse.total) * 100) : 0;
  return (
    <div className="kiosk__pulse">
      <span>{m.kioskPulse(n, pulse.total)}</span>
      <span className="kiosk__pulsebar" aria-hidden>
        <i style={{ "--p": `${pct.toFixed(1)}%` } as React.CSSProperties} />
      </span>
    </div>
  );
}

/** After Done: a moment of "well done" while the week saves and he is signed out. */
function Farewell({ name, met, total, saved }: { name: string; met: number; total: number; saved: boolean }) {
  const { m } = useLang();
  const first = name.split(/\s+/)[0];
  const all = total > 0 && met === total;
  const count = useCountUp(met, 900);
  return (
    <main className={`kiosk kiosk--center kiosk--in farewell${all ? " farewell--all" : ""}`} key="leaving">
      <Motes count={all ? 26 : 16} />
      <div className="farewell__body">
        {total > 0 && (
          <div className="farewell__ring">
            <Ring value={met} max={total} size={200} stroke={6}>
              <span className="farewell__count">
                {count}
                <small>/{total}</small>
              </span>
            </Ring>
            {all && <Sparks big />}
          </div>
        )}
        <h1 className="farewell__title">{first ? m.kioskWellDone(first) : m.kioskSaved}</h1>
        {total > 0 && <p className="farewell__line">{all ? m.kioskAllMet : m.goalsMet(met, total, true)}</p>}
        <p className="farewell__status" role="status">
          {saved ? m.kioskSaved : m.kioskSigningOut}
        </p>
      </div>
    </main>
  );
}

// ── A bachur's turn at the tablet ─────────────────────────────────────────

function KioskSession({
  uid,
  week,
  currentWeek,
  today,
  weekNav,
  onDone,
}: {
  uid: string;
  week: ISODate;
  currentWeek: ISODate;
  today: ISODate;
  weekNav: React.ReactNode;
  onDone: (name: string, met: number, total: number) => void;
}) {
  const { m } = useLang();
  const [tally, setTally] = useState({ met: 0, total: 0 });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState<{ week: ISODate; progress: ProgressByWeek } | null>(null);
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const done = useCallback(
    () => onDone(profile?.name ?? "", tally.met, tally.total),
    [onDone, profile, tally],
  );
  const onSummary = useCallback((met: number, total: number) => setTally({ met, total }), []);

  useEffect(() => {
    let live = true;
    loadProfile(uid)
      .then((p) => {
        if (!live) return;
        setProfile(p);
        if (p && p.requirementIds.length === 0) setEditing(true);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [uid]);

  useEffect(() => {
    let live = true;
    loadProgress(uid, weekWindow(week, weeksNeeded(1, requirements)))
      .then((progress) => live && setLoaded({ week, progress }))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [uid, week]);

  // After a while with no taps, ask "Still there?", then sign out.
  useIdle(prompt === null, IDLE_SESSION_MS, () => setPrompt(IDLE_PROMPT_S));
  useEffect(() => {
    if (prompt === null) return;
    if (prompt <= 0) return done();
    const id = setTimeout(() => setPrompt((p) => (p === null ? null : p - 1)), 1000);
    return () => clearTimeout(id);
  }, [prompt, done]);

  const first = profile?.name.split(/\s+/)[0] ?? "";

  return (
    <main className="kiosk kiosk--session kiosk--in">
      <header className="kiosk__sessionbar">
        <Logo size={116} className="kiosk__logo kiosk__logo--small" />
        <h1>{first ? m.hi(first) : "…"}</h1>
        {!editing && profile && (
          <button type="button" className="btn kiosk__edit" onClick={() => setEditing(true)}>
            {m.kioskEditCommitments}
          </button>
        )}
        <button
          type="button"
          className="btn btn--primary kiosk__done"
          onClick={() => {
            buzz();
            done();
          }}
        >
          {m.kioskDone}
        </button>
      </header>

      {failed && <p className="alert alert--error">{m.loadError}</p>}

      {profile && editing ? (
        <div className="kiosk__signup">
          <SignUpForm
            profile={profile}
            onSaved={async () => {
              setProfile(await loadProfile(uid));
              setEditing(false);
            }}
          />
        </div>
      ) : (
        <div className="stack">
          {weekNav}
          {profile && loaded?.week === week ? (
            <div className="kiosk__board">
              <ProgressBoard
                key={`${uid}-${week}`}
                userId={uid}
                week={week}
                currentWeek={currentWeek}
                today={today}
                selectedIds={profile.requirementIds}
                smartGoal={profile.smartGoal}
                initialProgress={loaded.progress}
                basePath="/kiosk"
                celebrate
                onSummary={onSummary}
              />
            </div>
          ) : (
            !failed && <p className="loading">{m.loading}</p>
          )}
        </div>
      )}

      {prompt !== null && (
        <div className="kiosk__overlay" role="dialog" aria-modal="true" aria-labelledby="still-there">
          <div className="card stack kiosk__narrow">
            <h2 id="still-there">{m.kioskStillThere}</h2>
            <p className="muted">{m.kioskSignOutIn(Math.max(prompt, 0))}</p>
            <div className="kiosk__actions">
              <button type="button" className="btn" onClick={done}>
                {m.kioskDone}
              </button>
              <button type="button" className="btn btn--primary" onClick={() => setPrompt(null)}>
                {m.kioskStay}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
