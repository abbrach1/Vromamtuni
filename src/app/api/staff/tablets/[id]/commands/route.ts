import { fleetCommand, requireStaff } from "@/lib/fleet";
import { readBody } from "@/lib/kiosk-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST: send one tablet a command (reboot, reload, set_orientation, …). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = await requireStaff(request);
  if (blocked) return blocked;
  const { id } = await params;
  const body = await readBody(request);
  const kind = String(body.kind ?? "");
  if (!kind) return Response.json({ error: "no command" }, { status: 400 });
  const payload = body.payload && typeof body.payload === "object" ? (body.payload as Record<string, unknown>) : {};
  const { status, data } = await fleetCommand(id, kind, payload);
  return Response.json(data, { status });
}
