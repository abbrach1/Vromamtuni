import { useEffect, useState } from "react";
import { onStatus, type RuntimeStatus } from "./runtime";

/**
 * The device status screen: shown when the program site can't be
 * reached (or isn't configured), with what the tablet knows about itself:
 * identity, check-in, OTA channel, confirm-or-rollback.
 */
export function Status({ note }: { note?: string }) {
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
      <h1 style={styles.h1}>ורוממתנו · Vromamtanu</h1>
      <p style={styles.sub}>{note ?? "Device status"}</p>
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
    position: "fixed",
    inset: 0,
    overflow: "auto",
    minHeight: "100vh",
    margin: 0,
    padding: 24,
    boxSizing: "border-box",
    background: "#0c0b09",
    color: "#f0e8d6",
    fontFamily: "Georgia, 'Times New Roman', serif",
  },
  h1: { fontSize: 20, fontWeight: 600, margin: "0 0 4px" },
  sub: { color: "#d4b062", fontSize: 15, margin: "0 0 20px" },
  grid: { display: "flex", flexDirection: "column", gap: 6, maxWidth: 560 },
  row: { display: "flex", justifyContent: "space-between", gap: 16, fontSize: 15 },
  k: { color: "#c4b89e" },
  v: { fontVariantNumeric: "tabular-nums", wordBreak: "break-all", textAlign: "right" },
};
