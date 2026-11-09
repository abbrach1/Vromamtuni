import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { firebaseConfig, useEmulators } from "./env";

let cached: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

/** The shared wall tablet (/kiosk) keeps nothing on the device between bachurim. */
export const isKioskPage = () =>
  typeof window !== "undefined" && window.location.pathname.startsWith("/kiosk");

/**
 * The Firebase app, created on first use in the browser. On a bachur's own
 * phone, Firestore keeps an offline copy, so a tap made with no signal is
 * saved on the phone and synced when the connection comes back. On the wall
 * tablet, sign-ins and data live in memory only.
 */
export function firebase() {
  if (cached) return cached;
  const fresh = getApps().length === 0;
  const app = fresh ? initializeApp(firebaseConfig) : getApp();
  const kiosk = isKioskPage();
  let auth: Auth;
  try {
    auth = kiosk ? initializeAuth(app, { persistence: inMemoryPersistence }) : getAuth(app);
  } catch {
    auth = getAuth(app);
  }
  let db: Firestore;
  try {
    db = initializeFirestore(app, {
      localCache: kiosk
        ? memoryLocalCache()
        : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = getFirestore(app);
  }
  if (useEmulators && fresh) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  cached = { app, auth, db };
  return cached;
}
