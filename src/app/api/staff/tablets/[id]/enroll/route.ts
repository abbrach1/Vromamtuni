import { fleetEnroll, requireStaff } from "@/lib/fleet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST: a fresh enrollment code for a tablet (re-provision after a reset). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = await requireStaff(request);
  if (blocked) return blocked;
  const { id } = await params;
  const { status, data } = await fleetEnroll(id);
  return Response.json(data, { status });
}
