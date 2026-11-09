import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { adminAuth, adminDb, kioskEnabled } from "./admin";

export const PIN_RE = /^\d{4}$/;
const MAX_TRIES = 5;
const LOCK_MS = 5 * 60 * 1000;

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const digest = (s: string) => createHash("sha256").update(s).digest();

/** The tablet sends the code staff entered when setting it up. */
export function checkKioskCode(request: Request): Response | null {
  if (!kioskEnabled()) return json({ error: "off" }, 503);
  const sent = request.headers.get("x-kiosk-code") ?? "";
  if (!timingSafeEqual(digest(sent), digest(process.env.KIOSK_CODE ?? ""))) {
    return json({ error: "code" }, 401);
  }
  return null;
}

/** The signed-in user (from the app) behind a request, by Firebase ID token. */
export async function callerUid(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return null;
  try {
    return (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

const pinRef = (uid: string) => adminDb().collection("kioskPins").doc(uid);

function hashPin(pin: string, salt: string) {
  return scryptSync(pin, salt, 32).toString("hex");
}

export async function setPin(uid: string, pin: string) {
  const salt = randomBytes(16).toString("hex");
  await pinRef(uid).set({ hash: hashPin(pin, salt), salt, failed: 0, lockedUntil: 0 });
}

interface PinDoc {
  hash?: string;
  salt?: string;
  failed?: number;
  lockedUntil?: number;
  /** Set when staff reset the PIN: he may choose a new one at the tablet. */
  reset?: boolean;
}

/**
 * Whether a bachur may choose his PIN at the tablet: only after staff reset
 * it, or if he joined at the tablet. (Bachurim with an email account set
 * their PIN in the app, so no one can claim another bachur's name first.)
 */
export function mayChoosePin(pin: PinDoc | undefined, hasEmail: boolean) {
  if (pin?.hash) return false;
  return pin?.reset === true || !hasEmail;
}

export async function pinState(uid: string) {
  const [pin, user] = await Promise.all([pinRef(uid).get(), adminDb().collection("users").doc(uid).get()]);
  const data = pin.data() as PinDoc | undefined;
  return { hasPin: Boolean(data?.hash), mayChoose: mayChoosePin(data, Boolean(user.get("email"))) };
}

export async function clearPin(uid: string) {
  await pinRef(uid).set({ reset: true });
}

export type PinCheck = { ok: true } | { ok: false; reason: "none" | "locked" | "wrong"; triesLeft?: number };

/** Checks a PIN, counting wrong tries and locking for a few minutes after too many. */
export async function checkPin(uid: string, pin: string): Promise<PinCheck> {
  const ref = pinRef(uid);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.data() as PinDoc | undefined;
    if (!d?.hash || !d.salt) return { ok: false, reason: "none" } as const;
    if ((d.lockedUntil ?? 0) > Date.now()) return { ok: false, reason: "locked" } as const;
    const good = timingSafeEqual(Buffer.from(hashPin(pin, d.salt), "hex"), Buffer.from(d.hash, "hex"));
    if (good) {
      tx.update(ref, { failed: 0, lockedUntil: 0 });
      return { ok: true } as const;
    }
    const failed = (d.failed ?? 0) + 1;
    if (failed >= MAX_TRIES) {
      tx.update(ref, { failed: 0, lockedUntil: Date.now() + LOCK_MS });
      return { ok: false, reason: "locked" } as const;
    }
    tx.update(ref, { failed });
    return { ok: false, reason: "wrong", triesLeft: MAX_TRIES - failed } as const;
  });
}

export async function isBachur(uid: string) {
  const snap = await adminDb().collection("users").doc(uid).get();
  return snap.exists && snap.get("role") === "bachur";
}

export async function isStaff(uid: string) {
  const snap = await adminDb().collection("users").doc(uid).get();
  return snap.exists && snap.get("role") === "staff";
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}
