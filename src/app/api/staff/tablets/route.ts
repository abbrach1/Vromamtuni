import { fleetList, fleetAdd, requireStaff } from "@/lib/fleet";
import { readBody } from "@/lib/kiosk-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: the fleet's tablets + status. POST: enroll a new tablet. Staff only. */
export async function GET(request: Request) {
  const blocked = await requireStaff(request);
  if (blocked) return blocked;
  const { status, data } = await fleetList();
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const blocked = await requireStaff(request);
  if (blocked) return blocked;
  const body = await readBody(request);
  const label = String(body.label ?? "").trim();
  const area = body.area != null ? String(body.area).trim() : null;
  if (!label) return Response.json({ error: "give the tablet a name" }, { status: 400 });
  const { status, data } = await fleetAdd(label, area || null);
  return Response.json(data, { status });
}
