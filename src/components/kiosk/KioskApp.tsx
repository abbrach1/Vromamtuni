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
  | { s: "leaving"; name: string };

const CODE_KEY = "kioskCode";
const IDLE_SESSION_MS = 90_000; // then "Still there?"
const IDLE_PROMPT_S = 15;
const IDLE_PIN_MS = 45_000; // PIN / join screens go back to the names

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
  const [screen, setScreen] = useState<Screen>({ s: "loading" });
  const [people, setPeople] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [thanks, setThanks] = useState("");
  const [query, setQuery] = useState("");

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
    void signOut(firebase().auth).finally(loadRoster);
  }, [loadRoster]);

  const backToNames = useCallback(() => {
    setQuery("");
    setBusy(false);
    setScreen({ s: "names" });
    void loadRoster();
  }, [loadRoster]);

  // Keep the date, parsha and names fresh while the tablet waits.
  useEffect(() => {
    if (screen.s !== "names") return;
    const id = setInterval(() => {
      router.refresh();
      void loadRoster();
    }, 10 * 60_000);
    return () => clearInterval(id);
  }, [screen.s, router, loadRoster]);

  useEffect(() => {
    if (!thanks) return;
    const id = setTimeout(() => setThanks(""), 5000);
    return () => clearTimeout(id);
  }, [thanks]);

  const onPinScreens = screen.s === "pin" || screen.s === "no-pin" || screen.s === "join-name" || screen.s === "join-pin";
  useIdle(onPinScreens, IDLE_PIN_MS, backToNames);

  async function choosePerson(p: Person) {
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
  useEffect(() => {
    if (screen.s !== "leaving") return;
    const name = screen.name.split(/\s+/)[0];
    const { auth, db } = firebase();
    void waitForPendingWrites(db)
      .catch(() => {})
      .then(() => signOut(auth))
      .then(() => {
        setThanks(m.kioskThanks(name));
        router.replace("/kiosk");
        router.refresh();
        backToNames();
      });
  }, [screen, m, router, backToNames]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;
  }, [people, query]);

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
        onDone={(name) => setScreen({ s: "leaving", name })}
      />
    );
  }

  if (screen.s === "leaving") {
    return (
      <main className="kiosk kiosk--center">
        <p className="loading">{m.kioskSigningOut}</p>
      </main>
    );
  }

  const header = (
    <header className="kiosk__head">
      <Logo size={96} className="kiosk__logo" />
      <div className="kiosk__titles">
        <span className="eyebrow">{t(program.yeshivaName)}</span>
        <h1>{t(program.name)}</h1>
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
      <main className="kiosk">
        {header}
        <p className="loading">{m.loading}</p>
      </main>
    );
  }

  if (screen.s === "off") {
    return (
      <main className="kiosk">
        {header}
        <p className="card empty">{m.kioskOff}</p>
      </main>
    );
  }

  if (screen.s === "setup") {
    return (
      <main className="kiosk">
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
      <main className="kiosk kiosk--center">
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
      <main className="kiosk kiosk--center">
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
      <main className="kiosk kiosk--center">
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
      <main className="kiosk kiosk--center">
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
    <main className="kiosk">
      {header}
      {thanks && (
        <p className="alert alert--ok kiosk__thanks" role="status">
          {thanks}
        </p>
      )}
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
      {people.length === 0 ? (
        <p className="empty">{m.kioskNoNames}</p>
      ) : (
        <div className="kiosk__names">
          {shown.map((p) => (
            <button
              key={p.id}
              type="button"
              className="kiosk__name"
              onClick={() => void choosePerson(p)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      <div className="kiosk__foot">
        <button type="button" className="btn" onClick={() => setScreen({ s: "join-name" })}>
          {m.kioskNew}
        </button>
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
  onDone: (name: string) => void;
}) {
  const { m } = useLang();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState<{ week: ISODate; progress: ProgressByWeek } | null>(null);
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const done = useCallback(() => onDone(profile?.name ?? ""), [onDone, profile]);

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
    <main className="kiosk kiosk--session">
      <header className="kiosk__sessionbar">
        <Logo size={52} className="kiosk__logo kiosk__logo--small" />
        <h1>{first ? m.hi(first) : "…"}</h1>
        {!editing && profile && (
          <button type="button" className="btn kiosk__edit" onClick={() => setEditing(true)}>
            {m.kioskEditCommitments}
          </button>
        )}
        <button type="button" className="btn btn--primary kiosk__done" onClick={done}>
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
