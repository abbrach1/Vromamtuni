/**
 * The native bridge, reached directly off window.
 *
 * The bundle deliberately has NO @capacitor/* npm dependency: the native shell
 * injects the plugins at runtime on `window.Capacitor.Plugins`, so touching
 * them this way keeps the bundle's build tiny and its deps few. Everything here
 * degrades to null/false off a real tablet (browser dev, preview), so the same
 * bundle runs everywhere. See the partner contract (§7) for the full surface.
 */

type AnyFn = (...args: unknown[]) => Promise<unknown>;
type PluginMap = Record<string, Record<string, AnyFn>> & {
  KioskDevice?: KioskDevicePlugin;
  CapacitorUpdater?: CapacitorUpdaterPlugin;
};

export interface NativeIdentity {
  deviceId: string | null;
  deviceSecret: string | null;
  escapePin: string | null;
  androidId: string | null;
  model: string | null;
  androidRelease: string | null;
}

export interface NativeStatus {
  batteryPct?: number | null;
  batteryCharging?: boolean | null;
  appVersionName?: string | null;
  appVersionCode?: number | null;
  model?: string | null;
  androidRelease?: string | null;
}

export interface KioskDevicePlugin {
  getIdentity(): Promise<NativeIdentity>;
  getStatus(): Promise<NativeStatus>;
  reboot(): Promise<{ ok: boolean }>;
  setOrientation?(o: { mode: "auto" | "landscape" | "portrait" }): Promise<{ ok: boolean; mode?: string }>;
  markCommandExecuted?(o: { commandId: string }): Promise<{ ok: boolean }>;
  addListener?(event: "wake", fn: () => void): Promise<{ remove: () => Promise<void> }>;
}

export interface CapacitorUpdaterPlugin {
  current(): Promise<{ bundle: { version: string; id: string } }>;
  download(o: { url: string; version: string; checksum?: string }): Promise<{ id: string }>;
  set(o: { id: string }): Promise<void>;
  reload(): Promise<void>;
  notifyAppReady(): Promise<void>;
}

function cap(): { isNativePlatform?: () => boolean; Plugins?: PluginMap } | undefined {
  return (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: PluginMap } })
    .Capacitor;
}

export function isNative(): boolean {
  try {
    const c = cap();
    return !!(c && c.isNativePlatform && c.isNativePlatform());
  } catch {
    return false;
  }
}

export function kioskDevice(): KioskDevicePlugin | null {
  return cap()?.Plugins?.KioskDevice ?? null;
}

export function updater(): CapacitorUpdaterPlugin | null {
  return cap()?.Plugins?.CapacitorUpdater ?? null;
}
