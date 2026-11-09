import { useEffect, useRef, useState } from "react";
import { DATA_ORIGIN, KIOSK_READY_TIMEOUT_MS, KIOSK_RETRY_MS, KIOSK_URL } from "./config";
import { noteInteraction } from "./runtime";
import { Status } from "./Status";

/**
 * The tablet's screen: the Shabbos Program's own /kiosk page, full screen.
 *
 * The talmidim see exactly the web app's tablet screens (tap your name, PIN,
 * the week, commitments, joining), in English or Hebrew. The fleet runtime
 * (check-in, remote commands, updates) keeps running here around it.
 *
 * If the page can't load (no Wi-Fi, site down), an offline screen with the
 * device status shows instead and it keeps retrying.
 */
export function KioskFrame() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading");
  const readyRef = useRef(false);

  // Messages from the /kiosk page: "ready" once it's up, "activity" on touches.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== DATA_ORIGIN) return;
      const d = e.data as { source?: string; type?: string } | null;
      if (!d || d.source !== "shabbos-kiosk") return;
      if (d.type === "ready") {
        readyRef.current = true;
        setState("ready");
      }
      noteInteraction();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Give each load a while to say it's ready; otherwise show the offline screen.
  useEffect(() => {
    readyRef.current = false;
    setState("loading");
    const id = setTimeout(() => {
      if (!readyRef.current) setState("offline");
    }, KIOSK_READY_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [attempt]);

  // Offline: try again every so often, and as soon as the Wi-Fi comes back.
  useEffect(() => {
    if (state !== "offline") return;
    const retry = () => setAttempt((a) => a + 1);
    const id = setInterval(retry, KIOSK_RETRY_MS);
    window.addEventListener("online", retry);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", retry);
    };
  }, [state]);

  if (!KIOSK_URL) return <Status note="KIOSK_DATA_ORIGIN isn't set, so there's no site to show." />;

  return (
    <>
      <iframe
        key={attempt}
        src={KIOSK_URL}
        title="Shabbos Program"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          border: 0,
          visibility: state === "offline" ? "hidden" : "visible",
          background: "#f5f0e7",
        }}
        allow="fullscreen"
      />
      {state === "offline" && <Status note="Can't reach the Shabbos Program site. Retrying…" />}
    </>
  );
}
