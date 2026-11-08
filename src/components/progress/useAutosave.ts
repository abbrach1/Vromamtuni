"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveEntry } from "@/lib/db";
import type { ISODate } from "@/lib/dates";
import type { EntryData } from "@/lib/rules";

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "error";

const DEBOUNCE_MS = 400;

/**
 * Saves each change shortly after it happens. Firestore writes go to the
 * phone's offline copy right away and reach the server when there's a
 * connection, so nothing is lost if the signal drops.
 */
export function useAutosave(userId: string, week: ISODate) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const pending = useRef(new Map<string, EntryData>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inFlight = useRef(0);

  const send = useCallback(
    (reqId: string) => {
      const t = timers.current.get(reqId);
      if (t) clearTimeout(t);
      timers.current.delete(reqId);
      const data = pending.current.get(reqId);
      if (!data) return;
      pending.current.delete(reqId);

      inFlight.current += 1;
      setStatus(navigator.onLine ? "saving" : "offline");
      saveEntry(userId, week, reqId, data).then(
        () => {
          inFlight.current -= 1;
          if (inFlight.current === 0 && pending.current.size === 0) setStatus("saved");
        },
        () => {
          inFlight.current -= 1;
          setStatus("error");
        },
      );
    },
    [userId, week],
  );

  const flushAll = useCallback(() => {
    for (const reqId of [...pending.current.keys()]) send(reqId);
  }, [send]);

  const save = useCallback(
    (reqId: string, data: EntryData) => {
      pending.current.set(reqId, data);
      const t = timers.current.get(reqId);
      if (t) clearTimeout(t);
      timers.current.set(reqId, setTimeout(() => send(reqId), DEBOUNCE_MS));
      setStatus((s) => (s === "error" ? s : "saving"));
    },
    [send],
  );

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushAll();
    };
    const onOffline = () => {
      if (inFlight.current > 0) setStatus("offline");
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushAll);
    window.addEventListener("offline", onOffline);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushAll);
      window.removeEventListener("offline", onOffline);
      flushAll(); // leaving the week: save what's left right away
    };
  }, [flushAll]);

  return { save, status };
}
