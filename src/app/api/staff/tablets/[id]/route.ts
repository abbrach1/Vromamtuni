import { fleetPatch, requireStaff } from "@/lib/fleet";
import { readBody } from "@/lib/kiosk-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH: change a tablet's settings (label, area, OTA channel, disabled). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = await requireStaff(request);
  if (blocked) return blocked;
  const { id } = await params;
  const body = await readBody(request);
  const patch: Record<string, unknown> = {};
  for (const k of ["label", "area", "ota_manifest_url", "disabled", "disabled_message"] as const) {
    if (k in body) patch[k] = body[k];
  }
  const { status, data } = await fleetPatch(id, patch);
  return Response.json(data, { status });
}
