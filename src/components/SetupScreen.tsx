"use client";

import { program } from "@/config/program";
import { useLang } from "@/i18n/client";
import { LangToggle } from "./LangToggle";

/** Shown until the Firebase settings are added, so a fresh deploy explains itself. */
export function SetupScreen() {
  const { m, t } = useLang();
  return (
    <main className="auth">
      <div className="auth__box card stack" style={{ maxWidth: 520 }}>
        <div className="hint">
          <h1>{t(program.name)}</h1>
          <LangToggle />
        </div>
        <h2>{m.setupTitle}</h2>
        <p>{m.setupIntro}</p>
        <ol className="stack" style={{ paddingInlineStart: 20, margin: 0, gap: 8 }}>
          {m.setupSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="muted small">{m.setupMore}</p>
      </div>
    </main>
  );
}
