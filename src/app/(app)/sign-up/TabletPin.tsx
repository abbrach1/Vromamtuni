"use client";

import { useState } from "react";
import { firebase } from "@/lib/firebase";
import { useLang } from "@/i18n/client";

/** Lets a bachur set the 4-digit PIN he uses on the wall tablet. */
export function TabletPin() {
  const { m } = useLang();
  const [pin, setPin] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error" | "bad">("idle");

  async function save() {
    if (!/^\d{4}$/.test(pin)) return setState("bad");
    setState("saving");
    try {
      const token = await firebase().auth.currentUser?.getIdToken();
      const res = await fetch("/api/kiosk/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setPin("");
      setState("saved");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="card field">
      <label className="field__label" htmlFor="tablet-pin">
        {m.tabletPin}
      </label>
      <span className="field__help">{m.tabletPinHelp}</span>
      <div className="toolbar">
        <input
          id="tablet-pin"
          className="input pin-input"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
            setState("idle");
          }}
          dir="ltr"
        />
        <button type="button" className="btn btn--small" onClick={save} disabled={state === "saving"}>
          {m.tabletPinSave}
        </button>
      </div>
      {state === "saved" && <span className="small" role="status">{m.tabletPinSaved}</span>}
      {state === "bad" && <span className="small alert--error" role="alert">{m.tabletPinBad}</span>}
      {state === "error" && <span className="small alert--error" role="alert">{m.errGeneric}</span>}
    </div>
  );
}
