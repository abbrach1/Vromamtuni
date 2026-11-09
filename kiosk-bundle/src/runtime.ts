/**
 * The partner-bundle runtime: how this bundle lives on the PDCA fleet.
 *
 * It implements the partner contract (see the PDCA repo's
 * apps/kiosk-tablet/docs/partner-bundle-contract.md) against the check-in route
 * in app/api/kiosk/checkin: identify the device, call home on a timer, run its
 * own OTA channel, and confirm-or-rollback. None of this touches HIS app — it's
 * the fleet plumbing the UI sits on top of.
 *
 * It intentionally reimplements only what the bundle needs to be healthy and
 * managed; the contract doc is the source of truth, not this file.
 */
import {
  CHECKIN_INTERVAL_MS,
  OTA_IDLE_BEFORE_APPLY_MS,
  OTA_POLL_INTERVAL_MS,
  OUR_ORIGIN,
} from "./config";
import {
  isNative,
  kioskDevice,
  updater,
  type NativeIdentity,
} from "./plugins";

export type RuntimeStatus = {
  native: boolean;
  deviceId: string | null;
  model: string | null;
  androidRelease: string | null;
  bundleVersion: string | null;
  online: boolean | null;
  confirmed: boolean;
  otaManifestUrl: string | null;
  lastCheckinAt: number | null;
  lastError: string | null;
};

const status: RuntimeStatus = {
  native: false,
  deviceId: null,
  model: null,
  androidRelease: null,
  bundleVersion: null,
  online: null,
  confirmed: false,
  otaManifestUrl: null,
  lastCheckinAt: null,
  lastError: null,
};

const listeners = new Set<(s: RuntimeStatus) => void>();
function emit() {
  for (const fn of listeners) fn({ ...status });
}
export function onStatus(fn: (s: RuntimeStatus) => void): () => void {
  listeners.add(fn);
  fn({ ...status });
  return () => listeners.delete(fn);
}
export function getStatus(): RuntimeStatus {
  return { ...status };
}

let identity: NativeIdentity | null = null;
let confirmed = false;

// ── interaction tracking, so an OTA swap never yanks the screen mid-use ──────
let lastInteractionAt = Date.now();
if (typeof window !== "undefined") {
  for (const e of ["touchstart", "mousedown", "keydown"]) {
    window.addEventListener(e, () => (lastInteractionAt = Date.now()), { passive: true });
  }
}
const idle = () => Date.now() - lastInteractionAt >= OTA_IDLE_BEFORE_APPLY_MS;

/** Touches inside the embedded /kiosk page arrive as messages; count them too. */
export function noteInteraction(): void {
  lastInteractionAt = Date.now();
}

async function loadIdentity(): Promise<void> {
  const d = kioskDevice();
  if (!d) return;
  try {
    identity = await d.getIdentity();
    status.deviceId = identity.deviceId;
    status.model = identity.model;
    status.androidRelease = identity.androidRelease;
    emit();
  } catch (err) {
    status.lastError = "identity: " + String(err);
    emit();
  }
}

async function currentBundleVersion(): Promise<string | null> {
  const u = updater();
  if (!u) return null;
  try {
    return (await u.current()).bundle.version;
  } catch {
    return null;
  }
}

/** Tell the shell this bundle is healthy — only after a real server round-trip,
    so a bundle that renders but can't reach home is still rolled back. */
async function confirmBundle(): Promise<void> {
  if (confirmed) return;
  const u = updater();
  if (!u) return;
  try {
    await u.notifyAppReady();
    confirmed = true;
    status.confirmed = true;
    emit();
  } catch (err) {
    status.lastError = "confirm: " + String(err);
    emit();
  }
}

// ── check-in ─────────────────────────────────────────────────────────────────
let pendingResults: Array<{ command_id: string; ok: boolean; detail?: string }> = [];

async function checkIn(): Promise<void> {
  if (!identity?.deviceId || !identity.deviceSecret) return;
  const d = kioskDevice();
  let telemetry: Record<string, unknown> = {};
  try {
    if (d) {
      const s = await d.getStatus();
      telemetry = {
        battery_pct: s.batteryPct ?? null,
        battery_charging: s.batteryCharging ?? null,
        app_version: s.appVersionName ?? null,
        version_code: s.appVersionCode ?? null,
        bundle_version: status.bundleVersion,
        model: s.model ?? status.model,
        android_release: s.androidRelease ?? status.androidRelease,
      };
    }
  } catch {
    /* telemetry is best-effort */
  }

  const results = pendingResults;
  pendingResults = [];
  try {
    const res = await fetch(`${OUR_ORIGIN}/api/kiosk/checkin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": identity.deviceId,
        "x-device-secret": identity.deviceSecret,
      },
      body: JSON.stringify({ telemetry, results }),
      cache: "no-store",
    });
    if (!res.ok) {
      status.online = false;
      status.lastError = `checkin ${res.status}`;
      emit();
      return;
    }
    const data = (await res.json()) as {
      settings?: { ota_manifest_url?: string | null };
      commands?: Array<{ id: string; kind: string; payload?: Record<string, unknown> }>;
    };
    status.online = true;
    status.lastCheckinAt = Date.now();
    status.otaManifestUrl = data.settings?.ota_manifest_url ?? null;
    status.lastError = null;
    emit();

    // The first successful round-trip is what confirms the bundle.
    void confirmBundle();

    for (const c of data.commands ?? []) {
      pendingResults.push(await runCommand(c));
    }
  } catch (err) {
    status.online = false;
    status.lastError = "checkin: " + String(err);
    emit();
  }
}

async function runCommand(c: {
  id: string;
  kind: string;
  payload?: Record<string, unknown>;
}): Promise<{ command_id: string; ok: boolean; detail?: string }> {
  const d = kioskDevice();
  const u = updater();
  try {
    switch (c.kind) {
      case "reload":
        if (u) await u.reload();
        else location.reload();
        return { command_id: c.id, ok: true };
      case "reboot":
        if (d) await d.reboot();
        return { command_id: c.id, ok: true };
      case "sync_now":
        void checkIn();
        return { command_id: c.id, ok: true };
      case "check_update":
        void otaCheck();
        return { command_id: c.id, ok: true };
      case "set_orientation": {
        const mode = String(c.payload?.mode ?? "auto");
        const m = mode === "landscape" || mode === "portrait" ? mode : "auto";
        if (d?.setOrientation) await d.setOrientation({ mode: m as "auto" | "landscape" | "portrait" });
        return { command_id: c.id, ok: true };
      }
      default:
        // Unknown-to-this-bundle commands are reported, not fatal.
        return { command_id: c.id, ok: false, detail: `unhandled: ${c.kind}` };
    }
  } catch (err) {
    return { command_id: c.id, ok: false, detail: String(err) };
  }
}

// ── OTA — this device's own channel ──────────────────────────────────────────
interface Manifest {
  version: string;
  url: string;
  checksum?: string;
}

function manifestUrl(): string {
  return status.otaManifestUrl ?? `${OUR_ORIGIN}/api/kiosk-update/manifest`;
}

async function otaCheck(): Promise<void> {
  const u = updater();
  if (!u) return;
  try {
    const res = await fetch(manifestUrl(), { cache: "no-store" });
    if (!res.ok) return;
    const manifest = (await res.json()) as Manifest;
    if (!manifest.version || !manifest.url) return;
    const current = await u.current();
    if (current.bundle.version === manifest.version) return;
    const next = await u.download({
      url: manifest.url,
      version: manifest.version,
      ...(manifest.checksum ? { checksum: manifest.checksum } : {}),
    });
    // Wait for a quiet moment before the swap reloads the screen.
    while (!idle()) await new Promise((r) => setTimeout(r, 1000));
    await u.set({ id: next.id });
  } catch (err) {
    status.lastError = "ota: " + String(err);
    emit();
  }
}

// ── boot ─────────────────────────────────────────────────────────────────────
let started = false;
export async function startRuntime(): Promise<void> {
  if (started) return;
  started = true;
  status.native = isNative();
  emit();

  // Offline-at-boot safety: if we're plainly offline, confirm the bundle so a
  // good one isn't rolled back just because the Wi-Fi is down.
  setTimeout(() => {
    if (!confirmed && typeof navigator !== "undefined" && navigator.onLine === false) {
      void confirmBundle();
    }
  }, 45_000);

  if (!status.native) return; // browser dev/preview: nothing to call home to.

  status.bundleVersion = await currentBundleVersion();
  emit();
  await loadIdentity();

  // React to a push that says something is waiting.
  try {
    await kioskDevice()?.addListener?.("wake", () => void checkIn());
  } catch {
    /* no listener in this environment */
  }

  await checkIn();
  setInterval(() => void checkIn(), CHECKIN_INTERVAL_MS);
  setTimeout(() => void otaCheck(), 5_000);
  setInterval(() => void otaCheck(), OTA_POLL_INTERVAL_MS);
}
