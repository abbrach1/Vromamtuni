import { adminDb } from "@/lib/admin";
import { checkKioskCode, json, mayChoosePin } from "@/lib/kiosk-server";

/** The names on the tablet's "tap your name" screen. */
export async function GET(request: Request) {
  const denied = checkKioskCode(request);
  if (denied) return denied;
  const db = adminDb();
  const [users, pins] = await Promise.all([
    db.collection("users").where("role", "==", "bachur").select("name", "email").get(),
    db.collection("kioskPins").select("hash", "reset").get(),
  ]);
  const pinById = new Map(pins.docs.map((d) => [d.id, d.data()]));
  const people = users.docs
    .map((d) => {
      const pin = pinById.get(d.id);
      return {
        id: d.id,
        name: String(d.get("name") ?? ""),
        hasPin: Boolean(pin?.hash),
        mayChoose: mayChoosePin(pin, Boolean(d.get("email"))),
      };
    })
    .filter((p) => p.name);
  return json({ people });
}
