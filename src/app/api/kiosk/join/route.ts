import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/admin";
import { checkKioskCode, json, PIN_RE, readBody, setPin } from "@/lib/kiosk-server";

/** A new bachur joins at the tablet with just his name and a PIN (no email needed). */
export async function POST(request: Request) {
  const denied = checkKioskCode(request);
  if (denied) return denied;
  const body = await readBody(request);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const pin = body.pin;
  if (!name || typeof pin !== "string" || !PIN_RE.test(pin)) return json({ error: "bad-request" }, 400);

  const user = await adminAuth().createUser({ displayName: name });
  await adminDb().collection("users").doc(user.uid).set({
    name,
    email: "",
    role: "bachur",
    requirementIds: [],
    smartGoal: "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await setPin(user.uid, pin);
  return json({ uid: user.uid, token: await adminAuth().createCustomToken(user.uid, { kiosk: true }) });
}
