"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/i18n/client";

/** A large number pad for a 4-digit PIN. Calls onComplete after the 4th digit. */
export function PinPad({
  title,
  help,
  error,
  busy,
  onComplete,
  onBack,
}: {
  title: string;
  help?: string;
  error?: string;
  busy: boolean;
  onComplete: (pin: string) => void;
  onBack: () => void;
}) {
  const { m } = useLang();
  const [pin, setPin] = useState("");

  // Start empty again whenever the question or the error changes.
  useEffect(() => setPin(""), [title, error]);

  function press(d: string) {
    if (busy || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) onComplete(next);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="pinpad">
      <h2 className="pinpad__title">{title}</h2>
      {help && <p className="muted pinpad__help">{help}</p>}
      <div className="pinpad__dots" aria-label={`${pin.length} / 4`} dir="ltr">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i < pin.length ? "on" : undefined} />
        ))}
      </div>
      <p className="pinpad__error" role="alert">
        {error ?? ""}
      </p>
      <div className="pinpad__keys" dir="ltr">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} disabled={busy}>
            {d}
          </button>
        ))}
        <button type="button" className="pinpad__aux" onClick={onBack}>
          {m.kioskBack}
        </button>
        <button type="button" onClick={() => press("0")} disabled={busy}>
          0
        </button>
        <button
          type="button"
          className="pinpad__aux"
          onClick={() => setPin((p) => p.slice(0, -1))}
          disabled={busy || pin.length === 0}
          aria-label={m.kioskDelete}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
