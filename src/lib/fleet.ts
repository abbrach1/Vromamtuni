import "server-only";
import { callerUid, isStaff } from "./kiosk-server";

/**
 * The PDCA fleet control API — managing the wall tablets.
 *
 * The tablets run on PDCA's managed kiosk shell; this talks to PDCA's partner
 * control API to list them, send commands, change settings, and enroll new
 * ones. The API key is a secret and lives only here on the server
 * (PDCA_PARTNER_API_KEY); the browser never sees it — staff hit our own
 * /api/staff/tablets routes, which call this behind a staff check.
 */

const BASE = (process.env.PDCA_FLEET_API_BASE ?? "https://tcpdca.com/api/partner").replace(/\/$/, "");
const KEY = process.env.PDCA_PARTNER_API_KEY ?? "";

/** The channel to point a newly-enrolled tablet at, if one is configured. */
const MANIFEST_URL = process.env.PDCA_KIOSK_MANIFEST_URL ?? "";

export const fleetEnabled = () => Boolean(KEY);

type FleetResult = { status: number; data: Record<string, unknown> };

async function call(path: string, init?: RequestInit): Promise<FleetResult> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KEY}`,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, data };
  } catch {
    return { status: 502, data: { error: "could not reach the fleet service" } };
  }
}

export const fleetList = () => call("/devices");

export async function fleetAdd(label: string, area: string | null): Promise<FleetResult> {
  const created = await call("/devices", { method: "POST", body: JSON.stringify({ label, area }) });
  // If a channel is configured, point the new tablet at it straight away, so
  // staff don't have to set it by hand after enrolling.
  const id = created.data?.device_id;
  if (created.status === 201 && typeof id === "string" && MANIFEST_URL) {
    await call(`/devices/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ota_manifest_url: MANIFEST_URL }),
    }).catch(() => {});
  }
  return created;
}

export const fleetCommand = (id: string, kind: string, payload: Record<string, unknown>) =>
  call(`/devices/${encodeURIComponent(id)}/commands`, {
    method: "POST",
    body: JSON.stringify({ kind, payload }),
  });

export const fleetPatch = (id: string, patch: Record<string, unknown>) =>
  call(`/devices/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });

export const fleetEnroll = (id: string) =>
  call(`/devices/${encodeURIComponent(id)}/enroll`, { method: "POST" });

/** Guard for our own /api/staff/tablets routes: signed-in staff only. */
export async function requireStaff(request: Request): Promise<Response | null> {
  const uid = await callerUid(request);
  if (!uid || !(await isStaff(uid))) {
    return Response.json({ error: "staff only" }, { status: 403 });
  }
  if (!fleetEnabled()) {
    return Response.json({ error: "the fleet service is not configured" }, { status: 503 });
  }
  return null;
}
