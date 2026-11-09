import { adminAuth } from "@/lib/admin";
import { checkKioskCode, checkPin, isBachur, json, PIN_RE, pinState, readBody, setPin } from "@/lib/kiosk-server";

/**
 * Signs a bachur in on the tablet with his PIN. With `create`, a bachur
 * who may choose his PIN at the tablet (see mayChoosePin) sets it now.
 * Returns a one-time sign-in token for that bachur only.
 */
export async function POST(request: Request) {
  const denied = checkKioskCode(request);
  if (denied) return denied;
  const { uid, pin, create } = await readBody(request);
  if (typeof uid !== "string" || typeof pin !== "string" || !PIN_RE.test(pin)) {
    return json({ error: "bad-request" }, 400);
  }
  if (!(await isBachur(uid))) return json({ error: "not-found" }, 404);

  if (create === true) {
    if (!(await pinState(uid)).mayChoose) return json({ error: "may-not-choose" }, 409);
    await setPin(uid, pin);
  } else {
    const result = await checkPin(uid, pin);
    if (!result.ok) {
      const status = result.reason === "locked" ? 429 : result.reason === "none" ? 409 : 401;
      return json({ error: result.reason, triesLeft: result.triesLeft }, status);
    }
  }
  return json({ token: await adminAuth().createCustomToken(uid, { kiosk: true }) });
}
