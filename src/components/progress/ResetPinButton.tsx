"use client";

import { useState } from "react";
import { firebase } from "@/lib/firebase";
import { useLang } from "@/i18n/client";

/** Staff: clear a bachur's wall-tablet PIN so he can choose a new one there. */
export function ResetPinButton({ bachurId, name }: { bachurId: string; name: string }) {
  const { m } = useLang();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function reset() {
    if (!window.confirm(m.resetPinConfirm(name))) return;
    setState("busy");
    try {
      const token = await firebase().auth.currentUser?.getIdToken();
      const res = await fetch("/api/kiosk/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bachurId }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") return <p className="small muted" role="status">{m.resetPinDone}</p>;
  return (
    <div>
      <button type="button" className="link-btn" onClick={reset} disabled={state === "busy"}>
        {m.resetPin}
      </button>
      {state === "error" && <span className="small alert--error"> {m.errGeneric}</span>}
    </div>
  );
}
