/** Firebase web settings (public by design; access is controlled by firestore.rules). */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

/** Set NEXT_PUBLIC_FIREBASE_EMULATORS=1 to use the local Firebase emulators. */
export const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1";

export const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
