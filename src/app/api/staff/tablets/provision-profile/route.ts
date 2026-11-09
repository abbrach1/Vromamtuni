import { fleetProfile, requireStaff } from "@/lib/fleet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The provisioning recipe (device-owner component, packages, settings, checks),
    proxied from PDCA so the WebUSB page runs the same steps as the office. */
export async function GET(request: Request) {
  const blocked = await requireStaff(request);
  if (blocked) return blocked;
  const { status, data } = await fleetProfile();
  return Response.json(data, { status });
}
