import { fleetGetChannel, fleetSetChannel, requireStaff } from "@/lib/fleet";
import { readBody } from "@/lib/kiosk-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET/PUT the fleet's default OTA channel — every tablet provisioned after it's
    set inherits it automatically. */
export async function GET(request: Request) {
  const blocked = await requireStaff(request);
  if (blocked) return blocked;
  const { status, data } = await fleetGetChannel();
  return Response.json(data, { status });
}

export async function PUT(request: Request) {
  const blocked = await requireStaff(request);
  if (blocked) return blocked;
  const body = await readBody(request);
  const raw = body.ota_manifest_url;
  const url = raw == null ? null : String(raw).trim() || null;
  const { status, data } = await fleetSetChannel(url);
  return Response.json(data, { status });
}
