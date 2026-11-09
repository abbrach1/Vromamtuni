import { fleetApkLink, requireStaff } from "@/lib/fleet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Redirects the browser to a short-lived kiosk-APK download.
 *
 * The APK is tens of MB and this app is on Vercel (4.5 MB response cap), so we
 * don't relay the bytes: we fetch a time-limited link from PDCA (server-side,
 * with the key) and 307 the browser straight to it (PDCA streams from Railway,
 * no size cap). The operator saves the APK and picks it in the provisioning page.
 *
 * Staff auth comes from a `token` query param (a Firebase ID token), because a
 * plain download navigation cannot send an Authorization header. Falls back to
 * the header for a programmatic call.
 */
export async function GET(request: Request) {
  const qToken = new URL(request.url).searchParams.get("token");
  const authRequest = qToken
    ? new Request(request.url, { headers: { authorization: `Bearer ${qToken}` } })
    : request;

  const blocked = await requireStaff(authRequest);
  if (blocked) return blocked;

  const { status, data } = await fleetApkLink();
  const url = data?.download_url;
  if (status !== 200 || typeof url !== "string") {
    return Response.json({ error: "could not get the APK link" }, { status: status === 200 ? 502 : status });
  }
  return Response.redirect(url, 307);
}
