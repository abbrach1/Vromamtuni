import { fleetApkLink, requireStaff } from "@/lib/fleet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A short-lived kiosk-APK download link.
 *
 * The APK is tens of MB and this app is on Vercel (4.5 MB response cap), so we
 * don't relay the bytes: we fetch a time-limited link from PDCA (server-side,
 * with the key) and hand it to the page, which opens it (PDCA streams the file,
 * no size cap). Staff sign-in comes in the Authorization header only, never in
 * the URL.
 */
export async function GET(request: Request) {
  const blocked = await requireStaff(request);
  if (blocked) return blocked;

  const { status, data } = await fleetApkLink();
  const url = data?.download_url;
  if (status !== 200 || typeof url !== "string") {
    return Response.json({ error: "could not get the APK link" }, { status: status === 200 ? 502 : status });
  }
  return Response.json({ download_url: url }, { headers: { "Cache-Control": "no-store" } });
}
