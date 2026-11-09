"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "@/i18n/client";
import { useAuth } from "@/components/AuthProvider";

/**
 * Provisioning a wall tablet over WebUSB, from the staff portal.
 *
 * Everything runs in the operator's Chrome against a tablet on their desk; the
 * server only hands over the kiosk app and the recipe. Ported from PDCA's
 * admin provisioning flow, driven by the recipe at /api/staff/tablets/provision-
 * profile so the steps stay in sync with PDCA without redeploying here.
 *
 * The app cannot factory-reset a tablet (needs system privileges) and cannot be
 * made device owner once any account exists — so reset + skipping Google sign-in
 * stay manual, and are checked before anything is installed.
 */

type StepState = "pending" | "running" | "done" | "failed" | "skipped";
type Step = { id: string; label: string; state: StepState; detail?: string };

type Profile = {
  kiosk_package: string;
  kiosk_admin: string;
  apk_staging_path: string;
  remove_packages: string[];
  keep_packages: { pkg: string; reason: string }[];
  wifi_enable_commands: string[];
  launchable_query: string;
  kiosk_settings: { command: string; label: string }[];
  verify_checks: { label: string; command: string; expect: { source: string; flags: string } }[];
};

const INITIAL_STEPS: Step[] = [
  { id: "create", label: "Add the tablet", state: "pending" },
  { id: "connect", label: "Connect and authorise", state: "pending" },
  { id: "preflight", label: "Pre-flight checks", state: "pending" },
  { id: "apk", label: "Install the kiosk app", state: "pending" },
  { id: "owner", label: "Set device owner", state: "pending" },
  { id: "strip", label: "Remove preinstalled apps", state: "pending" },
  { id: "settings", label: "Apply kiosk settings", state: "pending" },
  { id: "verify", label: "Verify", state: "pending" },
  { id: "enroll", label: "Enrol the tablet", state: "pending" },
];

function remainingLaunchable(output: string, expected: Set<string>): string[] {
  const found = new Set<string>();
  for (const line of output.split("\n")) {
    const m = /^\s*packageName=([a-zA-Z0-9_.]+)\s*$/.exec(line);
    if (m && !expected.has(m[1])) found.add(m[1]);
  }
  return [...found].sort();
}

export function ProvisionScreen() {
  const { m } = useLang();
  const auth = useAuth();
  const user = auth.status === "signed-in" ? auth.user : null;
  const isStaff = auth.status === "signed-in" && auth.profile?.role === "staff";

  const [supported, setSupported] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [area, setArea] = useState("");
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState<"ok" | "failed" | null>(null);
  const [created, setCreated] = useState<{ deviceId: string; code: string; escapePin: string } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const token = useCallback(async () => (user ? await user.getIdToken() : ""), [user]);
  const authed = useCallback(
    async (path: string, init?: RequestInit) =>
      fetch(path, {
        ...init,
        headers: { "Content-Type": "application/json", authorization: `Bearer ${await token()}`, ...(init?.headers ?? {}) },
        cache: "no-store",
      }),
    [token],
  );

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "usb" in navigator);
  }, []);

  useEffect(() => {
    if (!isStaff) return;
    void authed("/api/staff/tablets/provision-profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((p: Profile | null) => p && setProfile(p))
      .catch(() => {});
  }, [authed, isStaff]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  const say = useCallback((line: string) => setLog((l) => [...l, line]), []);
  const mark = useCallback(
    (id: string, state: StepState, detail?: string) =>
      setSteps((s) => s.map((x) => (x.id === id ? { ...x, state, detail } : x))),
    [],
  );

  // Poll until the tablet enrols (the operator types the code into it).
  useEffect(() => {
    if (!created) return;
    let live = true;
    const tick = async () => {
      try {
        const r = await authed(`/api/staff/tablets/${created.deviceId}`);
        if (!live || !r.ok) return;
        const { device } = (await r.json()) as { device?: { enrolled?: boolean; label?: string } };
        if (device?.enrolled) {
          mark("enroll", "done", device.label);
          return "stop";
        }
      } catch {
        /* a failed poll is not a failure */
      }
    };
    const id = setInterval(() => void tick().then((x) => x === "stop" && clearInterval(id)), 4000);
    void tick();
    return () => { live = false; clearInterval(id); };
  }, [created, authed, mark]);

  async function downloadApk() {
    // Ask for a short-lived link with the sign-in in a header (never in the
    // URL, where it would end up in history and logs), then open the link.
    const res = await fetch("/api/staff/tablets/apk", {
      headers: { authorization: `Bearer ${await token()}` },
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { download_url?: unknown };
    if (!res.ok || typeof data.download_url !== "string") return;
    const a = document.createElement("a");
    a.href = data.download_url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function provision() {
    if (!apkFile || !profile) return;
    setRunning(true);
    setFinished(null);
    setLog([]);
    setSteps(INITIAL_STEPS);
    setCreated(null);

    mark("create", "running");
    const res = await authed("/api/staff/tablets", { method: "POST", body: JSON.stringify({ label, area }) });
    const addData = (await res.json().catch(() => ({}))) as {
      device_id?: string; enrollment_code?: string; escape_pin?: string; error?: string;
    };
    if (!res.ok || !addData.device_id || !addData.enrollment_code) {
      mark("create", "failed", addData.error ?? "could not add the tablet");
      say(`Error: ${addData.error ?? "could not add the tablet"}`);
      setFinished("failed");
      setRunning(false);
      return;
    }
    setCreated({ deviceId: addData.device_id, code: addData.enrollment_code, escapePin: addData.escape_pin ?? "" });
    mark("create", "done", label.trim());
    say(`Added "${label.trim()}"`);

    const { Adb, AdbDaemonTransport } = await import("@yume-chan/adb");
    const { AdbDaemonWebUsbDeviceManager } = await import("@yume-chan/adb-daemon-webusb");
    const AdbWebCredentialStore = (await import("@yume-chan/adb-credential-web")).default;
    const { ReadableStream } = await import("@yume-chan/stream-extra");

    let adb: InstanceType<typeof Adb> | null = null;
    try {
      mark("connect", "running");
      const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
      if (!manager) throw new Error("This browser does not expose WebUSB.");
      const usbDevice = await manager.requestDevice();
      if (!usbDevice) throw new Error("No tablet was chosen.");
      say(`Selected ${usbDevice.serial}`);
      let connection;
      try {
        connection = await usbDevice.connect();
      } catch (err) {
        throw new Error(
          `Could not claim the tablet over USB (${err instanceof Error ? err.message : String(err)}). ` +
            `Run "adb kill-server" on this computer and try again.`,
        );
      }
      const transport = await AdbDaemonTransport.authenticate({
        serial: usbDevice.serial,
        connection,
        credentialStore: new AdbWebCredentialStore("Shabbos kiosk provisioning"),
      });
      adb = new Adb(transport);
      const run = (cmd: string) => adb!.subprocess.noneProtocol.spawnWaitText(cmd);

      const model = (await run("getprop ro.product.model")).trim();
      const release = (await run("getprop ro.build.version.release")).trim();
      say(`Connected to ${model}, Android ${release}`);
      mark("connect", "done", `${model} · Android ${release}`);

      // preflight
      mark("preflight", "running");
      const accounts = (await run("dumpsys account")).match(/^\s+Account \{/gm)?.length ?? 0;
      if (accounts > 0) {
        throw new Error(`${accounts} account(s) on this tablet. Factory reset it and skip the Google sign-in.`);
      }
      const policy = await run("dumpsys device_policy");
      const ownerMatch = /Device Owner:[\s\S]{0,200}?admin=ComponentInfo\{([^/]+)\//.exec(policy);
      const existingOwner = ownerMatch?.[1];
      if (existingOwner && existingOwner !== profile.kiosk_package) {
        throw new Error(`Another app is already device owner: ${existingOwner}`);
      }
      mark("preflight", "done", existingOwner ? "already our device owner" : "clean device");

      // install
      mark("apk", "running");
      const apkBytes = new Uint8Array(await apkFile.arrayBuffer());
      say(`Pushing the kiosk app (${(apkBytes.byteLength / 1024 / 1024).toFixed(1)} MB)…`);
      const sync = await adb.sync();
      try {
        await sync.write({
          filename: profile.apk_staging_path,
          file: new ReadableStream<Uint8Array>({
            start(c) { c.enqueue(apkBytes); c.close(); },
          }),
        });
      } finally {
        await sync.dispose();
      }
      const install = await run(`pm install -r -g ${profile.apk_staging_path}`);
      if (!/Success/i.test(install)) throw new Error(`Install failed: ${install.trim()}`);
      await run(`rm -f ${profile.apk_staging_path}`);
      mark("apk", "done");

      // device owner
      mark("owner", "running");
      if (existingOwner === profile.kiosk_package) {
        mark("owner", "skipped", "already set");
      } else {
        const owner = await run(`dpm set-device-owner ${profile.kiosk_admin}`);
        if (!/Success/i.test(owner)) throw new Error(`Could not set device owner: ${owner.trim()}`);
        mark("owner", "done");
      }

      // strip
      mark("strip", "running");
      let removed = 0;
      for (const pkg of profile.remove_packages) {
        const out = await run(`pm uninstall --user 0 ${pkg}`);
        if (/Success/i.test(out)) { removed += 1; say(`removed ${pkg}`); }
      }
      for (const c of profile.wifi_enable_commands) await run(c).catch(() => "");
      mark("strip", "done", `${removed} of ${profile.remove_packages.length} removed`);

      // settings
      mark("settings", "running");
      for (const s of profile.kiosk_settings) { await run(s.command); say(s.label); }
      mark("settings", "done");

      // verify
      mark("verify", "running");
      const failures: string[] = [];
      for (const check of profile.verify_checks) {
        const out = await run(check.command);
        const re = new RegExp(check.expect.source, check.expect.flags);
        if (re.test(out)) say(`ok — ${check.label}`);
        else { failures.push(check.label); say(`FAILED — ${check.label}`); }
      }
      if (failures.length > 0) {
        mark("verify", "failed", failures.join(", "));
        throw new Error(`${failures.length} check(s) failed: ${failures.join(", ")}`);
      }
      const expected = new Set<string>([profile.kiosk_package, ...profile.keep_packages.map((k) => k.pkg)]);
      const leftover = remainingLaunchable(await run(profile.launchable_query).catch(() => ""), expected);
      mark("verify", "done", leftover.length > 0 ? `${leftover.length} other app(s) still on the tablet` : "all checks passed");
      if (leftover.length > 0) say(`Still launchable: ${leftover.join(", ")}`);

      mark("enroll", "running", "type the code below into the tablet");
      setFinished("ok");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      say(`Error: ${message}`);
      setSteps((s) => s.map((x) => (x.state === "running" ? { ...x, state: "failed", detail: message } : x)));
      setFinished("failed");
    } finally {
      try { await adb?.close(); } catch { /* already gone */ }
      setRunning(false);
    }
  }

  if (!isStaff) return <p className="card empty">{m.staffOnly}</p>;
  if (supported === false) {
    return (
      <>
        <div className="page-head"><span className="eyebrow">{m.staff}</span><h1>{m.provisionTitle}</h1></div>
        <p className="alert alert--error">{m.provisionNeedChrome}</p>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{m.staff}</span>
        <h1>{m.provisionTitle}</h1>
      </div>
      <div className="stack">
        <div className="card stack">
          <p className="muted">{m.provisionIntro}</p>
          <ol className="stack" style={{ paddingInlineStart: "1.2em", margin: 0 }}>
            <li>{m.provisionReset1}</li>
            <li>{m.provisionReset2}</li>
            <li>{m.provisionReset3}</li>
          </ol>
        </div>

        <div className="card stack">
          <div className="toolbar" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <button type="button" className="btn btn--small" onClick={() => void downloadApk()} disabled={running}>
              {m.provisionDownloadApk}
            </button>
            <label className="btn btn--small" style={{ cursor: "pointer" }}>
              {apkFile ? m.provisionApkChosen(apkFile.name) : m.provisionSelectApk}
              <input
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                style={{ display: "none" }}
                disabled={running}
                onChange={(e) => setApkFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <label className="field">
            <span className="field__label">{m.tName}</span>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} disabled={running || created !== null} />
          </label>
          <label className="field">
            <span className="field__label">{m.tArea}</span>
            <input className="input" value={area} onChange={(e) => setArea(e.target.value)} disabled={running || created !== null} />
          </label>
          <button
            type="button"
            className="btn btn--primary"
            disabled={running || !apkFile || !profile || label.trim().length === 0}
            onClick={() => void provision()}
          >
            {running ? m.provisionRunning : m.provisionStart}
          </button>
          {!apkFile && <p className="muted" style={{ fontSize: "0.85em" }}>{m.provisionNeedApk}</p>}
        </div>

        <div className="card">
          <ol className="stack" style={{ margin: 0, listStyle: "none", padding: 0 }}>
            {steps.map((s) => (
              <li key={s.id} style={{ display: "flex", gap: 10, fontSize: 15, opacity: s.state === "pending" ? 0.5 : 1 }}>
                <span aria-hidden style={{ width: "1.4em" }}>
                  {s.state === "done" || s.state === "skipped" ? "✓" : s.state === "running" ? "…" : s.state === "failed" ? "✗" : "○"}
                </span>
                <span>
                  {s.label}
                  {s.detail && <span className="muted" style={{ display: "block", fontSize: "0.8em" }}>{s.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {created && (
          <div className="card stack">
            <h2>{m.tEnrollTitle}</h2>
            <div className="field">
              <span className="field__label">{m.tEnrollIntro}</span>
              <strong style={{ fontSize: "1.6rem", letterSpacing: "0.15em" }}>{created.code}</strong>
            </div>
            {created.escapePin && (
              <div className="field">
                <span className="field__label">{m.tEscapeIntro}</span>
                <strong style={{ fontSize: "1.3rem", letterSpacing: "0.15em" }}>{created.escapePin}</strong>
              </div>
            )}
          </div>
        )}

        {finished === "ok" && <p className="alert alert--ok">{m.provisionDone}</p>}
        {finished === "failed" && <p className="alert alert--error">{m.provisionFailed}</p>}

        {log.length > 0 && (
          <div ref={logRef} className="card" style={{ maxHeight: "16rem", overflowY: "auto", fontFamily: "monospace", fontSize: "0.8rem" }}>
            {log.map((line, i) => (<div key={i} style={{ wordBreak: "break-all" }}>{line}</div>))}
          </div>
        )}
      </div>
    </>
  );
}
