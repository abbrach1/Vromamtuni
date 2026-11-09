import { callerUid, isBachur, json, PIN_RE, readBody, setPin } from "@/lib/kiosk-server";
import { kioskEnabled } from "@/lib/admin";

/** A bachur, signed in on his phone, sets his own tablet PIN. */
export async function POST(request: Request) {
  if (!kioskEnabled()) return json({ error: "off" }, 503);
  const uid = await callerUid(request);
  if (!uid) return json({ error: "signed-out" }, 401);
  const { pin } = await readBody(request);
  if (typeof pin !== "string" || !PIN_RE.test(pin)) return json({ error: "bad-request" }, 400);
  if (!(await isBachur(uid))) return json({ error: "not-bachur" }, 403);
  await setPin(uid, pin);
  return json({ ok: true });
}
