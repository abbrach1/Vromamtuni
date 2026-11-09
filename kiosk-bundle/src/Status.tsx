import { useEffect, useState } from "react";
import { onStatus, type RuntimeStatus } from "./runtime";

/**
 * A diagnostic screen shown until the real kiosk UI is wired in.
 *
 * It proves, on a real tablet, that this partner bundle is alive on the PDCA
 * fleet: identity read from the native plugin, check-in to our origin, the
 * device's OTA channel, and confirm-or-rollback. Phase 2's next step replaces
 * this with this repo's <KioskApp/> (reused, pointed at his /api/kiosk/*).
 */
export function Status() {
  const [s, setS] = useState<RuntimeStatus | null>(null);
  useEffect(() => onStatus(setS), []);

  const rows: Array<[string, string]> = s
    ? [
        ["Native shell", s.native ? "yes" : "no (browser/preview)"],
        ["Device id", s.deviceId ?? "—"],
        ["Model", s.model ?? "—"],
        ["Android", s.androidRelease ?? "—"],
        ["Bundle version", s.bundleVersion ?? "builtin"],
        ["Online", s.online === null ? "—" : s.online ? "yes" : "no"],
        ["Bundle confirmed", s.confirmed ? "yes" : "pending"],
        ["OTA channel", s.otaManifestUrl ?? "default (everyone)"],
        ["Last check-in", s.lastCheckinAt ? new Date(s.lastCheckinAt).toLocaleTimeString() : "—"],
        ["Last error", s.lastError ?? "none"],
      ]
    : [];

  return (
    <main style={styles.main}>
      <h1 style={styles.h1}>Shabbos Program kiosk — bundle scaffold</h1>
      <p style={styles.sub}>
        Fleet runtime is live. The kiosk UI is not wired yet (next Phase&nbsp;2 step).
      </p>
      <div style={styles.grid}>
        {rows.map(([k, v]) => (
          <div key={k} style={styles.row}>
            <span style={styles.k}>{k}</span>
            <span style={styles.v}>{v}</span>
          </div>
        ))}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    margin: 0,
    padding: 24,
    boxSizing: "border-box",
    background: "#10151c",
    color: "#e7edf3",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },
  h1: { fontSize: 20, fontWeight: 600, margin: "0 0 4px" },
  sub: { color: "#8aa0b4", fontSize: 13, margin: "0 0 20px" },
  grid: { display: "flex", flexDirection: "column", gap: 6, maxWidth: 560 },
  row: { display: "flex", justifyContent: "space-between", gap: 16, fontSize: 15 },
  k: { color: "#8aa0b4" },
  v: { fontVariantNumeric: "tabular-nums", wordBreak: "break-all", textAlign: "right" },
};
