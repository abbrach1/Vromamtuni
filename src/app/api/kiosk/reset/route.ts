import { callerUid, clearPin, isStaff, json, readBody } from "@/lib/kiosk-server";
import { kioskEnabled } from "@/lib/admin";

/** Staff clear a bachur's tablet PIN; he chooses a new one at the tablet. */
export async function POST(request: Request) {
  if (!kioskEnabled()) return json({ error: "off" }, 503);
  const uid = await callerUid(request);
  if (!uid || !(await isStaff(uid))) return json({ error: "staff-only" }, 403);
  const { bachurId } = await readBody(request);
  if (typeof bachurId !== "string" || !bachurId) return json({ error: "bad-request" }, 400);
  await clearPin(bachurId);
  return json({ ok: true });
}
