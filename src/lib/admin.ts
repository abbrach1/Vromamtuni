import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Server-side Firebase, used only by the wall-tablet API routes.
 * Needs FIREBASE_SERVICE_ACCOUNT (the service account key JSON) on Vercel,
 * or the Firebase emulators when developing.
 */
function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const key = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (key) return initializeApp({ credential: cert(JSON.parse(key)) });
  if (process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  }
  throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
}

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());

export const kioskEnabled = () =>
  Boolean(process.env.KIOSK_CODE) &&
  Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIRESTORE_EMULATOR_HOST);
